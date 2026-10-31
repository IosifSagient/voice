// Single owner of inbound URLs. The NavigationContainer unmounts while the
// app is signed out or locked (App.tsx), so anything bound to it would lose a
// URL that arrives then, and re-read the launch URL on every remount. Here the
// launch URL is read once per JS process and a URL with nowhere to go waits in
// a consume-once slot (same pattern as pendingShare.ts).
//
// Every mount starts on Main with a held URL delivered from onReady, so a
// deep-linked screen is always pushed onto a mounted Main, never handed over
// as initial state. Non-share URLs reach react-navigation only through
// subscribeToLinks; share URLs go to shareLink.ts, which keeps its own
// redelivery dedup.
import { Linking } from "react-native";
import { navigationRef } from "../lib/navigationRef";
import { extractFragment, routeShareUrl } from "./shareLink";

export type InboundLinkDecision = "route-share" | "forward" | "hold";

// Pure routing decision, factored out of the Linking/navigationRef side
// effects below so it's directly unit-testable. A non-share URL needs both:
// react-navigation subscribes during the container's fallback render, when its
// listener still silently ignores URLs.
export function decideInboundLink(
  url: string,
  { navReady, hasSubscriber }: { navReady: boolean; hasSubscriber: boolean },
): InboundLinkDecision {
  if (extractFragment(url) !== null) return navReady ? "route-share" : "hold";
  return navReady && hasSubscriber ? "forward" : "hold";
}

type LinkListener = (url: string) => void;

let pending: string | null = null;
let subscriber: LinkListener | null = null;
let sawUrlEvent = false;

function deliver(url: string): void {
  const decision = decideInboundLink(url, {
    navReady: navigationRef.isReady(),
    hasSubscriber: subscriber !== null,
  });
  if (decision === "route-share") routeShareUrl(url);
  else if (decision === "forward") subscriber?.(url);
  else pending = url;
}

Linking.addEventListener("url", ({ url }) => {
  sawUrlEvent = true;
  deliver(url);
});

// A 'url' event that beat this read is the same URL redelivered or a newer
// tap, so the launch URL must not overwrite it.
const initialRead: Promise<void> = Linking.getInitialURL()
  .then((url) => {
    if (url && !sawUrlEvent) deliver(url);
  })
  .catch((err) => {
    console.error("[inboundLinks:initialRead] failed to read the launch URL", err);
  });

// Called by react-navigation on each container mount. Always null so the
// container starts on Main; waiting here means a launch URL is in the slot
// before onReady drains it.
export async function getInitialLinkUrl(): Promise<string | null> {
  await initialRead;
  return null;
}

export function subscribeToLinks(listener: LinkListener): () => void {
  subscriber = listener;
  return () => {
    if (subscriber === listener) subscriber = null;
  };
}

// Called from NavigationContainer's onReady. A URL that still can't be
// delivered stays in the slot.
export function drainPendingLink(): void {
  if (pending === null) return;
  const url = pending;
  const decision = decideInboundLink(url, {
    navReady: navigationRef.isReady(),
    hasSubscriber: subscriber !== null,
  });
  if (decision === "hold") return;
  pending = null;
  if (decision === "route-share") routeShareUrl(url);
  else subscriber?.(url);
}
