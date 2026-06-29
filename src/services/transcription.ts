import { TRANSCRIPTION_MODEL } from "../config/models";
import { openaiUpload } from "./openaiClient";

export async function transcribe(uri: string): Promise<string> {
  const form = new FormData();
  form.append("file", { uri, name: "recording.m4a", type: "audio/m4a" } as any);
  form.append("model", TRANSCRIPTION_MODEL);
  form.append("language", "el");

  const data = await openaiUpload("/audio/transcriptions", form) as { text: string };
  return data.text;
}
