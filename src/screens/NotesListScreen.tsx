import { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  RefreshControl,
  StyleSheet,
} from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue, withTiming } from "react-native-reanimated";
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
import { RecordFab } from "../components/RecordFab";
import { NoteListRow } from "../components/NoteListRow";
import { NoteListSectionHeader } from "../components/NoteListSectionHeader";
import { AnimatedSearchInput } from "../components/AnimatedSearchInput";
import { TagFilterButton } from "../components/TagFilterButton";
import { TagFilterSheet } from "../components/TagFilterSheet";
import { duration } from "../config/motion";
import { useReducedMotionPreference } from "../lib/useReducedMotionPreference";
import { groupNotesByDate } from "../lib/groupNotesByDate";
import { deriveTagChips, noteMatchesChip } from "../lib/noteTags";
import type { Note } from "../types/note";
import type { TagChip } from "../types/tags";
import { colors, spacing, type, radii } from "../config/theme";

// How many cards, counted from the top, participate in the initial-mount /
// pull-to-refresh stagger (ANIMATION_SPEC.md NOTES (HOME): "first ~8 visible
// cards animate with stagger").
const STAGGERED_CARD_COUNT = 8;

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "NotesList">,
  NativeStackScreenProps<RootStackParamList>
>;

export function NotesListScreen({ navigation }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  // Stable source for the tag filter bar's chip set — populated only from an
  // unfiltered, un-searched fetch (getAllNotes), never from a search result,
  // so the chips on offer don't appear/disappear as the user types into
  // search or narrows by chip (LOCKED DECISION 4).
  const [allNotesSnapshot, setAllNotesSnapshot] = useState<Note[]>([]);
  const [activeChip, setActiveChip] = useState<TagChip | null>(null);
  // View-level only (which modal is open) — the sheet's own onSelect still
  // goes straight to setActiveChip above; this just tracks whether it's shown.
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const reducedMotion = useReducedMotionPreference();
  const fabVisible = useSharedValue(1);
  const lastScrollY = useSharedValue(0);

  // Entry-stagger bookkeeping (ANIMATION_SPEC.md NOTES (HOME)). Refs, not
  // state — recomputed synchronously right before setNotes so the render
  // that picks them up is the same one the new `notes` array lands in;
  // turning them into state would just cause a redundant extra render.
  //
  // - entryPlanRef: note.id -> stagger delay (ms) for rows that should
  //   animate in on THIS notes update. A row absent from the map (the
  //   common case) gets `entryDelay: null` and never animates, no matter
  //   when FlatList actually mounts it — including a lazy mount triggered
  //   by scrolling further down an otherwise-unchanged list.
  // - seenNoteIdsRef: every id ever placed into `notes`, used to tell "a
  //   genuinely new note" (not in this set) apart from "a note re-fetched
  //   after search/focus that was already visible before."
  // - entryTokenRef: bumped on every recompute. Passed to NoteListRow as
  //   `entryToken` — the numeric replay signal, since `entryDelay` itself
  //   can legitimately repeat across two separate stagger runs.
  const entryPlanRef = useRef<Map<string, number>>(new Map());
  const seenNoteIdsRef = useRef<Set<string>>(new Set());
  const hasMountedRef = useRef(false);
  const entryTokenRef = useRef(0);

  const computeEntryPlan = (newNotes: Note[], forceRestagger: boolean) => {
    const plan = new Map<string, number>();
    if (forceRestagger || !hasMountedRef.current) {
      // Initial mount, or an explicit pull-to-refresh: stagger the first
      // STAGGERED_CARD_COUNT cards regardless of whether their ids were
      // already seen.
      newNotes.slice(0, STAGGERED_CARD_COUNT).forEach((n, i) => {
        plan.set(n.id, i * duration.cardEntryStagger);
      });
    } else {
      // Incremental update (search-as-you-type, focus refetch): only a
      // note id that has never appeared before gets an entrance, and it
      // gets one with no stagger — a single new card, not a re-stagger of
      // the whole list.
      for (const n of newNotes) {
        if (!seenNoteIdsRef.current.has(n.id)) plan.set(n.id, 0);
      }
    }
    for (const n of newNotes) seenNoteIdsRef.current.add(n.id);
    hasMountedRef.current = true;
    entryPlanRef.current = plan;
    entryTokenRef.current += 1;
  };

  // ANIMATION_SPEC.md NOTES > FAB scroll show/hide. Drives a shared value
  // directly from the UI-thread scroll handler — no React state, so scroll
  // never triggers a re-render (per working-agreement note A). Reduced
  // motion: never touch fabVisible, so it stays at its initial 1 (FAB stays
  // visible, per the C1-established reduced-motion pattern).
  const scrollHandler = useAnimatedScrollHandler((event) => {
    if (reducedMotion) return;
    const y = event.contentOffset.y;
    const delta = y - lastScrollY.value;
    if (delta > 8 && y > 40) {
      fabVisible.value = withTiming(0, { duration: duration.fabScrollToggle });
    } else if (delta < -8 || y <= 40) {
      fabVisible.value = withTiming(1, { duration: duration.fabScrollToggle });
    }
    lastScrollY.value = y;
  });

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
          const results = await notesRepository.listAll();
          computeEntryPlan(results, false);
          setNotes(results);
          setAllNotesSnapshot(results);
          setError(null);
        } catch (e) {
          setNotes([]);
          setError(e instanceof Error ? e.message : String(e));
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      refreshTodayTasks();
    }, [refreshTodayTasks]),
  );

  const search = async (q: string) => {
    try {
      const isSearching = q.trim().length > 0;
      const results = isSearching
        ? await notesRepository.search(q.trim())
        : await notesRepository.listAll();
      computeEntryPlan(results, false);
      setNotes(results);
      // Same reasoning as onRefresh: only a full unfiltered fetch (empty
      // query) is a valid resync point for the chip snapshot — e.g. after
      // clearing the search box, or after search(query) re-runs post-delete.
      if (!isSearching) setAllNotesSnapshot(results);
      setError(null);
    } catch (e) {
      setNotes([]);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Chip set for the filter bar: derived from the stable all-notes snapshot
  // (never from `notes`, which can be a search result) so it doesn't
  // appear/disappear as the user types or filters.
  const chips = useMemo(() => deriveTagChips(allNotesSnapshot), [allNotesSnapshot]);

  // The active chip narrows whatever `notes` already holds (search result OR
  // full fetch) — it intersects, it never replaces the fetch or re-queries
  // the DB (LOCKED DECISION 1).
  const filteredNotes = useMemo(
    () => (activeChip ? notes.filter((n) => noteMatchesChip(n, activeChip)) : notes),
    [notes, activeChip],
  );

  // Interleaves date-section headers into the flat FlatList data array.
  // Recomputed whenever the filtered notes change (a new fetch/search/refresh,
  // or the active chip) — the entry-stagger bookkeeping above (entryPlanRef
  // etc.) still operates on the fetched `notes` directly, keyed by note id,
  // so header rows never shift stagger positions or consume a stagger slot.
  const groupedItems = useMemo(() => groupNotesByDate(filteredNotes), [filteredNotes]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const isSearching = query.trim().length > 0;
      const results = isSearching
        ? await notesRepository.search(query.trim())
        : await notesRepository.listAll();
      computeEntryPlan(results, true); // forceRestagger: pull-to-refresh always re-plays the stagger
      setNotes(results);
      // The chip snapshot only refreshes here when `results` IS the full
      // unfiltered set (not searching) — reusing it avoids a second query.
      // Refreshing mid-search leaves the snapshot as of the last full fetch,
      // per LOCKED DECISION 4 (chips must not shift while the user searches).
      if (!isSearching) setAllNotesSnapshot(results);
      setError(null);
      refreshTodayTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setRefreshing(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.searchBand}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <AnimatedSearchInput
              placeholder="Αναζήτηση…"
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                search(t);
              }}
              returnKeyType="search"
            />
          </View>
          {chips.length > 0 && (
            <TagFilterButton activeChip={activeChip} onPress={() => setFilterSheetOpen(true)} />
          )}
        </View>
      </View>

      {chips.length > 0 && (
        <TagFilterSheet
          visible={filterSheetOpen}
          chips={chips}
          activeChip={activeChip}
          onSelect={(chip) => {
            setActiveChip(chip);
            setFilterSheetOpen(false);
          }}
          onCancel={() => setFilterSheetOpen(false)}
        />
      )}

      <Animated.FlatList
        style={styles.flatlist}
        data={groupedItems}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.light.accent}
          />
        }
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
          ) : query || activeChip ? (
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
        renderItem={({ item }) =>
          item.type === "header" ? (
            <NoteListSectionHeader label={item.label} />
          ) : (
            <NoteListRow
              note={item.note}
              entryDelay={entryPlanRef.current.get(item.note.id) ?? null}
              entryToken={entryTokenRef.current}
              onPress={() => navigation.navigate("NoteDetail", { id: item.note.id })}
              onLongPress={() =>
                Alert.alert("Διαγραφή σημείωσης;", undefined, [
                  { text: "Άκυρο", style: "cancel" },
                  {
                    text: "Διαγραφή",
                    style: "destructive",
                    onPress: async () => {
                      const reminders = await notesRepository.delete(item.note.id);
                      for (const r of reminders) {
                        if (r.calendarEventId) await removeReminder(r.calendarEventId);
                        if (r.notificationId) await cancelReminder(r.notificationId);
                      }
                      search(query);
                    },
                  },
                ])
              }
            />
          )
        }
      />

      <RecordFab
        onPress={() => navigation.navigate("Record")}
        visible={fabVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.bg },
  // Deliberate taste call: fills with the header gradient's darker
  // top-of-header stop rather than its lighter final stop, accepting a
  // visible seam at the header/search-band boundary.
  searchBand: {
    backgroundColor: colors.light.gradientHeader[0],
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
  },
  // TagFilterButton sits inline here, beside the search input, instead of on
  // its own row below the band (increment 3 follow-up) — reclaims that row's
  // vertical space now that the button no longer needs full width.
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
  },
  flatlist: {
    flex: 1,
  },
  list: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: 48,
  },
  emptySearch: {
    ...type.body,
    color: colors.light.textMuted,
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
    color: colors.light.textSecondary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  emptyHint: {
    ...type.meta,
    color: colors.light.textMuted,
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
    color: colors.light.destructive,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryBtn: {
    backgroundColor: colors.light.bgCard,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  retryBtnPressed: { opacity: 0.72 },
  retryBtnText: {
    ...type.buttonSmall,
    color: colors.light.textSecondary,
  },
});
