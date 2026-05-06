# Plan: Ventilator Modes Tutorial Modal (Interactive Ventilator)

This document outlines how to implement an **educational modal** on the ventilator page that explains **breath types / modes**, **waveforms**, **lung mechanics variables**, and **why different modes behave as they do**, with **animated visuals** consistent with the existing simulator.

---

## 1. Goals & scope

### Primary goals

- Teach **VC vs PC** (what is controlled each breath vs what is guaranteed).
- Explain **common variables**: \(V_T\), RR, \(T_I\), \(T_E\), I:E, PEEP, FiO₂, compliance, resistance, peak vs plateau pressure (conceptually aligned with your UI labels).
- Show **pressure / flow / volume** traces over one or more breath cycles with **motion that reinforces causality** (e.g., inspiration flow vs volume integral).
- Clarify **clinical “why”**: lung protection trade-offs, airway pressure limits in PC, guaranteed minute ventilation in VC, etc.

### Out of scope (initial release)

- Full catalog of every ICU mode brand name (unless you later add a glossary chip).
- Exact numerical matching to every edge case in `ventilator.js` physics (the modal can use a **schematic** timebase unless you explicitly bind to `tick()`).

### Alignment with the current product

- The live simulator supports **VC** and **PC** (`ventSettings.mode` in `js/ventilator.js`). The modal should **not promise modes you do not simulate** (e.g., APRV, HFOV) unless you add copy marked **“Not simulated here”** or a separate “Overview of other modes” appendix tab.

---

## 2. UX pattern (match existing ventilator UI)

### Modal container

- Use **`<dialog>`** like other ventilator surfaces (`#tut-ventwaves`, `#tut-ecg`, debrief dialog in `ventilator/index.html`).
- Reuse patterns: **backdrop click to close**, **Escape**, **`showModal()` / `close()`**, focus trap consistent with other `mon-tut` dialogs.

### Entry points

- Add a **persistent control** near the waveform cluster or mode toggles, e.g. **“Ventilator modes”** or **“How this ventilator works”** (icon + text on desktop; icon-only with `aria-label` on narrow layouts).

### Information architecture (recommended)

Use **tabs or a left rail** inside the modal:

| Section | Purpose |
|--------|---------|
| **Basics** | One breath timeline: inspiration vs expiration, PEEP baseline |
| **Variables** | Glossary with sliders that drive the schematic (optional interactive row) |
| **VC / VCV** | Controlled volume: fixed \(V_T\), pressure varies with mechanics |
| **PC / PCV** | Controlled pressure: fixed inspiratory pressure target, \(V_T\) varies |
| **Waveforms** | P/F/V phase relationship + “what to watch for” |
| **Clinical pearls** | Short bullets: lung protection, leaks, asynchrony (high level) |

Avoid one endless scroll unless mobile forces it—use **sticky section nav** or **horizontal swipe sections** on small screens.

---

## 3. Animated graphic strategy

### Option A — **Schematic canvas/SVG animation** (recommended for v1)

- Build a **small dedicated animator** (single `<canvas>` or SVG) that draws **idealized** P, Flow, Volume for VC and PC.
- **Pros:** Full control of pedagogy (slow motion, pause, highlight segments); no coupling to the full simulation loop.
- **Cons:** Must stay visually **consistent** with the real waveforms (same sign conventions, colors).

### Option B — **Live mirror** of the main simulator waveforms

- Sample from existing waveform buffers / generators in `ventilator.js`.
- **Pros:** Perfect fidelity.
- **Cons:** Harder to stage pedagogy (patient noise, scenario overlays); risk of confusing learners when scenarios change lung mechanics.

**Recommendation:** **Option A** for the modal; optionally add a **“Compare to live trace”** toggle in v2 that overlays a faint ghost of the current monitor.

### Animation language

- **One breath** loop by default; **Play / Pause**; **Slow** speed (0.25×–0.5×).
- Phase highlights: **inspiratory flow**, **expiratory flow**, **pressure peak**, **PEEP**.
- Use **`prefers-reduced-motion`**: static frame + text, or cross-fade instead of continuous scrub.

### Lung graphic

- Simple **compliance spring** metaphor: lung volume ∝ integrated flow; PC shows **pressure ceiling** as a horizontal bar during inspiration.
- Keep file weight low: vector shapes + CSS transforms, or lightweight canvas.

---

## 4. Content outline (draft hierarchy)

### Variables (tie labels to UI)

