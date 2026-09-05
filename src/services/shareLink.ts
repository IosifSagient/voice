// Routes an inbound Universal Link (https://iosifsagient.github.io/heyLisa/s#<payload>)
// to the ShareReceive screen, mirroring notifications.ts's own pattern for
// routing an external event (a notification tap) to a screen via
// navigationRef, without going through a presentational component.
//
// react-navigation's own `linking` config (App.tsx) deliberately does NOT map
// the share path — its parser can't see the URL fragment (the actual share
// payload) anyway, so this module is the sole handler of inbound share
// links, with no competing auto-navigation to race or sequence against.
import { Linking } from "react-native";
import { navigationRef } from "../lib/navigationRef";
import { decodeShare } from "./shareCodec";
import type { DecodeResult } from "./shareCodec";
import type { ShareReceiveParams } from "../types/navigation";

// Pure — extracts the substring after a URL's first '#'. Returns null when
// there is no fragment (e.g. asklisa://notes, or any non-share link), so
// callers can leave those URLs entirely to react-navigation's own path-based
// routing instead of treating them as a (missing) share payload.
export function extractFragment(url: string): string | null {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;
  const fragment = url.slice(hashIndex + 1);
  return fragment.length > 0 ? fragment : null;
}

// Pure routing decision, factored out of the Linking/navigationRef side
// effects below so it's directly unit-testable: given the incoming URL and
// the previously-handled one, decides whether there's a new share fragment
// to act on. Covers the "single tap must not double-fire" requirement —
// some platforms redeliver the cold-start launch URL as a follow-up 'url'
// event, and this treats a repeat of the same URL as a no-op.
export function resolveInboundUrl(
  url: string | null,
  previouslyHandledUrl: string | null,
): { handle: boolean; fragment: string | null } {
  if (!url || url === previouslyHandledUrl) return { handle: false, fragment: null };
  const fragment = extractFragment(url);
  if (!fragment) return { handle: false, fragment: null };
  return { handle: true, fragment };
}

// Adapts a raw DecodeResult (services/shareCodec.ts) down to the minimal
// display shape the stub screen actually needs (types/navigation.ts owns
// ShareReceiveParams so it can be referenced from the route param list
// without that foundation-layer file importing a service — see
// types/navigation.ts's comment on ShareReceiveParams for why). The screen
// gets a people/topics list, a count, and a presence flag — never the raw
// ExtractedNote/action-item array — so it stays presentational without
// needing to "decode" anything itself.
function toShareReceiveParams(result: DecodeResult): ShareReceiveParams {
  if (!result.ok) return { ok: false, reason: result.reason };
  return {
    ok: true,
    summary: result.extraction.summary,
    people: result.extraction.people,
    topics: result.extraction.topics,
    actionItemCount: result.extraction.action_items.length,
    hasTranscript: result.transcript.length > 0,
  };
}

let lastHandledUrl: string | null = null;

function routeShareUrl(url: string | null): void {
  const decision = resolveInboundUrl(url, lastHandledUrl);
  if (!decision.handle || !decision.fragment) return;
  lastHandledUrl = url;

  const params = toShareReceiveParams(decodeShare(decision.fragment));

  // Same readiness guard as notifications.ts's routeNotificationResponse — a
  // not-yet-mounted navigator is a silent no-op. For the warm 'url' listener
  // below, the container is already mounted by definition (the app is
  // running), so this is never actually false there; it only matters for
  // handleInitialShareLink's cold-start call, which is why that call happens
  // from onReady rather than a plain useEffect (see its own comment).
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("ShareReceive", params);
}

// Tap while the app is already running (foreground/background) — same
// module-scope registration timing as notifications.ts's own tap listener.
Linking.addEventListener("url", ({ url }) => routeShareUrl(url));

// The tap that launched the app from killed isn't delivered via the 'url'
// event above. Call this once from NavigationContainer's onReady (not a
// plain useEffect) so navigationRef.isReady() above is guaranteed true —
// same cold-start gap handleInitialNotification fills for notification taps.
export async function handleInitialShareLink(): Promise<void> {
  const url = await Linking.getInitialURL();
  routeShareUrl(url);
}
