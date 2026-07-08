import { useEffect } from "react";
import { Pressable, Text, StyleSheet, View, ActivityIndicator } from "react-native";
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
import { AuthScreen } from "./src/screens/AuthScreen";
import { LockScreen } from "./src/screens/LockScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { colors, radii, type, spacing } from "./src/config/theme";
import { initDb } from "./src/db";
import { useAuth } from "./src/hooks/useAuth";
import { useAppLock } from "./src/hooks/useAppLock";
import { useCalendarSettings } from "./src/hooks/useCalendarSettings";

export type RootStackParamList = {
  Main: undefined;
  Record: undefined;
  NoteDetail: { id: string };
  Settings: undefined;
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
          headerLeft: () => (
            <Pressable
              onPress={() =>
                navigation
                  .getParent<NativeStackNavigationProp<RootStackParamList>>()
                  ?.navigate("Settings")
              }
              style={styles.signOutBtn}
            >
              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
            </Pressable>
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
  const { session, loading, signOut } = useAuth();
  const { locked, lockAvailable, lockEnabled, unlock, setLockEnabled } =
    useAppLock(!!session);
  const {
    loading: calendarLoading,
    permissionGranted: calendarPermissionGranted,
    canAskAgain: calendarCanAskAgain,
    calendars,
    selectedId: selectedCalendarId,
    rePickNeeded: calendarRePickNeeded,
    requestPermission: onRequestCalendarPermission,
    selectCalendar: onSelectCalendar,
  } = useCalendarSettings();

  useEffect(() => {
    initDb().catch(console.error);
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (locked) {
    return <LockScreen onUnlock={unlock} />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={sharedHeaderOptions}>
        <Stack.Screen name="Main" options={{ headerShown: false }}>
          {() => <MainTabs />}
        </Stack.Screen>
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
        <Stack.Screen
          name="Settings"
          options={{ title: "Ρυθμίσεις" }}
        >
          {() => (
            <SettingsScreen
              lockAvailable={lockAvailable}
              lockEnabled={lockEnabled}
              onSetLockEnabled={setLockEnabled}
              onSignOut={signOut}
              calendarLoading={calendarLoading}
              calendarPermissionGranted={calendarPermissionGranted}
              calendarCanAskAgain={calendarCanAskAgain}
              calendars={calendars}
              selectedCalendarId={selectedCalendarId}
              calendarRePickNeeded={calendarRePickNeeded}
              onRequestCalendarPermission={onRequestCalendarPermission}
              onSelectCalendar={onSelectCalendar}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: "center",
    justifyContent: "center",
  },
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
  signOutBtn: {
    marginLeft: spacing.base,
    padding: spacing.xs,
  },
});
