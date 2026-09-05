// Minimal display shape for the share-receive stub screen — deliberately
// NOT the services/shareCodec.ts DecodeResult type. types/ is the foundation
// layer (imports nothing else from /src, per AGENTS.md's layer rule), so it
// can't import a services/ type; and a route param is conventionally its own
// minimal contract anyway (compare NoteDetail's `{ id: string }`, which
// doesn't carry a full Note either). services/shareLink.ts adapts the raw
// DecodeResult down to this shape before navigating. `reason` mirrors (but
// does not import) shareCodec.ts's DecodeFailureReason values — keep the two
// in sync by hand if a new failure reason is ever added there.
export type ShareReceiveParams =
  | {
      ok: true;
      summary: string;
      people: string[];
      topics: string[];
      actionItemCount: number;
      hasTranscript: boolean;
    }
  | { ok: false; reason: "malformed" | "unsupported_version" | "invalid_schema" };

export type RootStackParamList = {
  Main: undefined;
  Record: undefined;
  NoteDetail: { id: string };
  Settings: undefined;
  // undefined covers the transient state before shareLink.ts's deferred
  // navigate() call supplies the real params — see its comment for why.
  ShareReceive: ShareReceiveParams | undefined;
};

export type MainTabParamList = {
  NotesList: undefined;
  Tasks: undefined;
  Chat: undefined;
};
