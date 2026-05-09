import React, { useEffect, useMemo, useRef, useState } from "react";

const MODES = {
  VCV: {
    name: "VCV",
    fullName: "Volume Control Ventilation",
    subtitle: "Ventilator guarantees tidal volume; pressure varies with compliance and resistance.",
    control: "Tidal volume + inspiratory flow pattern",
    varies: "Airway pressure",
    trigger: "Machine-triggered in this teaching view",
    cycleSec: 8.5,
    color: "from-cyan-400 to-teal-300",
  },
  PCV: {
    name: "PCV",
    fullName: "Pressure Control Ventilation",
    subtitle: "Ventilator targets inspiratory pressure; tidal volume varies with mechanics.",
    control: "Inspiratory pressure",
    varies: "Tidal volume + flow",
    trigger: "Machine-triggered in this teaching view",
    cycleSec: 8.5,
    color: "from-sky-400 to-indigo-300",
  },
  AC: {
    name: "A/C",
    fullName: "Assist-Control Ventilation",
    subtitle: "Every detected patient trigger receives a full mandatory-sized breath.",
    control: "Full supported breath after trigger",
    varies: "Timing depends on patient trigger or backup rate",
    trigger: "Patient or machine",
    cycleSec: 8.5,
    color: "from-emerald-400 to-lime-300",
  },
  IMV: {
    name: "SIMV / IMV",
    fullName: "Intermittent Mandatory Ventilation",
    subtitle: "Scheduled mandatory breaths occur, with spontaneous breaths allowed between them.",
    control: "Scheduled mandatory breaths",
    varies: "Spontaneous breath timing and size",
    trigger: "Machine + patient",
    cycleSec: 11.0,
    color: "from-amber-300 to-orange-300",
  },
  APRV: {
    name: "APRV",
    fullName: "Airway Pressure Release Ventilation",
    subtitle: "Long Phigh hold with brief pressure releases for ventilation. Spontaneous breaths may occur on Phigh.",
    control: "Phigh, Thigh, Plow, Tlow",
    varies: "Release volume + spontaneous tidal volume",
    trigger: "Time-cycled release; spontaneous breathing can occur on Phigh",
    cycleSec: 13.5,
    color: "from-fuchsia-400 to-rose-300",
  },
  PSV: {
    name: "PSV",
    fullName: "Pressure Support Ventilation",
    subtitle: "Patient initiates each breath; ventilator adds pressure support.",
    control: "Support pressure",
    varies: "Rate, inspiratory time, and tidal volume",
    trigger: "Patient-triggered only in this teaching view",
    cycleSec: 8.0,
    color: "from-violet-400 to-purple-300",
  },
};

const MODE_KEYS = Object.keys(MODES);
const TUBE_Y = 190;
const TUBE_START = 256;
const TUBE_END = 510;
const LUNG_LEFT_CENTER = 548;
const LUNG_RIGHT_CENTER = 650;
const AIRWAY_X = (LUNG_LEFT_CENTER + LUNG_RIGHT_CENTER) / 2;
const OPTIONAL_CYCLE_SEC = { IMV: 6.4, APRV: 8.0 };

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function bell(x, center, width) {
  const d = Math.abs(x - center) / width;
  return clamp(1 - d * d, 0, 1);
}

function buildPhase(title, detail) {
  return { phaseTitle: title, phaseDetail: detail };
}

