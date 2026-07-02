import { useEffect } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { NotesListScreen } from "./src/screens/NotesListScreen";
import { RecordScreen } from "./src/screens/RecordScreen";
import { NoteDetailScreen } from "./src/screens/NoteDetailScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { colors, radii, type } from "./src/config/theme";
import { initDb } from "./src/db";

export type RootStackParamList = {
  Main: undefined;
  Record: undefined;
  NoteDetail: { id: string };
};

export type MainTabParamList = {
  NotesList: undefined;
  Tasks: undefined;
  Chat: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const sharedHeaderOptions = {
  headerStyle: { backgroundColor: colors.bgBase },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: "600" as const, color: colors.textPrimary },
  headerShadowVisible: false,
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        ...sharedHeaderOptions,
        tabBarStyle: {
          backgroundColor: colors.bgBase,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="NotesList"
        component={NotesListScreen}
        options={({ navigation }) => ({
          title: "VoiceNote",
          tabBarLabel: "Σημειώσεις",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
          headerRight: () => (
            <Pressable
              onPress={() =>
                navigation
                  .getParent<NativeStackNavigationProp<RootStackParamList>>()
                  ?.navigate("Record")
              }
              style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            >
              <Text style={styles.fabText}>+ Εγγραφή</Text>
            </Pressable>
          ),
        })}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: "Εργασίες",
          tabBarLabel: "Εργασίες",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-done-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: "Chat",
          tabBarLabel: "Chat",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    initDb().catch(console.error);
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={sharedHeaderOptions}>
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Record"
          component={RecordScreen}
          options={{ title: "Νέα σημείωση" }}
        />
        <Stack.Screen
          name="NoteDetail"
          component={NoteDetailScreen}
          options={{ title: "" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  fab: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    marginRight: 4,
  },
  fabPressed: { opacity: 0.72 },
  fabText: {
    ...type.buttonSmall,
    color: colors.bgBase,
  },
});
