// Single-use handoff for the full decoded share payload between "link
// decoded" (shareLink.ts) and "user accepts" (useAcceptSharedNote.ts). The
// nav param (types/navigation.ts's ShareReceiveParams) only carries a reduced
// display shape — types/ is the foundation layer and can't import
// ExtractedNote (a services/ type) — so the full payload rides here instead,
// entirely within the services layer.
//
// Plain module-level state, not React: there is exactly one inbound share
// link in flight at a time (routeShareUrl navigates immediately after
// decoding), so a single slot is enough. take() clears the slot so a stale
// payload can never be re-accepted after it's already been consumed.
import type { ExtractedNote } from "./extraction";

export type PendingShare = {
  extraction: ExtractedNote;
  transcript: string;
};

let pending: PendingShare | null = null;

export function setPendingShare(payload: PendingShare): void {
  pending = payload;
}

export function takePendingShare(): PendingShare | null {
  const payload = pending;
  pending = null;
  return payload;
}
