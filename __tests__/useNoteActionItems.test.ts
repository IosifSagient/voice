import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useNoteActionItems } from '../src/hooks/useNoteActionItems';
import { notesRepository } from '../src/services/notesRepository';
import { removeReminder } from '../src/services/calendar';
import { cancelReminder } from '../src/services/notifications';
import type { ActionItem, Note } from '../src/types/note';

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    completeActionItem: jest.fn(),
    deleteActionItem: jest.fn(),
    setNotificationId: jest.fn(),
  },
}));

jest.mock('../src/services/calendar', () => ({
  removeReminder: jest.fn(),
}));

jest.mock('../src/services/notifications', () => ({
  cancelReminder: jest.fn(),
}));

const mockComplete = notesRepository.completeActionItem as jest.Mock;
const mockDelete = notesRepository.deleteActionItem as jest.Mock;
const mockSetNotificationId = notesRepository.setNotificationId as jest.Mock;
const mockRemoveReminder = removeReminder as jest.Mock;
const mockCancelReminder = cancelReminder as jest.Mock;

function mkNote(actionItems: ActionItem[]): Note {
  return {
    id: 'n1',
    timestamp: 0,
    summary: 'summary',
    people: [],
    topics: [],
    decisions: [],
    action_items: actionItems,
    transcript: 't',
  };
}

// Manual render-hook helper, matching __tests__/useTasks.test.ts — no
// @testing-library/react-hooks is installed. Holds note state in the test
// component itself, the same way NoteDetailScreen owns it.
async function renderUseNoteActionItems(initialNote: Note) {
  let hookResult!: ReturnType<typeof useNoteActionItems>;
  let currentNote!: Note | null;
  function TestComponent() {
    const [note, setNote] = React.useState<Note | null>(initialNote);
    currentNote = note;
    hookResult = useNoteActionItems(note, setNote);
    return null;
  }
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(TestComponent));
  });
  return {
    getResult: () => hookResult,
    getNote: () => currentNote,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNoteActionItems — completeItem', () => {
  it('completes the item and removes it from the note locally', async () => {
    const note = mkNote([{ id: 'a1', text: 'Call the plumber', due_date: null }]);
    const { getResult, getNote } = await renderUseNoteActionItems(note);

    await act(async () => {
      await getResult().completeItem('a1');
    });

    expect(mockComplete).toHaveBeenCalledWith('a1');
    expect(getNote()!.action_items).toHaveLength(0);
  });

  it('leaves the other items in place', async () => {
    const note = mkNote([
      { id: 'a1', text: 'Call the plumber', due_date: null },
      { id: 'a2', text: 'Buy milk', due_date: null },
    ]);
    const { getResult, getNote } = await renderUseNoteActionItems(note);

    await act(async () => {
      await getResult().completeItem('a1');
    });

    expect(getNote()!.action_items.map((i) => i.id)).toEqual(['a2']);
  });

  it('cancels the scheduled notification and clears its id when the item has one', async () => {
    const note = mkNote([
      { id: 'a1', text: 'Call the plumber', due_date: '2099-01-01', notification_id: 'notif-1' },
    ]);
    const { getResult } = await renderUseNoteActionItems(note);

    await act(async () => {
      await getResult().completeItem('a1');
    });

    expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
    expect(mockSetNotificationId).toHaveBeenCalledWith('a1', null);
  });

  it('skips cancelReminder when the item has no scheduled notification', async () => {
    const note = mkNote([{ id: 'a1', text: 'Call the plumber', due_date: null }]);
    const { getResult } = await renderUseNoteActionItems(note);

    await act(async () => {
      await getResult().completeItem('a1');
    });

    expect(mockCancelReminder).not.toHaveBeenCalled();
    expect(mockSetNotificationId).not.toHaveBeenCalled();
  });
});

describe('useNoteActionItems — deleteItem', () => {
  it('deletes the item, removes the calendar reminder, cancels the notification, and removes it locally', async () => {
    const note = mkNote([
      { id: 'a1', text: 'Call the plumber', due_date: null, calendar_event_id: 'cal-123' },
    ]);
    mockDelete.mockResolvedValue({ calendarEventId: 'cal-123', notificationId: 'notif-123' });
    const { getResult, getNote } = await renderUseNoteActionItems(note);

    await act(async () => {
      await getResult().deleteItem('a1');
    });

    expect(mockDelete).toHaveBeenCalledWith('a1');
    expect(mockRemoveReminder).toHaveBeenCalledWith('cal-123');
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-123');
    expect(getNote()!.action_items).toHaveLength(0);
  });

  it('skips removeReminder/cancelReminder when there is no calendar event or notification', async () => {
    const note = mkNote([{ id: 'a1', text: 'Call the plumber', due_date: null }]);
    mockDelete.mockResolvedValue(null);
    const { getResult, getNote } = await renderUseNoteActionItems(note);

    await act(async () => {
      await getResult().deleteItem('a1');
    });

    expect(mockRemoveReminder).not.toHaveBeenCalled();
    expect(mockCancelReminder).not.toHaveBeenCalled();
    expect(getNote()!.action_items).toHaveLength(0);
  });
});
