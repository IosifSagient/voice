import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { colors, spacing, type, radii } from "../config/theme";
import { useAcceptSharedNote } from "../hooks/useAcceptSharedNote";

type Props = NativeStackScreenProps<RootStackParamList, "ShareReceive">;

// Mirrors (but doesn't import) shareCodec.ts's DecodeFailureReason values —
// see types/navigation.ts's ShareReceiveParams comment.
const REASON_MESSAGES: Record<string, string> = {
  malformed: "Ο σύνδεσμος δεν είναι έγκυρος.",
  unsupported_version: "Ο σύνδεσμος δημιουργήθηκε από νεότερη έκδοση της εφαρμογής.",
  invalid_schema: "Τα δεδομένα του συνδέσμου δεν είναι έγκυρα.",
};

// Presentational: renders the reduced display shape from route.params (the
// full decoded payload lives in services/pendingShare.ts, not here — see its
// comment) and delegates the actual save to useAcceptSharedNote. This screen
// never imports notesRepository or anything from src/db.
export function ShareReceiveScreen({ route, navigation }: Props) {
  const params = route.params;
  const { accept, reject, error, loading } = useAcceptSharedNote();
  const [rejected, setRejected] = useState(false);

  const handleAccept = async () => {
    const noteId = await accept();
    if (noteId) {
      navigation.replace("NoteDetail", { id: noteId });
    }
  };

  const handleReject = () => {
    reject();
    setRejected(true);
    navigation.goBack();
  };

  const canAct = !!params && params.ok && !rejected;

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

      {error && <Text style={styles.errorText}>{error}</Text>}

      {canAct ? (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
            disabled={loading}
          >
            <Text style={[styles.actionButtonText, styles.rejectButtonText]}>Απόρριψη</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.acceptButton]}
            onPress={handleAccept}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={[styles.actionButtonText, styles.acceptButtonText]}>Αποδοχή</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Text style={styles.closeButtonText}>Κλείσιμο</Text>
        </Pressable>
      )}
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
  errorText: {
    ...type.meta,
    color: colors.destructive,
    marginTop: spacing.base,
    textAlign: "center",
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
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radii.pill,
  },
  rejectButton: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  acceptButton: {
    backgroundColor: colors.accent,
  },
  actionButtonText: {
    ...type.buttonSmall,
  },
  rejectButtonText: {
    color: colors.text,
  },
  acceptButtonText: {
    color: colors.white,
  },
});
