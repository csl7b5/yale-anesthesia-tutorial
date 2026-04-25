// Supabase Edge Function: AI scenario variation generator via TensorZero gateway.
// Deploy: `supabase functions deploy scenario-generator`
// Instructor-only: requires authenticated user with role = 'instructor'.
//
// POST body:
//   { motif_id: string, seed?: { age_range?: string, sex?: string, asa?: string } }
//
// Returns:
//   { scenario_json, patient_summary, generated_scenario_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Effect profiles: maps profile key → numeric simulation parameters.
// These are the ONLY values that drive the physics simulation.
// Instructors never touch these — only developers modify this map.
const EFFECT_PROFILES: Record<string, {
  patient?: Record<string, number>;
  vit?: Record<string, number>;
  vent?: Record<string, number>;
  overlaySpeed?: number;
}> = {
  // Cardiovascular
  moderate_hypotension:    { patient: { cardiacOutput: 0.55 }, vit: { sysBP: -28, diaBP: -16, hr: 15  }, overlaySpeed: 0.018 },
  severe_hypotension:      { patient: { cardiacOutput: 0.38 }, vit: { sysBP: -50, diaBP: -28, hr: 24  }, overlaySpeed: 0.025 },
  worsened_hypotension:    { patient: { cardiacOutput: 0.42 }, vit: { sysBP: -14, diaBP: -8,  hr: 8   }, overlaySpeed: 0.015 },
  vasopressor_response:    { patient: { cardiacOutput: 0.78 }, vit: { sysBP: 38,  diaBP: 22,  hr: -5  }, overlaySpeed: 0.030 },
  partial_recovery:        { patient: { cardiacOutput: 0.68 }, vit: { sysBP: 18,  diaBP: 10,  hr: -3  }, overlaySpeed: 0.022 },
  full_recovery:           { patient: { cardiacOutput: 0.88 }, vit: { sysBP: 28,  diaBP: 14,  hr: -8  }, overlaySpeed: 0.028 },
  no_change:               { patient: {},                      vit: {},                                    overlaySpeed: 0.018 },
  // Respiratory
  moderate_bronchospasm:   { patient: { resistance: 25, compliance: 35 }, vit: { spo2: -4  }, overlaySpeed: 0.018 },
  severe_bronchospasm:     { patient: { resistance: 38, compliance: 28 }, vit: { spo2: -10 }, overlaySpeed: 0.025 },
  bronchodilator_response: { patient: { resistance: 14, compliance: 42 }, vit: { spo2: 6   }, overlaySpeed: 0.030 },
  partial_bronch_recovery: { patient: { resistance: 18, compliance: 38 }, vit: { spo2: 3   }, overlaySpeed: 0.022 },
  full_bronch_recovery:    { patient: { resistance: 8,  compliance: 48 }, vit: { spo2: 8   }, overlaySpeed: 0.028 },
  // Anaphylaxis
  anaphylaxis_onset:       { patient: { cardiacOutput: 0.38, resistance: 28, compliance: 30 }, vit: { sysBP: -55, diaBP: -30, hr: 35, spo2: -8 }, overlaySpeed: 0.025 },
  anaphylaxis_worsening:   { patient: { cardiacOutput: 0.25, resistance: 36, compliance: 24 }, vit: { sysBP: -20, diaBP: -12, hr: 15, spo2: -6 }, overlaySpeed: 0.028 },
  epi_response:            { patient: { cardiacOutput: 0.72, resistance: 16, compliance: 38 }, vit: { sysBP: 50,  diaBP: 28,  hr: -10, spo2: 5 }, overlaySpeed: 0.035 },
  partial_anaphylaxis_recovery: { patient: { cardiacOutput: 0.62 }, vit: { sysBP: 20, diaBP: 10 }, overlaySpeed: 0.022 },
  full_anaphylaxis_recovery:    { patient: { cardiacOutput: 0.85, resistance: 8, compliance: 45 }, vit: { sysBP: 30, diaBP: 16, hr: -15, spo2: 8 }, overlaySpeed: 0.030 },
};

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

    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return jsonErr(500, "server_config", "Generator unavailable.");
    }

    // Auth: validate JWT and check instructor role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !user) {
      return jsonErr(401, "unauthorized", "Invalid session.");
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.role !== "instructor") {
      return jsonErr(403, "forbidden", "Instructor access required.");
    }

    const body = await req.json().catch(() => ({}));
    const { motif_id, seed = {} } = body;
    if (!motif_id) return jsonErr(400, "bad_request", "motif_id is required.");

    // Fetch the motif template
    const { data: motif, error: motifErr } = await admin
      .from("scenario_motifs")
      .select("*")
      .eq("id", motif_id)
      .eq("is_active", true)
      .single();
    if (motifErr || !motif) {
      return jsonErr(404, "not_found", "Motif not found or inactive.");
    }

    // Build the generator prompt
    const systemPrompt = buildGeneratorSystem();
    const userMessage  = buildGeneratorUser(motif, seed);

    const tzRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage  },
        ],
        max_tokens: 2500,
        temperature: 0.85,
      }),
    });

    const tzJson = await tzRes.json();
    if (!tzRes.ok) {
      console.error(tzJson);
      return jsonErr(502, "ai_error", tzJson?.error?.message || "AI service error.");
    }

    const rawContent = String(tzJson.choices?.[0]?.message?.content ?? "").trim();
    if (!rawContent) return jsonErr(502, "ai_error", "Empty AI response.");

    // Parse the AI-generated JSON block
    let aiOutput: PatientContext;
    try {
      const jsonMatch = rawContent.match(/```json\s*([\s\S]+?)\s*```/) ||
                        rawContent.match(/(\{[\s\S]+\})/);
      aiOutput = JSON.parse(jsonMatch ? jsonMatch[1] : rawContent);
    } catch {
      console.error("Failed to parse AI output:", rawContent);
      return jsonErr(502, "parse_error", "AI returned invalid JSON. Please retry.");
    }

    // Build the full scenario JSON by merging AI patient context + motif step templates + effect profiles
    const scenarioJson = buildScenarioJson(motif, aiOutput);
    const patientSummary = buildPatientSummary(aiOutput);

    // Persist to generated_scenarios (pending approval)
    const { data: inserted, error: insErr } = await admin
      .from("generated_scenarios")
      .insert({
        motif_id:        motif_id,
        scenario_json:   scenarioJson,
        patient_summary: patientSummary,
        created_by:      user.id,
        status:          "pending",
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      console.error(insErr);
      return jsonErr(500, "db_error", "Failed to save generated scenario.");
    }

    return new Response(
      JSON.stringify({
        scenario_json:         scenarioJson,
        patient_summary:       patientSummary,
        generated_scenario_id: inserted.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return jsonErr(500, "server", "Unexpected error.");
  }
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface PatientContext {
  patient_name: string;
  age: number;
  sex: string;
  weight_kg: number;
  asa_class: string;
  pmh: string[];
  psh: string[];
  allergies: string[];
  procedure: string;
  anesthesia_type: string;
  baseline_physiology: {
    cardiacOutput?: number;
    compliance?: number;
    resistance?: number;
    co2Prod?: number;
  };
  step_narratives: Array<{
    clue: string;
    question: string;
    choices: Array<{ text: string }>;
    resolution?: string;
  }>;
}

interface MotifRow {
  id: string;
  title: string;
  summary: string;
  badge: string;
  badge_color: string;
  physiology_constraints: Record<string, [number, number]>;
  steps: Array<{
    phase: string;
    clinical_domain: string;
    narrative_prompt: string;
    effect_profile: string;
    choices: Array<{ label: string; clinical_action: string; is_correct: boolean; effect_profile: string }>;
  }>;
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildGeneratorSystem(): string {
  return (
    "You are a medical education content generator specializing in anesthesiology simulation. " +
    "Given a scenario motif (clinical archetype) and step templates, generate a realistic and " +
    "medically accurate patient case. The patient should be a plausible real patient — " +
    "include specific demographics, relevant past medical and surgical history, and a realistic " +
    "procedure that makes the scenario clinically coherent. " +
    "Write all narrative text (clues and questions) in the voice of an attending presenting a case " +
    "to a student — concrete, specific, and educational. " +
    "IMPORTANT: Return ONLY valid JSON matching the exact schema provided. No extra text, no markdown prose outside the JSON block."
  );
}

function buildGeneratorUser(motif: MotifRow, seed: Record<string, string>): string {
  const constraints = Object.entries(motif.physiology_constraints)
    .map(([k, [lo, hi]]) => `  ${k}: ${lo}–${hi}`)
    .join("\n");

  const stepDescriptions = motif.steps.map((s, i) =>
    `Step ${i + 1} (${s.phase}): ${s.narrative_prompt}\n` +
    `  Choices:\n` +
    s.choices.map(c => `    ${c.label}. ${c.clinical_action} (correct: ${c.is_correct})`).join("\n")
  ).join("\n\n");

  const seedHints = Object.keys(seed).length > 0
    ? `\nSeed preferences: ${JSON.stringify(seed)}`
    : "";

  return `Generate a patient case for the following scenario motif:

MOTIF: ${motif.title}
CLINICAL DOMAIN: ${motif.steps[0]?.clinical_domain ?? "general"}
${seedHints}

PHYSIOLOGY CONSTRAINTS (baseline_physiology values MUST be within these ranges):
${constraints}

STEP TEMPLATES (${motif.steps.length} steps):
${stepDescriptions}

Return a JSON object with EXACTLY this structure (no extra fields, no comments):

\`\`\`json
{
  "patient_name": "First Last",
  "age": <integer 18-85>,
  "sex": "Male" or "Female",
  "weight_kg": <integer 50-130>,
  "asa_class": "ASA I" through "ASA IV",
  "pmh": ["condition1", "condition2"],
  "psh": ["surgery1"],
  "allergies": ["allergen1"] or ["NKDA"],
  "procedure": "specific surgical procedure name",
  "anesthesia_type": "General ETT" or "General LMA" or "GETA with arterial line",
  "baseline_physiology": {
    "cardiacOutput": <number within constraints>,
    "compliance": <number within constraints>,
    "resistance": <number within constraints>,
    "co2Prod": <number within constraints>
  },
  "step_narratives": [
    {
      "clue": "2-3 sentence monitor finding description using specific numbers (HR, BP, SpO2, EtCO2, airway pressures as appropriate for this scenario)",
      "question": "1 concise clinical question asking what to do next",
      "choices": [
        { "text": "A. <specific action>" },
        { "text": "B. <specific action>" },
        { "text": "C. <specific action>" },
        { "text": "D. <specific action>" }
      ],
      "resolution": "optional: only for the last step — 2-3 sentence teaching summary"
    }
  ]
}
\`\`\`

RULES:
- Use specific vital sign numbers that match this patient's physiology and the motif's progression
- PMH should include conditions that are clinically plausible risk factors for this scenario
- The procedure should logically lead to this complication
- Narrative text should feel like a real case, not a textbook exercise
- baseline_physiology values MUST fall within the physiology_constraints ranges above`;
}

// ─── Scenario JSON builder ───────────────────────────────────────────────────

function buildScenarioJson(motif: MotifRow, ai: PatientContext) {
  const patientHeader =
    `${ai.patient_name} — ${ai.age}yo ${ai.sex}, ${ai.weight_kg}kg, ${ai.asa_class}. ` +
    `PMH: ${ai.pmh.join(", ") || "None"}. ` +
    `Allergies: ${ai.allergies.join(", ")}. ` +
    `Procedure: ${ai.procedure} (${ai.anesthesia_type}).`;

  const steps = motif.steps.map((stepTemplate, idx) => {
    const narrative = ai.step_narratives[idx];
    const isLast = idx === motif.steps.length - 1;

    const choices = stepTemplate.choices.map((ct, ci) => {
      const effects = resolveEffectProfile(ct.effect_profile);
      return {
        text:      narrative?.choices?.[ci]?.text ?? `${ct.label}. ${ct.clinical_action}`,
        isCorrect: ct.is_correct,
        feedback:  ct.is_correct
          ? `Correct. ${ct.clinical_action} is the appropriate intervention for this presentation.`
          : `Incorrect. ${ct.clinical_action} is not the best choice here. Consider the underlying physiology.`,
        effects,
      };
    });

    return {
      phase:    stepTemplate.phase,
      clue:     (narrative?.clue ?? stepTemplate.narrative_prompt).slice(0, 600),
      question: (narrative?.question ?? `What is the most appropriate next step?`),
      choices,
    };
  });

  // Use motif physiology constraints midpoints as initial patient values
  const pc = motif.physiology_constraints;
  const mid = (range: [number, number]) => Math.round((range[0] + range[1]) / 2 * 100) / 100;

  return {
    id:             `generated_${Date.now()}`,
    title:          `${motif.title}: ${ai.patient_name}`,
    badge:          motif.badge,
    badgeColor:     motif.badge_color,
    summary:        patientHeader,
    patientContext: patientHeader,
    isGenerated:    true,
    initialPatient: {
      cardiacOutput: ai.baseline_physiology.cardiacOutput ?? (pc.cardiacOutput ? mid(pc.cardiacOutput as [number,number]) : 0.8),
      compliance:    ai.baseline_physiology.compliance    ?? (pc.compliance    ? mid(pc.compliance    as [number,number]) : 50),
      resistance:    ai.baseline_physiology.resistance    ?? (pc.resistance    ? mid(pc.resistance    as [number,number]) : 5),
      co2Prod:       ai.baseline_physiology.co2Prod       ?? (pc.co2Prod       ? mid(pc.co2Prod       as [number,number]) : 200),
      leak:          0,
    },
    initialVitals: {
      hr: 72, sysBP: 118, diaBP: 72, spo2: 99, bis: 45, etco2Display: 36,
    },
    initialVent: {
      tv: 480, rr: 12, peep: 5, fio2: 50, ti: 1.0, mode: "VC",
    },
    steps,
    resolution: ai.step_narratives[ai.step_narratives.length - 1]?.resolution ??
      `${motif.title} scenario complete. Review the key physiologic principles and management steps.`,
  };
}

function resolveEffectProfile(profileKey: string) {
  const profile = EFFECT_PROFILES[profileKey] ?? {};
  return {
    patient:      profile.patient      ?? {},
    vit:          profile.vit          ?? {},
    vent:         profile.vent         ?? {},
    overlaySpeed: profile.overlaySpeed ?? 0.018,
  };
}

function buildPatientSummary(ai: PatientContext): string {
  return `${ai.patient_name}, ${ai.age}yo ${ai.sex} — ${ai.procedure}. ` +
         `PMH: ${ai.pmh.slice(0, 3).join(", ") || "None"}. ` +
         `ASA ${ai.asa_class}.`;
}

function jsonErr(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
