# Pyxis Website High-Level Plan

## Vision

Build a web-based anesthesiology education experience centered around a **Pyxis-inspired anesthesia station**. The first version should help learners understand **how anesthesia medications and supplies are spatially organized**, then let them click into drawers and items for **fast, clinically useful learning**.

This should feel like a **clean educational product**, not a literal clone of a hospital device.

---

## Core Product Goal

The website should teach users three things at once:

1. **Where things live**
   - Drawers
   - Supply bins
   - Controlled medication section
   - Main anesthesia medication drawers

2. **What each item is**
   - Drug or equipment name
   - Category
   - Common use in anesthesia

3. **Why it matters**
   - Typical dosing
   - Key side effects
   - Contraindications / cautions
   - Anesthesia pearl / attending-level takeaway

---

## Product Phases

### Phase 1 — v0 Visual Prototype
Goal: Create a clean, stylized Pyxis-inspired cabinet visual.

Includes:
- cabinet silhouette
- monitor
- top supply rack
- controlled-med drawer grid
- main drawers
- side auxiliary box
- future hotspot areas

This phase is mostly about proving that the visual metaphor works.

### Phase 2 — Clickable Educational Pyxis
Goal: Make the cabinet interactive.

Includes:
- clickable drawers
- open/close animations
- medication tiles inside drawers
- right-side detail panel for drugs
- basic search and filtering

### Phase 3 — Education Layer
Goal: Turn the visual into a real teaching tool.

Includes:
- dosing cards
- mechanism
- common anesthesia use cases
- contraindications
- attending pearls
- quick quizzes / recall mode

### Phase 4 — Expanded OR Ecosystem
Goal: Extend the same system to the rest of the anesthesia workspace.

Future modules:
- airway cart
- lines / IV setup
- anesthesia machine
- emergency drugs / code setup
- case-based scenarios

---

## Recommended UX Structure

### Main Layout
Use a three-part structure:

#### 1. Left or center visual area
- stylized Pyxis station
- drawers and supply bins visible
- hover and click states

#### 2. Drawer contents panel
- appears when a drawer is clicked
- shows drugs or equipment as tiles

#### 3. Learning detail panel
- name
- class
- mechanism
- dose
- onset / duration
- side effects
- cautions
- attending pearl

---

## Recommended v0 Drawer Taxonomy

Start small. Suggested first drawers:

1. **Induction**
   - propofol
   - etomidate
   - ketamine
   - midazolam

2. **Paralytics**
   - rocuronium
   - succinylcholine

3. **Pressors / hemodynamic**
   - phenylephrine
   - ephedrine
   - norepinephrine
   - vasopressin

4. **Reversal / rescue**
   - sugammadex
   - neostigmine
   - glycopyrrolate
   - naloxone
   - flumazenil

5. **Supportive / airway-adjacent meds**
   - lidocaine
   - ondansetron
   - dexamethasone
   - atropine

---

## Design Direction

### Recommended approach
Use a **stylized, Pyxis-inspired interface** rather than full photorealism.

Why:
- faster to build
- easier to make visually consistent
- avoids uncanny fake realism
- avoids institutional / branding friction
- better for a v0 educational product

### Visual language
Aim for:
- warm neutral cabinet colors
- subtle shadows
- rounded clinical-industrial forms
- clean typography
- clearly grouped drawers
- restrained labels / callouts

### Avoid for now
- exact branded replication
- AI-generated fake drug photos
- heavy 3D
- overly game-like realism

---

## Technical Direction

### Recommended stack
- **Next.js**
- **React**
- **Tailwind CSS**
- **Framer Motion**

### Data layer
Keep it simple at first:
- static JSON or TypeScript objects
- drawer definitions
- medication metadata

### Suggested components
- `PyxisCabinet`
- `SupplyRack`
- `DrawerGrid`
- `MainDrawer`
- `DrawerContentsPanel`
- `MedicationTile`
- `MedicationDetailPanel`
- `SearchBar`

---

## Content Model

Each drug can follow a compact schema such as:

- `name`
- `class`
- `mechanism`
- `commonUse`
- `dose`
- `onset`
- `duration`
- `sideEffects`
- `cautions`
- `pearl`

This keeps the site fast to scan and clinically useful.

---

## Reference Image

The visual prototype should take inspiration from this reference image:

![Reference Pyxis System](./pyxis_reference.png)

---

## Example Visual Code

