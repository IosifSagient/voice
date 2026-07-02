import { supabase } from '../lib/supabase';

const PROXY_BASE = 'https://ccebaccebrzcvhgcypvz.supabase.co/functions/v1/openai-proxy';

const PATH_MAP: Record<string, string> = {
  '/audio/transcriptions': '/transcribe',
  '/chat/completions':     '/chat',
};

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session — cannot call proxy');
  return token;
}

export async function openaiPost(path: string, body: object): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${PROXY_BASE}${PATH_MAP[path] ?? path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Proxy ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function openaiUpload(path: string, form: FormData): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${PROXY_BASE}${PATH_MAP[path] ?? path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Proxy ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}
