export const colors = {
  // Backgrounds
  bgBase:     "#0F1115",
  bgCard:     "#161A22",
  bgElevated: "#1E2330",

  // Primary accent — teal
  accent:      "#2DD4BF",
  accentMuted: "#0D2926",

  // Recording state
  recording:      "#EF4444",
  recordingMuted: "#2A1010",

  // Text hierarchy
  textPrimary:   "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted:     "#64748B",

  // Person tags — amber, warm but quiet
  personText: "#C9922A",
  personBg:   "#1C1608",

  // Topic tags — teal-green, distinct from accent
  topicText: "#2BB5A2",
  topicBg:   "#071916",

  // Due date chip
  dueText: "#7ED8CF",
  dueBg:   "#0D2926",

  // Structural
  border:     "#252A35",
  borderFaint: "#1C2130",

  // Status / error
  error: "#FCA5A5",

  white: "#FFFFFF",

  // Light-theme palette (spec DESIGN_SPEC.md) — scoped to screens restyled
  // so far (Chat). Additive only: never read a flat key above as a
  // fallback for these, and never let a `colors.dark.*` addition change
  // these values later — each namespace is self-contained.
  light: {
    bg:     "#F0F4F3",
    bgCard: "#FFFFFF",

    text:          "#0F172A",
    textOnDark:    "#FFFFFF",
    textMuted:     "#94A3B8",
    textSecondary: "#64748B",

    border:      "#E2E8F0",
    borderLight: "#F1F5F9",
    borderGlass: "rgba(255,255,255,0.1)",

    accent:      "#10B981",
    accentMint:  "#34D399",
    accentLight: "#D1FAE5",
    accentFaint: "rgba(16,185,129,0.05)",

    destructive: "#EF4444",

    glassLight: "rgba(255,255,255,0.12)",

    gradientHeader:     ["#064E3B", "#134E4A", "#0F766E"],
    gradientButton:     ["#10B981", "#06B6D4"],
    gradientUserBubble: ["#10B981", "#0D9488"],
  },

  // Dark-record palette (spec DESIGN_SPEC.md, RECORD section) — scoped to
  // RecordScreen, which stays dark by design (not part of the light-theme
  // migration). Additive only, self-contained like `light` above.
  dark: {
    bg:          "#0F172A",
    text:        "#FFFFFF",
    textMuted:   "rgba(255,255,255,0.5)",
    glass:       "rgba(255,255,255,0.08)",
    borderGlass: "rgba(255,255,255,0.15)",
    accent:      "#10B981",
    destructive: "#EF4444",
  },
} as const;

// Cross-screen gradient stops (spec DESIGN_SPEC.md) not tied to a single
// light/dark namespace. Record-only for now.
export const gradients = {
  recordScreen: {
    colors: ["#064E3B", "#0F172A"] as [string, string],
  },
  recordButton: {
    colors: ["#34D399", "#10B981", "#06B6D4"] as [string, string, string],
  },

  // Auth screen (spec DESIGN_SPEC.md LOGIN/REGISTER) — dark gradient bg and
  // submit-button gradient. authButton shares stops with
  // colors.light.gradientButton but is referenced under gradients.* here
  // for semantic cleanliness on a dark screen.
  auth: {
    colors: ["#0F172A", "#134E4A", "#064E3B"] as [string, string, string],
  },
  authButton: {
    colors: ["#10B981", "#06B6D4"] as [string, string],
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

// System font (San Francisco on iOS, Roboto on Android)
export const type = {
  headline: {
    fontSize: 21,
    fontWeight: "600" as const,
    lineHeight: 29,
    color: colors.textPrimary,
  },
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  // Section headings: ΕΝΕΡΓΕΙΕΣ etc.
  label: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: colors.textMuted,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  metaLarge: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  buttonHero: {
    fontSize: 18,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    color: colors.white,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: "600" as const,
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

// Colored shadows (spec DESIGN_SPEC.md `shadows`), light-theme only for now.
export const shadows = {
  light: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    bubbleUser: {
      shadowColor: "#10B981",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3,
    },
    button: {
      shadowColor: "#10B981",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 24,
      elevation: 6,
    },
  },

  // Dark-record palette (spec DESIGN_SPEC.md `shadows.fab`) — scoped to
  // RecordScreen's button glow.
  dark: {
    fab: {
      shadowColor: "#10B981",
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
