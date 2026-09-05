import { strToU8, zlibSync } from "fflate";
import { encodeShare, decodeShare, MAX_FRAGMENT_LENGTH } from "../src/services/shareCodec";
import type { ExtractedNote } from "../src/services/extraction";

function makeExtraction(overrides: Partial<ExtractedNote> = {}): ExtractedNote {
  return {
    summary: "Συνάντηση με τον Παπαδόπουλο για τον προϋπολογισμό",
    people: ["Γιάννης Παπαδόπουλος"],
    topics: ["προϋπολογισμός"],
    action_items: [
      { text: "Στείλε το draft", due_date: "2026-09-10", due_time: "14:00", all_day: false },
    ],
    ...overrides,
  };
}

// Local base64url encoder for test-fixture crafting only — mirrors the
// production codec's own hand-rolled encoder (no Buffer/btoa dependency,
// consistent with the project having no @types/node) so negative-path tests
// below can construct payloads encodeShare itself would never produce
// (wrong version, extra keys, wrong-typed fields).
const BASE64URL_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function bytesToBase64UrlForTest(bytes: Uint8Array): string {
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

function craftFragmentFromObject(obj: unknown): string {
  return bytesToBase64UrlForTest(zlibSync(strToU8(JSON.stringify(obj))));
}

function craftFragmentFromRawBytes(bytes: Uint8Array): string {
  return bytesToBase64UrlForTest(bytes);
}

// Deterministic pseudo-random text generator (LCG-seeded) — used where a
// test needs high-entropy content that deflate can't compress away, so a
// "must exceed MAX_FRAGMENT_LENGTH" assertion doesn't depend on how well
// zlib happens to compress a specific string.
function pseudoRandomText(seed: number, length: number): string {
  const chars =
    "αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩabcdefghijklmnopqrstuvwxyz0123456789";
  let x = seed;
  let out = "";
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out += chars[x % chars.length];
  }
  return out;
}

describe("shareCodec — round trip", () => {
  it("reproduces an ASCII note exactly", () => {
    const extraction = makeExtraction({
      summary: "Meeting with Alice about the budget",
      people: ["Alice Smith"],
      topics: ["budget"],
      action_items: [{ text: "Send the draft", due_date: "2026-09-10" }],
    });
    const encoded = encodeShare(extraction, "This is the raw transcript.");
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const decoded = decodeShare(encoded.fragment);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.extraction).toEqual(extraction);
    expect(decoded.transcript).toBe("This is the raw transcript.");
  });

  it("reproduces Greek text byte-identically, including accents and final sigma", () => {
    // "καθηγητής" ends in final sigma (ς); the whole string carries accents.
    const summary = "Ο καθηγητής είπε ότι πρέπει να τελειώσουμε έως τις 10 Σεπτεμβρίου.";
    const transcript = "Μιλήσαμε με τον κύριο Παπαδόπουλο και την κυρία Νικολάου χθες βράδυ.";
    const extraction = makeExtraction({
      summary,
      people: ["Νικολάου", "Παπαδόπουλος"],
      topics: ["φόρος εισοδήματος"],
    });

    const encoded = encodeShare(extraction, transcript);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const decoded = decodeShare(encoded.fragment);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    // Byte/codepoint-identical — no toKey() or any other normalization applied.
    expect(decoded.extraction.summary).toBe(summary);
    expect(decoded.transcript).toBe(transcript);
    expect(decoded.extraction).toEqual(extraction);
  });

  it("round-trips a note with no transcript and no action items", () => {
    const extraction = makeExtraction({ action_items: [] });
    const encoded = encodeShare(extraction);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const decoded = decodeShare(encoded.fragment);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.extraction).toEqual(extraction);
    expect(decoded.transcript).toBe("");
  });
});

describe("shareCodec — adaptive transcript boundary (D2)", () => {
  it("keeps a small transcript when the fragment fits under the ceiling", () => {
    const extraction = makeExtraction();
    const transcript = "Ένα μικρό απόσπασμα απομαγνητοφώνησης.";
    const result = encodeShare(extraction, transcript);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.truncated).toBe(false);
    expect(result.fragment.length).toBeLessThanOrEqual(MAX_FRAGMENT_LENGTH);

    const decoded = decodeShare(result.fragment);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.transcript).toBe(transcript);
  });

  it("drops the transcript when only the WITH-transcript fragment exceeds the ceiling", () => {
    const extraction = makeExtraction();
    // High-entropy so deflate can't shrink it below the ceiling regardless
    // of exact compression ratio.
    const transcript = pseudoRandomText(1, 4000);
    const result = encodeShare(extraction, transcript);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meta.truncated).toBe(true);
    expect(result.fragment.length).toBeLessThanOrEqual(MAX_FRAGMENT_LENGTH);

    const decoded = decodeShare(result.fragment);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.transcript).toBe("");
    expect(decoded.extraction).toEqual(extraction);
  });

  it("fails with too_large when even the structure-only fragment exceeds the ceiling", () => {
    const extraction = makeExtraction({
      summary: pseudoRandomText(2, 50000),
    });
    const result = encodeShare(extraction, pseudoRandomText(3, 4000));
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });
});

