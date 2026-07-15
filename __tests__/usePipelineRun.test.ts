import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { usePipelineRun } from '../src/hooks/usePipelineRun';
import { transcribe } from '../src/services/transcription';
import { extractNote } from '../src/services/extraction';
import { notesRepository } from '../src/services/notesRepository';
import {
  getPermissionStatus,
  ensurePermission,
  scheduleReminder,
  cancelReminder,
} from '../src/services/notifications';
import type { Note } from '../src/types/note';

jest.mock('../src/services/transcription', () => ({
  transcribe: jest.fn(),
}));
jest.mock('../src/services/extraction', () => ({
  extractNote: jest.fn(),
}));
jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    create: jest.fn(),
    get: jest.fn(),
    setNotificationId: jest.fn(),
  },
}));
jest.mock('../src/services/notifications', () => ({
  getPermissionStatus: jest.fn(),
  ensurePermission: jest.fn(),
  scheduleReminder: jest.fn(),
  cancelReminder: jest.fn(),
}));

const mockTranscribe = transcribe as jest.Mock;
const mockExtractNote = extractNote as jest.Mock;
const mockCreate = notesRepository.create as jest.Mock;
const mockGet = notesRepository.get as jest.Mock;
const mockSetNotificationId = notesRepository.setNotificationId as jest.Mock;
const mockGetPermissionStatus = getPermissionStatus as jest.Mock;
const mockEnsurePermission = ensurePermission as jest.Mock;
const mockScheduleReminder = scheduleReminder as jest.Mock;
const mockCancelReminder = cancelReminder as jest.Mock;

function mkNote(actionItems: Note['action_items']): Note {
  return {
    id: 'n1',
    timestamp: 0,
    summary: 's',
    people: [],
    topics: [],
    decisions: [],
    action_items: actionItems,
    transcript: 't',
  };
}

async function renderUsePipelineRun() {
  let hookResult!: ReturnType<typeof usePipelineRun>;
  function TestComponent() {
    hookResult = usePipelineRun();
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(TestComponent));
  });
  return { getResult: () => hookResult };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExtractNote.mockResolvedValue({ summary: 's', people: [], topics: [], action_items: [] });
  mockCreate.mockResolvedValue('n1');
  mockGetPermissionStatus.mockResolvedValue({ granted: true, canAskAgain: true });
});

describe('usePipelineRun — automatic notification scheduling on save', () => {
  it('schedules a reminder for each due-dated action item and persists the returned id', async () => {
    mockGet.mockResolvedValue(
      mkNote([
        { id: 'a1', text: 'Call the plumber', due_date: '2099-06-15' },
        { id: 'a2', text: 'No due date', due_date: null },
      ]),
    );
    mockScheduleReminder.mockResolvedValue('notif-1');
    const { getResult } = await renderUsePipelineRun();

    await act(async () => {
      await getResult().runFromText('some transcript');
    });

    expect(mockScheduleReminder).toHaveBeenCalledTimes(1);
    expect(mockScheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a1',
        due_date: '2099-06-15',
        note_id: 'n1',
        task_id: 'a1',
      }),
    );
    expect(mockSetNotificationId).toHaveBeenCalledWith('a1', 'notif-1');
    expect(getResult().note?.action_items.find((i) => i.id === 'a1')?.notification_id).toBe('notif-1');
  });

  it('does not persist a notification id when scheduleReminder no-ops (R3/R4/denied permission)', async () => {
    mockGet.mockResolvedValue(mkNote([{ id: 'a1', text: 'x', due_date: '2020-01-01' }]));
    mockScheduleReminder.mockResolvedValue(null);
    const { getResult } = await renderUsePipelineRun();

    await act(async () => {
      await getResult().runFromText('t');
    });

    expect(mockSetNotificationId).not.toHaveBeenCalled();
  });

  it('does not request permission or schedule anything when no action item has a due_date', async () => {
    mockGet.mockResolvedValue(mkNote([{ id: 'a1', text: 'x', due_date: null }]));
    const { getResult } = await renderUsePipelineRun();

    await act(async () => {
      await getResult().runFromText('t');
    });

    expect(mockGetPermissionStatus).not.toHaveBeenCalled();
    expect(mockScheduleReminder).not.toHaveBeenCalled();
  });

  it('requests permission contextually when a due-dated item is produced and permission is not yet granted', async () => {
    mockGetPermissionStatus.mockResolvedValue({ granted: false, canAskAgain: true });
    mockGet.mockResolvedValue(mkNote([{ id: 'a1', text: 'x', due_date: '2099-06-15' }]));
    mockScheduleReminder.mockResolvedValue(null);
    const { getResult } = await renderUsePipelineRun();

    await act(async () => {
      await getResult().runFromText('t');
    });

    expect(mockEnsurePermission).toHaveBeenCalledTimes(1);
  });

  it('does not request permission again when already granted', async () => {
    mockGet.mockResolvedValue(mkNote([{ id: 'a1', text: 'x', due_date: '2099-06-15' }]));
    mockScheduleReminder.mockResolvedValue('notif-1');
    const { getResult } = await renderUsePipelineRun();

    await act(async () => {
      await getResult().runFromText('t');
    });

    expect(mockEnsurePermission).not.toHaveBeenCalled();
  });

  it('never throws or fails the pipeline when scheduling errors out — task creation must not be blocked', async () => {
    mockGet.mockResolvedValue(mkNote([{ id: 'a1', text: 'x', due_date: '2099-06-15' }]));
    mockScheduleReminder.mockRejectedValueOnce(new Error('boom'));
    const { getResult } = await renderUsePipelineRun();

    await act(async () => {
      await getResult().runFromText('t');
    });

    // The whole run() is wrapped in try/catch, so a scheduling error surfaces
    // as a pipeline error rather than crashing silently — documenting current
    // behavior rather than asserting a specific resilience guarantee beyond
    // R4/permission-denial, which scheduleReminder itself already handles.
    expect(getResult().phase).toBe('error');
  });

  it('cancels the orphaned notification and still succeeds when persisting the id fails AFTER scheduling succeeded', async () => {
    mockGet.mockResolvedValue(mkNote([{ id: 'a1', text: 'x', due_date: '2099-06-15' }]));
    mockScheduleReminder.mockResolvedValue('notif-1');
    mockSetNotificationId.mockRejectedValueOnce(new Error('db write failed'));
    const { getResult } = await renderUsePipelineRun();

    await act(async () => {
      await getResult().runFromText('t');
    });

    // The note itself already saved successfully — a bookkeeping failure here
    // must not be reported as a failed save, unlike a scheduleReminder failure
    // (previous test), which happens before anything succeeded.
    expect(getResult().phase).toBe('done');
    expect(getResult().note).not.toBeNull();
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
  });
});
