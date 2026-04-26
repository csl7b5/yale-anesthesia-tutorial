/* ventilator-wave-tutorial.js — Interactive Paw, Flow, Volume & P–V (matches engine physics from ventilator.js) */
(function () {
  'use strict';

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function smoothstep(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  /**
   * Same algebra as ventilator.js calcDerived (waveform-relevant fields only).
   * vent: { mode:'VC'|'PC', tv, pip (PC ΔP above PEEP), rr, peep, ti }
   * patient: { compliance mL/cmH2O, resistance, leak 0–1 }
   */
  function calcDerived(vent, patient) {
    const C_mL = patient.compliance;
    const R = patient.resistance;
    const C_L = C_mL / 1000;
    const tau = R * C_L;
    const peep = vent.peep;
    const ti = vent.ti;
    const rr = vent.rr;
    const bp = 60 / rr;
    const te = bp - ti;

    let tv_mL, pip_cmH2O, plat_cmH2O, peakFlow_Ls;

    if (vent.mode === 'VC') {
      tv_mL = vent.tv;
      const V_L = tv_mL / 1000;
      peakFlow_Ls = V_L / ti;
      plat_cmH2O = peep + V_L / C_L;
      pip_cmH2O = plat_cmH2O + R * peakFlow_Ls;
    } else {
      const dP = vent.pip;
      tv_mL = dP * C_mL * (1 - Math.exp(-ti / tau));
      const V_L = tv_mL / 1000;
      peakFlow_Ls = (dP / (R || 0.001)) * (1 - Math.exp(-ti / tau)) / (ti || 0.1);
      plat_cmH2O = peep + dP;
      pip_cmH2O = peep + dP;
    }

    const tv_exhaled = tv_mL * (1 - patient.leak);
    const mv_Lmin = (tv_mL * rr) / 1000;
    const mean_paw = peep + ((pip_cmH2O - peep) * ti) / bp;
    const autoPEEP = Math.round(
      Math.max(0, (pip_cmH2O - peep) * Math.exp(-te / Math.max(tau, 0.05)) * 0.5)
    );

    return {
      tv_mL,
      tv_exhaled,
      pip: pip_cmH2O,
      plat: plat_cmH2O,
      peep,
      mv_Lmin,
      rr,
      peakFlow: peakFlow_Ls,
      ti,
      bp,
      te,
      tau,
      mean_paw,
      autoPEEP,
    };
  }

  /** R_pat: airway resistance (cmH₂O·s/L); affects expiratory pressure decay toward PEEP. */
  function genPressure(t, d, mode, R_pat) {
    const r = R_pat != null ? R_pat : 8;
    const phase = (t % d.bp) / d.bp;
    const ti_frac = d.ti / d.bp;
    if (phase < ti_frac) {
      const tp = phase / ti_frac;
      if (mode === 'VC') {
        if (tp < 0.08) return lerp(d.peep, d.pip, smoothstep(tp / 0.08));
        if (tp < 0.18) return lerp(d.pip, d.plat, smoothstep((tp - 0.08) / 0.1));
        return d.plat;
      }
      const tau_n = d.tau / d.ti;
      return d.peep + (d.pip - d.peep) * (1 - Math.exp(-tp / Math.max(tau_n, 0.05)));
    }
    const xe = (phase - ti_frac) / (1 - ti_frac);
    const kExp = Math.max(4.2, 7 - 0.055 * Math.max(0, r - 8));
    return d.peep + (d.plat - d.peep) * Math.exp(-xe * kExp);
  }

  function genFlow(t, d, mode, R) {
    const phase = (t % d.bp) / d.bp;
    const ti_frac = d.ti / d.bp;
    const peak_Lm = d.peakFlow * 60;
    if (phase < ti_frac) {
      const tp = phase / ti_frac;
      if (mode === 'VC') {
        if (tp < 0.05) return peak_Lm * smoothstep(tp / 0.05);
        if (tp > 0.95) return peak_Lm * smoothstep((1 - tp) / 0.05);
        return peak_Lm;
      }
      return peak_Lm * Math.exp(-tp / Math.max(d.tau / d.ti, 0.05));
    }
    const xe = (phase - ti_frac) / (1 - ti_frac);
    const tauBase = Math.max(d.tau / (d.te || 0.1), 0.08);
    const tau_e = tauBase * (1 + 0.07 * Math.max(0, R - 8));
    const peakExpScale = 1 / (1 + 0.034 * Math.max(0, R - 8));
    return -peak_Lm * peakExpScale * Math.exp(-xe / tau_e);
  }

  function genVolume(t, d, mode) {
    const phase = (t % d.bp) / d.bp;
    const ti_frac = d.ti / d.bp;
    if (phase < ti_frac) return d.tv_mL * smoothstep(phase / ti_frac);
    const xe = (phase - ti_frac) / (1 - ti_frac);
    return d.tv_exhaled * Math.exp(-xe * 3.5);
  }

  const BG = '#000000';

  /** Reference mechanics for dashed “normal lungs & airways” comparison (same vent settings). */
  const BASELINE_PATIENT = { compliance: 50, resistance: 8, leak: 0 };

  const PRESETS = {
    normal: {
      label: 'Normal lungs & airways',
      blurb:
        'Moderate compliance and resistance. VC delivers set TV with a **PIP–Pplat gap** from airway resistance; expiratory flow decays with the **RC time constant (τ = R×C)**.',
      vent: { mode: 'VC', tv: 480, pip: 12, rr: 12, peep: 5, ti: 1.0 },
      patient: Object.assign({}, BASELINE_PATIENT),
      recognition: {
        cues: [
          'PIP and Pplat are both moderate with only a small peak-to-plateau gap.',
          'Expiratory flow reaches baseline before the next inspiration.',
          'P-V loop has expected width without dramatic rightward shift.',
        ],
        diagnosis: 'Baseline mechanics with no dominant obstructive or restrictive signature.',
        immediateMove: 'Use this as the visual anchor before comparing disease patterns.',
      },
      quiz: {
        question: 'Which statement best matches this baseline pattern?',
        choices: [
          'High resistance with dynamic hyperinflation',
          'Severely reduced compliance requiring high driving pressure',
          'Near-normal mechanics with complete exhalation',
          'Large circuit leak causing major inspired-expired mismatch',
        ],
        correctIndex: 2,
        explanation: 'Normal mechanics show moderate pressures and complete return of flow to zero before the next breath.',
      },
    },
    reduced_compliance_ards: {
      label: 'Reduced compliance: ARDS',
      blurb:
        '**Very low compliance** shifts pressure upward for the same TV: both **PIP and Pplat rise** while the peak-to-plateau gap stays relatively modest if resistance is unchanged.',
      vent: { mode: 'VC', tv: 440, pip: 12, rr: 18, peep: 10, ti: 1.0 },
      patient: { compliance: 18, resistance: 10, leak: 0 },
      recognition: {
        cues: [
          'Paw trace rides high with elevated plateau pressure.',
          'PIP and Pplat both increase (not just PIP alone).',
          'Flow may still return to baseline; obstruction is not the dominant problem.',
        ],
        diagnosis: 'Reduced compliance (stiff lungs), consistent with ARDS physiology.',
        immediateMove: 'Lower injurious VT, optimize PEEP, and monitor driving pressure/plateau.',
      },
      quiz: {
        question: 'In this ARDS-like pattern, which pressure relationship is expected?',
        choices: [
          'PIP rises while plateau stays low and unchanged',
          'Both PIP and plateau rise because compliance is reduced',
          'Pressures normalize because resistance is low',
          'Only expiratory flow changes; pressure remains unaffected',
        ],
        correctIndex: 1,
        explanation: 'Low compliance raises alveolar pressure requirements, so both peak and plateau pressures trend upward.',
      },
    },
    reduced_compliance_pneumonia: {
      label: 'Reduced compliance: severe pneumonia',
      blurb:
        'Patchy stiff lung units in severe pneumonia produce a **compliance-limited** profile similar to ARDS but often less extreme: elevated plateau pressure with relatively preserved resistive gap.',
      vent: { mode: 'VC', tv: 450, pip: 12, rr: 16, peep: 8, ti: 1.0 },
      patient: { compliance: 24, resistance: 10, leak: 0 },
      recognition: {
        cues: [
          'Plateau pressure remains elevated for delivered volume.',
          'Peak-to-plateau gap is present but not the main abnormality.',
          'P-V loop appears steeper/right-shifted versus normal.',
        ],
        diagnosis: 'Reduced compliance from parenchymal disease (e.g., severe pneumonia).',
        immediateMove: 'Prioritize lung-protective settings and reassess oxygenation strategy.',
      },
      quiz: {
        question: 'Which interpretation fits this severe-pneumonia mechanics pattern?',
        choices: [
          'Primary airway obstruction is the key driver',
          'Compliance loss is dominant and plateau pressure rises',
          'Large circuit leak is causing all abnormalities',
          'Normal mechanics with only RR artifact',
        ],
        correctIndex: 1,
        explanation: 'In compliance-dominant disease, plateau pressure rises with volume delivery even when resistance is not markedly elevated.',
      },
    },
    reduced_compliance_edema: {
      label: 'Reduced compliance: pulmonary edema',
      blurb:
        'Pulmonary edema creates **stiff, fluid-loaded lungs**: pressure requirements rise for volume delivery, with elevated plateau and mean airway pressure patterns.',
      vent: { mode: 'VC', tv: 420, pip: 12, rr: 18, peep: 10, ti: 1.0 },
      patient: { compliance: 21, resistance: 11, leak: 0 },
      recognition: {
        cues: [
          'Both peak and plateau pressures trend upward.',
          'Higher baseline pressure burden (PEEP + reduced compliance).',
          'Flow shape is not classic obstructive shark-fin dominance.',
        ],
        diagnosis: 'Compliance-limited physiology consistent with pulmonary edema patterning.',
        immediateMove: 'Protective ventilation, optimize PEEP and hemodynamics, treat underlying cause.',
      },
      quiz: {
        question: 'What waveform clue most supports pulmonary-edema-type reduced compliance?',
        choices: [
          'Large isolated peak pressure jump with low plateau',
          'High plateau pressure with generally elevated Paw profile',
          'Major inspired-expired volume mismatch from leak',
          'Near-zero airway pressures throughout',
        ],
        correctIndex: 1,
        explanation: 'Fluid-stiff lungs require higher alveolar pressures, so plateau and overall Paw profile rise.',
      },
    },
    obstructive_bronchospasm: {
      label: 'Obstruction: bronchospasm',
      blurb:
        '**High airway resistance** widens PIP–Pplat and **limits peak expiratory flow** while **prolonging** the expiratory tail (often still below baseline at end-expiration).',
      vent: { mode: 'VC', tv: 480, pip: 12, rr: 11, peep: 5, ti: 1.0 },
      patient: { compliance: 50, resistance: 32, leak: 0 },
      recognition: {
        cues: [
          'Large peak-to-plateau pressure gap (resistive load).',
          'Expiratory flow decays slowly and may not reach zero by next breath.',
          'Loop and flow morphology suggest prolonged time constants.',
        ],
        diagnosis: 'Obstructive physiology from bronchospasm.',
        immediateMove: 'Bronchodilate, deepen anesthetic as needed, and extend expiratory time (lower RR).',
      },
      quiz: {
        question: 'Which finding is most specific for bronchospasm-type obstruction here?',
        choices: [
          'High plateau with minimal peak-plateau difference',
          'Large PIP-Pplat gap with delayed expiratory flow return',
          'Equal inspired and expired volume mismatch',
          'Very low airway pressures overall',
        ],
        correctIndex: 1,
        explanation: 'Obstruction primarily raises resistive pressure, widening PIP-Pplat and slowing expiratory emptying.',
      },
    },
    obstructive_mucus_plug: {
      label: 'Obstruction: mucus plug',
      blurb:
        'A mucus plug causes **localized airway narrowing/occlusion**, often producing a resistive pressure rise with delayed expiratory emptying similar to other obstructive patterns.',
      vent: { mode: 'VC', tv: 470, pip: 12, rr: 12, peep: 5, ti: 1.0 },
      patient: { compliance: 46, resistance: 28, leak: 0 },
      recognition: {
        cues: [
          'Peak pressure rises more than plateau pressure.',
          'Expiratory flow tail is prolonged with slower return toward baseline.',
          'Pattern resembles obstruction despite relatively preserved compliance.',
        ],
        diagnosis: 'Airway obstruction pattern compatible with mucus plugging.',
        immediateMove: 'Suction/clear airway and reassess breath-to-breath resistance profile.',
      },
      quiz: {
        question: 'A likely first troubleshooting action for this mucus-plug pattern is:',
        choices: [
          'Increase RR to wash out CO2',
          'Perform airway clearance/suction and reassess mechanics',
          'Drop PEEP to zero immediately',
          'Ignore pressures because plateau is normal',
        ],
        correctIndex: 1,
        explanation: 'Mucus plugs are mechanical airway problems; airway clearance is a key early intervention.',
      },
    },
    obstructive_kinked_ett: {
      label: 'Obstruction: kinked ETT',
      blurb:
        'A kinked ETT acutely increases airway resistance: expect **higher peak pressure**, widened peak-to-plateau gap, and impaired expiratory flow return.',
      vent: { mode: 'VC', tv: 470, pip: 12, rr: 12, peep: 5, ti: 1.0 },
      patient: { compliance: 50, resistance: 35, leak: 0 },
      recognition: {
        cues: [
          'Abruptly widened peak-to-plateau gap.',
          'Flow waveform demonstrates obstructive expiratory limitation.',
          'Compliance-related signs are less dominant than resistive changes.',
        ],
        diagnosis: 'Mechanical airway obstruction, classically kinked or partially occluded ETT.',
        immediateMove: 'Check tube patency/position and relieve obstruction immediately.',
      },
      quiz: {
        question: 'This pattern should prompt which immediate bedside check?',
        choices: [
          'Trend BIS first before touching airway',
          'Verify endotracheal tube patency and circuit integrity',
          'Increase tidal volume to force recruitment',
          'Switch to APRV immediately',
        ],
        correctIndex: 1,
        explanation: 'A sudden resistive pattern warrants immediate tube/circuit troubleshooting before complex mode changes.',
      },
    },
    leak: {
      label: 'Circuit leak',
      blurb:
        'A **large leak** means exhaled TV tracks **below** inspired TV — the **volume waveform** does not return to the same baseline each cycle. Pressure/flow may look deceptively normal.',
      vent: { mode: 'VC', tv: 480, pip: 12, rr: 12, peep: 5, ti: 1.0 },
      patient: { compliance: 50, resistance: 8, leak: 0.45 },
      recognition: {
        cues: [
          'Inspired and expired volume mismatch is prominent.',
          'Waveform pressure shape may remain fairly preserved.',
          'Volume trace baseline behavior appears inconsistent over cycles.',
        ],
        diagnosis: 'Circuit/airway leak rather than pure resistance or compliance failure.',
        immediateMove: 'Check cuff/circuit connections and resolve leak source.',
      },
      quiz: {
        question: 'Which clue most strongly points toward leak physiology?',
        choices: [
          'Large PIP-Pplat gap with severe flow delay',
          'High plateau pressure with stiff-loop signature',
          'Persistent inspired-expired volume mismatch',
          'Normal volume behavior with isolated EtCO2 drift',
        ],
        correctIndex: 2,
        explanation: 'Large inspired-expired volume mismatch is a hallmark of leak states.',
      },
    },
    air_trapping: {
      label: 'Air trapping / risk of auto-PEEP',
      blurb:
        '**Obstruction + short Te** (high RR, long Ti): expiratory flow is **still negative** when the next breath begins — **auto-PEEP** stacks. The flow trace never fully settles to zero.',
      vent: { mode: 'VC', tv: 480, pip: 12, rr: 24, peep: 5, ti: 1.2 },
      patient: { compliance: 50, resistance: 30, leak: 0 },
      recognition: {
        cues: [
          'Next inspiration begins before expiratory flow reaches zero.',
          'Higher effective end-expiratory pressure builds breath-to-breath.',
          'Pattern worsens with faster rate or longer inspiratory time.',
        ],
        diagnosis: 'Dynamic hyperinflation with auto-PEEP risk.',
        immediateMove: 'Reduce RR and/or shorten Ti to lengthen expiratory time.',
      },
      quiz: {
        question: 'Best ventilator adjustment for this air-trapping pattern?',
        choices: [
          'Increase RR to improve minute ventilation',
          'Lengthen expiratory time by lowering RR',
          'Increase leak percentage',
          'Ignore because plateau is unchanged',
        ],
        correctIndex: 1,
        explanation: 'Auto-PEEP improves by giving lungs more time to exhale (lower RR and longer Te).',
      },
    },
    pc_mild: {
      label: 'Pressure control — variable TV',
      blurb:
        '**PC-CMV** holds a **pressure target** (ΔP above PEEP); **TV is not fixed** — it falls out of compliance, Ti, and resistance. Compare to VC where TV is set and pressures swing with mechanics.',
      vent: { mode: 'PC', tv: 480, pip: 16, rr: 12, peep: 5, ti: 1.0 },
      patient: { compliance: 55, resistance: 10, leak: 0 },
      recognition: {
        cues: [
          'Pressure waveform follows pressure-target shape rather than fixed flow pattern.',
          'Delivered volume varies with mechanics and inspiratory time.',
          'Flow decelerates during inspiration in pressure-targeted breaths.',
        ],
        diagnosis: 'Pressure-targeted ventilation with mechanics-dependent tidal volume.',
        immediateMove: 'Monitor TV/exhaled volume closely when compliance or resistance changes.',
      },
      quiz: {
        question: 'In PC-CMV, what primarily determines delivered tidal volume?',
        choices: [
          'Set VT slider only',
          'Patient mechanics plus pressure target and inspiratory time',
          'PEEP alone',
          'Flow trigger threshold only',
        ],
        correctIndex: 1,
        explanation: 'Pressure control sets pressure, so delivered volume depends on compliance, resistance, and time at pressure.',
      },
    },
  };

  const PRESET_ALIASES = {
    obstructive: 'obstructive_bronchospasm',
    restrictive: 'reduced_compliance_ards',
  };

  function initVentWaveTutorial() {
    const dialog = document.getElementById('tut-ventwaves');
    if (!dialog) return;

    let vent = Object.assign({}, PRESETS.normal.vent);
    let patient = Object.assign({}, PRESETS.normal.patient);

    const els = {
      preset: document.getElementById('vent-tut-preset'),
      presetBlurb: document.getElementById('vent-tut-preset-blurb'),
      recCues: document.getElementById('vent-tut-recognition-cues'),
      recDx: document.getElementById('vent-tut-recognition-dx'),
      recAction: document.getElementById('vent-tut-recognition-action'),
      quizQuestion: document.getElementById('vent-tut-quiz-question'),
      quizChoices: document.getElementById('vent-tut-quiz-choices'),
      quizFeedback: document.getElementById('vent-tut-quiz-feedback'),
      modeVc: document.getElementById('vent-tut-btn-vc'),
      modePc: document.getElementById('vent-tut-btn-pc'),
      vcOnly: document.getElementById('vent-tut-vc-only'),
      pcOnly: document.getElementById('vent-tut-pc-only'),
      tv: document.getElementById('vent-tut-tv'),
      pip: document.getElementById('vent-tut-pip'),
      rr: document.getElementById('vent-tut-rr'),
      peep: document.getElementById('vent-tut-peep'),
      ti: document.getElementById('vent-tut-ti'),
      c: document.getElementById('vent-tut-c'),
      r: document.getElementById('vent-tut-r'),
      leak: document.getElementById('vent-tut-leak'),
      lblTv: document.getElementById('vent-tut-lbl-tv'),
      lblPip: document.getElementById('vent-tut-lbl-pip'),
      lblRr: document.getElementById('vent-tut-lbl-rr'),
      lblPeep: document.getElementById('vent-tut-lbl-peep'),
      lblTi: document.getElementById('vent-tut-lbl-ti'),
      lblC: document.getElementById('vent-tut-lbl-c'),
      lblR: document.getElementById('vent-tut-lbl-r'),
      lblLeak: document.getElementById('vent-tut-lbl-leak'),
      cPaw: document.getElementById('vent-tut-canvas-paw'),
      cFlow: document.getElementById('vent-tut-canvas-flow'),
      cVol: document.getElementById('vent-tut-canvas-vol'),
      cPv: document.getElementById('vent-tut-canvas-pv'),
      ro: document.getElementById('vent-tut-readouts'),
    };

    function setupCanvas(canvas, cssW, cssH) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    }

    /** Align to half-pixel grid in CSS space for crisp 1px strokes after DPR transform. */
    function crisp(x) {
      return Math.round(x * 2) / 2;
    }

    const WAVE_W = 620;
    const WAVE_H = 160;
    const PV_W = 320;
    const PV_H = 200;
    let ctxPaw;
    let ctxFlow;
    let ctxVol;
    let ctxPv;
    if (els.cPaw) ctxPaw = setupCanvas(els.cPaw, WAVE_W, WAVE_H);
    if (els.cFlow) ctxFlow = setupCanvas(els.cFlow, WAVE_W, WAVE_H);
    if (els.cVol) ctxVol = setupCanvas(els.cVol, WAVE_W, WAVE_H);
    if (els.cPv) ctxPv = setupCanvas(els.cPv, PV_W, PV_H);

    /** Offscreen sweep buffers (same layout as draw-time-series; monitor-tutorial makeAnim style). */
    const bufPawEl = document.createElement('canvas');
    const bufFlowEl = document.createElement('canvas');
    const bufVolEl = document.createElement('canvas');
    let ctxBufPaw;
    let ctxBufFlow;
    let ctxBufVol;
    if (els.cPaw) ctxBufPaw = setupCanvas(bufPawEl, WAVE_W, WAVE_H);
    if (els.cFlow) ctxBufFlow = setupCanvas(bufFlowEl, WAVE_W, WAVE_H);
    if (els.cVol) ctxBufVol = setupCanvas(bufVolEl, WAVE_W, WAVE_H);

    const WAVE_PAD = { l: 36, r: 8, t: 8, b: 22 };
    const INNER_W = WAVE_W - WAVE_PAD.l - WAVE_PAD.r;
    const INNER_H = WAVE_H - WAVE_PAD.t - WAVE_PAD.b;
    const SWEEP_ERASER = 22;
    const SWEEP_CYCLES = 1;
    const CYCLE_W = INNER_W / SWEEP_CYCLES;
    /** <1 slows sweep vs wall time (1.0 = one breath per screen-width of pixels). */
    const SWEEP_SPEED_SCALE = 0.7;

    /** X position of sweep cursor — must match drawSweepSegment (same px → same screen x). */
    function cursorXFromSweepPx(px) {
      const rem = ((px % INNER_W) + INNER_W) % INNER_W;
      return crisp(WAVE_PAD.l + rem);
    }

    /** Top/bottom margin inside plot so strokes stay off the clip edge (line width + antialias). */
    const PLOT_Y_INSET_FR = 0.06;

    let sweepTotalPx = 0;
    let sweepLastTs = null;
    let sweepRange = {
      paw: { lo: 0, hi: 1 },
      flow: { lo: 0, hi: 1 },
      vol: { lo: 0, hi: 1 },
    };
    let sweepDKey = '';

    function sweepDKeyFromState() {
      readStateFromUI();
      const d = calcDerived(vent, patient);
      return [
        vent.mode,
        d.bp,
        d.ti,
        d.tv_mL,
        d.pip,
        d.plat,
        d.peakFlow,
        patient.resistance,
        patient.compliance,
        patient.leak,
      ].join('|');
    }

    function patientDiffersFromBaseline() {
      return (
        Math.abs(patient.compliance - BASELINE_PATIENT.compliance) > 0.01 ||
        Math.abs(patient.resistance - BASELINE_PATIENT.resistance) > 0.01 ||
        Math.abs(patient.leak - BASELINE_PATIENT.leak) > 1e-4
      );
    }

    function computeSweepRanges() {
      readStateFromUI();
      const d = calcDerived(vent, patient);
      const dBase = calcDerived(vent, BASELINE_PATIENT);
      const mode = vent.mode;
      const R = patient.resistance;
      const Rb = BASELINE_PATIENT.resistance;
      const N = 800;
      function scanRaw(sampleFn) {
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const t = sweepLinearToPhysPhase(u, d) * d.bp;
          const v = sampleFn(t);
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        return { lo, hi };
      }
      function scanBaselinePair(fnCur, fnBase) {
        if (!patientDiffersFromBaseline()) return scanRaw(fnCur);
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const t = sweepLinearToPhysPhase(u, d) * d.bp;
          for (const v of [fnCur(t), fnBase(t)]) {
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
        }
        return { lo, hi };
      }
      {
        const { lo, hi } = scanBaselinePair(
          t => genPressure(t, d, mode, R),
          t => genPressure(t, dBase, mode, Rb)
        );
        const p = Math.max((hi - lo) * 0.08, 3);
        sweepRange.paw = { lo: Math.max(0, lo - p), hi: hi + p };
      }
      {
        const { lo, hi } = scanBaselinePair(
          t => genFlow(t, d, mode, R),
          t => genFlow(t, dBase, mode, Rb)
        );
        const span = Math.max(hi - lo, 1e-6);
        const p = Math.max(span * 0.1, Math.abs(hi) * 0.06, Math.abs(lo) * 0.06, 10);
        sweepRange.flow = { lo: lo - p, hi: hi + p };
      }
      {
        let hi = -Infinity;
        const consider = patientDiffersFromBaseline()
          ? [t => genVolume(t, d, mode), t => genVolume(t, dBase, mode)]
          : [t => genVolume(t, d, mode)];
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const t = sweepLinearToPhysPhase(u, d) * d.bp;
          for (const fn of consider) {
            const v = fn(t);
            if (v > hi) hi = v;
          }
        }
        hi = Math.max(hi, d.tv_mL, dBase.tv_mL);
        const topPad = Math.max(hi * 0.06, 12);
        sweepRange.vol = { lo: 0, hi: hi + topPad };
      }
      sweepDKey = sweepDKeyFromState();
    }

    function yOfWave(lo, hi, v) {
      const range = Math.max(hi - lo, 1e-6);
      const t = clamp(v, lo, hi);
      const yTop = WAVE_PAD.t + INNER_H * PLOT_Y_INSET_FR;
      const yBot = WAVE_PAD.t + INNER_H * (1 - PLOT_Y_INSET_FR);
      return yTop + (yBot - yTop) * (1 - (t - lo) / range);
    }

    /**
     * Linear sweep position u∈[0,1) → physiological phase [0,1) for sampling gen*().
     * Stretches inspiration (and early breath) across more of the plot width so Te-dominated
     * expiratory decay does not visually swallow the trace (display-only; physics unchanged).
     */
    function sweepLinearToPhysPhase(u, d) {
      const tf = d.ti / d.bp;
      u = ((u % 1) + 1) % 1;
      if (tf <= 1e-9 || tf >= 1 - 1e-9) return u;
      let alpha = Math.min(0.56, Math.max(tf + 0.17, tf * 2.22));
      if (alpha >= 1 - 1e-9) alpha = 0.52;
      if (u <= alpha) {
        return (u / alpha) * tf;
      }
      return tf + ((u - alpha) / (1 - alpha)) * (1 - tf);
    }

    function initSweepBuf(bx) {
      bx.clearRect(0, 0, WAVE_W, WAVE_H);
    }

    function drawGridIntoDest(ctxDest) {
      ctxDest.strokeStyle = 'rgba(255,255,255,0.06)';
      ctxDest.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const y = WAVE_PAD.t + (INNER_H * g) / 4;
        ctxDest.beginPath();
        ctxDest.moveTo(WAVE_PAD.l, y);
        ctxDest.lineTo(WAVE_W - WAVE_PAD.r, y);
        ctxDest.stroke();
      }
    }

    /** PEEP baseline (Paw) and 0 L/min (Flow) — subtle gray reference lines under trace. */
    function drawReferenceBaselines(ctxDest, waveKind, lo, hi, d) {
      if (!d || waveKind === 'vol') return;
      ctxDest.save();
      ctxDest.beginPath();
      ctxDest.rect(WAVE_PAD.l, WAVE_PAD.t, INNER_W, INNER_H);
      ctxDest.clip();
      if (waveKind === 'flow' && lo <= 0 && hi >= 0) {
        const y0 = yOfWave(lo, hi, 0);
        ctxDest.strokeStyle = 'rgba(148, 152, 162, 0.36)';
        ctxDest.lineWidth = 1.45;
        ctxDest.setLineDash([]);
        ctxDest.beginPath();
        ctxDest.moveTo(WAVE_PAD.l, y0);
        ctxDest.lineTo(WAVE_PAD.l + INNER_W, y0);
        ctxDest.stroke();
      }
      if (waveKind === 'paw') {
        const peep = d.peep;
        if (lo <= peep && hi >= peep) {
          const yp = yOfWave(lo, hi, peep);
          ctxDest.strokeStyle = 'rgba(148, 152, 162, 0.36)';
          ctxDest.lineWidth = 1.45;
          ctxDest.beginPath();
          ctxDest.moveTo(WAVE_PAD.l, yp);
          ctxDest.lineTo(WAVE_PAD.l + INNER_W, yp);
          ctxDest.stroke();
        }
      }
      ctxDest.restore();
    }

    /**
     * Clears a band *ahead of* the stroke tip so we do not erase ink we just drew (which looked dashed).
     * toPx: absolute sweep distance; clearing starts one column to the right of floor(tip % INNER_W).
     */
    function clearSweepEraser(bx, toPx) {
      const rem = ((toPx % INNER_W) + INNER_W) % INNER_W;
      const innerStart = (Math.floor(rem) + 1) % INNER_W;
      const xPlotEnd = WAVE_PAD.l + INNER_W;
      let remaining = SWEEP_ERASER;
      let x = WAVE_PAD.l + innerStart;
      while (remaining > 0) {
        const room = xPlotEnd - x;
        if (room <= 0) {
          x = WAVE_PAD.l;
          continue;
        }
        const w = Math.min(remaining, room);
        bx.clearRect(x, 0, w, WAVE_H);
        remaining -= w;
        x += w;
        if (x >= xPlotEnd) x = WAVE_PAD.l;
      }
    }

    function drawSweepSegment(bx, color, yOf, fromPx, toPx, d, sampleAtT) {
      if (toPx <= fromPx) return;
      const dPx = toPx - fromPx;
      const steps = Math.min(
        320,
        Math.max(24, Math.ceil(dPx * 8), Math.ceil(d.bp * 90 * (dPx / CYCLE_W)))
      );
      bx.save();
      bx.beginPath();
      bx.rect(WAVE_PAD.l, WAVE_PAD.t, INNER_W, INNER_H);
      bx.clip();
      bx.strokeStyle = color;
      bx.lineWidth = 1;
      bx.lineJoin = 'miter';
      bx.lineCap = 'butt';
      bx.beginPath();
      let prevX = -1;
      let open = false;
      for (let i = 0; i <= steps; i++) {
        const px = i === steps ? toPx : fromPx + (dPx * i) / steps;
        const xPlot = cursorXFromSweepPx(px);
        const u = (px / CYCLE_W) % 1;
        const t = sweepLinearToPhysPhase(u, d) * d.bp;
        const y = yOf(sampleAtT(t));
        if (!open || xPlot < prevX - 0.5) {
          if (open) bx.stroke();
          bx.beginPath();
          bx.moveTo(xPlot, y);
          open = true;
        } else {
          bx.lineTo(xPlot, y);
        }
        prevX = xPlot;
      }
      if (open) bx.stroke();
      bx.restore();
    }

    /** One full breath mapped across the plot width; dashed, behind the sweep layer. */
    function drawBaselineUnderlay(ctxDest, waveKind, lo, hi) {
      if (!patientDiffersFromBaseline()) return;
      readStateFromUI();
      const d = calcDerived(vent, patient);
      const dBase = calcDerived(vent, BASELINE_PATIENT);
      const mode = vent.mode;
      const Rb = BASELINE_PATIENT.resistance;
      const nPts = 400;
      let stroke;
      let sampleAtT;
      if (waveKind === 'paw') {
        stroke = 'rgba(255, 220, 150, 0.65)';
        sampleAtT = t => genPressure(t, dBase, mode, Rb);
      } else if (waveKind === 'flow') {
        stroke = 'rgba(160, 220, 255, 0.65)';
        sampleAtT = t => genFlow(t, dBase, mode, Rb);
      } else {
        stroke = 'rgba(150, 255, 200, 0.6)';
        sampleAtT = t => genVolume(t, dBase, mode);
      }
      const yOf = v => yOfWave(lo, hi, v);
      const nSeg = Math.max(nPts - 1, 1);
      ctxDest.save();
      ctxDest.beginPath();
      ctxDest.rect(WAVE_PAD.l, WAVE_PAD.t, INNER_W, INNER_H);
      ctxDest.clip();
      ctxDest.setLineDash([5, 4]);
      ctxDest.strokeStyle = stroke;
      ctxDest.lineWidth = 1.2;
      ctxDest.lineJoin = 'round';
      ctxDest.lineCap = 'round';
      ctxDest.beginPath();
      for (let i = 0; i < nPts; i++) {
        const u = i / nPts;
        const t = sweepLinearToPhysPhase(u, d) * d.bp;
        const x = crisp(WAVE_PAD.l + (i / nSeg) * INNER_W);
        const y = yOf(sampleAtT(t));
        if (i === 0) ctxDest.moveTo(x, y);
        else ctxDest.lineTo(x, y);
      }
      ctxDest.stroke();
      ctxDest.setLineDash([]);
      ctxDest.restore();
    }

    function compositeWaveToScreen(bufEl, ctxDest, lo, hi, waveKind, sweepPx, d) {
      ctxDest.fillStyle = BG;
      ctxDest.fillRect(0, 0, WAVE_W, WAVE_H);
      drawGridIntoDest(ctxDest);
      drawReferenceBaselines(ctxDest, waveKind, lo, hi, d);
      drawBaselineUnderlay(ctxDest, waveKind, lo, hi);
      ctxDest.drawImage(bufEl, 0, 0, WAVE_W, WAVE_H);
      const sx = cursorXFromSweepPx(sweepPx);
      ctxDest.save();
      ctxDest.strokeStyle = 'rgba(255,255,255,0.28)';
      ctxDest.lineWidth = 1;
      ctxDest.lineCap = 'butt';
      ctxDest.beginPath();
      ctxDest.moveTo(sx, crisp(WAVE_PAD.t - 1));
      ctxDest.lineTo(sx, crisp(WAVE_H - WAVE_PAD.b + 1));
      ctxDest.stroke();
      ctxDest.restore();
      ctxDest.fillStyle = 'rgba(148,163,184,0.85)';
      ctxDest.font = '10px monospace';
      ctxDest.textAlign = 'right';
      const yTraceTop = WAVE_PAD.t + INNER_H * PLOT_Y_INSET_FR;
      const yTraceBot = WAVE_PAD.t + INNER_H * (1 - PLOT_Y_INSET_FR);
      ctxDest.fillText(lo.toFixed(0), WAVE_PAD.l - 4, yTraceBot + 2);
      ctxDest.fillText(hi.toFixed(0), WAVE_PAD.l - 4, yTraceTop + 10);
    }

    function sweepReset() {
      sweepLastTs = null;
      sweepTotalPx = 0;
      computeSweepRanges();
      if (ctxBufPaw) initSweepBuf(ctxBufPaw);
      if (ctxBufFlow) initSweepBuf(ctxBufFlow);
      if (ctxBufVol) initSweepBuf(ctxBufVol);
    }

    function readStateFromUI() {
      vent.mode = els.modeVc?.classList.contains('vent-tut__mode-btn--on') ? 'VC' : 'PC';
      vent.tv = vent.mode === 'VC' ? parseFloat(els.tv?.value || 480) : vent.tv;
      vent.pip = parseFloat(els.pip?.value || 12);
      vent.rr = parseFloat(els.rr?.value || 12);
      vent.peep = parseFloat(els.peep?.value || 5);
      vent.ti = parseFloat(els.ti?.value || 1);
      patient.compliance = parseFloat(els.c?.value || 50);
      patient.resistance = parseFloat(els.r?.value || 8);
      patient.leak = (parseFloat(els.leak?.value || 0) || 0) / 100;
    }

    function syncUI() {
      if (els.modeVc && els.modePc) {
        const isVc = vent.mode === 'VC';
        els.modeVc.classList.toggle('vent-tut__mode-btn--on', isVc);
        els.modePc.classList.toggle('vent-tut__mode-btn--on', !isVc);
        if (els.vcOnly) els.vcOnly.hidden = !isVc;
        if (els.pcOnly) els.pcOnly.hidden = isVc;
        if (els.tv) els.tv.disabled = !isVc;
      }
      const set = (el, v, lbl, fmt) => {
        if (el) el.value = v;
        if (lbl) lbl.textContent = fmt ? fmt(v) : String(v);
      };
      set(els.tv, vent.tv, els.lblTv);
      set(els.pip, vent.pip, els.lblPip);
      set(els.rr, vent.rr, els.lblRr);
      set(els.peep, vent.peep, els.lblPeep);
      set(els.ti, vent.ti, els.lblTi, v => Number(v).toFixed(2));
      set(els.c, patient.compliance, els.lblC);
      set(els.r, patient.resistance, els.lblR);
      set(els.leak, Math.round(patient.leak * 100), els.lblLeak);
    }

    let activePresetKey = 'normal';

    function normalizePresetKey(key) {
      return PRESET_ALIASES[key] || key;
    }

    function clearQuiz() {
      if (els.quizQuestion) {
        els.quizQuestion.textContent = 'Pick a preset to start the recognition check.';
      }
      if (els.quizChoices) els.quizChoices.innerHTML = '';
      if (els.quizFeedback) {
        els.quizFeedback.textContent = '';
        els.quizFeedback.hidden = true;
      }
    }

    function renderRecognition(key) {
      if (!els.recCues || !els.recDx || !els.recAction) return;
      if (key === 'custom') {
        els.recCues.innerHTML = '<li>Build your own pattern by changing resistance, compliance, leak, and timing.</li>';
        els.recDx.textContent = 'Custom mechanics playground.';
        els.recAction.textContent = 'Compare your custom trace against baseline and decide if it is resistance-, compliance-, or leak-dominant.';
        return;
      }
      const p = PRESETS[key];
      if (!p || !p.recognition) {
        els.recCues.innerHTML = '';
        els.recDx.textContent = '-';
        els.recAction.textContent = '-';
        return;
      }
      els.recCues.innerHTML = p.recognition.cues.map((c) => `<li>${c}</li>`).join('');
      els.recDx.textContent = p.recognition.diagnosis;
      els.recAction.textContent = p.recognition.immediateMove;
    }

    function emitQuizAnswered(payload) {
      document.dispatchEvent(new CustomEvent('ventwave_quiz_answered', { detail: payload }));
    }

    function renderQuiz(key) {
      if (!els.quizQuestion || !els.quizChoices || !els.quizFeedback) return;
      if (key === 'custom') {
        clearQuiz();
        return;
      }
      const p = PRESETS[key];
      if (!p || !p.quiz) {
        clearQuiz();
        return;
      }
      els.quizQuestion.textContent = p.quiz.question;
      els.quizFeedback.textContent = '';
      els.quizFeedback.hidden = true;
      els.quizChoices.innerHTML = '';
      p.quiz.choices.forEach((choiceText, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vent-tut__quiz-choice';
        btn.textContent = choiceText;
        btn.dataset.choiceIdx = String(idx);
        btn.addEventListener('click', () => {
          const isCorrect = idx === p.quiz.correctIndex;
          els.quizChoices.querySelectorAll('.vent-tut__quiz-choice').forEach((b, i) => {
            b.disabled = true;
            b.classList.remove('vent-tut__quiz-choice--correct', 'vent-tut__quiz-choice--wrong');
            if (i === p.quiz.correctIndex) b.classList.add('vent-tut__quiz-choice--correct');
            else if (i === idx) b.classList.add('vent-tut__quiz-choice--wrong');
          });
          els.quizFeedback.hidden = false;
          els.quizFeedback.innerHTML = `${isCorrect ? '<strong>Correct.</strong>' : '<strong>Not quite.</strong>'} ${p.quiz.explanation}`;
          emitQuizAnswered({
            preset: key,
            selected_index: idx,
            correct_index: p.quiz.correctIndex,
            is_correct: isCorrect,
          });
        });
        els.quizChoices.appendChild(btn);
      });
    }

    function presetBlurbHtml(key) {
      if (!els.presetBlurb) return;
      if (key === 'custom') {
        els.presetBlurb.innerHTML =
          '<strong>Custom</strong> — adjust sliders to see how compliance, resistance, leak, RR, Ti, and mode reshape <strong>Paw</strong>, <strong>flow</strong>, <strong>volume</strong>, and the <strong>P–V loop</strong>. Watch PIP vs Pplat, expiratory flow decay, and τ.';
        return;
      }
      const p = PRESETS[key];
      if (!p) return;
      const h = p.blurb.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      els.presetBlurb.innerHTML = h;
    }

    function applyPreset(rawKey) {
      const key = normalizePresetKey(rawKey);
      const p = PRESETS[key];
      if (!p) return;
      activePresetKey = key;
      vent = Object.assign({}, p.vent);
      patient = Object.assign({}, p.patient);
      if (els.preset) els.preset.value = key;
      syncUI();
      presetBlurbHtml(key);
      renderRecognition(key);
      renderQuiz(key);
      redraw();
    }

    function drawPV(ctx, cssW, cssH, d, mode, patient, sweepPhase) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, cssW, cssH);
      const pad = { l: 38, r: 10, t: 10, b: 28 };
      const innerW = cssW - pad.l - pad.r;
      const innerH = cssH - pad.t - pad.b;
      const dBase = calcDerived(vent, BASELINE_PATIENT);

      function buildPts(dIn, R_pt) {
        const out = [];
        const steps = 160;
        const tf = dIn.ti / dIn.bp;
        for (let i = 0; i < steps; i++) {
          const u = i / steps;
          const t = sweepLinearToPhysPhase(u, dIn) * dIn.bp;
          const phase = (t % dIn.bp) / dIn.bp;
          const insp = phase < tf;
          out.push({
            v: genVolume(t, dIn, mode),
            p: genPressure(t, dIn, mode, R_pt),
            insp,
          });
        }
        return out;
      }

      const pts = buildPts(d, patient.resistance);
      const maxV = Math.max(d.tv_mL, dBase.tv_mL, 1) * 1.15;
      const maxP = Math.max(d.pip, d.plat, dBase.pip, dBase.plat, 1) * 1.12;
      const xOf = v =>
        crisp(pad.l + (clamp(v, 0, maxV * 1.001) / maxV) * innerW);
      const yOf = p =>
        crisp(pad.t + innerH - (clamp(p, 0, maxP * 1.001) / maxP) * innerH);

      ctx.save();
      ctx.beginPath();
      ctx.rect(pad.l, pad.t, innerW, innerH);
      ctx.clip();

      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      for (let g = 0; g <= 3; g++) {
        const x = pad.l + (innerW * g) / 3;
        ctx.beginPath();
        ctx.moveTo(x, pad.t);
        ctx.lineTo(x, pad.t + innerH);
        ctx.stroke();
      }
      for (let g = 0; g <= 3; g++) {
        const y = pad.t + (innerH * g) / 3;
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(pad.l + innerW, y);
        ctx.stroke();
      }

      const inspPts = pts.filter(pt => pt.insp);
      const expPts = pts.filter(pt => !pt.insp);

      function seg(list, col, dashed, light) {
        if (list.length < 2) return;
        ctx.save();
        if (dashed) ctx.setLineDash([4, 3]);
        ctx.strokeStyle = col;
        ctx.lineWidth = light ? 1 : 1.25;
        ctx.lineJoin = 'miter';
        ctx.lineCap = 'butt';
        ctx.globalAlpha = light ? 0.5 : 1;
        ctx.beginPath();
        list.forEach((pt, i) => {
          const x = xOf(pt.v);
          const y = yOf(pt.p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      if (patientDiffersFromBaseline()) {
        const basePts = buildPts(dBase, BASELINE_PATIENT.resistance);
        const bInsp = basePts.filter(pt => pt.insp);
        const bExp = basePts.filter(pt => !pt.insp);
        seg(bInsp, 'rgba(255, 210, 120, 0.75)', true, true);
        seg(bExp, 'rgba(120, 210, 255, 0.75)', true, true);
      }
      seg(inspPts, '#ffcc00', false, false);
      seg(expPts, '#00ccff', false, false);

      const uDot = ((sweepPhase % 1) + 1) % 1;
      const tDot = sweepLinearToPhysPhase(uDot, d) * d.bp;
      const phaseNorm = (tDot % d.bp) / d.bp;
      const dotInsp = phaseNorm < d.ti / d.bp;
      const vd = genVolume(tDot, d, mode);
      const pd = genPressure(tDot, d, mode, patient.resistance);
      const xd = xOf(vd);
      const yd = yOf(pd);
      ctx.fillStyle = dotInsp ? '#ffcc00' : '#00ddff';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(crisp(xd), crisp(yd), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      ctx.fillStyle = 'rgba(148,163,184,0.9)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('V mL', pad.l + innerW / 2, cssH - 10);
      ctx.save();
      ctx.translate(12, pad.t + innerH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Paw cmH\u2082O', 0, 0);
      ctx.restore();
    }

    function updateReadouts(d, mode) {
      if (!els.ro) return;
      const cell = (label, val) =>
        `<td class="vent-tut__ro-k">${label}</td><td class="vent-tut__ro-v">${val}</td>`;
      els.ro.innerHTML = `<table class="vent-tut__ro-table"><tbody>
        <tr>${cell('Mode', mode)}${cell('PIP', `${d.pip.toFixed(1)} cmH\u2082O`)}</tr>
        <tr>${cell('TV<sub>insp</sub>', `${Math.round(d.tv_mL)}\u202fmL`)}${cell('Pplat', `${d.plat.toFixed(1)} cmH\u2082O`)}</tr>
        <tr>${cell('TV<sub>exp</sub>', `${Math.round(d.tv_exhaled)}\u202fmL`)}${cell('\u03c4', `${d.tau.toFixed(2)}\u202fs`)}</tr>
        <tr>${cell('RR', `${d.rr}\u202f/min`)}${cell('Te', `${d.te.toFixed(2)}\u202fs`)}</tr>
      </tbody></table>`;
    }

    function syncSweepIfParamsChanged() {
      readStateFromUI();
      const k = sweepDKeyFromState();
      if (k !== sweepDKey) sweepReset();
    }

    let animRaf = null;
    function sweepTick(ts) {
      if (!dialog.open) return;
      syncSweepIfParamsChanged();
      if (sweepLastTs === null) {
        sweepLastTs = ts;
        computeSweepRanges();
        if (ctxBufPaw) initSweepBuf(ctxBufPaw);
        if (ctxBufFlow) initSweepBuf(ctxBufFlow);
        if (ctxBufVol) initSweepBuf(ctxBufVol);
        animRaf = requestAnimationFrame(sweepTick);
        return;
      }
      const dt = Math.min((ts - sweepLastTs) / 1000, 0.028);
      sweepLastTs = ts;
      readStateFromUI();
      const d = calcDerived(vent, patient);
      const mode = vent.mode;
      const R = patient.resistance;
      const speed = (CYCLE_W / d.bp) * SWEEP_SPEED_SCALE;
      const maxAdvance = CYCLE_W * 0.12;
      let deltaPx = speed * dt;
      if (deltaPx > maxAdvance) deltaPx = maxAdvance;
      const newTotal = sweepTotalPx + deltaPx;

      const wavesPanel = dialog.querySelector('.vent-tut__panel[data-panel="waves"]');
      const pvPanel = dialog.querySelector('.vent-tut__panel[data-panel="pv"]');
      const showWaves = wavesPanel && !wavesPanel.hidden;
      const showPv = pvPanel && !pvPanel.hidden;

      if (ctxBufPaw && ctxBufFlow && ctxBufVol) {
        const fromPx = sweepTotalPx;
        const toPx = newTotal;
        drawSweepSegment(
          ctxBufPaw,
          '#ffcc00',
          v => yOfWave(sweepRange.paw.lo, sweepRange.paw.hi, v),
          fromPx,
          toPx,
          d,
          t => genPressure(t, d, mode, R)
        );
        drawSweepSegment(
          ctxBufFlow,
          '#00ccff',
          v => yOfWave(sweepRange.flow.lo, sweepRange.flow.hi, v),
          fromPx,
          toPx,
          d,
          t => genFlow(t, d, mode, R)
        );
        drawSweepSegment(
          ctxBufVol,
          '#00ff99',
          v => yOfWave(sweepRange.vol.lo, sweepRange.vol.hi, v),
          fromPx,
          toPx,
          d,
          t => genVolume(t, d, mode)
        );
        clearSweepEraser(ctxBufPaw, newTotal);
        clearSweepEraser(ctxBufFlow, newTotal);
        clearSweepEraser(ctxBufVol, newTotal);
      }
      sweepTotalPx = newTotal;

      if (showWaves) {
        if (els.cPaw && ctxPaw) {
          compositeWaveToScreen(bufPawEl, ctxPaw, sweepRange.paw.lo, sweepRange.paw.hi, 'paw', newTotal, d);
        }
        if (els.cFlow && ctxFlow) {
          compositeWaveToScreen(bufFlowEl, ctxFlow, sweepRange.flow.lo, sweepRange.flow.hi, 'flow', newTotal, d);
        }
        if (els.cVol && ctxVol) {
          compositeWaveToScreen(bufVolEl, ctxVol, sweepRange.vol.lo, sweepRange.vol.hi, 'vol', newTotal, d);
        }
      }
      if (showPv && els.cPv && ctxPv) {
        const sweepPhase = (sweepTotalPx / CYCLE_W) % 1;
        drawPV(ctxPv, PV_W, PV_H, d, mode, patient, sweepPhase);
      }

      animRaf = requestAnimationFrame(sweepTick);
    }

    function forcePaintCurrentPanels() {
      readStateFromUI();
      const d = calcDerived(vent, patient);
      const wavesPanel = dialog.querySelector('.vent-tut__panel[data-panel="waves"]');
      const pvPanel = dialog.querySelector('.vent-tut__panel[data-panel="pv"]');
      const showWaves = wavesPanel && !wavesPanel.hidden;
      const showPv = pvPanel && !pvPanel.hidden;
      const sweepPhase = (sweepTotalPx / CYCLE_W) % 1;
      if (showWaves && ctxBufPaw && ctxPaw) {
        compositeWaveToScreen(bufPawEl, ctxPaw, sweepRange.paw.lo, sweepRange.paw.hi, 'paw', sweepTotalPx, d);
        compositeWaveToScreen(bufFlowEl, ctxFlow, sweepRange.flow.lo, sweepRange.flow.hi, 'flow', sweepTotalPx, d);
        compositeWaveToScreen(bufVolEl, ctxVol, sweepRange.vol.lo, sweepRange.vol.hi, 'vol', sweepTotalPx, d);
      }
      if (showPv && els.cPv && ctxPv) {
        drawPV(ctxPv, PV_W, PV_H, d, vent.mode, patient, sweepPhase);
      }
    }

    function redraw() {
      readStateFromUI();
      const d = calcDerived(vent, patient);
      updateReadouts(d, vent.mode);
      sweepReset();
      forcePaintCurrentPanels();
    }

    function startWaveAnim() {
      stopWaveAnim();
      animRaf = requestAnimationFrame(sweepTick);
    }

    function stopWaveAnim() {
      if (animRaf != null) {
        cancelAnimationFrame(animRaf);
        animRaf = null;
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (!dialog.open) return;
      if (document.hidden) stopWaveAnim();
      else startWaveAnim();
    });

    function wireSlider(el, lbl) {
      if (!el) return;
      el.addEventListener('input', () => {
        if (lbl) {
          if (el.id === 'vent-tut-ti') lbl.textContent = Number(el.value).toFixed(2);
          else if (el.id === 'vent-tut-leak') lbl.textContent = el.value;
          else lbl.textContent = el.value;
        }
        if (els.preset) els.preset.value = 'custom';
        activePresetKey = 'custom';
        presetBlurbHtml('custom');
        renderRecognition('custom');
        clearQuiz();
        redraw();
      });
    }

    els.modeVc?.addEventListener('click', () => {
      vent.mode = 'VC';
      els.modeVc?.classList.add('vent-tut__mode-btn--on');
      els.modePc?.classList.remove('vent-tut__mode-btn--on');
      syncUI();
      if (els.preset) els.preset.value = 'custom';
      activePresetKey = 'custom';
      presetBlurbHtml('custom');
      renderRecognition('custom');
      clearQuiz();
      redraw();
    });
    els.modePc?.addEventListener('click', () => {
      vent.mode = 'PC';
      els.modePc?.classList.add('vent-tut__mode-btn--on');
      els.modeVc?.classList.remove('vent-tut__mode-btn--on');
      syncUI();
      if (els.preset) els.preset.value = 'custom';
      activePresetKey = 'custom';
      presetBlurbHtml('custom');
      renderRecognition('custom');
      clearQuiz();
      redraw();
    });

    wireSlider(els.tv, els.lblTv);
    wireSlider(els.pip, els.lblPip);
    wireSlider(els.rr, els.lblRr);
    wireSlider(els.peep, els.lblPeep);
    wireSlider(els.ti, els.lblTi);
    wireSlider(els.c, els.lblC);
    wireSlider(els.r, els.lblR);
    wireSlider(els.leak, els.lblLeak);

    els.preset?.addEventListener('change', () => {
      const v = normalizePresetKey(els.preset.value);
      if (v === 'custom') {
        activePresetKey = 'custom';
        presetBlurbHtml('custom');
        renderRecognition('custom');
        clearQuiz();
        return;
      }
      applyPreset(v);
    });

    dialog.querySelectorAll('.vent-tut__tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        dialog.querySelectorAll('.vent-tut__tab').forEach(b => {
          const on = b.dataset.tab === tab;
          b.classList.toggle('vent-tut__tab--active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        dialog.querySelectorAll('.vent-tut__panel').forEach(p => {
          p.hidden = p.dataset.panel !== tab;
        });
        forcePaintCurrentPanels();
      });
    });

    dialog.addEventListener('toggle', e => {
      if (e.newState === 'open') {
        syncUI();
        if (activePresetKey === 'custom') {
          presetBlurbHtml('custom');
          renderRecognition('custom');
          clearQuiz();
        } else {
          presetBlurbHtml(activePresetKey);
          renderRecognition(activePresetKey);
          renderQuiz(activePresetKey);
        }
        sweepReset();
        readStateFromUI();
        updateReadouts(calcDerived(vent, patient), vent.mode);
        forcePaintCurrentPanels();
        startWaveAnim();
      } else {
        stopWaveAnim();
      }
    });

    dialog.addEventListener('click', e => {
      if (e.target === dialog) dialog.close();
    });

    dialog.querySelector('[data-tut-reset="tut-ventwaves"]')?.addEventListener('click', () => {
      applyPreset('normal');
    });

    document.addEventListener('ventwave_focus_preset', (ev) => {
      const requested = normalizePresetKey(ev?.detail?.preset || 'normal');
      if (!dialog.open) dialog.showModal();
      if (!PRESETS[requested]) return;
      applyPreset(requested);
      const wavesTab = dialog.querySelector('.vent-tut__tab[data-tab="waves"]');
      if (wavesTab) wavesTab.click();
    });

    document.getElementById('trig-ventwaves')?.addEventListener('click', () => dialog.showModal());

    // Expose globally so the scenario module can open and focus a preset directly
    window.openVentWavePreset = function (presetKey) {
      const k = normalizePresetKey(presetKey || 'normal');
      if (!dialog.open) dialog.showModal();
      if (PRESETS[k]) {
        applyPreset(k);
        const wavesTab = dialog.querySelector('.vent-tut__tab[data-tab="waves"]');
        if (wavesTab) wavesTab.click();
      }
    };

    syncUI();
    applyPreset('normal');
  }

  window.addEventListener('DOMContentLoaded', initVentWaveTutorial);
})();
