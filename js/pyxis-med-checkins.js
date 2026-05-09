/** Check-in MCQs for Pyxis medications (keys align with `PYXIS_MEDICATIONS` in js/data.js). */
(function () {
  function mcq(question, choices, correctIndex, explanation) {
    return { question: question, choices: choices, correctIndex: correctIndex, explanation: explanation };
  }

  window.PYXIS_MED_CHECKINS = {
    propofol: {
      review: mcq("Propofol's primary molecular target is:", ["Ligand-gated GABA-A receptors (positive modulation)", "NMDA receptors (non-competitive antagonism)", "Nicotinic acetylcholine receptors", "Mu-opioid receptors"], 0, "Positive modulation of GABA through ligand-gated GABA-A receptors is how propofol produces hypnosis and sedation."),
      clinical: mcq("Which approach most reduces propofol injection pain in the cited data?", ["Using an antecubital vein instead of a hand vein", "Giving only lidocaine pretreatment with a tourniquet", "Switching to etomidate instead", "Diluting propofol with sterile water before injection"], 0, "Antecubital IV placement reduced injection pain most versus hand veins in systematic review data; lidocaine with venous occlusion also helps.")
    },
    etomidate: {
      review: mcq("Etomidate produces hypnosis primarily through:", ["Positive modulation of GABA-A receptors", "Inhibition of NMDA receptors", "Blockade of sodium channels in peripheral nerves", "Selective alpha-1 adrenergic agonism"], 0, "Etomidate is a positive GABA-A receptor modulator."),
      clinical: mcq("Why is etomidate used cautiously in septic shock and critically ill children?", ["It inhibits 11β-hydroxylase and can cause adrenal suppression", "It irreversibly damages renal tubular cells", "It triggers malignant hyperthermia via RYR1", "It blocks plasma cholinesterase and prolongs succinylcholine"], 0, "Etomidate inhibits 11β-hydroxylase and suppresses adrenal steroidogenesis—problematic when stress-axis support matters (e.g., sepsis; critically ill children).")
    },
    ketamine: {
      review: mcq("Ketamine's primary receptor mechanism is:", ["Non-competitive antagonism of NMDA receptors", "Positive modulation of GABA-A receptors", "Competitive blockade of nicotinic receptors", "Selective mu-opioid agonism"], 0, "Ketamine acts chiefly as a non-competitive NMDA receptor antagonist."),
      clinical: mcq("In catecholamine-depleted states, ketamine may cause cardiovascular collapse because:", ["Indirect sympathomimetic masking fails to offset direct myocardial depression", "It releases histamine and drops SVR suddenly", "It blocks β-receptors at clinical doses", "It increases intracranial pressure in all patients"], 0, "Ketamine directly suppresses myocardial contractility; increased BP/HR from sympathomimetic effects usually hides this until catecholamine stores are exhausted.")
    },
    midazolam: {
      review: mcq("Midazolam enhances inhibition mainly by:", ["Positive allosteric modulation of GABA-A receptors", "Competitive antagonism at glycine receptors", "Selective H1 receptor blockade", "Irreversible acetylcholinesterase inhibition"], 0, "Midazolam is a positive allosteric modulator of GABA-A receptors."),
      clinical: mcq("When co-administered with opioids:", ["Reduce midazolam dose by about 30–50%", "Double the midazolam dose for synergy", "Avoid midazolam entirely in all patients", "Switch to diazepam instead at equal mg doses"], 0, "Combining midazolam with opioids causes synergistic respiratory depression—reduce midazolam by about 30–50%.")
    },
    rocuronium: {
      review: mcq("Rocuronium causes paralysis by:", ["Competitive antagonism at nicotinic acetylcholine receptors at the motor end-plate", "Depolarizing the motor end-plate like succinylcholine", "Blocking voltage-gated sodium channels in nerves", "Inhibiting acetylcholine synthesis in the synapse"], 0, "Rocuronium competitively blocks nicotinic receptors at the motor end-plate; reverse with anticholinesterases or sugammadex for aminosteroids."),
      clinical: mcq("Sugammadex at what dose can reverse profound rocuronium block within minutes?", ["16 mg/kg", "0.4 mg neostigmine per kg", "2 mg/kg only", "1 mg atropine IV"], 0, "Sugammadex 16 mg/kg can reverse profound aminosteroid block within roughly three minutes.")
    },
    succinylcholine: {
      review: mcq("Succinylcholine produces neuromuscular block by:", ["Binding nicotinic receptors and depolarizing the motor end-plate (depolarizing NMBA)", "Competitive antagonism without depolarization", "Blocking muscarinic receptors in the heart only", "Inhibiting calcium release from the sarcoplasmic reticulum"], 0, "Succinylcholine binds nicotinic receptors producing sustained depolarization (fasciculations then paralysis) and is hydrolyzed by plasma cholinesterase."),
      clinical: mcq("An early sign of malignant hyperthermia after triggering agents is often:", ["Rising ETCO₂ (hypercapnia) before fever", "Immediate focal seizure activity", "Profound bradycardia without fasciculations", "Fixed pupils before any muscle rigidity"], 0, "Unexplained rising ETCO₂ often precedes fever in malignant hyperthermia—do not wait for temperature alone.")
    },
    vecuronium: {
      review: mcq("Vecuronium's competitive nicotinic block is reversed by:", ["Acetylcholinesterase inhibitors (e.g., neostigmine, edrophonium, pyridostigmine)", "Selective benzodiazepine antagonists (flumazenil)", "Irreversible organophosphate nerve agents", "H1 antihistamines (diphenhydramine)"], 0, "Vecuronium is reversed by increasing junctional acetylcholine (neostigmine and related drugs). Sugammadex encapsulates aminosteroids such as rocuronium/vecuronium instead."),
      clinical: mcq("Compared with rocuronium, vecuronium's hemodynamic profile is best described as:", ["Essentially hemodynamically silent (no histamine release)", "Consistent severe tachycardia at intubating doses", "Predominant hypotension via histamine release", "Bradycardia requiring glycopyrrolate with every dose"], 0, "Vecuronium causes minimal hemodynamic change (little/no histamine release) compared with faster-onset rocuronium, which is often paired with sugammadex availability.")
    },
    cisatracurium: {
      review: mcq("Cisatracurium clearance independent of liver and kidney relies on:", ["Organ-independent Hofmann elimination (spontaneous chemical degradation)", "Renal excretion of unchanged drug only", "Hepatic glucuronidation exclusively", "Plasma cholinesterase hydrolysis like succinylcholine"], 0, "Hofmann degradation clears cisatracurium independent of liver and kidney function."),
      clinical: mcq("For ICU patients with multiorgan failure, cisatracurium is favored largely because:", ["Recovery is less prone to extreme prolongation than some alternatives in organ failure", "It does not require neuromuscular monitoring", "It provides analgesia through NMDA blockade", "It is reversed only by sugammadex"], 0, "In multiorgan failure, cisatracurium avoids the extreme prolonged paralysis sometimes seen with organ-dependent relaxants such as vecuronium.")
    },
    phenylephrine: {
      review: mcq("Phenylephrine's primary adrenergic activity is:", ["Selective alpha-1 agonism (no beta activity)", "Nonselective alpha and beta agonism like epinephrine", "Primarily beta-2 bronchodilation", "Indirect release of norepinephrine only"], 0, "Phenylephrine is selective for alpha-1 receptors; rising BP often triggers reflex bradycardia."),
      clinical: mcq("Prefer ephedrine over phenylephrine when hypotension is accompanied by:", ["Bradycardia or dependence on heart rate for cardiac output", "Uncontrolled hypertension", "Severe reactive airway disease only", "Acute vasodilatory shock with normal heart rate"], 0, "Pure alpha constriction can slash cardiac output when heart rate falls; ephedrine adds beta-mediated contractility and chronotropy for hypotension with bradycardia.")
    },
    ephedrine: {
      review: mcq("Ephedrine raises blood pressure through:", ["Direct alpha/beta agonism and indirect norepinephrine release", "Pure V1 vasopressin receptor agonism", "Selective alpha-1 agonism without beta effects", "Acetylcholinesterase inhibition at the synapse"], 0, "It directly stimulates alpha-1, beta-1, and beta-2 receptors and causes indirect norepinephrine release from nerve terminals."),
      clinical: mcq("When repeated ephedrine boluses become ineffective:", ["Switching to a direct-acting agent such as phenylephrine or norepinephrine", "Doubling ephedrine indefinitely", "Adding only flumazenil", "Stopping all pressors and fluid only"], 0, "Repeated ephedrine exhausts synaptic norepinephrine—switch to direct vasopressors when responses fade.")
    },
    norepinephrine: {
      review: mcq("Relative to pure alpha-1 agonism, norepinephrine also provides:", ["Modest beta-1 activity that helps maintain cardiac output", "Primarily beta-2 bronchodilation at infusion doses", "Muscarinic antagonism", "NMDA receptor blockade"], 0, "Norepinephrine is a potent alpha-1 agonist with meaningful beta-1 inotropy/chronotropy—unlike pure alpha agents such as phenylephrine."),
      clinical: mcq("Before starting norepinephrine for shock:", ["Correct hypovolemia first", "Always deliver through arterial line only", "Avoid central venous access entirely", "Give a fixed 1 mg bolus before infusion"], 0, "Vasopressors without volume replacement divert blood flow from organs—fix hypovolemia first.")
    },
    vasopressin: {
      review: mcq("Vasopressin's vasoconstrictor effect is mediated mainly through:", ["V1 receptors on vascular smooth muscle", "Beta-1 adrenergic receptors", "Nicotinic receptors at the NMJ", "Dihydropyridine L-type calcium channels on myocytes only"], 0, "Vasopressin constricts vessels via V1 receptors and remains effective when acidosis blunts catecholamine responsiveness."),
      clinical: mcq("Vasopressin is often added when norepinephrine reaches roughly:", ["About 0.25–0.5 mcg/kg/min", "Below 0.01 mcg/kg/min", "Any dose if sodium >150 mEq/L", "Only after phenylephrine failure at 100 mcg total"], 0, "Guidelines often add vasopressin near high-dose norepinephrine (commonly cited thresholds ~0.25–0.5 mcg/kg/min).")
    },
    epinephrine: {
      review: mcq("Epinephrine's receptor profile includes:", ["Potent β1, moderate β2, and α1 agonism", "Pure alpha-1 agonism only", "Selective beta-1 blockade", "Mu-opioid agonism"], 0, "Epinephrine stimulates β1 and β2 receptors and is a strong α1 agonist."),
      clinical: mcq("The mnemonic contrasts epinephrine concentrations for:", ["Cardiac arrest (1:10,000) vs anaphylactic shock loads (1:100,000)", "Adults vs pediatrics only", "IV vs IM routes exclusively", "Central line vs peripheral line without dose change"], 0, "Remember ACLS vs anaphylaxis concentration conventions (often 1:10,000 IV for arrest pushes versus dilute epinephrine for shock)—follow local protocols.")
    },
    metoprolol: {
      review: mcq("Metoprolol is described here primarily as:", ["A competitive β1-selective adrenergic antagonist", "A non-selective beta-blocker with ISA", "A calcium channel blocker", "An angiotensin receptor blocker"], 0, "Class/mechanism: β1-selective competitive antagonist."),
      clinical: mcq("The POISE trial context warns against:", ["Starting high-dose metoprolol on the day of surgery in naive patients", "Continuing chronic beta-blockers perioperatively", "Using esmolol for acute rate control", "Giving metoprolol only orally"], 0, "Starting high-dose metoprolol on the day of surgery harmed outcomes in POISE; continue chronic beta-blockers rather than abrupt withdrawal.")
    },
    nicardipine: {
      review: mcq("Nicardipine's predominant hemodynamic effect at therapeutic doses here is:", ["Arterial vasodilation via L-type calcium channel blockade in vascular smooth muscle", "AV nodal blockade like verapamil", "Beta-1 receptor antagonism", "Central alpha-2 agonism"], 0, "Dihydropyridine L-type Ca channel inhibition → peripheral arterial vasodilation."),
      clinical: mcq("To reduce thrombophlebitis risk with peripheral nicardipine infusions:", ["Rotate peripheral IV sites about every 12 hours or use central access", "Never exceed 1 mg/hr infusion rate", "Only administer IM", "Co-infuse with potassium chloride routinely"], 0, "Nicardipine irritates peripheral veins—rotate sites about every 12 hours or infuse centrally.")
    },
    esmolol: {
      review: mcq("Esmolol is cleared primarily by:", ["RBC esterases (organ-independent ultra-short acting)", "Hepatic P450 metabolism only", "Renal filtration unchanged", "Plasma cholinesterase identical to succinylcholine"], 0, "Esmolol is hydrolyzed by erythrocyte esterases, giving predictable ultra-short effect independent of liver metabolism."),
      clinical: mcq("A cited meta-analysis reported esmolol infusion reduces intraoperative opioid consumption by about:", ["32%", "90%", "3%", "0% (no effect)"], 0, "Meta-analysis data cited showed roughly one-third less perioperative opioid use with esmolol infusion strategies.")
    },
    hydralazine: {
      review: mcq("Hydralazine lowers blood pressure mainly by:", ["Direct relaxation of arteriolar smooth muscle (↓ SVR)", "Selective beta-1 receptor blockade", "Competitive mu-opioid antagonism", "Inhibition of angiotensin-converting enzyme"], 0, "Direct arterial vasodilator preferentially arterioles."),
      clinical: mcq("Why is hydralazine often a weak choice for titrated acute perioperative blood pressure control?", ["Onset is delayed/unpredictable and duration is long without an easy off-switch", "It always causes fatal methemoglobinemia", "It cannot be given IV", "It only works in patients with pheochromocytoma"], 0, "Hydralazine peaks slowly and lasts hours—hard to titrate compared with IV calcium-channel blockers or beta-blockers for acute perioperative hypertension.")
    },
    sugammadex: {
      review: mcq("Sugammadex reverses neuromuscular block by:", ["Encapsulating aminosteroid NMBAs like rocuronium and vecuronium", "Inhibiting acetylcholinesterase", "Activating GABA-A receptors", "Blocking nicotinic receptors permanently"], 0, "Selective relaxant binding agent encapsulates aminosteroids in 1:1 ratio."),
      clinical: mcq("Patients may need backup contraception because sugammadex:", ["Binds steroidal hormones including hormonal contraceptives (equivalent to missing roughly one pill)", "Always causes permanent infertility", "Contains estrogen itself", "Induces vomiting that inactivates all oral drugs"], 0, "Sugammadex binds steroid hormones; advise backup contraception for roughly one week after a dose.")
    },
    neostigmine: {
      review: mcq("Neostigmine reverses nondepolarizing block by:", ["Inhibiting acetylcholinesterase so acetylcholine outcompetes the NMBA", "Encapsulating rocuronium in a cyclodextrin ring", "Blocking muscarinic receptors only", "Activating GABA-A chloride channels"], 0, "Acetylcholinesterase inhibition increases acetylcholine at the NMJ."),
      clinical: mcq("Neostigmine reversal works best when Train-of-Four ratio is at least roughly:", ["≥0.4 ('minimal block') for reliable reversal within ~10 minutes", "Exactly 0.0 (complete paralysis)", "Only after sugammadex failure exclusively", "Before any twitch returns regardless of ratio"], 0, "Neostigmine reliably reverses lighter block (TOF ratio ≥~0.4); deeper block resolves slowly even with neostigmine.")
    },
    glycopyrrolate: {
      review: mcq("Compared with atropine, glycopyrrolate is a quaternary ammonium anticholinergic that:", ["Does not cross the blood–brain barrier well (minimal CNS anticholinergic effects)", "Always crosses the BBB faster than atropine", "Acts only on nicotinic receptors", "Is metabolized solely by Hofmann elimination"], 0, "Glycopyrrolate’s quaternary structure limits CNS entry versus tertiary anticholinergics."),
      clinical: mcq("For neuromuscular reversal pairing, a typical neostigmine:glycopyrrolate ratio cited here is:", ["About 0.2 mg glycopyrrolate per 1 mg neostigmine", "10 mg glycopyrrolate per 1 mg neostigmine", "Equal milligram doses of each", "Never combine them in the same syringe"], 0, "Dose section lists reversal pairing of ~0.2 mg glycopyrrolate per 1 mg neostigmine.")
    },
    naloxone: {
      review: mcq("Naloxone reverses opioid effects by:", ["Competitive displacement of opioids from receptors without intrinsic opioid activity", "Irreversible alkylation of opioid receptors", "Agonism at kappa receptors only", "Inhibiting cyclooxygenase enzymes"], 0, "Competitive displacement; no intrinsic opioid activity."),
      clinical: mcq("In postoperative care:", ["Titrate small incremental doses to reverse respiratory depression while preserving analgesia", "Always give 10 mg as first dose", "Avoid repeat dosing entirely", "Use flumazenil instead for all opioid overdoses"], 0, "Small naloxone boluses reverse hypoventilation while preserving analgesia better than large pushes.")
    },
    flumazenil: {
      review: mcq("Flumazenil reverses benzodiazepines by:", ["Competitive inhibition at the benzodiazepine site on GABA-A receptors", "Encapsulating midazolam in cyclodextrin", "Blocking 5-HT3 receptors", "Mu-opioid receptor antagonism"], 0, "Competitive inhibition at GABA-A benzodiazepine binding site."),
      clinical: mcq("Flumazenil is especially risky in unknown ED overdoses partly because it may:", ["Precipitate seizures in benzodiazepine-dependent patients and unmask TCA cardiotoxicity", "Always cure respiratory acidosis", "Reverse opioids completely", "Treat hyperkalemia from succinylcholine"], 0, "Flumazenil can precipitate seizures in benzodiazepine dependence and unmask sodium-channel toxicity from co-ingested drugs—often safer to support airway and consider naloxone when opioids may be involved.")
    },
    diphenhydramine: {
      review: mcq("Diphenhydramine's primary anti-allergy mechanism is:", ["Competitive antagonism at H1 histamine receptors", "Selective serotonin reuptake inhibition", "Irreversible COX-1 inhibition", "NMDA receptor antagonism"], 0, "Competitive H1 antagonist with anticholinergic/CNS penetration."),
      clinical: mcq("For anaphylaxis, diphenhydramine is used as:", ["An adjunct after epinephrine", "First-line instead of epinephrine", "Contraindicated with any IV access", "Only intranasal route"], 0, "Dose line lists anaphylaxis adjunct 25–50 mg IV after epinephrine.")
    },
    ketorolac: {
      review: mcq("Ketorolac's analgesic mechanism is:", ["Inhibition of cyclooxygenase (prostaglandin synthesis blockade)", "NMDA receptor antagonism", "Mu-opioid receptor partial agonism", "Selective 5-HT3 antagonism"], 0, "Inhibits prostaglandin synthetase (COX)."),
      clinical: mcq("The rule of 15s and 30s refers to:", ["Halving the IV dose (15 mg) for elderly, renal impairment, or <50 kg vs 30 mg standard", "Giving only on postoperative day 15", "Limiting infusions to 30 seconds total", "Using 15 tablets per day indefinitely"], 0, "Use 15 mg IV instead of 30 mg when elderly, renally impaired, or under ~50 kg.")
    },
    lidocaine: {
      review: mcq("As summarized here, lidocaine as a local anesthetic works mainly by:", ["Weak sodium channel blockade preventing nerve depolarization", "Selective GABA-A potentiation", "Irreversible nicotinic blockade", "Alpha-1 agonism"], 0, "Weak Na+ channel blockade; local anesthetic section."),
      clinical: mcq("For LAST (local anesthetic systemic toxicity), early warning signs classically include:", ["CNS symptoms like perioral numbness, tinnitus, or agitation before cardiovascular collapse", "Immediate hyperkalemia on BMP", "Fixed miotic pupils only", "Bradycardia without any prodrome"], 0, "LAST typically produces CNS signs (perioral numbness, tinnitus, agitation) before cardiovascular collapse.")
    },
    ondansetron: {
      review: mcq("Ondansetron's antiemetic class mechanism here is:", ["Selective 5-HT3 receptor antagonism", "Dopamine D2 antagonism", "Mu-opioid agonism", "Irreversible COX inhibition"], 0, "Selective 5-HT3 antagonist."),
      clinical: mcq("QT prolongation risk with ondansetron is especially important in:", ["Congenital long QT syndrome and electrolyte abnormalities", "Patients with isolated hypertension only", "Anyone receiving sugammadex", "Only neonates under 1 kg"], 0, "Cautions: avoid congenital LQTS; caution with electrolyte issues and other QT drugs.")
    },
    dexamethasone: {
      review: mcq("Dexamethasone reduces nausea/emesis through pathways that include:", ["Central antiemetic effects and reduced opioid requirement (among other steroid mechanisms)", "Only peripheral H1 blockade", "Pure nicotinic antagonism", "Irreversible COX-2 inhibition exclusively"], 0, "Steroids reduce nausea through central and inflammatory pathways and may lower opioid-driven nausea."),
      clinical: mcq("Regarding surgical-site infection, single perioperative dexamethasone doses:", ["Do not convincingly increase surgical site infection risk in meta-analyses", "Always cause catastrophic wound dehiscence", "Are banned by ASA for all diabetics", "Must never exceed 0.25 mg IV"], 0, "Large meta-analyses found no convincing increase in surgical-site infection after single perioperative dexamethasone doses.")
    },
    atropine: {
      review: mcq("Compared with glycopyrrolate, atropine is a tertiary amine anticholinergic that:", ["Crosses the blood–brain barrier and can cause CNS anticholinergic effects", "Never enters the CNS", "Acts only on vascular smooth muscle V1 receptors", "Is encapsulated by sugammadex"], 0, "As a tertiary amine, atropine crosses the blood–brain barrier and can cause central anticholinergic toxicity."),
      clinical: mcq("Paradoxical bradycardia with low-dose IV atropine in adults is addressed by:", ["Giving at least 0.5 mg IV doses for symptomatic bradycardia", "Avoiding atropine entirely below age 65", "Switching to phenylephrine first always", "Using only IM dosing"], 0, "Very low IV doses can paradoxically worsen bradycardia; adults typically need ≥0.5 mg for symptomatic bradycardia.")
    },
    cefazolin: {
      review: mcq("Cefazolin's antibacterial activity summarized here works mainly by:", ["Inhibiting bacterial cell wall synthesis (β-lactam cephalosporin)", "Inhibiting bacterial DNA gyrase", "Blocking the 50S ribosome", "Dissolving fungal cell membranes"], 0, "Bactericidal β-lactam inhibiting cell wall synthesis."),
      clinical: mcq("Cefazolin may be reasonable with:", ["Non-anaphylactic penicillin allergy (true IgE-mediated penicillin anaphylaxis remains a concern)", "Any documented penicillin rash without further evaluation", "Known MRSA infection as sole therapy", "History of anaphylaxis to any cephalosporin — routinely retry cefazolin"], 0, "Low cross-reactivity supports use with mild penicillin reactions; avoid when true IgE-mediated penicillin anaphylaxis is documented.")
    },
    fentanyl: {
      review: mcq("Approximate equipotency stated here is that 100 mcg fentanyl ≈:", ["About 10 mg morphine IV equivalence (order-of-magnitude)", "100 mg morphine", "1 mg morphine", "No relation to morphine"], 0, "Rough IV potency anchors: 100 mcg fentanyl ≈ 10 mg morphine ≈ 75 mg meperidine (order-of-magnitude)."),
      clinical: mcq("For severe chest wall rigidity after rapid high-dose fentanyl, prioritize:", ["Neuromuscular blockade (not relying on naloxone first)", "Immediate massive naloxone bolus only", "Halting oxygen and waiting", "Oral benzodiazepines only"], 0, "Treat chest-wall rigidity with neuromuscular blockade and airway control; opioid reversal alone may not restore ventilation rapidly enough.")
    },
    hydromorphone: {
      review: mcq("Hydromorphone's potency versus morphine is roughly:", ["About 5× more potent (mu agonist)", "About equal mg-for-mg", "100× less potent", "Primarily a local anesthetic"], 0, "Hydromorphone is roughly five times more potent than morphine mg-for-mg."),
      clinical: mcq("Why might hydromorphone be favored over morphine when renal function is impaired?", ["Morphine's active M6G metabolite accumulates in renal failure more problematically", "Hydromorphone has zero hepatic metabolism", "Morphine has no active metabolites", "Hydromorphone is always contraindicated in renal failure"], 0, "Morphine’s active M6G accumulates in renal failure; hydromorphone metabolites are generally less problematic at usual doses.")
    },
    morphine: {
      review: mcq("Morphine's clinically relevant active metabolite is:", ["Morphine-6-glucuronide (M6G) via hepatic glucuronidation", "Normeperidine", "O-desmethyltramadol", "7-hydroxymitragynine"], 0, "Morphine is glucuronidated to inactive M3G and active M6G."),
      clinical: mcq("Avoid morphine in favor of agents such as fentanyl or hydromorphone when:", ["Renal impairment causes accumulation of active metabolites with delayed respiratory depression", "Patient has reactive airway disease only", "Patient requests oral acetaminophen", "Patient is hyperthyroid"], 0, "Morphine-6-glucuronide builds up when GFR falls, delaying sedation and respiratory depression.")
    },
    lorazepam: {
      review: mcq("Lorazepam produces sedation primarily by:", ["Positive allosteric modulation of GABA-A receptors", "NMDA antagonism", "Selective H1 blockade", "Acetylcholinesterase inhibition"], 0, "GABA-A positive allosteric modulator."),
      clinical: mcq("High-dose or prolonged lorazepam IV infusions risk toxicity from:", ["Propylene glycol vehicle causing metabolic acidosis and renal injury", "Excessive sugammadex binding", "Iron overload", "Hyperkalemia from succinylcholine"], 0, "IV lorazepam solution contains propylene glycol—high cumulative doses risk acidosis and renal injury.")
    },
    meperidine: {
      review: mcq("Meperidine's problematic metabolite emphasized here is:", ["Normeperidine (neuroexcitatory, accumulates especially with renal impairment)", "Morphine-6-glucuronide", "M1 tramadol metabolite", "Laudanosine"], 0, "Normeperidine accumulates (especially in renal failure) and lowers seizure threshold."),
      clinical: mcq("Meperidine is absolutely contraindicated with:", ["MAOIs (risk of fatal excitatory syndrome)", "Stable hypertension alone", "All NSAIDs universally", "Patients older than 40 years only"], 0, "Cautions: MAOI interaction can be fatal—excitatory syndrome.")
    },
    remifentanil: {
      review: mcq("Remifentanil is metabolized by:", ["Nonspecific blood and tissue esterases (not plasma cholinesterase deficiency)", "Plasma cholinesterase only like succinylcholine", "Hofmann elimination only", "Exclusive renal elimination unchanged"], 0, "Metabolized by nonspecific esterases; pseudocholinesterase deficiency does not prolong it."),
      clinical: mcq("Before stopping a remifentanil infusion near emergence:", ["Plan transition analgesia (long-acting opioid or regional) ahead of time", "Stop all opioids permanently", "Only give acetaminophen PO intraoperatively", "Expect prolonged sedation for hours after stopping"], 0, "Plan long-acting analgesia or a regional technique 20–30 minutes before emergence—offset is extremely rapid.")
    },
    sufentanil: {
      review: mcq("Compared with fentanyl, sufentanil's potency is roughly:", ["About 5–10× more potent as a mu agonist", "Less potent than morphine mg-for-mg", "Identical to tramadol", "Inactive at opioid receptors"], 0, "Sufentanil is roughly five- to tenfold more potent than fentanyl depending on dosing context."),
      clinical: mcq("For chest wall rigidity with sufentanil, the cautions highlight:", ["It is more pronounced than with fentanyl—give slowly and have relaxant available", "It never occurs with sufentanil", "Treat primarily with large naloxone boluses before airway management", "Only occurs after oral dosing"], 0, "Cautions: rigidity dose-dependent and worse than fentanyl—slow administration + relaxant ready.")
    },
    methadone: {
      review: mcq("Besides mu agonism, methadone's mechanisms listed here include:", ["NMDA antagonism and SNRI activity", "Pure beta-blockade", "Selective 5-HT3 antagonism", "Irreversible COX inhibition"], 0, "Mu agonist, NMDA antagonist, SNRI."),
      clinical: mcq("A major electrophysiology caution with methadone emphasized here is:", ["QTc prolongation in a dose-dependent fashion with multiple risk factors", "Bradycardia only through vagal stimulation without QT risk", "It cannot be given IV", "It lacks any drug interactions"], 0, "Cautions detail QT prolongation risk and electrolyte/drug interactions.")
    },
    diazepam: {
      review: mcq("Diazepam prolongs chloride conductance primarily via:", ["GABA-A receptor positive allosteric modulation", "NMDA receptor agonism", "Na channel blockade", "H1 antagonism"], 0, "GABA-A positive allosteric modulator."),
      clinical: mcq("For intramuscular premedication, diazepam differs from midazolam because:", ["Diazepam has erratic IM absorption whereas midazolam is preferred IM", "Midazolam cannot cross the blood–brain barrier", "Diazepam is always shorter acting than midazolam", "IM diazepam is the gold standard at Yale"], 0, "Diazepam IM absorption is unreliable; midazolam is preferred when intramuscular sedation is needed.")
    },
    oxycodone: {
      review: mcq("Oxycodone's analgesic effect in this summary comes mainly from:", ["The parent compound as a full mu agonist (not primarily active metabolites)", "Only the noroxycodone metabolite", "Kappa agonism exclusively", "COX inhibition"], 0, "Analgesia comes mainly from oxycodone itself rather than metabolites."),
      clinical: mcq("Approximate oral potency equivalence:", ["About 10 mg oxycodone ≈ 15 mg morphine PO", "10 mg oxycodone ≈ 1 mg morphine PO", "Oxycodone is weaker than codeine", "Oxycodone cannot be given orally"], 0, "Oxycodone is about 1.5× more potent than oral morphine—often cited as 10 mg oxycodone ≈ 15 mg morphine PO.")
    },
    tramadol: {
      review: mcq("Tramadol's dual mechanisms emphasized here include:", ["Weak mu agonism plus serotonin/norepinephrine reuptake inhibition", "Pure NMDA antagonism", "Selective alpha-1 agonism", "Irreversible COX inhibition"], 0, "Tramadol has weak mu activity plus SNRI effects; its M1 metabolite is more potent at mu receptors."),
      clinical: mcq("Why might naloxone be insufficient alone for tramadol toxicity?", ["Significant non-opioid mechanisms (serotonergic/SNRI effects) contribute", "Tramadol is not an opioid at any dose", "Naloxone only works IM for tramadol", "Tramadol has no seizure risk"], 0, "Tramadol toxicity involves serotonergic and seizure mechanisms beyond mu receptors—naloxone alone may be insufficient.")
    },
    codeine: {
      review: mcq("Codeine's analgesia depends mainly on:", ["CYP2D6 conversion to morphine (prodrug)", "Direct strong mu affinity without metabolism", "Hofmann elimination", "Acetylcholinesterase inhibition"], 0, "Codeine is a prodrug; CYP2D6 converts a fraction to morphine for analgesia."),
      clinical: mcq("The FDA black box warning highlighted here targets:", ["Children <12 years and post-tonsillectomy adolescents due to ultra-rapid metabolizer risk", "All adults over age 65 exclusively", "Patients with penicillin allergy", "Patients on sugammadex"], 0, "Ultra-rapid CYP2D6 metabolism can flood neonates/children with morphine—hence age/post-tonsillectomy restrictions.")
    },
    buprenorphine: {
      review: mcq("Buprenorphine behaves at mu receptors as:", ["A partial agonist with very high affinity but limited intrinsic efficacy (ceiling on respiratory depression)", "A full agonist identical to morphine at all doses", "A pure antagonist like naloxone", "A selective beta-blocker"], 0, "Partial mu agonist, high affinity vs full agonists; ceiling respiratory effect."),
      clinical: mcq("For perioperative patients on buprenorphine, current guidance favors:", ["Generally continue home buprenorphine and use multimodal analgesia rather than routine cessation", "Always stop buprenorphine 1 week before surgery", "Never use full mu agonists intraoperatively", "Discontinue permanently before any anesthetic"], 0, "Continuing buprenorphine with multimodal analgesia and full mu agonists as needed avoids destabilizing OUD and allows adequate pain control.")
    }
  };
})();
