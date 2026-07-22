import * as React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NoteDetailScreen } from '../src/screens/NoteDetailScreen';
import { notesRepository } from '../src/services/notesRepository';
import { removeReminder } from '../src/services/calendar';
import { cancelReminder, scheduleReminder } from '../src/services/notifications';
import { extractNote } from '../src/services/extraction';
import type { Note } from '../src/types/note';

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    get: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    setNotificationId: jest.fn(),
  },
}));

jest.mock('../src/services/extraction', () => ({
  extractNote: jest.fn(),
}));

jest.mock('../src/services/calendar', () => ({
  removeReminder: jest.fn(),
}));

jest.mock('../src/services/notifications', () => ({
  cancelReminder: jest.fn(),
  scheduleReminder: jest.fn(),
}));

jest.mock('@react-navigation/elements', () => {
  const actual = jest.requireActual('@react-navigation/elements');
  return {
    ...actual,
    useHeaderHeight: () => 0,
  };
});

const mockGet = notesRepository.get as jest.Mock;
const mockSave = notesRepository.save as jest.Mock;
const mockDelete = notesRepository.delete as jest.Mock;
const mockRemoveReminder = removeReminder as jest.Mock;
const mockCancelReminder = cancelReminder as jest.Mock;
const mockScheduleReminder = scheduleReminder as jest.Mock;
const mockExtractNote = extractNote as jest.Mock;

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

async function confirmDelete() {
  const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const destructive = (buttons as Array<{ style?: string; onPress?: () => void }>).find(
    (b) => b.style === 'destructive',
  );
  await act(async () => {
    await destructive?.onPress?.();
  });
}

async function confirmRegenerate() {
  const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const destructive = (buttons as Array<{ style?: string; onPress?: () => void }>).find(
    (b) => b.style === 'destructive',
  );
  await act(async () => {
    await destructive?.onPress?.();
  });
}

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object' && node !== null && 'children' in node) {
    return collectText((node as { children: unknown }).children);
  }
  return [];
}

function renderedText(renderer: ReactTestRenderer): string {
  return collectText(renderer.toJSON()).join(' | ');
}

function mkNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    timestamp: 0,
    transcript: 't',
    summary: 'A note',
    people: [],
    topics: [],
    decisions: [],
    action_items: [],
    ...overrides,
  };
}

const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() } as any;
const route = { params: { id: 'n1' } } as any;

let activeRenderers: ReactTestRenderer[] = [];

afterEach(async () => {
  await act(async () => {
    activeRenderers.forEach((r) => r.unmount());
  });
  activeRenderers = [];
});

async function renderScreen() {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(NoteDetailScreen, { navigation, route }));
  });
  activeRenderers.push(renderer);
  return renderer;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NoteDetailScreen — delete cleans up child reminders', () => {
  it('cancels every reminder returned by notesRepository.delete() and navigates back', async () => {
    mockGet.mockResolvedValue(mkNote());
    mockDelete.mockResolvedValue([
      { calendarEventId: 'cal-1', notificationId: 'notif-1' },
      { calendarEventId: null, notificationId: 'notif-2' },
    ]);
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'note-detail-delete' }).props.onPress();
    });
    await confirmDelete();

    expect(mockDelete).toHaveBeenCalledWith('n1');
    expect(mockRemoveReminder).toHaveBeenCalledTimes(1);
    expect(mockRemoveReminder).toHaveBeenCalledWith('cal-1');
    expect(mockCancelReminder).toHaveBeenCalledTimes(2);
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-2');
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('calls neither cleanup function when the note had no reminders', async () => {
    mockGet.mockResolvedValue(mkNote());
    mockDelete.mockResolvedValue([]);
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'note-detail-delete' }).props.onPress();
    });
    await confirmDelete();

    expect(mockRemoveReminder).not.toHaveBeenCalled();
    expect(mockCancelReminder).not.toHaveBeenCalled();
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('NoteDetailScreen — saveEdit applies the reminder diff', () => {
  it('a removed row: cancels the calendar event and notification, and returns to view mode', async () => {
    mockGet.mockResolvedValue(mkNote());
    mockSave.mockResolvedValue({
      removed: [{ calendarEventId: 'cal-1', notificationId: 'notif-1' }],
      changed: [],
    });
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'note-detail-edit' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'note-detail-save' }).props.onPress();
    });

    expect(mockSave).toHaveBeenCalled();
    expect(mockRemoveReminder).toHaveBeenCalledWith('cal-1');
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
    expect(renderedText(renderer)).toContain('Επεξεργασία');
    expect(renderedText(renderer)).not.toContain('Αποθήκευση');
  });

  it('a changed row: cancels the old notification and schedules a new one', async () => {
    mockGet.mockResolvedValue(mkNote());
    mockScheduleReminder.mockResolvedValue('notif-new');
    mockSave.mockResolvedValue({
      removed: [],
      changed: [
        {
          id: 'a1',
          calendarEventId: 'cal-1',
          notificationId: 'notif-old',
          item: { id: 'a1', text: 'Call the plumber', due_date: '2099-01-01' },
        },
      ],
    });
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'note-detail-edit' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'note-detail-save' }).props.onPress();
    });

    expect(mockCancelReminder).toHaveBeenCalledWith('notif-old');
    expect(mockScheduleReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a1',
        due_date: '2099-01-01',
        note_id: 'n1',
        task_id: 'a1',
      }),
    );
    expect(mockRemoveReminder).not.toHaveBeenCalled();
  });
});

describe('NoteDetailScreen — transcript edit regenerates summary/tags only', () => {
  it('does not touch existing action items or their reminders on a transcript-only save', async () => {
    const existingActionItems = [
      {
        id: 'a1',
        text: 'Call the plumber',
        due_date: '2099-01-01',
        calendar_event_id: 'cal-1',
        notification_id: 'notif-1',
        status: 'open',
      },
    ];
    mockGet.mockResolvedValue(
      mkNote({ transcript: 'old transcript', action_items: existingActionItems }),
    );
    mockExtractNote.mockResolvedValue({
      summary: 'new summary',
      people: ['New Person'],
      topics: ['new topic'],
      action_items: [{ text: 'A hallucinated task', due_date: '2030-05-05' }],
    });
    mockSave.mockResolvedValue({ removed: [], changed: [] });

    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'note-detail-transcript' }).props.onPress();
    });
    await act(async () => {
      renderer.root
        .findByProps({ testID: 'note-detail-transcript-input' })
        .props.onChangeText('new transcript');
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'note-detail-regenerate' }).props.onPress();
    });
    await confirmRegenerate();

    expect(mockSave).toHaveBeenCalledTimes(1);
    const savedNote = mockSave.mock.calls[0][0] as Note;
    expect(savedNote.action_items).toEqual(existingActionItems);
    expect(savedNote.summary).toBe('new summary');
    expect(savedNote.transcript).toBe('new transcript');
    expect(mockScheduleReminder).not.toHaveBeenCalled();
    expect(mockCancelReminder).not.toHaveBeenCalled();
    expect(mockRemoveReminder).not.toHaveBeenCalled();
  });
});
