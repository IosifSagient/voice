// Pure encode/decode of a note's extracted structure to/from a URL-fragment
// string, for the "share a note" feature. No DB, no navigation, no network —
// callers own everything the fragment ends up attached to (scheme, domain,
// accept/reject UI). Decode treats its input as HOSTILE external data: every
// field is validated before it can reach an ExtractedNote/notesRepository.create
// call, since the existing save path (db/notesWrite.js) does no schema/type/
// length validation of its own.
//
// toKey() (lib/textNormalize.ts) is deliberately never called here — that
// normalization is a search-index concern, applied at write/query time in
// db/, not a storage-time transform. Running it here would silently mutate
// the sender's exact Greek text (accents, final sigma) before it ever
// reaches saveNote().
import { strToU8, strFromU8, zlibSync, unzlibSync } from "fflate";
import type { ExtractedNote } from "./extraction";

const SHARE_VERSION = 1;

// ---- Limits -----------------------------------------------------------
// Decode-side caps guard the trust boundary; encode-side is the sender's own
// device data and is not capped here (that data already came from this same
// validated pipeline on a previous decode, or from the user's own extraction).

// Conservative v1 ceiling on the encoded fragment string. NOT YET verified
// against real messaging-app/device URL-length limits — verification rides
// on the first device build (a later increment). Tune once real numbers exist.
export const MAX_FRAGMENT_LENGTH = 2000;

const SUMMARY_MAX = 5000; // generous cap on a note's summary text
const PEOPLE_MAX = 100; // max number of people tags in one shared note
const PERSON_NAME_MAX = 200; // max length of a single person display name
const TOPICS_MAX = 100; // max number of topic tags in one shared note
const TOPIC_MAX = 200; // max length of a single topic tag
const ACTIONS_MAX = 200; // max number of action items in one shared note
const ACTION_TEXT_MAX = 500; // max length of one action item's text
const DUE_DATE_MAX = 32; // YYYY-MM-DD is 10 chars; generous slack
const DUE_TIME_MAX = 16; // HH:MM is 5 chars; generous slack
const TRANSCRIPT_MAX = 20000; // cap on the optional raw transcript

// ---- Base64url (no padding) — hand-rolled, no btoa/atob/Buffer/TextEncoder
// dependency, since none of those are confirmed available under Hermes.
const BASE64URL_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE64URL_INDEX: Record<string, number> = {};
for (let i = 0; i < BASE64URL_CHARS.length; i++) {
  BASE64URL_INDEX[BASE64URL_CHARS[i]] = i;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;
    const b1 = hasB1 ? bytes[i + 1] : 0;
    const b2 = hasB2 ? bytes[i + 2] : 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64URL_CHARS[(triplet >> 18) & 0x3f];
    out += BASE64URL_CHARS[(triplet >> 12) & 0x3f];
    if (hasB1) out += BASE64URL_CHARS[(triplet >> 6) & 0x3f];
    if (hasB2) out += BASE64URL_CHARS[triplet & 0x3f];
  }
  return out;
}