function computeState(mode, seconds, settings = {}) {
  const cfg = MODES[mode];
  const phase = (((seconds % cfg.cycleSec) + cfg.cycleSec) % cfg.cycleSec) / cfg.cycleSec;
  const patientEffortOn = settings.patientEffort ?? true;
  const separateOptionalBreath = settings.separateOptionalBreath ?? false;
  const peep = 0.12;

  let pressure = peep;
  let flow = 0;
  let volume = 0;
  let lung = 0;
  let bellows = 0;
  let patientEffort = 0;
  let machineBreath = false;
  let spontaneousBreath = false;
  let releaseValve = 0;
  let phaseText = buildPhase(
    "Baseline / PEEP",
    "End-expiratory pressure maintains resting lung volume before the next breath."
  );

  if (mode === "VCV") {
    if (phase < 0.34) {
      const p = smoothstep(0, 0.34, phase);
      machineBreath = true;
      bellows = p;
      lung = p;
      volume = p;
      flow = 0.76;
      pressure = peep + 0.18 + 0.62 * Math.pow(p, 1.3);
      phaseText = buildPhase("VCV inspiration", "Fixed flow delivers the set tidal volume; pressure rises with mechanics.");
    } else if (phase < 0.50) {
      machineBreath = true;
      bellows = 1;
      lung = 1;
      volume = 1;
      flow = 0.02;
      pressure = peep + 0.82;
      phaseText = buildPhase("Inspiratory pause", "Flow approaches zero while volume is briefly held.");
    } else if (phase < 0.84) {
      const e = smoothstep(0.50, 0.84, phase);
      bellows = 1 - e;
      lung = 1 - e;
      volume = 1 - e;
      flow = -0.64 * (1 - e);
      pressure = peep + 0.55 * (1 - e);
      phaseText = buildPhase("Passive exhalation", "Elastic recoil drives gas out through the expiratory valve.");
    }
  }

  if (mode === "PCV") {
    if (phase < 0.38) {
      const pressureRise = smoothstep(0, 0.10, phase);
      const fill = 1 - Math.exp(-3.0 * (phase / 0.38));
      machineBreath = true;
      pressure = peep + 0.78 * pressureRise;
      flow = 0.92 * Math.exp(-2.3 * (phase / 0.38));
      lung = fill;
      volume = fill;
      bellows = fill * 0.88;
      phaseText = buildPhase("PCV inspiration", "Pressure rapidly reaches target; flow decelerates as the lung fills.");
    } else if (phase < 0.56) {
      machineBreath = true;
      pressure = peep + 0.78;
      flow = 0.03;
      lung = 1;
      volume = 1;
      bellows = 0.88;
      phaseText = buildPhase("Pressure hold", "Delivered volume depends on compliance, resistance, and inspiratory time.");
    } else if (phase < 0.86) {
      const e = smoothstep(0.56, 0.86, phase);
      pressure = peep + 0.70 * (1 - e);
      flow = -0.64 * (1 - e);
      lung = 1 - e;
      volume = 1 - e;
      bellows = 0.88 * (1 - e);
      phaseText = buildPhase("Passive exhalation", "Pressure falls toward PEEP as expiratory flow leaves the lungs.");
    }
  }

  if (mode === "AC") {
    const triggerStart = patientEffortOn ? 0.06 : 0.0;
    const triggerEnd = patientEffortOn ? 0.18 : 0.08;
    const inspEnd = 0.43;
    const holdEnd = 0.55;
    const exhaleEnd = 0.84;
    const triggerEffort = patientEffortOn ? bell(phase, (triggerStart + triggerEnd) / 2, 0.085) : 0;

    if (phase < triggerStart) {
      phaseText = buildPhase("Waiting window", "The ventilator waits for a trigger or backup mandatory timing.");
    } else if (phase < triggerEnd) {
      patientEffort = triggerEffort;
      pressure = patientEffortOn ? peep - 0.12 * triggerEffort : peep;
      flow = patientEffortOn ? 0.03 * triggerEffort : 0;
      phaseText = patientEffortOn
        ? buildPhase("Patient trigger", "Patient effort creates a small negative-pressure deflection.")
        : buildPhase("Backup time trigger", "No effort is shown; the ventilator initiates the breath.");
    } else if (phase < inspEnd) {
      const p = smoothstep(triggerEnd, inspEnd, phase);
      machineBreath = true;
      bellows = p;
      lung = p;
      volume = p;
      flow = 0.76;
      pressure = peep + 0.18 + 0.62 * Math.pow(p, 1.25);
      phaseText = buildPhase("Full assisted inspiration", "After trigger, assist-control gives a full mandatory-sized breath.");
    } else if (phase < holdEnd) {
      machineBreath = true;
      bellows = 1;
      lung = 1;
      volume = 1;
      flow = 0.02;
      pressure = peep + 0.82;
      phaseText = buildPhase("End-inspiratory hold", "The supported breath is complete before exhalation begins.");
    } else if (phase < exhaleEnd) {
      const e = smoothstep(holdEnd, exhaleEnd, phase);
      bellows = 1 - e;
      lung = 1 - e;
      volume = 1 - e;
      flow = -0.64 * (1 - e);
      pressure = peep + 0.55 * (1 - e);
      phaseText = buildPhase("Passive exhalation", "Support cycles off and the patient exhales passively.");
    }
  }

  if (mode === "IMV") {
    const mandatoryInspEnd = 0.28;
    const mandatoryExhaleEnd = 0.50;
    const spontTriggerStart = 0.58;
    const spontInspStart = 0.74;
    const spontInspEnd = 0.84;
    const spontExhaleEnd = 0.95;
    const embedOptionalBreath = patientEffortOn && !separateOptionalBreath;
    const spontEffort = embedOptionalBreath ? bell(phase, (spontTriggerStart + spontInspStart) / 2, 0.085) : 0;

    if (phase < mandatoryInspEnd) {
      const p = smoothstep(0, mandatoryInspEnd, phase);
      machineBreath = true;
      bellows = p;
      lung = p;
      volume = p;
      flow = 0.72;
      pressure = peep + 0.18 + 0.54 * Math.pow(p, 1.2);
      phaseText = buildPhase("Scheduled mandatory inspiration", "Ventilator delivers a scheduled mandatory breath.");
    } else if (phase < mandatoryExhaleEnd) {
      const e = smoothstep(mandatoryInspEnd, mandatoryExhaleEnd, phase);
      bellows = 1 - e;
      lung = 1 - e;
      volume = 1 - e;
      flow = -0.60 * (1 - e);
      pressure = peep + 0.52 * (1 - e);
      phaseText = buildPhase("Mandatory exhalation", "The mandatory breath ends and the lungs passively empty.");
    } else if (!embedOptionalBreath || phase < spontTriggerStart) {
      phaseText = buildPhase("Inter-breath interval", "Between mandatory breaths, spontaneous breathing may occur.");
    } else if (phase < spontInspStart) {
      spontaneousBreath = true;
      patientEffort = spontEffort;
      pressure = peep - 0.08 * spontEffort;
      flow = 0.03 * spontEffort;
      phaseText = buildPhase("Spontaneous trigger", "The patient initiates one smaller spontaneous breath.");
    } else if (phase < spontInspEnd) {
      const p = smoothstep(spontInspStart, spontInspEnd, phase);
      spontaneousBreath = true;
      lung = p * 0.48;
      volume = p * 0.48;
      flow = 0.34 * (1 - 0.35 * p);
      pressure = peep + 0.12 * p;
      bellows = 0.02 * p;
      phaseText = buildPhase("Spontaneous inspiration", "Patient breathes between mandatory breaths.");
    } else if (phase < spontExhaleEnd) {
      const e = smoothstep(spontInspEnd, spontExhaleEnd, phase);
      spontaneousBreath = true;
      lung = 0.48 * (1 - e);
      volume = 0.48 * (1 - e);
      flow = -0.30 * (1 - e);
      pressure = peep + 0.10 * (1 - e);
      bellows = 0.02 * (1 - e);
      phaseText = buildPhase("Spontaneous exhalation", "The spontaneous breath ends before the next scheduled breath.");
    }
  }

  if (mode === "APRV") {
    const releaseStart = 0.78;
    const lowHoldStart = 0.88;
    const repressurizeStart = 0.95;
    const pHighPressure = peep + 0.78;
    const pHighLung = 0.82;
    const pHighBellows = 0.62;
    const embedOptionalBreath = patientEffortOn && !separateOptionalBreath;

    if (phase < releaseStart) {
      machineBreath = true;
      pressure = pHighPressure;
      flow = 0.005;
      lung = pHighLung;
      volume = pHighLung;
      bellows = pHighBellows;

      if (!embedOptionalBreath || phase < 0.24 || phase >= 0.56) {
        phaseText = buildPhase("Phigh hold", "Long high-pressure hold keeps alveoli recruited.");
      } else if (phase < 0.34) {
        const e = bell(phase, 0.29, 0.05);
        spontaneousBreath = true;
        patientEffort = e;
        pressure = pHighPressure - 0.03 * e;
        flow = 0.05 * e;
        phaseText = buildPhase("Patient effort", "Patient begins a spontaneous breath on Phigh.");
      } else if (phase < 0.45) {
        const p = smoothstep(0.34, 0.45, phase);
        spontaneousBreath = true;
        patientEffort = 0.30;
        flow = 0.14 * (1 - 0.35 * p);
        lung = pHighLung + 0.12 * p;
        volume = lung;
        bellows = pHighBellows + 0.08 * p;
        phaseText = buildPhase("Spontaneous inspiration", "Extra patient breath occurs on top of Phigh.");
      } else {
        const e = smoothstep(0.45, 0.56, phase);
        spontaneousBreath = true;
        flow = -0.12 * (1 - e);
        lung = pHighLung + 0.12 * (1 - e);
        volume = lung;
        bellows = pHighBellows + 0.08 * (1 - e);
        phaseText = buildPhase("Spontaneous exhalation", "Patient exhales back to the Phigh baseline.");
      }
    } else if (phase < lowHoldStart) {
      const r = smoothstep(releaseStart, lowHoldStart, phase);
      releaseValve = 0.45 + 0.55 * r;
      pressure = pHighPressure * (1 - r) + peep * r;
      flow = -0.95 * (0.55 + 0.45 * Math.sin((Math.PI * r) / 2));
      lung = pHighLung - 0.24 * r;
      volume = lung;
      bellows = pHighBellows - 0.18 * r;
      phaseText = buildPhase("Release", "Pressure drops to Plow; gas exits for CO₂ clearance.");
    } else if (phase < repressurizeStart) {
      const e = smoothstep(lowHoldStart, repressurizeStart, phase);
      releaseValve = 1;
      pressure = peep;
      flow = -0.58 * (1 - e);
      lung = 0.58 - 0.08 * e;
      volume = lung;
      bellows = 0.44 - 0.08 * e;
      phaseText = buildPhase("Tlow", "Brief low-pressure time prevents full lung emptying.");
    } else {
      const r = smoothstep(repressurizeStart, 1, phase);
      machineBreath = true;
      releaseValve = 1 - r;
      pressure = peep + 0.78 * r;
      flow = 0.10 * Math.sin(Math.PI * r);
      lung = 0.50 + 0.32 * r;
      volume = lung;
      bellows = 0.36 + 0.26 * r;
      phaseText = buildPhase("Return to Phigh", "Ventilator rapidly restores the high-pressure hold.");
    }
  }

  if (mode === "PSV") {
    const effort = patientEffortOn ? bell(phase, 0.10, 0.09) : 0;
    patientEffort = effort;

    if (phase < 0.16 && effort > 0.15) {
      pressure = peep - 0.12 * effort;
      flow = 0.05;
      phaseText = buildPhase("Patient initiates breath", "Patient effort triggers pressure support.");
    } else if (phase < 0.42) {
      const p = smoothstep(0.15, 0.42, phase);
      const fill = 1 - Math.exp(-2.4 * (phase / 0.42));
      machineBreath = true;
      spontaneousBreath = true;
      flow = 0.78 * Math.exp(-2.0 * (phase / 0.42));
      pressure = peep + 0.54 * p;
      lung = fill;
      volume = fill;
      bellows = fill * 0.68;
      phaseText = buildPhase("Pressure-supported inspiration", "Ventilator adds support while the patient controls timing.");
    } else if (phase < 0.58) {
      machineBreath = true;
      spontaneousBreath = true;
      pressure = peep + 0.52;
      flow = 0.06;
      lung = 1;
      volume = 1;
      bellows = 0.68;
      phaseText = buildPhase("Flow cycle-off", "Declining inspiratory flow prepares the ventilator to cycle off.");
    } else if (phase < 0.88) {
      const e = smoothstep(0.58, 0.88, phase);
      pressure = peep + 0.38 * (1 - e);
      flow = -0.60 * (1 - e);
      lung = 1 - e;
      volume = 1 - e;
      bellows = 0.68 * (1 - e);
      phaseText = buildPhase("Passive exhalation", "Support ends and exhalation occurs before the next trigger.");
    } else {
      phaseText = buildPhase("Awaiting trigger", "No new assisted breath occurs until the patient initiates another breath.");
    }
  }

  const diaphragmDirection = flow > 0.12 ? "down" : flow < -0.10 ? "up" : "neutral";
  const diaphragmText =
    diaphragmDirection === "down"
      ? "Diaphragm descends during inflation"
      : diaphragmDirection === "up"
      ? "Diaphragm rises during exhalation"
      : "Diaphragm near resting position";

  return {
    phase,
    pressure: clamp(pressure, -0.2, 1.05),
    flow: clamp(flow, -1, 1),
    volume: clamp(volume, 0, 1.05),
    lung: clamp(lung, 0, 1.05),
    bellows: clamp(bellows, 0, 1),
    patientEffort: clamp(patientEffort, 0, 1),
    machineBreath,
    spontaneousBreath,
    releaseValve: clamp(releaseValve, 0, 1),
    diaphragmDirection,
    diaphragmText,
    ...phaseText,
  };
}

