import { useEffect } from "react";
import { Pressable, StyleSheet, View, ActivityIndicator } from "react-native";
import {
  NavigationContainer,
  type LinkingOptions,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Literata_400Regular,
  Literata_500Medium,
  Literata_600SemiBold,
} from "@expo-google-fonts/literata";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
// Registers the foreground notification handler at module scope (R5) —
// importing this once, here, before anything else runs is enough.
import "./src/services/notifications";

// Keep the native splash up until the custom fonts below are loaded, so
// there's no flash of system-font text before Literata/Inter swap in.
SplashScreen.preventAutoHideAsync();

import { NotesListScreen } from "./src/screens/NotesListScreen";
import { RecordScreen } from "./src/screens/RecordScreen";
import { NoteDetailScreen } from "./src/screens/NoteDetailScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { LockScreen } from "./src/screens/LockScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { AnimatedTabIcon } from "./src/components/AnimatedTabIcon";
import { colors, radii, spacing, type } from "./src/config/theme";
import { initDb } from "./src/db";
import { useAuth } from "./src/hooks/useAuth";
import { useAppLock } from "./src/hooks/useAppLock";
import { useCalendarSettings } from "./src/hooks/useCalendarSettings";
import { useNotificationSettings } from "./src/hooks/useNotificationSettings";
import { navigationRef } from "./src/lib/navigationRef";
import { handleInitialNotification } from "./src/services/notifications";
import type {
  RootStackParamList,
  MainTabParamList,
} from "./src/types/navigation";

export type { RootStackParamList, MainTabParamList };

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const sharedHeaderOptions = {
  headerBackground: () => (
    <LinearGradient
      colors={colors.gradientHeader}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  ),
  headerTintColor: colors.white,
  headerTitleStyle: {
    fontFamily: "Inter_600SemiBold",
    color: colors.white,
  },
  headerShadowVisible: false,
};

// "Ask Lisa" (NotesList) and the NoteDetail title get the serif display
// treatment; every other header keeps sharedHeaderOptions' Inter title above.
const serifHeaderTitleStyle = {
  fontFamily: type.displaySerif.fontFamily,
  fontSize: type.displaySerif.fontSize,
  color: colors.white,
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["asklisa://"],
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
          backgroundColor: colors.bgCard,
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
          title: "Ask Lisa",
          headerTitleStyle: serifHeaderTitleStyle,
          tabBarLabel: "Σημειώσεις",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons
                name="document-text-outline"
                size={size}
                color={color}
              />
            </AnimatedTabIcon>
          ),
          headerLeft: () => (
            <Pressable
              onPress={() =>
                navigation
                  .getParent<NativeStackNavigationProp<RootStackParamList>>()
                  ?.navigate("Settings")
              }
              style={styles.avatarBtn}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.white}
              />
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
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons
                name="checkmark-done-outline"
                size={size}
                color={color}
              />
            </AnimatedTabIcon>
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: "Chat",
          tabBarLabel: "Chat",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Ionicons
                name="chatbubble-outline"
                size={size}
                color={color}
              />
            </AnimatedTabIcon>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Literata_400Regular,
    Literata_500Medium,
    Literata_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
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

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Keep the native splash covering the screen until fonts are ready —
  // avoids any flash of system-font text.
  if (!fontsLoaded) return null;

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
    return (
      <AuthScreen />
    );
  }

  if (locked) {
    return (
      <LockScreen onUnlock={unlock} />
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        handleInitialNotification();
      }}
    >
      <Stack.Navigator screenOptions={sharedHeaderOptions}>
        <Stack.Screen
          name="Main"
          options={{ headerShown: false }}
        >
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
          options={{ title: "", headerTitleStyle: serifHeaderTitleStyle }}
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
    backgroundColor: colors.inverseBg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBtn: {
    marginLeft: spacing.base,
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },
});