// Returns null on any character outside the base64url alphabet.
function base64UrlToBytes(str: string): Uint8Array | null {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < str.length; i++) {
    const value = BASE64URL_INDEX[str[i]];
    if (value === undefined) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

// ---- Envelope shape -----------------------------------------------------

type ShareActionItem = {
  text: string;
  due_date: string | null;
  due_time?: string | null;
  all_day?: boolean;
};

type ShareEnvelope = {
  v: number;
  s: string;
  p: string[];
  t: string[];
  a: ShareActionItem[];
  x?: string;
};

function buildEnvelope(
  extraction: ExtractedNote,
  transcript?: string,
): ShareEnvelope {
  const envelope: ShareEnvelope = {
    v: SHARE_VERSION,
    s: extraction.summary ?? "",
    p: extraction.people ?? [],
    t: extraction.topics ?? [],
    a: (extraction.action_items ?? []).map((item) => {
      const out: ShareActionItem = { text: item.text, due_date: item.due_date };
      if (item.due_time !== undefined) out.due_time = item.due_time;
      if (item.all_day !== undefined) out.all_day = item.all_day;
      return out;
    }),
  };
  if (transcript) envelope.x = transcript;
  return envelope;
}

// zlib framing (not raw deflate) is used deliberately for its adler32
// checksum — a fragment mangled by copy/paste or a messaging app's text
// processing then fails here as a decode error instead of feeding corrupted
// bytes into JSON.parse.
function compressEnvelope(envelope: ShareEnvelope): string {
  const json = JSON.stringify(envelope);
  const compressed = zlibSync(strToU8(json));
  return bytesToBase64Url(compressed);
}

// ---- Encode ---------------------------------------------------------------

export type EncodeResult =
  | { ok: true; fragment: string; meta: { truncated: boolean } }
  | { ok: false; reason: "too_large" };

// Adaptive transcript inclusion (D2): try with transcript first, drop it if
// the fragment is over budget, and fail outright only if the structure alone
// can't fit — never emit a fragment over MAX_FRAGMENT_LENGTH.
export function encodeShare(
  extraction: ExtractedNote,
  transcript?: string,
): EncodeResult {
  const withTranscript = compressEnvelope(buildEnvelope(extraction, transcript));
  if (withTranscript.length <= MAX_FRAGMENT_LENGTH) {
    return { ok: true, fragment: withTranscript, meta: { truncated: false } };
  }

  if (!transcript) {
    return { ok: false, reason: "too_large" };
  }

  const withoutTranscript = compressEnvelope(buildEnvelope(extraction, undefined));
  if (withoutTranscript.length <= MAX_FRAGMENT_LENGTH) {
    return { ok: true, fragment: withoutTranscript, meta: { truncated: true } };
  }
  return { ok: false, reason: "too_large" };
}

// ---- Decode + validation ---------------------------------------------------

export type DecodeFailureReason =
  | "malformed"
  | "unsupported_version"
  | "invalid_schema";

export type DecodeResult =
  | {
      ok: true;
      extraction: ExtractedNote;
      transcript: string;
      meta: { version: number };
    }
  | { ok: false; reason: DecodeFailureReason };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isCappedStringArray(
  v: unknown,
  maxCount: number,
  maxLen: number,
): v is string[] {
  if (!Array.isArray(v) || v.length > maxCount) return false;
  return v.every((item) => typeof item === "string" && item.length <= maxLen);
}

const ACTION_ITEM_ALLOWED_KEYS = new Set(["text", "due_date", "due_time", "all_day"]);

// Allowlist-only: any key outside {text, due_date, due_time, all_day} is
// rejected, which covers the explicit requirement to reject
// id/status/calendar_event_id/notification_id (app-managed, never the
// sender's to set) along with anything else not in ExtractedNote's own
// action_item shape (services/extraction.ts).
function validateActionItem(raw: unknown): ShareActionItem | null {
  if (!isPlainObject(raw)) return null;
  for (const key of Object.keys(raw)) {
    if (!ACTION_ITEM_ALLOWED_KEYS.has(key)) return null;
  }

  const { text, due_date, due_time, all_day } = raw;
  if (typeof text !== "string" || text.length > ACTION_TEXT_MAX) return null;

  if (
    due_date !== undefined &&
    due_date !== null &&
    (typeof due_date !== "string" || due_date.length > DUE_DATE_MAX)
  ) {
    return null;
  }
  if (
    due_time !== undefined &&
    due_time !== null &&
    (typeof due_time !== "string" || due_time.length > DUE_TIME_MAX)
  ) {
    return null;
  }
  if (all_day !== undefined && typeof all_day !== "boolean") return null;

  const item: ShareActionItem = {
    text,
    due_date: (due_date ?? null) as string | null,
  };
  if (due_time !== undefined) item.due_time = due_time as string | null;
  if (all_day !== undefined) item.all_day = all_day;
  return item;
}

const TOP_LEVEL_ALLOWED_KEYS = new Set(["v", "s", "p", "t", "a", "x"]);

// Runs AFTER the version check (see decodeShare) — by that point `raw` is
// already known to be a plain object with a supported `v`. s/p/t/a are
// always emitted by encodeShare (only `x` is genuinely optional — see the
// envelope shape above), but a missing key here is defaulted rather than
// rejected, mirroring db/notesWrite.js's own `extraction || {}` /
// `summary = ""` destructuring-default style for the same fields. A
// key that IS present with the wrong type is rejected, never coerced.
function validateEnvelope(raw: Record<string, unknown>): ShareEnvelope | null {
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_ALLOWED_KEYS.has(key)) return null;
  }

  const summary = raw.s === undefined ? "" : raw.s;
  if (typeof summary !== "string" || summary.length > SUMMARY_MAX) return null;

  const people = raw.p === undefined ? [] : raw.p;
  if (!isCappedStringArray(people, PEOPLE_MAX, PERSON_NAME_MAX)) return null;

  const topics = raw.t === undefined ? [] : raw.t;
  if (!isCappedStringArray(topics, TOPICS_MAX, TOPIC_MAX)) return null;

  const rawActions = raw.a === undefined ? [] : raw.a;
  if (!Array.isArray(rawActions) || rawActions.length > ACTIONS_MAX) return null;
  const actionItems: ShareActionItem[] = [];
  for (const rawItem of rawActions) {
    const item = validateActionItem(rawItem);
    if (!item) return null;
    actionItems.push(item);
  }

  let transcript: string | undefined;
  if (raw.x !== undefined) {
    if (typeof raw.x !== "string" || raw.x.length > TRANSCRIPT_MAX) return null;
    transcript = raw.x;
  }

  return { v: raw.v as number, s: summary, p: people, t: topics, a: actionItems, x: transcript };
}

// A non-object (or array/null) parse result has no `v` property to read —
// treated the same as "v is missing", which the spec already routes to
// unsupported_version, so a garbage top-level shape never needs its own
// separate case.
function readVersion(parsed: unknown): number | undefined {
  if (!isPlainObject(parsed)) return undefined;
  return parsed.v as number | undefined;
}

// Never throws — every failure mode (bad base64url, bad zlib stream, bad
// JSON, unsupported version, failed field validation) resolves to a typed
// { ok: false, reason } result.
export function decodeShare(fragment: string): DecodeResult {
  let parsed: unknown;
  try {
    const compressed = base64UrlToBytes(fragment);
    if (!compressed) return { ok: false, reason: "malformed" };
    const inflated = unzlibSync(compressed);
    parsed = JSON.parse(strFromU8(inflated));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const version = readVersion(parsed);
  if (version !== SHARE_VERSION) return { ok: false, reason: "unsupported_version" };

  const envelope = validateEnvelope(parsed as Record<string, unknown>);
  if (!envelope) return { ok: false, reason: "invalid_schema" };

  const extraction: ExtractedNote = {
    summary: envelope.s,
    people: envelope.p,
    topics: envelope.t,
    action_items: envelope.a,
  };

  return { ok: true, extraction, transcript: envelope.x ?? "", meta: { version } };
}
