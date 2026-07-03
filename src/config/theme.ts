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
} as const;

// Record button dimensions — defined once so ring and button stay in sync
export const recordButton = {
  outerSize:   176,
  outerRadius: 88,
  innerSize:   156,
  innerRadius: 78,
} as const;
