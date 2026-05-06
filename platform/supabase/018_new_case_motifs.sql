-- 018_new_case_motifs.sql
-- Migration to seed the 6 new hardcoded cases into the scenario_motifs table

INSERT INTO public.scenario_motifs (title, clinical_domain, summary, learning_objectives, badge, badge_color, physiology_constraints, steps, allowed_effect_profiles)
VALUES 
-- 4. Right Mainstem Intubation After Positioning
(
  'Pressure After Positioning',
  'airway',
  'Soon after intubation and patient positioning, oxygenation drifts down while airway pressures rise. The capnogram is still present, but the ventilator and chest exam no longer look symmetric.',
  '{}'::text[],
  'Airway',
  '#3399ff',
  '{"cardiacOutput": [0.4, 1.0], "compliance": [20, 60], "resistance": [5, 20], "co2Prod": [150, 200]}'::jsonb,
  '[
    {
      "phase": "Deterioration",
      "clinical_domain": "general",
      "narrative_prompt": "Peak pressure is 36 cmH₂O, plateau is 32 cmH₂O, SpO₂ is 92% and falling, EtCO₂ is 43 mmHg, and chest rise is asymmetric after positioning. What is the most appropriate next step?",
      "effect_profile": "right_mainstem_after_turn_base_0",
      "choices": [
        {"label": "A", "clinical_action": "Increase PEEP from 5 to 12 cmH₂O and continue the case", "is_correct": false, "effect_profile": "right_mainstem_after_turn_choice_0_A"},
        {"label": "B", "clinical_action": "Switch to 100% FiO₂, verify tube depth, and withdraw the ETT until bilateral breath sounds and symmetric chest rise return", "is_correct": true, "effect_profile": "right_mainstem_after_turn_choice_0_B"},
        {"label": "C", "clinical_action": "Give albuterol through the ETT for presumed bronchospasm", "is_correct": false, "effect_profile": "right_mainstem_after_turn_choice_0_C"},
        {"label": "D", "clinical_action": "Increase respiratory rate to 20 to wash out the rising EtCO₂", "is_correct": false, "effect_profile": "right_mainstem_after_turn_choice_0_D"}
      ]
    },
    {
      "phase": "Resolution",
      "clinical_domain": "general",
      "narrative_prompt": "Bilateral ventilation is restored and pressures have improved, but SpO₂ is 96% and still recovering. What is the best next step to complete the rescue and prevent recurrence?",
      "effect_profile": "right_mainstem_after_turn_base_1",
      "choices": [
        {"label": "A", "clinical_action": "Advance the tube 2 cm to improve the cuff seal", "is_correct": false, "effect_profile": "right_mainstem_after_turn_choice_1_A"},
        {"label": "B", "clinical_action": "Perform a gentle recruitment maneuver, set PEEP 7–8 cmH₂O for alveolar stability, then recheck tube depth after every table movement", "is_correct": true, "effect_profile": "right_mainstem_after_turn_choice_1_B"},
        {"label": "C", "clinical_action": "Leave FiO₂ at 100% and make no other changes since pressures improved", "is_correct": false, "effect_profile": "right_mainstem_after_turn_choice_1_C"},
        {"label": "D", "clinical_action": "Reduce PEEP to 0 to lower peak airway pressure", "is_correct": false, "effect_profile": "right_mainstem_after_turn_choice_1_D"}
      ]
    }
  ]'::jsonb,
  '[]'::jsonb
),

