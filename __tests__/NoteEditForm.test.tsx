import * as React from "react";
import { Alert } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { NoteEditForm } from "../src/components/NoteEditForm";
import type { Note } from "../src/types/note";

// Scope: only the three edit-mode delete confirms (action item / person /
// topic) added to close the gap with view-mode deletes, which already
// confirm before removing. Broader NoteEditForm coverage is out of scope.

function makeDraft(overrides: Partial<Note> = {}): Note {
  return {
    id: "n1",
    timestamp: 1700000000000,
    summary: "A summary",
    transcript: "raw transcript",
    people: ["Alice"],
    topics: ["Work"],
    decisions: [],
    action_items: [{ text: "Do something", due_date: "2025-07-10" }],
    ...overrides,
  };
}

const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

function pressDestructive() {
  const [, , buttons] = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const destructive = (buttons as Array<{ style?: string; onPress?: () => void }>).find(
    (b) => b.style === "destructive"
  );
  act(() => {
    destructive?.onPress?.();
  });
}

function renderForm(overrides: Partial<React.ComponentProps<typeof NoteEditForm>> = {}) {
  const draft = overrides.draft ?? makeDraft();
  const props: React.ComponentProps<typeof NoteEditForm> = {
    onSummaryChange: jest.fn(),
    onActionItemChange: jest.fn(),
    onActionItemDelete: jest.fn(),
    onActionItemAdd: jest.fn(),
    onPersonRemove: jest.fn(),
    onPersonAdd: jest.fn(),
    onTopicRemove: jest.fn(),
    onTopicAdd: jest.fn(),
    ...overrides,
    draft,
  };
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(NoteEditForm, props));
  });
  return { renderer, props };
}

beforeEach(() => {
  alertSpy.mockClear();
});

describe("NoteEditForm — action item delete confirm", () => {
  it("shows a confirm Alert instead of deleting immediately", () => {
    const { renderer, props } = renderForm();
    act(() => {
      renderer.root.findByProps({ testID: "note-edit-action-delete-0" }).props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledWith(
      "Διαγραφή ενέργειας;",
      undefined,
      expect.any(Array)
    );
    expect(props.onActionItemDelete).not.toHaveBeenCalled();
  });

  it("calls onActionItemDelete only when the destructive button is pressed", () => {
    const { renderer, props } = renderForm();
    act(() => {
      renderer.root.findByProps({ testID: "note-edit-action-delete-0" }).props.onPress();
    });
    pressDestructive();
    expect(props.onActionItemDelete).toHaveBeenCalledWith(0);
  });
});

describe("NoteEditForm — person remove confirm", () => {
  it("shows a confirm Alert instead of removing immediately", () => {
    const { renderer, props } = renderForm();
    act(() => {
      renderer.root.findByProps({ testID: "note-edit-person-chip-0" }).props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledWith("Αφαίρεση ατόμου;", undefined, expect.any(Array));
    expect(props.onPersonRemove).not.toHaveBeenCalled();
  });

  it("calls onPersonRemove only when the destructive button is pressed", () => {
    const { renderer, props } = renderForm();
    act(() => {
      renderer.root.findByProps({ testID: "note-edit-person-chip-0" }).props.onPress();
    });
    pressDestructive();
    expect(props.onPersonRemove).toHaveBeenCalledWith(0);
  });
});

describe("NoteEditForm — topic remove confirm", () => {
  it("shows a confirm Alert instead of removing immediately", () => {
    const { renderer, props } = renderForm();
    act(() => {
      renderer.root.findByProps({ testID: "note-edit-topic-chip-0" }).props.onPress();
    });
    expect(alertSpy).toHaveBeenCalledWith("Αφαίρεση θέματος;", undefined, expect.any(Array));
    expect(props.onTopicRemove).not.toHaveBeenCalled();
  });

  it("calls onTopicRemove only when the destructive button is pressed", () => {
    const { renderer, props } = renderForm();
    act(() => {
      renderer.root.findByProps({ testID: "note-edit-topic-chip-0" }).props.onPress();
    });
    pressDestructive();
    expect(props.onTopicRemove).toHaveBeenCalledWith(0);
  });
});
