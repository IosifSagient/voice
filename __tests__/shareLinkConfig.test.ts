// Tests src/config/shareLink.ts (the sender-side URL-prefix config) — not to
// be confused with __tests__/shareLink.test.ts, which covers the receive-side
// routing module src/services/shareLink.ts.
let mockExtra: Record<string, unknown> | undefined;

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra };
    },
  },
}));

import { buildShareUrl } from "../src/config/shareLink";

describe("buildShareUrl", () => {
  beforeEach(() => {
    mockExtra = undefined;
  });

  it("uses the dev scheme when appVariant is 'dev'", () => {
    mockExtra = { appVariant: "dev" };
    expect(buildShareUrl("abc123")).toBe("asklisa-dev://s#abc123");
  });

  it("uses the prod domain when appVariant is 'prod'", () => {
    mockExtra = { appVariant: "prod" };
    expect(buildShareUrl("abc123")).toBe("https://iosifsagient.github.io/heyLisa/s#abc123");
  });

  it("defaults to the prod domain when extra is missing entirely", () => {
    mockExtra = undefined;
    expect(buildShareUrl("xyz")).toBe("https://iosifsagient.github.io/heyLisa/s#xyz");
  });

  it("defaults to the prod domain when appVariant is an unrecognized value", () => {
    mockExtra = { appVariant: "staging" };
    expect(buildShareUrl("xyz")).toBe("https://iosifsagient.github.io/heyLisa/s#xyz");
  });
});
