import * as React from "react";
import { Alert, Share } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useNoteActions } from "../src/hooks/useNoteActions";
import { copyToClipboard } from "../src/services/clipboard";
import { encodeShare } from "../src/services/shareCodec";
import { buildShareUrl } from "../src/config/shareLink";
import type { Note } from "../src/types/note";

jest.mock("../src/services/clipboard", () => ({
  copyToClipboard: jest.fn(),
}));

jest.mock("../src/services/shareCodec", () => ({
  encodeShare: jest.fn(),
}));

jest.mock("../src/config/shareLink", () => ({
  buildShareUrl: jest.fn(),
}));

const mockCopyToClipboard = copyToClipboard as jest.Mock;
const mockEncodeShare = encodeShare as jest.Mock;
const mockBuildShareUrl = buildShareUrl as jest.Mock;
const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    timestamp: 0,
    summary: "Συνάντηση με τον Γιώργο",
    people: ["Γιώργος"],
    topics: ["δουλειά"],
    decisions: [],
    action_items: [
      { id: "a1", text: "Στείλε email", due_date: null, status: "open" },
    ],
    transcript: "Το πλήρες κείμενο της συνάντησης.",
    ...overrides,
  };
}

function renderUseNoteActions(note: Note | null) {
  let hookResult!: ReturnType<typeof useNoteActions>;
  function TestComponent({ n }: { n: Note | null }) {
    hookResult = useNoteActions(n);
    return null;
  }
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(TestComponent, { n: note }));
  });
  return { getResult: () => hookResult, renderer };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useNoteActions handleSendToUser", () => {
  it("shows a Greek error alert and does not open the share sheet when encodeShare fails", async () => {
    mockEncodeShare.mockReturnValue({ ok: false, reason: "too_large" });
    const note = makeNote();
    const { getResult } = renderUseNoteActions(note);

    await act(async () => {
      await getResult().handleSendToUser();
    });

    expect(mockEncodeShare).toHaveBeenCalledWith(
      {
        summary: note.summary,
        people: note.people,
        topics: note.topics,
        action_items: note.action_items,
      },
      note.transcript,
    );
    expect(alertSpy).toHaveBeenCalledWith("Σφάλμα", expect.any(String));
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it("assembles the link via buildShareUrl and shares it when encodeShare succeeds", async () => {
    mockEncodeShare.mockReturnValue({
      ok: true,
      fragment: "abc123",
      meta: { truncated: false },
    });
    mockBuildShareUrl.mockReturnValue("https://iosifsagient.github.io/heyLisa/s#abc123");
    const note = makeNote();
    const { getResult } = renderUseNoteActions(note);

    await act(async () => {
      await getResult().handleSendToUser();
    });

    expect(mockBuildShareUrl).toHaveBeenCalledWith("abc123");
    expect(shareSpy).toHaveBeenCalledWith({
      message: expect.stringContaining("https://iosifsagient.github.io/heyLisa/s#abc123"),
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("stays silent about a truncated transcript — no alert, share still proceeds", async () => {
    mockEncodeShare.mockReturnValue({
      ok: true,
      fragment: "abc123",
      meta: { truncated: true },
    });
    mockBuildShareUrl.mockReturnValue("https://iosifsagient.github.io/heyLisa/s#abc123");
    const note = makeNote();
    const { getResult } = renderUseNoteActions(note);

    await act(async () => {
      await getResult().handleSendToUser();
    });

    expect(shareSpy).toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("does nothing when note is null", async () => {
    const { getResult } = renderUseNoteActions(null);

    await act(async () => {
      await getResult().handleSendToUser();
    });

    expect(mockEncodeShare).not.toHaveBeenCalled();
    expect(shareSpy).not.toHaveBeenCalled();
  });
});

describe("useNoteActions handleCopy (regression, pre-existing behavior)", () => {
  it("still copies the formatted note text", async () => {
    mockCopyToClipboard.mockResolvedValueOnce(undefined);
    const note = makeNote();
    const { getResult } = renderUseNoteActions(note);

    await act(async () => {
      await getResult().handleCopy();
    });

    expect(mockCopyToClipboard).toHaveBeenCalled();
    expect(getResult().snackbarVisible).toBe(true);
  });
});
