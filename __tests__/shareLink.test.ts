import { extractFragment, resolveInboundUrl } from "../src/services/shareLink";

describe("extractFragment", () => {
  it("returns the substring after the first '#' for a share link", () => {
    expect(extractFragment("https://iosifsagient.github.io/heyLisa/s#abc123")).toBe("abc123");
  });

  it("returns null when the URL has no fragment", () => {
    expect(extractFragment("https://iosifsagient.github.io/heyLisa/s")).toBeNull();
  });

  it("returns null for an existing asklisa:// route with no fragment", () => {
    expect(extractFragment("asklisa://notes")).toBeNull();
    expect(extractFragment("asklisa://note/abc-123")).toBeNull();
  });

  it("returns null when the fragment is present but empty", () => {
    expect(extractFragment("https://iosifsagient.github.io/heyLisa/s#")).toBeNull();
  });

  it("only splits on the FIRST '#', preserving any further '#' as payload content", () => {
    expect(extractFragment("https://iosifsagient.github.io/heyLisa/s#a#b")).toBe("a#b");
  });
});

describe("resolveInboundUrl", () => {
  it("handles a share link not seen before, extracting its fragment", () => {
    expect(
      resolveInboundUrl("https://iosifsagient.github.io/heyLisa/s#payload", null),
    ).toEqual({ handle: true, fragment: "payload" });
  });

  it("is a safe no-op for a null URL (no launch/tap URL present)", () => {
    expect(resolveInboundUrl(null, null)).toEqual({ handle: false, fragment: null });
  });

  it("is a safe no-op for an existing asklisa:// route (no fragment to act on)", () => {
    expect(resolveInboundUrl("asklisa://notes", null)).toEqual({ handle: false, fragment: null });
    expect(resolveInboundUrl("asklisa://note/abc-123", "some-other-url")).toEqual({
      handle: false,
      fragment: null,
    });
  });

  it("dedupes a repeat of the same URL handled within the redelivery window (single-tap double-fire guard)", () => {
    const url = "https://iosifsagient.github.io/heyLisa/s#payload";
    expect(resolveInboundUrl(url, url, 1000, 500)).toEqual({ handle: false, fragment: null });
  });

  it("still handles a genuinely new URL even when a different one was handled before", () => {
    const previous = "https://iosifsagient.github.io/heyLisa/s#old";
    const next = "https://iosifsagient.github.io/heyLisa/s#new";
    expect(resolveInboundUrl(next, previous, 1000, 500)).toEqual({ handle: true, fragment: "new" });
  });

  it("handles a repeat tap of the same URL once the redelivery window has elapsed (warm re-tap, not a platform redelivery)", () => {
    const url = "https://iosifsagient.github.io/heyLisa/s#payload";
    // 2000ms+ after the previous handling — same URL, but no longer treated
    // as a redelivery of the same physical tap.
    expect(resolveInboundUrl(url, url, 3000, 500)).toEqual({ handle: true, fragment: "payload" });
  });
});
