# Anesthesia Playground — Scenario Generation Prompt

## Context

You are helping generate clinical scenario content for **Anesthesia Playground**
(anesthesia.guide), an interactive web simulator for medical students and residents
on anesthesia rotations. The simulator shows a live ventilator (waveforms, pressure,
flow, capnogram), vitals monitor (arterial line, SpO₂, HR, EtCO₂, BIS), and Pyxis
cabinet. Students step through a 2–4 step clinical case, choose from 4 options at
each step, and receive physiological feedback based on their choice.

## Your Task

Research and generate **3 clinical scenarios** that are:

- **Bread-and-butter** cases an anesthesia student WILL encounter on rotation
- **Physiologically rich** — the ventilator waveforms, EtCO₂, and hemodynamics tell the story (not just "patient looks sick")
- **Interesting and educational** — not obscure, but with a teaching point that isn't obvious at first glance
- **2–4 steps each** — start with deterioration, progress through one or two interventions, end with a resolution or near-resolution state
- Do **NOT** give the answer away in the clue. The clue describes what the monitors/waveforms show; the student must interpret them.

## Suggested Topic Areas (pick 3, or propose your own)

- Pulmonary embolism under general anesthesia
- Endobronchial / right mainstem intubation
- ARDS plateau pressure management & driving pressure
- Tension pneumothorax (intraoperative)
- Opioid-induced muscle rigidity ("wooden chest")
- Mucus plug / lobar atelectasis
- Carbon dioxide embolism during laparoscopy
- Massive hemorrhage + coagulopathy
- High spinal / total spinal anesthesia
- Hyperkalemia from succinylcholine / rhabdomyolysis

---

## Output Format (STRICT — copy this structure exactly)

For each scenario, fill in the following JSON object.
Return all 3 scenarios as a single JSON array `[{...}, {...}, {...}]`.

```json
{
  "id": "short_snake_case_id",
  "title": "Scenario Title (5 words or fewer)",
  "badge": "Hemodynamics | Emergency | Airway",
  "badgeColor": "#ff6060 for Hemodynamics | #ff3333 for Emergency | #3399ff for Airway",
  "summary": "1–2 sentence hook shown on the scenario card. Sets the scene without revealing the diagnosis.",

  "initialPatient": {
    "compliance": 30,       // lung compliance mL/cmH₂O  (normal ≈ 50–70; low = stiff lungs)
    "resistance": 8,        // airway resistance cmH₂O/L/s (normal ≈ 5–8; high = obstruction)
    "co2Prod": 200,         // CO₂ production mL/min (normal awake ≈ 200; anesthetized ≈ 150–180)
    "leak": 0,              // circuit leak fraction 0–1  (0 = no leak)
    "cardiacOutput": 1.0    // relative cardiac output (1.0 = normal; 0.5 = severely reduced)
  },

  "initialVitals": {
    "hr": 90,               // heart rate bpm
    "sysBP": 110,           // systolic BP mmHg  (arterial line)
    "diaBP": 65,            // diastolic BP mmHg
    "spo2": 99,             // SpO₂ %
    "bis": 48,              // BIS index (40–60 = adequate anesthesia)
    "etco2Display": 35      // end-tidal CO₂ mmHg shown on capnogram
  },

  "initialVent": {
    "tv": 480,              // tidal volume mL  (typically 6–8 mL/kg IBW)
    "rr": 12,               // respiratory rate breaths/min
    "peep": 5,              // PEEP cmH₂O
    "fio2": 50,             // FiO₂ %  (21–100)
    "ti": 1.0               // inspiratory time in seconds
  },

  "steps": [
    {
      "phase": "Deterioration | Intervention | Resolution",

      "clue": "Key clue: Describe ONLY what the monitor and ventilator are showing in objective terms — numbers, waveform morphology, trends. Do NOT name the diagnosis. Do NOT say what to do. Example: 'Peak inspiratory pressure has risen to 42 cmH₂O while plateau pressure is 41 cmH₂O — a narrow peak-to-plateau gap. SpO₂ is 91% and falling. EtCO₂ has dropped abruptly from 38 to 18 mmHg. HR is 140, BP 70/40.'",

      "question": "The clinical question posed to the student. Provide enough context (vitals, vent numbers) to reason through the decision, but do not reveal the answer. End with a clear decision point. Example: 'Peak pressures are 42 cmH₂O, Pplat is 41 cmH₂O, SpO₂ 91% and falling, EtCO₂ dropped from 38 to 18 mmHg. What is your most urgent next step?'",

      "passiveDeterior": {
        "rate": 0.002,
        "vit": { "sysBP": -15, "spo2": -3 },
        "patient": { "cardiacOutput": -0.1 }
      },

      "choices": [
        {
          "text": "A. [Wrong choice — plausible but incorrect intervention]",
          "isCorrect": false,
          "feedback": "Incorrect. Explain WHY this is wrong physiologically and what would actually happen if you did this.",
          "effects": {
            "patient": {},
            "vit": { "sysBP": -10 },
            "vent": {},
            "overlaySpeed": 0.018
          }
        },
        {
          "text": "B. [Correct choice]",
          "isCorrect": true,
          "feedback": "Correct. Explain the physiology clearly. Connect what the monitor showed to why this intervention works. Describe what the student should expect to see change on the ventilator and vitals after acting.",
          "effects": {
            "patient": { "cardiacOutput": 0.2 },
            "vit": { "sysBP": 30, "spo2": 3 },
            "vent": {},
            "overlaySpeed": 0.030
          }
        },
        {
          "text": "C. [Wrong choice — a common misconception]",
          "isCorrect": false,
          "feedback": "Incorrect. Address the misconception directly.",
          "effects": { "patient": {}, "vit": {}, "vent": {}, "overlaySpeed": 0.018 }
        },
        {
          "text": "D. [Wrong choice — dangerous or do-nothing option]",
          "isCorrect": false,
          "feedback": "Incorrect. Explain what happens physiologically if this choice is made or nothing is done.",
          "effects": { "patient": { "cardiacOutput": -0.15 }, "vit": { "sysBP": -20 }, "vent": {}, "overlaySpeed": 0.015 }
        }
      ]
    }
  ],

  "resolution": "1–3 sentence teaching summary shown after the case. Summarize the key physiological teaching point, the monitor finding that should have tipped the student off, and a high-yield clinical pearl."
}
```