Below is the **example React/Tailwind mockup code** that the next AI agent should use as inspiration. It is a visual starting point, not the final architecture.

```tsx
export default function PyxisV0VisualMockup() {
  const miniCells = Array.from({ length: 20 }, (_, i) => i)
  const upperBinsTop = [
    { label: 'Gauze', w: 'w-16' },
    { label: 'Airways', w: 'w-14' },
    { label: 'Syringes', w: 'w-16' },
    { label: 'IV Start', w: 'w-16' },
  ]
  const upperBinsBottom = [
    { label: 'ETT', w: 'w-14' },
    { label: 'Masks', w: 'w-14' },
    { label: 'Tape', w: 'w-14' },
    { label: 'Lines', w: 'w-16' },
  ]

  return (
    <div className="min-h-screen bg-stone-100 p-8 flex items-center justify-center">
      <div className="w-full max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-stone-800">Pyxis-style anesthesia station</h1>
          <p className="text-stone-600 mt-2 max-w-3xl">
            Stylized v0 mockup inspired by a real anesthesia dispensing cart. This is meant for an educational site prototype,
            with a clean cabinet silhouette, drawer hierarchy, supply bins, and monitor area that can later become interactive.
          </p>
        </div>

        <div className="relative mx-auto h-[780px] w-[980px]">
          {/* top supply rack */}
          <div className="absolute left-[495px] top-2 h-[170px] w-[345px] rounded-md border border-stone-500/30 bg-stone-200 shadow-lg">
            <div className="flex h-1/2 gap-2 border-b border-stone-500/20 p-3">
              {upperBinsTop.map((bin) => (
                <div
                  key={bin.label}
                  className={`${bin.w} h-full rounded-sm border border-stone-500/20 bg-white/70 p-2 shadow-inner`}
                >
                  <div className="h-full rounded-sm border border-dashed border-stone-300 bg-stone-50/80 flex items-end justify-center pb-1 text-[10px] uppercase tracking-wide text-stone-500">
                    {bin.label}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex h-1/2 gap-2 p-3">
              {upperBinsBottom.map((bin) => (
                <div
                  key={bin.label}
                  className={`${bin.w} h-full rounded-sm border border-stone-500/20 bg-white/70 p-2 shadow-inner`}
                >
                  <div className="h-full rounded-sm border border-dashed border-stone-300 bg-stone-50/80 flex items-end justify-center pb-1 text-[10px] uppercase tracking-wide text-stone-500">
                    {bin.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* monitor arm */}
          <div className="absolute left-[345px] top-[78px] h-[150px] w-6 rounded-full bg-stone-500/50" />
          <div className="absolute left-[274px] top-[45px] h-[120px] w-[170px] rounded-[24px] border-8 border-slate-800 bg-slate-50 shadow-2xl">
            <div className="flex h-full flex-col items-center justify-center rounded-[14px] bg-white text-center">
              <div className="text-sm font-semibold text-slate-700">Anesthesia Station</div>
              <div className="mt-2 text-xs text-slate-500">Touch screen to begin</div>
            </div>
          </div>
          <div className="absolute left-[250px] top-[154px] h-5 w-[110px] rounded bg-stone-300 shadow" />
          <div className="absolute left-[254px] top-[170px] h-10 w-[130px] skew-x-[-10deg] rounded-md border border-stone-400/30 bg-stone-200 shadow-md" />

          {/* left cabinet body */}
          <div className="absolute left-[170px] top-[220px] h-[410px] w-[230px] rounded-l-[26px] rounded-r-[8px] border border-stone-500/20 bg-[#c6afa0] shadow-xl">
            <div className="absolute left-5 top-12 h-8 w-14 rounded-sm bg-orange-500/80" />
          </div>

          {/* center cabinet top */}
          <div className="absolute left-[385px] top-[220px] h-[68px] w-[300px] rounded-t-[18px] border border-stone-500/20 bg-[#c6afa0] shadow-xl" />

          {/* small controlled drawers */}
          <div className="absolute left-[390px] top-[282px] h-[86px] w-[286px] rounded-sm border border-stone-500/20 bg-[#cbb4a6] px-4 py-3 shadow-lg">
            <div className="grid grid-cols-5 gap-1.5">
              {miniCells.map((cell) => (
                <div
                  key={cell}
                  className="h-7 rounded-[3px] border border-stone-500/20 bg-[#ccb5a8] shadow-sm hover:translate-y-[-1px]"
                />
              ))}
            </div>
          </div>

          {/* long drawers */}
          <div className="absolute left-[385px] top-[365px] h-[54px] w-[300px] rounded-sm border border-stone-500/20 bg-[#c8b1a3] shadow-lg">
            <div className="absolute left-4 top-1/2 h-3 w-[250px] -translate-y-1/2 rounded-full bg-[#b89986] shadow-inner" />
          </div>
          <div className="absolute left-[385px] top-[421px] h-[54px] w-[300px] rounded-sm border border-stone-500/20 bg-[#c8b1a3] shadow-lg">
            <div className="absolute left-4 top-1/2 h-3 w-[250px] -translate-y-1/2 rounded-full bg-[#b89986] shadow-inner" />
          </div>
          <div className="absolute left-[385px] top-[477px] h-[78px] w-[300px] rounded-sm border border-stone-500/20 bg-[#c8b1a3] shadow-lg" />
          <div className="absolute left-[385px] top-[557px] h-[82px] w-[300px] rounded-sm border border-stone-500/20 bg-[#c8b1a3] shadow-lg">
            <div className="absolute left-4 top-1/2 h-4 w-[252px] -translate-y-1/2 rounded-full bg-[#b89986] shadow-inner" />
          </div>
          <div className="absolute left-[385px] top-[641px] h-[62px] w-[300px] rounded-b-[18px] border border-stone-500/20 bg-[#c8b1a3] shadow-lg">
            <div className="absolute left-4 top-1/2 h-4 w-[252px] -translate-y-1/2 rounded-full bg-[#b89986] shadow-inner" />
          </div>

          {/* side sharps / aux box */}
          <div className="absolute left-[686px] top-[520px] h-[155px] w-[112px] rounded-[12px] border border-stone-500/20 bg-[#c6afa0] shadow-lg">
            <div className="absolute right-3 top-3 h-3 w-8 rounded-full bg-[#b89986]" />
            <div className="absolute left-6 top-5 h-1 w-12 rounded-full bg-stone-600/30" />
            <div className="absolute inset-x-0 top-[54px] h-px bg-stone-500/20" />
            <div className="absolute inset-x-0 top-[95px] h-px bg-stone-500/20" />
          </div>

          {/* base and wheels */}
          <div className="absolute left-[176px] top-[694px] h-7 w-[525px] rounded-[18px] bg-[#b99d8d] shadow-xl" />
          {[220, 590].map((x) => (
            <div key={x} className="absolute top-[710px]" style={{ left: x }}>
              <div className="mx-auto h-7 w-3 rounded bg-stone-500" />
              <div className="h-16 w-16 rounded-full border-4 border-stone-400 bg-stone-200 shadow-md" />
            </div>
          ))}

          {/* subtle callouts for interactivity */}
          <div className="absolute left-[736px] top-[240px] rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-stone-700 shadow">
            Supply bins
          </div>
          <div className="absolute left-[708px] top-[334px] rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-stone-700 shadow">
            Controlled drawers
          </div>
          <div className="absolute left-[710px] top-[428px] rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-stone-700 shadow">
            Main drug drawers
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Guidance for the Next AI Agent

Please use the above code as **stylistic inspiration** and not as a rigid final implementation.

What to preserve:
- the overall Pyxis silhouette
- the monitor + supply rack + main drawer hierarchy
- the idea of controlled-med cells above larger drawers
- a clean, educational-product feel

What to improve:
- make the layout componentized
- support interaction states
- make drawers clickable
- add a detail panel for items
- prepare the structure for real drawer data
- Fix some of the visual inconsistencies, such as the keyboard being in a "weird" place, making spacing consistent and logical between drawers.

Priority order:
1. preserve the visual metaphor
2. keep the UI elegant and non-ugly
3. make it easy to turn into an educational interaction model
4. avoid overengineering the first version

---

## Success Criteria for the First Real Build

The first real build is successful if a user can:
- immediately recognize it as a Pyxis-like anesthesia station
- click a drawer
- see medications inside
- click a medication
- learn something useful within a few seconds

That is more important than realism.

---

## Long-Term Direction

Once the Pyxis works well, the same design system can expand into:
- airway cart explorer
- anesthesia machine explorer
- line setup trainer
- induction sequence simulator
- “what would you give now?” hypotension / bradycardia scenarios

The Pyxis module should become the first node in a larger **interactive anesthesia learning environment**.
