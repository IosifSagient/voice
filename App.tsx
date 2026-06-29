import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, Text, StyleSheet } from "react-native";
import { NotesListScreen } from "./src/screens/NotesListScreen";
import { RecordScreen } from "./src/screens/RecordScreen";
import { NoteDetailScreen } from "./src/screens/NoteDetailScreen";
import { colors, radii, type } from "./src/config/theme";
import { useEffect } from "react";
import { initDb } from "./src/db";

export type RootStackParamList = {
  NotesList: undefined;
  Record: undefined;
  NoteDetail: { id: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.bgBase },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: "600" as const, color: colors.textPrimary },
  headerShadowVisible: false,
};

export default function App() {
  useEffect(() => {
    initDb().catch(console.error);
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="NotesList"
        screenOptions={screenOptions}
      >
        <Stack.Screen
          name="NotesList"
          component={NotesListScreen}
          options={({ navigation }) => ({
            title: "VoiceNote",
            headerRight: () => (
              <Pressable
                onPress={() => navigation.navigate("Record")}
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
  },
  fabPressed: { opacity: 0.72 },
  fabText: {
    ...type.buttonSmall,
    color: colors.bgBase,
  },
});
