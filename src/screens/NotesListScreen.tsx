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
import { useFocusEffect } from "@react-navigation/native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList, MainTabParamList } from "../../App";
import { notesRepository } from "../services/notesRepository";
import { removeReminder } from "../services/calendar";
import { cancelReminder } from "../services/notifications";
import { useTodayTasks } from "../hooks/useTodayTasks";
import { TodaySection } from "../components/TodaySection";
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
  const [error, setError] = useState<string | null>(null);
  const {
    overdue,
    today,
    upcoming,
    loading: todayLoading,
    error: todayError,
    refresh: refreshTodayTasks,
    complete: completeTodayTask,
    reopen: reopenTodayTask,
  } = useTodayTasks();

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const results = await notesRepository.list();
          setNotes(results);
          setError(null);
        } catch (e) {
          setNotes([]);
          setError(e instanceof Error ? e.message : String(e));
        }
      })();
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      refreshTodayTasks();
    }, [refreshTodayTasks]),
  );

  const search = async (q: string) => {
    try {
      const results = q.trim()
        ? await notesRepository.search(q.trim())
        : await notesRepository.list();
      setNotes(results);
      setError(null);
    } catch (e) {
      setNotes([]);
      setError(e instanceof Error ? e.message : String(e));
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

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TodaySection
            overdue={overdue}
            today={today}
            upcoming={upcoming}
            loading={todayLoading}
            error={todayError}
            onPressTask={(noteId) => navigation.navigate("NoteDetail", { id: noteId })}
            onComplete={completeTodayTask}
            onUndo={reopenTodayTask}
          />
        }
        ListEmptyComponent={
          error ? (
            <View style={styles.errorState}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                testID="notes-list-retry"
                onPress={() => search(query)}
                style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
              >
                <Text style={styles.retryBtnText}>Δοκιμάστε ξανά</Text>
              </Pressable>
            </View>
          ) : query ? (
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
            testID="notes-list-row"
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.navigate("NoteDetail", { id: item.id })}
            onLongPress={() =>
              Alert.alert("Διαγραφή σημείωσης;", undefined, [
                { text: "Άκυρο", style: "cancel" },
                {
                  text: "Διαγραφή",
                  style: "destructive",
                  onPress: async () => {
                    const reminders = await notesRepository.delete(item.id);
                    for (const r of reminders) {
                      if (r.calendarEventId) await removeReminder(r.calendarEventId);
                      if (r.notificationId) await cancelReminder(r.notificationId);
                    }
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
  errorState: {
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: spacing.xxl,
  },
  errorText: {
    ...type.body,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryBtn: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryBtnPressed: { opacity: 0.72 },
  retryBtnText: {
    ...type.buttonSmall,
    color: colors.textSecondary,
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
});
