// Flat semantic token set (replaces the old flat/light/dark namespaces).
// Light-surface tokens are unprefixed defaults; dark-surface tokens
// (LockScreen/splash, RecordScreen, Auth) take an `inverse*` prefix.
// Identical-hex tokens that shared a role across the old namespaces are
// unified into one shared token (accentVivid, accentSoft, destructive,
// white, inverseBg, inverseTextMuted); everything else keeps its own hex
// even where an unprefixed/inverse pair happens to collide in name.
const base = {
  // Backgrounds
  bg:                "#F5F2EC",
  bgCard:             "#FDFBF7",
  inverseBg:          "#0A1F18",
  inverseBgCard:      "#161A22",
  inverseBgElevated:  "#1E2330",

  // Accent
  accent:             "#0E7A54",
  accentVivid:        "#1FA36E",
  accentSoft:         "#DCEAE1",
  accentFaint:        "rgba(14,122,84,0.05)",
  inverseAccentMuted: "#0D2926",

  // Recording / destructive state
  destructive:          "#C9503F",
  inverseRecordingMuted: "#2A1010",

  // Text hierarchy
  text:                 "#1E1B16",
  textMuted:            "#9A9184",
  textSecondary:        "#6B6459",
  inverseText:          "#F1F5F9",
  inverseTextSecondary: "#B9AE9C",
  inverseTextMuted:     "rgba(255,255,255,0.5)",
  white:                "#FFFFFF",

  // Person tags — amber, warm but quiet (dark-surface only)
  inversePersonText: "#C9922A",
  inversePersonBg:   "#1C1608",

  // Topic tags — teal-green, distinct from accent (dark-surface only)
  inverseTopicText: "#2BB5A2",
  inverseTopicBg:   "#071916",

  // Due date chip (dark-surface only)
  inverseDueText: "#7ED8CF",
  inverseDueBg:   "#0D2926",

  // Structural / borders
  border:             "#E7E1D6",
  borderLight:        "#F0EBE1",
  borderGlass:        "rgba(255,255,255,0.1)",
  inverseBorder:      "#252A35",
  inverseBorderFaint: "#1C2130",
  inverseBorderGlass: "rgba(255,255,255,0.15)",

  // Status
  inverseError: "#FCA5A5",

  // Modal/sheet backdrop tint (e.g. TagFilterSheet).
  scrim: "rgba(30,27,22,0.45)",

  glassLight: "rgba(255,255,255,0.12)",

  // ANIMATION_SPEC.md TASKS > Filter Pills, on-dark-header background
  // crossfade endpoints — pinned to the spec's exact pill values.
  filterPillBg:       "rgba(255,255,255,0.08)",
  filterPillBgActive: "rgba(255,255,255,0.2)",

  // RecordScreen glass fill — same rgba as filterPillBg above but a
  // distinct semantic token (dark-surface only); do not merge the two.
  inverseGlass: "rgba(255,255,255,0.08)",

  gradientHeader:     ["#0C3B2E", "#103F31", "#0E4A38"],
  gradientButton:     ["#0E7A54", "#0A5C40"],
  gradientUserBubble: ["#0E7A54", "#0A5C40"],
} as const;

export const colors = {
  ...base,

  // --- Back-compat aliases (TEMPORARY — deleted once no call site
  // references the old flat/light/dark namespaces; see AGENTS.md theme
  // migration plan). Every value below is byte-identical to the historical
  // flat key it replaces. bgCard/accent/textSecondary/textMuted/border are
  // deliberately NOT aliased here even though they were flat keys too:
  // those names collide with `base`'s same-named *light-surface* tokens,
  // and LockScreen (their only flat-meaning consumer) is already migrated
  // off them — so the unprefixed name is free for its new light meaning as
  // soon as light-surface files start consuming it in step 4.
  bgBase:        base.inverseBg,
  bgElevated:    base.inverseBgElevated,
  accentMuted:   base.inverseAccentMuted,
  recording:     base.destructive,
  recordingMuted: base.inverseRecordingMuted,
  textPrimary:   base.inverseText,
  personText:    base.inversePersonText,
  personBg:      base.inversePersonBg,
  topicText:     base.inverseTopicText,
  topicBg:       base.inverseTopicBg,
  dueText:       base.inverseDueText,
  dueBg:         base.inverseDueBg,
  borderFaint:   base.inverseBorderFaint,
  error:         base.inverseError,

  light: {
    bg:     base.bg,
    bgCard: base.bgCard,

    text:          base.text,
    textOnDark:    base.white,
    textMuted:     base.textMuted,
    textSecondary: base.textSecondary,

    border:      base.border,
    borderLight: base.borderLight,
    borderGlass: base.borderGlass,

    accent:      base.accent,
    accentMint:  base.accentVivid,
    accentLight: base.accentSoft,
    accentFaint: base.accentFaint,

    destructive: base.destructive,

    scrim: base.scrim,

    glassLight: base.glassLight,

    filterPillBg:       base.filterPillBg,
    filterPillBgActive: base.filterPillBgActive,

    gradientHeader:     base.gradientHeader,
    gradientButton:     base.gradientButton,
    gradientUserBubble: base.gradientUserBubble,
  },

  dark: {
    bg:          base.inverseBg,
    text:        base.white,
    textMuted:   base.inverseTextMuted,
    glass:       base.inverseGlass,
    borderGlass: base.inverseBorderGlass,
    accent:      base.accentVivid,
    destructive: base.destructive,
  },
} as const;

