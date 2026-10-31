// The real App.tsx gate with the real useAuth, useAppLock, inboundLinks,
// navigationRef, linking config and navigators. Mocked at the edges only:
// Linking, auth storage, biometrics, fonts, and the screens themselves.
//
// Everything is required fresh inside setup() because inboundLinks reads the
// launch URL on load (one JS process per test).
import type { ReactTestRenderer } from "react-test-renderer";

const RECORD = "asklisa-dev://record";
const SESSION = { user: { id: "u1" } };

const mockGetSession = jest.fn();
const mockAuthenticate = jest.fn();
const mockHasHardware = jest.fn();
const mockIsEnrolled = jest.fn();
const mockGetItem = jest.fn();
const mockDrainLog: string[] = [];

jest.mock("../src/services/authService", () => ({
  getSession: mockGetSession,
  onAuthStateChange: () => () => {},
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: mockHasHardware,
  isEnrolledAsync: mockIsEnrolled,
  authenticateAsync: mockAuthenticate,
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: mockGetItem,
  setItemAsync: jest.fn(),
}));

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock("@expo-google-fonts/literata", () => ({ useFonts: () => [true] }));
jest.mock("@expo-google-fonts/inter", () => ({}));
jest.mock("../src/db", () => ({ initDb: jest.fn(() => Promise.resolve()) }));
jest.mock("../src/services/widgetSync", () => ({
  scheduleWidgetSync: jest.fn(),
  clearWidget: jest.fn(),
}));

jest.mock("../src/services/notifications", () => ({
  handleInitialNotification: jest.fn(),
}));

jest.mock("../src/hooks/useCalendarSettings", () => ({
  useCalendarSettings: () => ({ loading: false, calendars: [] }),
}));
jest.mock("../src/hooks/useNotificationSettings", () => ({
  useNotificationSettings: () => ({ loading: false }),
}));

// Wraps the real module to observe when the container touches it, and what
// the stack looks like when onReady drains.
jest.mock("../src/services/inboundLinks", () => {
  const actual = jest.requireActual("../src/services/inboundLinks");
  const { navigationRef } = require("../src/lib/navigationRef");
  return {
    ...actual,
    getInitialLinkUrl: jest.fn(actual.getInitialLinkUrl),
    subscribeToLinks: jest.fn(actual.subscribeToLinks),
    drainPendingLink: jest.fn(() => {
      const routes = navigationRef.getRootState().routes.map((r: { name: string }) => r.name);
      mockDrainLog.push(`ready ${routes.join(",")}`);
      actual.drainPendingLink();
    }),
  };
});

function mockScreen(name: string) {
  const { Text } = require("react-native");
  const React = require("react");
  return { [name]: () => React.createElement(Text, null, `screen:${name}`) };
}

jest.mock("../src/screens/NotesListScreen", () => mockScreen("NotesListScreen"));
jest.mock("../src/screens/RecordScreen", () => mockScreen("RecordScreen"));
jest.mock("../src/screens/NoteDetailScreen", () => mockScreen("NoteDetailScreen"));
jest.mock("../src/screens/ChatScreen", () => mockScreen("ChatScreen"));
jest.mock("../src/screens/TasksScreen", () => mockScreen("TasksScreen"));
jest.mock("../src/screens/AuthScreen", () => mockScreen("AuthScreen"));
jest.mock("../src/screens/SettingsScreen", () => mockScreen("SettingsScreen"));
jest.mock("../src/screens/ShareReceiveScreen", () => mockScreen("ShareReceiveScreen"));

function setup(initialUrl: string | null = null) {
  jest.resetModules();

  const { Linking, AppState } = require("react-native");
  let emitUrl!: (event: { url: string }) => void;
  jest.spyOn(Linking, "addEventListener").mockImplementation(((_: string, listener: any) => {
    emitUrl = listener;
    return { remove: jest.fn() };
  }) as any);
  jest.spyOn(Linking, "getInitialURL").mockResolvedValue(initialUrl);

  const appStateListeners = new Set<(state: string) => void>();
  AppState.currentState = "active";
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, listener: any) => {
    appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) };
  }) as any);

  const React = require("react");
  const { act, create } = require("react-test-renderer");
  const inbound = require("../src/services/inboundLinks");
  const { navigationRef } = require("../src/lib/navigationRef");
  const App = require("../App").default;

  let renderer!: ReactTestRenderer;

  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

  return {
    inbound,
    navigationRef,
    settle,
    act,
    routes: (): string[] =>
      navigationRef.getRootState().routes.map((r: { name: string }) => r.name),
    showing: (text: string) =>
      renderer.root.findAll(
        (node) => typeof node.type === "string" && node.children.includes(text),
      ).length > 0,
    pressUnlock: async () => {
      const button = renderer.root.find(
        (node) =>
          typeof node.props.onPress === "function" &&
          node
            .findAll((n) => typeof n.type === "string" && n.children.includes("Ξεκλείδωμα"))
            .length > 0,
      );
      await act(async () => {
        await button.props.onPress();
      });
      await settle();
    },
    mount: async () => {
      await act(async () => {
        renderer = create(React.createElement(App));
      });
      await settle();
    },
    unmount: () =>
      act(async () => {
        renderer.unmount();
      }),
    emitUrl: (url: string) =>
      act(async () => {
        emitUrl({ url });
      }),
    emitAppState: async (state: string) => {
      AppState.currentState = state;
      await act(async () => {
        [...appStateListeners].forEach((listener) => listener(state));
      });
      await settle();
    },
  };
}

