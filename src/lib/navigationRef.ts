import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "../types/navigation";

// Lets code outside the component tree (the notification response handler in
// services/notifications.ts) navigate without a `navigation` prop. App.tsx
// attaches this via NavigationContainer's `ref`. Always check `isReady()`
// before navigating — it's false until the container has mounted.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
