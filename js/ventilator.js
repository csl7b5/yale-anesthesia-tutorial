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
    compliance : 50,   // mL/cmH2O   (normal 50–80)
    resistance : 5,    // cmH2O/L/s  (normal 5–15)
    co2Prod    : 200,  // mL/min
    leak       : 0,    // fraction 0–1
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
    const VD_mL      = 150;
    const VA_Lmin    = Math.max((tv_mL - VD_mL), 50) * rr / 1000;
    const etco2Target = clamp((patientState.co2Prod / (VA_Lmin * 1000)) * 713, 15, 80);

    // Auto-PEEP: non-zero when expiratory time is too short to empty lungs
    // Rule: auto-PEEP ≈ volume remaining at breath start = (pip-peep)·e^(-te/tau)
    const autoPEEP = te < 2 * tau
      ? Math.round(Math.max(0, (pip_cmH2O - peep) * Math.exp(-te / Math.max(tau, 0.05)) * 0.5))
      : 0;

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

  /* ─────────────────────────────────────────────────────────────────────────
     SCROLL WAVEFORM CLASS
     ───────────────────────────────────────────────────────────────────────── */
  class ScrollWaveform {
    constructor(canvas, { color, pxPerSec, minVal, maxVal, lineWidth=1.5,
                          bgColor='#03060e', gridVals=[] }) {
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
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
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

    ctx.fillStyle = '#03060e';
    ctx.fillRect(0, 0, W, H);

    // Axis lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
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
      ctx.strokeStyle = 'rgba(160,160,160,0.3)';
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
    ctx.fillStyle = '#03060e';
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
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
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
    if (d.pip > 35)           alarms.push({ msg:`High Airway Pressure · PIP ${Math.round(d.pip)} cmH₂O`, level:'high' });
    if (d.tv_exhaled < 150)   alarms.push({ msg:'Low Exhaled Volume — possible disconnect', level:'high' });
    if (d.mv_Lmin < 2.0)      alarms.push({ msg:`Low Minute Ventilation · ${d.mv_Lmin.toFixed(1)} L/min`, level:'high' });
    if (d.etco2 > 55)         alarms.push({ msg:`High EtCO₂ · ${Math.round(d.etco2)} mmHg`, level:'medium' });
    if (d.etco2 < 18)         alarms.push({ msg:`Low EtCO₂ · ${Math.round(d.etco2)} mmHg`, level:'medium' });
    if (d.fio2 < 25)          alarms.push({ msg:`Low FiO₂ · ${d.fio2}%`, level:'high' });
    if (patientState.leak > 0.20) alarms.push({ msg:`Circuit Leak · ${Math.round(patientState.leak*100)}%`, level:'medium' });
    if (vitals.bisSmoothed > 70)  alarms.push({ msg:`Possible Awareness · BIS ${Math.round(vitals.bisSmoothed)}`, level:'high' });
    if (d.autoPEEP > 3)       alarms.push({ msg:`Auto-PEEP · ${d.autoPEEP} cmH₂O — risk of air trapping`, level:'medium' });

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
  let lastDrift = 0;
  function applyDrift(t, d) {
    // Smooth ETCO2 display (lags by ~30–60 s, matching real capnograph response)
    vitals.etco2Display += (d.etco2Target - vitals.etco2Display) * 0.001;

    // SpO2 target: FiO2 improves, resistance/leak hurt
    const spo2Target = clamp(
      97.5
      + (ventSettings.fio2 - 50) * 0.07
      - Math.max(0, patientState.resistance - 14) * 0.3
      - patientState.leak * 20,
      70, 100
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

    const eegC   = setSize('canvas-eeg',     52);
    spectralCanvas = setSize('canvas-spectral', 68);
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
  const SCENARIOS = [
    /* ── 1. Post-Induction Hypotension ──────────────────────────────────── */
    {
      id    : 'hypo',
      title : 'Post-Induction Hypotension',
      badge : 'Hemodynamics',
      badgeColor: '#ff6060',
      summary : 'Five minutes post-induction, your patient is under sevoflurane for an elective laparotomy. The arterial line is trending down.',
      initialPatient : { compliance:50, resistance:5, co2Prod:155, leak:0 },  // co2Prod calibrated so etco2Target ≈ 28
      initialVitals  : { hr:80, sysBP:74, diaBP:44, spo2:98, bis:48, etco2Display:28 },
      initialVent    : { tv:480, rr:12, peep:5, fio2:50, ti:1.0 },
      steps : [
        {
          question : 'Arterial pressure is 74/44 mmHg. SpO₂ and ventilator waveforms are relatively normal. EtCO₂ is 28 — slightly lower than expected. What is the best immediate next step?',
          choices : [
            {
              text      : 'A. Increase tidal volume to 700 mL to improve gas exchange',
              isCorrect : false,
              feedback  : 'Incorrect. Increasing tidal volume addresses CO₂ clearance, not cardiac output. It also raises intrathoracic pressure further, worsening venous return in an already hypotensive patient.',
              effects   : { patient:{}, vit:{ sysBP:-6, diaBP:-4 }, vent:{} },
            },
            {
              text      : 'B. Give a vasopressor and assess the likely cause (anesthetic vasodilation, preload, cardiac)',
              isCorrect : true,
              feedback  : 'Correct. Post-induction hypotension is most commonly caused by anesthetic vasodilation and reduced preload. Vasopressors address the immediate blood pressure while you assess the underlying cause. Note that the falling EtCO₂ is an early sign of reduced cardiac output — CO₂ delivery to the lungs falls when perfusion drops.',
              effects   : { patient:{}, vit:{ sysBP:38, diaBP:22, hr:-5 }, vent:{} },
            },
            {
              text      : 'C. Decrease FiO₂ from 50% to 21%',
              isCorrect : false,
              feedback  : 'Incorrect — and dangerous. Reducing oxygen delivery in an already hypotensive patient compounds the risk of end-organ ischemia. SpO₂ currently looks fine because reserves exist, but low perfusion + low FiO₂ is a hazardous combination.',
              effects   : { patient:{}, vit:{ sysBP:-12, spo2:-2 }, vent:{ fio2:21 } },
            },
            {
              text      : 'D. Do nothing — SpO₂ is normal so oxygen delivery must be adequate',
              isCorrect : false,
              feedback  : 'Incorrect. Normal SpO₂ reflects arterial oxygen saturation, not tissue oxygen delivery. Cardiac output can be severely compromised while SpO₂ remains normal for a period. Sustained hypotension causes end-organ ischemia.',
              effects   : { patient:{}, vit:{ sysBP:-18, diaBP:-9 }, vent:{} },
            },
          ],
        },
        {
          question : 'After vasopressor, BP recovers to 96/58. EtCO₂ is still 26 mmHg — lower than expected given normal ventilation settings. What is the most likely explanation?',
          choices : [
            {
              text      : 'A. Hyperventilation — the respiratory rate must be too high',
              isCorrect : false,
              feedback  : 'Incorrect. RR is unchanged at 12. If hyperventilation were responsible, it would have been present from the start and would be reflected in lower PaCO₂ throughout.',
              effects   : { patient:{}, vit:{}, vent:{} },
            },
            {
              text      : 'B. Reduced cardiac output causing increased dead-space ventilation',
              isCorrect : true,
              feedback  : 'Correct. EtCO₂ reflects CO₂ arriving at the alveolus via the pulmonary circulation. When cardiac output falls, less CO₂ is delivered per breath — so EtCO₂ falls even with unchanged ventilation. This makes EtCO₂ an indirect but early indicator of hemodynamic compromise. As cardiac output recovers, EtCO₂ should gradually rise back toward normal.',
              effects   : { patient:{}, vit:{ sysBP:16, diaBP:8, etco2Display:34 }, vent:{} },
            },
            {
              text      : 'C. Circuit leak — exhaled tidal volume must be falling',
              isCorrect : false,
              feedback  : 'Incorrect. A circuit leak would show a clear discrepancy between inspired and expired tidal volume on the ventilator numerics, and would trigger a disconnect alarm. Exhaled TV here is normal.',
              effects   : { patient:{}, vit:{}, vent:{} },
            },
            {
              text      : 'D. Fever — elevated metabolism consuming more CO₂',
              isCorrect : false,
              feedback  : 'Incorrect. Fever increases CO₂ production, which would raise EtCO₂, not lower it. A falling EtCO₂ with stable ventilation points to reduced CO₂ delivery to the lungs — i.e., low cardiac output.',
              effects   : { patient:{}, vit:{}, vent:{} },
            },
          ],
        },
      ],
      resolution : 'Scenario complete. Volatile anesthetics reduce SVR and myocardial contractility, causing post-induction hypotension. Falling EtCO₂ is an early hemodynamic warning sign. Vasopressors and fluid resuscitation are first-line. When BP improves and cardiac output recovers, EtCO₂ should trend back toward normal.',
    },

    /* ── 2. Anaphylaxis to Rocuronium ───────────────────────────────────── */
    {
      id    : 'anaphylaxis',
      title : 'Anaphylaxis to Rocuronium',
      badge : 'Emergency',
      badgeColor: '#ff3333',
      summary : 'Sixty seconds after rocuronium for intubation, BP crashes to 52/28. Peak pressures are climbing. Skin shows diffuse erythema.',
      initialPatient : { compliance:36, resistance:26, co2Prod:233, leak:0 },  // co2Prod calibrated so etco2Target ≈ 42
      initialVitals  : { hr:138, sysBP:52, diaBP:28, spo2:93, bis:52, etco2Display:42 },
      initialVent    : { tv:480, rr:12, peep:5, fio2:50, ti:1.0 },
      steps : [
        {
          question : 'BP 52/28, HR 138, peak pressure 40 cmH₂O, SpO₂ 93% and falling. Skin erythema visible. What is the single most important immediate action?',
          choices : [
            {
              text      : 'A. Give epinephrine IV (or IM if no IV access) and switch FiO₂ to 100%',
              isCorrect : true,
              feedback  : 'Correct. Epinephrine simultaneously reverses all major pathophysiologic processes in anaphylaxis: it restores vasomotor tone (↑BP), reverses bronchospasm (↓airway pressure), stabilises mast cells, and provides inotropic support. 100% FiO₂ is essential with a falling SpO₂. Speed is critical — every minute of untreated anaphylactic shock increases mortality.',
              effects   : { patient:{ resistance:10, compliance:44 }, vit:{ sysBP:50, diaBP:30, hr:-28, spo2:5 }, vent:{ fio2:100 } },
            },
            {
              text      : 'B. Increase sevoflurane to deepen anesthesia and reduce stress response',
              isCorrect : false,
              feedback  : 'Incorrect — and dangerous. Volatile anesthetics are potent vasodilators. Deepening anesthesia in a patient with 52/28 BP and cardiovascular collapse will almost certainly precipitate cardiac arrest.',
              effects   : { patient:{}, vit:{ sysBP:-24, diaBP:-14, hr:18, spo2:-3 }, vent:{} },
            },
            {
              text      : 'C. Lower PEEP to reduce intrathoracic pressure',
              isCorrect : false,
              feedback  : 'Partially conceptually relevant but critically insufficient. While high PEEP in a hypovolemic patient can impair venous return, this intervention does nothing to reverse the anaphylactic process. Bronchospasm, mast cell degranulation, and vascular collapse all continue.',
              effects   : { patient:{}, vit:{ sysBP:-8 }, vent:{ peep:2 } },
            },
            {
              text      : 'D. Wait for the NIBP cuff to recycle for a more accurate reading',
              isCorrect : false,
              feedback  : 'Incorrect. The arterial line is showing 52/28. Waiting in anaphylactic shock wastes precious minutes. Within 2–3 minutes of untreated anaphylaxis, cardiovascular collapse can progress to cardiac arrest.',
              effects   : { patient:{}, vit:{ sysBP:-18, diaBP:-10, spo2:-3 }, vent:{} },
            },
          ],
        },
        {
          question : 'Epinephrine given. BP improving to 84/50. Airway pressures still elevated. SpO₂ stabilizing at 95%. What are the most important next steps?',
          choices : [
            {
              text      : 'A. Give IV fluid bolus, call for help, and stop or avoid the suspected trigger',
              isCorrect : true,
              feedback  : 'Correct. Anaphylaxis management: (1) Epinephrine first-line ✓. (2) IV fluid — anaphylaxis causes massive vasodilation and third-spacing. (3) Call for help — you need extra hands and possibly an allergist/code team. (4) Stop the trigger — do not re-expose. Repeat epinephrine if BP remains inadequate. Corticosteroids and antihistamines are adjuncts but not substitutes.',
              effects   : { patient:{ resistance:12 }, vit:{ sysBP:32, diaBP:18, hr:-22, spo2:3 }, vent:{} },
            },
            {
              text      : 'B. Give metoprolol to control the tachycardia',
              isCorrect : false,
              feedback  : 'Incorrect — and dangerous. The tachycardia here is compensatory, maintaining cardiac output in the face of profound vasodilation. Beta-blockade would blunt epinephrine\'s beneficial effects and reduce the compensatory heart rate response. Beta-blocked patients often have refractory anaphylaxis.',
              effects   : { patient:{}, vit:{ sysBP:-25, hr:-15 }, vent:{} },
            },
            {
              text      : 'C. Reduce minute ventilation to lower intrathoracic pressure and improve venous return',
              isCorrect : false,
              feedback  : 'Incorrect. Reducing ventilation with ongoing bronchospasm and a SpO₂ of 95% will cause hypoxemia and hypercapnia. Maintaining ventilatory support is essential. Once bronchospasm resolves, pressures will normalise.',
              effects   : { patient:{}, vit:{ spo2:-3 }, vent:{} },
            },
            {
              text      : 'D. Nothing more — epinephrine has been given, wait and observe',
              isCorrect : false,
              feedback  : 'Incorrect. Epinephrine has a short duration of action. Without fluid resuscitation, recurrence is likely. Biphasic anaphylaxis (recurrence 4–12 hours later) also requires observation. Help, fluids, and corticosteroids are all indicated.',
              effects   : { patient:{}, vit:{ sysBP:-10 }, vent:{} },
            },
          ],
        },
      ],
      resolution : 'Anaphylaxis scenario complete. The classic triad is hypotension + bronchospasm + tachycardia following drug exposure. Epinephrine is first-line — it addresses all three components simultaneously. 100% FiO₂, IV fluids, calling for help, and avoiding the trigger are essential next steps. Watch airway pressures fall and SpO₂ recover as bronchospasm resolves.',
    },

    /* ── 3. Bronchospasm After Airway Stimulation ────────────────────────── */
    {
      id    : 'bronchospasm',
      title : 'Bronchospasm After Airway Stimulation',
      badge : 'Airway',
      badgeColor: '#ffcc00',
      summary : 'During maintenance of anesthesia, brief suction causes airway reactivity. Peak pressures are climbing steadily.',
      initialPatient : { compliance:48, resistance:22, co2Prod:245, leak:0 },  // co2Prod calibrated so etco2Target ≈ 44
      initialVitals  : { hr:96, sysBP:130, diaBP:80, spo2:97, bis:52, etco2Display:44 },
      initialVent    : { tv:480, rr:12, peep:5, fio2:50, ti:1.0 },
      steps : [
        {
          question : 'Peak pressure is 38 cmH₂O (up from 22). The expiratory flow waveform does not fully return to zero. EtCO₂ is 44 mmHg with an upsloping alveolar plateau on the capnogram. SpO₂ is still 97%. What is the best next step?',
          choices : [
            {
              text      : 'A. Give inhaled bronchodilator (salbutamol) and increase sevoflurane concentration',
              isCorrect : true,
              feedback  : 'Correct. Bronchodilators directly relax airway smooth muscle. Volatile anesthetics (especially sevo and isoflurane) have intrinsic bronchodilatory properties, making deeper anesthesia both anti-bronchospastic and ablating the vagal reflex causing spasm. Together these address both the mechanical and neural components.',
              effects   : { patient:{ resistance:9 }, vit:{ hr:-8, sysBP:-6 }, vent:{} },
            },
            {
              text      : 'B. Increase respiratory rate to 20 to clear the rising CO₂',
              isCorrect : false,
              feedback  : 'Incorrect — and harmful. Increasing RR in obstructive physiology severely shortens expiratory time. Look at the flow waveform: expiratory flow already doesn\'t return to zero. Faster breathing means less time to exhale, worsening air trapping, increasing auto-PEEP, and potentially causing barotrauma. Never increase RR in obstruction.',
              effects   : { patient:{ resistance:6 }, vit:{ hr:10, sysBP:14 }, vent:{ rr:20 } },
            },
            {
              text      : 'C. Observe only — oxygen saturation is still 97%',
              isCorrect : false,
              feedback  : 'Incorrect. SpO₂ is a lagging indicator — desaturation is the last step in a cascade that begins with obstructed flow and rising pressures. By the time SpO₂ falls, the situation is much harder to rescue. Treat bronchospasm while you have reserve.',
              effects   : { patient:{ resistance:8 }, vit:{ spo2:-2 }, vent:{} },
            },
            {
              text      : 'D. Decrease FiO₂ to 21% to prevent oxygen toxicity',
              isCorrect : false,
              feedback  : 'Incorrect — and actively dangerous. Oxygen toxicity is not a meaningful risk over a short operative timeframe. Reducing FiO₂ in a patient with developing bronchospasm and compromised ventilation will accelerate desaturation.',
              effects   : { patient:{ resistance:6 }, vit:{ spo2:-3 }, vent:{ fio2:21 } },
            },
          ],
        },
        {
          question : 'Bronchodilator and deeper sevo are working — peak pressures falling toward 30. The flow waveform still doesn\'t fully return to zero before the next breath. What ventilator change would help most?',
          choices : [
            {
              text      : 'A. Decrease respiratory rate (e.g. to 8 br/min) to lengthen expiratory time',
              isCorrect : true,
              feedback  : 'Correct. In obstructive physiology, the RC expiratory time constant (τ = R×C) is prolonged. The lung needs 3×τ to empty >95%. Slowing RR extends the expiratory phase so that air can fully exit before the next breath begins. This prevents breath stacking and reduces auto-PEEP. The resulting brief rise in EtCO₂ is acceptable — it will normalise as resistance improves.',
              effects   : { patient:{ resistance:-4 }, vit:{ hr:-5 }, vent:{ rr:8 } },
            },
            {
              text      : 'B. Increase respiratory rate to 20 to wash out CO₂ faster',
              isCorrect : false,
              feedback  : 'Incorrect. This is the same dangerous error as before. Faster rates in obstruction cause air stacking. The time constant worsens the situation: flow never returns to zero, auto-PEEP builds, and peak pressures rise further. Watch the flow waveform — it is your real-time indicator.',
              effects   : { patient:{ resistance:4 }, vit:{ sysBP:10 }, vent:{ rr:20 } },
            },
            {
              text      : 'C. Increase PEEP from 5 to 15 cmH₂O to "stent" open the airways',
              isCorrect : false,
              feedback  : 'Incorrect. PEEP is beneficial for recruitable atelectasis (low compliance states). In obstructive physiology with air trapping, high PEEP adds to the total end-expiratory pressure and can worsen dynamic hyperinflation. It is not a primary treatment for bronchospasm.',
              effects   : { patient:{}, vit:{ sysBP:-9 }, vent:{ peep:15 } },
            },
            {
              text      : 'D. Switch to pressure control mode to limit peak airway pressure',
              isCorrect : false,
              feedback  : 'Not the primary solution. Pressure control limits the delivered pressure, which would reduce tidal volume in high-resistance settings. The core problem is the expiratory time constant — mode switching does not address incomplete exhalation.',
              effects   : { patient:{}, vit:{}, vent:{} },
            },
          ],
        },
      ],
      resolution : 'Bronchospasm scenario complete. Key pattern: high resistance raises PIP disproportionately over Pplat, prolongs expiratory flow (watch the flow waveform!), and produces an obstructive (upsloping) capnogram. Treatment: bronchodilators + deeper volatile. The most critical ventilator adjustment is slowing RR to allow complete exhalation. Never increase RR in obstructive physiology.',
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
    active    : false,
    scenario  : null,
    stepIdx   : 0,
    answered  : false,
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
    overlay.active = false;
    overlay.patient = {};
    overlay.vit = {};
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
    // Patient state targets
    if (effects.patient) {
      for (const k in effects.patient) {
        overlay.patient[k] = effects.patient[k];
      }
    }
    // Vital sign targets (relative delta or absolute)
    if (effects.vit) {
      for (const k in effects.vit) {
        overlay.vit[k] = vitals[k] + effects.vit[k];
      }
    }
    // Vent settings: apply immediately
    if (effects.vent) {
      Object.assign(ventSettings, effects.vent);
      syncSlidersToSettings();
    }
    overlay.active = true;
  }

  function startScenario(scenario) {
    saveBaseline();
    scenState.active   = true;
    scenState.scenario = scenario;
    scenState.stepIdx  = 0;
    scenState.answered = false;

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
    scenState.answered = false;
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

    const container = $('scen-cards');
    if (!container) return;
    container.innerHTML = SCENARIOS.map((s, i) =>
      `<button class="scen-card" type="button" data-scen-idx="${i}">
         <span class="scen-card__badge" style="background:${s.badgeColor}22;color:${s.badgeColor};border:1px solid ${s.badgeColor}44">${s.badge}</span>
         <div class="scen-card__title">${s.title}</div>
         <div class="scen-card__summary">${s.summary}</div>
         <div class="scen-card__cta">▶ Start scenario →</div>
       </button>`
    ).join('');

    container.querySelectorAll('.scen-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.scenIdx, 10);
        startScenario(SCENARIOS[idx]);
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
      badge.textContent = s.badge;
      badge.style.background = s.badgeColor + '22';
      badge.style.color      = s.badgeColor;
      badge.style.border     = `1px solid ${s.badgeColor}44`;
    }
    if (title) title.textContent = s.title;

    const ctxEl = $('scen-context');
    if (ctxEl) ctxEl.innerHTML = `<strong>Clinical Context</strong><br>${s.summary}`;
  }

  function renderScenStep() {
    const s    = scenState.scenario;
    const step = s.steps[scenState.stepIdx];

    const stepLabel = $('scen-step');
    if (stepLabel) stepLabel.textContent = `Step ${scenState.stepIdx + 1} of ${s.steps.length}`;

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

  function renderScenFeedback(step, selectedIdx, choice) {
    const qa = $('scen-qa');
    if (!qa) return;

    // Style all buttons: correct=green, selected-wrong=red, rest=dim
    qa.querySelectorAll('.scen-choice').forEach((btn, i) => {
      btn.disabled = true;
      const c = step.choices[i];
      if (c.isCorrect)           btn.classList.add('scen-choice--correct');
      else if (i === selectedIdx) btn.classList.add('scen-choice--wrong');
    });

    // Append feedback card
    const fbDiv = document.createElement('div');
    fbDiv.className = `scen-feedback scen-feedback--${choice.isCorrect ? 'correct' : 'wrong'}`;
    fbDiv.innerHTML = (choice.isCorrect ? '✓ ' : '✗ ') + choice.feedback;
    qa.appendChild(fbDiv);

    const isLast = scenState.stepIdx >= scenState.scenario.steps.length - 1;
    const nextBtn = document.createElement('button');
    nextBtn.type      = 'button';
    nextBtn.className = 'scen-next-btn';
    nextBtn.textContent = isLast ? 'See Resolution →' : 'Next Question →';
    nextBtn.addEventListener('click', nextScenStep);
    qa.appendChild(nextBtn);
  }

  function renderScenResolution() {
    const sel    = $('scen-select');
    const active = $('scen-active');
    const resol  = $('scen-resolution');
    if (sel)    sel.hidden    = true;
    if (active) active.hidden = true;
    if (resol)  resol.hidden  = false;

    const s = scenState.scenario;
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

    if (openBtn) openBtn.addEventListener('click', () => {
      if (!panel) return;
      if (panel.hidden) {
        panel.hidden = false;
        if (!scenState.active) renderScenSelectView();
        openBtn.textContent = '▼ Hide Scenarios';
      } else {
        panel.hidden = true;
        openBtn.textContent = '▶ Clinical Scenarios — Test Your Knowledge';
      }
    });
    if (closeBtn) closeBtn.addEventListener('click', () => {
      if (panel) panel.hidden = true;
      if (openBtn) openBtn.textContent = '▶ Clinical Scenarios — Test Your Knowledge';
    });
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
    var SYSTEM_PROMPT =
      'You are an expert anesthesia attending physician helping a 3rd\u20134th year medical student on their ' +
      'anesthesia clerkship. Answer questions about mechanical ventilation, respiratory physiology, ' +
      'ventilator settings (tidal volume, PEEP, FiO\u2082, I:E ratio), pressure-volume loops, waveform ' +
      'interpretation, and perioperative critical care. Be concise and practical \u2014 like a knowledgeable ' +
      'senior resident explaining things at the bedside. Keep answers to 3\u20135 sentences unless asked to ' +
      'elaborate. Always note that responses are for educational purposes only.';

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

    function getKey()   { return localStorage.getItem('pyxis-oai-key') || ''; }
    function saveKey(k) { localStorage.setItem('pyxis-oai-key', k.trim()); }

    function openPanel() {
      panel.setAttribute('aria-hidden', 'false');
      if (aiBtn) { aiBtn.setAttribute('aria-expanded', 'true'); aiBtn.style.display = 'none'; }
      if (!getKey()) {
        showKeyCard();
      } else if (messagesEl.children.length === 0) {
        appendMsg('ai', 'Ask me anything about ventilators, waveforms, or the clinical scenarios on this page!');
      }
      setTimeout(function () { if (inputEl) inputEl.focus(); }, 80);
    }

    function closePanel() {
      panel.setAttribute('aria-hidden', 'true');
      if (aiBtn) { aiBtn.setAttribute('aria-expanded', 'false'); aiBtn.style.display = ''; }
    }

    if (aiBtn) aiBtn.addEventListener('click', function (e) { e.currentTarget.blur(); openPanel(); });
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (keyBtn) keyBtn.addEventListener('click', function () { showKeyCard(true); });
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

    function showKeyCard(replacing) {
      var existing = document.getElementById('chat-apikey-card');
      if (existing && !replacing) return;
      if (existing) existing.remove();
      var card = document.createElement('div');
      card.className = 'chat-apikey-card';
      card.id = 'chat-apikey-card';
      card.innerHTML =
        '<p>Enter your <strong>OpenAI API key</strong> to activate the assistant. ' +
        'It is stored only in your browser\u2019s local storage and sent only to OpenAI.</p>' +
        '<input type="password" id="chat-key-input" placeholder="sk-..." autocomplete="off">' +
        '<button type="button" id="chat-key-save">Activate</button>';
      messagesEl.appendChild(card);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      function tryActivate() {
        var val = (document.getElementById('chat-key-input').value || '').trim();
        if (val.startsWith('sk-') && val.length > 20) {
          saveKey(val);
          card.remove();
          appendMsg('ai', 'Ready! Ask me anything about ventilators or clinical physiology.');
          if (inputEl) inputEl.focus();
        } else {
          document.getElementById('chat-key-input').style.borderColor = '#c0402a';
        }
      }
      document.getElementById('chat-key-save').addEventListener('click', tryActivate);
      document.getElementById('chat-key-input').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') tryActivate();
      });
    }

    function sendMessage() {
      if (busy) return;
      var text = (inputEl && inputEl.value || '').trim();
      if (!text) return;
      if (!getKey()) { openPanel(); return; }
      inputEl.value = '';
      appendMsg('user', text);
      history.push({ role: 'user', content: text });
      busy = true;
      if (sendBtn) sendBtn.disabled = true;
      showTyping();
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getKey() },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: SYSTEM_PROMPT }].concat(history),
          max_tokens: 520,
          temperature: 0.6
        })
      })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (r) {
        hideTyping();
        if (!r.ok) {
          var code = r.data.error && r.data.error.code;
          appendMsg('system', code === 'invalid_api_key'
            ? '\u26A0 Invalid API key \u2014 click \u2699 to update it.'
            : '\u26A0 ' + ((r.data.error && r.data.error.message) || 'API error.'));
          return;
        }
        var reply = r.data.choices[0].message.content.trim();
        history.push({ role: 'assistant', content: reply });
        appendMsg('ai', reply);
      })
      .catch(function () {
        hideTyping();
        appendMsg('system', '\u26A0 Could not reach the AI. Check your connection and API key.');
      })
      .finally(function () {
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
     INIT
     ───────────────────────────────────────────────────────────────────────── */
  window.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
      initCanvases();
      initControls();
      initVentChat();
      requestAnimationFrame(tick);
    });
  });

})();
