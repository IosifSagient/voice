import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { colors, spacing, type, radii } from "../config/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ShareReceive">;

// Mirrors (but doesn't import) shareCodec.ts's DecodeFailureReason values —
// see types/navigation.ts's ShareReceiveParams comment.
const REASON_MESSAGES: Record<string, string> = {
  malformed: "Ο σύνδεσμος δεν είναι έγκυρος.",
  unsupported_version: "Ο σύνδεσμος δημιουργήθηκε από νεότερη έκδοση της εφαρμογής.",
  invalid_schema: "Τα δεδομένα του συνδέσμου δεν είναι έγκυρα.",
};

// STUB screen for Increment 2 — verifies an inbound share link decodes and
// renders uncorrupted (Greek text included). No accept/reject, no save: this
// never imports notesRepository or anything from src/db. The real
// accept-flow is a later increment.
export function ShareReceiveScreen({ route, navigation }: Props) {
  const params = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!params ? (
        <Text style={styles.body}>Δεν βρέθηκαν δεδομένα.</Text>
      ) : !params.ok ? (
        <>
          <Text style={styles.errorTitle}>Σφάλμα συνδέσμου</Text>
          <Text style={styles.body}>
            {REASON_MESSAGES[params.reason] ?? "Ο σύνδεσμος δεν είναι έγκυρος."}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.label}>Περίληψη</Text>
          <Text style={styles.body}>{params.summary || "(χωρίς περίληψη)"}</Text>

          <Text style={styles.label}>Άτομα</Text>
          <Text style={styles.body}>
            {params.people.length > 0 ? params.people.join(", ") : "(κανένα)"}
          </Text>

          <Text style={styles.label}>Θέματα</Text>
          <Text style={styles.body}>
            {params.topics.length > 0 ? params.topics.join(", ") : "(κανένα)"}
          </Text>

          <Text style={styles.label}>Ενέργειες</Text>
          <Text style={styles.body}>{params.actionItemCount}</Text>

          <Text style={styles.label}>Απομαγνητοφώνηση</Text>
          <Text style={styles.body}>
            {params.hasTranscript ? "Περιλαμβάνεται" : "Δεν περιλαμβάνεται"}
          </Text>
        </>
      )}

      <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Text style={styles.closeButtonText}>Κλείσιμο</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  label: {
    ...type.label,
    color: colors.textMuted,
    marginTop: spacing.base,
  },
  body: {
    ...type.body,
    color: colors.text,
  },
  errorTitle: {
    ...type.headline,
    color: colors.destructive,
  },
  closeButton: {
    marginTop: spacing.xl,
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
  },
  closeButtonText: {
    ...type.buttonSmall,
    color: colors.accent,
  },
});
