// TEMPORARY — part of the theme.ts flat-token-set migration (see AGENTS.md).
// Proves every old flat/light.*/dark.* key still resolves to its exact
// pre-migration value while call sites are migrated one file at a time.
// Delete this file (and the back-compat aliases it protects) once
// `grep -rE "colors\.(light|dark)\."` and the old flat-key names return
// zero hits outside theme.ts.
import { colors } from "../src/config/theme";

describe("theme token back-compat snapshot", () => {
  it("preserves every old flat key's resolved value", () => {
    expect({
      bgBase: colors.bgBase,
      bgCard: colors.bgCard,
      bgElevated: colors.bgElevated,
      accent: colors.accent,
      accentMuted: colors.accentMuted,
      recording: colors.recording,
      recordingMuted: colors.recordingMuted,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      personText: colors.personText,
      personBg: colors.personBg,
      topicText: colors.topicText,
      topicBg: colors.topicBg,
      dueText: colors.dueText,
      dueBg: colors.dueBg,
      border: colors.border,
      borderFaint: colors.borderFaint,
      error: colors.error,
      white: colors.white,
    }).toEqual({
      bgBase: "#0A1F18",
      bgCard: "#161A22",
      bgElevated: "#1E2330",
      accent: "#1FA36E",
      accentMuted: "#0D2926",
      recording: "#C9503F",
      recordingMuted: "#2A1010",
      textPrimary: "#F1F5F9",
      textSecondary: "#B9AE9C",
      textMuted: "rgba(255,255,255,0.5)",
      personText: "#C9922A",
      personBg: "#1C1608",
      topicText: "#2BB5A2",
      topicBg: "#071916",
      dueText: "#7ED8CF",
      dueBg: "#0D2926",
      border: "#252A35",
      borderFaint: "#1C2130",
      error: "#FCA5A5",
      white: "#FFFFFF",
    });
  });

  it("preserves every old colors.light.* key's resolved value", () => {
    expect(colors.light).toEqual({
      bg: "#F5F2EC",
      bgCard: "#FDFBF7",
      text: "#1E1B16",
      textOnDark: "#FFFFFF",
      textMuted: "#9A9184",
      textSecondary: "#6B6459",
      border: "#E7E1D6",
      borderLight: "#F0EBE1",
      borderGlass: "rgba(255,255,255,0.1)",
      accent: "#0E7A54",
      accentMint: "#1FA36E",
      accentLight: "#DCEAE1",
      accentFaint: "rgba(14,122,84,0.05)",
      destructive: "#C9503F",
      scrim: "rgba(30,27,22,0.45)",
      glassLight: "rgba(255,255,255,0.12)",
      filterPillBg: "rgba(255,255,255,0.08)",
      filterPillBgActive: "rgba(255,255,255,0.2)",
      gradientHeader: ["#0C3B2E", "#103F31", "#0E4A38"],
      gradientButton: ["#0E7A54", "#0A5C40"],
      gradientUserBubble: ["#0E7A54", "#0A5C40"],
    });
  });

  it("preserves every old colors.dark.* key's resolved value", () => {
    expect(colors.dark).toEqual({
      bg: "#0A1F18",
      text: "#FFFFFF",
      textMuted: "rgba(255,255,255,0.5)",
      glass: "rgba(255,255,255,0.08)",
      borderGlass: "rgba(255,255,255,0.15)",
      accent: "#1FA36E",
      destructive: "#C9503F",
    });
  });
});
