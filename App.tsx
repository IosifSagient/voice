import { useEffect } from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
} from "react-native";
import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
// Registers the foreground notification handler at module scope (R5) —
// importing this once, here, before anything else runs is enough.
import "./src/services/notifications";

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
import { useNotificationSettings } from "./src/hooks/useNotificationSettings";
import { navigationRef } from "./src/lib/navigationRef";
import { handleInitialNotification } from "./src/services/notifications";
import type { RootStackParamList, MainTabParamList } from "./src/types/navigation";

export type { RootStackParamList, MainTabParamList };

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const sharedHeaderOptions = {
  headerStyle: { backgroundColor: colors.bgBase },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: "600" as const, color: colors.textPrimary },
  headerShadowVisible: false,
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["heylisa://"],
  config: {
    screens: {
      Record: "record",
      Main: {
        screens: {
          NotesList: "notes",
          Tasks: "tasks",
          Chat: "chat",
        },
      },
      NoteDetail: "note/:id",
      Settings: "settings",
    },
  },
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
            <Ionicons
              name="document-text-outline"
              size={size}
              color={color}
            />
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
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() =>
                navigation
                  .getParent<NativeStackNavigationProp<RootStackParamList>>()
                  ?.navigate("Record")
              }
              style={({ pressed }) => [
                styles.fab,
                pressed && styles.fabPressed,
              ]}
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
            <Ionicons
              name="checkmark-done-outline"
              size={size}
              color={color}
            />
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
            <Ionicons
              name="chatbubble-outline"
              size={size}
              color={color}
            />
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
  const {
    loading: notificationLoading,
    permissionGranted: notificationPermissionGranted,
    canAskAgain: notificationCanAskAgain,
    requestPermission: onRequestNotificationPermission,
  } = useNotificationSettings();

  useEffect(() => {
    initDb().catch(console.error);
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator
          size="large"
          color={colors.accent}
        />
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
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        handleInitialNotification();
      }}
    >
      <Stack.Navigator
        screenOptions={sharedHeaderOptions}
        initialRouteName="Record"
      >
        <Stack.Screen
          name="Main"
          options={{ headerShown: false }}
        >
          {() => <MainTabs />}
        </Stack.Screen>
        <Stack.Screen
          name="Record"
          component={RecordScreen}
          options={({ navigation }) => ({
            title: "",
            headerLeft: () => (
              <Pressable
                onPress={() => navigation.navigate("Main")}
                accessibilityRole="button"
                accessibilityLabel="Προβολή σημειώσεων"
                hitSlop={{
                  top: spacing.sm,
                  bottom: spacing.sm,
                  left: spacing.sm,
                  right: spacing.sm,
                }}
                style={({ pressed }) => [
                  styles.notesBtn,
                  pressed && styles.fabPressed,
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={colors.textPrimary}
                />
                <Text
                  style={styles.notesBtnText}
                  numberOfLines={1}
                >
                  Σημειώσεις
                </Text>
              </Pressable>
            ),
          })}
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
              notificationLoading={notificationLoading}
              notificationPermissionGranted={notificationPermissionGranted}
              notificationCanAskAgain={notificationCanAskAgain}
              onRequestNotificationPermission={onRequestNotificationPermission}
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
  notesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    height: spacing.xxl,
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesBtnText: {
    ...type.buttonSmall,
    color: colors.textPrimary,
  },
});
