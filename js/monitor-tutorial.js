/* monitor-tutorial.js — Sweep-style animated waveform tutorial modals */
(function () {
  'use strict';

  const BG = '#070f1e';

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRESET DATA
  // ═══════════════════════════════════════════════════════════════════════════

  const ECG_PRESETS = {
    normal:  { hr: 72,  morpho: 'normal',  interp: 'Normal sinus rhythm — regular rate, clear P before every QRS, rate 60–100 bpm. Normal intraoperative finding.' },
    tach:    { hr: 118, morpho: 'normal',  interp: 'Sinus tachycardia — rate >100 bpm, P wave still present. Common causes: pain, hypovolemia, light anesthesia, fever, beta-agonists.' },
    brady:   { hr: 45,  morpho: 'normal',  interp: 'Sinus bradycardia — rate <60 bpm, P wave present. Causes: deep anesthesia, opioids, neostigmine, vagal reflex. Treat if hemodynamically significant.' },
    afib:    { hr: 88,  morpho: 'afib',    interp: 'Atrial fibrillation — irregularly irregular, no discrete P waves, fibrillatory baseline. Confirm rate control and hemodynamic stability.' },
    flutter: { hr: 140, morpho: 'flutter', interp: 'Atrial flutter (2:1 block) — atrial rate ~280/min, ventricular rate ~140 bpm. Regular sawtooth "F" waves visible. Classic saw-tooth baseline in leads II, III, aVF.' },
    vtach:   { hr: 170, morpho: 'vtach',   interp: 'Ventricular tachycardia — wide complex >150 bpm, no P waves. CHECK PULSE immediately. Pulseless VT follows ACLS — defibrillation and CPR.' },
  };

  const ALINE_PRESETS = {
    normal:       { sys: 118, dia: 72,  map: 88, mode: 'normal',       interp: 'Normal A-line. Rapid upstroke, systolic peak, clear dicrotic notch at aortic valve closure, gradual diastolic run-off. Pulse pressure ~46 mmHg.' },
    hypotension:  { sys: 72,  dia: 42,  map: 52, mode: 'hypotension',  interp: 'Hypotension — reduced amplitude, narrow pulse pressure, low MAP. MAP <65 mmHg threatens organ perfusion. Consider vasopressor, volume, or source of bleeding.' },
    dampened:     { sys: 95,  dia: 65,  map: 75, mode: 'dampened',     interp: 'Dampened — rounded, slow upstroke, absent dicrotic notch. Likely a LINE issue (air bubble, clot, kink). Flush before treating the patient.' },
    hyperdynamic: { sys: 158, dia: 48,  map: 85, mode: 'hyperdynamic', interp: 'Hyperdynamic — tall sharp upstroke, wide pulse pressure (~110 mmHg). Seen in sepsis, high-output states, severe aortic regurgitation.' },
    overdamped:   { sys: 88,  dia: 72,  map: 77, mode: 'overdamped',   interp: 'Overdamped — near-flat waveform, undetectable features. Readings are unreliable. Flush, reposition, or replace line before clinical decisions.' },
  };

  const SPO2_PRESETS = {
    normal:           { val: 99, pi: 2.4, mode: 'normal',           interp: 'Normal pleth — tall amplitude, smooth rounded peak, visible dicrotic notch on descent. Perfusion index >1.0. SpO₂ 99% is accurate.' },
    lowperf:          { val: 94, pi: 0.3, mode: 'lowperf',          interp: 'Low perfusion — very small amplitude pleth, borderline SpO₂. Signal may be unreliable. Assess clinical perfusion: cap refill, skin temperature, A-line.' },
    vasoconstriction: { val: 97, pi: 0.7, mode: 'vasoconstriction', interp: 'Vasoconstriction — narrow, tall-peaked pulses. High vascular tone reduces pulse volume at the fingertip. Good number ≠ good perfusion.' },
    motion:           { val: 96, pi: 1.1, mode: 'motion',           interp: 'Motion artifact — chaotic, irregular waveform. SpO₂ number is unreliable. Reposition probe, minimize movement, confirm with A-line if needed.' },
  };

  const CAPNO_PRESETS = {
    normal:      { etco2: 36, rr: 12, mode: 'normal',       interp: 'Normal capnogram. Clear phases I–III, sharp downstroke. EtCO₂ 35–45 mmHg — adequate ventilation and perfusion.' },
    hypovent:    { etco2: 58, rr: 8,  mode: 'hypovent',     interp: 'Hypoventilation — elevated plateau, EtCO₂ >45 mmHg. Increase RR or tidal volume. Check for opioid effect, muscle relaxation, or circuit obstruction.' },
    hypervent:   { etco2: 24, rr: 22, mode: 'hypervent',    interp: 'Hyperventilation — low, flat plateau, EtCO₂ <35 mmHg. Risk: cerebral vasoconstriction. Reduce rate or tidal volume.' },
    bronchospasm:{ etco2: 52, rr: 14, mode: 'bronchospasm', interp: 'Bronchospasm — "shark-fin" shape: obstructed, uneven expiratory flow creates upsloping Phase III. Treat with bronchodilator.' },
    curare:      { etco2: 38, rr: 14, mode: 'curare',       interp: 'Curare cleft — notch in Phase III from a spontaneous breath. Suggests partial NMB reversal or inadequate paralysis. Assess TOF.' },
    esophageal:  { etco2: 0,  rr: 0,  mode: 'esophageal',   interp: 'Esophageal intubation — FLAT LINE. No CO₂ detected. Capnography is the gold standard for tube confirmation. Remove and reintubate immediately.' },
    lowco:       { etco2: 20, rr: 12, mode: 'lowco',        interp: 'Low cardiac output — EtCO₂ drops despite unchanged ventilation. Less blood delivers CO₂ to alveoli. Think: PE, cardiac arrest, severe hypotension.' },
    rebreathing: { etco2: 42, rr: 12, mode: 'rebreathing',  interp: 'Rebreathing — baseline does not return to zero. Inspired CO₂ is non-zero. Check CO₂ absorber, fresh gas flow, or circuit valve integrity.' },
  };

  const GAS_PRESETS = {
    maintenance: { etco2: 36, fio2: 60, eto2: 52, fisevo: 2.3, etsevo: 2.1, mac: 0.95, gasMode: 'maintenance',
      interp: 'Steady-state maintenance. FiSevo ≈ EtSevo — patient equilibrated. EtCO₂ and EtO₂ normal. Small Fi–Et gradient is expected.' },
    induction:   { etco2: 38, fio2: 80, eto2: 66, fisevo: 6.0, etsevo: 2.2, mac: 1.00, gasMode: 'induction',
      interp: 'Induction — FiSevo high (vaporizer opened). EtSevo lags as tissues absorb agent. Large Fi–Et gradient during uptake phase (10–20 min).' },
    emergence:   { etco2: 34, fio2: 100, eto2: 88, fisevo: 0.0, etsevo: 0.6, mac: 0.27, gasMode: 'emergence',
      interp: 'Emergence — vaporizer off, FiSevo = 0. EtSevo declining as agent redistributes. BIS rises. Patient will respond to stimulation as MAC falls below 0.4.' },
    rebreathing: { etco2: 42, fio2: 60, eto2: 44, fisevo: 2.3, etsevo: 2.1, mac: 0.95, gasMode: 'rebreathing',
      interp: 'Rebreathing — CO₂ baseline elevated. Inspired CO₂ non-zero. CO₂ absorber may be exhausted or fresh gas flow insufficient.' },
    lowco:       { etco2: 20, fio2: 80, eto2: 70, fisevo: 2.3, etsevo: 1.9, mac: 0.86, gasMode: 'lowco',
      interp: 'Low cardiac output — EtCO₂ drops while ventilation unchanged. Less blood reaches lungs to offload CO₂. Early hemodynamic warning sign.' },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  WAVEFORM GENERATORS  (phase 0→1, return normalized float)
  // ═══════════════════════════════════════════════════════════════════════════

  function g(x, mu, sig, amp) {
    return amp * Math.exp(-0.5 * ((x - mu) / sig) ** 2);
  }

  function waveECG(phase, morpho) {
    if (morpho === 'afib') {
      // Irregularly irregular: multiple Gaussian QRS + fibrillatory f-wave noise
      return g(phase, 0.33, 0.012, -0.10) + g(phase, 0.37, 0.015, 0.90) +
             g(phase, 0.41, 0.012, -0.15) + g(phase, 0.62, 0.038, 0.22) +
             0.032 * Math.sin(phase * 89 + 1.3) + 0.018 * Math.sin(phase * 63 + 2.1);
    }
    if (morpho === 'vtach') {
      // Wide complex: broad QRS, no P, negative T (fusion morphology)
      return g(phase, 0.28, 0.060, -0.32) + g(phase, 0.38, 0.060, 1.05) +
             g(phase, 0.52, 0.055, -0.42) + g(phase, 0.72, 0.060, -0.32);
    }
    if (morpho === 'flutter') {
      // Classic upstroking sawtooth F-waves (2:1 block, atrial ~280/min, ventricular ~140 bpm)
      // Each F-wave: sharp positive upstroke → gradual descent → brief isoelectric before QRS
      function fSaw(ph) {
        if (ph < 0.02) return 0;
        if (ph < 0.16) return (ph - 0.02) / 0.14;      // F1 sharp upstroke (▲)
        if (ph < 0.46) return 1 - (ph - 0.16) / 0.30;  // F1 gradual descent  (\_)
        if (ph < 0.52) return 0;                         // brief isoelectric (QRS space)
        if (ph < 0.66) return (ph - 0.52) / 0.14;       // F2 sharp upstroke (▲)
        if (ph < 0.96) return 1 - (ph - 0.66) / 0.30;  // F2 gradual descent  (\_)
        return 0;
      }
      const fWave = 0.27 * fSaw(phase);
      const qrs   = g(phase, 0.48, 0.012, -0.10)
                  + g(phase, 0.52, 0.014,  0.82)
                  + g(phase, 0.56, 0.012, -0.15);
      return fWave + qrs;
    }
    // Normal sinus — same morphology for normal/tach/brady; speed drives the rate
    return g(phase, 0.10, 0.024, 0.18) +
           g(phase, 0.33, 0.012, -0.10) + g(phase, 0.37, 0.015, 1.00) + g(phase, 0.41, 0.012, -0.17) +
           g(phase, 0.62, 0.040, 0.28);
  }

  // A-line: all values normalized to 0–1 scale (where 120 mmHg = 1.0)
  function waveALine(phase, mode) {
    if (mode === 'overdamped') {
      // Near-flat: barely pulsatile, no features
      return 0.58 + 0.055 * Math.exp(-((phase - 0.28) ** 2) / 0.090);
    }
    if (mode === 'dampened') {
      // Rounded, slow upstroke, no dicrotic notch — air/clot in line
      return 0.57 + 0.195 * Math.exp(-((phase - 0.26) ** 2) / 0.038);
    }

    const MODES = {
      normal:       { sys: 0.98, dia: 0.58, notchH: 0.740, decK: 5.8 },
      hypotension:  { sys: 0.55, dia: 0.34, notchH: 0.440, decK: 5.8 },
      hyperdynamic: { sys: 1.30, dia: 0.40, notchH: 0.870, decK: 4.6 },
    };
    const c = MODES[mode] || MODES.normal;

    const upEnd  = 0.08; // end of upstroke
    const pkEnd  = 0.13; // end of systolic peak plateau
    const notchP = 0.30; // dicrotic notch — closer to systolic peak

    if (phase < upEnd) {
      const t = phase / upEnd;
      return c.dia + (c.sys - c.dia) * (1 - Math.exp(-9 * t));
    }
    if (phase < pkEnd) {
      return c.sys;
    }
    const d = (phase - pkEnd) / (1 - pkEnd);
    const decay = (c.sys - c.dia) * Math.exp(-c.decK * d) + c.dia;
    // Dicrotic notch: compute bump amplitude above the smooth decay at notch phase
    const dNotch = (notchP - pkEnd) / (1 - pkEnd);
    const baseAtNotch = (c.sys - c.dia) * Math.exp(-c.decK * dNotch) + c.dia;
    const notchAmp = Math.max(0, c.notchH - baseAtNotch);
    return Math.max(c.dia * 0.88, decay + notchAmp * g(phase, notchP, 0.022, 1.0));
  }

  // SpO2 pleth: each mode has distinct amplitude AND morphology
  function waveSPO2(phase, mode) {
    // Asymmetric base pleth: fast rise, smooth peak, gradual descent, small dicrotic inflection
    function basePleth(ph) {
      if (ph < 0.28) return (ph / 0.28) ** 1.35; // convex upstroke
      const d = (ph - 0.28) / 0.72;
      return 0.96 * Math.exp(-2.15 * d) + 0.038 * g(ph, 0.62, 0.028, 1.0); // descent + notch
    }

    if (mode === 'normal') {
      return Math.max(0, 0.04 + 0.93 * basePleth(phase));
    }
    if (mode === 'lowperf') {
      // Very small amplitude — poor signal in shock/low CO
      return Math.max(0, 0.05 + 0.14 * basePleth(phase));
    }
    if (mode === 'vasoconstriction') {
      // Narrow, peaky pulses — vasoconstricted peripheral arterioles
      function narrowPleth(ph) {
        if (ph < 0.18) return (ph / 0.18) ** 1.6;
        const d = (ph - 0.18) / 0.82;
        return Math.exp(-4.2 * d); // faster collapse, no dicrotic notch
      }
      return Math.max(0, 0.04 + 0.36 * narrowPleth(phase));
    }
    if (mode === 'motion') {
      // Deterministic chaos: sum of incommensurate frequencies (no Math.random — avoids flicker)
      const chaos = 0.38 * Math.sin(7.13 * phase * Math.PI) +
                    0.24 * Math.sin(13.7  * phase * Math.PI) +
                    0.16 * Math.sin(4.29  * phase * Math.PI + 1.3) +
                    0.10 * Math.sin(19.3  * phase * Math.PI + 0.7);
      return Math.max(0, Math.min(1, 0.46 + 0.22 * basePleth(phase) + chaos * 0.38));
    }
    return basePleth(phase);
  }

  // Capno: returns value in "EtCO2-proportional" units (1.0 = 36 mmHg)
  function waveCapno(phase, mode) {
    // Bronchospasm: normal Phase II upstroke, then continuously upsloping Phase III (shark-fin)
    if (mode === 'bronchospasm') {
      const peak = 1.52;
      const u2 = 0.28, u3 = 0.46, dn = 0.91;
      if (phase < u2) return 0;
      if (phase < u3) {
        // Normal-looking steep upstroke — student thinks it's a regular capnogram
        const t = (phase - u2) / (u3 - u2);
        return peak * 0.65 * (1 - Math.exp(-5 * t));
      }
      if (phase < dn) {
        // Shark-fin: Phase III never plateaus, keeps climbing linearly to peak
        const t = (phase - u3) / (dn - u3);
        return peak * (0.65 + 0.35 * t);
      }
      const t = (phase - dn) / (1 - dn);
      return peak * Math.exp(-10 * t);   // sharp inspiratory downstroke
    }

    const CFG = {
      normal:      { peak:1.00, base:0.00, u2:0.30, u3:0.52, sl:0.05, dn:0.80 },
      hypovent:    { peak:1.61, base:0.00, u2:0.28, u3:0.52, sl:0.09, dn:0.78 },
      hypervent:   { peak:0.67, base:0.00, u2:0.32, u3:0.50, sl:0.02, dn:0.83 },
      curare:      { peak:1.00, base:0.00, u2:0.30, u3:0.52, sl:0.05, dn:0.80, curare:true },
      esophageal:  { flat:true },
      lowco:       { peak:0.56, base:0.00, u2:0.30, u3:0.52, sl:0.02, dn:0.80 },
      rebreathing: { peak:1.12, base:0.33, u2:0.30, u3:0.52, sl:0.06, dn:0.80 },
      maintenance: { peak:1.00, base:0.00, u2:0.30, u3:0.52, sl:0.05, dn:0.80 },
      induction:   { peak:1.06, base:0.00, u2:0.30, u3:0.52, sl:0.05, dn:0.80 },
      emergence:   { peak:0.94, base:0.00, u2:0.30, u3:0.52, sl:0.04, dn:0.82 },
    };
    const c = CFG[mode] || CFG.normal;
    if (c.flat) return 0;
    const { peak, base, u2, u3, sl, dn } = c;
    if (phase < u2) return base;
    if (phase < u3) { const t = (phase - u2) / (u3 - u2); return base + (peak - base) * (1 - Math.exp(-5 * t)); }
    if (phase < dn) {
      let v = peak + sl * (phase - u3) / (dn - u3);
      if (c.curare && phase > u3 + 0.35 * (dn - u3) && phase < u3 + 0.70 * (dn - u3)) {
        const t = (phase - (u3 + 0.35 * (dn - u3))) / (0.35 * (dn - u3));
        v -= 0.30 * peak * Math.sin(Math.PI * t);
      }
      return v;
    }
    const t = (phase - dn) / (1 - dn);
    return (peak + sl) * Math.exp(-9 * t) + base * (1 - Math.exp(-9 * t));
  }

  function waveO2(phase, gasMode) {
    const co2 = waveCapno(phase, gasMode === 'lowco' ? 'lowco' : gasMode === 'rebreathing' ? 'rebreathing' : 'normal');
    return 1 - co2 * 0.52;
  }

  function waveSevo(phase, gasMode) {
    const co2 = waveCapno(phase, gasMode === 'rebreathing' ? 'rebreathing' : 'normal');
    if (gasMode === 'induction')  return 0.12 + co2 * 0.38;
    if (gasMode === 'emergence')  return co2 * 0.09;
    return 0.82 + co2 * 0.18;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ANATOMY LABEL DEFINITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const LABELS = {
    ecg_normal:  [
      { phase: 0.10, text: 'P',   yOff: 10, rgb: '120,180,255' },
      { phase: 0.37, text: 'QRS', yOff: 12, rgb: '120,255,120' },
      { phase: 0.62, text: 'T',   yOff: 10, rgb: '120,180,255' },
    ],
    ecg_afib:    [
      { phase: 0.15, text: 'f', yOff: 8,  rgb: '255,180,100' },
      { phase: 0.37, text: 'QRS', yOff: 12, rgb: '120,255,120' },
      { phase: 0.55, text: 'f', yOff: 8,  rgb: '255,180,100' },
    ],
    ecg_flutter: [
      { phase: 0.16, text: 'F',   yOff: 10, rgb: '255,210,80' },
      { phase: 0.52, text: 'QRS', yOff: 12, rgb: '120,255,120' },
      { phase: 0.66, text: 'F',   yOff: 10, rgb: '255,210,80' },
    ],
    ecg_vtach:   [
      { phase: 0.38, text: 'Wide QRS', yOff: 14, rgb: '255,100,100' },
    ],
    abp_normal:       [
      { phase: 0.10, text: 'Systole',       yOff: 12, rgb: '255,160,160' },
      { phase: 0.30, text: '▾ Notch',       yOff: 8,  rgb: '255,210,210' },
      { phase: 0.78, text: 'Diastole', above: false, yOff: 8, rgb: '180,180,255' },
    ],
    abp_hypotension:  [
      { phase: 0.10, text: 'Systole',  yOff: 12, rgb: '255,160,160' },
      { phase: 0.78, text: 'Diastole', above: false, yOff: 8, rgb: '180,180,255' },
    ],
    abp_dampened:     [
      { phase: 0.26, text: 'Rounded Peak', yOff: 10, rgb: '255,200,160' },
    ],
    abp_hyperdynamic: [
      { phase: 0.10, text: 'Systole',      yOff: 14, rgb: '255,160,160' },
      { phase: 0.30, text: '▾ Notch',      yOff: 10, rgb: '255,210,210' },
      { phase: 0.78, text: 'Diastole', above: false, yOff: 8, rgb: '180,180,255' },
    ],
    abp_overdamped:   [
      { phase: 0.28, text: 'No Features', yOff: 10, rgb: '200,200,200' },
    ],
    spo2_normal:          [{ phase: 0.28, text: 'Peak',       yOff: 12, rgb: '100,235,255' }],
    spo2_lowperf:         [{ phase: 0.28, text: '▾ Low Amp',  yOff: 8,  rgb: '255,180,100' }],
    spo2_vasoconstriction:[{ phase: 0.18, text: 'Narrow',     yOff: 10, rgb: '255,200,120' }],
    spo2_motion:          [{ phase: 0.30, text: 'Artifact',   yOff: 10, rgb: '255,120,120' }],
    capno_normal:     [
      { phase: 0.15, text: 'I',      yOff: 8,  rgb: '100,170,255' },
      { phase: 0.41, text: 'II',     yOff: 12, rgb: '255,230,100' },
      { phase: 0.65, text: 'III',    yOff: 12, rgb: '255,238,0' },
      { phase: 0.76, text: 'EtCO₂', yOff: 14, rgb: '255,238,0' },
    ],
    capno_bronchospasm: [
      { phase: 0.88, text: 'Shark-fin Peak', yOff: 14, rgb: '255,150,80' },
      { phase: 0.58, text: '▲ Phase III', yOff: 12, rgb: '255,190,100' },
    ],
    capno_rebreathing: [
      { phase: 0.15, text: '↑ Baseline', above: false, yOff: 8, rgb: '255,180,100' },
    ],
    capno_esophageal: [
      { phase: 0.50, text: 'No CO₂ — Esophageal!', yOff: 10, rgb: '255,80,80' },
    ],
    capno_curare: [
      { phase: 0.55, text: 'Curare Cleft', yOff: 10, rgb: '255,200,100' },
    ],
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  SWEEP ANIMATION ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * makeAnim — sweep waveform (left→right, wrapping with eraser)
   * @param {HTMLCanvasElement} canvas
   * @param {{ fn: Function }} sampleFnRef  — mutable; update .fn to change waveform
   * @param {string} color                 — CSS color for the trace
   * @param {{ val: number }} speedRef     — mutable pixels/second
   * @param {{ lo: number, hi: number }|null} fixedRange — fixed Y scale (capno only)
   * @param {Function|null} getLabelDefs   — returns anatomy label array for current state
   * @param {number} nCycles               — how many cycles to show (default 3.5)
   * @param {Object|null} scaleLines       — optional custom y-axis scale
   *   { ticks: number[], toNorm: fn, lineColor, textColor, unit }
   */
  function makeAnim(canvas, sampleFnRef, color, speedRef, fixedRange, getLabelDefs, nCycles, scaleLines) {
    nCycles = nCycles || 3.5;
    const W = canvas.width, H = canvas.height;
    const padT = 24, padB = 10, drawH = H - padT - padB;
    const CYCLE_W = W / nCycles;
    const ERASER = 22; // pixels cleared ahead of sweep

    const ctx = canvas.getContext('2d');
    const buf = document.createElement('canvas');
    buf.width = W; buf.height = H;
    const bx = buf.getContext('2d');

    let raf = null, lastTs = null, totalPx = 0;
    let lo, hi, range;

    function computeRange() {
      if (fixedRange) { lo = fixedRange.lo; hi = fixedRange.hi; }
      else {
        lo = Infinity; hi = -Infinity;
        for (let i = 0; i <= 400; i++) {
          const v = sampleFnRef.fn(i / 400);
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        const pad = (hi - lo) * 0.14;
        lo -= pad; hi += pad;
      }
      range = Math.max(hi - lo, 0.001);
    }

    function yOf(v) {
      return padT + drawH * (1 - ((v - lo) / range * 0.82 + 0.09));
    }

    function initBuf() {
      bx.fillStyle = BG; bx.fillRect(0, 0, W, H);
      bx.strokeStyle = 'rgba(255,255,255,0.045)'; bx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(f => {
        const y = padT + drawH * f;
        bx.beginPath(); bx.moveTo(0, y); bx.lineTo(W, y); bx.stroke();
      });
    }

    function drawSegment(fromPx, toPx) {
      if (toPx <= fromPx) return;
      const steps = Math.max(2, Math.ceil((toPx - fromPx) * 1.8));
      bx.strokeStyle = color; bx.lineWidth = 2.2;
      bx.lineJoin = 'round'; bx.lineCap = 'round';
      bx.beginPath();
      let prevX = -1, open = false;
      for (let i = 0; i <= steps; i++) {
        const px = fromPx + (toPx - fromPx) * i / steps;
        const x = px % W;
        const y = yOf(sampleFnRef.fn((px / CYCLE_W) % 1));
        if (!open || x < prevX - 0.5) {
          if (open) bx.stroke();
          bx.beginPath(); bx.moveTo(x, y); open = true;
        } else {
          bx.lineTo(x, y);
        }
        prevX = x;
      }
      if (open) bx.stroke();
    }

    function clearEraser(sweepX) {
      const e2 = (sweepX + ERASER) % W;
      bx.fillStyle = BG;
      if (e2 > sweepX) {
        bx.fillRect(sweepX, 0, ERASER, H);
      } else {
        bx.fillRect(sweepX, 0, W - sweepX, H);
        bx.fillRect(0, 0, e2, H);
      }
      // Restore grid inside eraser
      bx.strokeStyle = 'rgba(255,255,255,0.045)'; bx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(f => {
        const y = padT + drawH * f;
        bx.beginPath();
        if (e2 > sweepX) { bx.moveTo(sweepX, y); bx.lineTo(sweepX + ERASER, y); }
        else              { bx.moveTo(sweepX, y); bx.lineTo(W, y); bx.moveTo(0, y); bx.lineTo(e2, y); }
        bx.stroke();
      });
    }

    function drawLabels(sweepX) {
      const defs = getLabelDefs ? getLabelDefs() : null;
      if (!defs || !defs.length) return;
      ctx.save();
      ctx.font = '600 9px monospace';
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'center';
      defs.forEach(lbl => {
        const cycleN = Math.floor(totalPx / CYCLE_W);
        let lblPx = cycleN * CYCLE_W + lbl.phase * CYCLE_W;
        if (lblPx > totalPx) lblPx -= CYCLE_W;
        if (lblPx < 0) return;
        const age = totalPx - lblPx;
        if (age < 0 || age > CYCLE_W * 1.05) return;
        const lblX = lblPx % W;
        const distBehind = (sweepX - lblX + W) % W;
        if (distBehind < ERASER + 5 || distBehind > W - ERASER) return;
        const fadeStart = CYCLE_W * 0.58;
        const alpha = age < fadeStart ? 0.82 :
          Math.max(0, 0.82 * (1 - (age - fadeStart) / (CYCLE_W * 0.47)));
        if (alpha < 0.02) return;
        const vy = yOf(sampleFnRef.fn(lbl.phase));
        const ly = lbl.above === false ? vy + (lbl.yOff || 10) + 9 : vy - (lbl.yOff || 10);
        ctx.fillStyle = `rgba(${lbl.rgb || '200,220,244'},${alpha.toFixed(2)})`;
        ctx.fillText(lbl.text, lblX, ly);
      });
      ctx.restore();
    }

    function drawScaleLines() {
      if (!fixedRange && !scaleLines) return;
      ctx.save();
      ctx.setLineDash([3, 6]); ctx.lineWidth = 1;
      ctx.font = '9px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';

      if (scaleLines) {
        // Custom scale (e.g., A-line mmHg)
        scaleLines.ticks.forEach(val => {
          const v = scaleLines.toNorm(val);
          if (v < lo - 0.05 || v > hi + 0.05) return;
          const y = yOf(v);
          ctx.strokeStyle = scaleLines.lineColor || 'rgba(255,255,255,0.10)';
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          ctx.fillStyle = scaleLines.textColor || 'rgba(255,255,255,0.40)';
          ctx.fillText(val + (scaleLines.unit || ''), W - 3, y);
        });
      } else {
        // Capno mmHg scale
        [0, 20, 40, 60].forEach(mmhg => {
          const v = mmhg / 36;
          if (v < lo - 0.05 || v > hi + 0.05) return;
          const y = yOf(v);
          ctx.strokeStyle = 'rgba(255,238,0,0.11)';
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          ctx.fillStyle = 'rgba(255,238,0,0.38)';
          ctx.fillText(mmhg + '', W - 3, y);
        });
      }
      ctx.restore();
    }

    function tick(ts) {
      if (lastTs === null) { lastTs = ts; computeRange(); initBuf(); totalPx = 0; }
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      const newTotal = totalPx + speedRef.val * dt;
      drawSegment(totalPx, newTotal);
      const sweepX = Math.floor(newTotal % W);
      clearEraser(sweepX);
      totalPx = newTotal;

      // Composite: buffer → main canvas, then overlays
      ctx.drawImage(buf, 0, 0);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sweepX, padT - 2); ctx.lineTo(sweepX, H - padB + 2); ctx.stroke();
      ctx.restore();
      drawLabels(sweepX);
      drawScaleLines();
      raf = requestAnimationFrame(tick);
    }

    return {
      start() { if (!raf) { lastTs = null; raf = requestAnimationFrame(tick); } },
      stop()  { if (raf)  { cancelAnimationFrame(raf); raf = null; } },
      reset() { lastTs = null; }, // forces range recompute + clear on next tick
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SPEED HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Speed (px/s) = cycleWidth * (rate/60)
  // cycleWidth for main canvas (700px) at 3.5 cycles = 200px
  // cycleWidth for capno (700px) at 2.5 cycles = 280px
  // cycleWidth for gas canvas (440px) at 2.5 cycles = 176px

  const MAIN_CW   = 700 / 3.5;  // 200 px/cycle (ECG, A-line, SpO2, capno in sweep)
  const CAPNO_CW  = 700 / 2.5;  // 280 px/cycle (capno uses nCycles=2.5)
  const GAS_CW    = 440 / 2.5;  // 176 px/cycle

  function hrSpeed(hr)  { return MAIN_CW  * (hr / 60); }
  function rrSpeed(rr)  { return CAPNO_CW * (rr / 60); }
  function rrSpeedGas(rr){ return GAS_CW  * (rr / 60); }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MODAL INIT — ECG
  // ═══════════════════════════════════════════════════════════════════════════

  function initECGTutorial() {
    const dialog = document.getElementById('tut-ecg');
    const canvas = document.getElementById('tut-ecg-canvas');
    const sel    = document.getElementById('tut-ecg-select');
    if (!dialog || !canvas || !sel) return;

    let current = 'normal';
    const fnRef    = { fn: ph => waveECG(ph, 'normal') };
    const speedRef = { val: hrSpeed(72) };

    function getLabelDefs() {
      const morpho = ECG_PRESETS[current]?.morpho || 'normal';
      return LABELS['ecg_' + morpho] || LABELS.ecg_normal;
    }

    const anim = makeAnim(canvas, fnRef, '#00e676', speedRef, null, getLabelDefs, 3.5);

    function apply(key) {
      const p = ECG_PRESETS[key]; if (!p) return;
      current = key; sel.value = key;
      fnRef.fn    = ph => waveECG(ph, p.morpho);
      speedRef.val = hrSpeed(p.hr);
      anim.reset();
      const i = document.getElementById('tut-ecg-interp'); if (i) i.textContent = p.interp;
      const h = document.getElementById('tut-ecg-hr');     if (h) h.textContent = p.hr;
    }

    sel.addEventListener('change', () => apply(sel.value));
    dialog.addEventListener('toggle', e => {
      if (e.newState === 'open') { apply(current); anim.start(); }
      else anim.stop();
    });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.querySelector('[data-tut-reset]')?.addEventListener('click', () => apply('normal'));
    document.getElementById('trig-ecg')?.addEventListener('click', () => dialog.showModal());
    apply('normal');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MODAL INIT — A-Line
  // ═══════════════════════════════════════════════════════════════════════════

  function initALineTutorial() {
    const dialog = document.getElementById('tut-abp');
    const canvas = document.getElementById('tut-abp-canvas');
    const sel    = document.getElementById('tut-abp-select');
    if (!dialog || !canvas || !sel) return;

    let current = 'normal';
    const fnRef    = { fn: ph => waveALine(ph, 'normal') };
    const speedRef = { val: hrSpeed(72) };

    function getLabelDefs() {
      return LABELS['abp_' + current] || LABELS.abp_normal;
    }

    // Fixed y-axis so pulse-pressure differences are visible across presets
    const ALINE_RANGE = { lo: 0.18, hi: 1.46 };
    const ALINE_SCALE = {
      ticks:     [40, 80, 120, 160],
      toNorm:    v => v / 120,
      lineColor: 'rgba(255, 90, 90, 0.11)',
      textColor: 'rgba(255,170,170, 0.50)',
      unit: '',
    };
    const anim = makeAnim(canvas, fnRef, '#ff4c4c', speedRef, ALINE_RANGE, getLabelDefs, 3.5, ALINE_SCALE);

    function apply(key) {
      const p = ALINE_PRESETS[key]; if (!p) return;
      current = key; sel.value = key;
      fnRef.fn    = ph => waveALine(ph, p.mode);
      speedRef.val = hrSpeed(72); // A-line rate always HR=72 for all presets (morphology is the teaching point)
      anim.reset();
      const i = document.getElementById('tut-abp-interp'); if (i) i.textContent = p.interp;
      const s = document.getElementById('tut-abp-sys');    if (s) s.textContent = p.sys;
      const d = document.getElementById('tut-abp-dia');    if (d) d.textContent = p.dia;
      const m = document.getElementById('tut-abp-map');    if (m) m.textContent = p.map;
    }

    sel.addEventListener('change', () => apply(sel.value));
    dialog.addEventListener('toggle', e => {
      if (e.newState === 'open') { apply(current); anim.start(); }
      else anim.stop();
    });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.querySelector('[data-tut-reset]')?.addEventListener('click', () => apply('normal'));
    document.getElementById('trig-abp')?.addEventListener('click', () => dialog.showModal());
    apply('normal');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MODAL INIT — SpO2
  // ═══════════════════════════════════════════════════════════════════════════

  function initSpO2Tutorial() {
    const dialog = document.getElementById('tut-spo2');
    const canvas = document.getElementById('tut-spo2-canvas');
    const sel    = document.getElementById('tut-spo2-select');
    if (!dialog || !canvas || !sel) return;

    let current = 'normal';
    const fnRef    = { fn: ph => waveSPO2(ph, 'normal') };
    const speedRef = { val: hrSpeed(72) };

    function getLabelDefs() {
      return LABELS['spo2_' + current] || LABELS.spo2_normal;
    }

    const anim = makeAnim(canvas, fnRef, '#00e5ff', speedRef, null, getLabelDefs, 3.5);

    function apply(key) {
      const p = SPO2_PRESETS[key]; if (!p) return;
      current = key; sel.value = key;
      fnRef.fn    = ph => waveSPO2(ph, p.mode);
      speedRef.val = hrSpeed(72);
      anim.reset();
      const i  = document.getElementById('tut-spo2-interp'); if (i)  i.textContent  = p.interp;
      const v  = document.getElementById('tut-spo2-val');    if (v)  v.textContent  = p.val;
      const pi = document.getElementById('tut-spo2-pi');     if (pi) pi.textContent = p.pi;
    }

    sel.addEventListener('change', () => apply(sel.value));
    dialog.addEventListener('toggle', e => {
      if (e.newState === 'open') { apply(current); anim.start(); }
      else anim.stop();
    });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.querySelector('[data-tut-reset]')?.addEventListener('click', () => apply('normal'));
    document.getElementById('trig-spo2')?.addEventListener('click', () => dialog.showModal());
    apply('normal');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MODAL INIT — Capnography (tabbed)
  // ═══════════════════════════════════════════════════════════════════════════

  function initCapnoTutorial() {
    const dialog = document.getElementById('tut-etco2');
    if (!dialog) return;

    const CAPNO_RANGE = { lo: 0, hi: 1.85 };

    // ── Basics tab ──
    const basicsCanvas = document.getElementById('tut-etco2-canvas-basics');
    const basicsFnRef  = { fn: ph => waveCapno(ph, 'normal') };
    const basicsSpeed  = { val: rrSpeed(12) };
    const basicsLabels = () => LABELS.capno_normal;
    const basicsAnim = basicsCanvas
      ? makeAnim(basicsCanvas, basicsFnRef, '#ffee00', basicsSpeed, CAPNO_RANGE, basicsLabels, 2.5)
      : null;

    // ── Patterns tab ──
    const patCanvas = document.getElementById('tut-etco2-canvas-patterns');
    const patFnRef  = { fn: ph => waveCapno(ph, 'normal') };
    const patSpeed  = { val: rrSpeed(12) };
    let   curPat    = 'normal';

    function getPatLabels() {
      return LABELS['capno_' + curPat] || LABELS.capno_normal;
    }

    const patAnim = patCanvas
      ? makeAnim(patCanvas, patFnRef, '#ffee00', patSpeed, CAPNO_RANGE, getPatLabels, 2.5)
      : null;

    function applyPattern(key) {
      const p = CAPNO_PRESETS[key]; if (!p) return;
      curPat = key;
      const s = document.getElementById('tut-etco2-select'); if (s) s.value = key;
      patFnRef.fn    = ph => waveCapno(ph, key);
      patSpeed.val   = rrSpeed(Math.max(p.rr, 4));
      patAnim?.reset();
      const i = document.getElementById('tut-etco2-interp'); if (i) i.textContent = p.interp;
      const v = document.getElementById('tut-etco2-val');    if (v) v.textContent = p.etco2;
      const r = document.getElementById('tut-etco2-rr');     if (r) r.textContent = p.rr;
    }

    document.getElementById('tut-etco2-select')
      ?.addEventListener('change', e => applyPattern(e.target.value));

    // ── Gas monitoring tab ──
    const co2Canvas  = document.getElementById('tut-gas-co2');
    const o2Canvas   = document.getElementById('tut-gas-o2');
    const sevoCanvas = document.getElementById('tut-gas-sevo');

    const co2Ref   = { fn: ph => waveCapno(ph, 'maintenance') };
    const o2Ref    = { fn: ph => waveO2(ph,   'maintenance') };
    const sevoRef  = { fn: ph => waveSevo(ph,  'maintenance') };
    const gasSpeedCO2  = { val: rrSpeedGas(12) };
    const gasSpeedO2   = { val: rrSpeedGas(12) };
    const gasSpeedSevo = { val: rrSpeedGas(12) };
    let curGas = 'maintenance';

    const gasAnims = [
      co2Canvas  ? makeAnim(co2Canvas,  co2Ref,  '#ffee00', gasSpeedCO2,  CAPNO_RANGE, null, 2.5) : null,
      o2Canvas   ? makeAnim(o2Canvas,   o2Ref,   '#00e5ff', gasSpeedO2,   null,        null, 2.5) : null,
      sevoCanvas ? makeAnim(sevoCanvas, sevoRef, '#c084fc', gasSpeedSevo, null,        null, 2.5) : null,
    ];

    function applyGas(key) {
      const p = GAS_PRESETS[key]; if (!p) return;
      curGas = key;
      const s = document.getElementById('tut-gas-select'); if (s) s.value = key;
      co2Ref.fn   = ph => waveCapno(ph, p.gasMode);
      o2Ref.fn    = ph => waveO2(ph,    p.gasMode);
      sevoRef.fn  = ph => waveSevo(ph,  p.gasMode);
      [gasSpeedCO2, gasSpeedO2, gasSpeedSevo].forEach(r => { r.val = rrSpeedGas(12); });
      gasAnims.forEach(a => a?.reset());
      const i = document.getElementById('tut-gas-interp'); if (i) i.textContent = p.interp;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('tut-gas-etco2',  p.etco2);
      set('tut-gas-fio2',   p.fio2);
      set('tut-gas-eto2',   p.eto2);
      set('tut-gas-fisevo', p.fisevo.toFixed(1));
      set('tut-gas-etsevo', p.etsevo.toFixed(1));
      set('tut-gas-mac',    p.mac.toFixed(2));
    }

    document.getElementById('tut-gas-select')
      ?.addEventListener('change', e => applyGas(e.target.value));

    // ── Tab switching ──
    let activeTab = 'basics';
    const allAnims = [basicsAnim, patAnim, ...gasAnims].filter(Boolean);

    function stopAll()       { allAnims.forEach(a => a.stop()); }
    function startActive(t)  {
      stopAll();
      if (t === 'basics')  basicsAnim?.start();
      if (t === 'patterns') patAnim?.start();
      if (t === 'gasmon')  gasAnims.forEach(a => a?.start());
    }

    dialog.querySelectorAll('.mon-tut__tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tab; activeTab = t;
        dialog.querySelectorAll('.mon-tut__tab').forEach(b =>
          b.classList.toggle('mon-tut__tab--active', b.dataset.tab === t));
        dialog.querySelectorAll('.mon-tut__tab-panel').forEach(p =>
          p.hidden = p.id !== 'tut-etco2-' + t);
        startActive(t);
      });
    });

    dialog.addEventListener('toggle', e => {
      if (e.newState === 'open') {
        applyPattern(curPat); applyGas(curGas); startActive(activeTab);
      } else stopAll();
    });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.querySelector('[data-tut-reset]')?.addEventListener('click', () => {
      applyPattern('normal'); applyGas('maintenance');
    });

    document.getElementById('trig-etco2')?.addEventListener('click', () => dialog.showModal());
    applyPattern('normal'); applyGas('maintenance');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  GLOBAL CLOSE WIRING + BOOT
  // ═══════════════════════════════════════════════════════════════════════════

  window.addEventListener('DOMContentLoaded', function () {
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-tut-close]');
      if (el) document.getElementById(el.dataset.tutClose)?.close();
    });
    initECGTutorial();
    initALineTutorial();
    initSpO2Tutorial();
    initCapnoTutorial();
  });

})();
