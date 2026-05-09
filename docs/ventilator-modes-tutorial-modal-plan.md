# Plan: Ventilator Modes Tutorial Modal (Interactive Ventilator)

This document outlines how to implement **education on ventilator modes**, **waveforms**, **lung mechanics**, and **clinical reasoning**, with **animated visuals** consistent with the simulator UI.

---

## 1. Goals & scope

### Primary goals

- Teach **mandatory vs spontaneous breaths**, **triggering**, and **controlled vs assisted vs spontaneous** mixing.
- Explain **variables**: \(V_T\), RR, \(T_I\), \(T_E\), I:E, PEEP, FiO₂, compliance, resistance, airway pressures (aligned with your sliders where applicable).
- Show **pressure / flow / volume** traces with motion that reinforces causality.
- Include **modes beyond VC/PC**: assist-control, intermittent mandatory ventilation (SIMV/IMV), APRV (basic), plus brief mentions of **CPAP/PSV**, **dual-target**, etc., with clear labeling when **not simulated** on this page.

### Simulated vs conceptual (mandatory labeling)

| Layer | On this page (`ventilator.js`) | In the tutorial modal |
|-------|-------------------------------|-------------------------|
| **VC / PC** | ✅ Implemented | Deep schematic + tie-in to live controls |
| **Assist-control, SIMV, APRV, …** | ❌ Not modeled numerically | ✅ **Concept-only** sections; badge copy such as **“Concept overview — not simulated here”** |

Never imply the knob switches APRV unless you add physics for it.

---

## 2. Content: modes to cover (draft pedagogy)

Each subsection should follow a template: **definition → idealized P/F/V shape → one clinical pearl → simulation disclaimer** where applicable.

### 2.1 Continuous mandatory breaths (every breath is delivered)

- **Assist-Control volume AC (VC-AC / VCV + trigger)**  
  Time-triggered **or** patient-triggered mandatory breaths; each mandatory breath delivers **set \(V_T\)** (pressure varies with mechanics). Minute ventilation is predictable if patient triggers every breath.

- **Assist-Control pressure AC (PC-AC / PCV + trigger)**  
  Mandatory breaths deliver **set inspiratory pressure** over inspiratory time; **\(V_T\) varies** with compliance/resistance and effort.

### 2.2 Mixed mandatory + spontaneous (different flavors)

- **Intermittent Mandatory Ventilation (IMV)** *(historical)*  
  Mandatory breaths **without synchronization** to spontaneous effort → caused asynchrony; mainly of historical interest; motivates modern SIMV.

- **Synchronized IMV (SIMV)**  
  Mandatory breaths at set rate **plus** allowed spontaneous breaths (often with **PS** between mandatory breaths). Key teaching point: **stacking** mandatory + spontaneous vs pure AC.

### 2.3 Pressure-target open lung / release concepts

- **APRV (basic explanation)**  
  Very high CPAP with **brief intermittent releases** — prolonged inspiratory “holding open” short releases for CO₂ clearance; interpret **pressure/time** rather than classic VC I:E. Clarify this simulator **does not** run APRV numerically.

### 2.4 Other modes (short glossary)

Include **one paragraph each**, schematic optional:

- **CPAP** (continuous positive airway pressure; spontaneous breathing at elevated baseline).
- **PS / PSV** (pressure support augments each spontaneous breath — inspiratory flow cycling varies by machine).
- **Bi-level / BiPAP-style** (two CPAP levels; spontaneous at each; not the same as ICU APRV without additional rules).
- **Volume-targeted pressure modes** (e.g. PRVC / “autoflow” class) — target volume with **pressure servos**; high level only.

### 2.5 Map to the product

- The **main page** only toggles **VC / PC** — the modal explains **AC** as “mandatory breath + trigger philosophy,” explicitly tying **AC volume** to what VC delivers here and **AC pressure** to PC.

---

## 3. UX pattern

### 3.1 Pre-tutorial teaser strip (implemented placement)

- **Location:** On the **vitals monitor**, in the **rectangle below** the **NIBP · TEMP · GAS / AGENT** strip (`<div class="vitals-bar">`), occupying flex space so waveforms stay fixed and the **gray vitals bar stays compact**.
- **Purpose:** Lightweight **looping schematic animation** (P / flow / volume hint) + **CTA** (“Ventilator modes”) → opens the full `<dialog>` tutorial.
- **Behavior:** Pause animation when `prefers-reduced-motion`; optional IntersectionObserver pause when off-screen (performance).

### 3.2 Modal container

- Use **`<dialog id="vent-modes-tutorial">`** consistent with `#tut-ventwaves` / debrief patterns.
- **Tabs / sections:** Basics → Variables → **VC & AC** → **PC & AC** → **SIMV / IMV** → **APRV** → **Other modes** → Waveforms → Pearls.

### 3.3 Entry points

- **Primary:** Teaser strip button on vitals monitor.
- **Secondary (optional):** Small link near ventilator mode toggles.

---

## 4. Animated graphic strategy

- **Modal:** Schematic canvas/SVG (recommended), not tied to `tick()` for v1.
- **Teaser strip:** Tiny canvas loop — stylized **three-line P/F/V** or single **pressure + volume** silhouette — enough to invite click without duplicating full lesson.

---

## 5. Technical implementation plan

### 5.1 Files

| Area | File(s) |
|------|---------|
| Teaser + stub dialog | `ventilator/index.html` |
| Teaser + dialog styles | `css/ventilator.css` |
| Teaser animation + dialog open/close | `js/vent-modes-teaser.js` (load after `ventilator.js`) |
| Full tutorial (later) | `js/vent-modes-tutorial.js` or section in `ventilator.js` |

### 5.2 Vitals layout CSS intent

- `#vitals-screen` remains a column flex.
- `.vitals-bar` — **does not** consume all remaining height (`flex: 0 0 auto`; keep `min-height`).
- `.vent-modes-teaser` — **`flex: 1 1 auto`** with `min-height` so it absorbs **extra vertical space** under the gray bar as a **dark “slice”** matching the monitor chrome.

### 5.3 Animator API (full modal, future)

```text
VentModesTutorial.init({ canvases, reducedMotion });
VentModesTutorial.setTopic('VC_AC' | 'PC_AC' | 'SIMV' | 'APRV' | ...);
```

---

## 6. Accessibility

- Teaser **button** has visible label + `aria-label` if icon-only on narrow layouts.
- Dialog: focus trap / Escape / backdrop (native `<dialog>`).
- **`prefers-reduced-motion`:** static teaser frame; modal uses still diagrams.

---

## 7. Phased delivery

| Phase | Deliverable |
|-------|-------------|
| **Done / stub** | Teaser strip + placeholder dialog + `vent-modes-teaser.js` |
| **1** | Full modal shell + tabs + VC/PC + AC framing + SIMV/APRV **concept** copy |
| **2** | Interactive schematic sliders (compliance/resistance) |
| **3** | Optional live ghost trace vs simulator |

---

## 8. QA checklist

- [ ] Teaser does not shrink waveform rows; vitals bar readable on mobile breakpoints.
- [ ] No extra CPU when tab hidden (pause rAF).
- [ ] Clinical review for APRV/SIMV wording.

---

## 9. Open decisions

1. Depth of **brand-specific** mode names vs generic anesthesia-friendly naming.
2. Whether teaser opens **same dialog** as future full tutorial (yes, recommended — swap inner content by phase).

---

*Medical copy must be reviewed by anesthesia educators before wide release.*
