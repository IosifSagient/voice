import * as React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useWidgetSync } from '../src/hooks/useWidgetSync';
import { clearWidget, scheduleWidgetSync } from '../src/services/widgetSync';

jest.mock('../src/services/widgetSync', () => ({
  scheduleWidgetSync: jest.fn(),
  clearWidget: jest.fn(),
}));

const mockSchedule = scheduleWidgetSync as jest.Mock;
const mockClear = clearWidget as jest.Mock;

function Harness({ session }: { session: boolean }) {
  useWidgetSync(session);
  return null;
}

let listeners: Set<(state: string) => void>;
let renderer: ReactTestRenderer | null;

function emitAppState(state: string) {
  act(() => {
    listeners.forEach((listener) => listener(state));
  });
}

function render(session: boolean) {
  act(() => {
    renderer = create(React.createElement(Harness, { session }));
  });
}

function update(session: boolean) {
  act(() => {
    renderer!.update(React.createElement(Harness, { session }));
  });
}

describe('useWidgetSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listeners = new Set();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: any) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    }) as any);
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    jest.restoreAllMocks();
  });

  describe('launch', () => {
    it('syncs once when launched with a session', () => {
      render(true);
      expect(mockSchedule).toHaveBeenCalledTimes(1);
      expect(mockClear).not.toHaveBeenCalled();
    });

    it('syncs once the session restores after loading', () => {
      render(false);
      expect(mockSchedule).not.toHaveBeenCalled();

      update(true);
      expect(mockSchedule).toHaveBeenCalledTimes(1);
    });

    it('does nothing on a signed-out launch, including no clear', () => {
      render(false);
      expect(mockSchedule).not.toHaveBeenCalled();
      expect(mockClear).not.toHaveBeenCalled();
    });

    it('does not sync again on a re-render with the same session', () => {
      render(true);
      update(true);
      expect(mockSchedule).toHaveBeenCalledTimes(1);
    });
  });

  describe('foreground', () => {
    it('syncs on background → active', () => {
      render(true);
      mockSchedule.mockClear();

      emitAppState('background');
      expect(mockSchedule).not.toHaveBeenCalled();

      emitAppState('active');
      expect(mockSchedule).toHaveBeenCalledTimes(1);
    });

    it('does not sync on inactive → active', () => {
      render(true);
      mockSchedule.mockClear();

      emitAppState('inactive');
      emitAppState('active');
      expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('syncs once per background, not on a later inactive → active', () => {
      render(true);
      mockSchedule.mockClear();

      emitAppState('background');
      emitAppState('active');
      emitAppState('inactive');
      emitAppState('active');
      expect(mockSchedule).toHaveBeenCalledTimes(1);
    });

    it('does not sync when signed out', () => {
      render(false);

      emitAppState('background');
      emitAppState('active');
      expect(mockSchedule).not.toHaveBeenCalled();
    });

    it('stops syncing after sign-out and removes the listener', () => {
      render(true);
      update(false);
      mockSchedule.mockClear();

      expect(listeners.size).toBe(0);
      emitAppState('background');
      emitAppState('active');
      expect(mockSchedule).not.toHaveBeenCalled();
    });
  });

  describe('sign-out', () => {
    it('clears the widget when the session ends', () => {
      render(true);
      update(false);
      expect(mockClear).toHaveBeenCalledTimes(1);
    });

    it('refills on the next sign-in', () => {
      render(true);
      update(false);
      mockSchedule.mockClear();

      update(true);
      expect(mockSchedule).toHaveBeenCalledTimes(1);
      expect(mockClear).toHaveBeenCalledTimes(1);
    });

    it('clears once per sign-out', () => {
      render(true);
      update(false);
      update(false);
      expect(mockClear).toHaveBeenCalledTimes(1);
    });
  });
});
