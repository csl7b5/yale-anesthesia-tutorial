# Prompt for Coding AI Agent: Build an Interactive Ventilator Tab

You are building a new tab on my website called **Interactive Ventilator**.

The website currently has an `index.html`, and I want a **separate tab / navigation entry** on that page labeled exactly:

**Interactive Ventilator**

This tab should open an anesthesia-focused interactive ventilator training experience.

---

## Reference Assets

Use the following images in the main directory as visual inspiration only:

- `ventilator.jpg`
- `vitalsmonitor.jpg`
- `ventscreen.jpg`
- `bismonitor.jpg`

These are **reference images**, not assets to reproduce exactly. The UI should take inspiration from them while remaining visually consistent as one cohesive anesthesia workstation.

---

## High-Level Product Goal

Build an interactive anesthesia ventilator module that helps learners understand:

1. what is shown on the anesthesia monitor
2. how ventilator waveforms behave
3. how ventilator settings affect physiology
4. how BIS integrates into the anesthetic environment

The result should feel like a **single anesthesia workstation scene**, not three unrelated widgets.

---

## Core Layout

Create a single-page interface inside the **Interactive Ventilator** tab with the following visual structure:

### 1. Main anesthesia vitals monitor
This should be the largest monitor and should take inspiration from `vitalsmonitor.jpg`.

### 2. Ventilator settings / waveform monitor
This should sit nearby and take inspiration from `ventscreen.jpg`, but should be styled so it matches the vitals monitor and overall workstation.

### 3. BIS monitor
This should sit naturally on top of or slightly adjacent to the ventilator setup and take inspiration from `bismonitor.jpg`.

The overall composition should feel like a real anesthesia workstation viewed from the anesthesia side of the OR.

---

## Functional Requirements

# 1. Main Vitals Monitor

Build a monitor that continuously displays anesthesia-relevant physiologic waveforms and numerics.

## Required waveforms
Show these real-time waveforms:

- **ECG**
  - Conceptually 5-lead monitoring
  - Display one primary ECG tracing
  - Also show ST analysis values for:
    - lead II
    - V5
    - aVF

- **Arterial line blood pressure waveform**
  - waveform on screen
  - absolute blood pressure numeric shown on the right

- **Pulse oximetry waveform**
  - waveform on screen
  - SpO2 numeric shown on the right

- **End-tidal CO2 waveform**
  - capnogram waveform on screen
  - ETCO2 numeric shown on the right
  - respiratory rate numeric shown with it

## Additional required numerics / sections
Also include:

- **NIBP** in the bottom left corner
- **temperature** in the middle of the bottom portion of the screen
- in the **lower right corner**, dedicate a section for:
  - MAC
  - end-tidal O2
  - Sevoflurane / Sev concentration

The screen should feel clinically plausible for an anesthesia monitor.

## Suggested vitals behavior
Use realistic default values such as:
- HR around 60–85
- SpO2 around 98–100
- arterial pressure around 110–130 / 60–80
- ETCO2 around 32–40
- RR around 10–16
- temperature around 36.0–37.2
- MAC and gas values consistent with a patient under general anesthesia

Waveforms should be animated continuously.

---

# 2. Ventilator Monitor

Build an anesthesia ventilator monitor that reflects how ventilation is assessed clinically in the OR.

This monitor must be inspired by `ventscreen.jpg`, but should remain visually consistent with the rest of the UI.

The system must represent these four domains:

1. **waveforms**
2. **numeric measurements**
3. **ventilator settings**
4. **alarms**

---

## A. Waveforms

Implement **three continuous time-based ventilator plots** per breath cycle:

### Pressure vs time
Displays airway pressure throughout inspiration and expiration.

Must show:
- peak inspiratory pressure
- baseline PEEP
- optional plateau pressure if inspiratory pause is simulated

Behavior:
- pressure should increase based on airway resistance and lung compliance

### Flow vs time
Displays inspiratory flow and expiratory flow.

Must show:
- inspiratory flow as positive
- expiratory flow as negative

Behavior:
- expiratory flow should decay toward zero
- if expiratory flow does not return to zero before the next breath, that should suggest air trapping

### Volume vs time
Displays delivered and exhaled tidal volume.

Behavior:
- rises during inspiration
- falls during expiration
- mismatch between inspired and expired volume should suggest a leak

These waveforms should run continuously in real time.

---

## B. Numeric Measurements

Numeric values should update at least once per breath and reflect both set and measured parameters.

Include:

- tidal volume (set and exhaled)
- respiratory rate
- minute ventilation
- FiO2
- PEEP
- peak inspiratory pressure
- plateau pressure if modeled
- mean airway pressure
- end-tidal CO2
- optional inspired and expired anesthetic gas concentrations

### Required calculation behavior
- minute ventilation = tidal volume × respiratory rate
- measured values should change when settings change
- measured values should also change when patient physiology changes

---

## C. Ventilator Settings

The user must be able to adjust ventilator settings and immediately see effects on waveforms and numerics.

### Required mode selection
- volume control
- pressure control

### In volume control mode, user-adjustable settings
- tidal volume
- respiratory rate
- PEEP
- FiO2
- inspiratory time or inspiratory flow

### In pressure control mode, user-adjustable settings
- inspiratory pressure
- respiratory rate
- PEEP
- FiO2
- inspiratory time

