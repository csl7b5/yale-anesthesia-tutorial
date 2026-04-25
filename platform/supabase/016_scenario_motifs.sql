-- 016: Scenario motif templates — instructor-managed, used by the AI scenario generator.
--
-- A "motif" defines the clinical archetype of a scenario (e.g. post-induction hypotension).
-- Instructors can add, edit, and soft-delete motifs via the instructor dashboard.
-- The AI generator uses the motif to produce new patient cases with fresh demographics
-- and physiology, while the core step structure and choice effects stay fixed here.

create table if not exists public.scenario_motifs (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id) on delete set null,

  -- Display / metadata
  title                   text not null,
  clinical_domain         text not null,  -- e.g. 'cardiovascular', 'respiratory', 'pharmacology'
  summary                 text not null,  -- shown on scenario card; AI fills in patient-specific framing
  learning_objectives     text[] not null default '{}',
  badge                   text not null default 'CASE',
  badge_color             text not null default '#64748b',

  -- Physiological parameter ranges the AI must stay within when generating a case.
  -- Shape: { "cardiacOutput": [min, max], "compliance": [min, max], ... }
  physiology_constraints  jsonb not null default '{}',

  -- Step templates. Each entry has:
  --   phase, clinical_domain, narrative_prompt (fed to AI to generate clue/question text),
  --   effect_profile (key into effect_profiles), choices array with effect_profile per choice.
  -- Shape: [ { phase, clinical_domain, narrative_prompt, effect_profile,
  --            choices: [{ label, clinical_action, is_correct, effect_profile }] } ]
  steps                   jsonb not null default '[]',

  -- Named numeric physics sets (see js/effect-profiles.js for actual values).
  -- Instructors pick a profile name; numeric values are developer-controlled only.
  -- Shape: { "profile_name": true } — just a list of valid profile keys for this motif.
  allowed_effect_profiles jsonb not null default '[]',

  -- Lifecycle
  is_active               boolean not null default true,
  archived_at             timestamptz
);

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger scenario_motifs_updated_at
  before update on public.scenario_motifs
  for each row execute function public.set_updated_at();

-- RLS: instructors can read all active motifs; students can read active motifs too (for selector).
-- Only instructors can insert/update/archive.
alter table public.scenario_motifs enable row level security;

create policy "active motifs visible to authenticated users"
  on public.scenario_motifs for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "instructors can manage motifs"
  on public.scenario_motifs for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'instructor'
    )
  );

-- ─── Seed: three starting motifs ────────────────────────────────────────────
-- These mirror the three existing hardcoded scenarios so the generator has
-- immediate templates to work from.

insert into public.scenario_motifs (
  title, clinical_domain, summary, learning_objectives,
  badge, badge_color, physiology_constraints, steps, allowed_effect_profiles
) values

