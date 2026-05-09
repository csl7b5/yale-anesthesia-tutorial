# Ventilator teaser SVG animation — improved agent handoff

This document describes how the current ventilator-modes teaser animation works in the **Yale Anesthesia Tutorial** repo and gives **concrete directions for improving** it. The goal is not just to make the animation prettier. The goal is to make the animation feel more alive, more physiologic, and more educational for learners who are trying to understand ventilator modes.

**Companion doc (read first for “what exists today”):** [`ventilator-teaser-animation-agent-handoff.md`](ventilator-teaser-animation-agent-handoff.md) — file paths, nested-SVG pattern, `vts-*` / `vtd-*` IDs, overflow/clipping, and a plain-language description of the current strip and modal preview.

---

## Table of contents

1. [Product intent](#product-intent)
2. [Where everything currently lives](#where-everything-currently-lives)
3. [Snapshot: current implementation (ground truth)](#snapshot-current-implementation-ground-truth)
4. [Current visual baseline to preserve](#current-visual-baseline-to-preserve)
5. [Main improvement goals](#main-improvement-goals)
6. [CSS architecture changes](#css-architecture-changes)
7. [JS controller recommendation](#js-controller-recommendation)
8. [Mode-specific CSS hooks](#mode-specific-css-hooks)
9. [SVG implementation checklist](#svg-implementation-checklist)
10. [Visual design direction](#visual-design-direction)
11. [Responsive behavior](#responsive-behavior)
12. [Accessibility and reduced motion](#accessibility-and-reduced-motion)
13. [Performance constraints](#performance-constraints)
14. [Acceptance criteria](#acceptance-criteria)
15. [Suggested implementation order](#suggested-implementation-order-for-the-coding-agent)
16. [Concrete coding prompt](#concrete-coding-prompt-for-the-agent)
17. [Glossary and implementation pitfalls](#glossary-and-implementation-pitfalls)
18. [Definition of a strong final result](#definition-of-a-strong-final-result)

---

## Product intent

The ventilator teaser should read as a tiny, high-quality physiology simulator inside the vitals monitor strip. A learner should be able to glance at it and intuit:

1. **A breath has phases**: trigger / inspiration / plateau or hold / expiration / end-expiratory baseline.
2. **Machine delivery and patient effort are different things**: some breaths are mandatory, some are spontaneous, and some are assisted.
3. **Pressure, flow, and volume are linked but not identical**: the lung can inflate while flow slows; pressure can rise before/while volume changes; expiration is passive and flow reverses.
4. **Ventilator modes differ by what is controlled or supported**: volume-control, pressure-control, pressure-support, SIMV, and APRV should eventually be visually distinguishable.

The current animation already has the right foundation: bellows, corrugated circuit, flow cue, airway, lungs, glow, and a pressure badge. The improvement pass should preserve that foundation while adding better timing, richer visual feedback, and more explicit educational cues.

---

## Where everything currently lives

| What | Path |
|------|------|
| **All motion**: keyframes, durations, transform origins | `css/ventilator.css` — search for `vent-teaser` and `vent-modes-teaser` |
| **Teaser SVG**: monitor strip animation | `ventilator/index.html` — `<svg class="vent-modes-teaser__svg" …>` inside `.vent-modes-teaser__viz` |
| **Modal preview SVG**: tutorial dialog, lighter theme | Same file — `<svg class="vent-modes-dialog__preview-svg" …>` inside `#vent-modes-tutorial` |
| **Dialog wiring only** | `js/vent-modes-teaser.js` — currently opens/closes `<dialog>` |
| **Stylesheet link** | `ventilator/index.html` links `../css/ventilator.css` |

Current animation is **100% CSS + inline SVG**. There is no `requestAnimationFrame`, no canvas, and no Web Animations API. Preserve this simplicity unless adding state/mode behavior truly needs a tiny JS controller.

---

## Snapshot: current implementation (ground truth)

Use this section to avoid drifting from the real codebase. **Re-read `css/ventilator.css` and `ventilator/index.html` before large refactors** — line numbers in the companion handoff are approximate.

| Item | Implemented today |
|------|---------------------|
| **Breath period** | `3.6s` on every animated selector (hard-coded, not a CSS variable yet) |
| **Easing** | `ease-in-out` for the main components |
| **Bellows** | `scaleY` via `@keyframes vent-teaser-bellows-drive`; `transform-origin: 50% 53%`, `transform-box: fill-box` on nested `svg.vent-teaser-bellows-core` |
| **Lungs** | `scale` via `@keyframes vent-teaser-lung-inflate`; `transform-origin: 50% 50%` on nested `svg.vent-teaser-lung-right` / `vent-teaser-lung-left` |
| **Glow** | `@keyframes vent-teaser-glow-pulse` on paths `vent-teaser-lung-glow-r` / `vent-teaser-lung-glow-l` |
| **Inspiratory jet** | `@keyframes vent-teaser-hose-jet` on `path.vent-teaser-hose-flow` (`stroke-dasharray` + `stroke-dashoffset`) |
| **Arrows** | `@keyframes vent-teaser-arrows-show` on `g.vent-teaser-flow-arrows` |
| **Pressure pill** | `@keyframes vent-teaser-p-show` on `g.vent-teaser-p-label` (static text `▲ P cmH₂O`) |
| **Teaser viewBox** | `0 0 200 72` on `.vent-modes-teaser__svg` |
| **Reduced motion** | Targeted `animation: none` on known classes + static fallbacks — **not** a blanket `*` selector (see existing rules before replacing) |
| **Modal** | Second SVG with **`vtd-*`** defs; same component **class names** as teaser |

**Important:** The phase percentages in the first table under **Main improvement goals** are **design targets** for the next pass. They do **not** match the current keyframe stops one-to-one yet.

---

## Current visual baseline to preserve

The current teaser is a dark, small-stage SVG inside `.vent-modes-teaser__viz`. It contains:

1. **Driving bellows**: vertical accordion-style compressor with metallic top/bottom plates, pleats, tick marks, and outlet.
2. **Breathing circuit**: thick corrugated hose with dark outer shell and rib marks.
3. **Flow cue**: teal dashed stroke moving toward lungs plus triangular arrows.
4. **Airway**: trachea and carina splitting into bronchi.
5. **Lungs**: two lung silhouettes with base fill, fissure lines, bronchial tree, hilum dot, and teal aeration glow overlay.
6. **Pressure badge**: small `▲ P cmH₂O` teaching pill that fades in during inspiration.

The current motion narrative is: bellows compress → flow cue strengthens → arrows brighten → pressure badge appears → lungs inflate and glow → everything relaxes.

Keep this concept. Upgrade the execution.

---

## Main improvement goals

### 1. Make the breath cycle feel more physiologic

Current issue: the loop reads as a generic synchronized pump animation. Everything peaks together, which is visually clean but does not teach much.

Improve it so timing has physiologic offsets. **Targets below are spec intent**, not the present CSS timing — align keyframes to these relationships during Pass 1.

| Phase | Approx. cycle % | Visual behavior |
|------|------------------|-----------------|
| End-expiratory baseline / PEEP | 0–8% | Lungs are not fully collapsed; keep a subtle baseline glow and baseline volume. |
| Trigger | 8–14% | Add a small pre-inspiration cue. For mandatory breaths, machine cue lights first. For spontaneous/assisted breaths, patient-effort cue appears first. |
| Inspiratory flow | 14–38% | Flow along hose becomes strongest. Lungs inflate but lag slightly behind the flow cue. Bellows compress or inspiratory valve opens. |
| Late inspiration / pressure rise | 38–52% | Flow begins to slow while lung volume/glow continue rising. Pressure badge peaks here, not at the exact first moment of flow. |
| Plateau / brief hold | 52–62% | Lung volume is high; flow is near zero; pressure remains visible. |
| Passive expiration | 62–84% | Add reverse/fading expiratory flow cue from lungs back toward circuit/expiratory side. Lungs deflate gradually. |
| End-expiratory baseline | 84–100% | Return to baseline lung volume, not total collapse. Maintain tiny PEEP line/glow. |

Do not make the lungs “bounce” like balloons. The motion should be subtle, smooth, and anchored at the hilum/airway.

### 2. Add synced mini waveforms

Add a small waveform strip either below the schematic or as a compact overlay on the lower 15–18 px of the SVG. This is the highest-yield educational improvement.

Add three tiny traces:

- **Pressure–time**: label `Paw`; rises during inspiration, maybe plateaus, returns to PEEP.
- **Flow–time**: label `Flow`; positive during inspiration, near zero at plateau, negative during expiration.
- **Volume–time**: label `Vt`; rises during inspiration, stays briefly, falls during expiration.

Implementation options:

1. **Preferred for teaser**: inline SVG polylines/paths with animated stroke-dashoffset or a moving mask. No canvas.
2. **Acceptable for modal only**: wider SVG with more readable waveforms and labels.
3. **Avoid**: heavy charting libraries for this small animation.

Add these classes:

```html
<g class="vent-teaser-waveforms" aria-hidden="true">
  <path class="vent-teaser-wave-axis vent-teaser-wave-axis--pressure" ... />
  <path class="vent-teaser-wave-axis vent-teaser-wave-axis--flow" ... />
  <path class="vent-teaser-wave-axis vent-teaser-wave-axis--volume" ... />

  <path class="vent-teaser-wave vent-teaser-wave--pressure" ... />
  <path class="vent-teaser-wave vent-teaser-wave--flow" ... />
  <path class="vent-teaser-wave vent-teaser-wave--volume" ... />

  <circle class="vent-teaser-wave-cursor" ... />
</g>
```

Waveform behavior should be synced to the same global breath cycle variable. The moving cursor should sweep left-to-right once per breath cycle.

### 3. Show trigger source: patient effort vs machine breath

Add a tiny cue that distinguishes spontaneous effort from mandatory machine delivery.

Possible visual options:

- A small downward diaphragm arc under the lungs that contracts briefly before assisted/spontaneous breaths.
- A small negative-pressure dip marker near the pressure waveform.
- A label that briefly changes between `machine breath`, `patient trigger`, and `release`.
- A small “effort spark” or subtle purple/blue glow at the patient side before ventilator flow begins.

Add classes:

```html
<g class="vent-teaser-patient-effort">
  <path class="vent-teaser-diaphragm" ... />
  <text class="vent-teaser-effort-label">patient effort</text>
</g>

<g class="vent-teaser-machine-trigger">
  <circle class="vent-teaser-trigger-dot" ... />
  <text class="vent-teaser-trigger-label">machine breath</text>
</g>
```

Do not show both cues at full strength for every mode. The cue should depend on mode/state.

### 4. Give the circuit more life without clutter

Current flow is a single dashed teal line. Improve it with layered motion:

- Keep the main dashed flow path.
- Add 2–4 tiny particles or highlights that move along the path during inspiration.
- Add a very subtle reverse-flow cue during passive expiration, less bright than inspiration.
- Add valve cues: inspiratory valve glows during inspiration; expiratory valve glows during expiration.

Suggested new classes:

```html
<circle class="vent-teaser-flow-particle vent-teaser-flow-particle--1" ... />
<circle class="vent-teaser-flow-particle vent-teaser-flow-particle--2" ... />
<path class="vent-teaser-hose-flow vent-teaser-hose-flow--insp" ... />
<path class="vent-teaser-hose-flow vent-teaser-hose-flow--exp" ... />
<g class="vent-teaser-valve vent-teaser-valve--insp">...</g>
<g class="vent-teaser-valve vent-teaser-valve--exp">...</g>
```

If moving particles along a curved SVG path becomes annoying in pure CSS, use simple small circles with offset-path only if browser support is acceptable. Otherwise, use short animated strokes instead of particles.

### 5. Improve lung mechanics and anchoring

Current lungs scale uniformly. That is acceptable, but refine it:

- Keep the hilum/bronchi visually attached to the airway.
- Prefer slight expansion outward and inferiorly rather than pure center zoom.
- Upper and lower lungs should not move exactly identically; add a tiny phase/amplitude difference.
- Keep baseline inflation at end-expiration to imply PEEP/FRC, not total deflation.
- The teal aeration glow should fill from hilum toward periphery rather than simply appearing everywhere at once if feasible.

Implementation options:

1. Use `transform-origin` near hilum instead of 50%/50%.
2. Split each lung into base silhouette + inner aeration gradient clipped by lung outline.
3. Animate a mask/clip rect from medial to lateral to imply filling.
4. Keep uniform scale as fallback on small screens.

Suggested classes:

```html
<clipPath id="vts-lung-clip-r">...</clipPath>
<path class="vent-teaser-lung-fill-r" ... />
<rect class="vent-teaser-lung-aeration-sweep-r" clip-path="url(#vts-lung-clip-r)" ... />
```

Remember: teaser IDs must remain unique from dialog IDs. Use `vts-*` in the teaser and `vtd-*` in the dialog.

### 6. Make mode differences visible

Add a lightweight mode system. The teaser can either:

- stay on one default “mandatory breath” loop and the modal shows mode variants; or
- cycle through modes slowly in the teaser, while the modal gives detailed view.

Preferred: **modal shows mode variants clearly; teaser stays compact but hints at mode changes.**

Support these data attributes on the root wrapper/SVG:

```html
<div class="vent-modes-teaser" data-vent-mode="vc" data-breath-type="mandatory">
```

or

```html
<svg class="vent-modes-teaser__svg" data-vent-mode="vc" data-breath-type="mandatory" ...>
```

Mode behavior spec:

| Mode | Trigger cue | Controlled variable visual | Flow waveform | Pressure waveform | Lung behavior |
|------|-------------|----------------------------|---------------|-------------------|---------------|
| `vc` / volume control | Machine or patient trigger depending AC/CMV label | Emphasize target volume/Vt | Square-ish constant inspiratory flow | Rises gradually, may plateau | Volume rises linearly-ish to same target |
| `pc` / pressure control | Machine or patient trigger | Emphasize pressure target | Decelerating inspiratory flow | Rapid rise then square plateau | Volume rises quickly then tapers |
| `ps` / pressure support | Patient effort first | Support pressure after effort | Decelerating flow | Supported plateau after trigger | Smaller assisted breath |
| `simv` | Alternates mandatory + spontaneous | Mandatory breath larger; spontaneous smaller | Alternating large/small cycles | Alternating pressure support or mandatory pressure | Larger mandatory breath plus smaller spontaneous effort |
| `aprv` | Time-cycled release | Long high-pressure phase, brief release | Brief expiratory release flow | Long high plateau with brief drop | Lung mostly inflated; brief partial deflation |

Do not overcomplicate the teaser if space is limited. It is okay for only the modal preview to show full mode variants.

### 7. Improve the pressure badge

Current badge says `▲ P cmH₂O`. Make it more useful:

- Change the text based on phase: `Paw ↑`, `plateau`, `PEEP`, or `release`.
- Keep it tiny and non-distracting.
- Animate position slightly upward during pressure rise, but avoid jitter.
- In reduced motion mode, hide dynamic label or show a static `Paw / Flow / Vt` mini legend.

Suggested classes:

```html
<g class="vent-teaser-phase-label">
  <rect ... />
  <text class="vent-teaser-phase-label-text">Paw ↑</text>
</g>
```

CSS-only text changes are awkward. If dynamic text matters, let the JS controller update `textContent` at phase boundaries. If avoiding JS, use multiple labels with opacity keyframes.

---

## CSS architecture changes

### Replace duplicated durations with variables

Add global variables at the teaser/dialog level:

```css
.vent-modes-teaser,
.vent-modes-dialog__preview {
  --vent-teaser-cycle: 3.6s;
  --vent-teaser-ease: cubic-bezier(0.42, 0, 0.22, 1);
  --vent-teaser-flow-ease: cubic-bezier(0.25, 0.8, 0.25, 1);
  --vent-teaser-glow: rgba(45, 224, 210, 0.7);
  --vent-teaser-patient: rgba(170, 130, 255, 0.75);
  --vent-teaser-exp: rgba(122, 180, 255, 0.45);
}
```

Then update all animations from hard-coded `3.6s` to:

```css
animation-duration: var(--vent-teaser-cycle);
animation-timing-function: var(--vent-teaser-ease);
animation-iteration-count: infinite;
```

**Scope:** Custom properties inherit down the tree. The teaser SVG lives under `.vent-modes-teaser`; the modal preview SVG is under `.vent-modes-dialog__preview`. Defining the same variables on **both** parents (as above) keeps durations aligned. Alternatively, define once on a common ancestor (e.g. `body` scoped to `ventilator/index.html` only, or `.mon-shell--vitals`) so you do not forget the dialog when editing.

### Use one phase map for all keyframes

All keyframes should use the same major stops so the animation stays teachable:

```css
/* Shared conceptual stops:
   0% baseline
   10% trigger
   36% peak inspiratory flow
   52% peak volume / pressure hold
   62% expiratory valve opens
   84% return to baseline
   100% baseline
*/
```

Do not let each animated piece invent unrelated timing. Offset pieces intentionally and document why.

### Suggested keyframes

Keep/replace current keyframes with these conceptual names:

```css
@keyframes vent-teaser-bellows-drive { ... }
@keyframes vent-teaser-lung-inflate { ... }
@keyframes vent-teaser-lung-aeration-sweep { ... }
@keyframes vent-teaser-insp-flow { ... }
@keyframes vent-teaser-exp-flow { ... }
@keyframes vent-teaser-flow-particles { ... }
@keyframes vent-teaser-patient-effort { ... }
@keyframes vent-teaser-machine-trigger { ... }
@keyframes vent-teaser-pressure-label { ... }
@keyframes vent-teaser-wave-draw { ... }
@keyframes vent-teaser-wave-cursor { ... }
```

### Example timing patterns

Bellows:

```css
@keyframes vent-teaser-bellows-drive {
  0%, 10%, 100% { transform: scaleY(1); }
  36% { transform: scaleY(0.62); }
  52% { transform: scaleY(0.68); }
  84% { transform: scaleY(0.98); }
}
```

Lungs:

```css
@keyframes vent-teaser-lung-inflate {
  0%, 10%, 100% { transform: scale(1); }
  36% { transform: scale(1.045); }
  52% { transform: scale(1.075); }
  62% { transform: scale(1.06); }
  84% { transform: scale(1.01); }
}
```

Inspiratory flow:

```css
@keyframes vent-teaser-insp-flow {
  0%, 8% { opacity: 0.12; stroke-dashoffset: 42; }
  14% { opacity: 0.45; }
  36% { opacity: 1; stroke-dashoffset: 0; }
  52% { opacity: 0.55; }
  62%, 100% { opacity: 0; stroke-dashoffset: -36; }
}
```

Expiratory flow:

```css
@keyframes vent-teaser-exp-flow {
  0%, 58% { opacity: 0; stroke-dashoffset: 0; }
  68% { opacity: 0.45; }
  84% { opacity: 0.18; stroke-dashoffset: 30; }
  100% { opacity: 0; stroke-dashoffset: 42; }
}
```

Patient effort:

```css
@keyframes vent-teaser-patient-effort {
  0%, 6%, 22%, 100% { opacity: 0; transform: translateY(0); }
  10% { opacity: 0.9; transform: translateY(1px); }
  14% { opacity: 0.65; transform: translateY(2px); }
}
```

For mandatory breaths, suppress patient effort and use `vent-teaser-machine-trigger` instead.

---

## JS controller recommendation

Keep JS minimal. Do not move the entire animation to JavaScript unless absolutely necessary.

Recommended responsibilities for `js/vent-modes-teaser.js` after improvement:

1. Continue handling dialog open/close.
2. Optionally set `data-vent-mode` on the teaser/modal root.
3. Optionally cycle modes every few breaths in the modal only.
4. Optionally update small label text at phase boundaries.
5. Pause/cancel mode cycling if `prefers-reduced-motion: reduce` is active.

Recommended structure:

```js
(() => {
  const cycleMs = 3600;
  const modes = ['vc', 'pc', 'ps', 'simv', 'aprv'];
  const root = document.querySelector('.vent-modes-teaser');
  const modalPreview = document.querySelector('.vent-modes-dialog__preview');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setVentMode(target, mode) {
    if (!target) return;
    target.dataset.ventMode = mode;
  }

  function setBreathType(target, type) {
    if (!target) return;
    target.dataset.breathType = type;
  }

  // Keep teaser default simple.
  setVentMode(root, 'vc');
  setBreathType(root, 'mandatory');

  // Optional: modal can rotate modes when open.
  // Do not run timers when modal is closed or reduced motion is requested.
})();
```

If JS updates phase labels, do it sparingly. Example labels: `trigger`, `insp flow`, `plateau`, `exhale`, `PEEP`.

---

## Mode-specific CSS hooks

Use data attributes to selectively change animation amplitudes and visibility.

Examples:

```css
[data-vent-mode="vc"] .vent-teaser-wave--flow {
  /* square inspiratory flow */
}

[data-vent-mode="pc"] .vent-teaser-wave--flow {
  /* decelerating inspiratory flow */
}

[data-vent-mode="ps"] .vent-teaser-patient-effort {
  animation-name: vent-teaser-patient-effort;
}

[data-breath-type="mandatory"] .vent-teaser-patient-effort {
  opacity: 0;
}

[data-breath-type="spontaneous"] .vent-teaser-bellows-core {
  /* less bellows compression, more patient cue */
}
```

Do not duplicate the entire SVG for every mode. Reuse geometry and change timing/opacity/paths where possible.

---

## SVG implementation checklist

### Add or refine these elements

- [ ] `vent-teaser-waveforms`: small pressure/flow/volume traces.
- [ ] `vent-teaser-wave-cursor`: phase cursor synced with breath cycle.
- [ ] `vent-teaser-patient-effort`: diaphragm/effort cue for spontaneous or assisted breaths.
- [ ] `vent-teaser-machine-trigger`: machine-trigger cue for mandatory breaths.
- [ ] `vent-teaser-hose-flow--insp`: inspiratory flow stroke.
- [ ] `vent-teaser-hose-flow--exp`: expiratory/release flow stroke.
- [ ] `vent-teaser-valve--insp`: inspiratory valve highlight.
- [ ] `vent-teaser-valve--exp`: expiratory valve highlight.
- [ ] `vent-teaser-phase-label`: tiny phase/pressure label.
- [ ] Optional `vent-teaser-peep-line`: baseline pressure marker in waveform strip.

### Preserve or intentionally rename these existing classes

| Class | Element type | Role |
|-------|--------------|------|
| `vent-teaser-bellows-core` | nested `<svg>` | Bellows compress via `scaleY` |
| `vent-teaser-lung-right` / `vent-teaser-lung-left` | nested `<svg>` | Lungs inflate subtly |
| `vent-teaser-lung-glow-r` / `vent-teaser-lung-glow-l` | `<path>` | Aeration glow opacity/fill cue |
| `vent-teaser-hose-flow` | `<path>` | Current inspiratory jet |
| `vent-teaser-flow-arrows` | `<g>` | Directional arrows |
| `vent-teaser-p-label` | `<g>` | Existing pressure badge |

If replacing `vent-teaser-p-label` with `vent-teaser-phase-label`, update CSS selectors for both teaser and modal.

---

## Visual design direction

The animation should feel like a polished clinical UI, not a cartoon.

### Keep

- Dark monitor-stage background.
- Teal/cyan as the main oxygen/flow color.
- Peach/red lung base fill.
- Subtle glow around active flow and aeration.
- Rounded, compact monitor-strip composition.

### Improve

- Add stronger depth to the bellows: top plate, pleats, and outlet should feel mechanically connected.
- Add a tiny active valve cue so flow does not look like magic gas appearing in the tube.
- Make arrows less chunky and less constantly visible.
- Make lung glow more directional and less like the entire lung is turning neon.
- Use the waveform strip as a real teaching layer, not decorative noise.
- Make the modal preview larger and clearer than the teaser; it can carry more labels.

### Avoid

- Large bouncing lungs.
- Flashing neon everywhere.
- Too much text inside the tiny teaser.
- Random particles that distract from waveform/physiology.
- Animation that looks like a heart beat instead of a ventilator breath.
- Making the teaser so detailed that it becomes unreadable on mobile.

---

## Responsive behavior

Current mobile behavior (`max-width: 520px` in `ventilator.css`) wraps the teaser row: the button moves **above** the visualization, the viz spans full width, and `.vent-modes-teaser__svg` is set to **`height: 56px`** (compact). Do not assume `60px` unless you have changed the stylesheet.

After adding waveforms, test mobile carefully:

- At small widths, either hide waveform labels or show only one combined waveform strip.
- Keep lung/circuit legible first; waveforms are secondary in the teaser.
- The modal preview can show the full pressure/flow/volume traces.
- Use `vector-effect="non-scaling-stroke"` on tiny waveform and axis strokes if needed.
- If the strip feels cramped, **raising** `.vent-modes-teaser__svg` height (e.g. toward 60–64px) is acceptable **only** if the vitals monitor layout still looks balanced — coordinate with the parent flex rules in `.vent-modes-teaser` / `.mon-shell--vitals`.

Suggested CSS (illustrative — **verify** current mobile height first):

```css
@media (max-width: 520px) {
  .vent-teaser-wave-label {
    display: none;
  }

  /* Default in repo is 56px; increase only if waveforms are added and tested */
  /* .vent-modes-teaser__svg { height: 60px; } */
}
```

---

## Accessibility and reduced motion

Preserve `aria-hidden="true"` on the decorative teaser viz wrapper unless the graphic becomes interactive.

For `prefers-reduced-motion: reduce`:

- Stop all looping animations (match the project’s **explicit class list** in `ventilator.css` — extend it when you add new animated classes).
- Show a static representative frame.
- Keep lungs at slight baseline inflation.
- Show static flow/waveform legend if helpful.
- Hide moving particles/cursor.
- Do not run JS mode cycling.

**Avoid** `animation: none !important` on `*` inside the SVG unless you have tested every child: it can fight future `transition` or inherit in unexpected ways. Prefer listing animated selectors (as the repo does today) or a single high-specificity rule on the root SVG that names known layers.

Example pattern (extend selectors when new classes are added):

```css
@media (prefers-reduced-motion: reduce) {
  .vent-modes-teaser__svg svg.vent-teaser-bellows-core,
  .vent-modes-teaser__svg svg.vent-teaser-lung-right,
  .vent-modes-teaser__svg svg.vent-teaser-lung-left,
  .vent-modes-dialog__preview-svg svg.vent-teaser-bellows-core,
  .vent-modes-dialog__preview-svg svg.vent-teaser-lung-right,
  .vent-modes-dialog__preview-svg svg.vent-teaser-lung-left,
  .vent-teaser-lung-glow-r,
  .vent-teaser-lung-glow-l,
  .vent-teaser-hose-flow,
  .vent-teaser-flow-arrows,
  .vent-teaser-p-label {
    animation: none !important;
  }

  .vent-teaser-wave-cursor,
  .vent-teaser-flow-particle {
    display: none;
  }
}
```

---

## Performance constraints

This animation sits inside a vitals monitor UI. Keep it cheap.

- Prefer animating `transform`, `opacity`, and `stroke-dashoffset`.
- Avoid animating expensive filters on many elements.
- Avoid large blurred filters covering the whole SVG.
- Keep the number of particles low.
- Avoid layout-triggering JS loops.
- Do not use `requestAnimationFrame` for this teaser unless replacing the whole design with a simulation, which is not needed now.

---

## Acceptance criteria

Before considering the improvement complete, verify:

1. **Visual clarity**: In a 200×72-ish viewBox, the viewer can still identify bellows, hose, airway, lungs, flow, and pressure/waveform cues.
2. **Physiology timing**: Flow peaks before lung volume; pressure/plateau cue persists briefly after flow slows; expiration is visually distinct from inspiration.
3. **Mode support**: At least `vc`, `pc`, and `ps` have distinct waveform/trigger behavior in the modal. `simv` and `aprv` can be simpler but should not look identical to VC.
4. **No clipping**: Lung expansion, glow, labels, and waveforms are not cut off in teaser or modal.
5. **Unique IDs**: Teaser keeps `vts-*` IDs and dialog keeps `vtd-*` IDs.
6. **Shared timing**: All animation durations use `--vent-teaser-cycle` or a documented multiple of it.
7. **Reduced motion**: Motion stops cleanly and the static frame still looks intentional.
8. **Mobile**: Under 520 px width, the teaser stays compact and does not overflow the monitor strip.
9. **No broken dialog**: `vent-modes-teaser.js` still opens/closes the tutorial dialog correctly.
10. **No dependency bloat**: Do not add React, charting libraries, or canvas unless explicitly requested.

---

## Suggested implementation order for the coding agent

### Pass 1 — Cleanup and timing

1. Add CSS variables for cycle duration and easing (define on a scope that includes **both** `.vent-modes-teaser` and `.vent-modes-dialog__preview`, or on `:root`, so teaser + modal stay locked).
2. Replace hard-coded `3.6s` animation durations with `var(--vent-teaser-cycle)` (or rename if you standardize on `--vent-cycle`).
3. Retune keyframes to the shared physiologic phase map (flow leads volume slightly; plateau readable; expiratory phase distinct).
4. Make lung expansion **lag** flow slightly using intentional keyframe offsets — **not** by adding JS.
5. Keep **feature parity** between teaser and modal: same phase map and variables. **Do not** add waveforms or mode switching in Pass 1 unless you are explicitly combining passes — optional waveform work belongs in Pass 3.

### Pass 2 — Circuit and lung polish

1. Split inspiratory and expiratory flow strokes.
2. Add valve highlights.
3. Add subtle particle/highlight motion only if it remains readable.
4. Adjust lung transform origins closer to the hilum.
5. Add or refine aeration sweep/mask.

### Pass 3 — Waveform strip

1. Add pressure, flow, and volume traces to the modal preview first.
2. Sync traces to the same `--vent-teaser-cycle`.
3. Add a cursor that sweeps once per cycle.
4. Add a smaller simplified waveform strip to the teaser if space allows.
5. Hide labels on mobile.

### Pass 4 — Mode system

1. Add `data-vent-mode` and `data-breath-type` attributes.
2. Implement `vc`, `pc`, and `ps` first.
3. Add simplified `simv` and `aprv` behavior.
4. Use JS only for mode toggling/labels, not frame-by-frame animation.
5. Make the modal the main place for mode comparison.

### Pass 5 — QA

1. Test Chrome/Safari/Firefox if possible.
2. Test desktop and mobile widths.
3. Test reduced motion.
4. Verify no parent container reintroduced `overflow: hidden` clipping.
5. Confirm no duplicate gradient/filter IDs.

---

## Concrete coding prompt for the agent

Use this as the direct instruction to the coding AI agent:

**Reading order:** Skim [`ventilator-teaser-animation-agent-handoff.md`](ventilator-teaser-animation-agent-handoff.md) for the **current** implementation (files, classes, IDs, overflow). Use **this** file (`ventilator_teaser_animation_agent_brief_improved.md`) for the **roadmap**, phase table, and acceptance criteria. Implement in the [suggested pass order](#suggested-implementation-order-for-the-coding-agent).

> Improve the ventilator teaser animation in `ventilator/index.html`, `css/ventilator.css`, and, only if needed, `js/vent-modes-teaser.js`. Preserve the current inline SVG architecture and class naming where possible. The goal is to make the animation more physiologic and educational, not just more decorative. Replace duplicated 3.6s animation durations with CSS variables. Retune all keyframes around one breath phase map: baseline → trigger → inspiratory flow → late inspiration/pressure rise → plateau → passive expiration → PEEP baseline. Add a small synced pressure/flow/volume waveform strip, ideally first in the modal preview and then in simplified form in the teaser if it remains legible. Add visual distinction between mandatory machine breaths and patient-triggered/spontaneous breaths using a small patient-effort/diaphragm cue and a machine-trigger cue. Split inspiratory and expiratory flow into separate SVG strokes, add subtle valve highlights, and make lung inflation lag flow slightly while staying anchored near the hilum. Add `data-vent-mode` and `data-breath-type` hooks so VC, PC, PS, SIMV, and APRV can eventually look different; implement at least clear VC/PC/PS distinctions now through waveform shape, trigger cue, and lung/flow timing. Keep the animation lightweight: CSS transforms, opacity, and stroke-dashoffset only where possible. Preserve unique `vts-*` and `vtd-*` SVG IDs. Preserve reduced-motion behavior, mobile layout, and dialog open/close wiring. Do not add heavy dependencies.

---

## Glossary and implementation pitfalls

### Abbreviations (as used in teaching strips)

| Abbrev. | Typical meaning in this UI |
|---------|----------------------------|
| **Paw** | Airway pressure (simplified; not a full transducer model) |
| **Flow** | Gas flow in the circuit (insp often positive, exp negative in signed convention) |
| **Vt** | Tidal volume (taught as integrated area under flow, or direct V–time rise) |
| **PEEP** | Positive end-expiratory pressure — baseline at end expiration |
| **FRC** | Functional residual capacity — “resting” lung volume at end expiration (teaching shorthand) |
| **VC** / **V–C** | Volume control — set Vt, time-cycled or flow-controlled delivery (simplified) |
| **PC** | Pressure control — set inspiratory pressure target, decelerating flow |
| **PS** | Pressure support — patient-initiated, supported inspiration |
| **SIMV** | Synchronized intermittent mandatory ventilation — mix of mandatory and spontaneous |
| **APRV** | Airway pressure release ventilation — long high pressure, brief release (stylized) |

### Pitfalls (save future agents time)

- **Clipping:** If lungs, glow, or new waveforms vanish at the edges, check `overflow` on `.mon-screen`, `.vent-modes-teaser__viz`, and the root SVG — the handoff doc calls this out explicitly.
- **Unique IDs:** Teaser and dialog share one HTML document; keep **`vts-*`** (teaser) and **`vtd-*`** (dialog) prefixes for every `id` in `defs`.
- **Transform origins:** Moving lung origin to the hilum improves look but **re-test WebKit** (nested SVG + `%` origins).
- **Dynamic label text:** CSS can swap meaning with stacked `<text>` + opacity keyframes; for many labels, a **small JS** `textContent` update at long `setInterval` / `setTimeout` aligned to `cycleMs` is often clearer than a dozen cross-faded text nodes.
- **`offset-path` / motion path** for particles: verify target browser support; prefer stroke-based motion if in doubt.
- **Phase map discipline:** When you add new keyframes, **name or comment the same % stops** across bellows, flow, lungs, and waveforms so the story stays one breath, not four unrelated loops.

---

## Quick grep commands for maintainers

```bash
rg "vent-teaser|vent-modes-teaser" css/ventilator.css
rg "vent-modes-teaser__svg|vent-modes-dialog__preview" ventilator/index.html
rg "vent-modes-tutorial|data-vent-mode|data-breath-type" ventilator/index.html js/vent-modes-teaser.js
```

---

## Definition of a strong final result

A strong final result should make a learner think: “Oh, I can actually see the ventilator delivering flow, the lung filling a little later, pressure/flow/volume changing together, and the difference between a machine breath and patient effort.” It should still fit cleanly in the vitals monitor strip and feel native to the **Yale Anesthesia Tutorial** interface rather than a generic stock animation.
