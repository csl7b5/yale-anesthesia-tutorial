#!/usr/bin/env python3
"""One-off generator for js/pyxis-med-checkins.js — run from repo root: python3 scripts/gen-pyxis-checkins.py"""

import json
from pathlib import Path


def mcq(q, choices, idx, exp):
    assert len(choices) == 4 and 0 <= idx < 4
    return {"question": q, "choices": choices, "correctIndex": idx, "explanation": exp}


DATA = {
    "propofol": {
        "review": mcq(
            "According to this cheatsheet, propofol's primary molecular target is:",
            [
                "Ligand-gated GABA-A receptors (positive modulation)",
                "NMDA receptors (non-competitive antagonism)",
                "Nicotinic acetylcholine receptors",
                "Mu-opioid receptors",
            ],
            0,
            "The mechanism field describes positive modulation of GABA through ligand-gated GABA-A receptors.",
        ),
        "clinical": mcq(
            "The attending pearl compares strategies to reduce propofol injection pain. What does it emphasize as most effective?",
            [
                "Using an antecubital vein instead of a hand vein",
                "Giving only lidocaine pretreatment with a tourniquet",
                "Switching to etomidate instead",
                "Diluting propofol with sterile water before injection",
            ],
            0,
            "The pearl cites BMJ data: antecubital vein use reduced pain incidence most versus hand veins; lidocaine with venous occlusion is also helpful.",
        ),
    },
    "etomidate": {
        "review": mcq(
            "Etomidate produces hypnosis primarily through:",
            [
                "Positive modulation of GABA-A receptors",
                "Inhibition of NMDA receptors",
                "Blockade of sodium channels in peripheral nerves",
                "Selective alpha-1 adrenergic agonism",
            ],
            0,
            "The cheatsheet lists positive GABA-A receptor modulation as etomidate's mechanism.",
        ),
        "clinical": mcq(
            "Why does the cheatsheet urge caution using etomidate in septic shock or critically ill children?",
            [
                "It inhibits 11β-hydroxylase and can cause adrenal suppression",
                "It irreversibly damages renal tubular cells",
                "It triggers malignant hyperthermia via RYR1",
                "It blocks plasma cholinesterase and prolongs succinylcholine",
            ],
            0,
            "Cautions reference adrenal suppression from 11β-hydroxylase inhibition as the rationale in septic shock and critically ill pediatric patients.",
        ),
    },
    "ketamine": {
        "review": mcq(
            "Ketamine's primary receptor mechanism in this cheatsheet is:",
            [
                "Non-competitive antagonism of NMDA receptors",
                "Positive modulation of GABA-A receptors",
                "Competitive blockade of nicotinic receptors",
                "Selective mu-opioid agonism",
            ],
            0,
            "Mechanism states ketamine is a non-competitive NMDA receptor antagonist.",
        ),
        "clinical": mcq(
            "The pearl warns that in catecholamine-depleted states ketamine may cause cardiovascular collapse because:",
            [
                "Indirect sympathomimetic masking fails to offset direct myocardial depression",
                "It releases histamine and drops SVR suddenly",
                "It blocks β-receptors at clinical doses",
                "It increases intracranial pressure in all patients",
            ],
            0,
            "The pearl explains ketamine is a direct myocardial depressant; sympathetic stimulation usually masks this unless catecholamines are depleted.",
        ),
    },
    "midazolam": {
        "review": mcq(
            "Midazolam enhances inhibition mainly by:",
            [
                "Positive allosteric modulation of GABA-A receptors",
                "Competitive antagonism at glycine receptors",
                "Selective H1 receptor blockade",
                "Irreversible acetylcholinesterase inhibition",
            ],
            0,
            "Mechanism: positive allosteric modulator of GABA-A receptors.",
        ),
        "clinical": mcq(
            "When co-administered with opioids, the cheatsheet recommends:",
            [
                "Reduce midazolam dose by about 30–50%",
                "Double the midazolam dose for synergy",
                "Avoid midazolam entirely in all patients",
                "Switch to diazepam instead at equal mg doses",
            ],
            0,
            "Cautions say profound respiratory depression occurs with opioids—reduce midazolam dose by 30–50%.",
        ),
    },
    "rocuronium": {
        "review": mcq(
            "Rocuronium causes paralysis by:",
            [
                "Competitive antagonism at nicotinic acetylcholine receptors at the motor end-plate",
                "Depolarizing the motor end-plate like succinylcholine",
                "Blocking voltage-gated sodium channels in nerves",
                "Inhibiting acetylcholine synthesis in the synapse",
            ],
            0,
            "Mechanism describes competitive antagonism at nicotinic receptors; reversal includes anticholinesterase inhibitors and sugammadex.",
        ),
        "clinical": mcq(
            "The pearl notes sugammadex at what dose can reverse profound rocuronium block within minutes?",
            [
                "16 mg/kg",
                "0.4 mg neostigmine per kg",
                "2 mg/kg only",
                "1 mg atropine IV",
            ],
            0,
            "The pearl states sugammadex 16 mg/kg can fully reverse profound rocuronium-induced block within about 3 minutes.",
        ),
    },
    "succinylcholine": {
        "review": mcq(
            "Succinylcholine produces neuromuscular block by:",
            [
                "Binding nicotinic receptors and depolarizing the motor end-plate (depolarizing NMBA)",
                "Competitive antagonism without depolarization",
                "Blocking muscarinic receptors in the heart only",
                "Inhibiting calcium release from the sarcoplasmic reticulum",
            ],
            0,
            "Mechanism: binds nicotinic receptors, sustained depolarization, fasciculations, then block; metabolized by plasma cholinesterase.",
        ),
        "clinical": mcq(
            "According to the pearl, an early sign of malignant hyperthermia after triggering agents is often:",
            [
                "Rising ETCO₂ (hypercapnia) before fever",
                "Immediate focal seizure activity",
                "Profound bradycardia without fasciculations",
                "Fixed pupils before any muscle rigidity",
            ],
            0,
            "The pearl emphasizes rising ETCO₂ as an early MH sign; fever may be late.",
        ),
    },
    "vecuronium": {
        "review": mcq(
            "The mechanism line states vecuronium's competitive nicotinic block is reversed by:",
            [
                "Acetylcholinesterase inhibitors (e.g., neostigmine, edrophonium, pyridostigmine)",
                "Selective benzodiazepine antagonists (flumazenil)",
                "Irreversible organophosphate nerve agents",
                "H1 antihistamines (diphenhydramine)",
            ],
            0,
            "Mechanism explicitly lists acetylcholinesterase inhibitors; sugammadex is a separate encapsulation strategy for aminosteroids (see rocuronium pearl).",
        ),
        "clinical": mcq(
            "The pearl contrasts vecuronium with rocuronium: what is highlighted as vecuronium's hemodynamic profile?",
            [
                "Essentially hemodynamically silent (no histamine release)",
                "Consistent severe tachycardia at intubating doses",
                "Predominant hypotension via histamine release",
                "Bradycardia requiring glycopyrrolate with every dose",
            ],
            0,
            "The pearl calls vecuronium hemodynamically silent with no histamine release versus rocuronium's faster onset and sugammadex-driven adoption.",
        ),
    },
    "cisatracurium": {
        "review": mcq(
            "Cisatracurium clearance that is independent of liver and kidney in this cheatsheet relies on:",
            [
                "Organ-independent Hofmann elimination (spontaneous chemical degradation)",
                "Renal excretion of unchanged drug only",
                "Hepatic glucuronidation exclusively",
                "Plasma cholinesterase hydrolysis like succinylcholine",
            ],
            0,
            "Pearl: defining feature is Hofmann elimination—independent of hepatic or renal function.",
        ),
        "clinical": mcq(
            "For ICU patients with multiorgan failure, the pearl favors cisatracurium largely because:",
            [
                "Recovery is less prone to extreme prolongation than some alternatives in organ failure",
                "It does not require neuromuscular monitoring",
                "It provides analgesia through NMDA blockade",
                "It is reversed only by sugammadex",
            ],
            0,
            "The ICU comparison in the pearl notes far fewer prolonged recovery cases vs vecuronium with cisatracurium's Hofmann elimination.",
        ),
    },
    "phenylephrine": {
        "review": mcq(
            "Phenylephrine's primary adrenergic activity in this cheatsheet is:",
            [
                "Selective alpha-1 agonism (no beta activity)",
                "Nonselective alpha and beta agonism like epinephrine",
                "Primarily beta-2 bronchodilation",
                "Indirect release of norepinephrine only",
            ],
            0,
            "Mechanism: selective alpha-1 agonist; reflex bradycardia as BP rises.",
        ),
        "clinical": mcq(
            "The pearl suggests ephedrine over phenylephrine when hypotension is accompanied by:",
            [
                "Bradycardia or dependence on heart rate for cardiac output",
                "Uncontrolled hypertension",
                "Severe reactive airway disease only",
                "Acute vasodilatory shock with normal heart rate",
            ],
            0,
            "Pearl: phenylephrine can drop CO via reflex bradycardia; ephedrine adds beta inotropy/chronotropy for bradycardic hypotension.",
        ),
    },
    "ephedrine": {
        "review": mcq(
            "Ephedrine raises blood pressure through mechanisms that include:",
            [
                "Direct alpha/beta agonism and indirect norepinephrine release",
                "Pure V1 vasopressin receptor agonism",
                "Selective alpha-1 agonism without beta effects",
                "Acetylcholinesterase inhibition at the synapse",
            ],
            0,
            "Mechanism lists direct alpha-1, beta-1, beta-2 agonism and indirect NE release.",
        ),
        "clinical": mcq(
            "When repeated ephedrine boluses become ineffective, the cheatsheet recommends:",
            [
                "Switching to a direct-acting agent such as phenylephrine or norepinephrine",
                "Doubling ephedrine indefinitely",
                "Adding only flumazenil",
                "Stopping all pressors and fluid only",
            ],
            0,
            "Cautions describe tachyphylaxis from depletion of NE stores—switch to direct-acting agents.",
        ),
    },
    "norepinephrine": {
        "review": mcq(
            "Relative to pure alpha-1 agonism, norepinephrine in this cheatsheet also provides:",
            [
                "Modest beta-1 activity that helps maintain cardiac output",
                "Primarily beta-2 bronchodilation at infusion doses",
                "Muscarinic antagonism",
                "NMDA receptor blockade",
            ],
            0,
            "Mechanism: potent alpha-1 with modest beta-1 activity; differs from phenylephrine (pure alpha).",
        ),
        "clinical": mcq(
            "Before starting norepinephrine for shock, the cheatsheet stresses:",
            [
                "Correct hypovolemia first",
                "Always deliver through arterial line only",
                "Avoid central venous access entirely",
                "Give a fixed 1 mg bolus before infusion",
            ],
            0,
            "Cautions warn NE in hypovolemia causes severe vasoconstriction with poor organ perfusion despite 'normal' BP.",
        ),
    },
    "vasopressin": {
        "review": mcq(
            "Vasopressin's vasoconstrictor effect in this cheatsheet is mediated mainly through:",
            [
                "V1 receptors on vascular smooth muscle",
                "Beta-1 adrenergic receptors",
                "Nicotinic receptors at the NMJ",
                "Dihydropyridine L-type calcium channels on myocytes only",
            ],
            0,
            "Mechanism: V1 receptor binding → vasoconstriction; works when acidosis impairs adrenergic receptors.",
        ),
        "clinical": mcq(
            "Per the pearl, vasopressin is often added when norepinephrine reaches roughly:",
            [
                "About 0.25–0.5 mcg/kg/min",
                "Below 0.01 mcg/kg/min",
                "Any dose if sodium >150 mEq/L",
                "Only after phenylephrine failure at 100 mcg total",
            ],
            0,
            "Pearl references Surviving Sepsis-style addition around 0.25–0.5 mcg/kg/min NE.",
        ),
    },
    "epinephrine": {
        "review": mcq(
            "Epinephrine's receptor profile summarized here includes:",
            [
                "Potent β1, moderate β2, and α1 agonism",
                "Pure alpha-1 agonism only",
                "Selective beta-1 blockade",
                "Mu-opioid agonism",
            ],
            0,
            "Mechanism lists potent β1, moderate β2, and α1 agonism.",
        ),
        "clinical": mcq(
            "The mnemonic in the pearl contrasts concentrations for:",
            [
                "Cardiac arrest (1:10,000) vs anaphylactic shock loads (1:100,000)",
                "Adults vs pediatrics only",
                "IV vs IM routes exclusively",
                "Central line vs peripheral line without dose change",
            ],
            0,
            "Pearl: '1:10,000 for codes (cardiac arrest), 1:100,000 for loads (anaphylactic shock/hypotension).' Match institution protocols.",
        ),
    },
    "metoprolol": {
        "review": mcq(
            "Metoprolol is described here primarily as:",
            [
                "A competitive β1-selective adrenergic antagonist",
                "A non-selective beta-blocker with ISA",
                "A calcium channel blocker",
                "An angiotensin receptor blocker",
            ],
            0,
            "Class/mechanism: β1-selective competitive antagonist.",
        ),
        "clinical": mcq(
            "The POISE-related pearl warns against:",
            [
                "Starting high-dose metoprolol on the day of surgery in naive patients",
                "Continuing chronic beta-blockers perioperatively",
                "Using esmolol for acute rate control",
                "Giving metoprolol only orally",
            ],
            0,
            "Pearl: high-dose metoprolol started day-of-surgery increased stroke/mortality; continue chronic beta-blockers instead of abrupt withdrawal.",
        ),
    },
    "nicardipine": {
        "review": mcq(
            "Nicardipine's predominant hemodynamic effect at therapeutic doses here is:",
            [
                "Arterial vasodilation via L-type calcium channel blockade in vascular smooth muscle",
                "AV nodal blockade like verapamil",
                "Beta-1 receptor antagonism",
                "Central alpha-2 agonism",
            ],
            0,
            "Mechanism: dihydropyridine L-type Ca channel inhibition → peripheral arterial vasodilation.",
        ),
        "clinical": mcq(
            "To reduce thrombophlebitis risk with peripheral nicardipine infusions, the pearl advises:",
            [
                "Rotate peripheral IV sites about every 12 hours or use central access",
                "Never exceed 1 mg/hr infusion rate",
                "Only administer IM",
                "Co-infuse with potassium chloride routinely",
            ],
            0,
            "Pearl and cautions emphasize changing peripheral IV sites every 12 hours or central line.",
        ),
    },
    "esmolol": {
        "review": mcq(
            "Esmolol is cleared primarily by:",
            [
                "RBC esterases (organ-independent ultra-short acting)",
                "Hepatic P450 metabolism only",
                "Renal filtration unchanged",
                "Plasma cholinesterase identical to succinylcholine",
            ],
            0,
            "Pearl: metabolism by RBC esterases—not plasma cholinesterases or hepatic enzymes.",
        ),
        "clinical": mcq(
            "A 2025 meta-analysis cited in the pearl reported esmolol infusion reduces intraoperative opioid consumption by about:",
            [
                "32%",
                "90%",
                "3%",
                "0% (no effect)",
            ],
            0,
            "Pearl states ~32% reduction in intraoperative opioids and ~39% postoperative with lower pain scores.",
        ),
    },
    "hydralazine": {
        "review": mcq(
            "Hydralazine lowers blood pressure mainly by:",
            [
                "Direct relaxation of arteriolar smooth muscle (↓ SVR)",
                "Selective beta-1 receptor blockade",
                "Competitive mu-opioid antagonism",
                "Inhibition of angiotensin-converting enzyme",
            ],
            0,
            "Mechanism: direct arterial vasodilator preferentially arterioles.",
        ),
        "clinical": mcq(
            "Why does the ACC/AHA pearl call hydralazine a poor first-line agent for many acute perioperative hypertensive crises?",
            [
                "Onset is delayed/unpredictable and duration is long without an easy off-switch",
                "It always causes fatal methemoglobinemia",
                "It cannot be given IV",
                "It only works in patients with pheochromocytoma",
            ],
            0,
            "Pearl: unpredictable peak (10–80 min) and 2–4 h duration—titratable agents preferred perioperatively.",
        ),
    },
    "sugammadex": {
        "review": mcq(
            "Sugammadex reverses neuromuscular block by:",
            [
                "Encapsulating aminosteroid NMBAs like rocuronium and vecuronium",
                "Inhibiting acetylcholinesterase",
                "Activating GABA-A receptors",
                "Blocking nicotinic receptors permanently",
            ],
            0,
            "Mechanism: selective relaxant binding agent encapsulates aminosteroids in 1:1 ratio.",
        ),
        "clinical": mcq(
            "The cheatsheet warns patients may need backup contraception because sugammadex:",
            [
                "Binds steroidal hormones including hormonal contraceptives (equivalent to missing roughly one pill)",
                "Always causes permanent infertility",
                "Contains estrogen itself",
                "Induces vomiting that inactivates all oral drugs",
            ],
            0,
            "Cautions mention hormonal contraceptive binding—backup ~7 days.",
        ),
    },
    "neostigmine": {
        "review": mcq(
            "Neostigmine reverses nondepolarizing block by:",
            [
                "Inhibiting acetylcholinesterase so acetylcholine outcompetes the NMBA",
                "Encapsulating rocuronium in a cyclodextrin ring",
                "Blocking muscarinic receptors only",
                "Activating GABA-A chloride channels",
            ],
            0,
            "Mechanism: acetylcholinesterase inhibition increases acetylcholine at the NMJ.",
        ),
        "clinical": mcq(
            "The pearl suggests neostigmine works best when Train-of-Four ratio is at least roughly:",
            [
                "≥0.4 ('minimal block') for reliable reversal within ~10 minutes",
                "Exactly 0.0 (complete paralysis)",
                "Only after sugammadex failure exclusively",
                "Before any twitch returns regardless of ratio",
            ],
            0,
            "Pearl: ideally give at TOF ratio ≥0.4; deeper block yields long waits.",
        ),
    },
    "glycopyrrolate": {
        "review": mcq(
            "Compared with atropine, glycopyrrolate is a quaternary ammonium anticholinergic that:",
            [
                "Does not cross the blood–brain barrier well (minimal CNS anticholinergic effects)",
                "Always crosses the BBB faster than atropine",
                "Acts only on nicotinic receptors",
                "Is metabolized solely by Hofmann elimination",
            ],
            0,
            "Mechanism/pearl: quaternary structure limits CNS penetration versus tertiary atropine.",
        ),
        "clinical": mcq(
            "For neuromuscular reversal pairing, a typical neostigmine:glycopyrrolate ratio cited here is:",
            [
                "About 0.2 mg glycopyrrolate per 1 mg neostigmine",
                "10 mg glycopyrrolate per 1 mg neostigmine",
                "Equal milligram doses of each",
                "Never combine them in the same syringe",
            ],
            0,
            "Dose section lists reversal pairing of ~0.2 mg glycopyrrolate per 1 mg neostigmine.",
        ),
    },
    "naloxone": {
        "review": mcq(
            "Naloxone reverses opioid effects by:",
            [
                "Competitive displacement of opioids from receptors without intrinsic opioid activity",
                "Irreversible alkylation of opioid receptors",
                "Agonism at kappa receptors only",
                "Inhibiting cyclooxygenase enzymes",
            ],
            0,
            "Mechanism: competitive displacement; no intrinsic opioid activity.",
        ),
        "clinical": mcq(
            "The postoperative pearl emphasizes:",
            [
                "Titrate small incremental doses to reverse respiratory depression while preserving analgesia",
                "Always give 10 mg as first dose",
                "Avoid repeat dosing entirely",
                "Use flumazenil instead for all opioid overdoses",
            ],
            0,
            "Pearl: titrate small doses (e.g., 0.04–0.1 mg) rather than slamming large boluses.",
        ),
    },
    "flumazenil": {
        "review": mcq(
            "Flumazenil reverses benzodiazepines by:",
            [
                "Competitive inhibition at the benzodiazepine site on GABA-A receptors",
                "Encapsulating midazolam in cyclodextrin",
                "Blocking 5-HT3 receptors",
                "Mu-opioid receptor antagonism",
            ],
            0,
            "Mechanism: competitive inhibition at GABA-A benzodiazepine binding site.",
        ),
        "clinical": mcq(
            "The pearl calls flumazenil dangerous in unknown ED overdoses partly because it may:",
            [
                "Precipitate seizures in benzodiazepine-dependent patients and unmask TCA cardiotoxicity",
                "Always cure respiratory acidosis",
                "Reverse opioids completely",
                "Treat hyperkalemia from succinylcholine",
            ],
            0,
            "Pearl highlights seizure risk with chronic benzo use and co-ingestions; naloxone may be safer if opioids suspected.",
        ),
    },
    "diphenhydramine": {
        "review": mcq(
            "Diphenhydramine's primary anti-allergy mechanism here is:",
            [
                "Competitive antagonism at H1 histamine receptors",
                "Selective serotonin reuptake inhibition",
                "Irreversible COX-1 inhibition",
                "NMDA receptor antagonism",
            ],
            0,
            "Mechanism: competitive H1 antagonist with anticholinergic/CNS penetration.",
        ),
        "clinical": mcq(
            "For anaphylaxis, the dose section positions diphenhydramine as:",
            [
                "An adjunct after epinephrine",
                "First-line instead of epinephrine",
                "Contraindicated with any IV access",
                "Only intranasal route",
            ],
            0,
            "Dose line lists anaphylaxis adjunct 25–50 mg IV after epinephrine.",
        ),
    },
    "ketorolac": {
        "review": mcq(
            "Ketorolac's analgesic mechanism is:",
            [
                "Inhibition of cyclooxygenase (prostaglandin synthesis blockade)",
                "NMDA receptor antagonism",
                "Mu-opioid receptor partial agonism",
                "Selective 5-HT3 antagonism",
            ],
            0,
            "Mechanism: inhibits prostaglandin synthetase (COX).",
        ),
        "clinical": mcq(
            "The 'rule of 15s and 30s' pearl refers to:",
            [
                "Halving the IV dose (15 mg) for elderly, renal impairment, or <50 kg vs 30 mg standard",
                "Giving only on postoperative day 15",
                "Limiting infusions to 30 seconds total",
                "Using 15 tablets per day indefinitely",
            ],
            0,
            "Pearl: cut dose to 15 mg IV for elderly/renal/<50 kg vs 30 mg.",
        ),
    },
    "lidocaine": {
        "review": mcq(
            "As summarized here, lidocaine as a local anesthetic works mainly by:",
            [
                "Weak sodium channel blockade preventing nerve depolarization",
                "Selective GABA-A potentiation",
                "Irreversible nicotinic blockade",
                "Alpha-1 agonism",
            ],
            0,
            "Mechanism: weak Na+ channel blockade; local anesthetic section.",
        ),
        "clinical": mcq(
            "For LAST (local anesthetic systemic toxicity), early warning signs classically include:",
            [
                "CNS symptoms like perioral numbness, tinnitus, or agitation before cardiovascular collapse",
                "Immediate hyperkalemia on BMP",
                "Fixed miotic pupils only",
                "Bradycardia without any prodrome",
            ],
            0,
            "Pearl/cautions: CNS toxicity often precedes cardiovascular toxicity—early symptoms are warning signs.",
        ),
    },
    "ondansetron": {
        "review": mcq(
            "Ondansetron's antiemetic class mechanism here is:",
            [
                "Selective 5-HT3 receptor antagonism",
                "Dopamine D2 antagonism",
                "Mu-opioid agonism",
                "Irreversible COX inhibition",
            ],
            0,
            "Mechanism: selective 5-HT3 antagonist.",
        ),
        "clinical": mcq(
            "QT prolongation risk with ondansetron is especially important in:",
            [
                "Congenital long QT syndrome and electrolyte abnormalities",
                "Patients with isolated hypertension only",
                "Anyone receiving sugammadex",
                "Only neonates under 1 kg",
            ],
            0,
            "Cautions: avoid congenital LQTS; caution with electrolyte issues and other QT drugs.",
        ),
    },
    "dexamethasone": {
        "review": mcq(
            "Dexamethasone reduces nausea/emesis through pathways that include:",
            [
                "Central antiemetic effects and reduced opioid requirement (among other steroid mechanisms)",
                "Only peripheral H1 blockade",
                "Pure nicotinic antagonism",
                "Irreversible COX-2 inhibition exclusively",
            ],
            0,
            "Mechanism lists central actions, serotonin/NK1 interactions, reduced opioid-related nausea.",
        ),
        "clinical": mcq(
            "Summaries cited in the pearl suggest single perioperative dexamethasone doses:",
            [
                "Do not convincingly increase surgical site infection risk in meta-analyses",
                "Always cause catastrophic wound dehiscence",
                "Are banned by ASA for all diabetics",
                "Must never exceed 0.25 mg IV",
            ],
            0,
            "Pearl references meta-analyses showing no meaningful SSI increase at single doses.",
        ),
    },
    "atropine": {
        "review": mcq(
            "Compared with glycopyrrolate, atropine is a tertiary amine anticholinergic that:",
            [
                "Crosses the blood–brain barrier and can cause CNS anticholinergic effects",
                "Never enters the CNS",
                "Acts only on vascular smooth muscle V1 receptors",
                "Is encapsulated by sugammadex",
            ],
            0,
            "Mechanism: tertiary amine crosses BBB → delirium/CNS effects possible.",
        ),
        "clinical": mcq(
            "Paradoxical bradycardia with low-dose IV atropine in adults is addressed by:",
            [
                "Giving at least 0.5 mg IV doses for symptomatic bradycardia",
                "Avoiding atropine entirely below age 65",
                "Switching to phenylephrine first always",
                "Using only IM dosing",
            ],
            0,
            "Cautions: paradox bradycardia at low doses—give ≥0.5 mg in adults.",
        ),
    },
    "cefazolin": {
        "review": mcq(
            "Cefazolin's antibacterial activity summarized here works mainly by:",
            [
                "Inhibiting bacterial cell wall synthesis (β-lactam cephalosporin)",
                "Inhibiting bacterial DNA gyrase",
                "Blocking the 50S ribosome",
                "Dissolving fungal cell membranes",
            ],
            0,
            "Mechanism: bactericidal β-lactam inhibiting cell wall synthesis.",
        ),
        "clinical": mcq(
            "The pearl states cefazolin may be reasonable with:",
            [
                "Non-anaphylactic penicillin allergy (true IgE-mediated penicillin anaphylaxis remains a concern)",
                "Any documented penicillin rash without further evaluation",
                "Known MRSA infection as sole therapy",
                "History of anaphylaxis to any cephalosporin — routinely retry cefazolin",
            ],
            0,
            "Pearl: generally safe with non-anaphylactic penicillin allergy; avoid IgE-mediated penicillin anaphylaxis.",
        ),
    },
    "fentanyl": {
        "review": mcq(
            "Approximate equipotency stated here is that 100 mcg fentanyl ≈:",
            [
                "About 10 mg morphine IV equivalence (order-of-magnitude)",
                "100 mg morphine",
                "1 mg morphine",
                "No relation to morphine",
            ],
            0,
            "Mechanism line gives 100 mcg fentanyl ≈ 10 mg morphine ≈ 75 mg meperidine.",
        ),
        "clinical": mcq(
            "For severe chest wall rigidity after rapid high-dose fentanyl, the pearl prioritizes:",
            [
                "Neuromuscular blockade (not relying on naloxone first)",
                "Immediate massive naloxone bolus only",
                "Halting oxygen and waiting",
                "Oral benzodiazepines only",
            ],
            0,
            "Pearl: treat rigid chest with NMB—naloxone is not the first-line fix for ventilation.",
        ),
    },
    "hydromorphone": {
        "review": mcq(
            "Hydromorphone's potency versus morphine in this cheatsheet is roughly:",
            [
                "About 5× more potent (mu agonist)",
                "About equal mg-for-mg",
                "100× less potent",
                "Primarily a local anesthetic",
            ],
            0,
            "Mechanism states approximately 5× more potent than morphine.",
        ),
        "clinical": mcq(
            "Why might hydromorphone be favored over morphine when renal function is impaired?",
            [
                "Morphine's active M6G metabolite accumulates in renal failure more problematically",
                "Hydromorphone has zero hepatic metabolism",
                "Morphine has no active metabolites",
                "Hydromorphone is always contraindicated in renal failure",
            ],
            0,
            "Pearl contrasts morphine-6-glucuronide accumulation vs hydromorphone metabolites in renal impairment.",
        ),
    },
    "morphine": {
        "review": mcq(
            "Morphine's clinically relevant active metabolite described here is:",
            [
                "Morphine-6-glucuronide (M6G) via hepatic glucuronidation",
                "Normeperidine",
                "O-desmethyltramadol",
                "7-hydroxymitragynine",
            ],
            0,
            "Mechanism: metabolized to M3G (inactive) and M6G (active analgesic).",
        ),
        "clinical": mcq(
            "The pearl recommends avoiding morphine and preferring agents like fentanyl/hydromorphone when:",
            [
                "Renal impairment causes accumulation of active metabolites with delayed respiratory depression",
                "Patient has reactive airway disease only",
                "Patient requests oral acetaminophen",
                "Patient is hyperthyroid",
            ],
            0,
            "Pearl: M6G accumulates in renal impairment → delayed respiratory depression.",
        ),
    },
    "lorazepam": {
        "review": mcq(
            "Lorazepam produces sedation primarily by:",
            [
                "Positive allosteric modulation of GABA-A receptors",
                "NMDA antagonism",
                "Selective H1 blockade",
                "Acetylcholinesterase inhibition",
            ],
            0,
            "Mechanism: GABA-A positive allosteric modulator.",
        ),
        "clinical": mcq(
            "High-dose or prolonged lorazepam IV infusions risk toxicity from:",
            [
                "Propylene glycol vehicle causing metabolic acidosis and renal injury",
                "Excessive sugammadex binding",
                "Iron overload",
                "Hyperkalemia from succinylcholine",
            ],
            0,
            "Pearl/cautions: propylene glycol toxicity with prolonged high-dose IV lorazepam.",
        ),
    },
    "meperidine": {
        "review": mcq(
            "Meperidine's problematic metabolite emphasized here is:",
            [
                "Normeperidine (neuroexcitatory, accumulates especially with renal impairment)",
                "Morphine-6-glucuronide",
                "M1 tramadol metabolite",
                "Laudanosine",
            ],
            0,
            "Mechanism: normeperidine metabolite with long half-life and seizure risk.",
        ),
        "clinical": mcq(
            "Meperidine is absolutely contraindicated with:",
            [
                "MAOIs (risk of fatal excitatory syndrome)",
                "Stable hypertension alone",
                "All NSAIDs universally",
                "Patients older than 40 years only",
            ],
            0,
            "Cautions: MAOI interaction can be fatal—excitatory syndrome.",
        ),
    },
    "remifentanil": {
        "review": mcq(
            "Remifentanil is metabolized by:",
            [
                "Nonspecific blood and tissue esterases (not plasma cholinesterase deficiency)",
                "Plasma cholinesterase only like succinylcholine",
                "Hofmann elimination only",
                "Exclusive renal elimination unchanged",
            ],
            0,
            "Mechanism: metabolized by nonspecific esterases; pseudocholinesterase deficiency does not prolong it.",
        ),
        "clinical": mcq(
            "Before stopping a remifentanil infusion near emergence, the pearl advises:",
            [
                "Plan transition analgesia (long-acting opioid or regional) ahead of time",
                "Stop all opioids permanently",
                "Only give acetaminophen PO intraoperatively",
                "Expect prolonged sedation for hours after stopping",
            ],
            0,
            "Pearl: give long-acting opioid or block 20–30 minutes before emergence due to ultra-short offset.",
        ),
    },
    "sufentanil": {
        "review": mcq(
            "Compared with fentanyl, sufentanil's potency in this cheatsheet is roughly:",
            [
                "About 5–10× more potent as a mu agonist",
                "Less potent than morphine mg-for-mg",
                "Identical to tramadol",
                "Inactive at opioid receptors",
            ],
            0,
            "Mechanism states 5–10× more potent than fentanyl depending on context.",
        ),
        "clinical": mcq(
            "For chest wall rigidity with sufentanil, the cautions highlight:",
            [
                "It is more pronounced than with fentanyl—give slowly and have relaxant available",
                "It never occurs with sufentanil",
                "Treat primarily with large naloxone boluses before airway management",
                "Only occurs after oral dosing",
            ],
            0,
            "Cautions: rigidity dose-dependent and worse than fentanyl—slow administration + relaxant ready.",
        ),
    },
    "methadone": {
        "review": mcq(
            "Besides mu agonism, methadone's mechanisms listed here include:",
            [
                "NMDA antagonism and SNRI activity",
                "Pure beta-blockade",
                "Selective 5-HT3 antagonism",
                "Irreversible COX inhibition",
            ],
            0,
            "Mechanism: mu agonist, NMDA antagonist, SNRI.",
        ),
        "clinical": mcq(
            "A major electrophysiology caution with methadone emphasized here is:",
            [
                "QTc prolongation in a dose-dependent fashion with multiple risk factors",
                "Bradycardia only through vagal stimulation without QT risk",
                "It cannot be given IV",
                "It lacks any drug interactions",
            ],
            0,
            "Cautions detail QT prolongation risk and electrolyte/drug interactions.",
        ),
    },
    "diazepam": {
        "review": mcq(
            "Diazepam prolongs chloride conductance primarily via:",
            [
                "GABA-A receptor positive allosteric modulation",
                "NMDA receptor agonism",
                "Na channel blockade",
                "H1 antagonism",
            ],
            0,
            "Mechanism: GABA-A positive allosteric modulator.",
        ),
        "clinical": mcq(
            "The pearl contrasts diazepam with midazolam for intramuscular premedication because:",
            [
                "Diazepam has erratic IM absorption whereas midazolam is preferred IM",
                "Midazolam cannot cross the blood–brain barrier",
                "Diazepam is always shorter acting than midazolam",
                "IM diazepam is the gold standard at Yale",
            ],
            0,
            "Pearl: diazepam IM absorption erratic—midazolam superior for IM premedication.",
        ),
    },
    "oxycodone": {
        "review": mcq(
            "Oxycodone's analgesic effect in this summary comes mainly from:",
            [
                "The parent compound as a full mu agonist (not primarily active metabolites)",
                "Only the noroxycodone metabolite",
                "Kappa agonism exclusively",
                "COX inhibition",
            ],
            0,
            "Mechanism states analgesia primarily from parent compound.",
        ),
        "clinical": mcq(
            "Oral potency ordering cited in the pearl approximates:",
            [
                "About 10 mg oxycodone ≈ 15 mg morphine PO",
                "10 mg oxycodone ≈ 1 mg morphine PO",
                "Oxycodone is weaker than codeine",
                "Oxycodone cannot be given orally",
            ],
            0,
            "Pearl: ~1.5× more potent than oral morphine; 10 mg oxycodone ≈ 15 mg morphine PO.",
        ),
    },
    "tramadol": {
        "review": mcq(
            "Tramadol's dual mechanisms emphasized here include:",
            [
                "Weak mu agonism plus serotonin/norepinephrine reuptake inhibition",
                "Pure NMDA antagonism",
                "Selective alpha-1 agonism",
                "Irreversible COX inhibition",
            ],
            0,
            "Mechanism: weak mu agonist + SNRI; active M1 metabolite more potent at mu.",
        ),
        "clinical": mcq(
            "Why might naloxone be insufficient alone for tramadol toxicity?",
            [
                "Significant non-opioid mechanisms (serotonergic/SNRI effects) contribute",
                "Tramadol is not an opioid at any dose",
                "Naloxone only works IM for tramadol",
                "Tramadol has no seizure risk",
            ],
            0,
            "Pearl: naloxone only partially reverses toxicity; may need benzodiazepines for seizures/cyproheptadine for serotonin syndrome.",
        ),
    },
    "codeine": {
        "review": mcq(
            "Codeine's analgesia depends mainly on:",
            [
                "CYP2D6 conversion to morphine (prodrug)",
                "Direct strong mu affinity without metabolism",
                "Hofmann elimination",
                "Acetylcholinesterase inhibition",
            ],
            0,
            "Mechanism: prodrug requiring CYP2D6 to morphine for analgesic effect.",
        ),
        "clinical": mcq(
            "The FDA black box warning highlighted here targets:",
            [
                "Children <12 years and post-tonsillectomy adolescents due to ultra-rapid metabolizer risk",
                "All adults over age 65 exclusively",
                "Patients with penicillin allergy",
                "Patients on sugammadex",
            ],
            0,
            "Cautions: contraindicated <12 years and <18 post-tonsillectomy due to CYP2D6 variability.",
        ),
    },
    "buprenorphine": {
        "review": mcq(
            "Buprenorphine behaves at mu receptors as:",
            [
                "A partial agonist with very high affinity but limited intrinsic efficacy (ceiling on respiratory depression)",
                "A full agonist identical to morphine at all doses",
                "A pure antagonist like naloxone",
                "A selective beta-blocker",
            ],
            0,
            "Mechanism: partial mu agonist, high affinity vs full agonists; ceiling respiratory effect.",
        ),
        "clinical": mcq(
            "Current guidance summarized in the pearl for perioperative patients on buprenorphine recommends:",
            [
                "Generally continue home buprenorphine and use multimodal analgesia rather than routine cessation",
                "Always stop buprenorphine 1 week before surgery",
                "Never use full mu agonists intraoperatively",
                "Discontinue permanently before any anesthetic",
            ],
            0,
            "Pearl: do not discontinue before surgery—continuation with multimodal therapy + full agonists as needed.",
        ),
    },
}


