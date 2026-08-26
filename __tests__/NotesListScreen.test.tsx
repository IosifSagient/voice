import * as React from 'react';
import { Alert, ActionSheetIOS } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NotesListScreen } from '../src/screens/NotesListScreen';
import { notesRepository } from '../src/services/notesRepository';
import { removeReminder } from '../src/services/calendar';
import { cancelReminder } from '../src/services/notifications';
import type { Note } from '../src/types/note';

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    list: jest.fn(),
    listAll: jest.fn(),
    search: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../src/services/calendar', () => ({
  removeReminder: jest.fn(),
}));

jest.mock('../src/services/notifications', () => ({
  cancelReminder: jest.fn(),
}));

jest.mock('../src/hooks/useTodayTasks', () => ({
  useTodayTasks: () => ({
    overdue: [],
    today: [],
    upcoming: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
    complete: jest.fn(),
    reopen: jest.fn(),
  }),
}));

// useFocusEffect only fires on navigation focus events, which don't exist
// outside a NavigationContainer. Reduce it to a plain mount-time effect so
// NotesListScreen's initial fetch runs the same way it would on first focus.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactForMock = require('react');
  return {
    ...actual,
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactForMock.useEffect(() => effect(), []);
    },
  };
});

const mockListAll = notesRepository.listAll as jest.Mock;
const mockSearch = notesRepository.search as jest.Mock;
const mockDelete = notesRepository.delete as jest.Mock;
const mockRemoveReminder = removeReminder as jest.Mock;
const mockCancelReminder = cancelReminder as jest.Mock;

// Alert.alert is a native call with no UI to interact with in this renderer —
// spy on it so the destructive button's onPress can be invoked directly.
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Same reasoning for the list row's long-press action sheet (Increment 4b):
// no native ActionSheetManager under Jest, so spy on it and drive its
// callback directly with the Διαγραφή option's index.
const actionSheetSpy = jest
  .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
  .mockImplementation(() => {});

// Index of «Διαγραφή» in the sheet's options: Αντιγραφή, Κοινοποίηση,
// Διαγραφή, Άκυρο (NotesListScreen.tsx's onLongPress action sheet).
const DELETE_OPTION_INDEX = 2;

async function selectDeleteFromActionSheet() {
  const [, callback] = actionSheetSpy.mock.calls[actionSheetSpy.mock.calls.length - 1];
  await act(async () => {
    (callback as (buttonIndex: number) => void)(DELETE_OPTION_INDEX);
  });
}

async function confirmDelete() {
  const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const destructive = (buttons as Array<{ style?: string; onPress?: () => void }>).find(
    (b) => b.style === 'destructive',
  );
  await act(async () => {
    await destructive?.onPress?.();
  });
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
    openActionCount: 0,
    ...overrides,
  };
}

const navigation = { navigate: jest.fn() } as any;
const route = {} as any;

// FlatList schedules an internal debounced timer; unmounting after each test
// avoids it firing (and logging an act() warning) once the test has ended.
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
    renderer = create(React.createElement(NotesListScreen, { navigation, route }));
  });
  activeRenderers.push(renderer);
  return renderer;
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

beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue([]);
});

describe('NotesListScreen — initial listAll() failure', () => {
  it('shows an error state with retry (not the empty-account state) when listAll() rejects', async () => {
    mockListAll.mockRejectedValueOnce(new Error('boom'));
    const renderer = await renderScreen();

    const text = renderedText(renderer);
    expect(text).toContain('boom');
    expect(text).toContain('Δοκιμάστε ξανά');
    expect(text).not.toContain('Καμία σημείωση ακόμα');
  });

  it('retry re-fetches and recovers into the normal list', async () => {
    mockListAll.mockRejectedValueOnce(new Error('boom'));
    const renderer = await renderScreen();
    expect(renderedText(renderer)).toContain('boom');

    mockListAll.mockResolvedValueOnce([mkNote({ summary: 'Recovered note' })]);
    await act(async () => {
      renderer.root.findByProps({ testID: 'notes-list-retry' }).props.onPress();
    });

    const text = renderedText(renderer);
    expect(text).toContain('Recovered note');
    expect(text).not.toContain('boom');
  });

  it('a genuinely empty account (listAll() resolves to []) still shows the empty-account state, not the error state', async () => {
    mockListAll.mockResolvedValueOnce([]);
    const renderer = await renderScreen();

    const text = renderedText(renderer);
    expect(text).toContain('Καμία σημείωση ακόμα');
    expect(text).not.toContain('Δοκιμάστε ξανά');
  });
});

