import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import { ensurePermission, getPermissionStatus } from "../services/microphone";

export type RecorderState = {
  isRecording: boolean;
  elapsed: number;
  uri: string | null;
  permissionGranted: boolean;
  // False once the OS has already determined the permission and won't
  // re-prompt — caller should send the user to Settings instead.
  canAskAgain: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  requestPermission: () => Promise<void>;
};

// Encapsulates all expo-audio concerns: permission, audio mode, recorder lifecycle,
// and the elapsed-time ticker. Swap the audio library by editing only this file.
export function useRecorder(): RecorderState {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [elapsed, setElapsed] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);

  const refreshPermission = useCallback(async () => {
    const status = await getPermissionStatus();
    setPermissionGranted(status.granted);
    setCanAskAgain(status.canAskAgain);
    if (status.granted) {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    }
  }, []);

  useEffect(() => {
    (async () => {
      await ensurePermission();
      await refreshPermission();
    })();
  }, [refreshPermission]);

  // The mic may have been enabled in Settings while the app was away, and a
  // deep link can return to this same mounted screen rather than remount it.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      refreshPermission().catch((err) => {
        console.error("[useRecorder:refreshPermission] failed to refresh permission", err);
      });
    });
    return () => sub.remove();
  }, [refreshPermission]);

  const requestPermission = useCallback(async () => {
    await ensurePermission();
    await refreshPermission();
  }, [refreshPermission]);

  useEffect(() => {
    if (!recorderState.isRecording) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recorderState.isRecording]);

  const start = async () => {
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stop = async () => {
    await recorder.stop();
  };

  return {
    isRecording: recorderState.isRecording,
    elapsed,
    uri: recorder.uri ?? null,
    permissionGranted,
    canAskAgain,
    start,
    stop,
    requestPermission,
  };
}
