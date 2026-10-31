import * as React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAppLock, shouldLockOnColdStart } from '../src/hooks/useAppLock';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const mockAuthenticate = LocalAuthentication.authenticateAsync as jest.Mock;
const mockHasHardware = LocalAuthentication.hasHardwareAsync as jest.Mock;
const mockIsEnrolled = LocalAuthentication.isEnrolledAsync as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;

type HookResult = ReturnType<typeof useAppLock>;

let latest: HookResult;
let renders: { locked: boolean; lockDecided: boolean }[];
const capture = (state: HookResult) => {
  latest = state;
  renders.push({ locked: state.locked, lockDecided: state.lockDecided });
};
function Harness({ session, authLoading }: { session: boolean; authLoading: boolean }) {
  capture(useAppLock(session, authLoading));
  return null;
}

let appStateListener: (state: string) => void;
let renderer: ReactTestRenderer | null;

function setCurrentAppState(state: string) {
  (AppState as unknown as { currentState: string }).currentState = state;
}

async function emitAppState(state: string) {
  setCurrentAppState(state);
  await act(async () => {
    appStateListener(state);
  });
}

async function render(session: boolean, authLoading: boolean) {
  await act(async () => {
    renderer = create(React.createElement(Harness, { session, authLoading }));
  });
}

async function update(session: boolean, authLoading: boolean) {
  await act(async () => {
    renderer!.update(React.createElement(Harness, { session, authLoading }));
  });
}

// The cold launch App.tsx sees: no session yet while auth is still loading,
// restored on a later render.
async function coldLaunchSignedIn() {
  await render(false, true);
  await update(true, false);
}

// A decision made signed-out, followed by a password sign-in. The hook then
// has a session but no cold lock, for testing the warm lock on its own.
async function signedInAfterDecision() {
  await render(false, false);
  await update(true, false);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  renders = [];
  renderer = null;
  mockHasHardware.mockResolvedValue(true);
  mockIsEnrolled.mockResolvedValue(true);
  mockGetItem.mockResolvedValue('true');
  mockAuthenticate.mockResolvedValue({ success: true });
  setCurrentAppState('active');
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: any) => {
    appStateListener = listener;
    return { remove: jest.fn() };
  }) as any);
});

afterEach(async () => {
  jest.useRealTimers();
  if (renderer) {
    await act(async () => {
      renderer!.unmount();
    });
  }
});

describe('shouldLockOnColdStart', () => {
  it('never locks without a session', () => {
    expect(shouldLockOnColdStart(false, { available: true, enabled: true })).toBe(false);
    expect(shouldLockOnColdStart(false, 'failed')).toBe(false);
  });

  it('locks a session when available and enabled, or when the read failed', () => {
    expect(shouldLockOnColdStart(true, { available: true, enabled: true })).toBe(true);
    expect(shouldLockOnColdStart(true, { available: true, enabled: false })).toBe(false);
    expect(shouldLockOnColdStart(true, { available: false, enabled: true })).toBe(false);
    expect(shouldLockOnColdStart(true, 'failed')).toBe(true);
  });
});

