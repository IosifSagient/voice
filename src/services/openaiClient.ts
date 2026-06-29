const BASE_URL = "https://api.openai.com/v1";
const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

function requireKey(): string {
  if (!OPENAI_KEY) throw new Error("Missing EXPO_PUBLIC_OPENAI_API_KEY");
  return OPENAI_KEY;
}

// POST a JSON body and return the parsed response.
export async function openaiPost(path: string, body: object): Promise<unknown> {
  const key = requireKey();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

// POST a multipart FormData body (used for audio uploads) and return the parsed response.
export async function openaiUpload(path: string, form: FormData): Promise<unknown> {
  const key = requireKey();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}