describe('NotesListScreen — cold-start loading flash', () => {
  it('does not flash the empty-account copy while the initial listAll() fetch is still pending', async () => {
    // Deliberately NOT resolved via mockResolvedValueOnce — this keeps the
    // fetch genuinely pending across the initial render, unlike every other
    // test in this file where mount + resolution are coalesced into one
    // `await act()`. That coalescing is exactly why this bug shipped
    // unnoticed: it never let anyone observe the interim render.
    let resolveListAll!: (notes: Note[]) => void;
    mockListAll.mockReturnValueOnce(
      new Promise<Note[]>((resolve) => {
        resolveListAll = resolve;
      }),
    );

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(React.createElement(NotesListScreen, { navigation, route }));
    });
    activeRenderers.push(renderer);

    // The fetch is still pending here — this is the render that used to
    // paint "no notes yet" before the loading gate existed.
    expect(renderedText(renderer)).not.toContain('Καμία σημείωση ακόμα');

    await act(async () => {
      resolveListAll([]);
      // Flush the microtask queue so the resolved promise's .then (setNotes/
      // setNotesLoading) runs inside this act().
      await Promise.resolve();
      await Promise.resolve();
    });

    // Now that the fetch has genuinely resolved to an empty account, the
    // real empty-account copy is expected.
    expect(renderedText(renderer)).toContain('Καμία σημείωση ακόμα');
  });
});

describe('NotesListScreen — search() failure', () => {
  it('shows the error state (not stale results) when search() rejects', async () => {
    mockListAll.mockResolvedValueOnce([mkNote({ summary: 'Original note' })]);
    const renderer = await renderScreen();
    expect(renderedText(renderer)).toContain('Original note');

    mockSearch.mockRejectedValueOnce(new Error('search failed'));
    await act(async () => {
      renderer.root.findByProps({ placeholder: 'Αναζήτηση…' }).props.onChangeText('plumber');
    });

    const text = renderedText(renderer);
    expect(text).toContain('search failed');
    expect(text).not.toContain('Original note');
  });

  it('retry after a search failure re-runs the search and recovers', async () => {
    mockListAll.mockResolvedValueOnce([]);
    const renderer = await renderScreen();

    mockSearch.mockRejectedValueOnce(new Error('search failed'));
    await act(async () => {
      renderer.root.findByProps({ placeholder: 'Αναζήτηση…' }).props.onChangeText('plumber');
    });
    expect(renderedText(renderer)).toContain('search failed');

    mockSearch.mockResolvedValueOnce([mkNote({ summary: 'Plumber note' })]);
    await act(async () => {
      renderer.root.findByProps({ testID: 'notes-list-retry' }).props.onPress();
    });

    const text = renderedText(renderer);
    expect(text).toContain('Plumber note');
    expect(mockSearch).toHaveBeenLastCalledWith('plumber');
  });
});

