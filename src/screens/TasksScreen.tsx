import { useState } from "react";
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList, MainTabParamList } from "../../App";
import type { TaskFilter } from "../types/tasks";
import { useTasks } from "../hooks/useTasks";
import { TaskFilterBar } from "../components/TaskFilterBar";
import { TaskRow } from "../components/TaskRow";
import { TasksEmptyState } from "../components/TasksEmptyState";
import { colors, spacing, type } from "../config/theme";

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, "Tasks">,
  NativeStackScreenProps<RootStackParamList>
>;

export function TasksScreen({ navigation }: Props) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const { tasks, loading, error, toggle, remove } = useTasks(filter);

  return (
    <View style={styles.screen}>
      <View style={styles.headerBand}>
        <TaskFilterBar value={filter} onChange={setFilter} />
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.spinner} color={colors.light.accent} />
            ) : (
              <TasksEmptyState filter={filter} />
            )
          }
          renderItem={({ item }) => (
            <TaskRow
              task={item}
              onPress={() => navigation.navigate("NoteDetail", { id: item.noteId })}
              onToggle={toggle}
              onDelete={remove}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.bg },
  // Matches NotesListScreen's searchBand: same gradientHeader token (flat
  // fill with the darker top-of-gradient stop, not a second LinearGradient
  // — see that file's comment) and the same paddingTop/paddingBottom.
  // paddingHorizontal is left to TaskFilterBar's own contentContainerStyle
  // since this band wraps a horizontally-scrolling pill row, not a
  // full-width input — matching that padding here would double-inset it.
  headerBand: {
    backgroundColor: colors.light.gradientHeader[0],
    paddingTop: spacing.md,
    paddingBottom: spacing.base,
  },
  list: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.listBottomInset,
  },
  spinner: {
    marginTop: 80,
  },
  error: {
    ...type.body,
    color: colors.light.destructive,
    textAlign: "center",
    marginTop: 80,
    paddingHorizontal: spacing.xxl,
  },
});
