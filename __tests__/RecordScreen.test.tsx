import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RecordScreen } from '../src/screens/RecordScreen';
import { useRecorder } from '../src/hooks/useRecorder';
import { transcribe } from '../src/services/transcription';
import { extractNote } from '../src/services/extraction';
import { notesRepository } from '../src/services/notesRepository';
import { getPermissionStatus, ensurePermission, scheduleReminder, cancelReminder } from '../src/services/notifications';
import type { Note } from '../src/types/note';

jest.mock('../src/hooks/useRecorder', () => ({
  useRecorder: jest.fn(),
}));

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

jest.mock('../src/services/calendar', () => ({
  ensurePermission: jest.fn(),
  addReminder: jest.fn(),
  removeReminder: jest.fn(),
}));

jest.mock('@react-navigation/elements', () => {
  const actual = jest.requireActual('@react-navigation/elements');
  return {
    ...actual,
    useHeaderHeight: () => 0,
  };
});

const mockUseRecorder = useRecorder as jest.Mock;
const mockTranscribe = transcribe as jest.Mock;
const mockExtractNote = extractNote as jest.Mock;
const mockCreate = notesRepository.create as jest.Mock;
const mockGet = notesRepository.get as jest.Mock;
const mockGetPermissionStatus = getPermissionStatus as jest.Mock;

const mockStart = jest.fn();
const mockStop = jest.fn();

function setRecorderState(overrides: Partial<ReturnType<typeof useRecorder>> = {}) {
  mockUseRecorder.mockReturnValue({
    isRecording: false,
    elapsed: 0,
    uri: null,
    start: mockStart,
    stop: mockStop,
    ...overrides,
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
    ...overrides,
  };
}

const navigation = { navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() } as any;
const route = { params: undefined } as any;

let activeRenderers: ReactTestRenderer[] = [];

async function renderScreen() {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(RecordScreen, { navigation, route }));
  });
  activeRenderers.push(renderer);
  return renderer;
}

async function flushMicrotasks(times = 4) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function stopButton(renderer: ReactTestRenderer) {
  return renderer.root.findByProps({ accessibilityLabel: 'Διακοπή ηχογράφησης' });
}

afterEach(async () => {
  await act(async () => {
    activeRenderers.forEach((r) => r.unmount());
  });
  activeRenderers = [];
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPermissionStatus.mockResolvedValue({ granted: true });
  setRecorderState();
});

