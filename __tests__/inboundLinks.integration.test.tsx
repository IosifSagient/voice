// Real inboundLinks.ts, navigationRef, linking config, NavigationContainer and
// native-stack; only Linking is mocked. A jest.fn() subscriber can't show this:
// react-navigation's own listener silently ignores URLs until its container
// has mounted, so delivery timing only means anything against the real thing.
//
// Everything is required fresh inside setup() because inboundLinks reads the
// launch URL on load (one JS process per test), and react / react-navigation
// must come from the same module registry as the code under test. UIKit is out
// of reach here — this locks the delivery path, not the rendered back button.
import type { ReactTestRenderer } from "react-test-renderer";

const RECORD = "asklisa-dev://record";

const READY_MAIN = "ready Main";
const PUSHED_RECORD = "change Main,Record";

type Mounted = { renderer: ReactTestRenderer };

function setup(initialUrl: string | null = null) {
  jest.resetModules();

  const { Linking, Text } = require("react-native");
  let emitUrl!: (event: { url: string }) => void;
  jest.spyOn(Linking, "addEventListener").mockImplementation(((_: string, listener: any) => {
    emitUrl = listener;
    return { remove: jest.fn() };
  }) as any);
  jest.spyOn(Linking, "getInitialURL").mockResolvedValue(initialUrl);

  const React = require("react");
  const { act, create } = require("react-test-renderer");
  const { NavigationContainer } = require("@react-navigation/native");
  const { createNativeStackNavigator } = require("@react-navigation/native-stack");
  const inbound = require("../src/services/inboundLinks");
  const { navigationRef } = require("../src/lib/navigationRef");
  const { LINKING_CONFIG, LINKING_PREFIXES, getLinkingActionFromState } =
    require("../src/lib/linking");

  const Stack = createNativeStackNavigator();
  const Blank = () => React.createElement(Text, null, "screen");
  const screens = ["Main", "Record", "NoteDetail", "ShareReceive"];

  const events: string[] = [];
  const paths: string[] = [];
  const routeNames = () =>
    navigationRef.getRootState().routes.map((r: { name: string }) => r.name).join(",");

  const { getStateFromPath } = require("@react-navigation/core");

  function element(getInitialURL = inbound.getInitialLinkUrl) {
    return React.createElement(
      NavigationContainer,
      {
        ref: navigationRef,
        linking: {
          prefixes: LINKING_PREFIXES,
          config: LINKING_CONFIG,
          getActionFromState: getLinkingActionFromState,
          getStateFromPath: (path: string, options: unknown) => {
            paths.push(path);
            return getStateFromPath(path, options);
          },
          getInitialURL,
          subscribe: inbound.subscribeToLinks,
        },
        // Same order as App.tsx's onReady; logged first to capture the state
        // the drain starts from.
        onReady: () => {
          events.push(`ready ${routeNames()}`);
          inbound.drainPendingLink();
        },
        onStateChange: () => events.push(`change ${routeNames()}`),
      },
      React.createElement(
        Stack.Navigator,
        null,
        ...screens.map((name) =>
          React.createElement(Stack.Screen, { key: name, name, component: Blank }),
        ),
      ),
    );
  }

  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

  async function mount(getInitialURL?: () => Promise<string | null>): Promise<Mounted> {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(element(getInitialURL));
    });
    await settle();
    return { renderer };
  }

  const unmount = ({ renderer }: Mounted) =>
    act(async () => {
      renderer.unmount();
    });
  const emit = (url: string) =>
    act(async () => {
      emitUrl({ url });
    });

  return { events, paths, navigationRef, inbound, mount, unmount, emit, settle, act };
}

// Lets the module-scope launch-URL read settle before anything mounts, as it
// has on a device by the time fonts and auth let the container render.
const launchReadSettled = () => new Promise((resolve) => setTimeout(resolve, 0));

let mounted: { app: ReturnType<typeof setup>; handle: Mounted } | null = null;

async function mountTracked(app: ReturnType<typeof setup>, getInitialURL?: () => Promise<string | null>) {
  const handle = await app.mount(getInitialURL);
  mounted = { app, handle };
  return handle;
}

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
  if (mounted) await mounted.app.unmount(mounted.handle);
  mounted = null;
  jest.restoreAllMocks();
});

describe("inbound links through a real NavigationContainer", () => {
  it("cold launch URL: mounts on Main, then pushes Record", async () => {
    const app = setup(RECORD);
    await launchReadSettled();

    await mountTracked(app);

    expect(app.events).toEqual([READY_MAIN, PUSHED_RECORD]);
  });

  it("url event before mount: same sequence", async () => {
    const app = setup();
    await launchReadSettled();
    await app.emit(RECORD);

    await mountTracked(app);

    expect(app.events).toEqual([READY_MAIN, PUSHED_RECORD]);
  });

  it("url event during the container's fallback render: not lost, same sequence", async () => {
    const app = setup();
    await launchReadSettled();
    let openGate!: () => void;
    const gate = new Promise<void>((resolve) => (openGate = resolve));

    // Holds the container in its fallback render, where react-navigation has
    // subscribed but its listener would still ignore a URL.
    const mountPromise = mountTracked(app, async () => {
      const url = await app.inbound.getInitialLinkUrl();
      await gate;
      return url;
    });
    await launchReadSettled();
    expect(app.navigationRef.isReady()).toBe(false);
    await app.emit(RECORD);
    expect(app.events).toEqual([]);

    openGate();
    await mountPromise;
    await app.settle();

    expect(app.events).toEqual([READY_MAIN, PUSHED_RECORD]);
  });

  it("held across unmount, then remount: same sequence; a second remount stays on Main", async () => {
    const app = setup();
    await launchReadSettled();
    const first = await app.mount();
    expect(app.events).toEqual([READY_MAIN]);
    await app.unmount(first);
    app.events.length = 0;
    expect(app.navigationRef.isReady()).toBe(false);

    await app.emit(RECORD);
    const second = await app.mount();
    expect(app.events).toEqual([READY_MAIN, PUSHED_RECORD]);
    await app.unmount(second);
    app.events.length = 0;

    await mountTracked(app);
    expect(app.events).toEqual([READY_MAIN]);
  });

  it("does not replay a launch URL on remount", async () => {
    const app = setup(RECORD);
    await launchReadSettled();
    const first = await app.mount();
    expect(app.events).toEqual([READY_MAIN, PUSHED_RECORD]);
    await app.unmount(first);
    app.events.length = 0;

    await mountTracked(app);

    expect(app.events).toEqual([READY_MAIN]);
  });

  it("warm link with a mounted, ready container: one push", async () => {
    const app = setup();
    await launchReadSettled();
    await mountTracked(app);
    expect(app.events).toEqual([READY_MAIN]);

    await app.emit(RECORD);

    expect(app.events).toEqual([READY_MAIN, PUSHED_RECORD]);
  });

  it("share URL cold: routed once after ready, never handed to react-navigation", async () => {
    const { encodeShare } = require("../src/services/shareCodec");
    const encoded = encodeShare(
      { summary: "s", people: [], topics: [], action_items: [] },
      "t",
    );
    const shareUrl = `https://iosifsagient.github.io/heyLisa/s#${encoded.fragment}`;
    const app = setup(shareUrl);
    await launchReadSettled();

    await mountTracked(app);
    // A platform redelivery of the launch URL must not route it a second time.
    await app.emit(shareUrl);

    expect(app.events).toEqual([READY_MAIN, "change Main,ShareReceive"]);
    expect(app.paths).toEqual([]);
  });
});