describe('useAppLock — cold-launch decision', () => {
  beforeEach(() => {
    // These tests are about the decision, not unlocking through it.
    mockAuthenticate.mockResolvedValue({ success: false });
  });

  it('locks a session restored after first render, set together with lockDecided', async () => {
    await coldLaunchSignedIn();

    expect(latest.locked).toBe(true);
    expect(latest.lockDecided).toBe(true);
    expect(renders.some((r) => r.lockDecided && !r.locked)).toBe(false);
  });

  it('is undecided while auth is loading, even after the read settles', async () => {
    await render(false, true);
    expect(latest.lockDecided).toBe(false);
    expect(latest.locked).toBe(false);
  });

  it('auth finishing BEFORE the setting read: waits, then locks', async () => {
    const read = deferred<string | null>();
    mockGetItem.mockReturnValue(read.promise);

    await render(false, true);
    await update(true, false);
    expect(latest.lockDecided).toBe(false);

    await act(async () => {
      read.resolve('true');
    });

    expect(latest.locked).toBe(true);
    expect(latest.lockDecided).toBe(true);
    expect(renders.some((r) => r.lockDecided && !r.locked)).toBe(false);
  });

  it('auth finishing AFTER the setting read: waits, then locks', async () => {
    await render(false, true);
    expect(mockGetItem).toHaveBeenCalled();
    expect(latest.lockDecided).toBe(false);

    await update(true, false);

    expect(latest.locked).toBe(true);
    expect(latest.lockDecided).toBe(true);
    expect(renders.some((r) => r.lockDecided && !r.locked)).toBe(false);
  });

  it('lock OFF: decided, never locked', async () => {
    mockGetItem.mockResolvedValue('false');
    await coldLaunchSignedIn();

    expect(latest.lockDecided).toBe(true);
    expect(renders.some((r) => r.locked)).toBe(false);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('signed out: decided, not locked, no prompt', async () => {
    await render(false, true);
    await update(false, false);

    expect(latest.lockDecided).toBe(true);
    expect(latest.locked).toBe(false);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('biometrics unavailable: not locked', async () => {
    mockHasHardware.mockResolvedValue(false);
    mockIsEnrolled.mockResolvedValue(false);
    await coldLaunchSignedIn();

    expect(latest.lockDecided).toBe(true);
    expect(latest.locked).toBe(false);
  });

  it("unenrolled with a stored 'true': not locked", async () => {
    mockIsEnrolled.mockResolvedValue(false);
    await coldLaunchSignedIn();

    expect(latest.lockDecided).toBe(true);
    expect(latest.locked).toBe(false);
  });

  it('no stored setting defaults to on when biometrics are available', async () => {
    mockGetItem.mockResolvedValue(null);
    await coldLaunchSignedIn();

    expect(latest.locked).toBe(true);
  });

  it('a fresh sign-in after the decision stays unlocked and never prompts', async () => {
    await render(false, false);
    expect(latest.lockDecided).toBe(true);

    await update(true, false);

    expect(latest.locked).toBe(false);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('a rejected setting read fails safe: decided and locked with a session', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetItem.mockRejectedValue(new Error('keychain'));

    await coldLaunchSignedIn();

    expect(latest.lockDecided).toBe(true);
    expect(latest.locked).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('a rejected setting read when signed out: decided, not locked', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetItem.mockRejectedValue(new Error('keychain'));

    await render(false, false);

    expect(latest.lockDecided).toBe(true);
    expect(latest.locked).toBe(false);
    consoleError.mockRestore();
  });

  it('a setting read hanging past 3s fails safe: decided and locked with a session', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    mockGetItem.mockReturnValue(new Promise(() => {}));

    await coldLaunchSignedIn();
    await act(async () => {
      jest.advanceTimersByTime(2999);
    });
    expect(latest.lockDecided).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(latest.lockDecided).toBe(true);
    expect(latest.locked).toBe(true);
    consoleError.mockRestore();
  });
});

describe('useAppLock — re-lock trigger', () => {
  it('starts unlocked in this setup', async () => {
    await signedInAfterDecision();
    expect(latest.locked).toBe(false);
  });

  it('locks on the transition into background', async () => {
    await signedInAfterDecision();
    await emitAppState('background');
    expect(latest.locked).toBe(true);
  });

  it('does not lock on inactive', async () => {
    await signedInAfterDecision();
    await emitAppState('inactive');
    expect(latest.locked).toBe(false);
  });

  it('does not lock on inactive → active', async () => {
    await signedInAfterDecision();
    await emitAppState('inactive');
    await emitAppState('active');
    expect(latest.locked).toBe(false);
  });

  it('stays locked on return from background until unlocked, and does not re-lock after', async () => {
    mockAuthenticate.mockResolvedValue({ success: false });
    await signedInAfterDecision();
    await emitAppState('inactive');
    await emitAppState('background');
    await emitAppState('active');
    expect(latest.locked).toBe(true);

    mockAuthenticate.mockResolvedValue({ success: true });
    await act(async () => {
      await latest.unlock();
    });
    expect(latest.locked).toBe(false);

    // The Face ID prompt itself bounces through inactive.
    await emitAppState('inactive');
    await emitAppState('active');
    expect(latest.locked).toBe(false);
  });

  it('does not lock on background when the lock setting is off', async () => {
    mockGetItem.mockResolvedValue('false');
    await signedInAfterDecision();
    await emitAppState('background');
    expect(latest.locked).toBe(false);
  });

  it('does not lock on background when signed out', async () => {
    await render(false, false);
    await emitAppState('background');
    expect(latest.locked).toBe(false);
  });
});

describe('useAppLock — auto-prompt', () => {
  beforeEach(() => {
    mockAuthenticate.mockResolvedValue({ success: false });
  });

  it('foreground cold lock: one automatic prompt', async () => {
    await coldLaunchSignedIn();
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('cold lock decided while backgrounded: no prompt until the return', async () => {
    setCurrentAppState('background');
    await coldLaunchSignedIn();
    expect(latest.locked).toBe(true);
    expect(mockAuthenticate).not.toHaveBeenCalled();

    await emitAppState('background');
    await emitAppState('active');
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('locked while backgrounded: no prompt until active', async () => {
    await signedInAfterDecision();
    await emitAppState('inactive');
    await emitAppState('background');

    expect(latest.locked).toBe(true);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('background → active: exactly one prompt', async () => {
    await signedInAfterDecision();
    await emitAppState('background');
    await emitAppState('active');
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('background → inactive → active still counts as the return: one prompt', async () => {
    await signedInAfterDecision();
    await emitAppState('background');
    await emitAppState('inactive');
    expect(mockAuthenticate).not.toHaveBeenCalled();
    await emitAppState('active');
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('inactive → active while locked: no prompt', async () => {
    await coldLaunchSignedIn();
    mockAuthenticate.mockClear();

    await emitAppState('inactive');
    await emitAppState('active');

    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('cancel or failure: no automatic loop through the Face ID sheet bounces', async () => {
    await signedInAfterDecision();
    await emitAppState('background');
    await emitAppState('active');
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 3; i++) {
      await emitAppState('inactive');
      await emitAppState('active');
    }

    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(latest.locked).toBe(true);
  });

  it('after a failure, the next background → active prompts again', async () => {
    await signedInAfterDecision();
    await emitAppState('background');
    await emitAppState('active');
    await emitAppState('background');
    await emitAppState('active');
    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
  });

  it('the button always retries after a failure', async () => {
    await coldLaunchSignedIn();
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);

    await act(async () => {
      await latest.unlock();
    });

    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
  });

  it('never runs two prompts concurrently', async () => {
    const pending = deferred<{ success: boolean }>();
    mockAuthenticate.mockReturnValue(pending.promise);
    await coldLaunchSignedIn();
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);

    // A button tap and a return from background, both during the open prompt.
    await act(async () => {
      latest.unlock();
    });
    await emitAppState('background');
    await emitAppState('active');
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({ success: true });
    });
    expect(latest.locked).toBe(false);
  });

  it('a failed prompt call logs and leaves the lock engaged', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthenticate.mockRejectedValue(new Error('auth'));

    await coldLaunchSignedIn();

    expect(latest.locked).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('does not prompt on return when unlocked', async () => {
    mockGetItem.mockResolvedValue('false');
    await signedInAfterDecision();
    await emitAppState('background');
    await emitAppState('active');
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});