describe('NotesListScreen — tag filter sheet', () => {
  // Rows only exist in the tree once the sheet is open (RN Modal renders
  // null while `visible` is false) — open via the trigger button first,
  // same as a real tap would, then find the row by its `label` prop (the
  // sheet's internal FilterRow renderer).
  async function openSheet(renderer: ReactTestRenderer) {
    await act(async () => {
      renderer.root.findByProps({ testID: 'tag-filter-button' }).props.onPress();
    });
  }

  async function selectRow(renderer: ReactTestRenderer, label: string) {
    await openSheet(renderer);
    await act(async () => {
      renderer.root.findByProps({ label }).props.onPress();
    });
  }

  it('selecting a person row narrows the list to notes containing that person', async () => {
    mockListAll.mockResolvedValueOnce([
      mkNote({ id: 'a', summary: 'Note A', people: ['Παπαδόπουλος'] }),
      mkNote({ id: 'b', summary: 'Note B', people: ['Γιαννόπουλος'] }),
    ]);
    const renderer = await renderScreen();
    expect(renderedText(renderer)).toContain('Note A');
    expect(renderedText(renderer)).toContain('Note B');

    await selectRow(renderer, 'Παπαδόπουλος');

    const text = renderedText(renderer);
    expect(text).toContain('Note A');
    expect(text).not.toContain('Note B');
  });

  it('selecting a topic row narrows the list via word-boundary subset match', async () => {
    mockListAll.mockResolvedValueOnce([
      mkNote({ id: 'a', summary: 'Note A', topics: ['φόρος εισοδήματος'] }),
      mkNote({ id: 'b', summary: 'Note B', topics: ['αυτοκίνητο'] }),
    ]);
    const renderer = await renderScreen();

    await selectRow(renderer, 'φόρος εισοδήματος');

    const text = renderedText(renderer);
    expect(text).toContain('Note A');
    expect(text).not.toContain('Note B');
  });

  it('selecting Όλα clears an active filter and restores the full list', async () => {
    mockListAll.mockResolvedValueOnce([
      mkNote({ id: 'a', summary: 'Note A', people: ['Παπαδόπουλος'] }),
      mkNote({ id: 'b', summary: 'Note B', people: ['Γιαννόπουλος'] }),
    ]);
    const renderer = await renderScreen();

    await selectRow(renderer, 'Παπαδόπουλος');
    expect(renderedText(renderer)).not.toContain('Note B');

    await selectRow(renderer, 'Όλα');

    const text = renderedText(renderer);
    expect(text).toContain('Note A');
    expect(text).toContain('Note B');
  });

  it('an active filter intersects with an active search — both must match', async () => {
    mockListAll.mockResolvedValueOnce([
      mkNote({ id: 'a', summary: 'Meeting about taxes', people: ['Παπαδόπουλος'] }),
      mkNote({ id: 'b', summary: 'Meeting about lunch', people: ['Παπαδόπουλος'] }),
    ]);
    const renderer = await renderScreen();

    await selectRow(renderer, 'Παπαδόπουλος');
    expect(renderedText(renderer)).toContain('Meeting about taxes');
    expect(renderedText(renderer)).toContain('Meeting about lunch');

    mockSearch.mockResolvedValueOnce([
      mkNote({ id: 'a', summary: 'Meeting about taxes', people: ['Παπαδόπουλος'] }),
    ]);
    await act(async () => {
      renderer.root.findByProps({ placeholder: 'Αναζήτηση…' }).props.onChangeText('taxes');
    });

    const text = renderedText(renderer);
    expect(text).toContain('Meeting about taxes');
    expect(text).not.toContain('Meeting about lunch');
  });

  it('the sheet does not change while searching (stable all-notes snapshot)', async () => {
    mockListAll.mockResolvedValueOnce([
      mkNote({ id: 'a', summary: 'Note A', people: ['Παπαδόπουλος'] }),
    ]);
    const renderer = await renderScreen();
    await openSheet(renderer);
    expect(() => renderer.root.findByProps({ label: 'Παπαδόπουλος' })).not.toThrow();

    // Close without selecting (backdrop tap = cancel), same as LOCKED DECISION 3.
    await act(async () => {
      renderer.root.findByProps({ testID: 'tag-filter-sheet-backdrop' }).props.onPress();
    });

    mockSearch.mockResolvedValueOnce([]); // search finds nothing, but the row must still be offered
    await act(async () => {
      renderer.root.findByProps({ placeholder: 'Αναζήτηση…' }).props.onChangeText('nothing matches');
    });

    await openSheet(renderer);
    expect(() => renderer.root.findByProps({ label: 'Παπαδόπουλος' })).not.toThrow();
  });

  it('date grouping still applies to the filtered result', async () => {
    mockListAll.mockResolvedValueOnce([
      mkNote({ id: 'a', summary: 'Note A', people: ['Παπαδόπουλος'], timestamp: 0 }),
      mkNote({ id: 'b', summary: 'Note B', people: ['Γιαννόπουλος'], timestamp: 0 }),
    ]);
    const renderer = await renderScreen();

    await selectRow(renderer, 'Παπαδόπουλος');

    const text = renderedText(renderer);
    expect(text).toContain('Παλαιότερα'); // epoch timestamp always buckets as "older"
    expect(text).toContain('Note A');
    expect(text).not.toContain('Note B');
  });

  it('the button label reflects the active filter', async () => {
    mockListAll.mockResolvedValueOnce([
      mkNote({ id: 'a', summary: 'Note A', people: ['Παπαδόπουλος'] }),
    ]);
    const renderer = await renderScreen();
    expect(renderedText(renderer)).toContain('Φίλτρα');

    await selectRow(renderer, 'Παπαδόπουλος');

    expect(renderedText(renderer)).toContain('Παπαδόπουλος');
  });
});

describe('NotesListScreen — long-press delete cleans up child reminders', () => {
  it('cancels every child action item\'s calendar event and notification before refreshing the list', async () => {
    mockListAll.mockResolvedValue([mkNote({ id: 'n1', summary: 'Note to delete' })]);
    mockDelete.mockResolvedValue([
      { calendarEventId: 'cal-1', notificationId: 'notif-1' },
      { calendarEventId: null, notificationId: 'notif-2' },
    ]);
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'notes-list-row' }).props.onLongPress();
    });
    await selectDeleteFromActionSheet();
    await confirmDelete();

    expect(mockDelete).toHaveBeenCalledWith('n1');
    expect(mockRemoveReminder).toHaveBeenCalledTimes(1);
    expect(mockRemoveReminder).toHaveBeenCalledWith('cal-1');
    expect(mockCancelReminder).toHaveBeenCalledTimes(2);
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-2');
  });

  it('calls neither cleanup function when the note had no action items', async () => {
    mockListAll.mockResolvedValue([mkNote({ id: 'n1', summary: 'Note to delete' })]);
    mockDelete.mockResolvedValue([]);
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'notes-list-row' }).props.onLongPress();
    });
    await selectDeleteFromActionSheet();
    await confirmDelete();

    expect(mockRemoveReminder).not.toHaveBeenCalled();
    expect(mockCancelReminder).not.toHaveBeenCalled();
  });
});
