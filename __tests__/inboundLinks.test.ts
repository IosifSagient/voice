const mockIsReady = jest.fn();
const mockNavigate = jest.fn();
const mockGetInitialURL = jest.fn();
const mockAddEventListener = jest.fn();

jest.mock("react-native", () => ({
  Linking: {
    addEventListener: mockAddEventListener,
    getInitialURL: mockGetInitialURL,
  },
}));

jest.mock("../src/lib/navigationRef", () => ({
  navigationRef: { isReady: mockIsReady, navigate: mockNavigate },
}));

jest.mock("../src/services/shareCodec", () => ({
  decodeShare: jest.fn(() => ({
    ok: true,
    extraction: { summary: "s", people: [], topics: [], action_items: [] },
    transcript: "t",
  })),
}));

type InboundLinks = typeof import("../src/services/inboundLinks");

const RECORD = "asklisa://record";
const NOTES = "asklisa://notes";
const SHARE = "https://iosifsagient.github.io/heyLisa/s#payload";
const SHARE_2 = "https://iosifsagient.github.io/heyLisa/s#other";

// The module reads the launch URL and registers its listener on load, so each
// test gets a fresh copy — one JS process.
async function load({ initialUrl = null as string | null, ready = false } = {}) {
  jest.resetModules();
  mockAddEventListener.mockClear();
  mockGetInitialURL.mockReset();
  mockNavigate.mockClear();
  mockIsReady.mockReset();
  mockIsReady.mockReturnValue(ready);
  mockGetInitialURL.mockResolvedValue(initialUrl);

  const links: InboundLinks = require("../src/services/inboundLinks");
  const emit = (url: string) => mockAddEventListener.mock.calls[0][1]({ url });
  // Lets the module's one-time launch-URL read settle; also stands in for the
  // first container mount's read.
  const firstMount = await links.getInitialLinkUrl();
  return { links, emit, firstMount };
}

describe("decideInboundLink", () => {
  it("routes a share URL when navigation is ready, otherwise holds it", async () => {
    const { links } = await load();
    expect(links.decideInboundLink(SHARE, { navReady: true, hasSubscriber: false })).toBe("route-share");
    expect(links.decideInboundLink(SHARE, { navReady: false, hasSubscriber: true })).toBe("hold");
  });

  it("forwards any other URL only with navigation ready AND a subscriber", async () => {
    const { links } = await load();
    expect(links.decideInboundLink(RECORD, { navReady: true, hasSubscriber: true })).toBe("forward");
    expect(links.decideInboundLink(RECORD, { navReady: false, hasSubscriber: true })).toBe("hold");
    expect(links.decideInboundLink(RECORD, { navReady: true, hasSubscriber: false })).toBe("hold");
  });
});

describe("non-share URLs", () => {
  it("never returns a URL from getInitialLinkUrl; a held URL drains once through the subscriber", async () => {
    const { links, emit } = await load();
    emit(RECORD);
    expect(await links.getInitialLinkUrl()).toBeNull();

    const listener = jest.fn();
    links.subscribeToLinks(listener);
    mockIsReady.mockReturnValue(true);
    links.drainPendingLink();
    links.drainPendingLink();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(RECORD);
  });

  it("forwards a URL to a subscriber once navigation is ready, without holding it", async () => {
    const { links, emit } = await load({ ready: true });
    const listener = jest.fn();
    links.subscribeToLinks(listener);

    emit(RECORD);
    links.drainPendingLink();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(RECORD);
  });

  it("holds a URL arriving while subscribed but not ready (the container's fallback render)", async () => {
    const { links, emit } = await load();
    const listener = jest.fn();
    links.subscribeToLinks(listener);

    emit(RECORD);
    expect(listener).not.toHaveBeenCalled();

    mockIsReady.mockReturnValue(true);
    links.drainPendingLink();
    expect(listener).toHaveBeenCalledWith(RECORD);
  });

  it("holds again once the subscriber is detached (container unmounted by the lock)", async () => {
    const { links, emit } = await load({ ready: true });
    const listener = jest.fn();
    const unsubscribe = links.subscribeToLinks(listener);
    unsubscribe();

    emit(RECORD);
    expect(listener).not.toHaveBeenCalled();

    const next = jest.fn();
    links.subscribeToLinks(next);
    links.drainPendingLink();
    expect(next).toHaveBeenCalledWith(RECORD);
  });

  it("subscribing only attaches: a waiting URL isn't delivered until the drain", async () => {
    const { links, emit } = await load({ ready: true });
    emit(RECORD);
    const listener = jest.fn();

    links.subscribeToLinks(listener);
    expect(listener).not.toHaveBeenCalled();

    links.drainPendingLink();
    expect(listener).toHaveBeenCalledWith(RECORD);
  });

  it("a drain with no subscriber keeps the URL held", async () => {
    const { links, emit } = await load({ ready: true });
    emit(RECORD);

    links.drainPendingLink();

    const listener = jest.fn();
    links.subscribeToLinks(listener);
    links.drainPendingLink();
    expect(listener).toHaveBeenCalledWith(RECORD);
  });

  it("a stale unsubscribe does not detach a newer subscriber", async () => {
    const { links, emit } = await load({ ready: true });
    const oldListener = jest.fn();
    const newListener = jest.fn();
    const unsubscribeOld = links.subscribeToLinks(oldListener);
    links.subscribeToLinks(newListener);

    unsubscribeOld();
    emit(RECORD);

    expect(newListener).toHaveBeenCalledWith(RECORD);
  });
});

