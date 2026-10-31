import { getActionFromState, type PathConfigMap } from "@react-navigation/core";
import type { RootStackParamList } from "../types/navigation";

// https prefix matches the AASA-verified Universal Link domain
// (iosifsagient.github.io, paths /heyLisa/s and /heyLisa/s/*) — kept so
// this prefix is recognized as belonging to the app. The share path ("s")
// is deliberately NOT mapped in `screens` below: react-navigation's path
// parser can't see the URL fragment (the actual share payload), so if it
// path-matched and auto-navigated here, it would do so with empty/undefined
// params, racing services/shareLink.ts's own fragment-aware listener for
// the same URL. Leaving the path unmapped means react-navigation ignores
// it entirely and shareLink.ts is the sole handler of inbound share links.
//
// Both custom schemes are listed statically: iOS only delivers a scheme to
// the build that registered it (app.config.js), so the other variant's prefix
// can never match anything.
export const LINKING_PREFIXES = [
  "asklisa://",
  "asklisa-dev://",
  "https://iosifsagient.github.io/heyLisa",
];

export const LINKING_CONFIG: {
  initialRouteName: keyof RootStackParamList;
  screens: PathConfigMap<RootStackParamList>;
} = {
  // Puts Main under a deep-linked screen on cold start, so there's a route
  // back to the tabs.
  initialRouteName: "Main",
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

// A warm `record` link must reach the existing Record (and its recorder) if
// one is in the stack, popping whatever is above it, rather than push a second.
export function getLinkingActionFromState(
  state: Parameters<typeof getActionFromState>[0],
  options?: Parameters<typeof getActionFromState>[1],
): ReturnType<typeof getActionFromState> {
  const action = getActionFromState(state, options);
  // Record only: NoteDetail has no getId, so pop would reuse a stale NoteDetail.
  if (action?.type === "NAVIGATE" && action.payload.name === "Record") {
    return { ...action, payload: { ...action.payload, pop: true } };
  }
  return action;
}
