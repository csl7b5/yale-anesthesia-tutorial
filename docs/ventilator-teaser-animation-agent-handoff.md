# Ventilator teaser SVG animation — agent handoff

This document describes **how the ventilator-modes teaser animation works** in the Yale Anesthesia Tutorial repo so another AI (or developer) can safely refactor or improve it without reverse-engineering the codebase.

---

## Where everything lives

| What | Path |
|------|------|
| **All motion** (keyframes, durations, transform origins) | `css/ventilator.css` — search for `vent-teaser` and `vent-modes-teaser` |
| **Teaser SVG** (monitor strip) | `ventilator/index.html` — `<svg class="vent-modes-teaser__svg" …>` inside `.vent-modes-teaser__viz` |
| **Modal preview SVG** (tutorial dialog, lighter theme) | Same file — `<svg class="vent-modes-dialog__preview-svg" …>` inside the `#vent-modes-tutorial` dialog |
| **Dialog wiring only** (no animation logic) | `js/vent-modes-teaser.js` — opens/closes `<dialog>` |
| **Stylesheet link** | `ventilator/index.html` links `../css/ventilator.css` |

**Important:** The animation is **100% CSS + inline SVG**. There is no `requestAnimationFrame`, no canvas, and no Web Animations API for this teaser.

---

## What the teaser looks like on screen

**Placement:** On `ventilator/index.html`, the graphic sits in the **bottom strip of the vitals monitor** (`flex` grows below the waveform rows and NIBP/temp/gas bar). Left side is the visualization; right side is a teal-outlined button labeled **“Ventilator modes”** with subtitle **“Basics · VC · AC · SIMV · APRV…”**.

**Frame around the SVG:** The diagram lives inside `.vent-modes-teaser__viz` — a rounded rectangle with a **dark radial vignette** (subtle teal glow from below) and a faint border, so the schematic reads like a small “stage” on an almost-black strip.

**Left-to-right read (one static frame):**

1. **Driving bellows** — A vertical **accordion-style** compressor: small handle on top, **metallic gradient** top and bottom plates, zigzag pleats with horizontal “shelf” detail lines, tiny teal tick marks on the right (volume cue), and a **dark rectangular outlet** on the mid-right side of the body feeding a short **bridge** segment.
2. **Breathing circuit** — A thick **corrugated hose** built from stacked strokes (outer dark shell, inner shading, vertical rib marks). It curves gently toward the airway.
3. **Flow cue** — On top of the hose, a thin **teal-gradient stroke** with dashed segments (`stroke-dasharray`) reads as **gas moving** when animated; two small **teal triangular arrows** sit over the hose pointing toward the lungs (they fade in/out with inspiration).
4. **Airway** — A short **trachea** segment, then two curved bronchi (**carina** fork) going up and down.
5. **Lungs** — Two separate **trapezoid-ish lung silhouettes** (not photorealistic): **upper** lobe sits above the carina, **lower** lobe below. Fill is a soft **peachy-to-red gradient**; borders are dusty rose. Each has simple **fissure lines** and a small **bronchial tree** branching from a **hilum dot** on the left edge. A duplicate path with **teal aeration gradient** sits on top for the “glow when inflated” effect.
6. **Pressure badge** — Floating above the hose (around the middle of the scene), a small rounded pill with text **“▲ P cmH₂O”** in teal. It is **mostly invisible** at rest and **fades in during inspiration** as a teaching placeholder for airway pressure (not a numeric waveform).

**Motion narrative (what a viewer sees over ~3.6 seconds):** The bellows **compress vertically** (delivering breath). Simultaneously the hose **jet animates** (dashes appear to travel toward the lungs), **arrows brighten**, the **P badge appears**, and both lungs **slightly scale up** while the **teal lung overlay brightens** (“air filling”). Then the cycle **releases**: bellows expand back, flow cue weakens, lungs relax and glow fades — repeating forever until reduced-motion disables it.

**Modal duplicate:** Opening the tutorial shows a **second, wider SVG** on a **light gray card** (`.vent-modes-dialog__preview`). Same visual story and **same class names** on components, but larger geometry, **different gradient/filter IDs** (`vtd-*`), and adjusted nested-SVG positions so it reads clearly on white.

**Responsive layout:** Under **`max-width: 520px`**, the teaser row **wraps**: the button moves **above** the viz (`order`), the viz spans full width, and `.vent-modes-teaser__svg` gets a fixed **`height: 56px`** (vs ~60px default) so the strip stays compact on phones — `viewBox` scaling handles detail.

---

## What the code looks like (structure and patterns)

**HTML shell (teaser):**

```html
<div class="vent-modes-teaser">
  <div class="vent-modes-teaser__viz" aria-hidden="true">
    <svg class="vent-modes-teaser__svg" viewBox="0 0 200 72" …>
      <defs>… gradients + glow filter …</defs>
      <svg class="vent-teaser-bellows-core" x="…" y="…" width="58" height="64" viewBox="0 0 58 64">…</svg>
      <rect …/>  <!-- bridge -->
      <path …/>  <!-- hose layers -->
      <path class="vent-teaser-hose-flow" …/>
      <g class="vent-teaser-flow-arrows">…</g>
      <line/> <path/> <path/>  <!-- trachea + bronchi -->
      <g class="vent-teaser-p-label">…</g>
      <svg class="vent-teaser-lung-right" …>…</svg>
      <svg class="vent-teaser-lung-left" …>…</svg>
    </svg>
  </div>
  <button class="vent-modes-teaser__btn" id="vent-modes-tutorial-open">…</button>
</div>
```