-- 1. Post-Induction Hypotension
(
  'Post-Induction Hypotension',
  'cardiovascular',
  'A patient develops significant hypotension shortly after induction of general anesthesia.',
  array[
    'Recognize and interpret hemodynamic changes on the arterial line and vital signs monitor',
    'Distinguish vasodilatory from cardiogenic and hypovolemic causes of post-induction hypotension',
    'Select appropriate vasopressor and fluid management strategies',
    'Understand how EtCO₂ reflects cardiac output changes'
  ],
  'HEMO', '#ef4444',
  '{
    "cardiacOutput": [0.40, 0.75],
    "compliance": [35, 65],
    "resistance": [3, 10],
    "co2Prod": [150, 250]
  }'::jsonb,
  '[
    {
      "phase": "Deterioration",
      "clinical_domain": "hemodynamic_monitoring",
      "narrative_prompt": "Patient develops progressive hypotension 3-5 minutes after induction. MAP drops to mid-50s. EtCO2 is lower than expected for the ventilation settings, suggesting reduced cardiac output.",
      "effect_profile": "moderate_hypotension",
      "choices": [
        { "label": "A", "clinical_action": "Increase tidal volume to improve CO2 clearance", "is_correct": false, "effect_profile": "worsened_hypotension" },
        { "label": "B", "clinical_action": "Give vasopressor and assess cause (vasodilation, preload, cardiac)", "is_correct": true,  "effect_profile": "vasopressor_response" },
        { "label": "C", "clinical_action": "Deepen anesthesia to blunt sympathetic response", "is_correct": false, "effect_profile": "worsened_hypotension" },
        { "label": "D", "clinical_action": "Wait and observe for spontaneous resolution", "is_correct": false, "effect_profile": "severe_hypotension" }
      ]
    },
    {
      "phase": "Intervention",
      "clinical_domain": "vasopressor_titration",
      "narrative_prompt": "After initial vasopressor, MAP has improved modestly. The anesthesiologist now needs to determine the underlying cause and optimize further.",
      "effect_profile": "partial_recovery",
      "choices": [
        { "label": "A", "clinical_action": "Give IV fluid bolus and reassess volume status", "is_correct": true,  "effect_profile": "full_recovery" },
        { "label": "B", "clinical_action": "Start norepinephrine infusion immediately", "is_correct": false, "effect_profile": "partial_recovery" },
        { "label": "C", "clinical_action": "Reduce inhalational agent concentration", "is_correct": false, "effect_profile": "partial_recovery" },
        { "label": "D", "clinical_action": "Call for emergency code", "is_correct": false, "effect_profile": "no_change" }
      ]
    }
  ]'::jsonb,
  '["moderate_hypotension","severe_hypotension","worsened_hypotension","vasopressor_response","partial_recovery","full_recovery","no_change"]'::jsonb
),

-- 2. Bronchospasm
(
  'Intraoperative Bronchospasm',
  'respiratory',
  'A patient develops acute bronchospasm during general anesthesia, with rising peak airway pressures and characteristic waveform changes.',
  array[
    'Identify bronchospasm on ventilator waveforms and distinguish from other causes of high peak pressure',
    'Recognize the shark-fin flow pattern and auto-PEEP on capnography',
    'Initiate appropriate pharmacologic treatment (bronchodilators, steroids)',
    'Adjust ventilator settings to allow adequate expiratory time'
  ],
  'RESP', '#f97316',
  '{
    "cardiacOutput": [0.6, 1.0],
    "compliance": [20, 45],
    "resistance": [15, 40],
    "co2Prod": [180, 280]
  }'::jsonb,
  '[
    {
      "phase": "Deterioration",
      "clinical_domain": "airway_pressure",
      "narrative_prompt": "Peak airway pressures begin rising acutely during maintenance. SpO2 starts to fall. The ventilator waveform shows the characteristic shark-fin expiratory flow pattern. EtCO2 is rising.",
      "effect_profile": "moderate_bronchospasm",
      "choices": [
        { "label": "A", "clinical_action": "Increase tidal volume to maintain minute ventilation", "is_correct": false, "effect_profile": "severe_bronchospasm" },
        { "label": "B", "clinical_action": "Administer inhaled bronchodilator (albuterol) via ETT and give IV magnesium", "is_correct": true,  "effect_profile": "bronchodilator_response" },
        { "label": "C", "clinical_action": "Switch to pressure-control ventilation only", "is_correct": false, "effect_profile": "moderate_bronchospasm" },
        { "label": "D", "clinical_action": "Increase respiratory rate to clear CO2", "is_correct": false, "effect_profile": "severe_bronchospasm" }
      ]
    },
    {
      "phase": "Intervention",
      "clinical_domain": "ventilator_management",
      "narrative_prompt": "After bronchodilator treatment, airway pressures are improving. The anesthesiologist now needs to optimize ventilator settings for obstruction.",
      "effect_profile": "partial_bronch_recovery",
      "choices": [
        { "label": "A", "clinical_action": "Decrease respiratory rate and extend I:E ratio to allow full exhalation", "is_correct": true,  "effect_profile": "full_bronch_recovery" },
        { "label": "B", "clinical_action": "Increase PEEP to 10 cmH2O", "is_correct": false, "effect_profile": "moderate_bronchospasm" },
        { "label": "C", "clinical_action": "Increase FiO2 to 100% and maintain current settings", "is_correct": false, "effect_profile": "partial_bronch_recovery" },
        { "label": "D", "clinical_action": "Extubate immediately to relieve obstruction", "is_correct": false, "effect_profile": "severe_bronchospasm" }
      ]
    }
  ]'::jsonb,
  '["moderate_bronchospasm","severe_bronchospasm","bronchodilator_response","partial_bronch_recovery","full_bronch_recovery"]'::jsonb
),

