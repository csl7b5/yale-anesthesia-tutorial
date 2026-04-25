// Supabase Edge Function: authenticated AI chat calling OpenAI directly.
// Deploy: `supabase functions deploy ai-chat`
// Secrets required (Dashboard → Edge Functions → Secrets):
//   OPENAI_API_KEY — OpenAI secret key (sk-...)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PYXIS =
  "You are an expert anesthesia attending physician helping a 3rd–4th year medical student on their " +
  "anesthesia clerkship. Answer questions about anesthesia medications, airway management, " +
  "IV access, lines, monitoring, equipment, ventilator settings and waveforms, vitals, and perioperative concepts. Be concise and " +
  "practical — like a knowledgeable senior resident explaining things at the bedside. " +
  "Keep answers to 3–5 sentences unless asked to elaborate. Always note that responses are " +
  "for educational purposes only and that clinical decisions must follow institutional protocols.";

const SYSTEM_VENT =
  "You are an expert anesthesia attending physician helping a 3rd–4th year medical student on their " +
  "anesthesia clerkship. Answer questions about mechanical ventilation, respiratory physiology, " +
  "ventilator settings (tidal volume, PEEP, FiO₂, I:E ratio), pressure-volume loops, waveform " +
  "interpretation, and perioperative critical care. Be concise and practical — like a knowledgeable " +
  "senior resident explaining things at the bedside. Keep answers to 3–5 sentences unless asked to " +
  "elaborate. Always note that responses are for educational purposes only.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonErr(401, "unauthorized", "Sign in required.");
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return jsonErr(401, "unauthorized", "Sign in required.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("OPENAI_API_KEY missing");
      return jsonErr(500, "server_config", "Assistant unavailable.");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Must pass the JWT explicitly — getUser() with no args does not validate the header in Edge.
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser(jwt);
    if (userErr || !user) {
      console.error("getUser", userErr?.message);
      return jsonErr(401, "unauthorized", userErr?.message || "Invalid or expired session.");
    }

    const body = await req.json().catch(() => ({}));
    const page = body.page === "ventilator" ? "ventilator" : "pyxis";
    const raw = Array.isArray(body.messages) ? body.messages : [];

    const sanitized = raw
      .filter(
        (m: { role?: string; content?: string }) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .slice(-24)
      .map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content.slice(0, 8000),
      }));

    if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== "user") {
      return jsonErr(400, "bad_request", "Send at least one user message.");
    }

    const lastUser = sanitized[sanitized.length - 1].content;
    const system = page === "ventilator" ? SYSTEM_VENT : SYSTEM_PYXIS;

    const admin = createClient(supabaseUrl, serviceKey);

    const startUtc = new Date();
    startUtc.setUTCHours(0, 0, 0, 0);

    const { count, error: cntErr } = await admin
      .from("chat_queries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", startUtc.toISOString());

    if (cntErr) {
      console.error(cntErr);
      return jsonErr(500, "server", "Could not check usage limit.");
    }

    if ((count ?? 0) >= 15) {
      return jsonErr(
        429,
        "rate_limit",
        "Daily limit of 15 questions reached. Try again tomorrow (UTC).",
      );
    }

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: system }, ...sanitized],
        max_tokens: 520,
        temperature: 0.6,
      }),
    });

    const oaiJson = await oaiRes.json();
    if (!oaiRes.ok) {
      console.error(oaiJson);
      const msg =
        oaiJson?.error?.message || "The AI service returned an error.";
      return jsonErr(502, "openai", msg);
    }

    const reply = String(oaiJson.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) {
      return jsonErr(502, "openai", "Empty response.");
    }

    const { error: insErr } = await admin.from("chat_queries").insert({
      user_id: user.id,
      page,
      question: lastUser.slice(0, 4000),
      response: reply.slice(0, 8000),
      model: "gpt-4o-mini",
    });

    if (insErr) {
      console.error(insErr);
    }

    const usedAfter = (count ?? 0) + 1;
    const remainingToday = Math.max(0, 15 - usedAfter);

    return new Response(
      JSON.stringify({
        reply,
        remaining_today: remainingToday,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return jsonErr(500, "server", "Unexpected error.");
  }
});

function jsonErr(
  status: number,
  code: string,
  message: string,
): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