describe('RecordScreen — tap-through to the finished note', () => {
  it('tapping the finished card navigates to NoteDetail with the note id', async () => {
    setRecorderState({ isRecording: true, uri: 'file://rec.m4a' });
    mockStop.mockResolvedValue(undefined);
    mockTranscribe.mockResolvedValue('a transcript');
    mockExtractNote.mockResolvedValue({ summary: 'S', people: [], topics: [], action_items: [] });
    mockCreate.mockResolvedValue('n42');
    mockGet.mockResolvedValue(mkNote({ id: 'n42', summary: 'S' }));

    const renderer = await renderScreen();

    await act(async () => {
      stopButton(renderer).props.onPress();
    });
    await flushMicrotasks();

    const card = renderer.root.findByProps({ testID: 'record-note-card' });
    await act(async () => {
      card.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('NoteDetail', { id: 'n42' });
  });

  it('does not navigate and shows no card before phase is done', async () => {
    setRecorderState({ isRecording: true, uri: 'file://rec.m4a' });
    mockStop.mockResolvedValue(undefined);
    let resolveTranscribe!: (v: string) => void;
    mockTranscribe.mockImplementation(
      () => new Promise<string>((resolve) => { resolveTranscribe = resolve; })
    );

    const renderer = await renderScreen();

    await act(async () => {
      stopButton(renderer).props.onPress();
    });
    await flushMicrotasks();

    expect(renderer.root.findAllByProps({ testID: 'record-note-card' })).toHaveLength(0);
    expect(navigation.navigate).not.toHaveBeenCalled();

    // Let the pending transcription resolve so the pipeline (and any
    // outstanding act()) settles cleanly before unmount.
    mockExtractNote.mockResolvedValue({ summary: 'S', people: [], topics: [], action_items: [] });
    mockCreate.mockResolvedValue('n42');
    mockGet.mockResolvedValue(mkNote({ id: 'n42' }));
    await act(async () => {
      resolveTranscribe('t');
    });
    await flushMicrotasks();
  });
});

describe('RecordScreen — inputs disabled while the pipeline is running', () => {
  it('disables the record button while transcribing, and does not start a new run on tap', async () => {
    setRecorderState({ isRecording: true, uri: 'file://rec.m4a' });
    mockStop.mockResolvedValue(undefined);
    let resolveTranscribe!: (v: string) => void;
    mockTranscribe.mockImplementation(
      () => new Promise<string>((resolve) => { resolveTranscribe = resolve; })
    );

    const renderer = await renderScreen();

    await act(async () => {
      stopButton(renderer).props.onPress();
    });
    await flushMicrotasks();

    // Recorder state moved back to idle (recording already stopped) —
    // matches the real useRecorder transition once stop() resolves.
    setRecorderState({ isRecording: false, uri: 'file://rec.m4a' });
    await act(async () => {
      renderer.update(React.createElement(RecordScreen, { navigation, route }));
    });

    const button = renderer.root.findByProps({ accessibilityLabel: 'Έναρξη ηχογράφησης' });
    expect(button.props.disabled).toBe(true);

    const startCallsBefore = mockStart.mock.calls.length;
    await act(async () => {
      button.props.onPress();
    });
    expect(mockStart).toHaveBeenCalledTimes(startCallsBefore);

    // Text-entry toggle is not offered while a run is in flight either.
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: 'Γράψε σημείωση με πληκτρολόγιο' })
    ).toHaveLength(0);

    mockExtractNote.mockResolvedValue({ summary: 'S', people: [], topics: [], action_items: [] });
    mockCreate.mockResolvedValue('n42');
    mockGet.mockResolvedValue(mkNote({ id: 'n42' }));
    await act(async () => {
      resolveTranscribe('t');
    });
    await flushMicrotasks();
  });

  it('re-enables the record button once the pipeline finishes (done)', async () => {
    setRecorderState({ isRecording: true, uri: 'file://rec.m4a' });
    mockStop.mockResolvedValue(undefined);
    mockTranscribe.mockResolvedValue('a transcript');
    mockExtractNote.mockResolvedValue({ summary: 'S', people: [], topics: [], action_items: [] });
    mockCreate.mockResolvedValue('n42');
    mockGet.mockResolvedValue(mkNote({ id: 'n42' }));

    const renderer = await renderScreen();
    await act(async () => {
      stopButton(renderer).props.onPress();
    });
    await flushMicrotasks();

    setRecorderState({ isRecording: false, uri: 'file://rec.m4a' });
    await act(async () => {
      renderer.update(React.createElement(RecordScreen, { navigation, route }));
    });

    const button = renderer.root.findByProps({ accessibilityLabel: 'Έναρξη ηχογράφησης' });
    expect(button.props.disabled).toBe(false);
  });

  it('re-enables the record button on a pipeline error', async () => {
    setRecorderState({ isRecording: true, uri: 'file://rec.m4a' });
    mockStop.mockResolvedValue(undefined);
    mockTranscribe.mockResolvedValue('a transcript');
    mockExtractNote.mockRejectedValue(new Error('boom'));

    const renderer = await renderScreen();
    await act(async () => {
      stopButton(renderer).props.onPress();
    });
    await flushMicrotasks();

    setRecorderState({ isRecording: false, uri: 'file://rec.m4a' });
    await act(async () => {
      renderer.update(React.createElement(RecordScreen, { navigation, route }));
    });

    const button = renderer.root.findByProps({ accessibilityLabel: 'Έναρξη ηχογράφησης' });
    expect(button.props.disabled).toBe(false);
  });
});
