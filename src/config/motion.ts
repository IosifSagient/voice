import { Easing } from "react-native-reanimated";
import { recordButton, shadows } from "./theme";

// Named duration tokens (ms), one per distinct timing in ANIMATION_SPEC.md.
// Component code should reference these, never inline a raw ms number.
export const duration = {
  instant: 100, // press-in dips (checkbox pre-bounce, send button press)
  fast: 150, // small state flips (press tint, action-link fade)
  base: 200, // most crossfades/entries (icon swap, border color, glow intensify start)
  medium: 250, // reserved general-purpose staggered-entry duration, unused today
  slow: 300, // message appear, record button morph
  glowIntensify: 500, // record background glow 0.12 -> 0.25 while recording
  rotatingRing: 2000, // record: solid ring 360deg loop
  ringPulse: 3000, // record: pulse ring scale/opacity loop
  glowBreathe: 4000, // record: idle background glow breathing loop
  logoFloat: 4000, // login logo float loop

  // ANIMATION_SPEC.md LOGIN/REGISTER > Input Focus: same 200ms value as
  // searchFocus below, but kept as its own entry (not aliased) since it's a
  // different screen/feature — matches the checkbox/task tokens' convention
  // of not blurring intent across features just because the ms coincides.
  inputFocus: 200,

  // ANIMATION_SPEC.md TASKS > Checkbox Toggle. Kept as their own named
  // entries (not aliased to base/medium/slow above) even where the ms value
  // coincides, since those generic buckets are already commented for a
  // different feature and reusing them here would blur intent at the call site.
  checkboxFill: 250, // pending -> complete: inner circle scale 0 -> 1
  checkboxStroke: 300, // checkmark stroke-dashoffset draw, starts after checkboxFill
  checkboxUnfill: 200, // complete -> pending: inner circle scale 1 -> 0
  checkboxCheckmarkFadeOut: 150, // complete -> pending: checkmark opacity 1 -> 0
  checkboxTextFade: 200, // task text opacity 1.0 <-> 0.5 on complete/un-complete

  // ANIMATION_SPEC.md TASKS > Filter Pills / Task Card Deletion, and NOTES >
  // FAB. Named per-feature (not aliased to base/medium/slow) for the same
  // reason as the checkbox entries above.
  filterPillSwap: 200, // task filter pill active/inactive background crossfade
  taskDelete: 300, // task card exit: height/opacity/scale collapse
  taskEnter: 200, // task card entrance: plain FadeIn when a filter re-admits a row
  fabScrollToggle: 250, // notes FAB translateY+opacity on scroll show/hide
  fabShadowPulse: 2000, // notes FAB idle shadow radius/opacity loop

  // ANIMATION_SPEC.md NOTES (HOME) — staggered card entry, press, search focus.
  cardEntry: 300, // note card entry: opacity 0->1, translateY 12->0
  cardEntryStagger: 60, // per-card delay offset on initial mount / pull-to-refresh
  cardPress: 150, // note card press-in: scale 1.0 -> 0.98
  searchFocus: 200, // search input border/glow transition on focus
} as const;

// Task text nudge distance (ANIMATION_SPEC.md TASKS > Task Text on
// Complete): translateX 0 -> 2 -> 0, px.
export const taskTextNudge = 2;

// ANIMATION_SPEC.md NOTES (HOME) > Note card entry: translateY starting
// offset, px. Named for the note-card entrance specifically (not shared with
// taskTextNudge above, which is an unrelated toggle-feedback nudge).
export const noteCardEntryTranslateY = 12;

// Per-ring stagger for the 3 concentric record pulse rings (500ms, 1000ms).
export const ringStagger = 500;

export const easing = {
  standard: Easing.inOut(Easing.ease),
  out: Easing.out(Easing.ease),
} as const;