- **Tidal volume (\(V_T\))** — set directly in VC; emergent in PC.
- **Respiratory rate (RR)** and **cycle time**.
- **Inspiratory time (\(T_I\))** / **I:E ratio**.
- **PEEP** — baseline pressure; effect on FRC (conceptual).
- **FiO₂** — oxygenation (brief; not a mechanics lesson).
- **Compliance / resistance** — from your sliders (`patientState.compliance`, `patientState.resistance`); how they change peak pressure (VC) vs delivered volume (PC).

### Modes

- **Volume control (VC / VCV):** “Set volume, variable pressure.”
- **Pressure control (PC / PCV):** “Set inspiratory pressure, variable volume.”

Each mode page should have:

1. **2–3 sentence intuition**
2. **Animated schematic** (P/F/V)
3. **“What moves when compliance drops?”** micro-callout
4. **One safety pearl** (e.g., high pressures in stiff lungs in VC)

---

## 5. Technical implementation plan

### 5.1 Files to touch

| Area | File(s) |
|------|---------|
| Markup | `ventilator/index.html` — new `<dialog id="vent-modes-tutorial">…</dialog>` + trigger button |
| Styles | `css/ventilator.css` — modal layout, tabs, canvas wrapper, responsive rules |
| Logic | Prefer **`js/vent-modes-tutorial.js`** (new IIFE) loaded after `ventilator.js`, **or** a clearly namespaced block at the end of `ventilator.js` if you want zero extra HTTP requests |
| Assets | Optional `images/` or inline SVG only |

### 5.2 Wiring the trigger

- On DOM ready: `querySelector('#vent-modes-tutorial-open')` → `dialog.showModal()`.
- Mirror close patterns from existing tutorial dialogs (click backdrop, Escape).

### 5.3 Animator module API (suggested)

```text
VentModesTutorial.init({
  canvasPressure,
  canvasFlow,
  canvasVolume,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
});
VentModesTutorial.setMode('VC' | 'PC');
VentModesTutorial.setMechanics({ compliance, resistance }); // optional v2
```

Keep **pure functions** for generating arrays of samples over normalized time \(t \in [0,1]\) per breath phase.

### 5.4 Styling consistency

- Reuse **teal accent**, typography, and spacing from `.mon-tut` / `.vent-tut-dialog` where sensible.
- Ensure **z-index** stacks above the workstation but below any global alert if applicable.

---

## 6. Accessibility

- **Keyboard:** Tab order through tabs → play/pause → mode toggle → close.
- **Screen readers:** `aria-labelledby` on dialog; tabs as **`role="tablist"`** / **`role="tab"`** / **`role="tabpanel"`** with `aria-selected` / `aria-controls`.
- **Motion:** respect **`prefers-reduced-motion`** (static diagrams + text).
- **Contrast:** waveform lines ≥ 3:1 against background; label text meets WCAG AA.

---

## 7. Phased delivery

### Phase 1 — MVP (ship-worthy)

- Dialog shell + tabs: **Basics**, **Variables**, **VC**, **PC**, **Waveforms**
- One schematic animator (VC + PC presets), **Play/Pause**, **mode switch**
- Copy reviewed for alignment with **only simulated modes**

### Phase 2 — Depth

- Interactive sliders that morph the schematic (compliance/resistance)
- Optional **“Compare to live simulation”** ghost trace
- Printable / copy-friendly **glossary** panel

### Phase 3 — Polish

- Micro-interactions (phase scrubber), subtle sound-off UI hints
- Localization hooks if you ever translate strings

---

## 8. QA checklist

- [ ] Open/close on mobile Safari + Chrome; no scroll bleed on `body` when modal open (use standard `<dialog>` backdrop behavior).
- [ ] No regression to `ventilator.js` init or `requestAnimationFrame(tick)`.
- [ ] Performance: animator runs on its own rAF; paused when dialog closed.
- [ ] Content accuracy review by anesthesia educator (especially clinical pearls).

---

## 9. Open decisions (resolve before build)

1. **Exact list of modes** named in copy vs simulated (VC/PC only vs broader glossary).
2. **Schematic vs live** trace for v1 (recommend schematic).
3. **New JS file vs inline** in `ventilator.js` (bundle/cache tradeoff).
4. **Where the trigger lives** in the layout (toolbar vs monitor chrome vs both).

---

*This plan is intentionally implementation-ready but leaves medical copy and final visual design to you and your clinical reviewers.*