EXPECTED = [
    "propofol",
    "etomidate",
    "ketamine",
    "midazolam",
    "rocuronium",
    "succinylcholine",
    "vecuronium",
    "cisatracurium",
    "phenylephrine",
    "ephedrine",
    "norepinephrine",
    "vasopressin",
    "epinephrine",
    "metoprolol",
    "nicardipine",
    "esmolol",
    "hydralazine",
    "sugammadex",
    "neostigmine",
    "glycopyrrolate",
    "naloxone",
    "flumazenil",
    "diphenhydramine",
    "ketorolac",
    "lidocaine",
    "ondansetron",
    "dexamethasone",
    "atropine",
    "cefazolin",
    "fentanyl",
    "hydromorphone",
    "morphine",
    "lorazepam",
    "meperidine",
    "remifentanil",
    "sufentanil",
    "methadone",
    "diazepam",
    "oxycodone",
    "tramadol",
    "codeine",
    "buprenorphine",
]


def main():
    missing = [x for x in EXPECTED if x not in DATA]
    extra = [x for x in DATA if x not in EXPECTED]
    assert not missing and not extra, (missing, extra)

    parts = []
    for mid in EXPECTED:
        block = DATA[mid]
        entry_js = (
            "    "
            + mid
            + ": {\n      review: "
            + _mcq_js(block["review"])
            + ",\n      clinical: "
            + _mcq_js(block["clinical"])
            + "\n    }"
        )
        parts.append(entry_js)

    text = (
        "/** Check-in MCQs for Pyxis medications (keys align with `PYXIS_MEDICATIONS` in js/data.js). */\n"
        "(function () {\n"
        "  function mcq(question, choices, correctIndex, explanation) {\n"
        "    return { question: question, choices: choices, correctIndex: correctIndex, explanation: explanation };\n"
        "  }\n\n"
        "  window.PYXIS_MED_CHECKINS = {\n"
        + ",\n".join(parts)
        + "\n  };\n"
        "})();\n"
    )

    out_path = Path(__file__).resolve().parent.parent / "js" / "pyxis-med-checkins.js"
    out_path.write_text(text, encoding="utf-8")
    print("Wrote", out_path)


def _mcq_js(d):
    # Manual JSON-like output with correctIndex camelCase
    return (
        "mcq("
        + json.dumps(d["question"], ensure_ascii=False)
        + ", "
        + json.dumps(d["choices"], ensure_ascii=False)
        + ", "
        + str(d["correctIndex"])
        + ", "
        + json.dumps(d["explanation"], ensure_ascii=False)
        + ")"
    )


if __name__ == "__main__":
    main()
