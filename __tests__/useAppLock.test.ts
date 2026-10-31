import * as React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAppLock } from '../src/hooks/useAppLock';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

let latest: ReturnType<typeof useAppLock>;
const capture = (state: ReturnType<typeof useAppLock>) => {
  latest = state;
};
function Harness({ session }: { session: boolean }) {
  capture(useAppLock(session));
  return null;
}

let appStateListener: (state: string) => void;
let renderer: ReactTestRenderer;

async function emitAppState(state: string) {
  await act(async () => {
    appStateListener(state);
  });
}

// Mirrors App.tsx: the first render has no session yet (useAuth is still
// loading), and it arrives on a later render. Leaves the cold-start lock path
// (increment 2c) out of these tests.
async function mountSignedIn() {
  await act(async () => {
    renderer = create(React.createElement(Harness, { session: false }));
  });
  await act(async () => {
    renderer.update(React.createElement(Harness, { session: true }));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
  (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
  (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: any) => {
    appStateListener = listener;
    return { remove: jest.fn() };
  }) as any);
});

afterEach(async () => {
  await act(async () => {
    renderer.unmount();
  });
});

describe('useAppLock — re-lock trigger', () => {
  it('starts unlocked in this setup', async () => {
    await mountSignedIn();
    expect(latest.locked).toBe(false);
  });

  it('locks on the transition into background', async () => {
    await mountSignedIn();
    await emitAppState('background');
    expect(latest.locked).toBe(true);
  });

  it('does not lock on inactive', async () => {
    await mountSignedIn();
    await emitAppState('inactive');
    expect(latest.locked).toBe(false);
  });

  it('does not lock on inactive → active', async () => {
    await mountSignedIn();
    await emitAppState('inactive');
    await emitAppState('active');
    expect(latest.locked).toBe(false);
  });

  it('stays locked on return from background until unlocked, and does not re-lock after', async () => {
    await mountSignedIn();
    await emitAppState('inactive');
    await emitAppState('background');
    await emitAppState('active');
    expect(latest.locked).toBe(true);

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
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('false');
    await mountSignedIn();
    await emitAppState('background');
    expect(latest.locked).toBe(false);
  });

  it('does not lock on background when signed out', async () => {
    await act(async () => {
      renderer = create(React.createElement(Harness, { session: false }));
    });
    await emitAppState('background');
    expect(latest.locked).toBe(false);
  });
});
