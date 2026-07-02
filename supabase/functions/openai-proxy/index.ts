import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Invalid or anon-only token" }, 401);

  if (!OPENAI_API_KEY) return json({ error: "Server missing OPENAI_API_KEY" }, 500);

  const route = new URL(req.url).pathname.split("/").pop();

  if (route === "transcribe") {
    const form = await req.formData();
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    return passthrough(res);
  }

  if (route === "chat") {
    const body = await req.text();
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body,
    });
    return passthrough(res);
  }

  return json({ error: `Unknown route: ${route}` }, 404);
});

function passthrough(res: Response): Response {
  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", res.headers.get("Content-Type") ?? "application/json");
  return new Response(res.body, { status: res.status, headers });
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