function modeSupportsSeparateOptionalBreath(mode) {
  return mode === "IMV" || mode === "APRV";
}

function computeOptionalBreathState(mode, seconds, settings = {}) {
  const patientEffortOn = settings.patientEffort ?? true;
  const cycleSec = OPTIONAL_CYCLE_SEC[mode] ?? 6.0;
  const phase = (((seconds % cycleSec) + cycleSec) % cycleSec) / cycleSec;
  const peep = 0.12;

  let pressure = peep;
  let flow = 0;
  let volume = 0;
  let lung = 0;
  let bellows = 0;
  let patientEffort = 0;
  let machineBreath = false;
  let spontaneousBreath = false;
  let releaseValve = 0;
  let phaseText = buildPhase("Optional spontaneous breath demo", "This isolates the optional spontaneous breath apart from the main cycle.");

  if (!modeSupportsSeparateOptionalBreath(mode) || !patientEffortOn) {
    return {
      phase,
      pressure: peep,
      flow: 0,
      volume: 0,
      lung: 0,
      bellows: 0,
      patientEffort: 0,
      machineBreath: false,
      spontaneousBreath: false,
      releaseValve: 0,
      diaphragmDirection: "neutral",
      diaphragmText: "Diaphragm near resting position",
      ...phaseText,
    };
  }

  if (mode === "IMV") {
    if (phase < 0.18) {
      phaseText = buildPhase("Inter-breath interval", "No mandatory breath is happening.");
    } else if (phase < 0.38) {
      const e = bell(phase, 0.28, 0.10);
      spontaneousBreath = true;
      patientEffort = e;
      pressure = peep - 0.08 * e;
      flow = 0.03 * e;
      phaseText = buildPhase("Spontaneous trigger", "Patient initiates a spontaneous breath between mandatory breaths.");
    } else if (phase < 0.60) {
      const p = smoothstep(0.38, 0.60, phase);
      spontaneousBreath = true;
      lung = p * 0.48;
      volume = p * 0.48;
      flow = 0.34 * (1 - 0.35 * p);
      pressure = peep + 0.12 * p;
      bellows = 0.02 * p;
      phaseText = buildPhase("Spontaneous inspiration", "This optional breath is smaller than the mandatory breath.");
    } else if (phase < 0.82) {
      const e = smoothstep(0.60, 0.82, phase);
      spontaneousBreath = true;
      lung = 0.48 * (1 - e);
      volume = 0.48 * (1 - e);
      flow = -0.30 * (1 - e);
      pressure = peep + 0.10 * (1 - e);
      bellows = 0.02 * (1 - e);
      phaseText = buildPhase("Spontaneous exhalation", "Patient exhales before the next mandatory breath.");
    } else {
      phaseText = buildPhase("Inter-breath interval", "The spontaneous breath is complete.");
    }
  }

  if (mode === "APRV") {
    machineBreath = true;
    const pHighPressure = peep + 0.78;
    const pHighLung = 0.82;
    const pHighBellows = 0.62;

    pressure = pHighPressure;
    lung = pHighLung;
    volume = pHighLung;
    bellows = pHighBellows;
    flow = 0.005;

    if (phase < 0.22) {
      phaseText = buildPhase("Phigh baseline", "Lung remains recruited at Phigh.");
    } else if (phase < 0.36) {
      const e = bell(phase, 0.29, 0.07);
      spontaneousBreath = true;
      patientEffort = e;
      pressure = pHighPressure - 0.03 * e;
      flow = 0.05 * e;
      phaseText = buildPhase("Patient effort", "Patient initiates a breath on Phigh.");
    } else if (phase < 0.56) {
      const p = smoothstep(0.36, 0.56, phase);
      spontaneousBreath = true;
      patientEffort = 0.28;
      flow = 0.14 * (1 - 0.35 * p);
      lung = pHighLung + 0.12 * p;
      volume = lung;
      bellows = pHighBellows + 0.08 * p;
      phaseText = buildPhase("Spontaneous inspiration", "Small patient breath adds volume on top of Phigh.");
    } else if (phase < 0.78) {
      const e = smoothstep(0.56, 0.78, phase);
      spontaneousBreath = true;
      flow = -0.12 * (1 - e);
      lung = pHighLung + 0.12 * (1 - e);
      volume = lung;
      bellows = pHighBellows + 0.08 * (1 - e);
      phaseText = buildPhase("Spontaneous exhalation", "Patient exhales back to Phigh baseline.");
    } else {
      phaseText = buildPhase("Phigh baseline", "Breath complete; lung remains recruited.");
    }
  }

  const diaphragmDirection = flow > 0.12 ? "down" : flow < -0.10 ? "up" : "neutral";
  const diaphragmText =
    diaphragmDirection === "down"
      ? "Diaphragm descends during inflation"
      : diaphragmDirection === "up"
      ? "Diaphragm rises during exhalation"
      : "Diaphragm near resting position";

  return {
    phase,
    pressure: clamp(pressure, -0.2, 1.05),
    flow: clamp(flow, -1, 1),
    volume: clamp(volume, 0, 1.05),
    lung: clamp(lung, 0, 1.05),
    bellows: clamp(bellows, 0, 1),
    patientEffort: clamp(patientEffort, 0, 1),
    machineBreath,
    spontaneousBreath,
    releaseValve: clamp(releaseValve, 0, 1),
    diaphragmDirection,
    diaphragmText,
    ...phaseText,
  };
}

