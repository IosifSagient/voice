import { getStateFromPath } from "@react-navigation/native";
import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "../src/types/navigation";

// Mirrors App.tsx's linking.config.screens exactly — keep in sync by hand if
// that object ever changes. getStateFromPath is the actual pure function
// react-navigation uses internally to resolve an incoming path to a
// navigation state; it needs no native Linking/device involvement, so this
// is a genuine (not simulated) test of the Increment 2b fix: with the share
// path deliberately left out of this config, react-navigation must not
// resolve/auto-navigate for it, removing the race with services/shareLink.ts
// documented in that file. OS-level Universal Link delivery itself is still
// not testable off-device — this only covers the JS path-matching step.
const screensConfig: LinkingOptions<RootStackParamList>["config"] = {
  screens: {
    Record: "record",
    Main: {
      screens: {
        NotesList: "notes",
        Tasks: "tasks",
        Chat: "chat",
      },
    },
    NoteDetail: "note/:id",
    Settings: "settings",
  },
};

describe("App.tsx linking config — share path is left unmapped (Increment 2b)", () => {
  it("does not resolve the share path 's' to any screen", () => {
    expect(getStateFromPath("s", screensConfig)).toBeUndefined();
  });

  it("still resolves every pre-existing route", () => {
    expect(getStateFromPath("record", screensConfig)).toBeDefined();
    expect(getStateFromPath("notes", screensConfig)).toBeDefined();
    expect(getStateFromPath("tasks", screensConfig)).toBeDefined();
    expect(getStateFromPath("chat", screensConfig)).toBeDefined();
    expect(getStateFromPath("note/abc-123", screensConfig)).toBeDefined();
    expect(getStateFromPath("settings", screensConfig)).toBeDefined();
  });
});
