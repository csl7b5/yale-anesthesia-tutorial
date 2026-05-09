/**
 * Ventilator Modes Animator
 * Canvas-based interactive tutorial for 6 ventilator modes.
 * Physics engine ported directly from VentilatorAnimation.md reference skeleton.
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // MODE DEFINITIONS
  // ─────────────────────────────────────────────────────────────
  var MODES = {
    VCV: {
      name: 'VCV', fullName: 'Volume Control Ventilation',
      subtitle: 'Ventilator guarantees tidal volume; pressure varies with lung compliance and resistance.',
      control: 'Tidal volume + inspiratory flow rate',
      varies: 'Airway pressure',
      trigger: 'Machine-triggered',
      cycleSec: 5.5, accent: '#2dd4bf',
    },
    PCV: {
      name: 'PCV', fullName: 'Pressure Control Ventilation',
      subtitle: 'Ventilator targets a set inspiratory pressure; tidal volume varies with lung mechanics.',
      control: 'Inspiratory pressure above PEEP',
      varies: 'Tidal volume + flow',
      trigger: 'Machine-triggered',
      cycleSec: 5.5, accent: '#7dd3fc',
    },
    AC: {
      name: 'A/C', fullName: 'Assist-Control Ventilation',
      subtitle: 'Every patient trigger — or the backup timer — delivers a full mandatory-sized breath.',
      control: 'Full supported breath after each trigger',
      varies: 'Breath timing (patient or machine)',
      trigger: 'Patient-triggered or machine backup',
      cycleSec: 5.5, accent: '#86efac',
    },
    IMV: {
      name: 'SIMV / IMV', fullName: 'Intermittent Mandatory Ventilation',
      subtitle: 'Scheduled mandatory breaths occur at a set rate; spontaneous breathing is permitted between them.',
      control: 'Scheduled mandatory breath rate + volume/pressure',
      varies: 'Spontaneous breath timing and depth',
      trigger: 'Machine (mandatory) + patient (spontaneous)',
      cycleSec: 7.2, accent: '#fcd34d',
    },
    APRV: {
      name: 'APRV', fullName: 'Airway Pressure Release Ventilation',
      subtitle: 'Long high-pressure hold recruits alveoli; brief releases clear CO₂. Spontaneous breathing on Phigh is encouraged.',
      control: 'Phigh, Thigh, Plow, Tlow',
      varies: 'Release volume + spontaneous tidal volume',
      trigger: 'Time-cycled release; spontaneous breathing on Phigh',
      cycleSec: 9.0, accent: '#e879f9',
    },
    PSV: {
      name: 'PSV', fullName: 'Pressure Support Ventilation',
      subtitle: 'Patient initiates every breath; ventilator augments with a set pressure above PEEP.',
      control: 'Inspiratory pressure support level',
      varies: 'Rate, inspiratory time, and tidal volume',
      trigger: 'Patient-triggered (no backup)',
      cycleSec: 5.2, accent: '#a78bfa',
    },
  };
  var MODE_KEYS = ['VCV', 'PCV', 'AC', 'IMV', 'APRV', 'PSV'];

  /** One quick-check question per mode — keyed to teaching goals */
  var QUIZZES = {
    VCV: {
      q: 'In volume control ventilation, what does the ventilator primarily guarantee?',
      choices: ['Set tidal volume (flow/time set)', 'Set peak inspiratory pressure', 'Patient-selected rate only'],
      correct: 0,
    },
    PCV: {
      q: 'In pressure control, what changes when compliance or resistance changes?',
      choices: ['The inspiratory pressure limit', 'Delivered tidal volume', 'Only PEEP'],
      correct: 1,
    },
    AC: {
      q: 'In assist-control, after a trigger (patient or backup timer), the breath is:',
      choices: ['A full mandatory-sized breath', 'Always spontaneous only', 'Pressure support only'],
      correct: 0,
    },
    IMV: {
      q: 'SIMV / IMV is distinct because it allows:',
      choices: ['Mandatory scheduled breaths plus spontaneous breaths between them', 'Only APRV-style releases', 'No patient triggering'],
      correct: 0,
    },
    APRV: {
      q: 'The brief release to Plow in APRV mainly helps with:',
      choices: ['Recruitment only — never CO₂', 'CO₂ clearance during the low-pressure interval', 'Eliminating spontaneous breathing'],
      correct: 1,
    },
    PSV: {
      q: 'In pressure support ventilation, breath initiation is typically:',
      choices: ['Machine-only on a fixed timer', 'Patient-triggered', 'Random'],
      correct: 1,
    },
  };

  // Scene geometry — logical viewport 790 × 370
  var VB_W = 790, VB_H = 370;
  var SCENE_OX = 108;  // center bellows + tube + lungs horizontally in frame
  var SCENE_DY = 10;   // top inset (no on-canvas phase box)
  var SCENE_VIS_NUDGE_Y = -16; // shift illustration up — more room for diaphragm / labels
  var LUNG_VERT = 5;   // slight separation trachea ↔ lung tops
  var AX = 395;       // carina / trachea
  var LCX = 344, RCX = 446;
  var LUNG_DX = -204;
  // Bigger bellows, shorter delivery tubing
  var BELLOW_X = 44, BELLOW_W = 96, BELLOW_YM = 188;
  var BELLOW_HALF = 78;       // vertical half-span of bellows body
  var BELLOW_COMP = 38;       // max compression travel (was 30)
  var TUBE_Y = 188, TUBE_START = 168, TUBE_END = 342;

  var FONT = '"Inter", system-ui, -apple-system, sans-serif';

  // ─────────────────────────────────────────────────────────────
  // MATH HELPERS
  // ─────────────────────────────────────────────────────────────
  function clamp(v, lo, hi) {
    lo = lo !== undefined ? lo : 0;
    hi = hi !== undefined ? hi : 1;
    return Math.min(hi, Math.max(lo, v));
  }
  function smoothstep(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }
  function bell(x, center, width) {
    var d = Math.abs(x - center) / width;
    return clamp(1 - d * d, 0, 1);
  }

  // ─────────────────────────────────────────────────────────────
  // PHYSICS ENGINE  (direct port from VentilatorAnimation.md)
  // ─────────────────────────────────────────────────────────────
  function computeState(mode, seconds, settings) {
    var cfg = MODES[mode];
    var phase = (((seconds % cfg.cycleSec) + cfg.cycleSec) % cfg.cycleSec) / cfg.cycleSec;
    var effort = !settings || settings.patientEffort !== false;
    var peep = 0.12;
    var pressure = peep, flow = 0, volume = 0, lung = 0, bellows = 0, patientEffort = 0;
    var machineBreath = false, spontaneousBreath = false, releaseValve = 0;
    var phaseTitle = 'Baseline / PEEP';
    var phaseDetail = 'End-expiratory pressure maintains resting lung volume before the next breath.';

    // ── VCV ──
    if (mode === 'VCV') {
      if (phase < 0.34) {
        var vcvP = smoothstep(0, 0.34, phase);
        machineBreath = true; bellows = vcvP; lung = vcvP; volume = vcvP; flow = 0.76;
        pressure = peep + 0.18 + 0.62 * Math.pow(vcvP, 1.3);
        phaseTitle = 'VCV inspiration';
        phaseDetail = 'Fixed flow delivers the set tidal volume; airway pressure rises with lung mechanics.';
      } else if (phase < 0.50) {
        machineBreath = true; bellows = 1; lung = 1; volume = 1; flow = 0.02; pressure = peep + 0.82;
        phaseTitle = 'Inspiratory pause';
        phaseDetail = 'Flow approaches zero while volume is briefly held — plateau pressure is measured here.';
      } else if (phase < 0.84) {
        var vcvE = smoothstep(0.50, 0.84, phase);
        bellows = 1 - vcvE; lung = 1 - vcvE; volume = 1 - vcvE;
        flow = -0.64 * (1 - vcvE); pressure = peep + 0.55 * (1 - vcvE);
        phaseTitle = 'Passive exhalation';
        phaseDetail = 'Elastic recoil drives gas out through the expiratory valve.';
      }
    }

    // ── PCV ──
    if (mode === 'PCV') {
      if (phase < 0.38) {
        var pcvRise = smoothstep(0, 0.10, phase);
        var pcvFill = 1 - Math.exp(-3.0 * (phase / 0.38));
        machineBreath = true;
        pressure = peep + 0.78 * pcvRise; flow = 0.92 * Math.exp(-2.3 * (phase / 0.38));
        lung = pcvFill; volume = pcvFill; bellows = pcvFill * 0.88;
        phaseTitle = 'PCV inspiration';
        phaseDetail = 'Pressure rapidly reaches the target; flow decelerates as the lung fills.';
      } else if (phase < 0.56) {
        machineBreath = true; pressure = peep + 0.78; flow = 0.03;
        lung = 1; volume = 1; bellows = 0.88;
        phaseTitle = 'Pressure hold';
        phaseDetail = 'Delivered volume depends on compliance, resistance, and inspiratory time.';
      } else if (phase < 0.86) {
        var pcvE = smoothstep(0.56, 0.86, phase);
        pressure = peep + 0.70 * (1 - pcvE); flow = -0.64 * (1 - pcvE);
        lung = 1 - pcvE; volume = 1 - pcvE; bellows = 0.88 * (1 - pcvE);
        phaseTitle = 'Passive exhalation';
        phaseDetail = 'Pressure falls toward PEEP as expiratory flow leaves the lungs.';
      }
    }

    // ── A/C ──
    if (mode === 'AC') {
      var acTS = effort ? 0.06 : 0.0, acTE = effort ? 0.18 : 0.08;
      var acIE = 0.43, acHE = 0.55, acXE = 0.84;
      var acTEff = effort ? bell(phase, (acTS + acTE) / 2, 0.085) : 0;
      if (phase < acTS) {
        phaseTitle = 'Waiting window';
        phaseDetail = 'The ventilator waits for a patient trigger or the backup mandatory timing.';
      } else if (phase < acTE) {
        patientEffort = acTEff;
        pressure = effort ? peep - 0.12 * acTEff : peep;
        flow = effort ? 0.03 * acTEff : 0;
        phaseTitle = effort ? 'Patient trigger' : 'Backup time trigger';
        phaseDetail = effort ? 'Patient effort creates a small negative-pressure deflection, triggering the vent.'
          : 'No effort shown; the ventilator initiates the breath on its backup timer.';
      } else if (phase < acIE) {
        var acP = smoothstep(acTE, acIE, phase);
        machineBreath = true; bellows = acP; lung = acP; volume = acP; flow = 0.76;
        pressure = peep + 0.18 + 0.62 * Math.pow(acP, 1.25);
        phaseTitle = 'Full assisted inspiration';
        phaseDetail = 'Assist-control delivers a complete mandatory-sized breath regardless of trigger source.';
      } else if (phase < acHE) {
        machineBreath = true; bellows = 1; lung = 1; volume = 1; flow = 0.02; pressure = peep + 0.82;
        phaseTitle = 'End-inspiratory hold';
        phaseDetail = 'The full supported breath is complete before exhalation begins.';
      } else if (phase < acXE) {
        var acE = smoothstep(acHE, acXE, phase);
        bellows = 1 - acE; lung = 1 - acE; volume = 1 - acE;
        flow = -0.64 * (1 - acE); pressure = peep + 0.55 * (1 - acE);
        phaseTitle = 'Passive exhalation';
        phaseDetail = 'Support cycles off; the patient exhales passively before the next trigger window.';
      }
    }

    // ── SIMV / IMV ──
    if (mode === 'IMV') {
      var imvMIE = 0.28, imvMXE = 0.50;
      var imvSTS = 0.58, imvSIS = 0.74, imvSIE = 0.84, imvSXE = 0.95;
      var imvSEff = effort ? bell(phase, (imvSTS + imvSIS) / 2, 0.085) : 0;
      if (phase < imvMIE) {
        var imvP = smoothstep(0, imvMIE, phase);
        machineBreath = true; bellows = imvP; lung = imvP; volume = imvP; flow = 0.72;
        pressure = peep + 0.18 + 0.54 * Math.pow(imvP, 1.2);
        phaseTitle = 'Scheduled mandatory inspiration';
        phaseDetail = 'Ventilator delivers a scheduled mandatory breath at the set rate.';
      } else if (phase < imvMXE) {
        var imvME = smoothstep(imvMIE, imvMXE, phase);
        bellows = 1 - imvME; lung = 1 - imvME; volume = 1 - imvME;
        flow = -0.60 * (1 - imvME); pressure = peep + 0.52 * (1 - imvME);
        phaseTitle = 'Mandatory exhalation';
        phaseDetail = 'The mandatory breath ends and the lungs passively empty toward PEEP.';
      } else if (!effort || phase < imvSTS) {
        phaseTitle = 'Inter-breath interval';
        phaseDetail = 'Between mandatory breaths, the patient may breathe spontaneously if effort is on.';
      } else if (phase < imvSIS) {
        spontaneousBreath = true; patientEffort = imvSEff;
        pressure = peep - 0.08 * imvSEff; flow = 0.03 * imvSEff;
        phaseTitle = 'Spontaneous trigger';
        phaseDetail = 'Patient initiates a smaller spontaneous breath between mandatory breaths.';
      } else if (phase < imvSIE) {
        var imvSP = smoothstep(imvSIS, imvSIE, phase);
        spontaneousBreath = true;
        lung = imvSP * 0.48; volume = imvSP * 0.48;
        flow = 0.34 * (1 - 0.35 * imvSP); pressure = peep + 0.12 * imvSP; bellows = 0.02 * imvSP;
        phaseTitle = 'Spontaneous inspiration';
        phaseDetail = 'Smaller spontaneous breath — lower volume and pressure than the mandatory breath.';
      } else if (phase < imvSXE) {
        var imvSE = smoothstep(imvSIE, imvSXE, phase);
        spontaneousBreath = true;
        lung = 0.48 * (1 - imvSE); volume = 0.48 * (1 - imvSE);
        flow = -0.30 * (1 - imvSE); pressure = peep + 0.10 * (1 - imvSE); bellows = 0.02 * (1 - imvSE);
        phaseTitle = 'Spontaneous exhalation';
        phaseDetail = 'The spontaneous breath ends; next mandatory breath will arrive on schedule.';
      }
    }

    // ── APRV ──
    if (mode === 'APRV') {
      var apRelS = 0.78, apLowS = 0.88, apRepS = 0.95;
      var apPH = peep + 0.78, apHL = 0.82, apHB = 0.62;
      if (phase < apRelS) {
        machineBreath = true; pressure = apPH; flow = 0.005;
        lung = apHL; volume = apHL; bellows = apHB;
        if (!effort || phase < 0.24 || phase >= 0.56) {
          phaseTitle = 'Phigh hold';
          phaseDetail = 'Long high-pressure hold keeps alveoli recruited and maintains oxygenation.';
        } else if (phase < 0.34) {
          var apBV = bell(phase, 0.29, 0.05);
          spontaneousBreath = true; patientEffort = apBV;
          pressure = apPH - 0.03 * apBV; flow = 0.05 * apBV;
          phaseTitle = 'Patient effort on Phigh';
          phaseDetail = 'Patient begins a spontaneous breath while at the high-pressure baseline.';
        } else if (phase < 0.45) {
          var apSP = smoothstep(0.34, 0.45, phase);
          spontaneousBreath = true; patientEffort = 0.30;
          flow = 0.14 * (1 - 0.35 * apSP);
          lung = apHL + 0.12 * apSP; volume = lung; bellows = apHB + 0.08 * apSP;
          phaseTitle = 'Spontaneous inspiration';
          phaseDetail = 'Extra patient breath adds volume on top of the Phigh baseline.';
        } else {
          var apSE = smoothstep(0.45, 0.56, phase);
          spontaneousBreath = true;
          flow = -0.12 * (1 - apSE);
          lung = apHL + 0.12 * (1 - apSE); volume = lung; bellows = apHB + 0.08 * (1 - apSE);
          phaseTitle = 'Spontaneous exhalation';
          phaseDetail = 'Patient exhales back to the Phigh baseline before the next release.';
        }
      } else if (phase < apLowS) {
        var apR = smoothstep(apRelS, apLowS, phase);
        releaseValve = 0.45 + 0.55 * apR;
        pressure = apPH * (1 - apR) + peep * apR;
        flow = -0.95 * (0.55 + 0.45 * Math.sin((Math.PI * apR) / 2));
        lung = apHL - 0.24 * apR; volume = lung; bellows = apHB - 0.18 * apR;
        phaseTitle = 'Release';
        phaseDetail = 'Pressure drops rapidly to Plow; gas exits to clear CO₂.';
      } else if (phase < apRepS) {
        var apLE = smoothstep(apLowS, apRepS, phase);
        releaseValve = 1; pressure = peep;
        flow = -0.58 * (1 - apLE); lung = 0.58 - 0.08 * apLE; volume = lung; bellows = 0.44 - 0.08 * apLE;
        phaseTitle = 'Tlow';
        phaseDetail = 'Brief low-pressure time prevents full collapse — intrinsic PEEP is preserved.';
      } else {
        var apR2 = smoothstep(apRepS, 1, phase);
        machineBreath = true; releaseValve = 1 - apR2;
        pressure = peep + 0.78 * apR2; flow = 0.10 * Math.sin(Math.PI * apR2);
        lung = 0.50 + 0.32 * apR2; volume = lung; bellows = 0.36 + 0.26 * apR2;
        phaseTitle = 'Return to Phigh';
        phaseDetail = 'Ventilator rapidly restores the high-pressure hold for the next cycle.';
      }
    }

    // ── PSV ──
    if (mode === 'PSV') {
      var psvEff = effort ? bell(phase, 0.10, 0.09) : 0;
      patientEffort = psvEff;
      if (phase < 0.16 && psvEff > 0.15) {
        pressure = peep - 0.12 * psvEff; flow = 0.05;
        phaseTitle = 'Patient initiates breath';
        phaseDetail = 'Patient effort drops airway pressure slightly, triggering pressure support delivery.';
      } else if (phase < 0.42) {
        var psvP = smoothstep(0.15, 0.42, phase);
        var psvFill = 1 - Math.exp(-2.4 * (phase / 0.42));
        machineBreath = true; spontaneousBreath = true;
        flow = 0.78 * Math.exp(-2.0 * (phase / 0.42));
        pressure = peep + 0.54 * psvP; lung = psvFill; volume = psvFill; bellows = psvFill * 0.68;
        phaseTitle = 'Pressure-supported inspiration';
        phaseDetail = 'Ventilator augments the patient effort; the patient still controls depth and timing.';
      } else if (phase < 0.58) {
        machineBreath = true; spontaneousBreath = true;
        pressure = peep + 0.52; flow = 0.06; lung = 1; volume = 1; bellows = 0.68;
        phaseTitle = 'Flow cycle-off';
        phaseDetail = 'Declining inspiratory flow prepares the ventilator to cycle off support.';
      } else if (phase < 0.88) {
        var psvE = smoothstep(0.58, 0.88, phase);
        pressure = peep + 0.38 * (1 - psvE); flow = -0.60 * (1 - psvE);
        lung = 1 - psvE; volume = 1 - psvE; bellows = 0.68 * (1 - psvE);
        phaseTitle = 'Passive exhalation';
        phaseDetail = 'Support ends; passive exhalation occurs before the patient initiates the next breath.';
      } else {
        phaseTitle = 'Awaiting trigger';
        phaseDetail = 'No new breath until the patient makes another effort — rate is entirely patient-driven.';
      }
    }

    var dDir = flow > 0.12 ? 'down' : flow < -0.10 ? 'up' : 'neutral';
    return {
      phase: phase, pressure: clamp(pressure, -0.2, 1.05), flow: clamp(flow, -1, 1),
      volume: clamp(volume, 0, 1.05), lung: clamp(lung, 0, 1.05), bellows: clamp(bellows, 0, 1),
      patientEffort: clamp(patientEffort, 0, 1), machineBreath: machineBreath,
      spontaneousBreath: spontaneousBreath, releaseValve: clamp(releaseValve, 0, 1),
      diaphragmDir: dDir, phaseTitle: phaseTitle, phaseDetail: phaseDetail,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // CANVAS UTILITIES
  // ─────────────────────────────────────────────────────────────
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function sizeCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var rect = canvas.getBoundingClientRect();
    var cw = Math.round(rect.width * dpr), ch = Math.round(rect.height * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    return { dpr: dpr, w: rect.width, h: rect.height };
  }

  function prepCtxCrisp(ctx) {
    if (ctx.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = true;
      if (ctx.imageSmoothingQuality !== undefined) ctx.imageSmoothingQuality = 'high';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SCENE DRAWING
  // ─────────────────────────────────────────────────────────────
  function drawScene(canvas, st, mode) {
    var sz = sizeCanvas(canvas);
    if (!sz.w || !sz.h) return;
    var ctx = canvas.getContext('2d');
    prepCtxCrisp(ctx);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var sc = Math.min(canvas.width / VB_W, canvas.height / VB_H);
    ctx.save();
    ctx.scale(sc, sc);
    ctx.translate((canvas.width / sc - VB_W) / 2, (canvas.height / sc - VB_H) / 2);
    ctx.translate(SCENE_OX, SCENE_DY + SCENE_VIS_NUDGE_Y);

    // Background
    ctx.fillStyle = '#020617';
    var bgPad = SCENE_DY - SCENE_VIS_NUDGE_Y;
    ctx.fillRect(0, -bgPad, VB_W, VB_H);
    var bgr = ctx.createRadialGradient(VB_W * 0.55, VB_H * 0.72, 10, VB_W * 0.55, VB_H * 0.72, VB_W * 0.42);
    bgr.addColorStop(0, 'rgba(45,212,191,0.13)'); bgr.addColorStop(1, 'transparent');
    ctx.fillStyle = bgr; ctx.fillRect(0, -bgPad, VB_W, VB_H);

    var flowOp = Math.max(Math.abs(st.flow), st.releaseValve * 0.9);
    var insp = st.flow >= 0;

    _sBellows(ctx, st);
    _sTube(ctx, st, flowOp, insp);
    _sLungs(ctx, st, mode);
    _sDiaphragm(ctx, st);
    ctx.restore();
  }

  /** Label shown above lungs during patient-triggered / spontaneous / effort phases */
  function _patientStickerLabel(st, mode) {
    var t = st.phaseTitle || '';
    if (t === 'Backup time trigger') return null;
    if (t === 'Patient trigger' || t === 'Patient initiates breath') return 'Patient trigger';
    if (t === 'Patient effort on Phigh') return 'Patient effort';
    if (t === 'Pressure-supported inspiration' || t === 'Flow cycle-off') return 'Patient effort';
    if (/Spontaneous/i.test(t)) return 'Spontaneous';
    if (st.spontaneousBreath && !st.machineBreath) return 'Spontaneous';
    if (st.spontaneousBreath && mode === 'PSV') return 'Patient effort';
    return null;
  }

  function _drawPatientBreathSticker(ctx, st, mode) {
    var label = _patientStickerLabel(st, mode);
    if (!label) return;
    ctx.save();
    ctx.font = '600 11px ' + FONT;
    var tw = ctx.measureText(label).width;
    var padX = 11, h = 22;
    var w = tw + padX * 2;
    var cx = AX;
    var y = 72;
    var x = cx - w / 2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    rrect(ctx, x, y, w, h, 9);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(251, 191, 36, 0.98)');
    g.addColorStop(1, 'rgba(245, 158, 11, 0.92)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.85)';
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#422006';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, y + h / 2);
    ctx.restore();
  }

  function _sBellows(ctx, st) {
    var bx = BELLOW_X, ym = BELLOW_YM, bw = BELLOW_W;
    var bTop = ym - BELLOW_HALF, bBot = ym + BELLOW_HALF;
    var comp = st.bellows * BELLOW_COMP;
    var topY = bTop + comp, botY = bBot - comp;
    var bodyY = topY + 14, bodyH = Math.max(24, botY - topY - 28);
    ctx.save();
    var mg = ctx.createLinearGradient(bx, topY, bx + bw, topY + 14);
    mg.addColorStop(0, '#cbd5e1'); mg.addColorStop(0.45, '#64748b'); mg.addColorStop(1, '#1e293b');
    rrect(ctx, bx, topY, bw, 14, 4);
    ctx.fillStyle = mg; ctx.fill();
    ctx.strokeStyle = 'rgba(203,213,225,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
    var bg = ctx.createLinearGradient(bx, bodyY, bx, bodyY + bodyH);
    bg.addColorStop(0, '#164e63'); bg.addColorStop(0.45, '#0f766e'); bg.addColorStop(1, '#042f2e');
    rrect(ctx, bx + 6, bodyY, bw - 12, bodyH, 12);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = 'rgba(103,232,249,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(153,246,228,0.6)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (var i = 1; i <= 6; i++) {
      var py = bodyY + (i * bodyH) / 7;
      ctx.beginPath(); ctx.moveTo(bx + 18, py); ctx.lineTo(bx + bw - 18, py); ctx.stroke();
    }
    rrect(ctx, bx, botY - 14, bw, 14, 4);
    ctx.fillStyle = mg; ctx.fill();
    ctx.strokeStyle = 'rgba(203,213,225,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
    rrect(ctx, bx + bw - 2, ym - 8, 18, 16, 3);
    ctx.fillStyle = '#0f172a'; ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.45)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(94,234,212,0.6)'; ctx.lineWidth = 2;
    var bTopRest = ym - BELLOW_HALF;
    var bBotRest = ym + BELLOW_HALF;
    var tickTop = bTopRest + 14;
    var tickBot = bBotRest - 14;
    var tickSpan = Math.max(18, tickBot - tickTop);
    for (var j = 0; j < 5; j++) {
      var ty = tickTop + ((j + 0.5) / 5) * tickSpan;
      ctx.beginPath(); ctx.moveTo(bx + bw + 13, ty); ctx.lineTo(bx + bw + 22, ty); ctx.stroke();
    }
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText('bellows', bx + bw / 2, bBot + 24);
    ctx.restore();
  }

  function _sTube(ctx, st, flowOp, insp) {
    ctx.save(); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(TUBE_START, TUBE_Y); ctx.lineTo(TUBE_END, TUBE_Y);
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 30; ctx.stroke();
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 22; ctx.stroke();
    var fc = insp ? '#5eead4' : '#fb7185';
    ctx.strokeStyle = fc; ctx.lineWidth = 6;
    ctx.globalAlpha = 0.12 + flowOp * 0.76;
    ctx.shadowColor = fc; ctx.shadowBlur = 8; ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    var pColor = insp ? '#99f6e4' : '#fecdd3';
    [0.10, 0.28, 0.46, 0.64, 0.82].forEach(function (base) {
      var t = (((base + st.phase * (insp ? 1 : -1)) % 1) + 1) % 1;
      var px = TUBE_START + t * (TUBE_END - TUBE_START);
      ctx.beginPath(); ctx.arc(px, TUBE_Y, 3 + flowOp * 2, 0, Math.PI * 2);
      ctx.fillStyle = pColor; ctx.globalAlpha = flowOp;
      ctx.shadowColor = pColor; ctx.shadowBlur = 6; ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.globalAlpha = flowOp;
    ctx.strokeStyle = insp ? '#99f6e4' : '#fecdd3'; ctx.lineWidth = 4;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 5;
    var seg = TUBE_END - TUBE_START;
    var arrMid = TUBE_START + seg * 0.38;
    var tyA = TUBE_Y;
    ctx.beginPath();
    if (insp) {
      ctx.moveTo(arrMid, tyA - 7); ctx.lineTo(arrMid + 15, tyA); ctx.lineTo(arrMid, tyA + 7);
    } else {
      ctx.moveTo(arrMid + 15, tyA - 7); ctx.lineTo(arrMid, tyA); ctx.lineTo(arrMid + 15, tyA + 7);
    }
    ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.restore();
  }

  function _sLungs(ctx, st, mode) {
    ctx.save();
    ctx.translate(0, LUNG_VERT);
    var ls = 1 + st.lung * 0.105;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(AX, 118); ctx.lineTo(AX, 156); ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(AX, 156); ctx.bezierCurveTo(AX - 16, 168, AX - 35, 186, AX - 56, 210); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(AX, 156); ctx.bezierCurveTo(AX + 16, 168, AX + 35, 186, AX + 56, 210); ctx.stroke();
    ctx.beginPath(); ctx.arc(AX, 156, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0'; ctx.fill();
    [LCX, RCX].forEach(function (cx) {
      ctx.save(); ctx.translate(cx, 172); ctx.scale(ls, ls); ctx.translate(-cx, -172);
      _sOneLung(ctx, st, cx === LCX); ctx.restore();
    });
    _drawPatientBreathSticker(ctx, st, mode);
    ctx.restore();
  }

  function _sOneLung(ctx, st, isLeft) {
    ctx.save();
    ctx.translate(LUNG_DX, 0);
    var pStr = isLeft
      ? 'M548 108 C512 110,488 140,491 185 C495 232,525 263,564 254 C594 248,588 202,576 170 C565 140,573 112,548 108 Z'
      : 'M650 108 C686 110,710 140,707 185 C703 232,673 263,634 254 C604 248,610 202,622 170 C633 140,625 112,650 108 Z';
    var lp = new Path2D(pStr);
    var lg = ctx.createLinearGradient(488, 108, 660, 263);
    lg.addColorStop(0, '#fecaca'); lg.addColorStop(0.55, '#fb7185'); lg.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = lg; ctx.fill(lp);
    ctx.strokeStyle = '#fecdd3'; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.92; ctx.stroke(lp); ctx.globalAlpha = 1;
    var gg = ctx.createLinearGradient(488, 108, 660, 263);
    gg.addColorStop(0, 'rgba(153,246,228,0.88)'); gg.addColorStop(1, 'rgba(34,211,238,0.18)');
    ctx.fillStyle = gg; ctx.globalAlpha = 0.05 + st.lung * 0.45;
    ctx.shadowColor = '#5eead4'; ctx.shadowBlur = 12; ctx.fill(lp);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(127,29,29,0.35)';
    if (isLeft) {
      ctx.beginPath(); ctx.moveTo(553, 143); ctx.bezierCurveTo(535, 160, 529, 185, 533, 216); ctx.stroke();
      ctx.strokeStyle = 'rgba(254,205,211,0.58)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(573, 171); ctx.bezierCurveTo(557, 181, 545, 195, 539, 216); ctx.stroke();
      ctx.beginPath(); ctx.arc(573, 171, 4, 0, Math.PI * 2); ctx.fillStyle = '#fecdd3'; ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(645, 143); ctx.bezierCurveTo(663, 160, 669, 185, 665, 216); ctx.stroke();
      ctx.strokeStyle = 'rgba(254,205,211,0.58)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(625, 171); ctx.bezierCurveTo(641, 181, 653, 195, 659, 216); ctx.stroke();
      ctx.beginPath(); ctx.arc(625, 171, 4, 0, Math.PI * 2); ctx.fillStyle = '#fecdd3'; ctx.fill();
    }
    ctx.restore();
  }

  function _sDiaphragm(ctx, st) {
    ctx.save();
    ctx.translate(0, LUNG_VERT);
    ctx.translate(0, -12);
    var off = st.diaphragmDir === 'down' ? 10 : st.diaphragmDir === 'up' ? -6 : 0;
    ctx.save(); ctx.translate(0, off);
    ctx.beginPath(); ctx.moveTo(AX - 104, 288);
    ctx.bezierCurveTo(AX - 58, 306, AX + 58, 306, AX + 104, 288);
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.globalAlpha = 0.65; ctx.stroke();
    ctx.restore();
    var dTxt = st.diaphragmDir === 'down' ? 'Diaphragm descends during inflation'
      : st.diaphragmDir === 'up' ? 'Diaphragm rises during exhalation' : 'Diaphragm near resting position';
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px ' + FONT; ctx.textAlign = 'center';
    ctx.globalAlpha = 0.9; ctx.fillText(dTxt, AX, 356); ctx.globalAlpha = 1;
    if (st.diaphragmDir !== 'neutral') {
      var arrowColor = st.diaphragmDir === 'down' ? '#7dd3fc' : '#fda4af';
      var aOff = st.diaphragmDir === 'down' ? 10 : 0;
      ctx.save(); ctx.translate(0, aOff);
      ctx.strokeStyle = arrowColor; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.9;
      [[AX - 44, AX - 50, AX - 38], [AX + 44, AX + 38, AX + 50]].forEach(function (xs) {
        if (st.diaphragmDir === 'down') {
          ctx.beginPath(); ctx.moveTo(xs[0], 306); ctx.lineTo(xs[0], 320); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(xs[1], 314); ctx.lineTo(xs[0], 321); ctx.lineTo(xs[2], 314); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(xs[0], 318); ctx.lineTo(xs[0], 304); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(xs[1], 310); ctx.lineTo(xs[0], 303); ctx.lineTo(xs[2], 310); ctx.stroke();
        }
      });
      ctx.restore();
    }
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // WAVEFORM DRAWING
  // ─────────────────────────────────────────────────────────────
  function drawWaveform(canvas, mode, seconds, metric, settings) {
    var sz = sizeCanvas(canvas);
    if (!sz.w || !sz.h) return;
    var ctx = canvas.getContext('2d'), W2 = sz.w, H2 = sz.h, dpr = sz.dpr;
    prepCtxCrisp(ctx);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.scale(dpr, dpr);
    ctx.fillStyle = '#020617';
    rrect(ctx, 0, 0, W2, H2, 8);
    ctx.fill();
    var padT = 14, padB = 14;
    var plotH = Math.max(28, H2 - padT - padB);
    var zeroY = metric === 'flow' ? padT + plotH / 2 : H2 - padB;
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(W2, zeroY);
    ctx.strokeStyle = 'rgba(148,163,184,0.18)'; ctx.lineWidth = 1;
    ctx.stroke();
    var cfg = MODES[mode], span = cfg.cycleSec * 1.45, n = 150;
    var wg = ctx.createLinearGradient(0, 0, W2, 0);
    wg.addColorStop(0, 'rgba(56,189,248,0.3)'); wg.addColorStop(0.6, '#2dd4bf'); wg.addColorStop(1, '#a7f3d0');
    ctx.beginPath(); var started = false;
    for (var i = 0; i <= n; i++) {
      var t = seconds - span + (i / n) * span;
      var s = computeState(mode, t, settings);
      var v = s[metric];
      if (metric === 'pressure') v = (v + 0.2) / 1.25;
      else if (metric === 'flow') v = (v + 1) / 2;
      else v = v / 1.05;
      var px = (i / n) * W2;
      var py = padT + (1 - clamp(v)) * plotH;
      if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
    }
    ctx.strokeStyle = wg; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────
  // CONTROLLER
  // ─────────────────────────────────────────────────────────────
  var _mode = 'VCV', _playing = false, _speed = 0.88, _effort = true;
  var _seconds = 0, _lastT = null, _raf = null, _active = false;
  var D = {};   // DOM refs

  function _grabDom() {
    D.dialog   = document.getElementById('vent-modes-tutorial');
    D.scene    = document.getElementById('vma-scene');
    D.wPrs     = document.getElementById('vma-wave-pressure');
    D.wFlow    = document.getElementById('vma-wave-flow');
    D.wVol     = document.getElementById('vma-wave-volume');
    D.modeBtns = document.querySelectorAll('[data-vma-mode]');
    D.modeSel  = document.getElementById('vma-mode-select');
    D.playBtn  = document.getElementById('vma-play');
    D.resetBtn = document.getElementById('vma-reset');
    D.effBtn   = document.getElementById('vma-effort');
    D.spdIn    = document.getElementById('vma-speed');
    D.spdLbl   = document.getElementById('vma-speed-lbl');
    D.mName    = document.getElementById('vma-mode-name');
    D.mSub     = document.getElementById('vma-mode-subtitle');
    D.mCtrl    = document.getElementById('vma-mode-control');
    D.mVary    = document.getElementById('vma-mode-varies');
    D.mTrig    = document.getElementById('vma-mode-trigger');
    D.mTag     = document.getElementById('vma-mode-tag');
    D.phTitle  = document.getElementById('vma-phase-title');
    D.phDetail = document.getElementById('vma-phase-detail');
    D.pilMach  = document.getElementById('vma-pill-machine');
    D.pilSpnt  = document.getElementById('vma-pill-spont');
    D.pilRel   = document.getElementById('vma-pill-release');
    D.quizQ    = document.getElementById('vma-quiz-q');
    D.quizChoices = document.getElementById('vma-quiz-choices');
    D.quizFb   = document.getElementById('vma-quiz-fb');
  }

  function _emitQuizAnswer(idx, correctIdx, ok) {
    try {
      document.dispatchEvent(new CustomEvent('vma_quiz_answer', {
        bubbles: true,
        detail: {
          mode: _mode,
          selected_index: idx,
          correct_index: correctIdx,
          is_correct: ok,
        },
      }));
    } catch (e) { /* ignore */ }
  }

  function _renderQuiz() {
    var q = QUIZZES[_mode];
    if (!q || !D.quizQ || !D.quizChoices) return;
    D.quizQ.textContent = q.q;
    D.quizChoices.innerHTML = '';
    if (D.quizFb) {
      D.quizFb.innerHTML = '';
      D.quizFb.hidden = true;
    }
    q.choices.forEach(function (label, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'vent-tut__quiz-choice';
      b.textContent = label;
      b.addEventListener('click', function onPick() {
        var ok = i === q.correct;
        Array.prototype.forEach.call(D.quizChoices.querySelectorAll('.vent-tut__quiz-choice'), function (btn, bi) {
          btn.disabled = true;
          btn.classList.remove('vent-tut__quiz-choice--correct', 'vent-tut__quiz-choice--wrong');
          if (bi === q.correct) btn.classList.add('vent-tut__quiz-choice--correct');
          else if (bi === i) btn.classList.add('vent-tut__quiz-choice--wrong');
        });
        if (D.quizFb) {
          D.quizFb.hidden = false;
          D.quizFb.innerHTML = ok
            ? '<strong>Correct.</strong> Nice work.'
            : '<strong>Not quite.</strong> Compare with Controlled / Varies / Trigger above.';
        }
        _emitQuizAnswer(i, q.correct, ok);
      });
      D.quizChoices.appendChild(b);
    });
  }

  function _setMode(key) {
    _mode = key; _seconds = 0; _lastT = null;
    _updateInfo();
    _renderQuiz();
    D.modeBtns.forEach(function (b) {
      var on = b.dataset.vmaMode === key;
      b.classList.toggle('vma-mode-btn--active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (D.modeSel && D.modeSel.value !== key) D.modeSel.value = key;
  }

  function _updateInfo() {
    var cfg = MODES[_mode];
    if (D.mName)  D.mName.textContent  = cfg.fullName;
    if (D.mSub)   D.mSub.textContent   = cfg.subtitle;
    if (D.mCtrl)  D.mCtrl.textContent  = cfg.control;
    if (D.mVary)  D.mVary.textContent  = cfg.varies;
    if (D.mTrig)  D.mTrig.textContent  = cfg.trigger;
    if (D.mTag)   {
      D.mTag.textContent = cfg.name;
      D.mTag.style.borderColor = cfg.accent;
      D.mTag.style.color = cfg.accent;
    }
  }

  function _updatePhase(st) {
    if (D.phTitle)  D.phTitle.textContent  = st.phaseTitle;
    if (D.phDetail) D.phDetail.textContent = st.phaseDetail;
    if (D.pilMach) D.pilMach.classList.toggle('vma-pill--on', st.machineBreath);
    if (D.pilSpnt) D.pilSpnt.classList.toggle('vma-pill--on', st.spontaneousBreath);
    if (D.pilRel)  D.pilRel.classList.toggle('vma-pill--on',  st.releaseValve > 0.2);
  }

  function _tick(now) {
    if (!_active) return;
    if (_lastT === null) _lastT = now;
    var dt = (now - _lastT) / 1000; _lastT = now;
    if (_playing) _seconds += dt * _speed;
    var st = computeState(_mode, _seconds, { patientEffort: _effort });
    var cfg = { patientEffort: _effort };
    if (D.scene)  drawScene(D.scene, st, _mode);
    if (D.wPrs)   drawWaveform(D.wPrs,  _mode, _seconds, 'pressure', cfg);
    if (D.wFlow)  drawWaveform(D.wFlow, _mode, _seconds, 'flow',     cfg);
    if (D.wVol)   drawWaveform(D.wVol,  _mode, _seconds, 'volume',   cfg);
    _updatePhase(st);
    _raf = requestAnimationFrame(_tick);
  }

  function _start() {
    if (_raf) cancelAnimationFrame(_raf);
    _active = true; _lastT = null;
    _raf = requestAnimationFrame(_tick);
  }

  function _stop() {
    _active = false;
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    _lastT = null;
  }

  function _open() {
    if (D.dialog && D.dialog.showModal) D.dialog.showModal();
    _playing = true;
    if (D.playBtn) D.playBtn.textContent = 'Pause';
    _start();
  }

  function _close() {
    if (D.dialog && D.dialog.close) D.dialog.close();
    _stop(); _playing = false;
    if (D.playBtn) D.playBtn.textContent = 'Play';
  }

  // ── Vitals monitor teaser (same canvas scene as tutorial, VCV only) ──
  var _teaserEl = null, _teaserT = 0, _teaserLast = null, _teaserRaf = null;
  var _teaserSpeed = 0.88;
  function _teaserTick(now) {
    if (!_teaserEl) return;
    if (_teaserLast === null) _teaserLast = now;
    var dt = (now - _teaserLast) / 1000;
    _teaserLast = now;
    var reduce = false;
    try {
      reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { /* ignore */ }
    if (!reduce) _teaserT += dt * _teaserSpeed;
    var st = computeState('VCV', _teaserT, { patientEffort: true });
    drawScene(_teaserEl, st, 'VCV');
    _teaserRaf = requestAnimationFrame(_teaserTick);
  }
  function _initTeaserScene() {
    var el = document.getElementById('vma-teaser-scene');
    if (!el) return;
    if (_teaserRaf) cancelAnimationFrame(_teaserRaf);
    _teaserEl = el;
    _teaserT = 0;
    _teaserLast = null;
    _teaserRaf = requestAnimationFrame(_teaserTick);
  }

  function init() {
    _grabDom();
    _initTeaserScene();
    if (!D.dialog) return;

    D.modeBtns.forEach(function (b) {
      b.addEventListener('click', function () { _setMode(b.dataset.vmaMode); });
    });
    if (D.modeSel) {
      D.modeSel.addEventListener('change', function () {
        var v = D.modeSel.value;
        if (MODES[v]) _setMode(v);
      });
    }

    if (D.playBtn) {
      D.playBtn.addEventListener('click', function () {
        _playing = !_playing;
        D.playBtn.textContent = _playing ? 'Pause' : 'Play';
        if (_playing) _lastT = null;
      });
    }
    if (D.resetBtn) {
      D.resetBtn.addEventListener('click', function () { _seconds = 0; _lastT = null; });
    }
    if (D.effBtn) {
      D.effBtn.addEventListener('click', function () {
        _effort = !_effort;
        D.effBtn.textContent = 'Effort ' + (_effort ? 'On' : 'Off');
        D.effBtn.classList.toggle('vma-ctrl-btn--amber', _effort);
      });
    }
    if (D.spdIn) {
      D.spdIn.addEventListener('input', function () {
        _speed = parseFloat(D.spdIn.value);
        if (D.spdLbl) D.spdLbl.textContent = _speed.toFixed(2) + '×';
      });
    }

    var openBtn = document.getElementById('vent-modes-tutorial-open');
    if (openBtn) openBtn.addEventListener('click', _open);

    document.querySelectorAll('[data-vma-close]').forEach(function (b) {
      b.addEventListener('click', _close);
    });

    D.dialog.addEventListener('click', function (e) { if (e.target === D.dialog) _close(); });
    D.dialog.addEventListener('close', function () { _stop(); _playing = false; if (D.playBtn) D.playBtn.textContent = 'Play'; });

    _setMode('VCV');
    _updateInfo();
    if (D.spdIn && D.spdLbl) {
      _speed = parseFloat(D.spdIn.value);
      D.spdLbl.textContent = _speed.toFixed(2) + '×';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
