import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useAcceptSharedNote } from '../src/hooks/useAcceptSharedNote';
import { notesRepository } from '../src/services/notesRepository';
import { takePendingShare } from '../src/services/pendingShare';

jest.mock('../src/services/notesRepository', () => ({
  notesRepository: {
    create: jest.fn(),
  },
}));

jest.mock('../src/services/pendingShare', () => ({
  takePendingShare: jest.fn(),
}));

const mockCreate = notesRepository.create as jest.Mock;
const mockTakePendingShare = takePendingShare as jest.Mock;

const pendingPayload = {
  extraction: { summary: 's', people: ['P'], topics: ['T'], action_items: [] },
  transcript: 'raw transcript',
};

async function renderUseAcceptSharedNote() {
  let hookResult!: ReturnType<typeof useAcceptSharedNote>;
  function TestComponent() {
    hookResult = useAcceptSharedNote();
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

describe('useAcceptSharedNote — accept', () => {
  it('saves the pending payload via notesRepository.create and returns the new id', async () => {
    mockTakePendingShare.mockReturnValue(pendingPayload);
    mockCreate.mockResolvedValue('new-note-id');
    const { getResult } = await renderUseAcceptSharedNote();

    let noteId: string | null = null;
    await act(async () => {
      noteId = await getResult().accept();
    });

    expect(mockCreate).toHaveBeenCalledWith(pendingPayload.extraction, pendingPayload.transcript);
    expect(noteId).toBe('new-note-id');
    expect(getResult().error).toBeNull();
  });

  it('surfaces an error and does not call create when nothing is pending', async () => {
    mockTakePendingShare.mockReturnValue(null);
    const { getResult } = await renderUseAcceptSharedNote();

    let noteId: string | null = 'unset';
    await act(async () => {
      noteId = await getResult().accept();
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(noteId).toBeNull();
    expect(getResult().error).toEqual(expect.any(String));
  });

  it('sets an error and does not throw when create() rejects', async () => {
    mockTakePendingShare.mockReturnValue(pendingPayload);
    mockCreate.mockRejectedValue(new Error('sqlite error'));
    const { getResult } = await renderUseAcceptSharedNote();

    let noteId: string | null = 'unset';
    await act(async () => {
      noteId = await getResult().accept();
    });

    expect(noteId).toBeNull();
    expect(getResult().error).toEqual(expect.any(String));
  });
});

describe('useAcceptSharedNote — reject', () => {
  it('drains the pending store and never calls create', async () => {
    const { getResult } = await renderUseAcceptSharedNote();

    act(() => {
      getResult().reject();
    });

    expect(mockTakePendingShare).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