-- 3. Anaphylaxis
(
  'Intraoperative Anaphylaxis',
  'pharmacology',
  'A patient develops signs of anaphylaxis under general anesthesia, presenting with cardiovascular collapse and bronchospasm.',
  array[
    'Recognize the clinical signs of anaphylaxis in the anesthetized patient',
    'Initiate immediate treatment with epinephrine as first-line therapy',
    'Manage concurrent bronchospasm and refractory hypotension',
    'Identify common intraoperative triggers (NMBAs, latex, antibiotics, colloids)'
  ],
  'ANAP', '#8b5cf6',
  '{
    "cardiacOutput": [0.3, 0.65],
    "compliance": [20, 40],
    "resistance": [15, 35],
    "co2Prod": [160, 240]
  }'::jsonb,
  '[
    {
      "phase": "Deterioration",
      "clinical_domain": "anaphylaxis_recognition",
      "narrative_prompt": "Shortly after antibiotic administration (or NMB agent), the patient develops severe hypotension, tachycardia, rising peak airway pressures, and erythematous rash on chest. BP crashes to 50s/30s.",
      "effect_profile": "anaphylaxis_onset",
      "choices": [
        { "label": "A", "clinical_action": "Give diphenhydramine (Benadryl) IV and observe", "is_correct": false, "effect_profile": "anaphylaxis_worsening" },
        { "label": "B", "clinical_action": "Give epinephrine IV (10-100 mcg bolus), stop suspected trigger, call for help", "is_correct": true,  "effect_profile": "epi_response" },
        { "label": "C", "clinical_action": "Increase volatile anesthetic to deepen anesthesia", "is_correct": false, "effect_profile": "anaphylaxis_worsening" },
        { "label": "D", "clinical_action": "Give hydrocortisone and observe for 5 minutes", "is_correct": false, "effect_profile": "anaphylaxis_worsening" }
      ]
    },
    {
      "phase": "Intervention",
      "clinical_domain": "anaphylaxis_management",
      "narrative_prompt": "After epinephrine, MAP has improved to 60s but bronchospasm persists and patient remains tachycardic. Needs ongoing management.",
      "effect_profile": "partial_anaphylaxis_recovery",
      "choices": [
        { "label": "A", "clinical_action": "Start epinephrine infusion, give IV fluids, bronchodilator, and steroids", "is_correct": true,  "effect_profile": "full_anaphylaxis_recovery" },
        { "label": "B", "clinical_action": "Give another antibiotic dose — the first may not have worked", "is_correct": false, "effect_profile": "anaphylaxis_worsening" },
        { "label": "C", "clinical_action": "Stop all medications and wait for spontaneous resolution", "is_correct": false, "effect_profile": "anaphylaxis_worsening" },
        { "label": "D", "clinical_action": "Give phenylephrine only and continue the case", "is_correct": false, "effect_profile": "partial_anaphylaxis_recovery" }
      ]
    }
  ]'::jsonb,
  '["anaphylaxis_onset","anaphylaxis_worsening","epi_response","partial_anaphylaxis_recovery","full_anaphylaxis_recovery"]'::jsonb
);
