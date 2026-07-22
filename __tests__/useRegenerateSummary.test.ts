import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useRegenerateSummary } from '../src/hooks/useRegenerateSummary';
import { extractNote } from '../src/services/extraction';
import { notesRepository } from '../src/services/notesRepository';
import { removeReminder } from '../src/services/calendar';
import { cancelReminder, scheduleReminder } from '../src/services/notifications';
import type { Note } from '../src/types/note';

jest.mock('../src/services/extraction', () => ({
  extractNote: jest.fn(),
}));
jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    save: jest.fn(),
    setNotificationId: jest.fn(),
  },
}));
jest.mock('../src/services/calendar', () => ({
  removeReminder: jest.fn(),
}));
jest.mock('../src/services/notifications', () => ({
  cancelReminder: jest.fn(),
  scheduleReminder: jest.fn(),
}));

const mockExtractNote = extractNote as jest.Mock;
const mockSave = notesRepository.save as jest.Mock;
const mockRemoveReminder = removeReminder as jest.Mock;
const mockCancelReminder = cancelReminder as jest.Mock;
const mockScheduleReminder = scheduleReminder as jest.Mock;

const existingActionItems: Note['action_items'] = [
  {
    id: 'a1',
    text: 'Call the plumber',
    due_date: '2099-01-01',
    calendar_event_id: 'cal-1',
    notification_id: 'notif-1',
    status: 'open',
  },
];

function mkNote(): Note {
  return {
    id: 'n1',
    timestamp: 0,
    summary: 'old summary',
    people: ['Old Person'],
    topics: ['old topic'],
    decisions: [],
    action_items: existingActionItems.map((item) => ({ ...item })),
    transcript: 'old transcript',
  };
}

async function renderUseRegenerateSummary(initialNote: Note) {
  let hookResult!: ReturnType<typeof useRegenerateSummary>;
  function TestComponent() {
    const [note, setNote] = React.useState<Note | null>(initialNote);
    hookResult = useRegenerateSummary(note, setNote);
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
  // The mocked extraction returns its OWN action_items — regenerate() must never
  // let these reach the save payload; only summary/people/topics should be applied.
  mockExtractNote.mockResolvedValue({
    summary: 'new summary',
    people: ['New Person'],
    topics: ['new topic'],
    action_items: [{ text: 'A task the extraction hallucinated', due_date: '2030-05-05' }],
  });
  mockSave.mockResolvedValue({ removed: [], changed: [] });
});

describe('useRegenerateSummary — regenerates summary/people/topics only', () => {
  it('saves a payload whose action_items are identical to the pre-edit note', async () => {
    const { getResult } = await renderUseRegenerateSummary(mkNote());

    await act(async () => {
      await getResult().regenerate('new transcript');
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    const savedNote = mockSave.mock.calls[0][0] as Note;
    expect(savedNote.action_items).toEqual(existingActionItems);
    expect(savedNote.summary).toBe('new summary');
    expect(savedNote.people).toEqual(['New Person']);
    expect(savedNote.topics).toEqual(['new topic']);
    expect(savedNote.transcript).toBe('new transcript');
  });

  it('never lets the extraction result action_items reach the save payload', async () => {
    const { getResult } = await renderUseRegenerateSummary(mkNote());

    await act(async () => {
      await getResult().regenerate('new transcript');
    });

    const savedNote = mockSave.mock.calls[0][0] as Note;
    const savedTexts = savedNote.action_items.map((i) => i.text);
    expect(savedTexts).not.toContain('A task the extraction hallucinated');
  });

  it('does not touch reminders when the diff is empty', async () => {
    const { getResult } = await renderUseRegenerateSummary(mkNote());

    await act(async () => {
      await getResult().regenerate('new transcript');
    });

    expect(mockScheduleReminder).not.toHaveBeenCalled();
    expect(mockCancelReminder).not.toHaveBeenCalled();
    expect(mockRemoveReminder).not.toHaveBeenCalled();
  });

  it('still applies the reminder diff when save() reports one (parity with reminderDiff.ts)', async () => {
    mockSave.mockResolvedValue({
      removed: [{ calendarEventId: 'cal-1', notificationId: 'notif-1' }],
      changed: [],
    });
    const { getResult } = await renderUseRegenerateSummary(mkNote());

    await act(async () => {
      await getResult().regenerate('new transcript');
    });

    expect(mockRemoveReminder).toHaveBeenCalledWith('cal-1');
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
  });
});
