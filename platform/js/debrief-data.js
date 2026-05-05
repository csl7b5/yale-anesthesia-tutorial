/**
 * debrief-data.js — Domain tags, teaching points, and micro-drills per scenario.
 *
 * Each scenario has:
 *   - learningObjectives: what the scenario is designed to teach
 *   - stepDomains: per-step domain tags (matched by step index)
 *   - teachingPoints: domain → array of high-yield points
 *   - drills: domain → array of micro-drill questions
 */
window.DEBRIEF_DATA = {

  hypo: {
    keyStrengths: [
      'Using EtCO₂ trend as an early hemodynamic alarm before SpO₂ changes',
      'Selecting a vasopressor based on mechanism (phenylephrine vs. ephedrine)',
      'Recognizing post-induction hypotension as a common and treatable anesthetic complication',
    ],
    commonPitfalls: [
      'Waiting for SpO₂ to drop before acting — EtCO₂ and arterial line changes are earlier and more sensitive',
      'Treating the blood pressure number without diagnosing the cause (vasodilation vs. hypovolemia vs. cardiac depression)',
      'Deepening anesthesia when the patient is already vasodilated — this worsens hypotension',
    ],
    highYieldPearls: [
      'EtCO₂ falls when cardiac output falls because less CO₂ reaches the alveoli per breath — even with unchanged ventilation.',
      'Volatile agents cause dose-dependent vasodilation and myocardial depression. Post-induction hypotension is predictable.',
      'DO₂ = CO × CaO₂. Normal SpO₂ does not mean adequate oxygen delivery if cardiac output is low.',
      'Phenylephrine raises SVR (α₁ only); ephedrine raises HR and contractility (α/β mixed). Match the drug to the mechanism of hypotension.',
    ],
    learningObjectives: [
      'Recognize post-induction hypotension as a common anesthetic complication',
      'Understand the relationship between cardiac output and EtCO₂',
      'Use EtCO₂ as an early hemodynamic indicator before SpO₂ changes',
    ],
    stepDomains: [
      ['hemodynamics', 'vasopressor_management', 'etco2_interpretation'],
      ['dead_space_physiology', 'etco2_interpretation', 'cardiac_output'],
    ],
    teachingPoints: {
      hemodynamics: [
        'Post-induction hypotension is the most common hemodynamic event after anesthetic induction — volatile agents cause vasodilation and myocardial depression.',
        'MAP below 55 mmHg for sustained periods causes end-organ ischemia. Treat early.',
      ],
      vasopressor_management: [
        'Phenylephrine (pure α₁) raises SVR; ephedrine (mixed α/β) also increases HR and contractility. Choose based on mechanism.',
        'A vasopressor buys time while you investigate the underlying cause: vasodilation, hypovolemia, or cardiac depression.',
      ],
      etco2_interpretation: [
        'EtCO₂ = CO₂ delivered to alveoli by pulmonary blood flow. When cardiac output falls, less CO₂ reaches the lungs per breath, so EtCO₂ falls — even with unchanged ventilation.',
        'A falling EtCO₂ with stable ventilator settings is an early, sensitive hemodynamic alarm — it changes before SpO₂.',
      ],
      dead_space_physiology: [
        'Reduced cardiac output increases alveolar dead space: ventilated alveoli receive less perfusion, so CO₂ exchange is incomplete.',
        'Dead space fraction rises → EtCO₂ falls → PaCO₂-EtCO₂ gradient widens. This is why EtCO₂ underestimates PaCO₂ in shock.',
      ],
      cardiac_output: [
        'Cardiac output determines O₂ delivery AND CO₂ removal. SpO₂ can remain normal while CO is dangerously low.',
        'Monitor trends: a recovering CO will show rising EtCO₂, improving arterial waveform amplitude, and narrowing pulse pressure variation.',
      ],
    },
    drills: {
      hemodynamics: [
        {
          prompt: 'A patient is 10 minutes post-induction with sevoflurane. MAP is 48 mmHg. SpO₂ is 99%. Which statement is most accurate?',
          choices: [
            { text: 'Normal SpO₂ means oxygen delivery is adequate' },
            { text: 'Low MAP with normal SpO₂ still indicates compromised tissue perfusion' },
            { text: 'Sevoflurane does not cause hypotension' },
            { text: 'This MAP is acceptable for a healthy patient under anesthesia' },
          ],
          correct_index: 1,
          explanation: 'SpO₂ reflects arterial saturation, not tissue oxygen delivery. DO₂ = CO × CaO₂. A low MAP implies reduced CO, meaning reduced DO₂ despite normal saturation.',
        },
      ],
      etco2_interpretation: [
        {
          prompt: 'During a case, EtCO₂ drops from 36 to 24 mmHg over 5 minutes. RR and TV are unchanged. The most likely cause is:',
          choices: [
            { text: 'Hyperventilation' },
            { text: 'Reduced cardiac output' },
            { text: 'Increased CO₂ production' },
            { text: 'Circuit disconnect' },
          ],
          correct_index: 1,
          explanation: 'With unchanged ventilation, a falling EtCO₂ means less CO₂ is being delivered to the alveoli — the hallmark of reduced pulmonary blood flow (low cardiac output).',
        },
      ],
      dead_space_physiology: [
        {
          prompt: 'Which scenario increases alveolar dead space?',
          choices: [
            { text: 'Atelectasis (perfused but not ventilated)' },
            { text: 'Pulmonary embolism (ventilated but not perfused)' },
            { text: 'Bronchospasm' },
            { text: 'Mucus plug' },
          ],
          correct_index: 1,
          explanation: 'Dead space = ventilated but not perfused. PE blocks perfusion to ventilated alveoli, creating dead space. Atelectasis is the opposite — shunt (perfused, not ventilated).',
        },
      ],
    },
  },

  anaphylaxis: {
    keyStrengths: [
      'Recognizing the anaphylaxis triad: simultaneous hypotension, bronchospasm, and tachycardia',
      'Calling for epinephrine immediately as the only first-line treatment',
      'Understanding that compensatory tachycardia must not be beta-blocked during resuscitation',
    ],
    commonPitfalls: [
      'Giving antihistamines (diphenhydramine) as a primary treatment — they are adjuncts only and do not reverse cardiovascular collapse',
      'Beta-blocking the compensatory tachycardia — this removes the cardiac support that epinephrine provides',
      'Underdosing fluids — capillary leak in anaphylaxis causes massive relative hypovolemia requiring 2–4 L crystalloid',
    ],
    highYieldPearls: [
      'Epinephrine is the only drug that simultaneously treats all three limbs of anaphylaxis: α₁ (BP), β₁ (CO), β₂ (bronchospasm).',
      'Rocuronium and antibiotics are the most common perioperative anaphylaxis triggers. Latex was more common historically.',
      'Biphasic anaphylaxis occurs in up to 20% of cases, 4–12 hours after the initial event. Observe and consider steroids.',
      'The PIP-to-Pplat gap widens in anaphylaxis bronchospasm — this is resistance, not compliance failure.',
    ],
    learningObjectives: [
      'Recognize the anaphylaxis triad: hypotension + bronchospasm + tachycardia',
      'Understand epinephrine as the only first-line treatment for anaphylaxis',
      'Know the sequence of monitor changes during treatment and recovery',
    ],
    stepDomains: [
      ['anaphylaxis_recognition', 'epinephrine_pharmacology', 'airway_resistance'],
      ['volume_resuscitation', 'anaphylaxis_management', 'compensatory_tachycardia'],
    ],
    teachingPoints: {
      anaphylaxis_recognition: [
        'Anaphylaxis triad: simultaneous cardiovascular collapse (hypotension, tachycardia) + bronchospasm (elevated PIP, shark-fin capnogram) + skin changes (erythema, urticaria).',
        'Onset within minutes of trigger exposure. Rocuronium and antibiotics are the most common perioperative triggers.',
      ],
      epinephrine_pharmacology: [
        'Epinephrine treats all three limbs simultaneously: α₁ (vasoconstriction → ↑BP), β₁ (↑HR, ↑contractility → ↑CO), β₂ (bronchodilation → ↓PIP).',
        'No other single drug does this. Antihistamines and steroids are adjuncts, not substitutes.',
      ],
      airway_resistance: [
        'In anaphylaxis, PIP rises disproportionately to Pplat — the peak-to-plateau gap widens due to bronchospasm, not poor compliance.',
        'The capnogram develops shark-fin morphology as bronchospasm impedes expiratory flow.',
      ],
      volume_resuscitation: [
        'Anaphylactic vasodilation and capillary leak cause massive relative hypovolemia. Vasopressors alone cannot correct this — fluids are essential.',
        'Expect 2–4 L crystalloid in the first hour for severe anaphylaxis.',
      ],
      anaphylaxis_management: [
        'After epinephrine: fluids, call for help, stop the trigger, consider epinephrine infusion if recurrent.',
        'Biphasic anaphylaxis (recurrence 4–12 hours later) occurs in up to 20% of cases. Observe and consider corticosteroids.',
      ],
      compensatory_tachycardia: [
        'Tachycardia in anaphylaxis is compensatory — it maintains cardiac output during vasodilation. Never beta-block it.',
        'Beta-blockers can cause refractory anaphylaxis by blocking the β₁ and β₂ effects of epinephrine.',
      ],
    },
    drills: {
      anaphylaxis_recognition: [
        {
          prompt: 'Which combination most strongly suggests perioperative anaphylaxis rather than isolated bronchospasm?',
          choices: [
            { text: 'High PIP + normal BP + normal HR' },
            { text: 'High PIP + hypotension + tachycardia + skin changes' },
            { text: 'Low PIP + hypotension + bradycardia' },
            { text: 'Normal PIP + hypertension + rash' },
          ],
          correct_index: 1,
          explanation: 'Anaphylaxis involves multiple organ systems simultaneously. Isolated bronchospasm causes high PIP but does not typically produce cardiovascular collapse or skin changes.',
        },
      ],
      epinephrine_pharmacology: [
        {
          prompt: 'A patient in anaphylactic shock receives epinephrine. Which monitor change do you expect to see FIRST?',
          choices: [
            { text: 'SpO₂ improvement' },
            { text: 'Arterial line amplitude and BP improvement' },
            { text: 'PIP normalization' },
            { text: 'Capnogram normalization' },
          ],
          correct_index: 1,
          explanation: 'α₁-mediated vasoconstriction restores SVR within seconds (arterial line improves first). Bronchodilation (β₂) takes several breaths. SpO₂ lags behind ventilation changes.',
        },
      ],
      compensatory_tachycardia: [
        {
          prompt: 'A colleague suggests giving metoprolol to treat a HR of 130 during anaphylaxis treatment. The best response is:',
          choices: [
            { text: 'Agree — tachycardia increases myocardial oxygen demand' },
            { text: 'Disagree — beta-blockade will block epinephrine\'s beneficial effects and worsen shock' },
            { text: 'Agree — but use a lower dose' },
            { text: 'Suggest amiodarone instead' },
          ],
          correct_index: 1,
          explanation: 'Beta-blockers antagonize epinephrine at β₁ and β₂ receptors, removing both the cardiac output support and bronchodilation. This is a known mechanism of refractory anaphylaxis.',
        },
      ],
    },
  },

  bronchospasm: {
    keyStrengths: [
      'Interpreting the peak-to-plateau gap as the key discriminator between resistance and compliance problems',
      'Recognizing incomplete expiratory flow as the waveform signature of air trapping',
      'Slowing respiratory rate to extend expiratory time in obstructive physiology',
    ],
    commonPitfalls: [
      'Increasing respiratory rate to chase the elevated EtCO₂ — this shortens expiratory time and worsens air trapping exponentially',
      'Adding more PEEP during active air trapping — external PEEP adds to intrinsic PEEP and increases hemodynamic risk',
      'Giving albuterol when the problem is actually compliance (narrow gap) rather than resistance (wide gap)',
    ],
    highYieldPearls: [
      'PIP − Pplat = resistive pressure. A gap > 10 cmH₂O means high airway resistance, not stiff lungs.',
      'Expiratory flow not reaching zero = incomplete exhalation = dynamic hyperinflation. This waveform is more sensitive than pressure alone.',
      'Slow the RR first. Accept permissive hypercapnia. Faster breathing in obstruction makes everything worse.',
      'Volatile anesthetics (sevoflurane) are potent bronchodilators — deepening the volatile is both a treatment and an airway protection strategy.',
    ],
    learningObjectives: [
      'Interpret the peak-to-plateau pressure gap as a sign of high airway resistance',
      'Recognize the expiratory flow pattern of air trapping and auto-PEEP',
      'Understand why decreasing respiratory rate is critical in obstructive physiology',
    ],
    stepDomains: [
      ['airway_resistance', 'ventilator_waveforms', 'waveform_pattern_recognition', 'bronchospasm_treatment'],
      ['time_constant_physiology', 'auto_peep', 'waveform_pattern_recognition', 'ventilator_management'],
    ],
    teachingPoints: {
      airway_resistance: [
        'PIP - Pplat = resistive pressure component. A large gap (>10 cmH₂O) means high airway resistance, not poor compliance.',
        'Common causes: bronchospasm, kinked ETT, mucus plug, biting on the tube.',
      ],
      ventilator_waveforms: [
        'Expiratory flow not returning to zero before the next breath = incomplete exhalation = air trapping.',
        'Capnogram shark-fin: the upsloping Phase III reflects uneven time constants across obstructed lung units.',
      ],
      waveform_pattern_recognition: [
        'Resistance-dominant obstruction raises PIP more than plateau pressure; compliance-dominant disease raises both.',
        'When expiratory flow remains below zero at next inspiration, dynamic hyperinflation/auto-PEEP is still active even if pressures are improving.',
      ],
      bronchospasm_treatment: [
        'β₂ agonists (salbutamol/albuterol) relax airway smooth muscle directly. Give via MDI into the circuit or nebulizer.',
        'Volatile anesthetics (sevoflurane, isoflurane) have intrinsic bronchodilatory properties — deepening anesthesia helps.',
      ],
      time_constant_physiology: [
        'τ (tau) = Resistance × Compliance. Higher R → longer τ → lungs need more time to empty.',
        'The lung needs ~3τ to exhale 95% of tidal volume. If expiratory time < 3τ, air traps.',
      ],
      auto_peep: [
        'Auto-PEEP = residual alveolar pressure at end-expiration from incomplete emptying. It is not measured by the ventilator unless you do an end-expiratory hold.',
        'Auto-PEEP increases work of breathing, reduces venous return, and can cause hemodynamic compromise.',
      ],
      ventilator_management: [
        'In obstruction: slow the RR to extend expiratory time. Accept transient hypercapnia (permissive hypercapnia).',
        'Never increase RR in obstructive physiology — shorter expiratory time worsens air trapping exponentially.',
      ],
    },
    drills: {
      airway_resistance: [
        {
          prompt: 'PIP is 38 cmH₂O and Pplat is 18 cmH₂O. The most likely problem is:',
          choices: [
            { text: 'Poor lung compliance (stiff lungs)' },
            { text: 'High airway resistance' },
            { text: 'Auto-PEEP' },
            { text: 'Patient-ventilator dyssynchrony' },
          ],
          correct_index: 1,
          explanation: 'PIP - Pplat = 20 cmH₂O. This large gap reflects the resistive pressure component. Poor compliance raises both PIP and Pplat proportionally.',
        },
      ],
      time_constant_physiology: [
        {
          prompt: 'A patient has airway resistance of 20 cmH₂O/L/s and compliance of 50 mL/cmH₂O. The expiratory time constant τ is:',
          choices: [
            { text: '0.5 seconds' },
            { text: '1.0 second' },
            { text: '2.0 seconds' },
            { text: '4.0 seconds' },
          ],
          correct_index: 1,
          explanation: 'τ = R × C = 20 × 0.050 = 1.0 second. The lung needs ~3 seconds (3τ) to exhale 95% of the tidal volume.',
        },
      ],
      ventilator_management: [
        {
          prompt: 'A patient with severe bronchospasm is on RR 14. Expiratory flow does not return to zero. The best ventilator change is:',
          choices: [
            { text: 'Increase RR to 20 to wash out CO₂' },
            { text: 'Decrease RR to 8 to allow complete exhalation' },
            { text: 'Increase PEEP to 15 to stent airways open' },
            { text: 'Switch to pressure support ventilation' },
          ],
          correct_index: 1,
          explanation: 'Slower RR extends expiratory time, allowing the lungs to empty before the next breath. Faster RR worsens air trapping. Accept transient hypercapnia.',
        },
      ],
      waveform_pattern_recognition: [
        {
          prompt: 'Which waveform pair most strongly suggests persistent obstructive physiology?',
          choices: [
            { text: 'High plateau pressure with minimal peak-plateau difference and full exhalation' },
            { text: 'Large peak-plateau gap plus expiratory flow that fails to return to baseline' },
            { text: 'Normal pressure curve with only low EtCO2' },
            { text: 'Equal inspired/expired volume mismatch only' },
          ],
          correct_index: 1,
          explanation: 'Obstruction is recognized by a resistive pressure gap and delayed expiratory emptying (flow not reaching zero).',
        },
      ],
    },
  },


  /* ── Scenario 4: Right mainstem intubation after positioning ─────────── */
  right_mainstem_after_turn: {
    keyStrengths: [
      'Using asymmetric chest movement to distinguish tube malposition from bilateral airway problems',
      'Reading the peak-to-plateau gap to determine whether the problem is resistance or compliance',
      'Knowing to verify ETT depth after any patient repositioning',
    ],
    commonPitfalls: [
      'Treating high airway pressure with PEEP or albuterol before checking tube position — bronchospasm and malposition have different pressure signatures',
      'Advancing the ETT when the problem was migration distally — this recreates one-lung ventilation',
      'Not auscultating or rechecking tube depth after table movement, patient turns, or positioning changes',
    ],
    highYieldPearls: [
      'Narrow peak-to-plateau gap + asymmetric chest rise after repositioning = tube malposition until proven otherwise.',
      'Bronchospasm widens the peak-to-plateau gap; malposition narrows it (compliance falls when only one lung is ventilated).',
      'The ETT tip position relative to the carina changes with head flexion/extension, table rotation, and patient turning. Always recheck.',
      'After correcting the tube, recruit the atelectatic lung with a gentle breath-hold before returning to standard settings.',
    ],
    learningObjectives: [
      'Distinguish tube malposition from bronchospasm using the peak-to-plateau gap',
      'Recognize asymmetric chest movement as a sign of one-lung ventilation',
      'Verify tube depth any time the patient or table is repositioned',
    ],
    stepDomains: [
      ['airway_assessment', 'peak_plateau_gap', 'waveform_pattern_recognition'],
      ['lung_recruitment', 'post_repositioning_safety'],
    ],
    teachingPoints: {
      airway_assessment: [
        'Any time the operating table is moved, repositioned, or tilted, the ETT can migrate — the carina is a fixed bony landmark while the tube floats with soft tissue.',
        'Asymmetric chest rise after turning is the bedside clue that distinguishes malposition from bilateral bronchospasm.',
      ],
      peak_plateau_gap: [
        'Peak-to-plateau gap = resistive component. In tube malposition, the effective tidal volume goes to one lung → compliance falls (narrow gap, both PIP and Pplat rise).',
        'In bronchospasm, resistance rises → wide gap (PIP high, Pplat normal or near-normal).',
      ],
      waveform_pattern_recognition: [
        'A rectangular capnogram with persistent EtCO₂ means CO₂ is being exchanged — but the waveform cannot tell you if only one lung is receiving the tidal volume.',
        'SpO₂ may lag several minutes behind the start of one-lung ventilation; pressure and chest exam changes appear earlier.',
      ],
      lung_recruitment: [
        'After correcting tube depth, atelectasis from the unventilated period may persist. A gentle recruitment maneuver followed by appropriate PEEP helps reopen dependent lung units.',
        'Recruitment is not a substitute for correcting the underlying problem — always fix the tube first.',
      ],
      post_repositioning_safety: [
        'Best practice: confirm bilateral breath sounds and bilateral chest rise after induction, after any position change, and after final draping.',
        'Depth markings at the teeth are a guide, not a guarantee — anatomy, neck position, and ETT cuff inflation all affect final tip position.',
      ],
    },
    drills: {
      peak_plateau_gap: [
        {
          prompt: 'After turning the patient prone, PIP rises to 40 cmH₂O and Pplat rises to 36 cmH₂O. Chest rise is asymmetric. The most likely cause is:',
          choices: [
            { text: 'Bronchospasm' },
            { text: 'Endotracheal tube migration into one mainstem bronchus' },
            { text: 'Tension pneumothorax' },
            { text: 'Anaphylaxis' },
          ],
          correct_index: 1,
          explanation: 'A narrow peak-to-plateau gap (4 cmH₂O here) with asymmetric chest movement after repositioning points to reduced compliance from unilateral ventilation, not resistance-driven bronchospasm.',
        },
      ],
      airway_assessment: [
        {
          prompt: 'Which maneuver is most appropriate immediately after the surgical table is rotated 180°?',
          choices: [
            { text: 'Increase FiO₂ to 100% as a precaution' },
            { text: 'Auscultate bilateral breath sounds and confirm airway pressures' },
            { text: 'Increase respiratory rate to compensate for position change' },
            { text: 'Lower PEEP to reduce hemodynamic impact' },
          ],
          correct_index: 1,
          explanation: 'Bilateral auscultation after repositioning catches ETT migration before hypoxia develops. FiO₂ increase is supportive but does not identify the underlying problem.',
        },
      ],
    },
  },

  /* ── Scenario 5: CO₂ embolism during laparoscopy ──────────────────────── */
  laparoscopy_etco2_crash: {
    keyStrengths: [
      'Recognizing the CO₂ embolism monitor signature: abrupt EtCO₂ fall with unchanged airway pressures',
      'Knowing to stop the source (desufflation) immediately rather than adjusting the ventilator',
      'Using EtCO₂ recovery as the real-time marker of pulmonary blood flow restoration',
    ],
    commonPitfalls: [
      'Increasing respiratory rate to correct the EtCO₂ drop — this worsens right heart afterload and misses the diagnosis',
      'Restarting insufflation too early because SpO₂ improved — EtCO₂ and BP must recover first',
      'Confusing CO₂ embolism with bronchospasm — bronchospasm raises airway pressures, CO₂ embolism does not',
    ],
    highYieldPearls: [
      'Sudden EtCO₂ collapse + hemodynamic instability + unchanged airway pressures during laparoscopy = CO₂ embolism until proven otherwise.',
      'EtCO₂ is the most sensitive real-time indicator of pulmonary blood flow. Its recovery after desufflation confirms the embolus is clearing.',
      'CO₂ embolism obstructs the right heart outflow. Left lateral decubitus + Trendelenburg may shift the gas bubble away from the RVOT.',
      'High PEEP during CO₂ embolism worsens venous return and should be avoided — the right heart is already compromised.',
    ],
    learningObjectives: [
      'Recognize the CO₂ embolism monitor pattern: sudden EtCO₂ drop with unchanged airway pressures',
      'Understand why EtCO₂ and blood pressure fall together in impaired pulmonary perfusion',
      'Know the first-line response sequence: stop source → desufflate → 100% O₂ → support circulation',
    ],
    stepDomains: [
      ['co2_embolism_recognition', 'etco2_interpretation', 'dead_space_physiology'],
      ['right_heart_support', 'hemodynamic_management'],
    ],
    teachingPoints: {
      co2_embolism_recognition: [
        'The CO₂ embolism signature: abrupt EtCO₂ fall + hypotension + tachycardia during laparoscopic insufflation, with UNCHANGED airway pressures.',
        'Normal airway pressures exclude airway obstruction, atelectasis, and tension pneumothorax as primary causes — the lungs are mechanically fine, but pulmonary blood flow is blocked.',
      ],
      etco2_interpretation: [
        'EtCO₂ reflects CO₂ delivery to alveoli by pulmonary blood flow. When a gas embolus partially occludes the right heart or pulmonary vasculature, less CO₂ reaches ventilated alveoli — EtCO₂ falls abruptly.',
        'The EtCO₂ is the most real-time indicator of pulmonary blood flow at the bedside. Its recovery after desufflation confirms the embolus is clearing.',
      ],
      dead_space_physiology: [
        'CO₂ embolism acutely increases alveolar dead space — ventilated alveoli lose their perfusion. SpO₂ can initially be maintained if the remaining perfused alveoli compensate.',
        'The magnitude of EtCO₂ drop reflects how much of the pulmonary vascular bed is obstructed.',
      ],
      right_heart_support: [
        'The right ventricle is afterload-sensitive. Acute pulmonary obstruction raises RV afterload, dilates the RV, and reduces left-sided filling — causing hypotension even with a full intravascular volume.',
        'Left lateral decubitus + Trendelenburg positioning may help displace the gas bubble away from the right ventricular outflow tract.',
      ],
      hemodynamic_management: [
        'Fluid boluses support preload; vasopressors (norepinephrine, vasopressin) restore systemic perfusion pressure while pulmonary blood flow recovers.',
        'Avoid high intrathoracic pressures (high PEEP, large tidal volumes) — they further reduce venous return to the already-compromised right heart.',
      ],
    },
    drills: {
      co2_embolism_recognition: [
        {
          prompt: 'During laparoscopic cholecystectomy, EtCO₂ drops from 38 to 12 mmHg within 30 seconds. PIP is 21 cmH₂O, unchanged from before. HR is 140, BP is 65/35. The most likely diagnosis is:',
          choices: [
            { text: 'Tension pneumothorax' },
            { text: 'Endobronchial intubation' },
            { text: 'CO₂ venous embolism' },
            { text: 'Severe bronchospasm' },
          ],
          correct_index: 2,
          explanation: 'Unchanged airway pressures exclude mechanical airway causes. Sudden EtCO₂ drop with hemodynamic collapse during insufflation is CO₂ embolism until proven otherwise.',
        },
      ],
      etco2_interpretation: [
        {
          prompt: 'After stopping insufflation and desufflating in a CO₂ embolism, you expect EtCO₂ to:',
          choices: [
            { text: 'Continue falling as CO₂ accumulates' },
            { text: 'Rise as pulmonary blood flow recovers' },
            { text: 'Remain unchanged because ventilation is constant' },
            { text: 'Rise only after vasopressors are given' },
          ],
          correct_index: 1,
          explanation: 'As the gas embolus dissipates and pulmonary blood flow recovers, CO₂ delivery to alveoli normalizes and EtCO₂ rises. This is a real-time treatment response indicator.',
        },
      ],
    },
  },

  /* ── Scenario 6: Intraoperative tension pneumothorax ─────────────────── */
  intraop_tension_pneumothorax: {
    keyStrengths: [
      'Identifying the tension pneumothorax triad: high plateau pressure + obstructive shock + asymmetric chest movement',
      'Distinguishing tension pneumo from CO₂ embolism and bronchospasm using airway pressure waveforms',
      'Acting decisively to decompress before confirming with imaging',
    ],
    commonPitfalls: [
      'Ordering a chest X-ray before decompressing — in tension pneumothorax this delay can be fatal; clinical diagnosis is sufficient',
      'Giving albuterol for high airway pressure without checking whether it is a compliance problem (narrow gap) or resistance problem (wide gap)',
      'Increasing PEEP to "open" the collapsed lung — this raises intrathoracic pressure and worsens obstructive shock',
    ],
    highYieldPearls: [
      'Tension pneumothorax triad: high Pplat (narrow peak-plateau gap) + obstructive shock + asymmetric chest movement.',
      'Needle decompression converts tension to simple pneumothorax. It is temporizing — chest tube is the definitive treatment.',
      'Nitrous oxide expands gas-containing spaces. Avoid it when pneumothorax is known or suspected.',
      'EtCO₂ falls in tension pneumo because mediastinal shift impairs venous return and cardiac output — exactly like CO₂ embolism, but with high airway pressures.',
    ],
    learningObjectives: [
      'Recognize tension pneumothorax by narrow peak-to-plateau gap, hemodynamic collapse, and asymmetric chest movement',
      'Distinguish tension pneumothorax from CO₂ embolism and bronchospasm using the pressure waveform',
      'Know that needle decompression is temporizing — definitive chest tube drainage is required',
    ],
    stepDomains: [
      ['tension_pneumo_recognition', 'peak_plateau_gap', 'obstructive_shock'],
      ['definitive_airway_management', 'post_decompression_care'],
    ],
    teachingPoints: {
      tension_pneumo_recognition: [
        'The tension pneumothorax triad: stiff ventilation (high plateau pressure) + obstructive shock (hypotension, tachycardia) + asymmetric chest movement.',
        'EtCO₂ falls because the mediastinal shift and raised intrathoracic pressure impair venous return and cardiac output — less CO₂ reaches the alveoli.',
      ],
      peak_plateau_gap: [
        'In tension pneumothorax, the affected lung is mechanically excluded from ventilation. Tidal volume goes to one side → effective compliance falls → plateau pressure rises proportionally to peak pressure (narrow gap).',
        'This contrasts with bronchospasm (wide gap) and CO₂ embolism (normal pressures).',
      ],
      obstructive_shock: [
        'Tension pneumothorax causes obstructive shock: a mechanical barrier prevents adequate cardiac filling or output. Others include PE, cardiac tamponade, and severe auto-PEEP.',
        'All obstructive shock states share: hypotension + high CVP + normal or reduced cardiac output. Removing the obstruction is definitive treatment.',
      ],
      definitive_airway_management: [
        'Needle decompression at the 2nd intercostal space, mid-clavicular line converts tension to simple pneumothorax immediately but may not remain patent.',
        'A chest tube (finger thoracostomy or tube thoracostomy) is the only definitive management. Confirm with re-expansion on exam or imaging.',
      ],
      post_decompression_care: [
        'After decompression, avoid high airway pressures, nitrous oxide (expands gas spaces), and unnecessary PEEP. Nitrous oxide can significantly expand a residual pneumothorax.',
        'Communication with the surgical team is essential — positioning, insufflation, and closure decisions may all need to change.',
      ],
    },
    drills: {
      tension_pneumo_recognition: [
        {
          prompt: 'Intraoperatively, PIP rises to 45 cmH₂O and Pplat to 42 cmH₂O. BP is 70/40, HR 140, SpO₂ 86%, and chest movement is asymmetric. Breath sounds are absent on the right. Next step?',
          choices: [
            { text: 'Give albuterol for bronchospasm' },
            { text: 'Immediately decompress the right chest' },
            { text: 'Increase PEEP to recruit the collapsed lung' },
            { text: 'Order a portable chest X-ray' },
          ],
          correct_index: 1,
          explanation: 'The narrow peak-plateau gap rules out primary resistance. Asymmetry, absent breath sounds, and hemodynamic collapse together indicate tension pneumothorax. Decompress first — imaging can follow after stabilization.',
        },
      ],
      peak_plateau_gap: [
        {
          prompt: 'Which combination best distinguishes tension pneumothorax from severe bronchospasm?',
          choices: [
            { text: 'High PIP with normal Pplat (wide gap) and asymmetric chest movement' },
            { text: 'High PIP and high Pplat (narrow gap) with asymmetric chest movement and hemodynamic collapse' },
            { text: 'Low PIP with high Pplat and symmetric chest movement' },
            { text: 'Normal pressures with abrupt EtCO₂ fall' },
          ],
          correct_index: 1,
          explanation: 'Tension pneumo: narrow gap (compliance problem) + asymmetry + shock. Bronchospasm: wide gap (resistance problem) + usually symmetric ± hemodynamics preserved initially.',
        },
      ],
    },
  },

  /* ── Scenario 7: COPD auto-PEEP / dynamic hyperinflation ─────────────── */
  copd_auto_peep: {
    keyStrengths: [
      'Identifying dynamic hyperinflation from expiratory flow waveform and the wide peak-to-plateau gap',
      'Resisting the urge to increase respiratory rate when EtCO₂ is elevated in an obstructed patient',
      'Combining ventilator timing changes with bronchodilator therapy to treat both causes simultaneously',
    ],
    commonPitfalls: [
      'Increasing respiratory rate to correct EtCO₂ — this is the single most dangerous error in COPD ventilation',
      'Adding external PEEP without measuring auto-PEEP first — uncontrolled PEEP addition can exceed intrinsic PEEP and worsen hyperinflation',
      'Increasing tidal volume to "improve ventilation" — larger breaths take longer to exhale and worsen breath stacking',
    ],
    highYieldPearls: [
      'Auto-PEEP = residual alveolar pressure from incomplete exhalation. Detect it with an end-expiratory hold; the ventilator will not display it otherwise.',
      'The time constant τ = R × C. High resistance in COPD lengthens τ and requires longer expiratory time to empty.',
      'Expiratory flow not reaching zero is more sensitive for dynamic hyperinflation than peak pressure alone.',
      'Permissive hypercapnia: accept PaCO₂ 50–70 mmHg in obstructive disease. The goal is full exhalation, not a normal CO₂.',
    ],
    learningObjectives: [
      'Identify dynamic hyperinflation by a wide peak-to-plateau gap and incomplete expiratory flow',
      'Understand why increasing respiratory rate worsens air trapping in obstructive physiology',
      'Apply bronchodilator and ventilator timing strategies together to resolve COPD exacerbation on the ventilator',
    ],
    stepDomains: [
      ['auto_peep', 'airway_resistance', 'ventilator_waveforms'],
      ['bronchodilator_therapy', 'expiratory_time_management'],
    ],
    teachingPoints: {
      auto_peep: [
        'Auto-PEEP (intrinsic PEEP) is residual alveolar pressure at end-expiration from incomplete emptying. The ventilator does not display it unless you perform an end-expiratory occlusion hold.',
        'Auto-PEEP raises mean intrathoracic pressure, reduces venous return, and can cause hemodynamic compromise — it is not just a ventilator curiosity.',
      ],
      airway_resistance: [
        'The peak-to-plateau gap quantifies the resistive component of airway pressure. A gap > 10 cmH₂O suggests high resistance, as in bronchospasm, COPD, or kinked ETT.',
        'Compliance is normal in pure obstructive disease — only plateau pressure (compliance) would be elevated if compliance were the problem.',
      ],
      ventilator_waveforms: [
        'Expiratory flow that does not return to zero before the next breath is the waveform signature of breath stacking. It is more sensitive than pressure alone.',
        'The shark-fin capnogram (slanted Phase III) reflects uneven time constants — slow-emptying lung units still exhaling CO₂ while faster units have already finished.',
      ],
      bronchodilator_therapy: [
        'Albuterol via MDI into the ETT circuit (4–8 puffs) or nebulizer reduces smooth muscle constriction. Effect is seen within minutes on the flow waveform.',
        'Volatile anesthetics have intrinsic bronchodilatory properties. In intubated COPD patients under GA, deepening the volatile agent is a first-line adjunct.',
      ],
      expiratory_time_management: [
        'Expiratory time = (60/RR) − Ti. Reducing RR is the most effective way to extend expiratory time. Shortening Ti (I:E ratio) provides additional help.',
        'The clinical goal is expiratory flow returning to zero. Accept permissive hypercapnia — chasing EtCO₂ with faster breathing is the most common error in obstructive ventilation.',
      ],
    },
    drills: {
      auto_peep: [
        {
          prompt: 'A ventilated COPD patient has RR 18, Ti 1.2 s. Peak pressure is 42 cmH₂O, plateau 20 cmH₂O. Flow never returns to zero. The best immediate ventilator change is:',
          choices: [
            { text: 'Increase RR to 22 to lower EtCO₂' },
            { text: 'Decrease RR to 10 and reduce Ti to 0.7 s' },
            { text: 'Add PEEP 10 cmH₂O to splint airways' },
            { text: 'Switch to pressure support mode' },
          ],
          correct_index: 1,
          explanation: 'Slower rate and shorter Ti together extend expiratory time, allowing trapped gas to leave and reducing auto-PEEP. Faster rates worsen breath stacking.',
        },
      ],
      ventilator_waveforms: [
        {
          prompt: 'The capnogram shows a slanted, shark-fin upstroke in a COPD patient. This most likely reflects:',
          choices: [
            { text: 'Esophageal intubation' },
            { text: 'Uneven emptying due to obstructed airways with varying time constants' },
            { text: 'Air leak from the ETT cuff' },
            { text: 'Increased CO₂ production from fever' },
          ],
          correct_index: 1,
          explanation: 'Uneven airway resistance creates lung units with different time constants. Slow units exhale CO₂ late, creating a persistently rising Phase III (shark-fin) on the capnogram.',
        },
      ],
    },
  },

  /* ── Scenario 8: ARDS — driving pressure and lung protection ─────────── */
  ards_driving_pressure: {
    keyStrengths: [
      'Calculating driving pressure (Pplat − PEEP) as the key lung injury metric rather than peak pressure alone',
      'Reducing tidal volume toward 6 mL/kg IBW as the first protective maneuver when Pplat is high',
      'Accepting permissive hypercapnia when reducing tidal volume is lung-protective',
    ],
    commonPitfalls: [
      'Treating elevated peak pressure with albuterol when the peak-to-plateau gap is narrow — this is a compliance problem, not resistance',
      'Increasing tidal volume to improve SpO₂ at the cost of higher plateau and driving pressure',
      'Chasing a normal EtCO₂ with a faster respiratory rate after tidal volume reduction, sacrificing lung protection for a number',
    ],
    highYieldPearls: [
      'Driving pressure = Pplat − PEEP. It is the alveolar stretch per breath. Values > 15 cmH₂O are independently associated with worse ARDS outcomes.',
      'Narrow peak-to-plateau gap + high Pplat = compliance problem. Wide gap + high PIP with normal Pplat = resistance problem.',
      'ARDSNet protocol: TV 6 mL/kg IBW, Pplat ≤ 30 cmH₂O. The benefit comes from reducing volume, not from a specific pressure target.',
      'Permissive hypercapnia is acceptable if pH ≥ 7.20. Lung protection outweighs the risk of mild respiratory acidosis.',
    ],
    learningObjectives: [
      'Calculate and interpret driving pressure (Pplat − PEEP) as the key injury metric in ARDS',
      'Apply lung-protective ventilation: tidal volume reduction to 6 mL/kg IBW',
      'Use PEEP titration for oxygenation only after tidal volume is protective',
    ],
    stepDomains: [
      ['driving_pressure', 'lung_protective_ventilation', 'peak_plateau_gap'],
      ['peep_titration', 'permissive_hypercapnia'],
    ],
    teachingPoints: {
      driving_pressure: [
        'Driving pressure = Pplat − PEEP. It reflects the pressure swing across the respiratory system per breath — the mechanical stress applied to alveoli.',
        'Driving pressure > 15 cmH₂O is independently associated with increased ARDS mortality. It is a better predictor of VILI than plateau pressure alone.',
      ],
      lung_protective_ventilation: [
        'ARDSNet protocol: tidal volume 6 mL/kg of ideal body weight, plateau pressure ≤ 30 cmH₂O. Reducing tidal volume reduces driving pressure and alveolar overdistension.',
        'For every 1 cmH₂O reduction in driving pressure, mortality decreases proportionally. The gain comes from lower volume, not from a specific pressure target alone.',
      ],
      peak_plateau_gap: [
        'In ARDS, the peak-to-plateau gap is narrow because resistance is relatively normal — the problem is stiff, flooded alveoli reducing compliance.',
        'A narrow gap with high plateau pressure = compliance problem. Address it by reducing tidal volume, not by giving bronchodilators.',
      ],
      peep_titration: [
        'PEEP recruits unstable alveoli and reduces cyclic atelectrauma. However, it increases plateau and driving pressure if compliance does not improve — always check both after PEEP increases.',
        'Titrate PEEP to the lowest level that maintains acceptable oxygenation without causing driving pressure > 15 cmH₂O or hemodynamic compromise.',
      ],
      permissive_hypercapnia: [
        'A modest EtCO₂ rise (to 50–60 mmHg) after tidal volume reduction is expected and acceptable. The benefits of lung protection outweigh the risk of mild hypercapnia.',
        'Contraindications to permissive hypercapnia: raised ICP, severe pulmonary hypertension, right heart failure. Check with the clinical team.',
      ],
    },
    drills: {
      driving_pressure: [
        {
          prompt: 'A patient has Pplat 32 cmH₂O and PEEP 8 cmH₂O. Driving pressure is:',
          choices: [
            { text: '8 cmH₂O' },
            { text: '24 cmH₂O' },
            { text: '32 cmH₂O' },
            { text: '40 cmH₂O' },
          ],
          correct_index: 1,
          explanation: 'Driving pressure = Pplat − PEEP = 32 − 8 = 24 cmH₂O. This is above the 15 cmH₂O threshold associated with increased VILI risk.',
        },
      ],
      lung_protective_ventilation: [
        {
          prompt: 'After reducing tidal volume in ARDS from 9 to 6 mL/kg IBW, EtCO₂ rises from 40 to 50 mmHg. The correct response is:',
          choices: [
            { text: 'Return to 9 mL/kg to normalize EtCO₂' },
            { text: 'Accept the permissive hypercapnia — lung protection is the priority' },
            { text: 'Increase PEEP to compensate' },
            { text: 'Add sodium bicarbonate' },
          ],
          correct_index: 1,
          explanation: 'A modest EtCO₂ rise after tidal volume reduction is expected. Accept permissive hypercapnia if pH is ≥ 7.20. Do not sacrifice lung-protective strategy for a normal EtCO₂.',
        },
      ],
    },
  },

  /* ── Scenario 9: PEEP vs. preload — hemodynamic consequences ─────────── */
  peep_preload_balance: {
    keyStrengths: [
      'Recognizing that improving SpO₂ and worsening hemodynamics can happen simultaneously from the same intervention',
      'Using EtCO₂ trend as a non-invasive surrogate for cardiac output changes after PEEP adjustment',
      'Individualizing PEEP by monitoring SpO₂, EtCO₂, blood pressure, and driving pressure together',
    ],
    commonPitfalls: [
      'Optimizing for the highest SpO₂ without checking what PEEP is doing to EtCO₂ and blood pressure',
      'Interpreting a low EtCO₂ as hypoventilation when the real cause is reduced pulmonary blood flow from high PEEP',
      'Removing all PEEP because lowering it helped — moderate PEEP is still needed to maintain alveolar recruitment',
    ],
    highYieldPearls: [
      'PEEP increases mean intrathoracic pressure → reduces venous return → reduces preload → reduces cardiac output. This effect is amplified in hypovolemia.',
      'A gradual EtCO₂ drop with hypotension after a PEEP increase, with a rectangular capnogram = reduced cardiac output, not hypoventilation.',
      'Total oxygen delivery = CO × CaO₂. A higher SpO₂ with a lower CO may result in lower actual oxygen delivery to tissues.',
      'The best PEEP balances recruitment (SpO₂), driving pressure (lung protection), and cardiac output (EtCO₂ + BP). There is no universal number.',
    ],
    learningObjectives: [
      'Recognize that high PEEP can reduce venous return and lower cardiac output despite improving SpO₂',
      'Use EtCO₂ and blood pressure trends together as a hemodynamic response to PEEP titration',
      'Individualize PEEP to balance oxygenation, driving pressure, and cardiac output',
    ],
    stepDomains: [
      ['peep_hemodynamics', 'etco2_interpretation', 'cardiac_output'],
      ['individualized_peep', 'fio2_weaning'],
    ],
    teachingPoints: {
      peep_hemodynamics: [
        'PEEP increases mean intrathoracic pressure. This reduces the transmural gradient driving venous return → reduced preload → lower cardiac output.',
        'The hemodynamic consequence of PEEP is proportional to PEEP level, lung compliance, and the patient\'s volume status. Hypovolemic patients are most vulnerable.',
      ],
      etco2_interpretation: [
        'A gradual EtCO₂ fall after PEEP increase — with unchanged ventilation and a rectangular capnogram — is the monitor signature of reduced cardiac output, not hypoventilation.',
        'Recovery of EtCO₂ after lowering PEEP or giving fluid/vasopressor confirms that the problem was reduced pulmonary blood flow, not ventilator settings.',
      ],
      cardiac_output: [
        'SpO₂ and cardiac output can move in opposite directions after PEEP change. Better SpO₂ from recruitment is not worth the trade if cardiac output falls enough to reduce tissue oxygen delivery.',
        'Total oxygen delivery (DO₂) = CO × CaO₂. Even if SaO₂ = 100%, DO₂ falls if CO is low. Monitor both sides of the equation.',
      ],
      individualized_peep: [
        'The "best PEEP" is not a universal number — it is the level that maximizes alveolar recruitment without excessive driving pressure or hemodynamic compromise in that specific patient.',
        'Individualization requires monitoring the response: SpO₂, EtCO₂, blood pressure, and driving pressure before and after each PEEP change.',
      ],
      fio2_weaning: [
        'Once adequate oxygenation is achieved with an individualized PEEP, FiO₂ can be titrated down. Target SpO₂ 92–96% in most patients; avoid chronic hyperoxia.',
        'FiO₂ weaning should follow oxygenation recovery, not precede it. Do not lower FiO₂ prematurely to prove recruitment worked.',
      ],
    },
    drills: {
      peep_hemodynamics: [
        {
          prompt: 'After increasing PEEP from 8 to 14 cmH₂O, SpO₂ rises from 90% to 97%. EtCO₂ drops from 36 to 26 mmHg and BP falls from 118/70 to 84/48. The best interpretation is:',
          choices: [
            { text: 'PEEP is working — continue increasing it' },
            { text: 'PEEP improved oxygenation but reduced cardiac output — back down and support preload' },
            { text: 'The BP drop is from anesthetic depth — give less volatile agent' },
            { text: 'EtCO₂ drop means the patient is hyperventilating — reduce rate' },
          ],
          correct_index: 1,
          explanation: 'Simultaneous SpO₂ rise and EtCO₂/BP fall after PEEP increase indicates recruitment at the cost of cardiac output. The EtCO₂ drop with unchanged ventilation is the hemodynamic clue.',
        },
      ],
      individualized_peep: [
        {
          prompt: 'PEEP is lowered from 14 to 9 cmH₂O. SpO₂ drops from 97% to 95%, but EtCO₂ rises from 26 to 34 mmHg and BP recovers to 112/64. The correct conclusion is:',
          choices: [
            { text: 'The SpO₂ drop means PEEP 9 is too low — return to 14' },
            { text: 'PEEP 9 is a better balance — acceptable SpO₂ with recovered cardiac output' },
            { text: 'Oxygenation must always be maximized, regardless of hemodynamics' },
            { text: 'Lower PEEP further to 0 to confirm hemodynamic improvement' },
          ],
          correct_index: 1,
          explanation: 'SpO₂ 95% is acceptable. EtCO₂ and BP recovery confirm improved cardiac output. The individualized PEEP level is the one balancing all four parameters — not the one maximizing SpO₂ alone.',
        },
      ],
    },
  },

};
