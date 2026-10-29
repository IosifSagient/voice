import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";

export type MicrophonePermissionState = {
  granted: boolean;
  // False once the OS has already determined the permission (denied) and
  // won't show its prompt again — the user must be sent to Settings instead
  // of re-requesting. Same contract as calendar.ts / notifications.ts.
  canAskAgain: boolean;
};

// Checks current permission without prompting — mirrors
// services/calendar.ts / services/notifications.ts.
export async function getPermissionStatus(): Promise<MicrophonePermissionState> {
  const { status, canAskAgain } = await getRecordingPermissionsAsync();
  return { granted: status === "granted", canAskAgain };
}

export async function ensurePermission(): Promise<boolean> {
  const { status } = await requestRecordingPermissionsAsync();
  return status === "granted";
}