**Patterns worth preserving:**

- **One outer `<svg>`** with a fixed `viewBox` (`200×72` for the teaser). Everything is positioned with **`x`/`y`** on nested roots — no JavaScript layout.
- **`defs` first** — `linearGradient` for plates, lung fill, lung glow, and jet stroke; `filter` with `feGaussianBlur` + `feMerge` for the soft glow on flow and arrows.
- **Nested `<svg>` widgets** — Each animatable machine part is its **own** `<svg>` with its **own** `viewBox` and dimensions. CSS targets them as `svg.vent-teaser-bellows-core` inside the outer svg. This avoids grouping transforms on `<g>` for origin math.
- **Static vs animated geometry** — Corrugated hose **shell** paths have **no** animation class. Only the **inner jet path** (`vent-teaser-hose-flow`) gets `stroke-dashoffset` animation. Lungs duplicate the outline: **base path** (fill gradient) + **glow path** (class `vent-teaser-lung-glow-r` / `-l`).
- **Dialog copy-paste** — The modal contains **another full SVG** with the same **component class names** but **prefixed IDs** (`vtd-plate`, `vtd-lung`, …). CSS selectors list **both** `.vent-modes-teaser__svg` and `.vent-modes-dialog__preview-svg` so one rule drives teaser + modal.

**CSS file layout:** In `ventilator.css`, teaser animation rules appear **after** the vitals monitor layout block (~line 230+). Order is roughly: container sizes → **transform-origin + animation-name** per component → **shared `@keyframes`** blocks → **`prefers-reduced-motion`** overrides → teaser button styles → dialog preview `.vent-modes-dialog__preview-svg` overflow/size.

**Typical rule shape:**

```css
.vent-modes-teaser__svg svg.vent-teaser-bellows-core {
  transform-origin: 50% 53%;
  transform-box: fill-box;
  animation: vent-teaser-bellows-drive 3.6s ease-in-out infinite;
}
```

No custom properties yet — duration **`3.6s`** is **duplicated** on every animated selector (an improvement opportunity: `--vent-teaser-cycle: 3.6s`).

**JavaScript:** `vent-modes-teaser.js` is an IIFE that grabs `#vent-modes-tutorial`, `#vent-modes-tutorial-open`, close buttons, and wires **click → `showModal()` / `close()`** plus backdrop click-to-dismiss. **Zero** coupling to animation timing.

---

## High-level architecture

1. **Root SVG** (`vent-modes-teaser__svg` or `vent-modes-dialog__preview-svg`) sets `viewBox` and `overflow: visible` (via CSS) so scaled children are not clipped.
2. **Nested `<svg>` elements** carry the animatable “components”:
   - `svg.vent-teaser-bellows-core` — bellows assembly
   - `svg.vent-teaser-lung-right` / `svg.vent-teaser-lung-left` — two lung shapes
3. **Other elements** in the root SVG: corrugated circuit path, animated flow path, arrow group, trachea/bronchi, pressure label group.
4. **CSS** applies `transform` and `opacity` (and `stroke-dashoffset` on the flow line) with **one shared period: 3.6s**, `ease-in-out`, `infinite`.

Nested `<svg>` was chosen because **`transform-origin` + `transform-box: fill-box`** on `<g>` is flaky in some browsers; nested SVG gives a stable fill box for transforms.

---

## CSS hooks (classes an agent should preserve or intentionally rename)

| Class | Element type | Role |
|-------|----------------|------|
| `vent-teaser-bellows-core` | nested `<svg>` | Bellows compress via `scaleY` |
| `vent-teaser-lung-right` / `vent-teaser-lung-left` | nested `<svg>` | Lungs scale subtly (`scale`) |
| `vent-teaser-lung-glow-r` / `vent-teaser-lung-glow-l` | `<path>` | Duplicate lung outline; teal “aeration” glow, opacity keyframes |
| `vent-teaser-hose-flow` | `<path>` | Inspiratory jet along circuit; `stroke-dasharray` + animated `stroke-dashoffset` |
| `vent-teaser-flow-arrows` | `<g>` | Directional arrows; opacity keyframes |
| `vent-teaser-p-label` | `<g>` | Small “▲ P cmH₂O” teaching badge; opacity keyframes only |

**Selectors** target both teaser and modal:

- `.vent-modes-teaser__svg svg.vent-teaser-bellows-core`
- `.vent-modes-dialog__preview-svg svg.vent-teaser-bellows-core`

If you duplicate SVG elsewhere, either reuse these classes or extend the selectors.

---

## Transform origins (critical for look)

