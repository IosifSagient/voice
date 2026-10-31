import * as React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useRecorder, type RecorderState } from '../src/hooks/useRecorder';
import { ensurePermission, getPermissionStatus } from '../src/services/microphone';

jest.mock('expo-audio', () => ({
  useAudioRecorder: jest.fn(() => ({ uri: null })),
  useAudioRecorderState: jest.fn(() => ({ isRecording: false })),
  RecordingPresets: { HIGH_QUALITY: {} },
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/services/microphone', () => ({
  ensurePermission: jest.fn(),
  getPermissionStatus: jest.fn(),
}));

const mockEnsurePermission = ensurePermission as jest.Mock;
const mockGetPermissionStatus = getPermissionStatus as jest.Mock;

let latest: RecorderState;
const capture = (state: RecorderState) => {
  latest = state;
};
function Harness() {
  capture(useRecorder());
  return null;
}

const remove = jest.fn();
let appStateListener: (state: string) => void;
let renderer: ReactTestRenderer;

// refreshPermission's only observable effect on the service layer is one
// getPermissionStatus() call, so that call count stands in for it.
async function emitAppState(state: string) {
  await act(async () => {
    appStateListener(state);
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockEnsurePermission.mockResolvedValue(false);
  mockGetPermissionStatus.mockResolvedValue({ granted: false, canAskAgain: false });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: any) => {
    appStateListener = listener;
    return { remove };
  }) as any);

  await act(async () => {
    renderer = create(React.createElement(Harness));
  });
  mockGetPermissionStatus.mockClear(); // drop the on-mount refresh
});

afterEach(async () => {
  await act(async () => {
    renderer.unmount();
  });
});

describe('useRecorder — AppState permission refresh', () => {
  it('refreshes permission on a change to active', async () => {
    await emitAppState('active');
    expect(mockGetPermissionStatus).toHaveBeenCalledTimes(1);
  });

  it.each(['inactive', 'background'])('does not refresh on a change to %s', async (state) => {
    await emitAppState(state);
    expect(mockGetPermissionStatus).not.toHaveBeenCalled();
  });

  it('picks up a mic enabled in Settings without a remount', async () => {
    expect(latest.permissionGranted).toBe(false);
    mockGetPermissionStatus.mockResolvedValue({ granted: true, canAskAgain: false });

    await emitAppState('active');

    expect(latest.permissionGranted).toBe(true);
  });

  it('logs instead of rejecting when the refresh fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('status failed');
    mockGetPermissionStatus.mockRejectedValue(failure);

    await emitAppState('active');

    expect(consoleError).toHaveBeenCalledWith(
      '[useRecorder:refreshPermission] failed to refresh permission',
      failure,
    );
    consoleError.mockRestore();
  });

  it('removes the listener on unmount', async () => {
    expect(remove).not.toHaveBeenCalled();
    await act(async () => {
      renderer.unmount();
    });
    expect(remove).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer = create(React.createElement(Harness));
    });
  });
});
