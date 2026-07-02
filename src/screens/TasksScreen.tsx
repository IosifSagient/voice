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
      <TaskFilterBar value={filter} onChange={setFilter} />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.spinner} color={colors.accent} />
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
  screen: { flex: 1, backgroundColor: colors.bgBase },
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
    color: colors.error,
    textAlign: "center",
    marginTop: 80,
    paddingHorizontal: spacing.xxl,
  },
});
