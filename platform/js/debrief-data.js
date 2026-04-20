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

};