// Spring presets named after the interaction they drive, not their numbers,
// so a future tuning pass changes one place.
export const spring = {
  // ANIMATION_SPEC.md GLOBAL > Record modal: 350ms spring (damping 20, stiffness 200).
  modal: { damping: 20, stiffness: 200 },
  // ANIMATION_SPEC.md TASKS > Checkbox Toggle scale bounce (1.0 -> 0.85 -> 1.15 -> 1.0).
  checkboxBounceDown: { damping: 10 },
  checkboxBounceSettle: { damping: 15 },
  // ANIMATION_SPEC.md RECORD > Record Button Press: "morphs ... 300ms spring".
  // No damping/stiffness given in the spec for this one (unlike the modal
  // spring above) — chosen to settle in ~300ms with a light overshoot,
  // matching the modal spring's crispness.
  recordMorph: { damping: 18, stiffness: 220 },
  // ANIMATION_SPEC.md NOTES > FAB Press: "spring back on release" — no
  // damping/stiffness given, chosen for a snappy settle with minimal
  // overshoot appropriate for a small press-scale bounce.
  fabPress: { damping: 15, stiffness: 250 },
  // ANIMATION_SPEC.md NOTES (HOME) > Note card press: "spring back on
  // release" — same snappy-minimal-overshoot intent as fabPress, tuned
  // slightly softer since the scale delta here (1.0 -> 0.98) is smaller.
  cardPress: { damping: 16, stiffness: 260 },
  // ANIMATION_SPEC.md LOGIN/REGISTER > Button Press: "spring back on
  // release" — same tuning as fabPress (identical press-scale-bounce shape,
  // 1.0 -> 0.96), given its own semantic name rather than aliasing fabPress
  // since this is a different feature (login submit, not the notes FAB).
  authButtonPress: { damping: 15, stiffness: 250 },
} as const;

// ANIMATION_SPEC.md NOTES > FAB "Idle pulse: shadow radius 20->28->20,
// opacity 0.4->0.2->0.4". `radiusFrom`/`opacityFrom` match
// shadows.dark.fab's resting shadowRadius/shadowOpacity so the loop starts
// and ends at the FAB's static resting shadow. Not `as const`, same reason
// as pulseRing/recordGlow above.
export const fabShadow: {
  radiusFrom: number;
  radiusTo: number;
  opacityFrom: number;
  opacityTo: number;
} = {
  radiusFrom: 20,
  radiusTo: 28,
  opacityFrom: 0.4,
  opacityTo: 0.2,
};

// Record button morph radii (ANIMATION_SPEC.md RECORD > Record Button Press:
// "borderRadius 140->40"). The spec's 140 assumes a 140px button; this app's
// actual record button (theme.ts `recordButton.innerSize`) is 156px, so a
// 140 radius would clip a corner instead of staying a full circle. `idle`
// therefore reuses `recordButton.innerRadius` (78 = innerSize / 2) instead of
// the spec's literal value, so button size and idle radius can never drift
// apart; `recording` (40) is unaffected by size and matches the spec as-is.
export const recordButtonRadius = {
  idle: recordButton.innerRadius,
  recording: 40,
} as const;

// ANIMATION_SPEC.md RECORD > Pulse Rings (3 concentric): scale 1.0->1.6,
// opacity 0.5->0, 3000ms loop, each ring delayed by one more `ringStagger`.
// Not `as const`: opacityFrom/opacityTo feed the same shared value at
// different times, so they need the widened `number` type, not distinct
// numeric literal types.
export const pulseRing: {
  scaleTo: number;
  opacityFrom: number;
  opacityTo: number;
  count: number;
} = {
  scaleTo: 1.6,
  opacityFrom: 0.5,
  opacityTo: 0,
  count: 3,
};

// ANIMATION_SPEC.md RECORD > Background Glow (idle breathing) and
// Recording State (glow intensify). Two distinct ranges, not one. Not
// `as const` for the same reason as `pulseRing` above.
export const recordGlow: {
  idleOpacityFrom: number;
  idleOpacityTo: number;
  recordingOpacityFrom: number;
  recordingOpacityTo: number;
  size: number;
} = {
  idleOpacityFrom: 0.08,
  idleOpacityTo: 0.15,
  recordingOpacityFrom: 0.12,
  recordingOpacityTo: 0.25,
  // Soft radial behind the button, not a screen-filling blob — derived from
  // recordButton.outerSize (176) x 1.5, not the spec's literal value (the
  // spec doesn't size this explicitly).
  size: recordButton.outerSize * 1.5,
};

// ANIMATION_SPEC.md LOGIN/REGISTER > Button Press: "Shadow intensity
// decreases on press". `restOpacity` mirrors shadows.light.button's resting
// shadowOpacity (so the button starts/ends its press cycle at the same
// shadow it has everywhere else this shadow token is used) rather than
// duplicating the 0.3 literal here.
export const authButtonShadow: { restOpacity: number; pressOpacity: number } = {
  restOpacity: shadows.light.button.shadowOpacity,
  pressOpacity: 0.12,
};
