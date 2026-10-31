import Constants from "expo-constants";

// Domain/path prefix for a share link lives HERE and nowhere else in the app
// (scripts/printShareLink.ts is a throwaway dev script and keeps its own
// hardcoded copy deliberately — see that file's header comment).
const DEV_PREFIX = "asklisa-dev://s#";
const PROD_PREFIX = "https://iosifsagient.github.io/heyLisa/s#";

// Mirrors app.config.js's extra.appVariant ("dev" | "prod"), set from the
// same IS_DEV/APP_VARIANT source that file already computes at build time —
// this is the runtime-readable copy of that build-time flag.
export function isDevVariant(): boolean {
  // Missing/undefined defaults to prod: a real user's TestFlight/production
  // build must never fall back to the dev deep-link scheme.
  return Constants.expoConfig?.extra?.appVariant === "dev";
}

// Assembles a full shareable URL from an encodeShare() fragment (shareCodec.ts
// returns the fragment only — see that file's header comment on why).
export function buildShareUrl(fragment: string): string {
  const prefix = isDevVariant() ? DEV_PREFIX : PROD_PREFIX;
  return prefix + fragment;
}
