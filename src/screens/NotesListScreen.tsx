import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
} from "react-native";
import * as SQLite from "expo-sqlite";
import { useFocusEffect } from "@react-navigation/native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList, MainTabParamList } from "../../App";
import { notesRepository } from "../services/notesRepository";
import { formatDate } from "../lib/dateFormat";
import type { Note } from "../types/note";
import { colors, spacing, type, radii } from "../config/theme";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "NotesList">,
  NativeStackScreenProps<RootStackParamList>
>;

export function NotesListScreen({ navigation }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const results = await notesRepository.list();
        setNotes(results);
      })();
    }, []),
  );

  const search = async (q: string) => {
    const results = q.trim()
      ? await notesRepository.search(q.trim())
      : await notesRepository.list();
    setNotes(results);
  };

  // DEV ONLY — remove before shipping
  const devDumpDb = async () => {
    try {
      const db = await SQLite.openDatabaseAsync("voicenote_v2.db");

      type Row = {
        id: string;
        summary_preview: string;
        people_json: string;
        people_normalized_json: string;
      };

      const rows = await db.getAllAsync<Row>(
        `SELECT
           id,
           substr(summary, 1, 80) AS summary_preview,
           people_json,
           people_normalized_json
         FROM notes
         ORDER BY created_at DESC`,
      );

      if (rows.length === 0) {
        Alert.alert("DB Query", "0 rows matched.");
        return;
      }

      const lines = rows.map(
        (r, i) =>
          `[${i + 1}] id: ${r.id}\n` +
          `summary: ${r.summary_preview}\n` +
          `people_json: ${r.people_json}\n` +
          `people_norm: ${r.people_normalized_json}`,
      );
      Alert.alert(`DB: ${rows.length} row(s)`, lines.join("\n\n─────\n\n"));
    } catch (e) {
      Alert.alert("DB Error", String(e));
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.search}
          placeholder="Αναζήτηση…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            search(t);
          }}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* DEV ONLY — remove before shipping */}
      <Pressable
        onPress={devDumpDb}
        style={styles.devBtn}
      >
        <Text style={styles.devBtnText}>DEV: Dump DB</Text>
      </Pressable>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          query ? (
            <Text style={styles.emptySearch}>Δεν βρέθηκαν σημειώσεις.</Text>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Καμία σημείωση ακόμα</Text>
              <Text style={styles.emptyHint}>
                Πατήστε «+ Εγγραφή» για να καταγράψετε την πρώτη σας σημείωση.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("NoteDetail", { id: item.id })}
            onLongPress={() =>
              Alert.alert("Διαγραφή σημείωσης;", undefined, [
                { text: "Άκυρο", style: "cancel" },
                {
                  text: "Διαγραφή",
                  style: "destructive",
                  onPress: async () => {
                    await notesRepository.delete(item.id);
                    search(query);
                  },
                },
              ])
            }
          >
            <Text style={styles.rowDate}>{formatDate(item.timestamp)}</Text>
            <Text
              style={styles.rowSummary}
              numberOfLines={2}
            >
              {item.summary || "—"}
            </Text>
            {(item.openActionCount ?? 0) > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {item.openActionCount === 1
                    ? "1 ενέργεια"
                    : `${item.openActionCount} ενέργειες`}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgBase },
  searchWrapper: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  search: {
    backgroundColor: colors.bgElevated,
    color: colors.textPrimary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: 11,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: 48,
  },
  emptySearch: {
    ...type.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 60,
  },
  emptyState: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    ...type.bodyLarge,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyHint: {
    ...type.meta,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.card,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderFaint,
  },
  rowPressed: { opacity: 0.65 },
  rowDate: {
    ...type.label,
    marginBottom: spacing.sm,
  },
  rowSummary: {
    ...type.body,
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    backgroundColor: colors.accentMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    ...type.meta,
    color: colors.accent,
  },
  devBtn: {
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    backgroundColor: "#5a0000",
    borderRadius: radii.lg,
    paddingVertical: 8,
    alignItems: "center",
  },
  devBtnText: {
    color: "#ff8080",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