### Behavior requirement
Changes in settings should immediately propagate to:
- waveform shape
- tidal volumes
- pressures
- minute ventilation
- ETCO2 trends where appropriate

---

## D. Physiologic Model

The simulation should use a simplified but clinically meaningful physiologic model.

Use the relationship:

**Pressure = volume / compliance + flow × resistance**

The model should reflect:

- **Compliance**
  - low compliance increases plateau pressure
  - low compliance reduces lung expansion

- **Resistance**
  - high resistance increases peak pressure
  - high resistance prolongs expiratory flow decay

- **CO2**
  - ETCO2 should be influenced by minute ventilation and simulated metabolic production

The model does not need to be perfect, but it should preserve correct directional relationships.

---

## E. Patient State Layer

Include a patient state control area that modifies physiology independently from ventilator settings.

The user should be able to adjust:

- **compliance**
- **resistance**
- **CO2 production**
- **leak**

Behavior:
- low compliance raises plateau and peak pressures
- high resistance raises peak pressure and prolongs expiration
- high CO2 production raises ETCO2
- leak lowers exhaled tidal volume relative to inspired tidal volume

This can be implemented with sliders, dials, or compact control cards.

---

## F. Alarms

Implement alarms that trigger based on thresholds or inconsistencies.

Required alarms:

- high airway pressure
- low exhaled tidal volume / disconnect
- apnea or low minute ventilation
- high ETCO2
- low ETCO2
- low FiO2

Alarm presentation:
- visible alarm banner or alarm area
- color-coded severity
- persistent until resolved or settings change

---

## G. Real-Time Simulation Behavior

The system should continuously update in real time.

Requirements:
- looping breath cycles
- waveform rendering synchronized to respiratory timing
- numerics recalculated dynamically
- changes in settings or patient physiology should create clinically plausible changes

The design priority is **accurate relationships between variables**, not just visual movement.

---

# 3. BIS Monitor

Include a BIS monitor inspired by `bismonitor.jpg`.

It should sit naturally on top of the ventilator setup and visually feel like part of the workstation.

## Required BIS monitor layout
- **top left:** BIS number
- **top right:** a single EEG line
- **bottom:** a heatmap / spectral panel separating:
  - alpha
  - delta
  - theta
  - beta

The BIS monitor should look clean and readable.

## Suggested BIS behavior
- BIS value should update slowly rather than flicker wildly
- EEG line should animate continuously
- heatmap should visually change over time
- optional relationship: deeper anesthetic state lowers BIS

---

## UI / Design Guidance

### Visual style
The interface should look like a polished anesthesia education product. Please stay visually consistent with the Pyxis system and the rest of the website. 

Use:
- dark clinical monitor backgrounds
- bright waveform colors
- readable numerics
- subtle borders and monitor shells
- consistent spacing and typography

Avoid:
- cartoonish styling
- generic dashboard appearance
- overly game-like visuals
- disconnected widgets with no spatial logic

### Spatial realism
The workstation should look plausibly arranged:
- vitals monitor as primary screen
- ventilator screen nearby
- BIS monitor perched above or adjacent
- controls placed in a way that feels natural for anesthesia learners

---

## Technical Guidance

You may use standard frontend tools appropriate to the existing site, but prefer a simple implementation that is easy to maintain.

Suggested options:
- HTML / CSS / JavaScript if the site is static
- Canvas or SVG for waveforms
- requestAnimationFrame or timed loops for animation
- modular JS classes or components for monitors and simulation logic

### Important implementation guidance
Please separate concerns:

- **UI rendering**
- **waveform generation**
- **physiology / ventilator calculations**
- **alarm logic**
- **user controls**

Do not hardcode everything into one giant script.

---

## Recommended Internal Architecture

Suggested modules:

- `VitalsMonitor`
- `VentilatorMonitor`
- `BISMonitor`
- `VentilatorSimulationEngine`
- `PatientStateModel`
- `AlarmManager`
- `WaveformRenderer`
- `ControlPanel`

---

## Default Initial State

Initialize the experience with a reasonable anesthetized adult patient.

Suggested starting values:
- mode: volume control
- tidal volume: 450–500 mL
- RR: 12
- FiO2: 0.5
- PEEP: 5
- inspiratory time: about 1.0 sec
- compliance: normal
- resistance: normal
- ETCO2: about 35–38
- BIS: 40–55
- Sevo present at a plausible maintenance concentration

---

## What Matters Most

Priority order:

1. make the workstation look coherent
2. make the waveforms animate convincingly
3. make settings affect the simulation in the correct direction
4. make alarms meaningful
5. keep the system readable for medical learners

---

## Deliverable

Please build the **Interactive Ventilator** tab and implement:

- anesthesia vitals monitor
- ventilator waveform/settings monitor
- BIS monitor
- real-time simulation
- user-adjustable settings
- patient state controls
- alarms

The result should be a high-quality educational interface that feels clinically informed and visually cohesive.

---

## Final Instruction

Start with these three monitors only for now:
- vitals monitor
- ventilator monitor
- BIS monitor

Do not yet add:
- airway cart
- infusion pumps
- Pyxis
- OR room background
- full anesthesia machine body

Focus on getting the monitors and physiology right first.