-- 5. Crash During Insufflation
(
  'Crash During Insufflation',
  'emergency',
  'During laparoscopic insufflation, the arterial line and capnogram change abruptly within seconds despite completely unchanged ventilator settings.',
  '{}'::text[],
  'Emergency',
  '#ff3333',
  '{"cardiacOutput": [0.3, 1.0], "compliance": [40, 60], "resistance": [5, 15], "co2Prod": [150, 200]}'::jsonb,
  '[
    {
      "phase": "Deterioration",
      "clinical_domain": "general",
      "narrative_prompt": "EtCO₂ has abruptly dropped to 16 mmHg during insufflation. BP is 72/38, SpO₂ is 90%, and airway pressures are completely unchanged. What is the most urgent next action?",
      "effect_profile": "laparoscopy_etco2_crash_base_0",
      "choices": [
        {"label": "A", "clinical_action": "Increase respiratory rate to 20 to correct the low EtCO₂", "is_correct": false, "effect_profile": "laparoscopy_etco2_crash_choice_0_A"},
        {"label": "B", "clinical_action": "Tell the surgeon to stop insufflation and desufflate immediately; switch to 100% FiO₂ and support circulation", "is_correct": true, "effect_profile": "laparoscopy_etco2_crash_choice_0_B"},
        {"label": "C", "clinical_action": "Deepen anesthesia — the tachycardia suggests light anesthesia", "is_correct": false, "effect_profile": "laparoscopy_etco2_crash_choice_0_C"},
        {"label": "D", "clinical_action": "Treat for bronchospasm with albuterol and hand ventilation", "is_correct": false, "effect_profile": "laparoscopy_etco2_crash_choice_0_D"}
      ]
    },
    {
      "phase": "Intervention",
      "clinical_domain": "general",
      "narrative_prompt": "The capnogram and SpO₂ are improving after desufflation, but hypotension and persistent low EtCO₂ continue. What is the best next management priority?",
      "effect_profile": "laparoscopy_etco2_crash_base_1",
      "choices": [
        {"label": "A", "clinical_action": "Restart insufflation at the same pressure — oxygenation has improved", "is_correct": false, "effect_profile": "laparoscopy_etco2_crash_choice_1_A"},
        {"label": "B", "clinical_action": "Give metoprolol to control the compensatory tachycardia", "is_correct": false, "effect_profile": "laparoscopy_etco2_crash_choice_1_B"},
        {"label": "C", "clinical_action": "Maintain 100% O₂, give fluid and vasopressor support, and consider left lateral Trendelenburg positioning to move gas away from the right ventricular outflow tract", "is_correct": true, "effect_profile": "laparoscopy_etco2_crash_choice_1_C"},
        {"label": "D", "clinical_action": "Increase PEEP to 15 cmH₂O to improve oxygenation further", "is_correct": false, "effect_profile": "laparoscopy_etco2_crash_choice_1_D"}
      ]
    }
  ]'::jsonb,
  '[]'::jsonb
),

-- 6. Tension Pneumothorax
(
  'Narrow Pressure Gap',
  'emergency',
  'Mid-case, the ventilator suddenly struggles against a stiff chest while the arterial line collapses. The capnogram is still present but EtCO₂ is falling and each breath is delivering less useful gas exchange.',
  '{}'::text[],
  'Emergency',
  '#ff3333',
  '{"cardiacOutput": [0.3, 0.9], "compliance": [15, 60], "resistance": [5, 15], "co2Prod": [150, 200]}'::jsonb,
  '[
    {
      "phase": "Deterioration",
      "clinical_domain": "general",
      "narrative_prompt": "Peak pressure is 42 cmH₂O, plateau is 40 cmH₂O, SpO₂ is 88%, EtCO₂ is falling, and BP is 78/44 with asymmetric right-sided chest movement. What is the most urgent next step?",
      "effect_profile": "intraop_tension_pneumothorax_base_0",
      "choices": [
        {"label": "A", "clinical_action": "Give albuterol for the high peak airway pressure", "is_correct": false, "effect_profile": "intraop_tension_pneumothorax_choice_0_A"},
        {"label": "B", "clinical_action": "Switch to 100% FiO₂, call for help, and immediately decompress the right chest (needle decompression → tube thoracostomy)", "is_correct": true, "effect_profile": "intraop_tension_pneumothorax_choice_0_B"},
        {"label": "C", "clinical_action": "Suction the ETT for a possible mucus plug", "is_correct": false, "effect_profile": "intraop_tension_pneumothorax_choice_0_C"},
        {"label": "D", "clinical_action": "Increase PEEP to 12 cmH₂O to splint the lung open", "is_correct": false, "effect_profile": "intraop_tension_pneumothorax_choice_0_D"}
      ]
    },
    {
      "phase": "Resolution",
      "clinical_domain": "general",
      "narrative_prompt": "The acute physiology has improved after decompression. What is the best next step to fully stabilize the patient and prevent recurrence?",
      "effect_profile": "intraop_tension_pneumothorax_base_1",
      "choices": [
        {"label": "A", "clinical_action": "Clamp the decompression catheter now that BP has recovered", "is_correct": false, "effect_profile": "intraop_tension_pneumothorax_choice_1_A"},
        {"label": "B", "clinical_action": "Confirm a functioning chest tube, avoid nitrous oxide, maintain lung-protective pressures, and recheck with ultrasound or CXR when stable", "is_correct": true, "effect_profile": "intraop_tension_pneumothorax_choice_1_B"},
        {"label": "C", "clinical_action": "Return to the original large tidal volume — pressures have normalized", "is_correct": false, "effect_profile": "intraop_tension_pneumothorax_choice_1_C"},
        {"label": "D", "clinical_action": "Treat the event as resolved and continue without informing the surgical team", "is_correct": false, "effect_profile": "intraop_tension_pneumothorax_choice_1_D"}
      ]
    }
  ]'::jsonb,
  '[]'::jsonb
),

