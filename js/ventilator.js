/* ════════════════════════════════════════════════════════════════════════════
   INTERACTIVE VENTILATOR  —  Stage 2
   ════════════════════════════════════════════════════════════════════════════
   Modules
   ───────
   PatientState        physiologic model (compliance, resistance, CO2, leak)
   VentSettings        user-adjustable ventilator settings
   Vitals              monitors with cross-linked physiology
   SimEngine           P = V/C + F×R + PEEP, auto-PEEP, smooth ETCO2
   WaveformGenerators  pure functions (t, derived) → sample value
   PVLoop              pressure-volume loop accumulator + renderer
   ScrollWaveform      canvas-based scrolling waveform
   BISSpectral         spectral heatmap
   NumericsUpdater     DOM updates
   AlarmManager        threshold checks
   ScenarioEngine      3 multi-step teaching scenarios
   ControlsInit        slider + button wiring
   AnimationLoop       requestAnimationFrame driver
   ════════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────────
     UTILITIES
     ───────────────────────────────────────────────────────────────────────── */
  const $       = id => document.getElementById(id);
  const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp    = (a, b, t) => a + (b - a) * t;

  function smoothstep(t) { t = clamp(t,0,1); return t*t*(3-2*t); }
  function gaussian(x, mu, sigma) { return Math.exp(-((x-mu)**2)/(2*sigma**2)); }

  /* ─────────────────────────────────────────────────────────────────────────
     PATIENT STATE MODEL
     ───────────────────────────────────────────────────────────────────────── */
  const patientState = {
    compliance    : 50,   // mL/cmH2O   (normal 50–80)
    resistance    : 5,    // cmH2O/L/s  (normal 5–15)
    co2Prod       : 200,  // mL/min
    leak          : 0,    // fraction 0–1
    cardiacOutput : 1.0,  // normalized: 1.0 = normal; < 1 = reduced CO (affects EtCO2 and SpO2)
  };

  /* ─────────────────────────────────────────────────────────────────────────
     VENTILATOR SETTINGS
     ───────────────────────────────────────────────────────────────────────── */
  const ventSettings = {
    mode : 'VC',
    tv   : 480,   // mL (VC)
    pip  : 10,    // cmH2O above PEEP (PC) — gives ~490 mL TV with normal compliance
    rr   : 12,    // br/min
    peep : 5,     // cmH2O
    fio2 : 50,    // %
    ti   : 1.0,   // s
  };

  /* ─────────────────────────────────────────────────────────────────────────
     VITALS  (with smooth targets for cross-linked physiology)
     ───────────────────────────────────────────────────────────────────────── */
  const vitals = {
    hr           : 72,
    sysBP        : 118,
    diaBP        : 72,
    spo2         : 99,
    etco2Display : 36,   // smoothed EtCO2 (lags behind calculated)
    temp         : 36.8,
    mac          : 0.95,
    eto2         : 52,
    sevo         : 2.1,
    bis          : 46,
    bisSmoothed  : 46,
    nibp         : { sys: 118, dia: 72, map: 88, nextAt: 0 },
  };

  /* ─────────────────────────────────────────────────────────────────────────
     SCENARIO OVERLAY  —  smooth transitions during scenarios
     ───────────────────────────────────────────────────────────────────────── */
  const overlay = {
    active  : false,
    speed   : 0.018,   // interpolation speed per tick (≈ 60fps)
    patient : {},      // target patientState values
    vit     : {},      // target vitals values
  };

  function applyOverlay() {
    if (!overlay.active) return;
    for (const k in overlay.patient) {
      patientState[k] = lerp(patientState[k], overlay.patient[k], overlay.speed);
    }
    for (const k in overlay.vit) {
      vitals[k] = lerp(vitals[k], overlay.vit[k], overlay.speed * 0.5);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     SIMULATION ENGINE
     ───────────────────────────────────────────────────────────────────────── */
  function calcDerived() {
    const C_mL = patientState.compliance;
    const R    = patientState.resistance;
    const C_L  = C_mL / 1000;
    const tau  = R * C_L;                  // RC exp time constant (s)
    const peep = ventSettings.peep;
    const ti   = ventSettings.ti;
    const rr   = ventSettings.rr;
    const bp   = 60 / rr;
    const te   = bp - ti;

    let tv_mL, pip_cmH2O, plat_cmH2O, peakFlow_Ls;

    if (ventSettings.mode === 'VC') {
      tv_mL       = ventSettings.tv;
      const V_L   = tv_mL / 1000;
      peakFlow_Ls = V_L / ti;
      plat_cmH2O  = peep + V_L / C_L;
      pip_cmH2O   = plat_cmH2O + R * peakFlow_Ls;
    } else {
      const dP    = ventSettings.pip;
      tv_mL       = dP * C_mL * (1 - Math.exp(-ti / tau));
      const V_L   = tv_mL / 1000;
      peakFlow_Ls = (dP / (R || 0.001)) * (1 - Math.exp(-ti / tau)) / (ti || 0.1);
      plat_cmH2O  = peep + dP;
      pip_cmH2O   = peep + dP;
    }

    const tv_exhaled = tv_mL * (1 - patientState.leak);
    const mv_Lmin    = tv_mL * rr / 1000;
    const mean_paw   = peep + (pip_cmH2O - peep) * ti / bp;

    // ETCO2: physiological formula — EtCO2 = VCO2 / VA × (PB-PH2O)
    // VA = alveolar ventilation = (TV - Vdead) × RR; Vdead ≈ 150 mL; PB-PH2O = 713 mmHg
    // coFactor: reduced CO → less CO2 delivered to alveoli per breath (Fick principle)
    // resistBonus: high airway resistance → V/Q mismatch raises plateau EtCO2
    const VD_mL       = 150;
    const VA_Lmin     = Math.max((tv_mL - VD_mL), 50) * rr / 1000;
    const coFactor    = 0.7 + 0.3 * patientState.cardiacOutput;
    // Cap at 12 mmHg so extreme resistances don't dominate the EtCO2 term
    const resistBonus = Math.min(Math.max(0, patientState.resistance - 5) * 0.5, 12);
    const etco2Target = clamp(
      (patientState.co2Prod / (VA_Lmin * 1000)) * 713 * coFactor + resistBonus,
      12, 82
    );

    // Auto-PEEP: volume trapped when te is too short for full exhalation (needs ~3τ to empty 95%)
    // Use continuous formula — rounds to 0 naturally when tau is small (normal lungs)
    const autoPEEP = Math.round(Math.max(0, (pip_cmH2O - peep) * Math.exp(-te / Math.max(tau, 0.05)) * 0.5));

    return {
      tv_mL, tv_exhaled, pip: pip_cmH2O, plat: plat_cmH2O, peep,
      mv_Lmin, rr, fio2: ventSettings.fio2, etco2Target,
      etco2: vitals.etco2Display,   // waveforms use the smoothed value
      peakFlow: peakFlow_Ls, ti, bp, te, tau, mean_paw, autoPEEP,
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     WAVEFORM GENERATORS
     ───────────────────────────────────────────────────────────────────────── */

  function ecgMorphology(p) {
    if (p < 0.09)  return 0.15  * gaussian(p, 0.045, 0.018);
    if (p < 0.155) return 0;
    if (p < 0.175) return -0.10 * ((p-0.155)/0.02);
    if (p < 0.215) return          gaussian(p, 0.19, 0.009);
    if (p < 0.235) return -0.15 * (1-(p-0.215)/0.02);
    if (p < 0.42)  return 0;
    if (p < 0.65)  return 0.35  * gaussian(p, 0.53, 0.07);
    return 0;
  }

  function genECG(t) {
    const T = 60 / vitals.hr;
    return ecgMorphology((t % T) / T) + (Math.random()-0.5)*0.018;
  }

  function genABP(t) {
    const T = 60 / vitals.hr;
    const p = (t % T) / T;
    const sys = vitals.sysBP, dia = vitals.diaBP;
    const notch = dia + (sys-dia)*0.36;
    if (p < 0.10) return lerp(dia, sys, smoothstep(p/0.10));
    if (p < 0.22) return lerp(sys, notch, smoothstep((p-0.10)/0.12));
    if (p < 0.28) return notch + (sys-notch)*0.10*Math.sin(Math.PI*(p-0.22)/0.06);
    return lerp(dia, notch, Math.exp(-(p-0.28)/(1-0.28)*2.8));
  }

  function genSpO2(t) {
    const T = 60 / vitals.hr;
    const p = ((t+0.09) % T) / T;
    return 0.15 + 0.85 * Math.sin(Math.PI*p)**2 + (Math.random()-0.5)*0.015;
  }

  function genETCO2(t, d) {
    const phase   = (t % d.bp) / d.bp;
    const ti_frac = d.ti / d.bp;
    const etco2   = d.etco2;        // smoothed display value

    if (phase < ti_frac) {
      const tp = phase / ti_frac;
      if (tp < 0.12) return etco2 * (1 - tp/0.12);
      return 0;
    }
    const xe = (phase - ti_frac) / (1 - ti_frac);
    // Bronchospasm causes obstructive upsloping in Phase III
    const slopeBoost = patientState.resistance > 12
      ? 0.04 + (patientState.resistance - 12) * 0.008
      : 0.025;
    if (xe < 0.14) return etco2 * 0.75 * (xe/0.14);
    if (xe < 0.30) return lerp(etco2*0.75, etco2, (xe-0.14)/0.16);
    return etco2 * (1 + slopeBoost * (xe - 0.30));
  }

  function genPressure(t, d) {
    const phase   = (t % d.bp) / d.bp;
    const ti_frac = d.ti / d.bp;
    if (phase < ti_frac) {
      const tp = phase / ti_frac;
      if (ventSettings.mode === 'VC') {
        if (tp < 0.08) return lerp(d.peep, d.pip, smoothstep(tp/0.08));
        if (tp < 0.18) return lerp(d.pip, d.plat, smoothstep((tp-0.08)/0.10));
        return d.plat;
      } else {
        const tau_n = d.tau / d.ti;
        return d.peep + (d.pip-d.peep)*(1-Math.exp(-tp/Math.max(tau_n,0.05)));
      }
    }
    const xe = (phase - ti_frac) / (1 - ti_frac);
    return d.peep + (d.plat-d.peep)*Math.exp(-xe*7);
  }

  function genFlow(t, d) {
    const phase   = (t % d.bp) / d.bp;
    const ti_frac = d.ti / d.bp;
    const peak_Lm = d.peakFlow * 60;
    if (phase < ti_frac) {
      const tp = phase / ti_frac;
      if (ventSettings.mode === 'VC') {
        if (tp < 0.05) return peak_Lm * smoothstep(tp/0.05);
        if (tp > 0.95) return peak_Lm * smoothstep((1-tp)/0.05);
        return peak_Lm;
      } else {
        return peak_Lm * Math.exp(-tp / Math.max(d.tau/d.ti, 0.05));
      }
    }
    const xe    = (phase - ti_frac) / (1 - ti_frac);
    const tau_e = Math.max(d.tau / (d.te||0.1), 0.08);
    return -peak_Lm * (1 + patientState.resistance*0.04) * Math.exp(-xe/tau_e);
  }

  function genVolume(t, d) {
    const phase   = (t % d.bp) / d.bp;
    const ti_frac = d.ti / d.bp;
    if (phase < ti_frac) return d.tv_mL * smoothstep(phase/ti_frac);
    const xe = (phase - ti_frac) / (1 - ti_frac);
    return d.tv_exhaled * Math.exp(-xe*3.5);
  }

  function genEEG(t) {
    const depth = 1 - vitals.bisSmoothed/100;
    return (
      depth*1.3 * Math.sin(2*Math.PI*2.5*t) * (0.8+0.2*Math.sin(0.7*t)) +
      (1-depth)*0.9 * Math.sin(2*Math.PI*10*t) +
      (1-depth)*0.3 * Math.sin(2*Math.PI*22*t) +
      (Math.random()-0.5)*0.18
    );
  }

  /* Waveform / TOF display — pure black (matches .mon-screen / tutorial wave section) */
  const MONITOR_SCREEN_BG = '#000000';

  /* ─────────────────────────────────────────────────────────────────────────
     SCROLL WAVEFORM CLASS
     ───────────────────────────────────────────────────────────────────────── */
  class ScrollWaveform {
    constructor(canvas, { color, pxPerSec, minVal, maxVal, lineWidth=1.5,
                          bgColor=MONITOR_SCREEN_BG, gridVals=[] }) {
      this.canvas   = canvas;
      this.ctx      = canvas.getContext('2d');
      this.W        = canvas.width;
      this.H        = canvas.height;
      this.color    = color;
      this.pxPerSec = pxPerSec;
      this.minVal   = minVal;
      this.maxVal   = maxVal;
      this.lineWidth= lineWidth;
      this.bgColor  = bgColor;
      this.gridVals = gridVals;
      this.buf      = new Float32Array(this.W).fill((minVal+maxVal)/2);
      this.head     = 0;
      this.frac     = 0;
    }

    push(fn, simTime, dt) {
      const startT = simTime - dt;
      this.frac += this.pxPerSec * dt;
      const n = Math.floor(this.frac);
      this.frac -= n;
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? startT + (i+1)/n*dt : simTime;
        this.head = (this.head+1) % this.W;
        this.buf[this.head] = fn(t);
      }
    }

    draw() {
      const { ctx, W, H, minVal, maxVal, bgColor, color, lineWidth, gridVals } = this;
      const range = maxVal - minVal;
      const yOf = v => H - 3 - ((v-minVal)/range)*(H-6);

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      if (gridVals.length) {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;
        for (const gv of gridVals) {
          const gy = yOf(gv);
          ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke();
        }
      }

      const GAP = 9;
      ctx.strokeStyle = color;
      ctx.lineWidth   = lineWidth;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 3.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      let penDown = false;
      for (let x = 0; x < W; x++) {
        if (W - x <= GAP) { penDown = false; continue; }
        const idx = (this.head - W + x + 1 + W) % W;
        const y   = yOf(this.buf[idx]);
        if (!penDown) { ctx.moveTo(x,y); penDown = true; }
        else ctx.lineTo(x,y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = bgColor;
      ctx.fillRect(W-GAP, 0, GAP+1, H);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PRESSURE-VOLUME LOOP
     ─────────────────────────────────────────────────────────────────────────
     Accumulates (pressure, volume) pairs per breath cycle.
     On new-breath boundary, the completed loop replaces the display buffer.
     ───────────────────────────────────────────────────────────────────────── */
  let pvCanvas      = null;
  let pvBuf         = [];   // current breath: [{p, v, insp}]
  let pvComplete    = [];   // last complete breath
  let pvLastPhase   = -1;

  function pvPushPoint(t, d) {
    const phase = (t % d.bp) / d.bp;
    if (pvLastPhase > 0.85 && phase < 0.15) {
      // Breath rolled over — commit current to completed
      pvComplete = pvBuf.slice();
      pvBuf = [];
    }
    pvLastPhase = phase;
    pvBuf.push({
      p    : genPressure(t, d),
      v    : genVolume(t, d),
      insp : phase < d.ti / d.bp,
    });
  }

  function drawPVLoop() {
    if (!pvCanvas) return;
    const ctx = pvCanvas.getContext('2d');
    const W = pvCanvas.width, H = pvCanvas.height;
    const PAD = { l:6, r:4, t:4, b:6 };
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;

    const d = calcDerived();
    const maxV = Math.max(d.tv_mL * 1.18, 100);
    const maxP = Math.max(d.pip * 1.22, 20);

    const xOf = v => PAD.l + (v / maxV) * innerW;
    const yOf = p => H - PAD.b - (p / maxP) * innerH;

    ctx.fillStyle = MONITOR_SCREEN_BG;
    ctx.fillRect(0, 0, W, H);

    // Axis lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    [0, maxV*0.5, maxV].forEach(v => {
      const x = xOf(v);
      ctx.beginPath(); ctx.moveTo(x,PAD.t); ctx.lineTo(x,H-PAD.b); ctx.stroke();
    });
    [0, maxP*0.5, maxP].forEach(p => {
      const y = yOf(p);
      ctx.beginPath(); ctx.moveTo(PAD.l,y); ctx.lineTo(W-PAD.r,y); ctx.stroke();
    });

    // Draw completed loop (previous breath, solid)
    const drawSegment = (pts, color) => {
      if (!pts.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach((pt, i) => {
        const x = xOf(pt.v), y = yOf(pt.p);
        i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const inspPts = pvComplete.filter(pt => pt.insp);
    const expPts  = pvComplete.filter(pt => !pt.insp);
    drawSegment(inspPts, '#ffcc00');
    drawSegment(expPts,  '#00ccff');

    // Draw in-progress current breath (dimmer)
    if (pvBuf.length > 1) {
      ctx.strokeStyle = 'rgba(200,200,200,0.35)';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      pvBuf.forEach((pt, i) => {
        const x = xOf(pt.v), y = yOf(pt.p);
        i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      });
      ctx.stroke();
    }

    // PEEP marker (horizontal dotted line)
    if (d.peep > 0) {
      const py = yOf(d.peep);
      ctx.strokeStyle = 'rgba(255,200,0,0.25)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2,3]);
      ctx.beginPath(); ctx.moveTo(PAD.l,py); ctx.lineTo(W-PAD.r,py); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     BIS SPECTRAL HEATMAP
     ───────────────────────────────────────────────────────────────────────── */
  function drawSpectral(canvas, t) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const depth = 1 - vitals.bisSmoothed/100;
    ctx.fillStyle = MONITOR_SCREEN_BG;
    ctx.fillRect(0, 0, W, H);
    const bands = [
      { amp: depth*0.9+0.08,       color:[255,68,68]  },
      { amp: depth*0.5+0.08,       color:[255,140,0]  },
      { amp: (1-depth)*0.75+0.06,  color:[255,238,0]  },
      { amp: (1-depth)*0.55+0.04,  color:[0,200,255]  },
    ];
    const bandW = W / bands.length;
    bands.forEach(({ amp, color }, i) => {
      const x   = i * bandW;
      const eff = amp + Math.sin(t*0.35 + i*1.2)*0.04;
      for (let py = 0; py < H; py++) {
        const normY = 1 - py/H;
        const power = clamp(eff - normY*1.1, 0, 1);
        const alpha = Math.min(1, power*1.6);
        ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha.toFixed(2)})`;
        ctx.fillRect(x+1.5, py, bandW-3, 1);
      }
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < bands.length; i++) {
      ctx.beginPath();
      ctx.moveTo(i*bandW, 0); ctx.lineTo(i*bandW, H); ctx.stroke();
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     NUMERICS UPDATE
     ───────────────────────────────────────────────────────────────────────── */
  function updateNumerics(d, t) {
    setText('num-hr',      Math.round(vitals.hr));
    setText('num-abp-sys', Math.round(vitals.sysBP));
    const map = Math.round(vitals.sysBP/3 + vitals.diaBP*2/3);
    setText('num-abp-map', `/ ${Math.round(vitals.diaBP)} (${map})`);
    setText('num-spo2',    Math.round(vitals.spo2));
    setText('num-etco2',   Math.round(vitals.etco2Display));
    setText('num-rr',      `RR ${d.rr}`);
    setText('num-temp',    vitals.temp.toFixed(1));
    setText('num-mac',     vitals.mac.toFixed(2));
    setText('num-eto2',    vitals.eto2+'%');
    setText('num-sevo',    vitals.sevo.toFixed(1)+'%');

    if (t >= vitals.nibp.nextAt) {
      vitals.nibp.sys = Math.round(vitals.sysBP + (Math.random()-0.5)*8);
      vitals.nibp.dia = Math.round(vitals.diaBP + (Math.random()-0.5)*6);
      vitals.nibp.map = Math.round(vitals.nibp.sys/3 + vitals.nibp.dia*2/3);
      vitals.nibp.nextAt = t + 30;
    }
    setText('nibp-sys', vitals.nibp.sys);
    setText('nibp-dia', vitals.nibp.dia);
    setText('nibp-map', vitals.nibp.map);

    vitals.bisSmoothed += (vitals.bis - vitals.bisSmoothed) * 0.003;
    setText('num-bis', Math.round(vitals.bisSmoothed));

    setText('vn-tv-set',       Math.round(d.tv_mL));
    setText('vn-tv-exp',       Math.round(d.tv_exhaled));
    setText('vn-rr',           d.rr);
    setText('vn-mv',           d.mv_Lmin.toFixed(1));
    setText('vn-pip',          Math.round(d.pip));
    setText('vn-plat',         Math.round(d.plat));
    setText('vn-peep',         d.peep);
    setText('vn-pmean',        Math.round(d.mean_paw));
    setText('vn-fio2',         d.fio2+'%');
    setText('vn-etco2-vent',   Math.round(vitals.etco2Display));
    setText('vn-autoPEEP',     d.autoPEEP);
    setText('vn-tau',          d.tau.toFixed(2));

    const chip   = $('mode-chip');
    const detail = $('mode-detail');
    if (chip) chip.textContent = ventSettings.mode === 'VC' ? 'VC-CMV' : 'PC-CMV';
    if (detail) {
      detail.textContent = ventSettings.mode === 'VC'
        ? `TV ${ventSettings.tv}mL · RR ${ventSettings.rr} · PEEP ${ventSettings.peep} · FiO₂ ${ventSettings.fio2}% · Ti ${ventSettings.ti.toFixed(1)}s`
        : `ΔP ${ventSettings.pip}cmH₂O · RR ${ventSettings.rr} · PEEP ${ventSettings.peep} · FiO₂ ${ventSettings.fio2}% · Ti ${ventSettings.ti.toFixed(1)}s`;
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ALARM MANAGER
     ───────────────────────────────────────────────────────────────────────── */
  function checkAlarms(d) {
    const alarms = [];
    const map    = Math.round(vitals.sysBP / 3 + vitals.diaBP * 2 / 3);

    // Airway / ventilation alarms
    if (d.pip > 40)
      alarms.push({ msg:`CRITICAL Airway Pressure · PIP ${Math.round(d.pip)} cmH₂O`, level:'high' });
    else if (d.pip > 30)
      alarms.push({ msg:`High Airway Pressure · PIP ${Math.round(d.pip)} cmH₂O`, level:'medium' });
    if (d.tv_exhaled < 150)
      alarms.push({ msg:'Low Exhaled Volume — possible disconnect', level:'high' });
    if (d.mv_Lmin < 2.0)
      alarms.push({ msg:`Low Minute Ventilation · ${d.mv_Lmin.toFixed(1)} L/min`, level:'high' });
    if (d.autoPEEP > 3)
      alarms.push({ msg:`Auto-PEEP · ${d.autoPEEP} cmH₂O — air trapping`, level:'medium' });
    if (d.fio2 < 25)
      alarms.push({ msg:`Low FiO₂ · ${d.fio2}%`, level:'high' });
    if (patientState.leak > 0.20)
      alarms.push({ msg:`Circuit Leak · ${Math.round(patientState.leak*100)}%`, level:'medium' });

    // EtCO2 alarms (use smoothed display value for clinical relevance)
    if (vitals.etco2Display > 50)
      alarms.push({ msg:`High EtCO₂ · ${Math.round(vitals.etco2Display)} mmHg`, level:'medium' });
    if (vitals.etco2Display < 25)
      alarms.push({ msg:`Low EtCO₂ · ${Math.round(vitals.etco2Display)} mmHg`, level:'medium' });

    // Hemodynamic alarms
    if (map < 50)
      alarms.push({ msg:`SEVERE HYPOTENSION · MAP ${map} mmHg`, level:'high' });
    else if (map < 60)
      alarms.push({ msg:`Hypotension · MAP ${map} mmHg`, level:'medium' });
    if (vitals.spo2 < 88)
      alarms.push({ msg:`CRITICAL DESATURATION · SpO₂ ${Math.round(vitals.spo2)}%`, level:'high' });
    else if (vitals.spo2 < 92)
      alarms.push({ msg:`Desaturation · SpO₂ ${Math.round(vitals.spo2)}%`, level:'medium' });
    if (vitals.hr > 120)
      alarms.push({ msg:`Tachycardia · HR ${Math.round(vitals.hr)} bpm`, level:'medium' });
    if (vitals.bisSmoothed > 70)
      alarms.push({ msg:`Possible Awareness · BIS ${Math.round(vitals.bisSmoothed)}`, level:'high' });

    const list = $('alarm-list');
    if (!list) return;
    list.innerHTML = alarms.length
      ? alarms.map(a => `<div class="alarm-item alarm-item--${a.level}">⚠ ${a.msg}</div>`).join('')
      : '<div class="alarm-none">No active alarms</div>';
  }

  /* ─────────────────────────────────────────────────────────────────────────
     SLOW DRIFT + CROSS-LINKED PHYSIOLOGY
     ─────────────────────────────────────────────────────────────────────────
     Cross-links:
       SpO2   ← FiO2, resistance (obstruction), leak
       BP     ← mean airway pressure (venous return), scenario overlay
       ETCO2  ← minute ventilation (smoothed), CO2 production, perfusion
     ───────────────────────────────────────────────────────────────────────── */
  /* Applies passive scenario deterioration each frame while student hasn't answered.
     Each step may specify a passiveDeterior block with target patient/vit values
     and an interpolation rate (default 0.002 ≈ ~19 s for 90% convergence at 60 fps). */
  function applyPassiveDeterior() {
    if (!scenState.active || scenState.answered) return;
    const step = scenState.scenario && scenState.scenario.steps[scenState.stepIdx];
    if (!step || !step.passiveDeterior) return;
    const pd   = step.passiveDeterior;
    const rate = pd.rate || 0.002;
    if (pd.vit) {
      for (const k in pd.vit) vitals[k] = lerp(vitals[k], pd.vit[k], rate);
    }
    if (pd.patient) {
      for (const k in pd.patient) patientState[k] = lerp(patientState[k], pd.patient[k], rate);
    }
  }

  let lastDrift = 0;
  function applyDrift(t, d) {
    // Passive scenario deterioration (runs if student hasn't answered yet)
    applyPassiveDeterior();

    // Smooth ETCO2 display (capnograph lags behind calculated target)
    vitals.etco2Display += (d.etco2Target - vitals.etco2Display) * 0.001;

    // SpO2 target: FiO2 helps; high resistance and leak hurt;
    // reduced cardiac output independently worsens tissue oxygenation
    const spo2Target = clamp(
      97.5
      + (ventSettings.fio2 - 50) * 0.07
      - Math.max(0, patientState.resistance - 14) * 0.3
      - patientState.leak * 20
      - Math.max(0, 1 - patientState.cardiacOutput) * 10,
      65, 100
    );
    vitals.spo2 += (spo2Target - vitals.spo2) * 0.003;

    // Mean airway pressure reduces BP when high (venous return ↓)
    const pawPenalty = Math.max(0, d.mean_paw - 14) * 0.35;
    vitals.sysBP -= pawPenalty * 0.002;
    vitals.diaBP -= pawPenalty * 0.0015;

    // Scenario overlay targets
    applyOverlay();

    if (t - lastDrift < 5) return;
    lastDrift = t;
    vitals.hr   = clamp(vitals.hr   + (Math.random()-0.5)*1.5, 40, 170);
    vitals.sysBP= clamp(vitals.sysBP+ (Math.random()-0.5)*2,   38, 210);
    vitals.diaBP= clamp(vitals.diaBP+ (Math.random()-0.5)*1.5, 18, 130);
    vitals.temp = clamp(vitals.temp + (Math.random()-0.5)*0.05, 35.8, 37.8);
    vitals.bis  = clamp(vitals.bis  + (Math.random()-0.5)*2.5, 30, 65);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CANVAS INITIALISATION
     ───────────────────────────────────────────────────────────────────────── */
  let wfs = {};
  let spectralCanvas;

  function initCanvases() {
    function setSize(id, h) {
      const el = $(id);
      if (!el) return null;
      el.width  = el.offsetWidth || (el.parentElement && el.parentElement.offsetWidth) || 300;
      el.height = h;
      return el;
    }

    const ecgC  = setSize('canvas-ecg',      96);
    const abpC  = setSize('canvas-abp',      96);
    const spo2C = setSize('canvas-spo2',     96);
    const co2C  = setSize('canvas-etco2',    96);

    const pressC = setSize('canvas-pressure', 68);
    const flowC  = setSize('canvas-flow',     68);
    const volC   = setSize('canvas-volume',   68);

    const eegC   = setSize('canvas-eeg',     44);
    spectralCanvas = setSize('canvas-spectral', 56);
    pvCanvas       = setSize('canvas-pv',    115);

    if (ecgC)  wfs.ecg  = new ScrollWaveform(ecgC,  { color:'#00e676', pxPerSec:50, minVal:-0.35, maxVal:1.25, lineWidth:1.6 });
    if (abpC)  wfs.abp  = new ScrollWaveform(abpC,  { color:'#ff4c4c', pxPerSec:50, minVal:40, maxVal:190, lineWidth:1.6, gridVals:[80,120,160] });
    if (spo2C) wfs.spo2 = new ScrollWaveform(spo2C, { color:'#00e5ff', pxPerSec:50, minVal:0, maxVal:1.15, lineWidth:1.6 });
    if (co2C)  wfs.etco2= new ScrollWaveform(co2C,  { color:'#ffee00', pxPerSec:25, minVal:0, maxVal:55, lineWidth:1.6 });

    if (pressC) wfs.pressure = new ScrollWaveform(pressC, { color:'#ffcc00', pxPerSec:35, minVal:0, maxVal:55, lineWidth:1.5, gridVals:[5,15,25,35,45] });
    if (flowC)  wfs.flow     = new ScrollWaveform(flowC,  { color:'#00ccff', pxPerSec:35, minVal:-65, maxVal:90, lineWidth:1.5, gridVals:[0] });
    if (volC)   wfs.volume   = new ScrollWaveform(volC,   { color:'#00ff99', pxPerSec:35, minVal:-40, maxVal:750, lineWidth:1.5, gridVals:[0,300,500] });
    if (eegC)   wfs.eeg = new ScrollWaveform(eegC, { color:'#00e676', pxPerSec:80, minVal:-1.8, maxVal:1.8, lineWidth:1.2 });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     SCENARIO DATA
     ─────────────────────────────────────────────────────────────────────────
     Each scenario:  id, title, summary, badge, badgeColor
                     initialPatient, initialVitals, initialVent
                     steps[]:  question, choices[]: { text, isCorrect, feedback, effects }
                     resolution
     effects:  { patient:{}, vit:{}, vent:{} }  — absolute target values
     ───────────────────────────────────────────────────────────────────────── */
  /*
   * SCENARIO DATA
   * ─────────────────────────────────────────────────────────────────────────
   * Initial EtCO2 calibration (baseline VA = 3.96 L/min):
   *   etco2Target = (co2Prod / VA_mL) × 713 × coFactor + resistBonus
   *   coFactor = 0.7 + 0.3×CO    resistBonus = max(0, R−5) × 0.5
   *
   * Scenario 1 — CO=0.65, R=5:   (174/3960)×713×0.895 + 0   = 28.0 ✓
   * Scenario 2 — CO=0.45, R=26:  (210/3960)×713×0.835 + 10.5 = 42.1 ✓
   * Scenario 3 — CO=1.00, R=22:  (197/3960)×713×1.000 + 8.5  = 43.9 ✓
   *
   * effects.patient → absolute targets (overlay lerps to them)
   * effects.vit     → relative DELTAS added to current vitals value
   * effects.vent    → applied immediately to ventSettings
   * effects.overlaySpeed → lerp rate (default 0.018; fast ≈ 0.030, slow ≈ 0.008)
   *
   * passiveDeterior → runs each frame while student hasn't answered;
   *                   patient/vit target values + optional rate (default 0.002)
   * ─────────────────────────────────────────────────────────────────────────
   */

  // Centralised badge colour palette — same category always renders the same colour
  const BADGE_COLORS = {
    'Emergency'   : { fg:'#cc2222', bg:'rgba(220,34,34,0.10)',   border:'rgba(220,34,34,0.28)'   },
    'Hemodynamics': { fg:'#c05a00', bg:'rgba(249,115,22,0.10)',  border:'rgba(249,115,22,0.28)'  },
    'Airway'      : { fg:'#1d5fa8', bg:'rgba(51,153,255,0.10)',  border:'rgba(51,153,255,0.28)'  },
    'Respiratory' : { fg:'#0f766e', bg:'rgba(13,148,136,0.10)',  border:'rgba(13,148,136,0.28)'  },
  };
  const _defaultBadgeColor = { fg:'#475569', bg:'rgba(71,85,105,0.10)', border:'rgba(71,85,105,0.28)' };

  const SCENARIOS = [

    /* ── 1. Post-Induction Hypotension ──────────────────────────────────── */
    {
      id        : 'hypo',
      title     : 'Post-Induction Hypotension',
      badge     : 'Hemodynamics',
      badgeColor: '#ff6060',
      summary   : 'Five minutes post-induction, your patient is under sevoflurane for an elective laparotomy. The arterial line waveform is slowly trending downward.',

      /* calibrated: etco2Target ≈ 28 with CO=0.65, R=5 */
      initialPatient : { compliance:50, resistance:5,  co2Prod:174, leak:0, cardiacOutput:0.65 },
      initialVitals  : { hr:80, sysBP:74, diaBP:44, spo2:98, bis:48, etco2Display:28 },
      initialVent    : { tv:480, rr:12, peep:5, fio2:50, ti:1.0 },

      steps : [
        /* ── Step 1 ── */
        {
          phase    : 'Deterioration',
          clue     : 'Key clue: Arterial line amplitude shrinking and MAP falling. EtCO₂ is below expected for these ventilation settings — a sign that CO₂ delivery to the lungs (i.e., cardiac output) is reduced. Ventilator waveforms look normal.',
          question : 'Arterial pressure is 74/44 mmHg (MAP ≈ 54). SpO₂ and ventilator mechanics are normal. EtCO₂ is 28 mmHg — lower than the expected 34–38 with these settings. What is the best immediate next step?',

          /* If untreated: MAP drifts toward 36, CO falls further */
          passiveDeterior : {
            rate    : 0.0018,
            vit     : { sysBP:52, diaBP:28 },
            patient : { cardiacOutput:0.48 },
          },

          choices : [
            {
              text      : 'A. Increase tidal volume to 700 mL to improve CO₂ clearance',
              isCorrect : false,
              feedback  : 'Incorrect. Increasing tidal volume addresses CO₂ clearance, not cardiac output. More importantly, a larger TV raises intrathoracic pressure and worsens venous return — the exact opposite of what a hypotensive patient needs.',
              effects   : { patient:{}, vit:{ sysBP:-8, diaBP:-5 }, vent:{}, overlaySpeed:0.018 },
            },
            {
              text      : 'B. Give a vasopressor and assess the underlying cause (vasodilation, preload, cardiac)',
              isCorrect : true,
              feedback  : 'Correct. Post-induction hypotension is most commonly anesthetic vasodilation with reduced preload. A vasopressor (e.g., phenylephrine or ephedrine) addresses the immediate MAP, while you investigate the cause. Watch the arterial waveform amplitude improve. Notice that EtCO₂ should also begin rising as cardiac output recovers — CO₂ delivery to the alveolus is proportional to pulmonary blood flow.',
              /* Vasopressor: fast response (seconds). CO recovers partially. */
              effects   : { patient:{ cardiacOutput:0.82 }, vit:{ sysBP:38, diaBP:22, hr:-5 }, vent:{}, overlaySpeed:0.030 },
            },
            {
              text      : 'C. Decrease FiO₂ from 50% to 21%',
              isCorrect : false,
              feedback  : 'Incorrect — and dangerous. Reducing inspired oxygen in a hypotensive patient compounds the risk of end-organ ischemia. SpO₂ looks fine now because reserves remain, but low perfusion plus low FiO₂ is a hazardous combination.',
              effects   : { patient:{}, vit:{ sysBP:-12, spo2:-2 }, vent:{ fio2:21 }, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Do nothing — SpO₂ is normal so oxygen delivery is adequate',
              isCorrect : false,
              feedback  : 'Incorrect. SpO₂ reflects arterial saturation, not tissue oxygen delivery. Cardiac output can fall severely while SpO₂ remains normal. Sustained MAP below 55 mmHg causes end-organ ischemia. The passive deterioration you see on the arterial line is real — this patient needs intervention now.',
              /* Continued deterioration: CO drops further, BP worsens */
              effects   : { patient:{ cardiacOutput:0.42 }, vit:{ sysBP:-20, diaBP:-10 }, vent:{}, overlaySpeed:0.018 },
            },
          ],
        },

        /* ── Step 2 ── */
        {
          phase    : 'Intervention',
          clue     : 'Key clue: BP has partially improved after vasopressor, but EtCO₂ is still lower than expected for normal ventilation settings. This is dead-space physiology — a direct marker of the cardiac output that has not yet fully recovered.',
          question : 'After vasopressor, BP improves but remains soft (~90/54). EtCO₂ is around 26–29 mmHg — lower than expected with RR 12 and TV 480 mL. What is the most likely explanation for the persistently low EtCO₂?',

          /* Gentle improvement during step 2 as vasopressor residual effect continues */
          passiveDeterior : {
            rate    : 0.001,
            vit     : { sysBP:5, diaBP:3 },
            patient : { cardiacOutput:0.86 },
          },

          choices : [
            {
              text      : 'A. Hyperventilation — RR must have been set too high',
              isCorrect : false,
              feedback  : 'Incorrect. RR is unchanged at 12. If the rate caused hyperventilation, EtCO₂ would have been low from the start — not just after BP dropped.',
              effects   : { patient:{}, vit:{}, vent:{}, overlaySpeed:0.018 },
            },
            {
              text      : 'B. Reduced cardiac output causing increased alveolar dead space',
              isCorrect : true,
              feedback  : 'Correct. EtCO₂ reflects CO₂ that arrives at ventilated alveoli via pulmonary blood flow. When cardiac output falls, less CO₂ is delivered per breath — so EtCO₂ falls even with unchanged ventilation settings. This makes a falling EtCO₂ an early, indirect marker of hemodynamic compromise. As cardiac output continues to recover, EtCO₂ should trend back toward 34–38 mmHg.',
              /* Fluid/volatile reduction: slower than vasopressor. CO recovers toward normal. */
              effects   : { patient:{ cardiacOutput:0.92, co2Prod:192 }, vit:{ sysBP:16, diaBP:8 }, vent:{}, overlaySpeed:0.015 },
            },
            {
              text      : 'C. Circuit leak — exhaled tidal volume is falling',
              isCorrect : false,
              feedback  : 'Incorrect. A circuit leak would show a clear mismatch between inspiratory and expiratory tidal volumes on the ventilator numerics, and would likely trigger a disconnect alarm. Exhaled TV is normal here.',
              effects   : { patient:{}, vit:{}, vent:{}, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Fever — elevated metabolism is consuming more CO₂',
              isCorrect : false,
              feedback  : 'Incorrect. Fever increases CO₂ production, which raises EtCO₂. A falling EtCO₂ with unchanged ventilation always points toward reduced CO₂ delivery to the lungs — i.e., low cardiac output or a perfusion problem.',
              effects   : { patient:{}, vit:{}, vent:{}, overlaySpeed:0.018 },
            },
          ],
        },
      ],

      resolution : 'Volatile anesthetics reduce SVR and myocardial contractility. Post-induction hypotension is common and usually responds to vasopressors ± modest fluid. The key teaching point: a falling EtCO₂ with unchanged ventilation settings is an early, sensitive indicator of reduced cardiac output — it precedes SpO₂ changes by minutes. As hemodynamics recover, watch EtCO₂ normalize on the capnogram.',
    },

    /* ── 2. Anaphylaxis to Rocuronium ───────────────────────────────────── */
    {
      id        : 'anaphylaxis',
      title     : 'Anaphylaxis to Rocuronium',
      badge     : 'Emergency',
      badgeColor: '#ff3333',
      summary   : 'Sixty seconds after rocuronium for intubation, the patient develops diffuse erythema and BP crashes. Peak pressures are climbing. The arterial line shows a small, fast waveform.',

      /* calibrated: etco2Target ≈ 42 with CO=0.45, R=40, co2Prod=200 (resistBonus capped at 12) */
      /* VC: plat = 5 + 480/32 = 20 cmH2O; pip = 20 + 40×0.48 = 39.2 ≈ 39 cmH2O             */
      initialPatient : { compliance:32, resistance:40, co2Prod:200, leak:0, cardiacOutput:0.45 },
      initialVitals  : { hr:138, sysBP:52, diaBP:28, spo2:93, bis:52, etco2Display:42 },
      initialVent    : { tv:480, rr:12, peep:5, fio2:50, ti:1.0 },

      steps : [
        /* ── Step 1 ── */
        {
          phase    : 'Deterioration',
          clue     : 'Key clue: Hemodynamics and airway pressure are failing simultaneously. Arterial line amplitude has collapsed, PIP is ~39 cmH₂O with Pplat 20 — widened gap from bronchospasm. Capnogram is developing an obstructive shark-fin morphology. SpO₂ is falling. Two organ systems at once = anaphylaxis.',
          question : 'BP 52/28 (MAP 36), HR 138, PIP ~39 cmH₂O (Pplat 20), SpO₂ 93% and trending down. Diffuse erythema. Sixty seconds after rocuronium. What is the single most important immediate action?',

          /* Rapid deterioration if untreated — anaphylaxis is a medical emergency */
          passiveDeterior : {
            rate    : 0.003,
            vit     : { sysBP:32, diaBP:16, spo2:87, hr:148 },
            patient : { resistance:52, compliance:26, cardiacOutput:0.35 },
          },

          choices : [
            {
              text      : 'A. Give epinephrine IV (or IM if no IV) and switch FiO₂ to 100%',
              isCorrect : true,
              feedback  : 'Correct. Epinephrine is the only agent that simultaneously treats all pathophysiologic processes in anaphylaxis: α₁ effects restore vasomotor tone (↑BP and arterial waveform amplitude), β₂ effects reverse bronchospasm (watch PIP fall from ~39 toward the low 20s over the next several breaths), and β₁ effects increase cardiac output. 100% FiO₂ is essential with SpO₂ at 93% and falling. Watch the monitors: BP and pleth amplitude should begin improving within seconds; bronchospasm resolves more gradually over several breaths.',
              /* Epi: fast, strong hemodynamic + partial bronchodilation. */
              effects   : { patient:{ resistance:13, compliance:44, cardiacOutput:0.72 }, vit:{ sysBP:50, diaBP:30, hr:-28, spo2:5 }, vent:{ fio2:100 }, overlaySpeed:0.030 },
            },
            {
              text      : 'B. Increase sevoflurane to deepen anesthesia',
              isCorrect : false,
              feedback  : 'Incorrect — and acutely dangerous. Volatile anesthetics are potent vasodilators and myocardial depressants. Deepening anesthesia in a patient with MAP of ~36 and cardiovascular collapse will almost certainly cause cardiac arrest. The stress response here is compensatory, not something to suppress.',
              /* Sevo worsens vasodilation; CO drops; bronchospasm untreated */
              effects   : { patient:{ cardiacOutput:0.28, resistance:44 }, vit:{ sysBP:-24, diaBP:-14, hr:18, spo2:-4 }, vent:{}, overlaySpeed:0.020 },
            },
            {
              text      : 'C. Lower PEEP to reduce intrathoracic pressure',
              isCorrect : false,
              feedback  : 'Partially conceptually relevant, but critically insufficient. While lowering PEEP can marginally improve venous return in a hypovolemic patient, this does nothing to reverse mast cell degranulation, bronchospasm, or anaphylactic vasodilation. The patient continues to deteriorate.',
              effects   : { patient:{ cardiacOutput:0.38 }, vit:{ sysBP:-8 }, vent:{ peep:2 }, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Wait for the NIBP cuff to recycle for a more accurate reading',
              isCorrect : false,
              feedback  : 'Incorrect. The arterial line is already showing 52/28. Waiting wastes critical seconds in anaphylactic shock. Within 2–3 minutes of untreated cardiovascular collapse, the patient can progress to cardiac arrest.',
              /* Further rapid deterioration */
              effects   : { patient:{ cardiacOutput:0.28, resistance:50 }, vit:{ sysBP:-20, diaBP:-10, spo2:-4 }, vent:{}, overlaySpeed:0.022 },
            },
          ],
        },

        /* ── Step 2 ── */
        {
          phase    : 'Intervention',
          clue     : 'Key clue: Epinephrine is working — BP and pleth amplitude are improving, PIP is falling. But airway pressures are still elevated and the patient is volume-depleted from massive vasodilation.',
          question : 'Epi given. BP improving to ~84/50. HR still 110. PIP has fallen from ~39 toward the low 20s. SpO₂ stabilizing at 95%. FiO₂ at 100%. What are the most important next concurrent steps?',

          /* Ongoing improvement from residual epi effect */
          passiveDeterior : {
            rate    : 0.001,
            vit     : { sysBP:5, diaBP:3, spo2:1 },
            patient : { cardiacOutput:0.78, resistance:11 },
          },

          choices : [
            {
              text      : 'A. Give IV fluid bolus, call for help, and avoid re-exposure to the trigger',
              isCorrect : true,
              feedback  : 'Correct. Anaphylaxis management after epinephrine: (1) IV fluids — massive vasodilation and capillary leak cause profound volume depletion that vasopressors alone cannot correct. (2) Call for help — you need extra hands, possibly intensivist backup, and post-anesthesia monitoring. (3) Stop or avoid the trigger — do not re-expose. Peak pressure should continue falling as bronchospasm resolves. Corticosteroids and H₁/H₂ antihistamines are adjuncts but are not substitutes for epinephrine and fluids.',
              /* Fluids: slower than epi. CO recovers further. */
              effects   : { patient:{ resistance:9, cardiacOutput:0.88, co2Prod:215 }, vit:{ sysBP:32, diaBP:18, hr:-22, spo2:3 }, vent:{}, overlaySpeed:0.014 },
            },
            {
              text      : 'B. Give metoprolol to control the tachycardia',
              isCorrect : false,
              feedback  : 'Incorrect — and dangerous. HR 110 here is compensatory, maintaining cardiac output in the face of profound vasodilation. Beta-blockade blunts epinephrine\'s beneficial effects (β₁ and β₂) and can cause refractory, treatment-resistant anaphylaxis. This is a known mechanism of epinephrine resistance.',
              effects   : { patient:{ cardiacOutput:0.52 }, vit:{ sysBP:-26, hr:-18 }, vent:{}, overlaySpeed:0.022 },
            },
            {
              text      : 'C. Reduce minute ventilation to lower intrathoracic pressure',
              isCorrect : false,
              feedback  : 'Incorrect. Reducing ventilation with persistent bronchospasm and SpO₂ at 95% will cause hypercapnia and worsen hypoxemia. Maintaining full ventilatory support is essential until airway resistance normalizes.',
              effects   : { patient:{}, vit:{ spo2:-3 }, vent:{}, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Nothing more — epinephrine worked, observe',
              isCorrect : false,
              feedback  : 'Incorrect. Epinephrine has a short half-life (3–5 minutes). Without volume resuscitation, BP will likely fall again as epinephrine wears off. Biphasic anaphylaxis (re-occurrence 4–12 hours later) is also a real risk that requires observation and often corticosteroids.',
              effects   : { patient:{ cardiacOutput:0.62 }, vit:{ sysBP:-12 }, vent:{}, overlaySpeed:0.018 },
            },
          ],
        },
      ],

      resolution : 'Anaphylaxis triad: hypotension + bronchospasm + tachycardia after drug exposure. Epinephrine is the only first-line drug — it addresses all three simultaneously. Observe the expected sequence: arterial line and pleth amplitude improve first (seconds), then peak pressure falls as bronchospasm resolves (several breaths), then SpO₂ stabilizes. Fluids, help, and avoiding the trigger complete acute management.',
    },

    /* ── 3. Bronchospasm After Airway Stimulation ────────────────────────── */
    {
      id        : 'bronchospasm',
      title     : 'Bronchospasm After Airway Stimulation',
      badge     : 'Airway',
      badgeColor: '#ffcc00',
      summary   : 'During maintenance, brief airway suction triggers progressive bronchospasm. Peak pressures are climbing and the flow waveform is showing a characteristic pattern.',

      /* calibrated: etco2Target ≈ 44 with CO=1.0, R=45, co2Prod=178 (resistBonus capped at 12) */
      /* VC: plat = 5 + 480/37 = 18 cmH2O; pip = 18 + 45×0.48 = 39.6 ≈ 40 cmH2O            */
      initialPatient : { compliance:37, resistance:45, co2Prod:178, leak:0, cardiacOutput:1.0 },
      initialVitals  : { hr:96, sysBP:130, diaBP:80, spo2:97, bis:52, etco2Display:44 },
      initialVent    : { tv:480, rr:12, peep:5, fio2:50, ti:1.0 },

      steps : [
        /* ── Step 1 ── */
        {
          phase    : 'Deterioration',
          clue     : 'Key clue: PIP ~40 cmH₂O while Pplat is only ~18 cmH₂O — peak-to-plateau gap of ~22 cmH₂O. A large gap means high airway resistance (not poor compliance). Expiratory flow does not return to zero before the next breath: air is trapping. Capnogram shows the obstructive "shark-fin" upslope.',
          waveformTeachPreset: 'obstructive_bronchospasm',
          waveformLearningObjective: 'Recognize resistance-dominant obstruction: widened PIP-Pplat gap with delayed expiratory flow return.',
          question : 'PIP is ~40 cmH₂O. Pplat is ~18 cmH₂O. The peak-to-plateau gap is ~22 cmH₂O, indicating high airway resistance. Expiratory flow does not return to zero before the next breath. EtCO₂ is 44 mmHg with an obstructive upsloping capnogram. SpO₂ is still 97%. What is the best next step?',

          /* Untreated: resistance worsens, SpO2 starts falling, HR rises from stress */
          passiveDeterior : {
            rate    : 0.0020,
            patient : { resistance:56 },
            vit     : { spo2:92, hr:108 },
          },

          choices : [
            {
              text      : 'A. Give inhaled bronchodilator (salbutamol MDI) and deepen sevoflurane',
              isCorrect : true,
              feedback  : 'Correct. Bronchodilators (β₂ agonists) directly relax airway smooth muscle. Volatile anesthetics — especially sevoflurane and isoflurane — have intrinsic bronchodilatory properties and also blunt the vagal reflex driving spasm. Together they address both pharmacological and neural components. Watch the monitors respond: PIP will drop from ~40 toward the low 20s, the peak-to-plateau gap will narrow significantly, expiratory flow will start returning to zero earlier, and the shark-fin capnogram will gradually smooth out.',
              /* Bronchodilation is gradual (several breaths) — use slow overlay speed */
              effects   : { patient:{ resistance:10 }, vit:{ hr:-8 }, vent:{}, overlaySpeed:0.008 },
            },
            {
              text      : 'B. Increase respiratory rate to 20 to wash out the elevated CO₂',
              isCorrect : false,
              feedback  : 'Incorrect — and harmful. Increasing RR in obstructive physiology shortens expiratory time. The expiratory flow waveform already does not return to zero — meaning the lungs are not fully emptying before the next breath. Faster breathing = less expiratory time = progressive air trapping and rising auto-PEEP. Watch what happens: breaths stack, auto-PEEP rises, PIP climbs further above 40, and elevated intrathoracic pressure may cause BP to drop.',
              /* RR 20 worsens air trapping; effective resistance rises */
              effects   : { patient:{ resistance:52 }, vit:{ sysBP:-12, hr:10 }, vent:{ rr:20 }, overlaySpeed:0.020 },
            },
            {
              text      : 'C. Observe — SpO₂ is still 97%',
              isCorrect : false,
              feedback  : 'Incorrect. SpO₂ is a lagging indicator in bronchospasm. By the time saturation falls, PIP is already dangerously elevated and the patient is much harder to rescue. Treat the obstructive physiology you can already see on the ventilator waveforms while you still have reserve.',
              /* Resistance continues to worsen, SpO2 begins to drift */
              effects   : { patient:{ resistance:56 }, vit:{ spo2:-3 }, vent:{}, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Decrease FiO₂ to 21% to prevent oxygen toxicity',
              isCorrect : false,
              feedback  : 'Incorrect — and actively dangerous. Oxygen toxicity is clinically irrelevant over any operative time frame. Reducing FiO₂ in a patient with developing bronchospasm and impaired ventilation will accelerate desaturation.',
              effects   : { patient:{ resistance:52 }, vit:{ spo2:-4 }, vent:{ fio2:21 }, overlaySpeed:0.018 },
            },
          ],
        },

        /* ── Step 2 ── */
        {
          phase    : 'Intervention',
          clue     : 'Key clue: PIP is trending down as resistance improves, but the flow waveform still does not return to zero before the next breath — auto-PEEP persists. τ = R × C is still prolonged. The lung needs 3×τ to empty 95%. Slowing RR extends expiratory time and lets gas fully exit.',
          waveformTeachPreset: 'air_trapping',
          waveformLearningObjective: 'Identify dynamic hyperinflation and choose ventilator adjustments that restore full exhalation.',
          question : 'Bronchodilator and deeper sevo are working — PIP is trending down (from ~40 toward the low 20s). But the flow waveform still does not return to baseline before the next breath starts. What ventilator adjustment helps most with this remaining obstructive pattern?',

          /* Gradual ongoing improvement as bronchodilator continues to take effect */
          passiveDeterior : {
            rate    : 0.001,
            patient : { resistance:8 },
            vit     : { hr:-4 },
          },

          choices : [
            {
              text      : 'A. Decrease RR (e.g. to 8 br/min) to allow longer expiratory time',
              isCorrect : true,
              feedback  : 'Correct. In obstruction, the RC expiratory time constant τ = R × C is prolonged. With R still near 10 and C = 37, τ ≈ 0.37 s — the lung needs ~1.1 s minimum to empty. Slowing RR from 12 to 8 extends expiratory time from ~4 s to ~6.5 s, allowing full exhalation before the next breath. Watch the flow waveform return to zero, auto-PEEP fall, and PIP continue toward ~21 cmH₂O. Note: EtCO₂ may rise briefly when RR drops to 8 — this is expected and acceptable while resistance is still resolving.',
              /* Slower rate + continued bronchodilation */
              effects   : { patient:{ resistance:6 }, vit:{ hr:-5 }, vent:{ rr:8 }, overlaySpeed:0.012 },
            },
            {
              text      : 'B. Increase RR to 20 to wash out the CO₂ faster',
              isCorrect : false,
              feedback  : 'Incorrect — same error as step 1. The time constant problem is not solved by breathing faster. Shorter expiratory time makes air trapping worse, auto-PEEP rises further, and PIP increases again. Watch the flow waveform: the gap widens, pressures climb, and BP may drift down from increased mean intrathoracic pressure.',
              effects   : { patient:{ resistance:22 }, vit:{ sysBP:-12 }, vent:{ rr:20 }, overlaySpeed:0.020 },
            },
            {
              text      : 'C. Increase PEEP to 15 cmH₂O to stent open the airways',
              isCorrect : false,
              feedback  : 'Incorrect. Applied PEEP above the level of auto-PEEP in dynamic hyperinflation simply adds to total end-expiratory pressure and worsens overdistension. High PEEP is beneficial for recruitable atelectasis (low-compliance states), not for obstructive physiology. In a hypovolemic patient, it can also cause hemodynamic compromise.',
              effects   : { patient:{}, vit:{ sysBP:-15 }, vent:{ peep:15 }, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Switch to pressure control to limit peak pressure',
              isCorrect : false,
              feedback  : 'Not the correct priority. Switching to pressure control in a high-resistance state will reduce the tidal volume delivered (TV is resistance-dependent in PC mode). The core problem is incomplete exhalation — a mode switch does not give the lungs more time to empty.',
              effects   : { patient:{}, vit:{}, vent:{}, overlaySpeed:0.018 },
            },
          ],
        },
      ],

      resolution : 'Bronchospasm key pattern: PIP rises disproportionately over Pplat (peak-to-plateau gap widens), expiratory flow is prolonged and may not return to zero, capnogram develops shark-fin morphology, and EtCO₂ rises. Treatment: bronchodilators + deeper volatile. Critical ventilator adjustment: slow RR to allow full exhalation. Never increase RR in obstructive physiology — it is one of the most teachable "wrong answers" in anesthesia.',
    },

    /* ── 4. Right Mainstem Intubation After Positioning ─────────────────── */
    {
      id        : 'right_mainstem_after_turn',
      title     : 'Pressure After Positioning',
      badge     : 'Airway',
      badgeColor: '#3399ff',
      summary   : 'Soon after intubation and patient positioning, oxygenation drifts down while airway pressures rise. The capnogram is still present, but the ventilator and chest exam no longer look symmetric.',

      initialPatient : { compliance:32, resistance:8, co2Prod:170, leak:0, cardiacOutput:0.95 },
      initialVitals  : { hr:105, sysBP:118, diaBP:70, spo2:92, bis:46, etco2Display:43 },
      initialVent    : { tv:480, rr:12, peep:5, fio2:50, ti:1.0 },

      steps : [
        /* ── Step 1 ── */
        {
          phase : 'Deterioration',
          clue  : 'Key clue: After the table is rotated, peak inspiratory pressure is 36 cmH₂O and plateau pressure is 32 cmH₂O — a narrow peak-to-plateau gap (4 cmH₂O). Expiratory flow returns to zero. The capnogram remains rectangular and EtCO₂ is 43 mmHg. SpO₂ has drifted from 99% to 92% on FiO₂ 50%. Right-sided chest rise is more prominent than left.',
          question : 'Peak pressure is 36 cmH₂O, plateau is 32 cmH₂O, SpO₂ is 92% and falling, EtCO₂ is 43 mmHg, and chest rise is asymmetric after positioning. What is the most appropriate next step?',

          passiveDeterior : {
            rate    : 0.002,
            vit     : { spo2:88, etco2Display:47 },
            patient : { compliance:26 },
          },

          choices : [
            {
              text      : 'A. Increase PEEP from 5 to 12 cmH₂O and continue the case',
              isCorrect : false,
              feedback  : 'Incorrect. More PEEP may recruit lung later, but it does not fix asymmetric ventilation. If only one lung is receiving the tidal volume, extra PEEP worsens overdistention of the ventilated lung and delays correction of the tube position.',
              effects   : { patient:{ compliance:29 }, vit:{ sysBP:-8, spo2:-1 }, vent:{ peep:12 }, overlaySpeed:0.018 },
            },
            {
              text      : 'B. Switch to 100% FiO₂, verify tube depth, and withdraw the ETT until bilateral breath sounds and symmetric chest rise return',
              isCorrect : true,
              feedback  : 'Correct. The narrow peak-to-plateau gap indicates a compliance problem, not bronchospasm. Asymmetric chest rise after positioning strongly suggests the tube has migrated into the right mainstem. Withdrawing the tube while ventilating at 100% O₂ restores bilateral ventilation, lowers plateau pressure, and allows SpO₂ to recover.',
              effects   : { patient:{ compliance:52, resistance:7 }, vit:{ spo2:6, etco2Display:-4 }, vent:{ fio2:100 }, overlaySpeed:0.034 },
            },
            {
              text      : 'C. Give albuterol through the ETT for presumed bronchospasm',
              isCorrect : false,
              feedback  : 'Incorrect. Bronchospasm produces a large peak-to-plateau gap, expiratory flow that may not return to zero, and a shark-fin capnogram. Here plateau pressure is also elevated and chest rise is asymmetric — these point to tube malposition, not bronchospasm.',
              effects   : { patient:{ resistance:6 }, vit:{ spo2:-1 }, vent:{}, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Increase respiratory rate to 20 to wash out the rising EtCO₂',
              isCorrect : false,
              feedback  : 'Incorrect. Increasing RR shortens expiratory time without addressing the underlying cause. It can also mask deteriorating oxygenation while the atelectatic lung worsens. The focus must be on why only one lung is being ventilated.',
              effects   : { patient:{ compliance:28 }, vit:{ spo2:-2, etco2Display:-1 }, vent:{ rr:20 }, overlaySpeed:0.015 },
            },
          ],
        },

        /* ── Step 2 ── */
        {
          phase : 'Resolution',
          clue  : 'Key clue: After tube repositioning, peak pressure is 26 cmH₂O and plateau pressure is 21 cmH₂O. SpO₂ is 96% and rising on FiO₂ 100%. EtCO₂ is 39 mmHg. Breath sounds are now symmetric, but saturation has not fully returned to baseline — the previously excluded lung is still partly atelectatic.',
          question : 'Bilateral ventilation is restored and pressures have improved, but SpO₂ is 96% and still recovering. What is the best next step to complete the rescue and prevent recurrence?',

          passiveDeterior : {
            rate    : 0.001,
            vit     : { spo2:-1 },
            patient : {},
          },

          choices : [
            {
              text      : 'A. Advance the tube 2 cm to improve the cuff seal',
              isCorrect : false,
              feedback  : 'Incorrect. The problem improved after withdrawal — advancing risks re-creating right mainstem intubation. A cuff seal issue would show an exhaled volume leak alarm, not this pressure-and-asymmetry pattern.',
              effects   : { patient:{ compliance:20 }, vit:{ spo2:-4 }, vent:{}, overlaySpeed:0.015 },
            },
            {
              text      : 'B. Perform a gentle recruitment maneuver, set PEEP 7–8 cmH₂O for alveolar stability, then recheck tube depth after every table movement',
              isCorrect : true,
              feedback  : 'Correct. The excluded lung may have collapsed during the period of one-lung ventilation. A brief sustained-inflation recruitment breath reopens dependent units, and modest PEEP prevents immediate de-recruitment. Confirming tube depth after every position change prevents recurrence.',
              effects   : { patient:{ compliance:60 }, vit:{ spo2:3, etco2Display:-1 }, vent:{ peep:8, fio2:60 }, overlaySpeed:0.030 },
            },
            {
              text      : 'C. Leave FiO₂ at 100% and make no other changes since pressures improved',
              isCorrect : false,
              feedback  : 'Incorrect. High FiO₂ buys time but promotes absorption atelectasis and does not re-open the collapsed lung. Once airway alignment is restored, the goal is to recruit lung volume and titrate FiO₂ safely downward.',
              effects   : { patient:{}, vit:{ spo2:0 }, vent:{}, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Reduce PEEP to 0 to lower peak airway pressure',
              isCorrect : false,
              feedback  : 'Incorrect. Removing PEEP after a period of single-lung ventilation worsens de-recruitment of the recovering lung. Lower peak pressure alone is not the endpoint — oxygenation and alveolar recruitment matter equally.',
              effects   : { patient:{ compliance:27 }, vit:{ spo2:-3 }, vent:{ peep:0 }, overlaySpeed:0.016 },
            },
          ],
        },
      ],

      resolution : 'A sudden rise in both peak and plateau pressure with asymmetric chest rise after positioning means tube malposition until proven otherwise. The key diagnostic move is separating resistance from compliance using the peak-to-plateau gap: a narrow gap (< 5 cmH₂O) means a compliance problem — check tube depth before treating anything else.',
    },

    /* ── 5. CO₂ Embolism During Laparoscopy ────────────────────────────── */
    {
      id        : 'laparoscopy_etco2_crash',
      title     : 'Crash During Insufflation',
      badge     : 'Emergency',
      badgeColor: '#ff3333',
      summary   : 'During laparoscopic insufflation, the arterial line and capnogram change abruptly within seconds despite completely unchanged ventilator settings.',

      initialPatient : { compliance:55, resistance:7, co2Prod:170, leak:0, cardiacOutput:0.55 },
      initialVitals  : { hr:128, sysBP:72, diaBP:38, spo2:90, bis:44, etco2Display:16 },
      initialVent    : { tv:450, rr:12, peep:5, fio2:60, ti:1.0 },

      steps : [
        /* ── Step 1 ── */
        {
          phase : 'Deterioration',
          clue  : 'Key clue: Thirty seconds after insufflation pressure is increased, EtCO₂ falls abruptly from 36 to 16 mmHg — no circuit disconnect alarm fires. Peak pressure is 23 cmH₂O and plateau is 19 cmH₂O (both unchanged). SpO₂ drops from 99% to 90%, HR rises to 128, and the arterial line reads 72/38 mmHg.',
          question : 'EtCO₂ has abruptly dropped to 16 mmHg during insufflation. BP is 72/38, SpO₂ is 90%, and airway pressures are completely unchanged. What is the most urgent next action?',

          passiveDeterior : {
            rate    : 0.003,
            vit     : { sysBP:52, spo2:85, etco2Display:10 },
            patient : { cardiacOutput:0.38 },
          },

          choices : [
            {
              text      : 'A. Increase respiratory rate to 20 to correct the low EtCO₂',
              isCorrect : false,
              feedback  : 'Incorrect. A sudden EtCO₂ drop with unchanged airway pressures reflects less CO₂ delivery to the lungs from impaired pulmonary blood flow — not excessive ventilation. Increasing minute ventilation may lower EtCO₂ further while the circulation worsens.',
              effects   : { patient:{ cardiacOutput:0.48 }, vit:{ sysBP:-8, etco2Display:-2 }, vent:{ rr:20 }, overlaySpeed:0.016 },
            },
            {
              text      : 'B. Tell the surgeon to stop insufflation and desufflate immediately; switch to 100% FiO₂ and support circulation',
              isCorrect : true,
              feedback  : 'Correct. Normal airway pressures rule out bronchospasm or pneumothorax. An abrupt EtCO₂ collapse during insufflation with hemodynamic shock is a CO₂ embolism pattern until proven otherwise. Stopping and releasing pneumoperitoneum removes the source, improves venous return and pulmonary blood flow, and should raise EtCO₂, SpO₂, and BP.',
              effects   : { patient:{ cardiacOutput:0.78 }, vit:{ sysBP:28, spo2:6, etco2Display:12 }, vent:{ fio2:100 }, overlaySpeed:0.034 },
            },
            {
              text      : 'C. Deepen anesthesia — the tachycardia suggests light anesthesia',
              isCorrect : false,
              feedback  : 'Incorrect. BIS is in the adequate anesthetic range. The tachycardia is a compensatory response to low cardiac output. Additional volatile or IV anesthetic worsens vasodilation and myocardial depression in an already collapsing circulation.',
              effects   : { patient:{ cardiacOutput:0.44 }, vit:{ sysBP:-12, spo2:-1 }, vent:{}, overlaySpeed:0.015 },
            },
            {
              text      : 'D. Treat for bronchospasm with albuterol and hand ventilation',
              isCorrect : false,
              feedback  : 'Incorrect. Bronchospasm raises peak pressure, widens the peak-to-plateau gap, and distorts the capnogram upstroke. Here airway mechanics are completely unchanged — the capnogram is warning about perfusion, not obstruction.',
              effects   : { patient:{ resistance:6, cardiacOutput:0.50 }, vit:{ sysBP:-6, etco2Display:-1 }, vent:{}, overlaySpeed:0.018 },
            },
          ],
        },

        /* ── Step 2 ── */
        {
          phase : 'Intervention',
          clue  : 'Key clue: After desufflation and 100% O₂, EtCO₂ rises from 16 to 24 mmHg and SpO₂ improves to 94%, confirming the insufflation was the driver. But BP remains 84/45 with HR 122. Peak pressure is 22 cmH₂O and plateau is 18 cmH₂O.',
          question : 'The capnogram and SpO₂ are improving after desufflation, but hypotension and persistent low EtCO₂ continue. What is the best next management priority?',

          passiveDeterior : {
            rate    : 0.002,
            vit     : { sysBP:70, etco2Display:20 },
            patient : { cardiacOutput:0.55 },
          },

          choices : [
            {
              text      : 'A. Restart insufflation at the same pressure — oxygenation has improved',
              isCorrect : false,
              feedback  : 'Incorrect. Improvement after desufflation confirms the insufflation was the cause. Restarting too early re-creates the obstruction to pulmonary blood flow and risks another collapse — potentially worse than the first.',
              effects   : { patient:{ cardiacOutput:0.36 }, vit:{ sysBP:-22, spo2:-5, etco2Display:-8 }, vent:{}, overlaySpeed:0.015 },
            },
            {
              text      : 'B. Give metoprolol to control the compensatory tachycardia',
              isCorrect : false,
              feedback  : 'Incorrect. The tachycardia is compensatory in a low-output state. Beta-blockade without first restoring preload and perfusion pressure reduces cardiac output further and worsens EtCO₂.',
              effects   : { patient:{ cardiacOutput:0.42 }, vit:{ hr:-25, sysBP:-14, etco2Display:-3 }, vent:{}, overlaySpeed:0.016 },
            },
            {
              text      : 'C. Maintain 100% O₂, give fluid and vasopressor support, and consider left lateral Trendelenburg positioning to move gas away from the right ventricular outflow tract',
              isCorrect : true,
              feedback  : 'Correct. Persistent low EtCO₂ and hypotension mean right-sided output has not fully recovered. Supporting preload and systemic pressure restores pulmonary blood flow. Left lateral Trendelenburg may help displace a gas bubble from the RVOT. EtCO₂ should continue rising toward baseline as cardiac output improves.',
              effects   : { patient:{ cardiacOutput:0.92 }, vit:{ sysBP:34, spo2:5, etco2Display:14 }, vent:{}, overlaySpeed:0.032 },
            },
            {
              text      : 'D. Increase PEEP to 15 cmH₂O to improve oxygenation further',
              isCorrect : false,
              feedback  : 'Incorrect. The problem is primarily circulatory, not a lung-recruitment problem. Raising intrathoracic pressure reduces venous return and worsens right-sided output in a patient who is already hypotensive — the opposite of what is needed.',
              effects   : { patient:{ cardiacOutput:0.46 }, vit:{ sysBP:-12, spo2:1, etco2Display:-2 }, vent:{ peep:15 }, overlaySpeed:0.018 },
            },
          ],
        },
      ],

      resolution : 'A sudden EtCO₂ collapse with normal airway pressures during laparoscopy is a CO₂ embolism pattern until proven otherwise. The high-yield move is: stop the source → desufflate → 100% O₂ → support the right heart. Watch EtCO₂ normalize as cardiac output recovers — it is the most sensitive real-time marker of pulmonary blood flow at the bedside.',
    },

    /* ── 6. Tension Pneumothorax ────────────────────────────────────────── */
    {
      id        : 'intraop_tension_pneumothorax',
      title     : 'Narrow Pressure Gap',
      badge     : 'Emergency',
      badgeColor: '#ff3333',
      summary   : 'Mid-case, the ventilator suddenly struggles against a stiff chest while the arterial line collapses. The capnogram is still present but EtCO₂ is falling and each breath is delivering less useful gas exchange.',

      initialPatient : { compliance:24, resistance:8, co2Prod:170, leak:0, cardiacOutput:0.55 },
      initialVitals  : { hr:135, sysBP:78, diaBP:44, spo2:88, bis:47, etco2Display:28 },
      initialVent    : { tv:480, rr:12, peep:5, fio2:60, ti:1.0 },

      steps : [
        /* ── Step 1 ── */
        {
          phase : 'Deterioration',
          clue  : 'Key clue: Peak inspiratory pressure has risen to 42 cmH₂O and plateau pressure is 40 cmH₂O — a narrow peak-to-plateau gap of 2 cmH₂O. Expiratory flow returns to zero. SpO₂ falls to 88%, EtCO₂ drifts from 36 to 28 mmHg, HR is 135, and the arterial line reads 78/44 mmHg. Right chest movement is visibly reduced compared with the left.',
          question : 'Peak pressure is 42 cmH₂O, plateau is 40 cmH₂O, SpO₂ is 88%, EtCO₂ is falling, and BP is 78/44 with asymmetric right-sided chest movement. What is the most urgent next step?',

          passiveDeterior : {
            rate    : 0.003,
            vit     : { sysBP:54, spo2:82, etco2Display:20 },
            patient : { cardiacOutput:0.38, compliance:18 },
          },

          choices : [
            {
              text      : 'A. Give albuterol for the high peak airway pressure',
              isCorrect : false,
              feedback  : 'Incorrect. The plateau pressure is nearly as high as peak pressure (narrow gap), so this is not primarily an airway resistance problem — it is a compliance problem. Bronchodilator therapy delays treatment while obstructive shock worsens.',
              effects   : { patient:{ resistance:6, cardiacOutput:0.50 }, vit:{ sysBP:-8, spo2:-2 }, vent:{}, overlaySpeed:0.018 },
            },
            {
              text      : 'B. Switch to 100% FiO₂, call for help, and immediately decompress the right chest (needle decompression → tube thoracostomy)',
              isCorrect : true,
              feedback  : 'Correct. The narrow peak-to-plateau gap signals a compliance problem, not resistance. Simultaneous hypotension, falling EtCO₂, hypoxemia, and asymmetric chest movement is the OR pattern for tension pneumothorax. Decompression rapidly restores compliance, venous return, EtCO₂, SpO₂, and blood pressure.',
              effects   : { patient:{ compliance:50, cardiacOutput:0.85 }, vit:{ sysBP:42, spo2:9, etco2Display:9 }, vent:{ fio2:100 }, overlaySpeed:0.036 },
            },
            {
              text      : 'C. Suction the ETT for a possible mucus plug',
              isCorrect : false,
              feedback  : 'Incorrect. A mucus plug causes lobar atelectasis and can raise pressures, but it produces gradual rather than acute obstructive shock. More importantly, suctioning should never delay decompression when this hemodynamic and ventilator pattern is present.',
              effects   : { patient:{ compliance:22 }, vit:{ sysBP:-10, spo2:-2, etco2Display:-2 }, vent:{}, overlaySpeed:0.017 },
            },
            {
              text      : 'D. Increase PEEP to 12 cmH₂O to splint the lung open',
              isCorrect : false,
              feedback  : 'Incorrect. Adding PEEP raises mean intrathoracic pressure and severely worsens venous return in a patient with obstructive shock. It may also enlarge the pneumothorax by increasing airway pressure against the defect.',
              effects   : { patient:{ cardiacOutput:0.38, compliance:20 }, vit:{ sysBP:-20, spo2:-3, etco2Display:-4 }, vent:{ peep:12 }, overlaySpeed:0.015 },
            },
          ],
        },

        /* ── Step 2 ── */
        {
          phase : 'Resolution',
          clue  : 'Key clue: After emergency decompression, peak pressure falls to 25 cmH₂O and plateau is 20 cmH₂O. SpO₂ rises to 95%, EtCO₂ recovers to 35 mmHg, and BP improves to 112/64. Breath sounds are now symmetric. FiO₂ is still at 100%.',
          question : 'The acute physiology has improved after decompression. What is the best next step to fully stabilize the patient and prevent recurrence?',

          passiveDeterior : {
            rate    : 0.001,
            vit     : { spo2:94 },
            patient : {},
          },

          choices : [
            {
              text      : 'A. Clamp the decompression catheter now that BP has recovered',
              isCorrect : false,
              feedback  : 'Incorrect. Clamping before a formal chest tube allows pressure to re-accumulate. Improvement confirms decompression was therapeutic — it does not mean the underlying problem has resolved.',
              effects   : { patient:{ compliance:16, cardiacOutput:0.44 }, vit:{ sysBP:-18, spo2:-5, etco2Display:-5 }, vent:{}, overlaySpeed:0.015 },
            },
            {
              text      : 'B. Confirm a functioning chest tube, avoid nitrous oxide, maintain lung-protective pressures, and recheck with ultrasound or CXR when stable',
              isCorrect : true,
              feedback  : 'Correct. Needle decompression is a bridge; a chest tube is the definitive step. Avoiding nitrous (which expands gas-filled spaces) and excessive airway pressures prevents enlargement or recurrence. Imaging confirms lung re-expansion before the case continues.',
              effects   : { patient:{ compliance:55, cardiacOutput:0.92 }, vit:{ sysBP:8, spo2:3, etco2Display:2 }, vent:{ fio2:60, peep:5 }, overlaySpeed:0.030 },
            },
            {
              text      : 'C. Return to the original large tidal volume — pressures have normalized',
              isCorrect : false,
              feedback  : 'Incorrect. Normalized pressures after decompression do not mean the injured pleura can tolerate aggressive ventilation. High tidal volumes increase airway pressure against the defect and risk recurrence or barotrauma.',
              effects   : { patient:{ compliance:46 }, vit:{ spo2:-1, sysBP:-4 }, vent:{ tv:600 }, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Treat the event as resolved and continue without informing the surgical team',
              isCorrect : false,
              feedback  : 'Incorrect. This was a life-threatening intraoperative event requiring shared situational awareness. Failure to communicate increases risk during closure, positioning, or emergence — and is a patient-safety failure.',
              effects   : { patient:{ cardiacOutput:0.80 }, vit:{ sysBP:-6, spo2:-1 }, vent:{}, overlaySpeed:0.016 },
            },
          ],
        },
      ],

      resolution : 'When both peak and plateau pressures rise together (narrow gap), the problem is compliance — not airway resistance. The intraoperative tension pneumothorax triad: stiff ventilation (high Pplat) + obstructive shock + asymmetric chest movement. Decompress first, image later.',
    },

    /* ── 7. COPD Auto-PEEP / Dynamic Hyperinflation ────────────────────── */
    {
      id        : 'copd_auto_peep',
      title     : 'Stacked Breaths',
      badge     : 'Airway',
      badgeColor: '#3399ff',
      summary   : 'A patient with COPD is mechanically ventilated after induction. Oxygenation is acceptable, but the pressure, flow, and capnogram waveforms show each breath arriving before the last one is fully finished.',

      initialPatient : { compliance:68, resistance:26, co2Prod:170, leak:0, cardiacOutput:0.85 },
      initialVitals  : { hr:108, sysBP:96, diaBP:54, spo2:94, bis:48, etco2Display:52 },
      initialVent    : { tv:500, rr:16, peep:5, fio2:50, ti:1.0 },

      steps : [
        /* ── Step 1 ── */
        {
          phase : 'Deterioration',
          clue  : 'Key clue: Peak inspiratory pressure is 44 cmH₂O while plateau pressure is only 22 cmH₂O — a wide peak-to-plateau gap of 22 cmH₂O. The expiratory flow waveform does not return to zero before the next breath begins. The capnogram has a slanted, shark-fin upstroke and EtCO₂ is 52 mmHg. BP has drifted from 118/70 to 96/54.',
          question : 'Peak pressure is 44 cmH₂O, plateau is 22 cmH₂O, EtCO₂ is 52 mmHg, and expiratory flow does not reach baseline before the next breath. What ventilator change best addresses this physiology?',

          passiveDeterior : {
            rate    : 0.002,
            vit     : { sysBP:72, etco2Display:58 },
            patient : { cardiacOutput:0.70 },
          },

          choices : [
            {
              text      : 'A. Increase respiratory rate to 22 to lower the EtCO₂',
              isCorrect : false,
              feedback  : 'Incorrect. The elevated EtCO₂ is tempting to chase, but the waveform shows incomplete exhalation. Increasing rate shortens expiratory time, worsens air trapping, raises mean intrathoracic pressure, further reduces venous return, and will drop blood pressure further.',
              effects   : { patient:{ cardiacOutput:0.72, resistance:28 }, vit:{ sysBP:-12, etco2Display:2, spo2:-1 }, vent:{ rr:22 }, overlaySpeed:0.015 },
            },
            {
              text      : 'B. Reduce respiratory rate to 10–11, shorten inspiratory time to 0.75 s, and allow more time for exhalation',
              isCorrect : true,
              feedback  : 'Correct. The wide peak-to-plateau gap and expiratory flow that never reaches zero mean dynamic hyperinflation from high airway resistance. A slower rate and shorter Ti lengthen expiratory time, allowing trapped gas to exit, reducing auto-PEEP, lowering peak pressure, and improving venous return. EtCO₂ may transiently rise — that is acceptable.',
              effects   : { patient:{ cardiacOutput:0.92, resistance:20 }, vit:{ sysBP:16, etco2Display:-4, spo2:2 }, vent:{ rr:11, ti:0.75, tv:460 }, overlaySpeed:0.032 },
            },
            {
              text      : 'C. Increase tidal volume to improve alveolar ventilation',
              isCorrect : false,
              feedback  : 'Incorrect. The problem is not inadequate breath size — it is inadequate expiratory time. Larger tidal volumes worsen hyperinflation because the patient cannot fully exhale before the next breath arrives.',
              effects   : { patient:{ cardiacOutput:0.78, resistance:28 }, vit:{ sysBP:-10, spo2:-1 }, vent:{ tv:620 }, overlaySpeed:0.016 },
            },
            {
              text      : 'D. Increase PEEP to 12 cmH₂O because the patient has obstructive lung disease',
              isCorrect : false,
              feedback  : 'Incorrect. External PEEP in a spontaneously-breathing COPD patient can help trigger synchrony, but blindly raising PEEP during controlled ventilation adds to total end-expiratory pressure, worsens dynamic hyperinflation, and reduces venous return — directly worsening the hypotension.',
              effects   : { patient:{ cardiacOutput:0.72 }, vit:{ sysBP:-12, spo2:0 }, vent:{ peep:12 }, overlaySpeed:0.018 },
            },
          ],
        },

        /* ── Step 2 ── */
        {
          phase : 'Intervention',
          clue  : 'Key clue: After ventilator timing adjustment, peak pressure falls to 35 cmH₂O and plateau remains 21 cmH₂O. Expiratory flow nearly — but not fully — returns to zero. EtCO₂ is 48 mmHg, SpO₂ is 96%, and BP is 112/62. The capnogram still has a slanted expiratory upstroke consistent with residual obstruction.',
          question : 'Ventilator timing has improved, but the capnogram still shows expiratory obstruction. What is the best next optimization?',

          passiveDeterior : {
            rate    : 0.001,
            vit     : { etco2Display:50 },
            patient : {},
          },

          choices : [
            {
              text      : 'A. Give an inhaled bronchodilator and ensure adequate anesthetic depth while maintaining the long expiratory time',
              isCorrect : true,
              feedback  : 'Correct. The shark-fin capnogram and still-elevated resistance indicate ongoing bronchoconstriction or small-airway obstruction. Bronchodilation reduces intrinsic resistance, and deeper volatile anesthesia blunts airway reactivity — both reduce dynamic hyperinflation while the ventilator strategy prevents breath stacking from returning.',
              effects   : { patient:{ resistance:12, cardiacOutput:0.96 }, vit:{ sysBP:4, etco2Display:-5, spo2:1 }, vent:{}, overlaySpeed:0.030 },
            },
            {
              text      : 'B. Return respiratory rate to 16 because blood pressure has improved',
              isCorrect : false,
              feedback  : 'Incorrect. The improved blood pressure came directly from reducing dynamic hyperinflation. Returning to the original rate shortens expiratory time, recreates air trapping, and will bring back the hypotension.',
              effects   : { patient:{ cardiacOutput:0.78, resistance:28 }, vit:{ sysBP:-10, etco2Display:4 }, vent:{ rr:16 }, overlaySpeed:0.016 },
            },
            {
              text      : 'C. Perform an aggressive recruitment maneuver to improve the capnogram',
              isCorrect : false,
              feedback  : 'Incorrect. The slanted capnogram reflects expiratory obstruction, not derecruitment. A recruitment maneuver increases intrathoracic pressure and may worsen hemodynamics in a patient who just recovered from auto-PEEP-driven hypotension.',
              effects   : { patient:{ cardiacOutput:0.80 }, vit:{ sysBP:-8, spo2:0 }, vent:{}, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Ignore the waveform — SpO₂ is 96% so the patient is fine',
              isCorrect : false,
              feedback  : 'Incorrect. Acceptable SpO₂ can coexist with persistently inefficient ventilation and ongoing CO₂ retention. The flow and capnogram waveforms warn that airway resistance is still elevated and that the patient may deteriorate again if expiratory time or resistance are not addressed.',
              effects   : { patient:{ resistance:28, cardiacOutput:0.82 }, vit:{ sysBP:-6, etco2Display:3 }, vent:{}, overlaySpeed:0.015 },
            },
          ],
        },
      ],

      resolution : 'In obstructive physiology, a wide peak-to-plateau gap with expiratory flow that never returns to zero is the waveform signature of dynamic hyperinflation. The most dangerous reflex — increasing respiratory rate to chase EtCO₂ — makes it worse. Slow the rate, shorten Ti, and bronchodilate.',
    },

    /* ── 8. ARDS — Protective Ventilation & Driving Pressure ───────────── */
    {
      id        : 'ards_driving_pressure',
      title     : 'Plateau Pressure Check',
      badge     : 'Respiratory',
      badgeColor: '#0d9488',
      summary   : 'An intubated patient has worsening oxygenation on volume-control ventilation. The peak pressure is high, but the plateau pressure tells the more important story about lung injury risk.',

      initialPatient : { compliance:24, resistance:9, co2Prod:180, leak:0, cardiacOutput:0.90 },
      initialVitals  : { hr:102, sysBP:112, diaBP:64, spo2:91, bis:45, etco2Display:37 },
      initialVent    : { tv:520, rr:20, peep:8, fio2:70, ti:0.9 },

      steps : [
        /* ── Step 1 ── */
        {
          phase : 'Deterioration',
          clue  : 'Key clue: Peak inspiratory pressure is 39 cmH₂O and plateau pressure is 35 cmH₂O — a narrow peak-to-plateau gap of 4 cmH₂O. PEEP is 8 cmH₂O, giving a driving pressure (Pplat − PEEP) of 27 cmH₂O. Expiratory flow returns to zero and the capnogram is rectangular. SpO₂ is 91% on FiO₂ 70%, EtCO₂ is 37 mmHg.',
          question : 'Peak pressure is 39 cmH₂O, plateau is 35 cmH₂O, PEEP is 8 cmH₂O, and SpO₂ is 91%. What ventilator change best reduces ventilator-induced lung injury risk?',

          passiveDeterior : {
            rate    : 0.0015,
            vit     : { spo2:88 },
            patient : { compliance:22 },
          },

          choices : [
            {
              text      : 'A. Increase tidal volume to improve oxygenation',
              isCorrect : false,
              feedback  : 'Incorrect. Larger tidal volumes increase plateau pressure and driving pressure, the two strongest predictors of ventilator-induced lung injury in ARDS. SpO₂ may transiently rise, but alveolar overdistension accelerates lung damage.',
              effects   : { patient:{ compliance:20 }, vit:{ spo2:1, etco2Display:-2 }, vent:{ tv:600 }, overlaySpeed:0.016 },
            },
            {
              text      : 'B. Reduce tidal volume toward 6 mL/kg IBW and reassess plateau pressure',
              isCorrect : true,
              feedback  : 'Correct. The narrow peak-to-plateau gap with high plateau pressure indicates poor compliance, not airway resistance. Reducing tidal volume lowers both plateau pressure and driving pressure — even if EtCO₂ rises modestly. Permissive hypercapnia is acceptable if pH remains above ~7.20.',
              effects   : { patient:{ compliance:25 }, vit:{ spo2:-1, etco2Display:5 }, vent:{ tv:360 }, overlaySpeed:0.034 },
            },
            {
              text      : 'C. Give albuterol for the elevated peak pressure',
              isCorrect : false,
              feedback  : 'Incorrect. Bronchodilators target airway resistance. Here the peak-to-plateau gap is narrow and plateau pressure is high — the problem is reduced compliance, not bronchospasm. Albuterol will not improve plateau pressure or protect against VILI.',
              effects   : { patient:{ resistance:8 }, vit:{ spo2:0 }, vent:{}, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Increase respiratory rate to normalize EtCO₂ before changing tidal volume',
              isCorrect : false,
              feedback  : 'Incorrect. EtCO₂ is not the immediate priority — reducing alveolar stress is. Increasing rate increases minute ventilation but does not reduce plateau or driving pressure. More breaths at the same volume can also worsen cumulative lung stress.',
              effects   : { patient:{}, vit:{ etco2Display:-2, spo2:0 }, vent:{ rr:24 }, overlaySpeed:0.018 },
            },
          ],
        },

        /* ── Step 2 ── */
        {
          phase : 'Intervention',
          clue  : 'Key clue: After tidal volume reduction, peak pressure is 31 cmH₂O and plateau is 27 cmH₂O. PEEP remains 8 cmH₂O — driving pressure is now 19 cmH₂O. EtCO₂ has risen to 44 mmHg and SpO₂ is 89% on FiO₂ 70%. BP is 108/62. The capnogram is rectangular.',
          question : 'Driving pressure has improved, but oxygenation remains marginal at SpO₂ 89%. What is the best next step?',

          passiveDeterior : {
            rate    : 0.0015,
            vit     : { spo2:87 },
            patient : {},
          },

          choices : [
            {
              text      : 'A. Return to the original tidal volume because SpO₂ is lower',
              isCorrect : false,
              feedback  : 'Incorrect. Returning to the higher tidal volume may raise SpO₂ slightly but reintroduces excessive plateau and driving pressures. In ARDS physiology, oxygenation must not be improved at the cost of alveolar overdistension.',
              effects   : { patient:{ compliance:20 }, vit:{ spo2:2, etco2Display:-4 }, vent:{ tv:520 }, overlaySpeed:0.016 },
            },
            {
              text      : 'B. Increase PEEP cautiously while monitoring plateau pressure, driving pressure, oxygenation, and blood pressure',
              isCorrect : true,
              feedback  : 'Correct. Once tidal volume is lung-protective, oxygenation can be supported by careful PEEP titration to recruit unstable alveoli. The goal is recruitment without driving pressure > 15 cmH₂O or hemodynamic compromise. As oxygenation improves, FiO₂ can be weaned.',
              effects   : { patient:{ compliance:30, cardiacOutput:0.86 }, vit:{ spo2:4, sysBP:-4, etco2Display:-1 }, vent:{ peep:12, fio2:60 }, overlaySpeed:0.030 },
            },
            {
              text      : 'C. Hyperventilate aggressively to get EtCO₂ below 35 mmHg',
              isCorrect : false,
              feedback  : 'Incorrect. A modest EtCO₂ rise after tidal volume reduction is expected and acceptable. Chasing a normal EtCO₂ leads to higher minute ventilation, cumulative lung stress, and loss of the lung-protective strategy.',
              effects   : { patient:{ compliance:22 }, vit:{ etco2Display:-5, spo2:0 }, vent:{ rr:26 }, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Lower PEEP to reduce mean airway pressure',
              isCorrect : false,
              feedback  : 'Incorrect. Reducing PEEP can derecruit unstable, fluid-filled alveoli and worsen oxygenation in ARDS. Mean airway pressure reduction must always be balanced against the risk of losing alveolar recruitment.',
              effects   : { patient:{ compliance:20 }, vit:{ spo2:-4, etco2Display:2 }, vent:{ peep:4 }, overlaySpeed:0.016 },
            },
          ],
        },
      ],

      resolution : 'In restrictive lung disease, plateau pressure and driving pressure (Pplat − PEEP) matter more than peak pressure alone. The lung-protective sequence: reduce tidal volume first to bring driving pressure below 15 cmH₂O, then titrate PEEP and FiO₂ while watching oxygenation and hemodynamics.',
    },

    /* ── 9. PEEP vs Preload — Hemodynamic Consequences ─────────────────── */
    {
      id        : 'peep_preload_balance',
      title     : 'PEEP And Preload',
      badge     : 'Hemodynamics',
      badgeColor: '#ff6060',
      summary   : 'Oxygenation improves after a recruitment maneuver and PEEP increase, but the arterial line and capnogram suggest the price may be reduced venous return. Better SpO₂ does not always mean better physiology.',

      initialPatient : { compliance:34, resistance:8, co2Prod:170, leak:0, cardiacOutput:0.72 },
      initialVitals  : { hr:98, sysBP:88, diaBP:50, spo2:97, bis:46, etco2Display:27 },
      initialVent    : { tv:480, rr:12, peep:14, fio2:60, ti:1.0 },

      steps : [
        /* ── Step 1 ── */
        {
          phase : 'Deterioration',
          clue  : 'Key clue: After recruitment and PEEP increase to 14 cmH₂O, SpO₂ improves from 91% to 97%. Peak pressure is 34 cmH₂O and plateau is 29 cmH₂O. But EtCO₂ has gradually fallen from 36 to 27 mmHg and the arterial line has drifted from 118/68 to 88/50. The capnogram shape remains rectangular.',
          question : 'SpO₂ has improved to 97%, but BP is 88/50 and EtCO₂ has gradually fallen to 27 mmHg after PEEP was increased to 14 cmH₂O. What is the best next step?',

          passiveDeterior : {
            rate    : 0.002,
            vit     : { sysBP:68, etco2Display:20 },
            patient : { cardiacOutput:0.58 },
          },

          choices : [
            {
              text      : 'A. Increase PEEP further — oxygenation improved so more PEEP will help more',
              isCorrect : false,
              feedback  : 'Incorrect. The SpO₂ response shows recruitment, but the falling EtCO₂ and blood pressure are signs of reduced pulmonary blood flow and cardiac output. Additional PEEP will further impair venous return and worsen hemodynamics.',
              effects   : { patient:{ cardiacOutput:0.58, compliance:36 }, vit:{ sysBP:-14, spo2:1, etco2Display:-5 }, vent:{ peep:18 }, overlaySpeed:0.015 },
            },
            {
              text      : 'B. Reduce PEEP to the lowest level that preserves oxygenation, and support preload and vascular tone',
              isCorrect : true,
              feedback  : 'Correct. The gradual EtCO₂ drop with hypotension after higher PEEP is the hemodynamic signature of reduced venous return and cardiac output. Backing down to an individualized PEEP while giving fluid or vasopressor support should restore blood pressure and EtCO₂ while maintaining acceptable oxygenation.',
              effects   : { patient:{ cardiacOutput:0.90, compliance:32 }, vit:{ sysBP:24, etco2Display:8, spo2:-2 }, vent:{ peep:9 }, overlaySpeed:0.032 },
            },
            {
              text      : 'C. Increase respiratory rate — EtCO₂ is low and needs to be treated',
              isCorrect : false,
              feedback  : 'Incorrect. The low EtCO₂ here reflects reduced CO₂ delivery to the lungs from falling cardiac output — not hypoventilation. Increasing rate may lower EtCO₂ further without fixing venous return, and adds minute ventilation stress.',
              effects   : { patient:{ cardiacOutput:0.68 }, vit:{ sysBP:-6, etco2Display:-4 }, vent:{ rr:16 }, overlaySpeed:0.018 },
            },
            {
              text      : 'D. Deepen volatile anesthetic — hypotension and tachycardia suggest the patient is light',
              isCorrect : false,
              feedback  : 'Incorrect. BIS is in the appropriate anesthetic range. The hemodynamic changes are from increased intrathoracic pressure impairing venous return, not from inadequate anesthetic depth. Additional volatile agents will worsen vasodilation and hypotension.',
              effects   : { patient:{ cardiacOutput:0.62 }, vit:{ sysBP:-12, etco2Display:-3 }, vent:{}, overlaySpeed:0.016 },
            },
          ],
        },

        /* ── Step 2 ── */
        {
          phase : 'Resolution',
          clue  : 'Key clue: After PEEP is reduced to 9 cmH₂O and blood pressure is supported, SpO₂ is 95%, EtCO₂ rises to 34 mmHg, and BP is 112/64. Peak pressure is 28 cmH₂O and plateau is 23 cmH₂O. The capnogram remains rectangular.',
          question : 'Oxygenation is slightly lower but acceptable, while EtCO₂ and blood pressure have normalized. What is the best ongoing ventilator strategy?',

          passiveDeterior : {
            rate    : 0.001,
            vit     : { spo2:94 },
            patient : {},
          },

          choices : [
            {
              text      : 'A. Keep this individualized PEEP level, monitor driving pressure and hemodynamics, and titrate FiO₂ down as tolerated',
              isCorrect : true,
              feedback  : 'Correct. The best PEEP is not the one that maximizes SpO₂ — it is the one that balances alveolar recruitment, driving pressure, oxygenation, and cardiac output together. Titrating FiO₂ down while monitoring all four parameters is the lung-protective and hemodynamically sound approach.',
              effects   : { patient:{ cardiacOutput:0.94 }, vit:{ sysBP:4, spo2:1, etco2Display:0 }, vent:{ fio2:50 }, overlaySpeed:0.030 },
            },
            {
              text      : 'B. Return to PEEP 14 because the previous SpO₂ was higher',
              isCorrect : false,
              feedback  : 'Incorrect. Higher PEEP did improve SpO₂, but it did so at the cost of cardiac output. Optimizing one monitor while another deteriorates is not a complete physiological picture.',
              effects   : { patient:{ cardiacOutput:0.68 }, vit:{ sysBP:-12, spo2:1, etco2Display:-5 }, vent:{ peep:14 }, overlaySpeed:0.016 },
            },
            {
              text      : 'C. Reduce PEEP to 0 — blood pressure improved when PEEP was lowered so lower is always better',
              isCorrect : false,
              feedback  : 'Incorrect. The prior PEEP was excessive for this patient, not all PEEP. Removing PEEP entirely will derecruit unstable alveoli and worsen oxygenation — the improvement from backing off PEEP does not mean PEEP is globally harmful.',
              effects   : { patient:{ compliance:26 }, vit:{ spo2:-5, etco2Display:1 }, vent:{ peep:0 }, overlaySpeed:0.016 },
            },
            {
              text      : 'D. Increase tidal volume to improve both oxygenation and blood pressure simultaneously',
              isCorrect : false,
              feedback  : 'Incorrect. Larger tidal volumes increase airway pressure against still-compromised compliance and do not reliably improve venous return. The current balance of oxygenation, driving pressure, and perfusion is safer than trading higher volumes for marginal SpO₂ gains.',
              effects   : { patient:{ compliance:30, cardiacOutput:0.86 }, vit:{ sysBP:-4, spo2:1 }, vent:{ tv:560 }, overlaySpeed:0.018 },
            },
          ],
        },
      ],

      resolution : 'PEEP can improve oxygenation while simultaneously worsening cardiac output. The monitor pattern that reveals this: gradual EtCO₂ drop plus hypotension after a PEEP increase, with a rectangular (normal) capnogram. Optimize PEEP for the whole patient — SpO₂, EtCO₂, blood pressure, and driving pressure together.',
    },
  ];

  /* ─────────────────────────────────────────────────────────────────────────
     SCENARIO ENGINE
     ───────────────────────────────────────────────────────────────────────── */

  // Saved pre-scenario state for reset
  let savedPatient = null;
  let savedVitals  = null;
  let savedVent    = null;

  const scenState = {
    active        : false,
    scenario      : null,
    stepIdx       : 0,
    answered      : false,
    stepStartTime : 0,   // simTime when step began (used by passive deterioration)
  };

  function saveBaseline() {
    savedPatient = Object.assign({}, patientState);
    savedVitals  = Object.assign({}, vitals, { nibp: Object.assign({}, vitals.nibp) });
    savedVent    = Object.assign({}, ventSettings);
  }

  function restoreBaseline() {
    if (!savedPatient) return;
    Object.assign(patientState, savedPatient);
    Object.assign(vitals, savedVitals);
    vitals.nibp = Object.assign({}, savedVitals.nibp);
    Object.assign(ventSettings, savedVent);
    overlay.active  = false;
    overlay.patient = {};
    overlay.vit     = {};
    overlay.speed   = 0.018;
    syncSlidersToSettings();
  }

  function syncSlidersToSettings() {
    function syncSlider(id, val) {
      const el = $(id);
      if (el) { el.value = val; el.dispatchEvent(new Event('input')); }
    }
    syncSlider('sl-tv',   ventSettings.tv);
    syncSlider('sl-rr',   ventSettings.rr);
    syncSlider('sl-peep', ventSettings.peep);
    syncSlider('sl-fio2', ventSettings.fio2);
    syncSlider('sl-ti',   ventSettings.ti);
    syncSlider('sl-pip',  ventSettings.pip);
    syncSlider('sl-compliance', patientState.compliance);
    syncSlider('sl-resistance', patientState.resistance);
    syncSlider('sl-co2prod',    patientState.co2Prod);
    syncSlider('sl-leak',       Math.round(patientState.leak * 100));
    // Sync mode toggle buttons
    const btnVC  = $('btn-vc');
    const btnPC  = $('btn-pc');
    const vcOnly = $('vc-only');
    const pcOnly = $('pc-only');
    if (ventSettings.mode === 'VC') {
      if (btnVC)  btnVC.classList.add('mode-btn--on');
      if (btnPC)  btnPC.classList.remove('mode-btn--on');
      if (vcOnly) vcOnly.hidden = false;
      if (pcOnly) pcOnly.hidden = true;
    } else {
      if (btnPC)  btnPC.classList.add('mode-btn--on');
      if (btnVC)  btnVC.classList.remove('mode-btn--on');
      if (vcOnly) vcOnly.hidden = true;
      if (pcOnly) pcOnly.hidden = false;
    }
  }

  function applyEffects(effects) {
    // Set overlay interpolation speed (fast for epi/vasopressor, slow for fluids/bronchodilators)
    overlay.speed = (effects.overlaySpeed !== undefined) ? effects.overlaySpeed : 0.018;

    // Patient state: absolute targets (lerped toward by overlay)
    if (effects.patient) {
      for (const k in effects.patient) {
        overlay.patient[k] = effects.patient[k];
      }
    }
    // Vital signs: relative DELTAS — target = current + delta
    if (effects.vit) {
      for (const k in effects.vit) {
        overlay.vit[k] = vitals[k] + effects.vit[k];
      }
    }
    // Vent settings: applied immediately and synced to UI
    if (effects.vent) {
      Object.assign(ventSettings, effects.vent);
      syncSlidersToSettings();
    }
    overlay.active = true;
  }

  async function startScenario(scenario) {
    saveBaseline();
    scenState.active        = true;
    scenState.scenario      = scenario;
    scenState.stepIdx       = 0;
    scenState.answered      = false;
    scenState.stepStartTime = simTime;
    scenState.stepHistory   = [];   // [{question, choice_text, is_correct, domain}]

    // Track start in DB if this is a DB-generated scenario
    if (scenario._dbId && window.supabase) {
      try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
          // Fire and forget update to case_assignments
          window.supabase.from('case_assignments')
            .update({ status: 'started', started_at: new Date().toISOString() })
            .eq('scenario_id', scenario._dbId)
            .eq('assigned_to', session.user.id)
            .then();
        }
      } catch(e) {}
    }

    // Expose for debrief-ui.js
    Object.defineProperty(window, '_scenStepHistory', { get: () => scenState.stepHistory ?? [], configurable: true });
    Object.defineProperty(window, '_activeScenTitle',  { get: () => scenState.scenario?.title ?? '', configurable: true });
    Object.defineProperty(window, '_activeScenDbId',   { get: () => scenState.scenario?._dbId, configurable: true });

    Object.assign(patientState, scenario.initialPatient);
    Object.assign(vitals, scenario.initialVitals);
    // Immediately sync derived display values so monitors update on next tick
    if (scenario.initialVitals.sysBP !== undefined) {
      vitals.nibp.sys = scenario.initialVitals.sysBP;
      vitals.nibp.dia = scenario.initialVitals.diaBP || vitals.diaBP;
      vitals.nibp.map = Math.round((vitals.nibp.sys + 2 * vitals.nibp.dia) / 3);
    }
    if (scenario.initialVitals.bis !== undefined) {
      vitals.bisSmoothed = scenario.initialVitals.bis;
    }
    Object.assign(ventSettings, scenario.initialVent);
    overlay.active = false; overlay.patient = {}; overlay.vit = {};
    overlay.speed  = 0.018;

    syncSlidersToSettings();
    renderScenActiveView();
    renderScenStep();
  }

  function handleChoice(idx) {
    if (scenState.answered) return;
    scenState.answered = true;
    const step   = scenState.scenario.steps[scenState.stepIdx];
    const choice = step.choices[idx];
    applyEffects(choice.effects);
    renderScenFeedback(step, idx, choice);
  }

  function nextScenStep() {
    scenState.stepIdx++;
    scenState.answered      = false;
    scenState.stepStartTime = simTime;
    if (scenState.stepIdx >= scenState.scenario.steps.length) {
      renderScenResolution();
    } else {
      renderScenStep();
    }
  }

  function endScenario() {
    scenState.active   = false;
    scenState.scenario = null;
    restoreBaseline();
    renderScenSelectView();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     SCENARIO UI RENDERING
     ───────────────────────────────────────────────────────────────────────── */

  function renderScenSelectView() {
    const sel    = $('scen-select');
    const active = $('scen-active');
    const resol  = $('scen-resolution');
    if (sel)    sel.hidden    = false;
    if (active) active.hidden = true;
    if (resol)  resol.hidden  = true;

    const container  = $('scen-cards');
    const filterRow  = $('scen-filter-row');
    if (!container) return;

    // Fetch DB scenarios and merge with hardcoded ones
    // We only fetch if supabase is available, otherwise fallback to hardcoded
    let mergedScenarios = [...SCENARIOS];
    
    // We fetch scenarios where status='approved' AND visibility='public'
    // (If the student was logged in, we'd also fetch their assigned private cases here)
    if (window.supabase) {
      try {
        const { data, error } = await window.supabase
          .from('generated_scenarios')
          .select('id, scenario_json, author_label, visibility')
          .eq('status', 'approved')
          .eq('visibility', 'public')
          .order('published_at', { ascending: false });
          
        if (!error && data) {
          data.forEach(dbScen => {
            const parsed = dbScen.scenario_json;
            if (parsed) {
              parsed._dbId = dbScen.id; // Tag it so we know it came from DB
              parsed._author = dbScen.author_label || 'Instructor';
              parsed._visibility = dbScen.visibility;
              mergedScenarios.push(parsed);
            }
          });
        } else if (error) {
          console.error("Error fetching scenarios:", error);
        }
      } catch (err) {
        console.error("Failed to load DB scenarios:", err);
      }
    }

    // ── Category filter chips ──────────────────────────────────────────────
    const CATEGORY_ICONS = {
      'Emergency'   : '🚨',
      'Hemodynamics': '🫀',
      'Airway'      : '🫁',
      'Respiratory' : '🌬',
    };

    if (filterRow) {
      const categories = ['All', ...new Set(mergedScenarios.map(s => s.badge).filter(Boolean))];
      filterRow.innerHTML = categories.map(cat => {
        const icon = cat === 'All' ? '⭐' : (CATEGORY_ICONS[cat] || '📋');
        return `<button class="scen-filter-chip${cat === 'All' ? ' scen-filter-chip--active' : ''}"
                        data-filter="${cat === 'All' ? 'all' : cat}" type="button">
                  <span class="scen-filter-chip__icon">${icon}</span>${cat}
                </button>`;
      }).join('');

      filterRow.querySelectorAll('.scen-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          filterRow.querySelectorAll('.scen-filter-chip').forEach(c => c.classList.remove('scen-filter-chip--active'));
          chip.classList.add('scen-filter-chip--active');
          const filter = chip.dataset.filter;
          container.querySelectorAll('.scen-card').forEach(card => {
            const show = filter === 'all' || card.dataset.category === filter;
            card.style.display = show ? '' : 'none';
          });
        });
      });
    }

    // ── Scenario cards ─────────────────────────────────────────────────────
    container.innerHTML = mergedScenarios.map((s, i) => {
      const authorHtml = s._dbId ? `<div class="scen-card__author">By ${s._author || 'Instructor'}</div>` : '';
      return `<button class="scen-card" type="button" data-scen-idx="${i}" data-scen-id="${s.id || ''}" data-category="${s.badge}">
         <span class="scen-card__badge" style="background:${(BADGE_COLORS[s.badge]||_defaultBadgeColor).bg};color:${(BADGE_COLORS[s.badge]||_defaultBadgeColor).fg};border:1px solid ${(BADGE_COLORS[s.badge]||_defaultBadgeColor).border}">
           ${CATEGORY_ICONS[s.badge] || ''} ${s.badge}
         </span>
         <div class="scen-card__title">${s.title}</div>
         ${authorHtml}
         <div class="scen-card__summary">${s.summary}</div>
         <div class="scen-card__cta">▶ Start scenario →</div>
       </button>`;
    }).join('');

    container.querySelectorAll('.scen-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.scenIdx, 10);
        startScenario(mergedScenarios[idx]);
      });
    });
  }

  function renderScenActiveView() {
    const sel    = $('scen-select');
    const active = $('scen-active');
    const resol  = $('scen-resolution');
    if (sel)    sel.hidden    = true;
    if (active) active.hidden = false;
    if (resol)  resol.hidden  = true;

    const s = scenState.scenario;
    const badge = $('scen-badge');
    const title = $('scen-title');
    if (badge) {
      const _bc = (BADGE_COLORS && BADGE_COLORS[s.badge]) || { fg:'#475569', bg:'rgba(71,85,105,0.10)', border:'rgba(71,85,105,0.28)' };
      badge.textContent      = s.badge;
      badge.style.background = _bc.bg;
      badge.style.color      = _bc.fg;
      badge.style.border     = `1px solid ${_bc.border}`;
    }
    if (title) title.textContent = s.title;

    const ctxEl = $('scen-context');
    if (ctxEl) ctxEl.innerHTML = `<strong>Clinical Context</strong><br>${s.summary}`;
  }

  function setPhase(phaseText) {
    const el = $('scen-phase');
    if (!el) return;
    el.textContent = phaseText || '';
    const key = (phaseText || '').toLowerCase().replace(/\s+/g, '-');
    el.className = 'scen-phase scen-phase--' + key;
  }

  function openLinkedVentWavePreset(preset, objective) {
    const clean = (preset || '').trim();
    if (!clean) return;
    // Call the wave tutorial's exposed function directly (avoids event dispatch timing issues)
    if (typeof window.openVentWavePreset === 'function') {
      window.openVentWavePreset(clean);
    } else {
      // Fallback: event dispatch
      document.dispatchEvent(new CustomEvent('ventwave_focus_preset', {
        detail: { preset: clean, objective: objective || '', source: 'scenario' },
      }));
    }
  }

  function renderScenStep() {
    const s    = scenState.scenario;
    const step = s.steps[scenState.stepIdx];

    const stepLabel = $('scen-step');
    if (stepLabel) stepLabel.textContent = `Step ${scenState.stepIdx + 1} of ${s.steps.length}`;

    // Update phase badge
    setPhase(step.phase || 'Active');

    // Update monitor clue box
    const clueBox     = $('scen-monitor-clue');
    const clueContent = $('scen-clue-content');
    const clueText    = $('scen-clue-text');
    const toggleBtn   = $('scen-clue-toggle');

    // Clear any AI coaching from the previous step
    const aiCoachCol = document.getElementById('scen-ai-coach-col');
    if (aiCoachCol) aiCoachCol.innerHTML = '';

    // Collapse the clue content on each new step
    if (clueContent) clueContent.hidden = true;
    if (toggleBtn) {
      const arrow = toggleBtn.querySelector('.scen-clue-toggle__arrow');
      if (arrow) arrow.textContent = '▾';
      toggleBtn.onclick = () => {
        if (!clueContent) return;
        clueContent.hidden = !clueContent.hidden;
        if (arrow) arrow.textContent = clueContent.hidden ? '▾' : '▴';
      };
    }

    if (clueText && step.clue) {
      // Format clue as bullet list for readability
      const clueRaw = step.clue;
      if (clueRaw.startsWith('Key clue:')) {
        const body = clueRaw.replace(/^Key clue:\s*/, '');
        const sentences = body.split(/\.\s+/).filter(Boolean).map((s, i, arr) =>
          i < arr.length - 1 ? s.trim() + '.' : s.trim()
        );
        clueText.innerHTML =
          '<ul class="scen-clue-list">' +
          sentences.map(s => `<li>${escHtml(s)}</li>`).join('') +
          '</ul>';
      } else {
        clueText.textContent = clueRaw;
      }
      if (clueBox) clueBox.hidden = false;
    } else if (clueBox) {
      clueBox.hidden = true;
    }

    const qa = $('scen-qa');
    if (!qa) return;
    qa.innerHTML =
      `<div class="scen-question">${step.question}</div>` +
      `<div class="scen-choices">` +
        step.choices.map((c, i) =>
          `<button class="scen-choice" type="button" data-choice-idx="${i}">${c.text}</button>`
        ).join('') +
      `</div>`;

    qa.querySelectorAll('.scen-choice').forEach(btn => {
      btn.addEventListener('click', () => handleChoice(parseInt(btn.dataset.choiceIdx, 10)));
    });
  }

  async function renderScenFeedback(step, selectedIdx, choice) {
    const qa = $('scen-qa');
    if (!qa) return;

    // Track step history for AI coaching context
    if (!scenState.stepHistory) scenState.stepHistory = [];
    scenState.stepHistory.push({
      question:    step.question,
      choice_text: choice.text,
      is_correct:  choice.isCorrect,
      domain:      step.phase || 'general',
    });

    // Update phase badge based on correctness
    setPhase(choice.isCorrect ? 'Intervention' : 'Deterioration');

    // Style all buttons: correct=green, selected-wrong=red, rest=dim
    qa.querySelectorAll('.scen-choice').forEach((btn, i) => {
      btn.disabled = true;
      const c = step.choices[i];
      if (c.isCorrect)            btn.classList.add('scen-choice--correct');
      else if (i === selectedIdx) btn.classList.add('scen-choice--wrong');
    });

    // Append hardcoded feedback card (unchanged)
    const fbDiv = document.createElement('div');
    fbDiv.className = `scen-feedback scen-feedback--${choice.isCorrect ? 'correct' : 'wrong'}`;
    fbDiv.innerHTML = (choice.isCorrect ? '✓ ' : '✗ ') + choice.feedback;
    qa.appendChild(fbDiv);

    // AI coaching — only if opted in AND signed in
    const aiEnabled = document.getElementById('scen-ai-coaching-opt')?.checked ?? false;
    if (window.ScenarioCoach && aiEnabled) {
      const aiCoachColFb = document.getElementById('scen-ai-coach-col');
      const _insertCoach = (el) => {
        if (aiCoachColFb) aiCoachColFb.appendChild(el);
        else qa.appendChild(el);
      };

      // Check auth first; AI is a signed-in-only feature
      const _user = window.SB ? (await window.SB.getUser().catch(() => null)) : null;
      if (!_user) {
        const signinDiv = document.createElement('div');
        signinDiv.className = 'scen-ai-coaching scen-ai-coaching--signin';
        signinDiv.innerHTML =
          '<span class="scen-ai-coaching__label">AI Coaching</span>' +
          '<p class="scen-ai-coaching__text">' +
          '<a href="../platform/auth.html" class="scen-ai-signin-link">Create a free account to unlock AI coaching →</a>' +
          '</p>';
        _insertCoach(signinDiv);
      } else {
        const coachDiv = document.createElement('div');
        coachDiv.className = 'scen-ai-coaching scen-ai-coaching--loading';
        coachDiv.innerHTML = '<span class="scen-ai-coaching__label">AI Coaching</span><span class="scen-ai-coaching__spinner"></span>';
        _insertCoach(coachDiv);

        const priorHistory = scenState.stepHistory.slice(0, -1).map(h => ({
          question: h.question, correct: h.is_correct,
        }));
        window.ScenarioCoach.requestStepCoaching({
          scenarioTitle:      scenState.scenario.title,
          patientContext:     scenState.scenario.patientContext ?? '',
          stepClue:           step.clue ?? '',
          question:           step.question,
          choiceText:         choice.text,
          isCorrect:          choice.isCorrect,
          hardcodedFeedback:  choice.feedback,
          stepHistory:        priorHistory,
        }).then(coaching => {
          if (coaching) {
            coachDiv.className = 'scen-ai-coaching';
            coachDiv.innerHTML =
              '<span class="scen-ai-coaching__label">AI Coaching</span>' +
              `<p class="scen-ai-coaching__text">${escHtml(coaching)}</p>`;
          } else {
            coachDiv.remove();
          }
        });
      }
    }

    const isLast = scenState.stepIdx >= scenState.scenario.steps.length - 1;
    const nextBtn = document.createElement('button');
    nextBtn.type        = 'button';
    nextBtn.className   = 'scen-next-btn';
    nextBtn.textContent = isLast ? 'See Resolution →' : 'Next Question →';
    nextBtn.addEventListener('click', nextScenStep);
    qa.appendChild(nextBtn);
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  async function renderScenResolution() {
    const sel    = $('scen-select');
    const active = $('scen-active');
    const resol  = $('scen-resolution');
    if (sel)    sel.hidden    = true;
    if (active) active.hidden = true;
    if (resol)  resol.hidden  = false;

    const s = scenState.scenario;
    
    // Track completion in DB if this is a DB-generated scenario
    if (s._dbId && window.supabase) {
      try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
          // Fire and forget update to case_assignments
          window.supabase.from('case_assignments')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('scenario_id', s._dbId)
            .eq('assigned_to', session.user.id)
            .then();
        }
      } catch(e) {}
    }
    const titleEl = $('scen-resolution-title');
    const textEl  = $('scen-resolution-text');
    if (titleEl) titleEl.textContent = s.title + ' — Complete';
    if (textEl)  textEl.textContent  = s.resolution;

    const restartBtn = $('scen-restart-btn');
    if (restartBtn) {
      restartBtn.onclick = () => {
        endScenario();
      };
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CONTROLS INIT
     ───────────────────────────────────────────────────────────────────────── */
  function initControls() {
    function wire(slId, lblId, target, key, transform, suffix='') {
      const sl  = $(slId);
      const lbl = $(lblId);
      if (!sl) return;
      sl.addEventListener('input', () => {
        const raw = parseFloat(sl.value);
        target[key] = transform ? transform(raw) : raw;
        if (lbl) lbl.textContent = sl.value + suffix;
      });
    }

    wire('sl-tv',         'lbl-tv',         ventSettings, 'tv',   null);
    wire('sl-pip',        'lbl-pip',        ventSettings, 'pip',  null);
    wire('sl-rr',         'lbl-rr',         ventSettings, 'rr',   null);
    wire('sl-peep',       'lbl-peep',       ventSettings, 'peep', null);
    wire('sl-fio2',       'lbl-fio2',       ventSettings, 'fio2', null);
    wire('sl-ti',         'lbl-ti',         ventSettings, 'ti',   v => parseFloat(v.toFixed(1)));
    wire('sl-compliance', 'lbl-compliance', patientState, 'compliance', null);
    wire('sl-resistance', 'lbl-resistance', patientState, 'resistance', null);
    wire('sl-co2prod',    'lbl-co2prod',    patientState, 'co2Prod',    null);
    wire('sl-leak',       'lbl-leak',       patientState, 'leak',       v => v/100, '%');

    const btnVC  = $('btn-vc');
    const btnPC  = $('btn-pc');
    const vcOnly = $('vc-only');
    const pcOnly = $('pc-only');

    if (btnVC) btnVC.addEventListener('click', () => {
      ventSettings.mode = 'VC';
      btnVC.classList.add('mode-btn--on');
      if (btnPC) btnPC.classList.remove('mode-btn--on');
      if (vcOnly) vcOnly.hidden = false;
      if (pcOnly) pcOnly.hidden = true;
    });
    if (btnPC) btnPC.addEventListener('click', () => {
      ventSettings.mode = 'PC';
      btnPC.classList.add('mode-btn--on');
      if (btnVC) btnVC.classList.remove('mode-btn--on');
      if (vcOnly) vcOnly.hidden = true;
      if (pcOnly) pcOnly.hidden = false;
    });

    // Scenario panel
    const openBtn  = $('scenario-open-btn');
    const panel    = $('scenario-panel');
    const closeBtn = $('scen-panel-close-btn');
    const exitBtn  = $('scen-exit-btn');

    const _openScenPanel = () => {
      if (!panel) return;
      panel.hidden = false;
      if (!scenState.active) renderScenSelectView();
      openBtn.textContent = '▼ Hide Scenarios';
      document.body.classList.add('scenario-panel-open');
    };
    const _closeScenPanel = () => {
      if (panel) panel.hidden = true;
      if (openBtn) openBtn.textContent = '▶ Clinical Scenarios — Test Your Knowledge';
      document.body.classList.remove('scenario-panel-open');
    };

    if (openBtn) openBtn.addEventListener('click', () => {
      if (!panel) return;
      panel.hidden ? _openScenPanel() : _closeScenPanel();
    });
    if (closeBtn) closeBtn.addEventListener('click', _closeScenPanel);
    if (exitBtn) exitBtn.addEventListener('click', endScenario);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     ANIMATION LOOP
     ───────────────────────────────────────────────────────────────────────── */
  let lastTs  = null;
  let simTime = 0;

  function tick(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs  = ts;
    simTime += dt;

    const d = calcDerived();
    applyDrift(simTime, d);

    // Advance waveform buffers
    if (wfs.ecg)      wfs.ecg.push(genECG, simTime, dt);
    if (wfs.abp)      wfs.abp.push(genABP, simTime, dt);
    if (wfs.spo2)     wfs.spo2.push(genSpO2, simTime, dt);
    if (wfs.etco2)    wfs.etco2.push(t => genETCO2(t, d), simTime, dt);
    if (wfs.pressure) wfs.pressure.push(t => genPressure(t, d), simTime, dt);
    if (wfs.flow)     wfs.flow.push(t => genFlow(t, d), simTime, dt);
    if (wfs.volume)   wfs.volume.push(t => genVolume(t, d), simTime, dt);
    if (wfs.eeg)      wfs.eeg.push(genEEG, simTime, dt);

    // Accumulate P-V loop
    pvPushPoint(simTime, d);

    // Draw all
    Object.values(wfs).forEach(w => w.draw());
    if (spectralCanvas) drawSpectral(spectralCanvas, simTime);
    drawPVLoop();

    updateNumerics(d, simTime);
    checkAlarms(d);

    requestAnimationFrame(tick);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     AI CHAT
     ───────────────────────────────────────────────────────────────────────── */
  function initVentChat() {
    var AUTH_URL =
      location.pathname.indexOf('/ventilator') >= 0 ? '../platform/auth.html' : 'platform/auth.html';

    var panel      = document.getElementById('chat-panel');
    var messagesEl = document.getElementById('chat-messages');
    var inputEl    = document.getElementById('chat-input');
    var sendBtn    = document.getElementById('chat-send');
    var closeBtn   = document.getElementById('chat-close');
    var keyBtn     = document.getElementById('chat-key-btn');
    var aiBtn      = document.getElementById('vent-ai-btn');

    if (!panel) return;

    var history = [];
    var busy    = false;

    function openPanel() {
      panel.setAttribute('aria-hidden', 'false');
      if (aiBtn) { aiBtn.setAttribute('aria-expanded', 'true'); aiBtn.style.display = 'none'; }
      if (!window.SB || !window.SB.client) {
        appendMsg('system', 'Assistant unavailable (configuration).');
        setTimeout(function () { if (inputEl) inputEl.focus(); }, 80);
        return;
      }
      window.SB.client.auth.getSession().then(function (res) {
        if (!res.data.session) {
          showSignInCard();
        } else if (messagesEl.children.length === 0) {
          appendMsg('ai', 'As your attending (AI), ask me anything about ventilators, waveforms, or the clinical scenarios! (Up to 15 questions per day while signed in.)');
        }
        setTimeout(function () { if (inputEl) inputEl.focus(); }, 80);
      });
    }

    function closePanel() {
      panel.setAttribute('aria-hidden', 'true');
      if (aiBtn) { aiBtn.setAttribute('aria-expanded', 'false'); aiBtn.style.display = ''; }
    }

    if (aiBtn) aiBtn.addEventListener('click', function (e) { e.currentTarget.blur(); openPanel(); });
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (keyBtn) keyBtn.addEventListener('click', function () { showSignInCard(true); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.getAttribute('aria-hidden') === 'false') closePanel();
    });

    function appendMsg(role, text) {
      var div = document.createElement('div');
      div.className = 'chat-msg chat-msg--' + role;
      if (role === 'ai' && typeof marked !== 'undefined') {
        div.innerHTML = marked.parse(text, { breaks: true, gfm: true });
      } else {
        div.textContent = text;
      }
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    function showTyping() {
      var el = document.createElement('div');
      el.className = 'chat-typing';
      el.id = 'chat-typing-indicator';
      el.innerHTML = '<span></span><span></span><span></span>';
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    function hideTyping() {
      var el = document.getElementById('chat-typing-indicator');
      if (el) el.remove();
    }

    function showSignInCard(replacing) {
      var existing = document.getElementById('chat-signin-card');
      if (existing && !replacing) return;
      if (existing) existing.remove();
      var card = document.createElement('div');
      card.className = 'chat-apikey-card chat-signin-card';
      card.id = 'chat-signin-card';
      card.innerHTML =
        '<p><strong>Sign in</strong> to use the AI attending. Questions are logged for education quality (up to <strong>15 per day</strong>).</p>' +
        '<a class="chat-signin-card__link" href="' + AUTH_URL + '">Sign in or create account</a>';
      messagesEl.appendChild(card);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function sendMessage() {
      if (busy) return;
      var text = (inputEl && inputEl.value || '').trim();
      if (!text) return;
      if (!window.invokeAIChat || !window.SB) {
        appendMsg('system', '\u26A0 Assistant unavailable. Refresh the page or try again later.');
        return;
      }

      busy = true;
      if (sendBtn) sendBtn.disabled = true;

      window.SB.client.auth.getSession().then(function (res) {
        if (!res.data.session) {
          openPanel();
          return null;
        }

        inputEl.value = '';
        appendMsg('user', text);
        history.push({ role: 'user', content: text });
        showTyping();

        return window.invokeAIChat('ventilator', history);
      }).then(function (r) {
        if (r === null || r === undefined) return;
        hideTyping();
        if (!r.ok) {
          if (r.code === 'auth') {
            appendMsg('system', '\u26A0 Please sign in to use the assistant.');
            showSignInCard(true);
          } else if (r.code === 'rate_limit') {
            appendMsg('system', '\u26A0 ' + (r.message || 'Daily limit reached.'));
          } else {
            appendMsg('system', '\u26A0 ' + (r.message || 'Something went wrong.'));
          }
          return;
        }
        history.push({ role: 'assistant', content: r.reply });
        appendMsg('ai', r.reply);
      }).catch(function () {
        hideTyping();
        appendMsg('system', '\u26A0 Could not reach the assistant. Check your connection and try again.');
      }).finally(function () {
        busy = false;
        if (sendBtn) sendBtn.disabled = false;
        if (inputEl) inputEl.focus();
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (inputEl) inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     TRAIN-OF-FOUR TUTORIAL MONITOR
     ───────────────────────────────────────────────────────────────────────── */
  function initTOF() {

    /* ── Preset data ─────────────────────────────────────────────────────── */
    const TOF_PRESETS = [
      { id:'normal',   label:'Normal / No Block',   color:'#00e676',
        twitches:[1.0, 1.0, 1.0, 1.0] },
      { id:'mild',     label:'Mild Block',           color:'#80e080',
        twitches:[1.0, 0.9, 0.8, 0.7] },
      { id:'moderate', label:'Moderate Block',       color:'#ffcc00',
        twitches:[0.8, 0.5, 0.2, 0.0] },
      { id:'deep',     label:'Deep Block',           color:'#ff8040',
        twitches:[0.2, 0.0, 0.0, 0.0] },
      { id:'profound', label:'Profound Block',       color:'#ff4444',
        twitches:[0.0, 0.0, 0.0, 0.0] },
    ];

    const TOF_DRUG_SEQS = {
      rocuronium: {
        label: 'After Rocuronium',
        color: '#c878ff',
        steps: [
          { twitches:[1.0, 0.9, 0.8, 0.7],  note:'Onset: mild fade appearing as rocuronium distributes.' },
          { twitches:[0.8, 0.5, 0.2, 0.0],  note:'Deepening blockade — 3 twitches with pronounced fade.' },
          { twitches:[0.2, 0.0, 0.0, 0.0],  note:'Deep neuromuscular blockade. One twitch remaining.' },
          { twitches:[0.0, 0.0, 0.0, 0.0],  note:'Profound blockade established. Intubating conditions achieved.' },
        ],
      },
      sugammadex: {
        label: 'After Sugammadex',
        color: '#40d0ff',
        steps: [
          { twitches:[0.4, 0.2, 0.0, 0.0],  note:'Sugammadex encapsulating rocuronium — twitches beginning to return.' },
          { twitches:[0.8, 0.6, 0.35, 0.1], note:'Rapid recovery — four twitches present with residual fade.' },
          { twitches:[1.0, 0.96, 0.93, 0.88], note:'Near-complete recovery. TOF ratio approaching 0.9.' },
          { twitches:[1.0, 1.0, 1.0, 1.0],  note:'TOF ratio ≥ 0.9. Adequate neuromuscular recovery — safe for extubation.' },
        ],
      },
      neostigmine: {
        label: 'After Neostigmine',
        color: '#ffcc40',
        steps: [
          { twitches:[0.55, 0.3, 0.08, 0.0], note:'Neostigmine inhibiting acetylcholinesterase — slow, gradual improvement.' },
          { twitches:[0.85, 0.62, 0.38, 0.18], note:'Gradual recovery — four twitches visible, fade persists.' },
          { twitches:[1.0, 0.88, 0.78, 0.68], note:'Recovering — TOF ratio ~0.68. Still below 0.9; more time needed.' },
          { twitches:[1.0, 0.94, 0.88, 0.84], note:'Plateau reached. Ratio ~0.84 — marginal. Neostigmine cannot reverse profound block.' },
        ],
      },
    };

    const TOF_QUIZ = [
      {
        q: 'TOF count is 4/4 but ratio is 0.65. What does this mean?',
        choices: ['Full recovery', 'Residual blockade remains', 'Profound block', 'Monitoring error'],
        correct: 1,
        explanation: 'Seeing 4/4 twitches does not mean full recovery when significant fade is present. A ratio below 0.9 indicates residual paralysis, which can cause hypoventilation and aspiration risk post-extubation.',
      },
      {
        q: 'Only one twitch is visible. How is this best interpreted?',
        choices: ['Mild block', 'Adequate recovery', 'Deep block', 'No block'],
        correct: 2,
        explanation: 'A 1/4 count indicates deep neuromuscular blockade. Neostigmine reversal is unreliable here. Sugammadex (for rocuronium/vecuronium) or waiting for spontaneous recovery is preferred.',
      },
      {
        q: 'What TOF ratio threshold indicates adequate recovery for extubation?',
        choices: ['0.3 or above', '0.5 or above', '0.9 or above', 'Any 4/4 count'],
        correct: 2,
        explanation: 'A TOF ratio ≥ 0.9 is the standard threshold for adequate neuromuscular recovery. Values below 0.9 suggest residual paralysis even if all four twitches are present.',
      },
    ];

    /* ── Internal state ──────────────────────────────────────────────────── */
    let tofTwitches  = [1.0, 1.0, 1.0, 1.0];
    let tofNote      = '';
    let drugSeqTimer = null;
    let tofAnimId    = null;
    let tofModalOpen = false;
    let tofCycleTime = 0;
    let tofLastTs    = null;
    let quizIdx      = 0;

    const CYCLE_DUR = 2.6;
    const TWITCH_AT = [0.15, 0.65, 1.15, 1.65];
    const TWITCH_SIGMA = 0.07;
    const THRESHOLD = 0.15;

    function tofSpike(dt, amp) {
      if (Math.abs(dt) > TWITCH_SIGMA * 4) return 0;
      const n = dt / TWITCH_SIGMA;
      return amp * Math.exp(-n * n * 1.8);
    }

    function tofWaveAt(cycleT) {
      let v = 0;
      for (let i = 0; i < 4; i++) v += tofSpike(cycleT - TWITCH_AT[i], tofTwitches[i]);
      return v;
    }

    /* ── Derived values ──────────────────────────────────────────────────── */
    function tofCount() { return tofTwitches.filter(a => a >= THRESHOLD).length; }

    function tofRatio() {
      if (tofTwitches[0] < THRESHOLD || tofTwitches[3] < THRESHOLD) return null;
      return tofTwitches[3] / tofTwitches[0];
    }

    function tofDepthInfo(count, ratio) {
      if (count === 0) return { label:'Profound Block',    cls:'tof-depth--profound' };
      if (count === 1) return { label:'Deep Block',        cls:'tof-depth--deep'     };
      if (count <= 3)  return { label:'Moderate Block',    cls:'tof-depth--moderate' };
      if (ratio !== null && ratio >= 0.9) return { label:'Adequate Recovery', cls:'tof-depth--ok'   };
      if (ratio !== null) return { label:'Residual Block', cls:'tof-depth--mild' };
      return { label:'Recovering', cls:'tof-depth--mild' };
    }

    function buildInterp(count, ratio) {
      if (tofNote) return tofNote;
      if (count === 0) return 'No twitches visible. Profound neuromuscular blockade. Post-tetanic count (PTC) would be used clinically to estimate depth. Reversal is not appropriate at this stage.';
      if (count === 1) return 'One twitch present. Deep blockade. Neostigmine reversal is unreliable here — prefer sugammadex for aminosteroid agents, or wait for spontaneous recovery to ≥2 twitches.';
      if (count === 2) return 'Two twitches with fade. Moderate neuromuscular blockade. Spontaneous recovery is underway. Reversal response is unpredictable at this depth.';
      if (count === 3) return 'Three twitches with fade. Moderate-to-shallow block. Reversal with neostigmine is more reliable when 3–4 twitches are present.';
      if (ratio !== null && ratio >= 0.9) return 'TOF ratio ≥ 0.9. Four equal twitches with minimal fade — adequate neuromuscular recovery by current clinical standard. Safe for extubation.';
      if (ratio !== null) return `Four twitches present but with fade (ratio ${ratio.toFixed(2)}). Recovery is still incomplete. A ratio below 0.9 indicates residual paralysis even with 4/4 count — risk of post-operative respiratory compromise.`;
      return 'Four twitches present. Assessing recovery.';
    }

    function traceColor(count, ratio) {
      if (count >= 4 && ratio !== null && ratio >= 0.9) return '#00e676';
      if (count >= 4) return '#80e080';
      if (count >= 3) return '#ffcc00';
      if (count >= 2) return '#ff8040';
      if (count >= 1) return '#ff6020';
      return '#ff4444';
    }

    /* ── Mini canvas ─────────────────────────────────────────────────────── */
    function drawMini() {
      const canvas = document.getElementById('tof-mini-canvas');
      if (!canvas) return;
      const w = canvas.width = canvas.offsetWidth || 220;
      const h = canvas.height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = MONITOR_SCREEN_BG;
      ctx.fillRect(0, 0, w, h);

      const count = tofCount();
      const ratio = tofRatio();
      const depth = tofDepthInfo(count, ratio);

      const color = count >= 4 && ratio !== null && ratio >= 0.9 ? '#00e676'
                  : count >= 4 ? '#80e080'
                  : count >= 3 ? '#ffcc00'
                  : count >= 2 ? '#ff8040'
                  : '#ff4444';

      const barW = Math.max(6, Math.floor(w / 7));
      const gap  = Math.floor((w - 4 * barW) / 5);
      const startX = gap;
      const maxH  = h - 8;
      const baseY = h - 3;

      for (let i = 0; i < 4; i++) {
        const x   = startX + i * (barW + gap);
        const bh  = Math.max(2, Math.round(tofTwitches[i] * maxH));
        const y   = baseY - bh;
        ctx.globalAlpha = tofTwitches[i] < THRESHOLD ? 0.18 : 0.88;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, barW, bh, 2) : ctx.rect(x, y, barW, bh);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      const badge = document.getElementById('tof-mini-badge');
      if (badge) badge.textContent = count + '/4';
      const depthEl = document.getElementById('tof-mini-depth');
      if (depthEl) { depthEl.textContent = depth.label; depthEl.className = 'tof-mini-depth ' + depth.cls; }
    }

    /* ── Modal canvas ────────────────────────────────────────────────────── */
    function drawTOFCanvas(ts) {
      if (!tofLastTs) tofLastTs = ts;
      const dt = Math.min((ts - tofLastTs) / 1000, 0.05);
      tofLastTs = ts;
      tofCycleTime = (tofCycleTime + dt) % CYCLE_DUR;

      const canvas = document.getElementById('tof-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.offsetWidth || 380;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = MONITOR_SCREEN_BG;
      ctx.fillRect(0, 0, w, h);

      const baseY = Math.round(h * 0.83);
      const amp   = h * 0.70;

      /* baseline grid */
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(0, baseY); ctx.lineTo(w, baseY); ctx.stroke();
      ctx.setLineDash([]);

      /* vertical tick marks at each stimulus */
      const labels = ['T1', 'T2', 'T3', 'T4'];
      TWITCH_AT.forEach((tAt, i) => {
        const x = Math.round((tAt / CYCLE_DUR) * w);
        const isPast = tofCycleTime >= tAt - 0.05;
        ctx.strokeStyle = isPast ? 'rgba(120,180,255,0.45)' : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x, baseY); ctx.stroke();
        ctx.setLineDash([]);
      });

      /* waveform trace */
      const color = traceColor(tofCount(), tofRatio());
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      for (let px = 0; px <= w; px++) {
        const t = (px / w) * CYCLE_DUR;
        const y = baseY - tofWaveAt(t) * amp;
        px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* dim the "upcoming" portion of the cycle */
      const cursorX = Math.round((tofCycleTime / CYCLE_DUR) * w);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
      ctx.fillRect(cursorX, 0, w - cursorX, h);

      /* cursor line */
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cursorX, 0); ctx.lineTo(cursorX, h); ctx.stroke();

      /* T-labels */
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      TWITCH_AT.forEach((tAt, i) => {
        const x = Math.round((tAt / CYCLE_DUR) * w);
        const isJustFired = tofCycleTime > tAt - 0.05 && tofCycleTime < tAt + 0.3;
        ctx.fillStyle = isJustFired ? '#ffffff' : '#8a9aaa';
        ctx.fillText(labels[i], x, 12);
      });
      ctx.textAlign = 'left';

      updateNumerics();
      drawMini();

      if (tofModalOpen) tofAnimId = requestAnimationFrame(drawTOFCanvas);
    }

    /* ── Update modal numerics + interpretation ──────────────────────────── */
    function updateNumerics() {
      const count = tofCount();
      const ratio = tofRatio();
      const depth = tofDepthInfo(count, ratio);
      const countEl = document.getElementById('tof-count');
      const ratioEl = document.getElementById('tof-ratio');
      const depthEl = document.getElementById('tof-depth');
      const interpEl = document.getElementById('tof-interp');
      if (countEl) countEl.textContent = count + '/4';
      if (ratioEl) ratioEl.textContent = ratio !== null ? ratio.toFixed(2) : '—';
      if (depthEl) { depthEl.textContent = depth.label; depthEl.className = 'tof-depth-badge ' + depth.cls; }
      if (interpEl) interpEl.textContent = buildInterp(count, ratio);
    }

    /* ── Preset / drug controls ──────────────────────────────────────────── */
    function cancelDrugSeq() {
      if (drugSeqTimer) { clearTimeout(drugSeqTimer); drugSeqTimer = null; }
    }

    function setPreset(preset) {
      cancelDrugSeq();
      tofTwitches = [...preset.twitches];
      tofNote = '';
      updateNumerics();
      drawMini();
      document.querySelectorAll('.tof-preset-btn').forEach(b =>
        b.classList.toggle('tof-btn--active', b.dataset.pid === preset.id));
      document.querySelectorAll('.tof-drug-btn').forEach(b => b.classList.remove('tof-btn--active'));
    }

    function runDrugSeq(key) {
      cancelDrugSeq();
      const seq = TOF_DRUG_SEQS[key];
      if (!seq) return;
      document.querySelectorAll('.tof-preset-btn').forEach(b => b.classList.remove('tof-btn--active'));
      document.querySelectorAll('.tof-drug-btn').forEach(b =>
        b.classList.toggle('tof-btn--active', b.dataset.did === key));
      let idx = 0;
      function next() {
        if (idx >= seq.steps.length) return;
        const step = seq.steps[idx++];
        tofTwitches = [...step.twitches];
        tofNote = step.note;
        updateNumerics();
        drawMini();
        drugSeqTimer = setTimeout(next, 2900);
      }
      next();
    }

    /* ── Quiz ────────────────────────────────────────────────────────────── */
    function renderQuiz() {
      const el = document.getElementById('tof-quiz');
      if (!el) return;
      if (quizIdx >= TOF_QUIZ.length) {
        el.innerHTML = '<div class="tof-quiz-done">✓ Quiz complete — great work!</div>';
        return;
      }
      const q = TOF_QUIZ[quizIdx];
      el.innerHTML = `
        <div class="tof-quiz-header">Quick Check &mdash; ${quizIdx + 1} of ${TOF_QUIZ.length}</div>
        <div class="tof-quiz-q">${q.q}</div>
        <div class="tof-quiz-choices">
          ${q.choices.map((c, i) => `<button class="tof-qchoice" data-ci="${i}">${String.fromCharCode(65 + i)}. ${c}</button>`).join('')}
        </div>`;
      el.querySelectorAll('.tof-qchoice').forEach(btn => {
        btn.addEventListener('click', () => {
          const chosen = parseInt(btn.dataset.ci);
          el.querySelectorAll('.tof-qchoice').forEach((b, i) => {
            b.disabled = true;
            if (i === q.correct) b.classList.add('tof-qchoice--correct');
            else if (i === chosen) b.classList.add('tof-qchoice--wrong');
          });
          const fb = document.createElement('div');
          fb.className = 'tof-quiz-fb tof-quiz-fb--' + (chosen === q.correct ? 'correct' : 'wrong');
          fb.textContent = (chosen === q.correct ? '✓ ' : '✗ ') + q.explanation;
          el.appendChild(fb);
          const nxt = document.createElement('button');
          nxt.className = 'tof-quiz-next';
          nxt.textContent = quizIdx + 1 < TOF_QUIZ.length ? 'Next →' : 'Finish';
          nxt.addEventListener('click', () => { quizIdx++; renderQuiz(); });
          el.appendChild(nxt);
        });
      });
    }

    /* ── Open / close modal ──────────────────────────────────────────────── */
    function openModal() {
      const modal = document.getElementById('tof-modal');
      if (!modal) return;
      tofModalOpen = true;
      tofLastTs = null;
      tofCycleTime = 0;
      modal.showModal();
      requestAnimationFrame(drawTOFCanvas);
    }

    function closeModal() {
      const modal = document.getElementById('tof-modal');
      if (modal) modal.close();
      tofModalOpen = false;
      if (tofAnimId) { cancelAnimationFrame(tofAnimId); tofAnimId = null; }
    }

    /* ── Wire up DOM ─────────────────────────────────────────────────────── */
    const card = document.getElementById('tof-card');
    if (card) {
      card.addEventListener('click', openModal);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); } });
    }

    const closeBtn = document.getElementById('tof-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    const modal = document.getElementById('tof-modal');
    if (modal) {
      modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
      modal.addEventListener('close', () => {
        tofModalOpen = false;
        if (tofAnimId) { cancelAnimationFrame(tofAnimId); tofAnimId = null; }
      });
    }

    /* Preset buttons */
    const presetContainer = document.getElementById('tof-preset-btns');
    if (presetContainer) {
      TOF_PRESETS.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'tof-preset-btn tof-btn' + (p.id === 'normal' ? ' tof-btn--active' : '');
        btn.dataset.pid = p.id;
        btn.textContent = p.label;
        btn.style.setProperty('--tof-btn-color', p.color);
        btn.addEventListener('click', () => setPreset(p));
        presetContainer.appendChild(btn);
      });
    }

    /* Drug buttons */
    const drugContainer = document.getElementById('tof-drug-btns');
    if (drugContainer) {
      Object.entries(TOF_DRUG_SEQS).forEach(([key, seq]) => {
        const btn = document.createElement('button');
        btn.className = 'tof-drug-btn tof-btn';
        btn.dataset.did = key;
        btn.textContent = seq.label;
        btn.style.setProperty('--tof-btn-color', seq.color);
        btn.addEventListener('click', () => runDrugSeq(key));
        drugContainer.appendChild(btn);
      });
    }

    renderQuiz();
    drawMini();

    /* Keep mini-card preview refreshed when modal is closed */
    setInterval(() => { if (!tofModalOpen) drawMini(); }, 250);
  }

  /* ─────────────────────────────────────────────────────────────────────────
     INIT
     ───────────────────────────────────────────────────────────────────────── */
  /* ── Narrow viewports: shrink fixed ~1055px grid to fit width (after canvases size at full res) */
  const WORKSTATION_GRID_INVARIANT_PX = 1055;

  function initWorkstationFit() {
    const wrap = document.querySelector('.vent-workstation__grid-wrap');
    const grid = document.querySelector('.workstation-grid');
    if (!wrap || !grid) return;

    const mqWide = window.matchMedia('(min-width: 1101px)');

    function apply() {
      grid.style.removeProperty('transform');
      grid.style.removeProperty('transform-origin');
      wrap.style.removeProperty('min-height');

      if (mqWide.matches) {
        grid.style.removeProperty('zoom');
        wrap.style.removeProperty('overflow-x');
        return;
      }
      const avail = wrap.clientWidth;
      if (avail < 48) {
        requestAnimationFrame(apply);
        return;
      }
      const z = Math.min(1, avail / WORKSTATION_GRID_INVARIANT_PX);
      grid.style.zoom = String(z);
      wrap.style.overflowX = 'visible';

      /* If zoom doesn’t affect layout (some Firefox / edge cases), fall back to transform + height */
      requestAnimationFrame(() => {
        if (z >= 0.999) return;
        const laidOutW = grid.getBoundingClientRect().width;
        if (laidOutW <= avail + 6) return;
        grid.style.removeProperty('zoom');
        grid.style.transformOrigin = 'top center';
        grid.style.transform = 'scale(' + z + ')';
        wrap.style.overflowX = 'hidden';
        wrap.style.minHeight = grid.offsetHeight * z + 'px';
      });
    }

    apply();
    window.addEventListener('resize', apply, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => requestAnimationFrame(apply));
      ro.observe(wrap);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
      initCanvases();
      initWorkstationFit();
      initControls();
      initVentChat();
      initTOF();
      requestAnimationFrame(tick);
    });
  });

})();