const launchReadSettled = () => new Promise((resolve) => setTimeout(resolve, 0));

let app: ReturnType<typeof setup> | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  mockDrainLog.length = 0;
  jest.spyOn(console, "log").mockImplementation(() => {});
  mockGetSession.mockResolvedValue({ data: { session: SESSION } });
  mockHasHardware.mockResolvedValue(true);
  mockIsEnrolled.mockResolvedValue(true);
  mockGetItem.mockResolvedValue("true");
  mockAuthenticate.mockResolvedValue({ success: false });
});

afterEach(async () => {
  if (app) await app.unmount();
  app = null;
  jest.restoreAllMocks();
});

describe("App gate — before the lock decision", () => {
  it("while auth is loading: no container, getInitialLinkUrl not called", async () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));
    app = setup(RECORD);
    await launchReadSettled();

    await app.mount();

    expect(app.inbound.getInitialLinkUrl).not.toHaveBeenCalled();
    expect(app.inbound.subscribeToLinks).not.toHaveBeenCalled();
    expect(app.navigationRef.isReady()).toBe(false);
    expect(app.showing("screen:NotesListScreen")).toBe(false);
    expect(app.showing("screen:AuthScreen")).toBe(false);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it("auth restored but the setting read pending: still no container", async () => {
    mockGetItem.mockReturnValue(new Promise(() => {}));
    app = setup(RECORD);
    await launchReadSettled();

    await app.mount();

    expect(app.inbound.getInitialLinkUrl).not.toHaveBeenCalled();
    expect(app.navigationRef.isReady()).toBe(false);
    expect(app.showing("screen:NotesListScreen")).toBe(false);
  });
});

describe("App gate — locked", () => {
  it("shows LockScreen with no container, and a held URL stays held", async () => {
    app = setup();
    await launchReadSettled();

    await app.mount();
    await app.emitUrl(RECORD);

    expect(app.showing("Ξεκλείδωμα")).toBe(true);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(app.inbound.getInitialLinkUrl).not.toHaveBeenCalled();
    expect(app.navigationRef.isReady()).toBe(false);
    expect(mockDrainLog).toEqual([]);
  });

  it("cold launch URL + lock: after unlock, ready Main, then Main,Record", async () => {
    app = setup(RECORD);
    await launchReadSettled();

    await app.mount();
    expect(app.showing("Ξεκλείδωμα")).toBe(true);

    mockAuthenticate.mockResolvedValue({ success: true });
    await app.pressUnlock();

    expect(mockDrainLog).toEqual(["ready Main"]);
    expect(app.routes()).toEqual(["Main", "Record"]);
  });

  it("no replay after that: background and unlock returns to Main only", async () => {
    app = setup(RECORD);
    await launchReadSettled();
    await app.mount();
    mockAuthenticate.mockResolvedValue({ success: true });
    await app.pressUnlock();
    expect(app.routes()).toEqual(["Main", "Record"]);

    mockAuthenticate.mockResolvedValue({ success: false });
    await app.emitAppState("background");
    expect(app.showing("Ξεκλείδωμα")).toBe(true);
    expect(app.navigationRef.isReady()).toBe(false);

    mockAuthenticate.mockResolvedValue({ success: true });
    await app.emitAppState("active");

    expect(app.routes()).toEqual(["Main"]);
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });

  it("warm link while locked: background, URL, auto-prompt on return, then Main,Record", async () => {
    mockGetItem.mockResolvedValue("true");
    app = setup();
    await launchReadSettled();
    await app.mount();
    mockAuthenticate.mockResolvedValue({ success: true });
    await app.pressUnlock();
    expect(app.routes()).toEqual(["Main"]);
    mockDrainLog.length = 0;
    mockAuthenticate.mockClear();

    await app.emitAppState("background");
    expect(mockAuthenticate).not.toHaveBeenCalled();
    await app.emitUrl(RECORD);
    await app.emitAppState("active");

    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(mockDrainLog).toEqual(["ready Main"]);
    expect(app.routes()).toEqual(["Main", "Record"]);
  });
});

describe("App gate — not locked", () => {
  it("lock OFF: the container mounts after the decision, and a launch URL pushes", async () => {
    mockGetItem.mockResolvedValue("false");
    app = setup(RECORD);
    await launchReadSettled();

    await app.mount();

    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockDrainLog).toEqual(["ready Main"]);
    expect(app.routes()).toEqual(["Main", "Record"]);
  });

  it("signed out: AuthScreen, no prompt, no container", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    app = setup(RECORD);
    await launchReadSettled();

    await app.mount();

    expect(app.showing("screen:AuthScreen")).toBe(true);
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(app.navigationRef.isReady()).toBe(false);
  });
});
