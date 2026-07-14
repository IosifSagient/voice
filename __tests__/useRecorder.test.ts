import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { useRecorder } from '../src/hooks/useRecorder';
import { AudioModule, setAudioModeAsync } from 'expo-audio';

const mockRecorder = {
  prepareToRecordAsync: jest.fn(),
  record: jest.fn(),
  stop: jest.fn(),
  uri: null as string | null,
};

jest.mock('expo-audio', () => ({
  useAudioRecorder: jest.fn(() => mockRecorder),
  useAudioRecorderState: jest.fn(() => ({ isRecording: false })),
  AudioModule: { requestRecordingPermissionsAsync: jest.fn() },
  RecordingPresets: { HIGH_QUALITY: {} },
  setAudioModeAsync: jest.fn(),
}));

const mockRequestPermission = AudioModule.requestRecordingPermissionsAsync as jest.Mock;
const mockSetAudioMode = setAudioModeAsync as jest.Mock;

async function renderUseRecorder() {
  let hookResult!: ReturnType<typeof useRecorder>;
  function TestComponent() {
    hookResult = useRecorder();
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
});

describe('useRecorder — permission timing', () => {
  it('does not request microphone permission on mount', async () => {
    await renderUseRecorder();

    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockSetAudioMode).not.toHaveBeenCalled();
  });

  it('requests microphone permission and starts recording when start() is invoked', async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    const { getResult } = await renderUseRecorder();

    await act(async () => {
      await getResult().start();
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(mockSetAudioMode).toHaveBeenCalledWith({ playsInSilentMode: true, allowsRecording: true });
    expect(mockRecorder.prepareToRecordAsync).toHaveBeenCalledTimes(1);
    expect(mockRecorder.record).toHaveBeenCalledTimes(1);
  });

  it('does not start recording when permission is denied', async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getResult } = await renderUseRecorder();

    await act(async () => {
      await getResult().start();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Απαιτείται άδεια',
      'Δεν επιτράπηκε η πρόσβαση στο μικρόφωνο.',
    );
    expect(mockSetAudioMode).not.toHaveBeenCalled();
    expect(mockRecorder.prepareToRecordAsync).not.toHaveBeenCalled();
    expect(mockRecorder.record).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