- **Bellows:** `transform-origin: 50% 53%` with `transform-box: fill-box` — chosen so vertical compression is **anchored near the side outlet** (approx. outlet mid-height in the 64px-tall nested bellows viewBox), reducing the illusion that the nozzle “pulls away” from the circuit.
- **Lungs:** `transform-origin: 50% 50%` — uniform scale from the **centroid** of each nested lung SVG so the hilum does not appear to slide off the bronchi when scaling.

If an agent changes lung geometry, re-tune `50% 50%` or switch to a fixed pixel origin at the hilum if needed.

---

## Keyframes and timing (single 3.6s breath)

All listed animations use **the same 3.6s duration** so the loop stays in sync.

**Intended phase map (from comments in CSS):**

| Phase | Approx. time % | What should read visually |
|--------|----------------|----------------------------|
| Rest / pre-breath | 0–10% | Bellows full height; little flow |
| Inspiration | ~10–36% | Bellows compress; flow and arrows strong; lungs grow; P label visible |
| Short plateau / hold | ~36–58% | Bellows slightly less compressed; lungs stay expanded; glow high |
| Expiration | ~58–82% | Bellows release; flow calms; lungs shrink |
| End-exp / PEEP | ~82–100% | Return toward baseline |

**Keyframe names** (see `ventilator.css` for exact keyframe stops):

- `vent-teaser-bellows-drive` — `transform: scaleY(1)` → `scaleY(~0.6)` → back to `1`
- `vent-teaser-lung-inflate` — `transform: scale(1)` → `~1.07` → `~1.05` → `1`
- `vent-teaser-glow-pulse` — opacity on glow paths
- `vent-teaser-hose-jet` — `stroke-dashoffset` + opacity on flow path
- `vent-teaser-arrows-show` — opacity on arrow group
- `vent-teaser-p-show` — opacity on pressure label (no transform, for SVG `<g>` compatibility)

**Correlated beats (for matching audio or refactors):** At **36%** of the 3.6s loop, bellows are most compressed, hose dash offset and flow opacity are near their inspiratory peak, and P label is fully visible. **56%** is a short “hold” (bellows ease slightly, lungs still somewhat scaled). **68%** is where P label and arrows are already fading; by **82%** everything is back near baseline. Lung scale peaks around **48%** in the keyframes (slightly after mid-inspiration), not at the same instant as max bellows compression.

---

## SVG `defs` and ID prefixes

- **Teaser** gradients/filters use IDs like `vts-plate`, `vts-lung`, `vts-jet`, `vts-glow`.
- **Dialog preview** uses **`vtd-`*** IDs (`vtd-lung`, `vtd-jet`, etc.) so two SVGs on the same page do not conflict.

An agent editing both copies must keep **unique `id` values** per document or use inline CSS without `url(#…)` references.

---

## Layout / clipping gotchas

These were needed so **scale transforms** are not cut off:

- `.mon-shell--vitals .mon-screen { overflow: visible; }` (overrides a default that clipped the SVG)
- `.vent-modes-teaser__viz` and `.vent-modes-teaser__svg` — `overflow: visible`
- `.vent-modes-dialog__preview-svg` — `overflow: visible`

If animation “disappears at the edges” after a refactor, check parent `overflow` first.

---

## Accessibility

- `@media (prefers-reduced-motion: reduce)` disables the running animations and sets static fallbacks (e.g. solid flow line, fixed glow opacity, pressure label hidden).
- The teaser SVG is in a region with `aria-hidden="true"` on the viz wrapper; keep that pattern if the graphic stays decorative.

---

## Intentional gaps (good improvement targets for an agent)

The current design is a **generic mandatory breath** loop. It does **not** yet encode:

- Distinct **mandatory vs spontaneous** breaths (SIMV / AC nuance)
- Separate timelines for **patient effort** vs **ventilator delivery**
- Real **P–time / flow–time / volume** waveforms tied to the diagram (only a stylized “▲ P” badge exists as a hook)

A reasonable upgrade path:

1. Introduce a **small JS state machine** or CSS custom properties (`--breath-phase`, `--breath-type`) driven by one timeline.
2. Or split keyframes into **two animation names** and toggle class on the root SVG for “mandatory” vs “spontaneous.”
3. Optional: one `<canvas>` or SVG polyline for waveform strip **below** the schematic, synced by the same duration variable.

---

## Checklist before merging animation changes

1. [ ] Teaser and dialog SVGs still use unique `id`s (`vts-` / `vtd-`).
2. [ ] All animated layers share the same duration or a documented multiple (e.g. 2× for slow demo).
3. [ ] `prefers-reduced-motion` still removes motion.
4. [ ] No parent between SVG and viewport reintroduces `overflow: hidden` without testing.
5. [ ] `ventilator/index.html` remains the page that loads `vent-modes-teaser.js` and `ventilator.css` (or update paths if files move).

---

## Quick grep commands for maintainers

```bash
rg "vent-teaser|vent-modes-teaser" css/ventilator.css
rg "vent-modes-teaser__svg|vent-modes-dialog__preview" ventilator/index.html
```

---

*Generated for handoff to downstream AI agents; update this file when behavior or file locations change.*
