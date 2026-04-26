// Supabase Edge Function: AI scenario coaching and debrief calling OpenAI directly.
// Deploy: `supabase functions deploy scenario-coach`
// Secrets required (Dashboard → Edge Functions → Secrets):
//   OPENAI_API_KEY — OpenAI secret key (sk-...)
//
// POST body shape:
//   mode: "coaching"  — called after each step answer
//   mode: "debrief"   — called when all steps are complete
//
// Coaching input:
//   { mode, scenario_title, patient_context, step_clue, question,
//     choice_text, is_correct, hardcoded_feedback, step_history }
//
// Debrief input:
//   { mode, scenario_title, patient_context, attempt_id,
//     steps: [{ question, choice_text, is_correct, domain }] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Shared rate limit pool: coaching + debrief share a 10-call/day cap
const DAILY_LIMIT = 10;

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("OPENAI_API_KEY missing");
      return jsonErr(500, "server_config", "AI coaching unavailable.");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !user) {
      return jsonErr(401, "unauthorized", userErr?.message || "Invalid session.");
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode;
    if (mode !== "coaching" && mode !== "debrief") {
      return jsonErr(400, "bad_request", 'mode must be "coaching" or "debrief".');
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Rate limit check (shared pool across coaching + debrief)
    const startUtc = new Date();
    startUtc.setUTCHours(0, 0, 0, 0);
    const { count, error: cntErr } = await admin
      .from("chat_queries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("page", "scenario_coach")
      .gte("created_at", startUtc.toISOString());
    if (cntErr) {
      console.error(cntErr);
      return jsonErr(500, "server", "Could not check usage limit.");
    }
    if ((count ?? 0) >= DAILY_LIMIT) {
      return jsonErr(429, "rate_limit", "Daily AI coaching limit reached. Try again tomorrow.");
    }

    let systemPrompt: string;
    let userMessage: string;
    let maxTokens: number;

    if (mode === "coaching") {
      systemPrompt = buildCoachingSystem();
      userMessage = buildCoachingUser(body);
      maxTokens = 350;
    } else {
      systemPrompt = buildDebriefSystem();
      userMessage = buildDebriefUser(body);
      maxTokens = 900;
    }

    const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage },
        ],
        max_tokens: maxTokens,
        temperature: 0.5,
      }),
    });

    const tzJson = await oaiRes.json();
    if (!oaiRes.ok) {
      console.error(tzJson);
      return jsonErr(502, "ai_error", tzJson?.error?.message || "AI service error.");
    }

    const reply = String(tzJson.choices?.[0]?.message?.content ?? "").trim();
    if (!reply) return jsonErr(502, "ai_error", "Empty AI response.");

    // Log to chat_queries for rate limiting and instructor visibility
    await admin.from("chat_queries").insert({
      user_id: user.id,
      page: "scenario_coach",
      question: userMessage.slice(0, 4000),
      response: reply.slice(0, 8000),
      model: "gpt-4o-mini",
    });

    // For debrief mode: also persist to ai_outputs so instructors can review
    if (mode === "debrief" && body.attempt_id) {
      const debriefJson = {
        narrative: reply,
        generated_at: new Date().toISOString(),
      };
      await admin.from("ai_outputs").insert({
        attempt_id: body.attempt_id,
        source: "llm",
        debrief_json: debriefJson,
        weak_domains: extractWeakDomains(body.steps ?? []),
      });
    }

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return jsonErr(500, "server", "Unexpected error.");
  }
});

// ─── Prompt builders ────────────────────────────────────────────────────────

function buildCoachingSystem(): string {
  return (
    "You are a clinical anesthesiology educator coaching a 3rd–4th year medical student " +
    "through a ventilator and perioperative simulation. The student just answered a question. " +
    "Provide brief, targeted coaching in 2–3 sentences that: (1) explains the key physiology " +
    "behind the correct answer in practical terms, (2) connects it specifically to this patient's " +
    "presentation, and (3) highlights one memorable clinical pearl. " +
    "Be direct and concise — like a senior resident at the bedside. " +
    "Do NOT repeat the feedback text verbatim. Do NOT say 'correct' or 'incorrect' — the UI already shows that. " +
    "Always end with a single concrete takeaway the student can apply in a real OR."
  );
}

function buildCoachingUser(body: Record<string, unknown>): string {
  const correct = body.is_correct ? "CORRECT" : "INCORRECT";
  const history = Array.isArray(body.step_history) && body.step_history.length > 0
    ? `\nPrevious steps in this scenario:\n${(body.step_history as Array<{question: string; correct: boolean}>)
        .map((s, i) => `  Step ${i + 1}: ${s.correct ? "✓" : "✗"} ${s.question}`)
        .join("\n")}`
    : "";

  return [
    `Scenario: ${body.scenario_title ?? "Unknown"}`,
    body.patient_context ? `Patient context: ${body.patient_context}` : "",
    `\nClinical situation: ${body.step_clue ?? ""}`,
    `\nQuestion: ${body.question ?? ""}`,
    `Student answered (${correct}): ${body.choice_text ?? ""}`,
    `Standard feedback shown: ${body.hardcoded_feedback ?? ""}`,
    history,
    "\nProvide your brief coaching comment now.",
  ].filter(Boolean).join("\n");
}

function buildDebriefSystem(): string {
  return (
    "You are a clinical anesthesiology educator writing an end-of-scenario debrief for a " +
    "3rd–4th year medical student. Review the student's performance across all scenario steps " +
    "and write a structured debrief (4–6 sentences) that: " +
    "(1) acknowledges overall performance honestly, " +
    "(2) highlights the 1–2 strongest clinical reasoning moments, " +
    "(3) identifies the most important area for improvement with a specific physiologic explanation, " +
    "(4) suggests one concrete next step for self-directed learning. " +
    "Be encouraging but honest. Write in second person ('You demonstrated...', 'You missed...'). " +
    "This is for educational purposes only."
  );
}

function buildDebriefUser(body: Record<string, unknown>): string {
  const steps = Array.isArray(body.steps) ? body.steps as Array<{
    question: string; choice_text: string; is_correct: boolean; domain?: string;
  }> : [];
  const correct = steps.filter(s => s.is_correct).length;
  const total = steps.length;

  const stepSummary = steps.map((s, i) =>
    `Step ${i + 1} [${s.domain ?? "general"}] ${s.is_correct ? "✓" : "✗"}: ` +
    `Q: ${s.question} | Answered: ${s.choice_text}`
  ).join("\n");

  return [
    `Scenario: ${body.scenario_title ?? "Unknown"}`,
    body.patient_context ? `Patient: ${body.patient_context}` : "",
    `\nPerformance: ${correct}/${total} steps correct`,
    `\nStep-by-step breakdown:\n${stepSummary}`,
    "\nWrite the debrief now.",
  ].filter(Boolean).join("\n");
}

// Identify domains where the student answered incorrectly
function extractWeakDomains(
  steps: Array<{ is_correct?: boolean; domain?: string }>
): string[] {
  const weakSet = new Set<string>();
  for (const s of steps) {
    if (!s.is_correct && s.domain) weakSet.add(s.domain);
  }
  return Array.from(weakSet);
}

function jsonErr(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
