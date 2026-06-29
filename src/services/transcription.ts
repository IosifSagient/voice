import { TRANSCRIPTION_MODEL } from "../config/models";

const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

export async function transcribe(uri: string): Promise<string> {
  if (!OPENAI_KEY) throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY");
  const form = new FormData();
  form.append("file", { uri, name: "recording.m4a", type: "audio/m4a" } as any);
  form.append("model", TRANSCRIPTION_MODEL);
  form.append("language", "el");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcribe ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.text as string;
}