---

## Physiology Cheat Sheet (use to calibrate `initialPatient` and `effects`)

| Parameter | Normal | Obstructive (asthma/COPD) | Restrictive (ARDS/fibrosis) | Cardiogenic shock |
|---|---|---|---|---|
| Compliance (mL/cmH₂O) | 50–70 | 60–80 | 15–35 | 40–55 |
| Resistance (cmH₂O/L/s) | 5–8 | 20–50 | 8–12 | 6–10 |
| CardiacOutput (relative) | 1.0 | 0.9 | 0.85 | 0.35–0.55 |
| EtCO₂ (mmHg) | 34–40 | 40–55 | 30–38 | 18–28 |
| PIP (cmH₂O) | 18–24 | 35–50 | 30–45 | 20–28 |
| Pplat (cmH₂O) | 15–22 | 18–24 | 28–42 | 16–22 |
| SpO₂ (%) | 98–100 | 92–98 | 88–95 | 94–98 |

**Key waveform patterns to reference in clues:**

- Peak-to-plateau gap > 10 cmH₂O → airway resistance problem (bronchospasm, secretions, kinked/endobronchial tube)
- Peak-to-plateau gap < 5 cmH₂O → compliance problem (pneumothorax, ARDS, obesity, abdominal compartment)
- EtCO₂ sudden drop → PE, air/CO₂ embolism, cardiac arrest, circuit disconnect
- EtCO₂ gradual drop → falling cardiac output, hyperventilation
- EtCO₂ rise → hypoventilation, CO₂ absorption (laparoscopy), malignant hyperthermia
- Expiratory flow not returning to zero → auto-PEEP / air trapping
- Shark-fin capnogram upslope → expiratory obstruction (bronchospasm, COPD)
- Asymmetric chest rise + unilateral breath sounds → endobronchial intubation or pneumothorax

---

## Quality Checklist

Before finalizing each scenario, verify every item below:

- [ ] The clue is objective and does NOT name the diagnosis or suggest the intervention
- [ ] The question provides enough numbers for the student to reason through
- [ ] All 4 choices are plausible — no obviously silly distractors
- [ ] The correct feedback connects: physiology → monitor finding → intervention → expected change
- [ ] Each wrong feedback explains the physiological consequence of that choice
- [ ] The `effects` deltas are directionally correct (e.g., vasopressor → sysBP increases)
- [ ] `overlaySpeed` for the correct choice is higher (≥ 0.025) than wrong choices (≈ 0.015–0.018)
- [ ] The resolution has one clear, memorable teaching point a student can carry to the OR

---

## Return Format

Return your output as a **valid JSON array** of exactly 3 scenario objects, with no extra commentary outside the JSON block. Example wrapper:

```json
[
  { ...scenario 1... },
  { ...scenario 2... },
  { ...scenario 3... }
]
```

Once the JSON is reviewed and approved, it will be passed directly to the Cursor coding agent, which will insert the scenarios into the simulator's `SCENARIOS` array in `ventilator.js` and wire up all rendering logic automatically.