function waveformPath(mode, seconds, metric, width, height, settings, resolver = computeState, cycleSecOverride = null) {
  const span = (cycleSecOverride ?? MODES[mode].cycleSec) * 1.45;
  const samples = 150;
  const pts = [];

  for (let i = 0; i <= samples; i += 1) {
    const x = (i / samples) * width;
    const t = seconds - span + (i / samples) * span;
    const s = resolver(mode, t, settings);
    let v = s[metric];

    if (metric === "pressure") v = (v + 0.2) / 1.25;
    if (metric === "flow") v = (v + 1) / 2;
    if (metric === "volume") v = v / 1.05;

    const y = height - clamp(v) * height;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return `M ${pts.join(" L ")}`;
}

function Waveform({ mode, seconds, metric, title, label, settings, resolver = computeState, cycleSecOverride = null }) {
  const width = 360;
  const height = 58;
  const path = waveformPath(mode, seconds, metric, width, height, settings, resolver, cycleSecOverride);
  const zeroY = metric === "flow" ? height / 2 : height - 7;
  const gid = `wave-${metric}-${title.replace(/\W/g, "")}`;

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/80 p-3 shadow-inner">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full overflow-visible">
        <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="rgba(148,163,184,.24)" strokeDasharray="4 5" />
        <defs>
          <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#2dd4bf" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#a7f3d0" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d={path} fill="none" stroke={`url(#${gid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ModeButton({ id, active, onClick }) {
  const cfg = MODES[id];
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`rounded-2xl border px-3 py-2 text-left transition-all ${
        active
          ? "border-teal-300/80 bg-teal-300/10 shadow-lg shadow-teal-950/40"
          : "border-slate-700/80 bg-slate-900/70 hover:border-slate-500 hover:bg-slate-800/90"
      }`}
    >
      <div className="text-sm font-bold text-slate-100">{cfg.name}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{cfg.fullName}</div>
    </button>
  );
}

