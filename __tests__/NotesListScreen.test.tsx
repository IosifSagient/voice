import * as React from 'react';
import { Alert } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NotesListScreen } from '../src/screens/NotesListScreen';
import { notesRepository } from '../src/services/notesRepository';
import { removeReminder } from '../src/services/calendar';
import { cancelReminder } from '../src/services/notifications';
import type { Note } from '../src/types/note';

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    list: jest.fn(),
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

const mockList = notesRepository.list as jest.Mock;
const mockSearch = notesRepository.search as jest.Mock;
const mockDelete = notesRepository.delete as jest.Mock;
const mockRemoveReminder = removeReminder as jest.Mock;
const mockCancelReminder = cancelReminder as jest.Mock;

// Alert.alert is a native call with no UI to interact with in this renderer —
// spy on it so the destructive button's onPress can be invoked directly.
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
    renderer = create(React.createElement(NotesListScreen, { navigation }));
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

describe('NotesListScreen — initial list() failure', () => {
  it('shows an error state with retry (not the empty-account state) when list() rejects', async () => {
    mockList.mockRejectedValueOnce(new Error('boom'));
    const renderer = await renderScreen();

    const text = renderedText(renderer);
    expect(text).toContain('boom');
    expect(text).toContain('Δοκιμάστε ξανά');
    expect(text).not.toContain('Καμία σημείωση ακόμα');
  });

  it('retry re-fetches and recovers into the normal list', async () => {
    mockList.mockRejectedValueOnce(new Error('boom'));
    const renderer = await renderScreen();
    expect(renderedText(renderer)).toContain('boom');

    mockList.mockResolvedValueOnce([mkNote({ summary: 'Recovered note' })]);
    await act(async () => {
      renderer.root.findByProps({ testID: 'notes-list-retry' }).props.onPress();
    });

    const text = renderedText(renderer);
    expect(text).toContain('Recovered note');
    expect(text).not.toContain('boom');
  });

  it('a genuinely empty account (list() resolves to []) still shows the empty-account state, not the error state', async () => {
    mockList.mockResolvedValueOnce([]);
    const renderer = await renderScreen();

    const text = renderedText(renderer);
    expect(text).toContain('Καμία σημείωση ακόμα');
    expect(text).not.toContain('Δοκιμάστε ξανά');
  });
});

describe('NotesListScreen — search() failure', () => {
  it('shows the error state (not stale results) when search() rejects', async () => {
    mockList.mockResolvedValueOnce([mkNote({ summary: 'Original note' })]);
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
    mockList.mockResolvedValueOnce([]);
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

describe('NotesListScreen — long-press delete cleans up child reminders', () => {
  it('cancels every child action item\'s calendar event and notification before refreshing the list', async () => {
    mockList.mockResolvedValue([mkNote({ id: 'n1', summary: 'Note to delete' })]);
    mockDelete.mockResolvedValue([
      { calendarEventId: 'cal-1', notificationId: 'notif-1' },
      { calendarEventId: null, notificationId: 'notif-2' },
    ]);
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'notes-list-row' }).props.onLongPress();
    });
    await confirmDelete();

    expect(mockDelete).toHaveBeenCalledWith('n1');
    expect(mockRemoveReminder).toHaveBeenCalledTimes(1);
    expect(mockRemoveReminder).toHaveBeenCalledWith('cal-1');
    expect(mockCancelReminder).toHaveBeenCalledTimes(2);
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-1');
    expect(mockCancelReminder).toHaveBeenCalledWith('notif-2');
  });

  it('calls neither cleanup function when the note had no action items', async () => {
    mockList.mockResolvedValue([mkNote({ id: 'n1', summary: 'Note to delete' })]);
    mockDelete.mockResolvedValue([]);
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'notes-list-row' }).props.onLongPress();
    });
    await confirmDelete();

    expect(mockRemoveReminder).not.toHaveBeenCalled();
    expect(mockCancelReminder).not.toHaveBeenCalled();
  });
});