describe("share URLs", () => {
  it("holds a share URL while navigation isn't ready, then routes it once on drain", async () => {
    const { links, emit } = await load();
    emit(SHARE);
    links.drainPendingLink();
    expect(mockNavigate).not.toHaveBeenCalled();

    mockIsReady.mockReturnValue(true);
    links.drainPendingLink();
    links.drainPendingLink();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("ShareReceive", expect.objectContaining({ ok: true }));
  });

  it("never hands a held share URL to react-navigation", async () => {
    const { links, emit } = await load();
    emit(SHARE);
    const listener = jest.fn();
    links.subscribeToLinks(listener);

    expect(await links.getInitialLinkUrl()).toBeNull();
    expect(listener).not.toHaveBeenCalled();

    mockIsReady.mockReturnValue(true);
    links.drainPendingLink();
    expect(listener).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("routes the same share URL once when delivered twice within 2s", async () => {
    const { emit } = await load({ ready: true });
    emit(SHARE);
    emit(SHARE);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("dedupes a redelivery arriving right after a drained launch URL", async () => {
    const { links, emit } = await load({ initialUrl: SHARE });
    mockIsReady.mockReturnValue(true);
    links.drainPendingLink();

    emit(SHARE);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it("routes a deliberate re-tap of the same URL after the 2s window", async () => {
    const { emit } = await load({ ready: true });
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(10_000);
    emit(SHARE);
    now.mockReturnValue(12_000);
    emit(SHARE);
    now.mockRestore();
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });
});

describe("launch URL", () => {
  it("is read once across two container mounts and delivered once, so a nav URL doesn't replay", async () => {
    const { links, firstMount } = await load({ initialUrl: RECORD });
    const listener = jest.fn();
    links.subscribeToLinks(listener);
    mockIsReady.mockReturnValue(true);

    links.drainPendingLink();
    const secondMount = await links.getInitialLinkUrl();
    links.drainPendingLink();

    expect(firstMount).toBeNull();
    expect(secondMount).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(mockGetInitialURL).toHaveBeenCalledTimes(1);
  });

  it("does not replay a share launch URL across mounts", async () => {
    const { links } = await load({ initialUrl: SHARE });
    mockIsReady.mockReturnValue(true);

    links.drainPendingLink();
    await links.getInitialLinkUrl();
    links.drainPendingLink();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockGetInitialURL).toHaveBeenCalledTimes(1);
  });

  it("does not let a slow launch-URL read overwrite a newer 'url' event", async () => {
    jest.resetModules();
    mockAddEventListener.mockClear();
    mockIsReady.mockReturnValue(false);
    let resolveRead!: (url: string | null) => void;
    mockGetInitialURL.mockReset();
    mockGetInitialURL.mockReturnValue(new Promise((res) => (resolveRead = res)));
    const links: InboundLinks = require("../src/services/inboundLinks");

    mockAddEventListener.mock.calls[0][1]({ url: NOTES });
    resolveRead(RECORD);
    await links.getInitialLinkUrl();

    const listener = jest.fn();
    links.subscribeToLinks(listener);
    mockIsReady.mockReturnValue(true);
    links.drainPendingLink();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(NOTES);
  });

  it("still resolves when the launch-URL read fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.resetModules();
    mockGetInitialURL.mockReset();
    mockGetInitialURL.mockRejectedValue(new Error("read failed"));
    const links: InboundLinks = require("../src/services/inboundLinks");

    expect(await links.getInitialLinkUrl()).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("the single pending slot", () => {
  it("keeps only the newest of two held nav URLs", async () => {
    const { links, emit } = await load();
    emit(NOTES);
    emit(RECORD);
    const listener = jest.fn();
    links.subscribeToLinks(listener);
    mockIsReady.mockReturnValue(true);

    links.drainPendingLink();
    links.drainPendingLink();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(RECORD);
  });

  it("keeps only the newest of two held share URLs", async () => {
    const { links, emit } = await load();
    emit(SHARE);
    emit(SHARE_2);
    mockIsReady.mockReturnValue(true);

    links.drainPendingLink();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const { decodeShare } = jest.requireMock("../src/services/shareCodec");
    expect(decodeShare).toHaveBeenLastCalledWith("other");
  });

  it("a newer nav URL replaces a held share URL", async () => {
    const { links, emit } = await load();
    emit(SHARE);
    emit(RECORD);
    const listener = jest.fn();
    links.subscribeToLinks(listener);
    mockIsReady.mockReturnValue(true);

    links.drainPendingLink();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith(RECORD);
  });
});