function StatusPill({ active, children, tone = "teal" }) {
  const tones = {
    teal: active ? "border-teal-300/70 bg-teal-300/15 text-teal-100" : "border-slate-700 bg-slate-900/70 text-slate-500",
    amber: active ? "border-amber-300/70 bg-amber-300/15 text-amber-100" : "border-slate-700 bg-slate-900/70 text-slate-500",
    rose: active ? "border-rose-300/70 bg-rose-300/15 text-rose-100" : "border-slate-700 bg-slate-900/70 text-slate-500",
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${tones[tone]}`}>{children}</span>;
}

function SvgTextBox({ x, y, width, height, title, detail, tone = "teal" }) {
  const stroke = tone === "amber" ? "rgba(251,191,36,.55)" : tone === "rose" ? "rgba(251,113,133,.55)" : "rgba(94,234,212,.55)";

  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width={width} height={height} rx="18" fill="rgba(15,23,42,.92)" stroke={stroke} />
      <foreignObject x="12" y="8" width={width - 24} height={height - 16}>
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            overflow: "hidden",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            lineHeight: 1.2,
          }}
        >
          <div style={{ width: "100%", color: "#ccfbf1", fontSize: "13px", fontWeight: 800, marginBottom: "4px" }}>{title}</div>
          <div style={{ width: "100%", color: "#e2e8f0", fontSize: "11px", fontWeight: 600, maxHeight: "48px", overflow: "hidden" }}>{detail}</div>
        </div>
      </foreignObject>
    </g>
  );
}

function Bellows({ state, x = 150, yMid = TUBE_Y }) {
  const width = 78;
  const baseTop = yMid - 62;
  const baseBottom = yMid + 62;
  const compression = state.bellows * 30;
  const topPlateY = baseTop + compression;
  const bottomPlateY = baseBottom - compression;
  const bodyY = topPlateY + 14;
  const bodyH = Math.max(24, bottomPlateY - topPlateY - 28);
  const portY = yMid;
  const pleats = Array.from({ length: 6 }, (_, i) => bodyY + ((i + 1) * bodyH) / 7);

  return (
    <g>
      <rect x={x} y={topPlateY} width={width} height="14" rx="4" fill="url(#metal)" stroke="#cbd5e1" opacity="0.95" />
      <rect x={x + 6} y={bodyY} width={width - 12} height={bodyH} rx="12" fill="url(#bellowsFill)" stroke="rgba(103,232,249,.45)" strokeWidth="2" />
      {pleats.map((yy, index) => (
        <line key={index} x1={x + 18} y1={yy} x2={x + width - 18} y2={yy} stroke="rgba(153,246,228,.6)" strokeWidth="2.2" strokeLinecap="round" />
      ))}
      <rect x={x} y={bottomPlateY - 14} width={width} height="14" rx="4" fill="url(#metal)" stroke="#cbd5e1" opacity="0.95" />
      <rect x={x + width - 2} y={portY - 8} width="18" height="16" rx="3" fill="#0f172a" stroke="rgba(148,163,184,.45)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={x + width + 13} y1={baseTop + 10 + i * 26} x2={x + width + 22} y2={baseTop + 10 + i * 26} stroke="rgba(94,234,212,.6)" strokeWidth="2" strokeLinecap="round" />
      ))}
      <text x={x + width / 2} y={baseBottom + 28} textAnchor="middle" fill="#cbd5e1" fontSize="12">bellows</text>
    </g>
  );
}

function LungPair({ state }) {
  const lungScale = 1 + state.lung * 0.105;
  const leftTransform = `translate(${LUNG_LEFT_CENTER} 172) scale(${lungScale}) translate(-${LUNG_LEFT_CENTER} -172)`;
  const rightTransform = `translate(${LUNG_RIGHT_CENTER} 172) scale(${lungScale}) translate(-${LUNG_RIGHT_CENTER} -172)`;

  return (
    <>
      <g>
        <path d={`M${AIRWAY_X} 118 L${AIRWAY_X} 156`} fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" />
        <path d={`M${AIRWAY_X} 156 C${AIRWAY_X - 16} 168, ${AIRWAY_X - 35} 186, ${AIRWAY_X - 56} 210`} fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
        <path d={`M${AIRWAY_X} 156 C${AIRWAY_X + 16} 168, ${AIRWAY_X + 35} 186, ${AIRWAY_X + 56} 210`} fill="none" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />
        <circle cx={AIRWAY_X} cy="156" r="4.5" fill="#e2e8f0" />
      </g>

      <g transform={leftTransform}>
        <path d="M548 108 C512 110, 488 140, 491 185 C495 232, 525 263, 564 254 C594 248, 588 202, 576 170 C565 140, 573 112, 548 108 Z" fill="url(#lungFill)" stroke="#fecdd3" strokeWidth="2.5" opacity="0.92" />
        <path d="M548 108 C512 110, 488 140, 491 185 C495 232, 525 263, 564 254 C594 248, 588 202, 576 170 C565 140, 573 112, 548 108 Z" fill="url(#airGlow)" opacity={0.05 + state.lung * 0.45} filter="url(#softGlow)" />
        <path d="M553 143 C535 160, 529 185, 533 216" fill="none" stroke="rgba(127,29,29,.35)" strokeWidth="2" />
        <path d="M573 171 C557 181, 545 195, 539 216" fill="none" stroke="rgba(254,205,211,.58)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="573" cy="171" r="4" fill="#fecdd3" />
      </g>

      <g transform={rightTransform}>
        <path d="M650 108 C686 110, 710 140, 707 185 C703 232, 673 263, 634 254 C604 248, 610 202, 622 170 C633 140, 625 112, 650 108 Z" fill="url(#lungFill)" stroke="#fecdd3" strokeWidth="2.5" opacity="0.92" />
        <path d="M650 108 C686 110, 710 140, 707 185 C703 232, 673 263, 634 254 C604 248, 610 202, 622 170 C633 140, 625 112, 650 108 Z" fill="url(#airGlow)" opacity={0.05 + state.lung * 0.45} filter="url(#softGlow)" />
        <path d="M645 143 C663 160, 669 185, 665 216" fill="none" stroke="rgba(127,29,29,.35)" strokeWidth="2" />
        <path d="M625 171 C641 181, 653 195, 659 216" fill="none" stroke="rgba(254,205,211,.58)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="625" cy="171" r="4" fill="#fecdd3" />
      </g>
    </>
  );
}

function VentilatorScene({ state, mode }) {
  const cfg = MODES[mode];
  const flowOpacity = Math.max(Math.abs(state.flow), state.releaseValve * 0.9);
  const inspiratory = state.flow >= 0;
  const phaseTone = state.releaseValve > 0.2 ? "rose" : state.spontaneousBreath ? "amber" : "teal";

  const particles = [0.10, 0.28, 0.46, 0.64, 0.82].map((base, i) => {
    const t = (((base + state.phase * (inspiratory ? 1 : -1)) % 1) + 1) % 1;
    return { x: TUBE_START + t * (TUBE_END - TUBE_START), y: TUBE_Y, i };
  });

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-700/70 bg-[radial-gradient(circle_at_55%_75%,rgba(45,212,191,.16),transparent_34%),linear-gradient(135deg,#020617,#0f172a_58%,#020617)] p-4 shadow-2xl shadow-black/30">
      <div className={`pointer-events-none absolute inset-x-8 top-5 h-24 rounded-full bg-gradient-to-r ${cfg.color} opacity-10 blur-3xl`} />

      <svg viewBox="0 0 790 365" className="relative z-10 h-[410px] w-full overflow-visible" role="img" aria-label={`Ventilator mode animation for ${cfg.fullName}`}>
        <defs>
          <linearGradient id="metal" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="45%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="bellowsFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#164e63" />
            <stop offset="45%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#042f2e" />
          </linearGradient>
          <linearGradient id="lungFill" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#fecaca" />
            <stop offset="55%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
          <linearGradient id="airGlow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#99f6e4" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.18" />
          </linearGradient>
          <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform="translate(24 70)">
          <rect x="0" y="0" width="102" height="176" rx="24" fill="rgba(15,23,42,.92)" stroke="rgba(148,163,184,.45)" />
          <text x="51" y="28" textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="700">VENT</text>
          <text x="51" y="47" textAnchor="middle" fill="#5eead4" fontSize="11">{cfg.name}</text>
          <rect x="18" y="60" width="66" height="20" rx="7" fill="rgba(45,212,191,.12)" stroke="rgba(94,234,212,.45)" />
          <text x="51" y="74" textAnchor="middle" fill="#99f6e4" fontSize="10">P / Vt</text>
          <circle cx="36" cy="112" r="8" fill={state.machineBreath ? "#5eead4" : "#334155"} />
          <circle cx="66" cy="112" r="8" fill={state.spontaneousBreath ? "#fbbf24" : "#334155"} />
          <text x="51" y="136" textAnchor="middle" fill="#94a3b8" fontSize="10">breath status</text>
        </g>

        <Bellows state={state} x={150} yMid={TUBE_Y} />
        <rect x="226" y={TUBE_Y - 8} width="18" height="16" rx="3" fill="#0f172a" stroke="rgba(148,163,184,.45)" />

        <path d={`M${TUBE_START} ${TUBE_Y} L${TUBE_END} ${TUBE_Y}`} fill="none" stroke="#0f172a" strokeWidth="30" strokeLinecap="round" />
        <path d={`M${TUBE_START} ${TUBE_Y} L${TUBE_END} ${TUBE_Y}`} fill="none" stroke="#334155" strokeWidth="22" strokeLinecap="round" />
        <path d={`M${TUBE_START} ${TUBE_Y} L${TUBE_END} ${TUBE_Y}`} fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 13" opacity="0.75" />
        <path d={`M${TUBE_START} ${TUBE_Y} L${TUBE_END} ${TUBE_Y}`} fill="none" stroke={inspiratory ? "#5eead4" : "#fb7185"} strokeWidth="6" strokeLinecap="round" strokeDasharray="14 16" opacity={0.12 + flowOpacity * 0.76} filter="url(#softGlow)" />

        {particles.map((p) => (
          <circle key={p.i} cx={p.x} cy={p.y} r={3 + flowOpacity * 2} fill={inspiratory ? "#99f6e4" : "#fecdd3"} opacity={flowOpacity} filter="url(#softGlow)" />
        ))}

        <g opacity={flowOpacity}>
          {inspiratory ? (
            <>
              <path d={`M326 ${TUBE_Y - 8} l16 8 l-16 8`} fill="none" stroke="#99f6e4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d={`M414 ${TUBE_Y - 8} l16 8 l-16 8`} fill="none" stroke="#99f6e4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : (
            <>
              <path d={`M342 ${TUBE_Y - 8} l-16 8 l16 8`} fill="none" stroke="#fecdd3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d={`M430 ${TUBE_Y - 8} l-16 8 l16 8`} fill="none" stroke="#fecdd3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </g>

        <SvgTextBox x={420} y={-10} width={340} height={84} title={state.phaseTitle} detail={state.phaseDetail} tone={phaseTone} />
        <LungPair state={state} />

        {state.machineBreath && (
          <g transform="translate(148 84)">
            <rect x="0" y="0" width="150" height="26" rx="13" fill="rgba(45,212,191,.12)" stroke="rgba(94,234,212,.65)" />
            <text x="75" y="17" textAnchor="middle" fill="#ccfbf1" fontSize="11" fontWeight="700">
              {mode === "APRV" ? "P-high / machine hold" : "machine breath active"}
            </text>
          </g>
        )}

        {state.releaseValve > 0.14 && (
          <g transform="translate(252 217)" opacity={state.releaseValve}>
            <rect x="0" y="0" width="132" height="26" rx="13" fill="rgba(251,113,133,.16)" stroke="rgba(251,113,133,.75)" />
            <text x="66" y="17" textAnchor="middle" fill="#fecdd3" fontSize="11" fontWeight="700">release valve open</text>
          </g>
        )}

        <path
          d={`M${AIRWAY_X - 104} 288 C${AIRWAY_X - 58} 306, ${AIRWAY_X + 58} 306, ${AIRWAY_X + 104} 288`}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.65"
          transform={`translate(0 ${state.diaphragmDirection === "down" ? 10 : state.diaphragmDirection === "up" ? -6 : 0})`}
        />
        <text x={AIRWAY_X} y="342" textAnchor="middle" fill="#94a3b8" fontSize="12">{state.diaphragmText}</text>

        {state.diaphragmDirection === "down" && (
          <g opacity="0.9">
            <path d={`M${AIRWAY_X - 44} 306 l0 14`} stroke="#7dd3fc" strokeWidth="3.5" strokeLinecap="round" />
            <path d={`M${AIRWAY_X + 44} 306 l0 14`} stroke="#7dd3fc" strokeWidth="3.5" strokeLinecap="round" />
            <path d={`M${AIRWAY_X - 50} 314 l6 7 l6 -7`} fill="none" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d={`M${AIRWAY_X + 38} 314 l6 7 l6 -7`} fill="none" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}

        {state.diaphragmDirection === "up" && (
          <g opacity="0.9">
            <path d={`M${AIRWAY_X - 44} 318 l0 -14`} stroke="#fda4af" strokeWidth="3.5" strokeLinecap="round" />
            <path d={`M${AIRWAY_X + 44} 318 l0 -14`} stroke="#fda4af" strokeWidth="3.5" strokeLinecap="round" />
            <path d={`M${AIRWAY_X - 50} 310 l6 -7 l6 7`} fill="none" stroke="#fda4af" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d={`M${AIRWAY_X + 38} 310 l6 -7 l6 7`} fill="none" stroke="#fda4af" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}

        {state.patientEffort > 0.06 && (
          <g transform="translate(430 82)" opacity={Math.min(1, 0.25 + state.patientEffort * 2.1)}>
            <rect x="0" y="0" width="146" height="24" rx="12" fill="rgba(251,191,36,.15)" stroke="rgba(251,191,36,.72)" />
            <text x="73" y="16" textAnchor="middle" fill="#fde68a" fontSize="11" fontWeight="700">patient effort</text>
          </g>
        )}

        {state.spontaneousBreath && (
          <g transform="translate(590 82)">
            <rect x="0" y="0" width="164" height="24" rx="12" fill="rgba(251,191,36,.12)" stroke="rgba(251,191,36,.75)" />
            <text x="82" y="16" textAnchor="middle" fill="#fde68a" fontSize="11" fontWeight="700">spontaneous component</text>
          </g>
        )}
      </svg>
    </div>
  );
}

export default function VentilatorModeAnimator() {
  const [mode, setMode] = useState("VCV");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.62);
  const [patientEffort, setPatientEffort] = useState(true);
  const [separateOptionalBreath, setSeparateOptionalBreath] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    let raf;

    const tick = (now) => {
      if (lastTimeRef.current == null) lastTimeRef.current = now;
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (playing) setSeconds((s) => s + delta * speed);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const settings = useMemo(() => ({ patientEffort, separateOptionalBreath }), [patientEffort, separateOptionalBreath]);
  const state = computeState(mode, seconds, settings);
  const optionalState = computeOptionalBreathState(mode, seconds, { patientEffort });
  const cfg = MODES[mode];
  const supportsSeparateOptionalBreath = modeSupportsSeparateOptionalBreath(mode);

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex rounded-full border border-teal-300/40 bg-teal-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-100">
                Anesthesia Playground · ventilator modes
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Ventilator bellows → lungs animator</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Straight tubing, centered bellows compression, clearer airway alignment, readable phase labels, and optional spontaneous-breath previews for APRV and SIMV / IMV.
              </p>
            </div>

            <div className="grid min-w-[300px] grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 p-2 sm:grid-cols-4">
              <button type="button" onClick={() => setPlaying((p) => !p)} className="rounded-xl bg-teal-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-200">
                {playing ? "Pause" : "Play"}
              </button>
              <button type="button" onClick={() => setSeconds(0)} className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800">
                Reset
              </button>
              <button
                type="button"
                onClick={() => setPatientEffort((p) => !p)}
                className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                  patientEffort ? "border-amber-300/60 bg-amber-300/10 text-amber-100" : "border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
              >
                Effort {patientEffort ? "On" : "Off"}
              </button>
              <button
                type="button"
                disabled={!supportsSeparateOptionalBreath}
                onClick={() => supportsSeparateOptionalBreath && setSeparateOptionalBreath((p) => !p)}
                className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                  !supportsSeparateOptionalBreath
                    ? "cursor-not-allowed border-slate-800 text-slate-600"
                    : separateOptionalBreath
                    ? "border-fuchsia-300/60 bg-fuchsia-300/10 text-fuchsia-100"
                    : "border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
              >
                Optional breath {supportsSeparateOptionalBreath ? (separateOptionalBreath ? "Separate" : "Embedded") : "N/A"}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {MODE_KEYS.map((key) => (
                <ModeButton key={key} id={key} active={key === mode} onClick={setMode} />
              ))}
            </div>
            <VentilatorScene state={state} mode={mode} />
          </div>

          <aside className="space-y-4 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/20">
            <div>
              <div className={`mb-3 inline-flex rounded-full bg-gradient-to-r ${cfg.color} px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-slate-950`}>{cfg.name}</div>
              <h2 className="text-2xl font-black text-white">{cfg.fullName}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{cfg.subtitle}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Controlled variable</div>
                <div className="mt-1 text-base font-bold text-teal-100">{cfg.control}</div>
              </div>
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Allowed to vary</div>
                <div className="mt-1 text-base font-bold text-cyan-100">{cfg.varies}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Trigger logic</div>
              <div className="mt-1 text-sm font-semibold text-slate-200">{cfg.trigger}</div>
            </div>

            {supportsSeparateOptionalBreath && (
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Optional spontaneous breath view</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSeparateOptionalBreath(false)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${!separateOptionalBreath ? "border-amber-300/70 bg-amber-300/12 text-amber-100" : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
                    Embed in main cycle
                  </button>
                  <button type="button" onClick={() => setSeparateOptionalBreath(true)} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${separateOptionalBreath ? "border-fuchsia-300/70 bg-fuchsia-300/12 text-fuchsia-100" : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
                    Show separately
                  </button>
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300">In {cfg.name}, spontaneous breathing is optional. Separate view keeps the core cycle easier to follow.</div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current phase</div>
              <div className="mt-1 text-base font-bold text-white">{state.phaseTitle}</div>
              <div className="mt-1 text-sm leading-6 text-slate-300">{state.phaseDetail}</div>
            </div>

            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
              <label className="flex items-center justify-between gap-3 text-sm font-bold text-slate-200">
                Animation speed <span className="text-teal-100">{speed.toFixed(2)}×</span>
              </label>
              <input type="range" min="0.25" max="1.25" step="0.05" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="mt-3 w-full accent-teal-300" />
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill active={state.machineBreath}>{mode === "APRV" ? "P-high / machine hold" : "Machine breath"}</StatusPill>
              <StatusPill active={state.spontaneousBreath} tone="amber">Spontaneous breath</StatusPill>
              <StatusPill active={state.releaseValve > 0.2} tone="rose">Release valve</StatusPill>
            </div>
          </aside>
        </section>

        {supportsSeparateOptionalBreath && patientEffort && separateOptionalBreath && (
          <section className="space-y-4 rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/20">
            <div>
              <div className="mb-2 inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">Optional spontaneous breath preview</div>
              <h3 className="text-xl font-black text-white">{mode === "APRV" ? "Separate spontaneous breath during Phigh / Thigh" : "Separate spontaneous breath between mandatory breaths"}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">This preview isolates the optional spontaneous breath so the main cycle stays easier to read.</p>
            </div>

            <VentilatorScene state={optionalState} mode={mode} />

            <div className="grid gap-4 lg:grid-cols-3">
              <Waveform mode={mode} seconds={seconds} metric="pressure" title="Pressure–time" label="optional breath demo" settings={{ patientEffort: true }} resolver={computeOptionalBreathState} cycleSecOverride={OPTIONAL_CYCLE_SEC[mode]} />
              <Waveform mode={mode} seconds={seconds} metric="flow" title="Flow–time" label="optional breath demo" settings={{ patientEffort: true }} resolver={computeOptionalBreathState} cycleSecOverride={OPTIONAL_CYCLE_SEC[mode]} />
              <Waveform mode={mode} seconds={seconds} metric="volume" title="Volume–time" label="optional breath demo" settings={{ patientEffort: true }} resolver={computeOptionalBreathState} cycleSecOverride={OPTIONAL_CYCLE_SEC[mode]} />
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-3">
          <Waveform mode={mode} seconds={seconds} metric="pressure" title="Pressure–time" label="cmH₂O concept" settings={settings} />
          <Waveform mode={mode} seconds={seconds} metric="flow" title="Flow–time" label="inspiration above baseline" settings={settings} />
          <Waveform mode={mode} seconds={seconds} metric="volume" title="Volume–time" label="relative tidal volume" settings={settings} />
        </section>
      </div>
    </div>
  );
}