-- 7. COPD Auto-PEEP
(
  'Stacked Breaths',
  'airway',
  'A patient with COPD is mechanically ventilated after induction. Oxygenation is acceptable, but the pressure, flow, and capnogram waveforms show each breath arriving before the last one is fully finished.',
  '{}'::text[],
  'Airway',
  '#3399ff',
  '{"cardiacOutput": [0.6, 1.0], "compliance": [40, 80], "resistance": [15, 40], "co2Prod": [150, 200]}'::jsonb,
  '[
    {
      "phase": "Deterioration",
      "clinical_domain": "general",
      "narrative_prompt": "Peak pressure is 44 cmH₂O, plateau is 22 cmH₂O, EtCO₂ is 52 mmHg, and expiratory flow does not reach baseline before the next breath. What ventilator change best addresses this physiology?",
      "effect_profile": "copd_auto_peep_base_0",
      "choices": [
        {"label": "A", "clinical_action": "Increase respiratory rate to 22 to lower the EtCO₂", "is_correct": false, "effect_profile": "copd_auto_peep_choice_0_A"},
        {"label": "B", "clinical_action": "Reduce respiratory rate to 10–11, shorten inspiratory time to 0.75 s, and allow more time for exhalation", "is_correct": true, "effect_profile": "copd_auto_peep_choice_0_B"},
        {"label": "C", "clinical_action": "Increase tidal volume to improve alveolar ventilation", "is_correct": false, "effect_profile": "copd_auto_peep_choice_0_C"},
        {"label": "D", "clinical_action": "Increase PEEP to 12 cmH₂O because the patient has obstructive lung disease", "is_correct": false, "effect_profile": "copd_auto_peep_choice_0_D"}
      ]
    },
    {
      "phase": "Intervention",
      "clinical_domain": "general",
      "narrative_prompt": "Ventilator timing has improved, but the capnogram still shows expiratory obstruction. What is the best next optimization?",
      "effect_profile": "copd_auto_peep_base_1",
      "choices": [
        {"label": "A", "clinical_action": "Give an inhaled bronchodilator and ensure adequate anesthetic depth while maintaining the long expiratory time", "is_correct": true, "effect_profile": "copd_auto_peep_choice_1_A"},
        {"label": "B", "clinical_action": "Return respiratory rate to 16 because blood pressure has improved", "is_correct": false, "effect_profile": "copd_auto_peep_choice_1_B"},
        {"label": "C", "clinical_action": "Perform an aggressive recruitment maneuver to improve the capnogram", "is_correct": false, "effect_profile": "copd_auto_peep_choice_1_C"},
        {"label": "D", "clinical_action": "Ignore the waveform — SpO₂ is 96% so the patient is fine", "is_correct": false, "effect_profile": "copd_auto_peep_choice_1_D"}
      ]
    }
  ]'::jsonb,
  '[]'::jsonb
),