describe("shareCodec — decode failure modes", () => {
  it("rejects a fragment with invalid base64url characters", () => {
    expect(decodeShare("not-@-valid-base64url!!!")).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects base64url-valid bytes that are not a valid zlib stream", () => {
    // Valid UTF-8 JSON bytes, base64url-encoded directly — never zlib-compressed.
    const fragment = craftFragmentFromRawBytes(
      strToU8(JSON.stringify({ v: 1, s: "", p: [], t: [], a: [] })),
    );
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a valid zlib stream whose content is not valid JSON", () => {
    const fragment = craftFragmentFromRawBytes(zlibSync(strToU8("not { json")));
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a missing version field", () => {
    const fragment = craftFragmentFromObject({ s: "", p: [], t: [], a: [] });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "unsupported_version" });
  });

  it("rejects an unrecognized version number", () => {
    const fragment = craftFragmentFromObject({ v: 2, s: "", p: [], t: [], a: [] });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "unsupported_version" });
  });

  it("rejects a non-object top-level payload (array)", () => {
    const fragment = craftFragmentFromObject([1, 2, 3]);
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "unsupported_version" });
  });

  it("rejects an unknown top-level key", () => {
    const fragment = craftFragmentFromObject({ v: 1, s: "", p: [], t: [], a: [], y: "nope" });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("rejects a non-array people field", () => {
    const fragment = craftFragmentFromObject({ v: 1, s: "", p: "Alice", t: [], a: [] });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("rejects a non-array topics field", () => {
    const fragment = craftFragmentFromObject({ v: 1, s: "", p: [], t: { x: 1 }, a: [] });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("rejects an oversized summary field", () => {
    // Far larger than SUMMARY_MAX regardless of its exact configured value.
    const fragment = craftFragmentFromObject({
      v: 1,
      s: "α".repeat(20000),
      p: [],
      t: [],
      a: [],
    });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("rejects an oversized transcript field", () => {
    const fragment = craftFragmentFromObject({
      v: 1,
      s: "",
      p: [],
      t: [],
      a: [],
      x: "α".repeat(50000),
    });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("rejects an action item carrying an app-managed field (id)", () => {
    const fragment = craftFragmentFromObject({
      v: 1,
      s: "",
      p: [],
      t: [],
      a: [{ text: "x", due_date: null, id: "should-not-be-settable" }],
    });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("rejects an action item carrying app-managed status/calendar_event_id/notification_id", () => {
    for (const field of ["status", "calendar_event_id", "notification_id"]) {
      const fragment = craftFragmentFromObject({
        v: 1,
        s: "",
        p: [],
        t: [],
        a: [{ text: "x", due_date: null, [field]: "nope" }],
      });
      expect(decodeShare(fragment)).toEqual({ ok: false, reason: "invalid_schema" });
    }
  });

  it("rejects an action item with a wrong-typed field", () => {
    const fragment = craftFragmentFromObject({
      v: 1,
      s: "",
      p: [],
      t: [],
      a: [{ text: 123, due_date: null }],
    });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("rejects an action item with a wrong-typed all_day field", () => {
    const fragment = craftFragmentFromObject({
      v: 1,
      s: "",
      p: [],
      t: [],
      a: [{ text: "x", due_date: null, all_day: "yes" }],
    });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("rejects an action item missing the required text field", () => {
    const fragment = craftFragmentFromObject({
      v: 1,
      s: "",
      p: [],
      t: [],
      a: [{ due_date: null }],
    });
    expect(decodeShare(fragment)).toEqual({ ok: false, reason: "invalid_schema" });
  });

  it("accepts a minimal valid envelope with missing optional s/p/t/a defaulted", () => {
    const fragment = craftFragmentFromObject({ v: 1 });
    const decoded = decodeShare(fragment);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.extraction).toEqual({ summary: "", people: [], topics: [], action_items: [] });
    expect(decoded.transcript).toBe("");
  });
});

describe("shareCodec — size characterization (measurement harness, not a spec)", () => {
  it("logs fragment length vs. transcript length for future MAX_FRAGMENT_LENGTH tuning", () => {
    const extraction = makeExtraction();
    const transcriptLengths = [0, 200, 500, 1000, 2000, 5000];
    const rows = transcriptLengths.map((len) => {
      // Repeated Greek sentence fragments — more representative of real
      // speech-to-text output than pure random noise, so these numbers are
      // meaningful for tuning MAX_FRAGMENT_LENGTH later.
      const sample =
        "Μιλήσαμε σήμερα για το πρόγραμμα και τις επόμενες ενέργειες που πρέπει να κάνουμε. ";
      const transcript = sample.repeat(Math.ceil(len / sample.length)).slice(0, len);
      const result = encodeShare(extraction, transcript || undefined);
      return {
        transcriptLength: len,
        ok: result.ok,
        fragmentLength: result.ok ? result.fragment.length : null,
        truncated: result.ok ? result.meta.truncated : null,
      };
    });

    // eslint-disable-next-line no-console
    console.log("[shareCodec size characterization]", JSON.stringify(rows, null, 2));

    // Sanity only — real tuning happens against actual device/messaging-app
    // limits in a later increment, not against this fixed expectation.
    for (const row of rows) {
      expect(row.ok).toBe(true);
    }
  });
});
