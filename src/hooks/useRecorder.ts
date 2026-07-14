import { useEffect, useState } from "react";
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import { Alert } from "react-native";

export type RecorderState = {
  isRecording: boolean;
  elapsed: number;
  uri: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

// Encapsulates all expo-audio concerns: permission, audio mode, recorder lifecycle,
// and the elapsed-time ticker. Swap the audio library by editing only this file.
export function useRecorder(): RecorderState {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!recorderState.isRecording) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recorderState.isRecording]);

  const start = async () => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) {
      Alert.alert("Απαιτείται άδεια", "Δεν επιτράπηκε η πρόσβαση στο μικρόφωνο.");
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
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
    start,
    stop,
  };
}
