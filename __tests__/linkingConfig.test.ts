import { StackRouter, getStateFromPath } from "@react-navigation/core";
import type { NavigationAction, StackNavigationState } from "@react-navigation/core";
import {
  LINKING_CONFIG,
  LINKING_PREFIXES,
  getLinkingActionFromState,
} from "../src/lib/linking";

// getStateFromPath is the actual pure function react-navigation uses
// internally to resolve an incoming path to a navigation state; it needs no
// native Linking/device involvement, so these are genuine (not simulated)
// tests of the real config. With the share path deliberately left out of it,
// react-navigation must not resolve/auto-navigate for it, removing the race
// with services/shareLink.ts documented in that file. OS-level link delivery
// and prefix matching are still not testable off-device (extractPathFromURL
// isn't exported) — this only covers the JS path-matching step.
const resolve = (path: string) => getStateFromPath(path, LINKING_CONFIG);

function linkAction(path: string) {
  const state = resolve(path);
  if (!state) throw new Error(`no state for ${path}`);
  return getLinkingActionFromState(state, LINKING_CONFIG);
}

describe("LINKING_PREFIXES", () => {
  it("includes both custom schemes and the https domain", () => {
    expect(LINKING_PREFIXES).toEqual(
      expect.arrayContaining([
        "asklisa://",
        "asklisa-dev://",
        "https://iosifsagient.github.io/heyLisa",
      ]),
    );
  });
});

describe("LINKING_CONFIG", () => {
  it("resolves record to [Main, Record] with Record focused", () => {
    expect(resolve("record")).toEqual({
      index: 1,
      routes: [{ name: "Main" }, { name: "Record", path: "record" }],
    });
  });

  it("puts Main under NoteDetail and Settings", () => {
    expect(resolve("note/abc")).toEqual({
      index: 1,
      routes: [
        { name: "Main" },
        { name: "NoteDetail", params: { id: "abc" }, path: "note/abc" },
      ],
    });
    expect(resolve("settings")).toEqual({
      index: 1,
      routes: [{ name: "Main" }, { name: "Settings", path: "settings" }],
    });
  });

  it.each([
    ["notes", "NotesList"],
    ["tasks", "Tasks"],
    ["chat", "Chat"],
  ])("leaves the %s tab path resolving to Main > %s", (path, screen) => {
    expect(resolve(path)).toEqual({
      routes: [{ name: "Main", state: { routes: [{ name: screen, path }] } }],
    });
  });

  it.each(["s", "s#x"])("leaves the share path %s unmapped", (path) => {
    expect(resolve(path)).toBeUndefined();
  });
});

describe("getLinkingActionFromState", () => {
  const payloadOf = (path: string) =>
    (linkAction(path) as unknown as { payload: { name: string; pop?: boolean } }).payload;

  it("sets pop on the record link", () => {
    expect(payloadOf("record")).toMatchObject({ name: "Record", pop: true });
  });

  it.each([
    ["note/x", "NoteDetail"],
    ["settings", "Settings"],
  ])("does not set pop on %s", (path, name) => {
    const payload = payloadOf(path);
    expect(payload.name).toBe(name);
    expect(payload.pop).toBeUndefined();
  });
});

describe("the record link through the installed StackRouter", () => {
  const routeNames = ["Main", "Record", "NoteDetail", "ShareReceive", "Settings"];
  const router = StackRouter({});

  function stackOf(...names: string[]): StackNavigationState<Record<string, object | undefined>> {
    return {
      type: "stack",
      stale: false,
      key: "stack",
      index: names.length - 1,
      routeNames,
      preloadedRoutes: [],
      routes: names.map((name) => ({ key: `${name}-key`, name })),
    };
  }

  function apply(state: ReturnType<typeof stackOf>, action: NavigationAction) {
    const next = router.getStateForAction(state, action as never, {
      routeNames,
      routeParamList: {},
      routeGetIdList: {},
    });
    if (!next) throw new Error("router did not handle the action");
    return next.routes.map((r) => ({ key: r.key, name: r.name }));
  }

  const recordLink = () => linkAction("record") as NavigationAction;

  it("pops back to the SAME Record when it is below NoteDetail", () => {
    expect(apply(stackOf("Main", "Record", "NoteDetail"), recordLink())).toEqual([
      { key: "Main-key", name: "Main" },
      { key: "Record-key", name: "Record" },
    ]);
  });

  it("keeps the SAME Record when it is already focused (a recording stays mounted)", () => {
    expect(apply(stackOf("Main", "Record"), recordLink())).toEqual([
      { key: "Main-key", name: "Main" },
      { key: "Record-key", name: "Record" },
    ]);
  });

  it("pushes Record when none is in the stack", () => {
    const routes = apply(stackOf("Main"), recordLink());
    expect(routes.map((r) => r.name)).toEqual(["Main", "Record"]);
    expect(routes[0].key).toBe("Main-key");
  });

  it("would push a second Record without the override (control)", () => {
    const { payload } = recordLink() as { payload: { name: string; path?: string } };
    const withoutPop = {
      type: "NAVIGATE",
      payload: { name: payload.name, path: payload.path },
    } as NavigationAction;
    expect(apply(stackOf("Main", "Record", "NoteDetail"), withoutPop).map((r) => r.name)).toEqual([
      "Main",
      "Record",
      "NoteDetail",
      "Record",
    ]);
  });
});