// Cross-screen gradient stops (spec DESIGN_SPEC.md) not tied to a single
// light/dark namespace. Record-only for now.
export const gradients = {
  recordScreen: {
    colors: ["#0C3B2E", "#0A1712"] as [string, string],
  },
  recordButton: {
    colors: ["#1FA36E", "#0E7A54", "#0A5C40"] as [string, string, string],
  },

  // Auth screen (spec DESIGN_SPEC.md LOGIN/REGISTER) — dark gradient bg and
  // submit-button gradient. authButton shares stops with
  // colors.light.gradientButton but is referenced under gradients.* here
  // for semantic cleanliness on a dark screen.
  auth: {
    colors: ["#0A1F18", "#0C3B2E", "#0E4A38"] as [string, string, string],
  },
  authButton: {
    colors: ["#0E7A54", "#0A5C40"] as [string, string],
  },
} as const;

// 4pt base spacing scale
export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 48,
  // clears home indicator / FAB area at list bottom
  listBottomInset: 60,
} as const;

// Literata (serif, display/reading moments) + Inter (UI/body) — both cover
// Greek glyphs, loaded via useFonts in App.tsx. Only 400/500/600 weight
// files are loaded, so no token here sets `fontWeight`: with named-weight
// font files, a numeric fontWeight on top causes RN to synthesize a
// (wrong) weight on Android instead of picking the loaded file.
export const type = {
  displaySerif: {
    fontFamily: "Literata_600SemiBold",
    fontSize: 30,
    lineHeight: 36,
    color: colors.inverseText,
  },
  titleSerif: {
    fontFamily: "Literata_500Medium",
    fontSize: 22,
    lineHeight: 28,
    color: colors.inverseText,
  },
  // Note bodies in NoteDetail.
  bodyReading: {
    fontFamily: "Literata_400Regular",
    fontSize: 16,
    lineHeight: 26,
    color: colors.inverseText,
  },

  headline: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    lineHeight: 24,
    color: colors.inverseText,
  },
  bodyLarge: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: colors.inverseText,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: colors.inverseText,
  },
  bodyMedium: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
    color: colors.inverseText,
  },
  subhead: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
    color: colors.inverseText,
  },
  // Section headings: ΕΝΕΡΓΕΙΕΣ etc.
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: colors.inverseTextMuted,
  },
  meta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.inverseTextSecondary,
  },
  metaLarge: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.inverseTextSecondary,
  },
  footnote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: colors.inverseTextSecondary,
  },
  caption: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    color: colors.inverseTextMuted,
  },
  tabLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    lineHeight: 12,
    color: colors.inverseTextMuted,
  },
  buttonHero: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    letterSpacing: 0.5,
    color: colors.white,
  },
  buttonSmall: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: colors.white,
  },
} as const;

export const radii = {
  sm:   6,
  pill: 8,
  lg:   12,
  card: 16,
  full: 9999,

  // Chat-bubble radii (spec DESIGN_SPEC.md) — non-colliding additions,
  // existing keys above are untouched.
  bubble:     18, // bubble corner radius
  bubbleTail: 4,  // sharp "tail" corner on the pointing side
  inputPill:  22, // chat input field radius

  // Spec-exact note-card radius (DESIGN_SPEC.md) — distinct from the
  // existing radii.card (16); do not conflate the two.
  cardSm: 14,

  // Auth screen glass form card (spec DESIGN_SPEC.md) — distinct from
  // radii.card (16); do not conflate the two.
  cardLg: 20,
} as const;

// Neutral, subtle shadows (no colored glow) on light surfaces. Record's
// dark-screen shadow keeps its accent-colored glow — see shadows.dark.fab.
export const shadows = {
  light: {
    card: {
      shadowColor: "#1E1B16",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 1,
    },
    bubbleUser: {
      shadowColor: "#1E1B16",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
    button: {
      shadowColor: "#1E1B16",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
    },
  },

  // Dark-record palette (spec DESIGN_SPEC.md `shadows.fab`) — scoped to
  // RecordScreen's button glow. Kept as an intentional accent-colored glow
  // (unlike the light-surface shadows above) — the Record orb is meant to
  // glow; only the banned literal was replaced, not the glow itself.
  dark: {
    fab: {
      shadowColor: "#1FA36E",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 8,
    },
  },
} as const;

// Record button dimensions — defined once so ring and button stay in sync
export const recordButton = {
  outerSize:   176,
  outerRadius: 88,
  innerSize:   156,
  innerRadius: 78,
} as const;
