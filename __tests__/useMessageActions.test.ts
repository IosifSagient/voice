import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useMessageActions } from '../src/hooks/useMessageActions';
import { copyToClipboard } from '../src/services/clipboard';
import * as Haptics from 'expo-haptics';

jest.mock('../src/services/clipboard', () => ({
  copyToClipboard: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const mockCopyToClipboard = copyToClipboard as jest.Mock;
const mockImpactAsync = Haptics.impactAsync as jest.Mock;

function renderUseMessageActions() {
  let hookResult!: ReturnType<typeof useMessageActions>;
  function TestComponent() {
    hookResult = useMessageActions();
    return null;
  }
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(TestComponent));
  });
  return { getResult: () => hookResult };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('useMessageActions', () => {
  it('calls the clipboard service with the given text and shows the snackbar on success', async () => {
    mockCopyToClipboard.mockResolvedValueOnce(undefined);
    const { getResult } = renderUseMessageActions();

    await act(async () => {
      getResult().onLongPress('copy me');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockCopyToClipboard).toHaveBeenCalledWith('copy me');
    expect(getResult().snackbarVisible).toBe(true);
  });

  it('does not show the snackbar when the clipboard write rejects', async () => {
    mockCopyToClipboard.mockRejectedValueOnce(new Error('clipboard unavailable'));
    const { getResult } = renderUseMessageActions();

    await act(async () => {
      getResult().onLongPress('copy me');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getResult().snackbarVisible).toBe(false);
  });

  it('fires the haptic on invocation even when the clipboard call rejects', async () => {
    mockCopyToClipboard.mockRejectedValueOnce(new Error('clipboard unavailable'));
    const { getResult } = renderUseMessageActions();

    await act(async () => {
      getResult().onLongPress('copy me');
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockImpactAsync).toHaveBeenCalledWith('light');
  });

  it('dismissSnackbar hides the snackbar', async () => {
    mockCopyToClipboard.mockResolvedValueOnce(undefined);
    const { getResult } = renderUseMessageActions();

    await act(async () => {
      getResult().onLongPress('copy me');
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getResult().snackbarVisible).toBe(true);

    act(() => {
      getResult().dismissSnackbar();
    });

    expect(getResult().snackbarVisible).toBe(false);
  });
});