-- 8. ARDS Driving Pressure
(
  'Plateau Pressure Check',
  'respiratory',
  'An intubated patient has worsening oxygenation on volume-control ventilation. The peak pressure is high, but the plateau pressure tells the more important story about lung injury risk.',
  '{}'::text[],
  'Respiratory',
  '#0d9488',
  '{"cardiacOutput": [0.6, 1.0], "compliance": [15, 35], "resistance": [5, 15], "co2Prod": [160, 220]}'::jsonb,
  '[
    {
      "phase": "Deterioration",
      "clinical_domain": "general",
      "narrative_prompt": "Peak pressure is 39 cmH₂O, plateau is 35 cmH₂O, PEEP is 8 cmH₂O, and SpO₂ is 91%. What ventilator change best reduces ventilator-induced lung injury risk?",
      "effect_profile": "ards_driving_pressure_base_0",
      "choices": [
        {"label": "A", "clinical_action": "Increase tidal volume to improve oxygenation", "is_correct": false, "effect_profile": "ards_driving_pressure_choice_0_A"},
        {"label": "B", "clinical_action": "Reduce tidal volume toward 6 mL/kg IBW and reassess plateau pressure", "is_correct": true, "effect_profile": "ards_driving_pressure_choice_0_B"},
        {"label": "C", "clinical_action": "Give albuterol for the elevated peak pressure", "is_correct": false, "effect_profile": "ards_driving_pressure_choice_0_C"},
        {"label": "D", "clinical_action": "Increase respiratory rate to normalize EtCO₂ before changing tidal volume", "is_correct": false, "effect_profile": "ards_driving_pressure_choice_0_D"}
      ]
    },
    {
      "phase": "Intervention",
      "clinical_domain": "general",
      "narrative_prompt": "Driving pressure has improved, but oxygenation remains marginal at SpO₂ 89%. What is the best next step?",
      "effect_profile": "ards_driving_pressure_base_1",
      "choices": [
        {"label": "A", "clinical_action": "Return to the original tidal volume because SpO₂ is lower", "is_correct": false, "effect_profile": "ards_driving_pressure_choice_1_A"},
        {"label": "B", "clinical_action": "Increase PEEP cautiously while monitoring plateau pressure, driving pressure, oxygenation, and blood pressure", "is_correct": true, "effect_profile": "ards_driving_pressure_choice_1_B"},
        {"label": "C", "clinical_action": "Hyperventilate aggressively to get EtCO₂ below 35 mmHg", "is_correct": false, "effect_profile": "ards_driving_pressure_choice_1_C"},
        {"label": "D", "clinical_action": "Lower PEEP to reduce mean airway pressure", "is_correct": false, "effect_profile": "ards_driving_pressure_choice_1_D"}
      ]
    }
  ]'::jsonb,
  '[]'::jsonb
),

-- 9. PEEP And Preload
(
  'PEEP And Preload',
  'hemodynamics',
  'Oxygenation improves after a recruitment maneuver and PEEP increase, but the arterial line and capnogram suggest the price may be reduced venous return. Better SpO₂ does not always mean better physiology.',
  '{}'::text[],
  'Hemodynamics',
  '#ff6060',
  '{"cardiacOutput": [0.4, 1.0], "compliance": [25, 45], "resistance": [5, 15], "co2Prod": [150, 190]}'::jsonb,
  '[
    {
      "phase": "Deterioration",
      "clinical_domain": "general",
      "narrative_prompt": "SpO₂ has improved to 97%, but BP is 88/50 and EtCO₂ has gradually fallen to 27 mmHg after PEEP was increased to 14 cmH₂O. What is the best next step?",
      "effect_profile": "peep_preload_balance_base_0",
      "choices": [
        {"label": "A", "clinical_action": "Increase PEEP further — oxygenation improved so more PEEP will help more", "is_correct": false, "effect_profile": "peep_preload_balance_choice_0_A"},
        {"label": "B", "clinical_action": "Reduce PEEP to the lowest level that preserves oxygenation, and support preload and vascular tone", "is_correct": true, "effect_profile": "peep_preload_balance_choice_0_B"},
        {"label": "C", "clinical_action": "Increase respiratory rate — EtCO₂ is low and needs to be treated", "is_correct": false, "effect_profile": "peep_preload_balance_choice_0_C"},
        {"label": "D", "clinical_action": "Deepen volatile anesthetic — hypotension and tachycardia suggest the patient is light", "is_correct": false, "effect_profile": "peep_preload_balance_choice_0_D"}
      ]
    },
    {
      "phase": "Resolution",
      "clinical_domain": "general",
      "narrative_prompt": "Oxygenation is slightly lower but acceptable, while EtCO₂ and blood pressure have normalized. What is the best ongoing ventilator strategy?",
      "effect_profile": "peep_preload_balance_base_1",
      "choices": [
        {"label": "A", "clinical_action": "Keep this individualized PEEP level, monitor driving pressure and hemodynamics, and titrate FiO₂ down as tolerated", "is_correct": true, "effect_profile": "peep_preload_balance_choice_1_A"},
        {"label": "B", "clinical_action": "Return to PEEP 14 because the previous SpO₂ was higher", "is_correct": false, "effect_profile": "peep_preload_balance_choice_1_B"},
        {"label": "C", "clinical_action": "Reduce PEEP to 0 — blood pressure improved when PEEP was lowered so lower is always better", "is_correct": false, "effect_profile": "peep_preload_balance_choice_1_C"},
        {"label": "D", "clinical_action": "Increase tidal volume to improve both oxygenation and blood pressure simultaneously", "is_correct": false, "effect_profile": "peep_preload_balance_choice_1_D"}
      ]
    }
  ]'::jsonb,
  '[]'::jsonb
);
