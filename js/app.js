(function () {
  const meds        = window.PYXIS_MEDICATIONS      || {};
  const supplyBins  = window.PYXIS_SUPPLY_BINS       || [];
  const drawers     = window.PYXIS_DRAWERS            || [];
  const leftDrawers = window.PYXIS_LEFT_DRAWERS       || [];
  const ctrlCells   = window.PYXIS_CONTROLLED_CELLS   || [];

  // JS-driven hover class — CSS :hover misfires inside transform: scale() containers
  function bindHover(el) {
    el.addEventListener("mouseenter", () => el.classList.add("is-hovered"));
    el.addEventListener("mouseleave", () => el.classList.remove("is-hovered"));
  }

  // ── DOM handles ────────────────────────────────────────────────────────
  const modalContents = document.getElementById("modal-contents");
  const modalDetail   = document.getElementById("modal-detail");
  const contentsTitle = document.getElementById("modal-contents-title");
  const contentsBody  = document.getElementById("modal-contents-body");
  const contentsClose = document.getElementById("modal-contents-close");
  const detailTitle   = document.getElementById("modal-detail-title");
  const detailBody    = document.getElementById("modal-detail-body");
  const detailClose   = document.getElementById("modal-detail-close");
  const detailBack    = document.getElementById("modal-detail-back");
  const detailFooter  = document.getElementById("modal-detail-footer");
  const mainDrawerEls = document.querySelectorAll(".main-drawer");
  const leftDrawerEls = document.querySelectorAll(".left-drawer");
  const cellEls       = document.querySelectorAll(".drawer-cell");
  const supplyBinEls  = document.querySelectorAll(".supply-bin");

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getMedBadge(medClass) {
    const c = (medClass || "").toLowerCase();
    if (/general anesthetic|imidazole hypnotic|dissociative anesthetic/.test(c))
      return { label: "Induction",        cls: "induction" };
    if (/benzodiazepine antagonist/.test(c))
      return { label: "Reversal",         cls: "reversal" };
    if (/benzodiazepine/.test(c))
      return { label: "Benzodiazepine",   cls: "benzo" };
    if (/non-depolarizing|depolarizing|nmb|neuromuscular block/.test(c))
      return { label: "NMB",              cls: "nmb" };
    if (/catecholamine|vasopressor|alpha.*agonist|sympathomimetic/.test(c))
      return { label: "Vasopressor",      cls: "vasopressor" };
    if (/opioid antagonist|relaxant binding|acetylcholinesterase/.test(c))
      return { label: "Reversal",         cls: "reversal" };
    if (/anticholinergic/.test(c))
      return { label: "Anticholinergic",  cls: "anticholinergic" };
    if (/opioid|opiate|narcotic/.test(c))
      return { label: "Opioid",           cls: "opioid" };
    if (/local anesthetic/.test(c))
      return { label: "Local Anesthetic", cls: "local" };
    if (/5-ht3|corticosteroid/.test(c))
      return { label: "Antiemetic",       cls: "antiemetic" };
    if (/volatile|inhaled|inhalation/.test(c))
      return { label: "Volatile",         cls: "volatile" };
    if (/antibiotic|antimicrobial|penicillin|cephalosporin|fluoroquinolone|macrolide/.test(c))
      return { label: "Antibiotic",       cls: "antibiotic" };
    if (/antiarrhythmic|rhythm control|cardiac rhythm/.test(c))
      return { label: "Rate Control",      cls: "rhythm" };
    if (/antihypertensive|blood pressure|calcium channel|beta.?blocker|ace inhibitor|vasodilator/.test(c))
      return { label: "BP Control",       cls: "bpcontrol" };
    if (/rescue|resuscitation|emergency|anaphylaxis|reversal agent/.test(c))
      return { label: "Rescue",           cls: "rescue" };
    return { label: "Supportive",         cls: "other" };
  }

  // ── Modal helpers ──────────────────────────────────────────────────────
  function openContentsModal(title, bodyHtml) {
    contentsTitle.textContent = title;
    contentsBody.innerHTML    = bodyHtml;
    modalContents.showModal();
  }

  function openDetailModal(title, bodyHtml, fromDrawer = false) {
    detailTitle.textContent  = title;
    detailBody.innerHTML     = bodyHtml;
    detailFooter.hidden      = !fromDrawer;
    modalDetail.showModal();
  }

  // ── Render helpers ─────────────────────────────────────────────────────
  function renderMedicationDetail(medId, fromDrawer = false) {
    const med = meds[medId];
    if (!med) return;

    const imgHtml = `
      <div class="detail-image-area">
        <img class="detail-image-display"
             src="images/${escapeHtml(med.id)}.jpg"
             alt="${escapeHtml(med.name)}"
             onerror="this.parentElement.style.display='none'">
      </div>`;

    const badge = getMedBadge(med.class);
    const html = `
      ${imgHtml}
      <div class="detail-meta">
        <span class="med-badge med-badge--${badge.cls}">${badge.label}</span>
        ${med.controlled ? `<span class="chip chip--controlled">${escapeHtml(med.schedule || "Controlled")}</span>` : ""}
      </div>
      <dl class="detail-list">
        <dt>Class</dt>
        <dd>${escapeHtml(med.class || "")}</dd>
        <dt>Mechanism</dt>
        <dd>${escapeHtml(med.mechanism || "")}</dd>
        <dt>Common use</dt>
        <dd>${escapeHtml(med.commonUse || "")}</dd>
        <dt>Dose</dt>
        <dd>${escapeHtml(med.dose || "")}</dd>
        <dt>Onset</dt>
        <dd>${escapeHtml(med.onset || "")}</dd>
        <dt>Duration</dt>
        <dd>${escapeHtml(med.duration || "")}</dd>
        <dt>Side effects</dt>
        <dd>${escapeHtml(med.sideEffects || "")}</dd>
        <dt>Cautions</dt>
        <dd>${escapeHtml(med.cautions || "")}</dd>
      </dl>
      ${med.pearl ? `<div class="detail-pearl"><span class="detail-pearl__label">Attending Pearl</span>${escapeHtml(med.pearl)}</div>` : ""}`;

    openDetailModal(med.name, html, fromDrawer);
  }

  function renderEquipmentDetail(item, fromDrawer = false) {
    if (!item) return;
    const html = `
      <div class="detail-image-area">
        <img class="detail-image-display"
             src="images/${escapeHtml(item.id)}.jpg"
             alt="${escapeHtml(item.name)}"
             onerror="this.parentElement.style.display='none'">
      </div>
      <p class="detail-category">${escapeHtml(item.category || "")}</p>
      <p class="detail-body">${escapeHtml(item.description || "")}</p>`;
    openDetailModal(item.name, html, fromDrawer);
  }

  // ── Selection handlers ─────────────────────────────────────────────────
  function selectMainDrawer(drawerId) {
    const drawer = drawers.find(d => d.id === drawerId);
    if (!drawer) return;

    const rawTiles = (drawer.medicationIds || []).map(medId => {
      const med = meds[medId];
      if (!med) return "";
      const badge = getMedBadge(med.class);
      return `<button type="button" class="med-tile" data-med-id="${escapeHtml(medId)}">
        <span class="med-tile__name">${escapeHtml(med.name)}</span>
        <span class="med-badge med-badge--${badge.cls}">${badge.label}</span>
      </button>`;
    }).join("");
    const tilesHtml = rawTiles ? `<div class="tile-grid">${rawTiles}</div>` : "";

    openContentsModal(
      drawer.label,
      tilesHtml || "<p class='empty-hint'>No items in this drawer.</p>"
    );

    contentsBody.querySelectorAll(".med-tile").forEach(tile => {
      tile.addEventListener("click", () => renderMedicationDetail(tile.dataset.medId, true));
    });
  }

  function selectLeftDrawer(drawerId) {
    const drawer = leftDrawers.find(d => d.id === drawerId);
    if (!drawer) return;

    const rawTiles = (drawer.items || []).map(item => {
      return `<button type="button" class="equip-tile" data-item-id="${escapeHtml(item.id)}">
        <span class="equip-tile__name">${escapeHtml(item.name)}</span>
        <span class="equip-tile__cat">${escapeHtml(item.category || "")}</span>
      </button>`;
    }).join("");
    const tilesHtml = rawTiles ? `<div class="tile-grid">${rawTiles}</div>` : "";

    openContentsModal(
      drawer.label,
      tilesHtml || "<p class='empty-hint'>No items in this drawer.</p>"
    );

    contentsBody.querySelectorAll(".equip-tile").forEach(tile => {
      const item = (drawer.items || []).find(i => i.id === tile.dataset.itemId);
      tile.addEventListener("click", () => renderEquipmentDetail(item, true));
    });
  }

  function selectControlledCell(idx) {
    const medId = ctrlCells[idx];
    if (!medId) return;
    const med = meds[medId];
    if (!med) return;
    renderMedicationDetail(medId);
  }

  function selectSupply(supplyId) {
    const bin = (supplyBins || []).find(b => b.id === supplyId);
    if (!bin) return;
    const html = `
      <div class="detail-image-area">
        <img class="detail-image-display"
             src="images/${escapeHtml(bin.id)}.jpg"
             alt="${escapeHtml(bin.label)}"
             onerror="this.parentElement.style.display='none'">
      </div>
      <p class="detail-category">Supply item</p>
      <p class="detail-body">${escapeHtml(bin.description || bin.label || "")}</p>`;
    openDetailModal(bin.label, html);
  }

  // ── Gas canister / volatile anesthetics ───────────────────────────────
  function openGasCanister() {
    const html = `
      <div class="detail-meta">
        <span class="med-badge med-badge--volatile">Volatile</span>
        <span class="chip" style="background:#f5d04022;color:#8a6000;border:1px solid #d4a01055;">Inhaled Agents</span>
      </div>

      <p class="volatile-overview">
        Volatile anesthetics are halogenated hydrocarbons administered as vaporized liquids (not gases) via the breathing circuit. They provide <strong>hypnosis, amnesia, and immobility</strong> in a dose-dependent fashion and remain one of the most common methods of anesthesia maintenance worldwide, though total intravenous anesthesia is also widely used (JACC, Thompson et al, 2024). Understanding how they work, both pharmacokinetically (how they get in and out of the body) and pharmacodynamically (what they do once there) is useful to learn for when 
        you rotate in the OR with your residents and attending, as well as your Step 1 and 2.
      </p>

      <div class="volatile-concept-box">
        <p class="volatile-concept-box__title">MAC — Minimum Alveolar Concentration</p>
        <p class="volatile-concept-box__body">
          <strong>MAC is the key unit of volatile anesthetic dosing.</strong> It is the alveolar concentration
          (at 1 atm, steady state, in 100% O₂) at which 50% of patients do not move in response to
          a surgical skin incision (Anaesthesia, Aranake et al, 2013). One MAC represents the median effective dose 
          (ED50) for immobility, not necessarily 50% effective dose, as the term has evolved to reflect the median 
          value for a population under controlled conditions (NEJM, Campagna et al, 2003).
          <br><br>
          <strong>1.3 MAC</strong> is typically used clinically as the threshold that prevents movement in ~95% of patients 
          (Anaesthesia, Aranake et al, 2013).
          MAC is <strong>reduced</strong> by: age (↓ with age), hypothermia, opioids, nitrous oxide,
          pregnancy, hypotension, acute alcohol intoxication, and sedatives.
          MAC is <strong>increased</strong> by: hyperthermia, chronic alcohol use, and stimulant drugs.
          Recent evidence suggests that mean arterial pressure is also associated with clinically delivered MAC, 
          and female sex is associated with lower delivered MAC in practice, though females may actually have higher 
          anesthetic requirements (Anesthesiology, Douller et al, 2025).
        </p>
      </div>

      <p class="volatile-section-title">Volatiles You May See in the OR</p>
      <div class="agent-table-wrap">
        <table class="agent-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Sevoflurane</th>
              <th>Isoflurane</th>
              <th>Desflurane</th>
              <th>Nitrous Oxide</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>MAC in O₂ (%)</th>
              <td>2.0</td><td>1.15</td><td>6.0</td><td>104 (adjunct only)</td>
            </tr>
            <tr>
              <th>Blood:Gas coeff.</th>
              <td>0.65</td><td>1.4</td><td>0.42</td><td>0.46</td>
            </tr>
            <tr>
              <th>Onset / offset</th>
              <td>Moderate-fast</td><td>Moderate</td><td>Fastest of all</td><td>Fast</td>
            </tr>
            <tr>
              <th>Odor / mask induction</th>
              <td><span class="agent-check">✓</span> Sweet, fruity — ideal for peds mask induction</td>
              <td><span class="agent-cross">✗</span> Pungent and irritating</td>
              <td><span class="agent-cross">✗</span> Very pungent; airway irritant</td>
              <td><span class="agent-check">✓</span> Sweet; used as adjunct</td>
            </tr>
            <tr>
              <th>Cardiovascular</th>
              <td>Mild ↓ SVR, ↓ BP</td><td>↓ SVR, compensatory ↑ HR</td><td>↑ HR, ↑ BP at high concentrations</td><td>Mild sympathomimetic</td>
            </tr>
            <tr>
              <th>Key caveat</th>
              <td><span class="agent-caution">⚠</span> Compound A at low flows (&lt;2 L/min) depending on absorbent.</td>
              <td>Rarely used today; pungent odor limits use</td>
              <td><span class="agent-caution">⚠</span> Requires heated vaporizer (Tec 6)</td>
              <td><span class="agent-caution">⚠</span> Expands air-filled cavities; PONV</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class = "volatile-overview"><strong>Note:</strong> MAC in O₂ (%) was derived from the FDA labels for a 40-year-old adult.</p>

      <p class="volatile-section-title">Pharmacokinetics: Getting In and Out</p>
      <div class="pk-stats">
        <span class="pk-stat"><span class="pk-stat__key">Low B:G coeff.</span> = faster onset &amp; offset (less soluble in blood → equilibrates quickly)</span>
        <span class="pk-stat"><span class="pk-stat__key">High cardiac output</span> = slower induction (more agent carried away from alveoli)</span>
        <span class="pk-stat"><span class="pk-stat__key">↑ Ventilation</span> = faster induction (more agent delivered to alveoli per minute)</span>
      </div>
      <ul class="volatile-mech-list">
        <li><strong>Step 1 — Delivery:</strong> The vaporizer adds volatile agent to the fresh gas flow at a set concentration (FI). The agent travels through the circuit to the alveoli.</li>
        <li><strong>Step 2 — Uptake:</strong> Volatile agent diffuses from the alveoli into the blood. The <em>blood:gas partition coefficient</em> governs how much dissolves: a low coefficient (desflurane, sevoflurane) means the blood holds little agent → alveolar concentration (FA) rapidly equals inspired concentration (FI). A high coefficient (isoflurane, nitrous oxide) means blood holds more → FA rises slowly.</li>
        <li><strong>Step 3 — Distribution:</strong> Blood delivers agent to the brain (highly perfused). Brain:blood equilibration determines onset of effect. At steady state, brain concentration ≈ alveolar concentration.</li>
        <li><strong>Step 4 — Elimination:</strong> When agent is turned off, the same gradients run in reverse. Low B:G agents (desflurane, sevoflurane) wash out rapidly, giving faster emergence.</li>
      </ul>

      <p class="volatile-section-title">Pharmacodynamics: Mechanisms of Action</p>
      <ul class="volatile-mech-list">
        <li><strong>GABA-A potentiation (primary):</strong> Volatile agents bind transmembrane domains of GABA-A receptors, prolonging chloride channel opening → neuronal hyperpolarization → loss of consciousness and immobility.</li>
        <li><strong>Glycine receptor potentiation:</strong> Enhancement of inhibitory glycinergic transmission contributes to immobility (spinal cord effect).</li>
        <li><strong>NMDA receptor inhibition:</strong> Weak glutamate blockade contributes to amnesia and analgesia.</li>
        <li><strong>HCN channel (Ih) inhibition:</strong> Hyperpolarization-activated cation channels are inhibited, suppressing thalamo-cortical oscillations — part of how consciousness is lost.</li>
        <li><strong>Two-pore domain K⁺ channels (TREK):</strong> Enhanced background K⁺ leak → neuronal hyperpolarization → reduced excitability.</li>
        <li><strong>Dose-dependent system effects:</strong> As MAC increases: >0.25 MAC = memory loss and sedation (Anaesthesia, Aranake et al, 2013); 1 MAC = immobility (50%); 1.3 MAC = surgical anesthesia; &gt;2 MAC = cardiovascular and respiratory depression. All volatiles cause dose-dependent ↓ minute ventilation (typically ↓ tidal volume, ↑ RR) (Anesthesia and Analgesia, Doi et al, 1987), bronchodilation, ↓ SVR, and ↓ cardiac contractility (Circulation, Page et al, 2016).</li>
      </ul>

      <div class="volatile-pearl">
        <span class="volatile-pearl__label">Attending Pearls</span>
        <p class="volatile-pearl__body">
          <strong>Malignant Hyperthermia (MH):</strong> All volatile halogenated agents (sevoflurane, isoflurane, desflurane) could be MH triggers. In an MH-susceptible patient, triggered episodes cause massive skeletal muscle hypermetabolism — an unexplained, rapidly rising EtCO₂ is often the earliest sign (JAMA, Litman et al, 2005). Treatment: stop all triggers immediately, begin dantrolene at minimum dose of 1.0 mg/kg IV, supportive care.
          <br><br>
          <strong>Sevoflurane + Compound A:</strong> At fresh gas flows &lt;2 L/min, sevoflurane reacts with CO₂ absorbent (particularly older barium hydroxide lime) to form Compound A, a nephrotoxic vinyl ether. Modern absorbents (e.g., Amsorb Plus) minimize production. However, it is important to note that clinical renal injury from compound A has not been conclusively demonstrated in humans (British Journal of Anaesthesia, Park et al, 2022).
          <br><br>
          <strong>Desflurane ≠ mask induction:</strong> Despite its pharmacokinetic advantages, desflurane's pungent odor causes significant airway irritation — coughing, laryngospasm, and breath-holding — making it unsuitable for inhalational induction, especially contraindicated in pediatric populations. In fact, desaturation below 90% occurred in 6% of adult patients during induction.
          <br><br>
          <strong>Environmental impact:</strong> Desflurane has the highest global warming potential of the volatiles (~2,540× CO₂ over 100 years) and is being phased out at many institutions (The Lancet, Talbot et al, 2025). Sevoflurane (~130× CO₂) and isoflurane (~510× CO₂) are less impactful. Nitrous oxide is also a potent greenhouse gas and depletes stratospheric ozone.
        </p>
      </div>`;

    openDetailModal("Volatile Anesthetic Agents", html);
  }

  const gasCaniBtn = document.getElementById("gas-canister-btn");
  if (gasCaniBtn) {
    bindHover(gasCaniBtn);
    gasCaniBtn.addEventListener("click",   e => { e.currentTarget.blur(); openGasCanister(); });
    gasCaniBtn.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openGasCanister(); } });
  }

  // ── Wire up controls ───────────────────────────────────────────────────
  contentsClose?.addEventListener("click", () => modalContents?.close());
  detailClose?.addEventListener("click", () => {
    modalDetail?.close();
    if (modalContents?.open) modalContents.close();
  });
  detailBack?.addEventListener("click", () => modalDetail?.close());

  const sideAuxEl = document.getElementById("side-aux");
  if (sideAuxEl) {
    bindHover(sideAuxEl);
    const openAux = () => openContentsModal(
      "Auxiliary & Sharps",
      `<p class="detail-body">This side compartment holds the <strong>substance-return container</strong> for safe disposal of unused controlled substances that are still in their vials, unopened. Furthermore, separate from the Pyxis system, there are large, red <strong>sharps containers</strong> for disposal of needles, blades, and other biohazardous sharps - ensure that you always dispose of sharps in the proper locations!</p>`
    );
    sideAuxEl.addEventListener("click",   e => { e.currentTarget.blur(); openAux(); });
    sideAuxEl.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAux(); } });
  }

  mainDrawerEls.forEach((el, i) => {
    const d = drawers[i];
    if (!d) return;
    el.dataset.drawerId = d.id;
    el.setAttribute("aria-label", d.label + " drawer");
    el.innerHTML = `<span class="main-drawer__handle" aria-hidden="true"></span><span class="main-drawer__label">${escapeHtml(d.shortLabel)}</span>`;
    bindHover(el);
    el.addEventListener("click",   e => { e.currentTarget.blur(); selectMainDrawer(d.id); });
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectMainDrawer(d.id); } });
  });

  leftDrawerEls.forEach(el => {
    const drawerId = el.id.replace("left-drawer-", "");
    bindHover(el);
    el.addEventListener("click",   e => { e.currentTarget.blur(); selectLeftDrawer(drawerId); });
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectLeftDrawer(drawerId); } });
  });

  cellEls.forEach(el => {
    const idx = parseInt(el.dataset.controlledIndex, 10);
    if (ctrlCells[idx] && meds[ctrlCells[idx]]) {
      el.classList.add("drawer-cell--named");
      el.innerHTML = `<span class="drawer-cell__drug-label" aria-hidden="true">${escapeHtml(ctrlCells[idx])}</span>`;
    }
    bindHover(el);
    el.addEventListener("click",   e => { e.currentTarget.blur(); selectControlledCell(idx); });
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectControlledCell(idx); } });
  });

  supplyBinEls.forEach(el => {
    bindHover(el);
    el.addEventListener("click",   e => { e.currentTarget.blur(); selectSupply(el.dataset.supplyId); });
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSupply(el.dataset.supplyId); } });
  });

  // ── People pages: shared bubble builder ──────────────────────────────────
  var modalAttending = document.getElementById("modal-attending");
  var cardContent    = document.getElementById("attending-card-content");

  function openPersonModal(a) {
    if (!modalAttending || !cardContent) return;

    var heroPhotoSrc = a.photo_high || a.photo;
    var heroHtml = heroPhotoSrc
      ? '<div class="attending-card__hero attending-card__hero--photo" style="background:' + a.color + '">' +
          '<img class="attending-card__hero-photo" src="' + heroPhotoSrc + '" alt="' + escapeHtml(a.name) + '" onerror="this.style.display=\'none\'">' +
          '<div class="attending-card__hero-initials">' + escapeHtml(a.initials) + '</div>' +
        '</div>'
      : '<div class="attending-card__hero" style="background:linear-gradient(150deg,' + a.color + 'dd 0%,' + a.color + ' 55%,' + a.color + '99 100%)">' +
          '<div class="attending-card__avatar" style="background:' + a.color + '">' +
            '<div class="attending-card__avatar-initials">' + escapeHtml(a.initials) + '</div>' +
          '</div>' +
        '</div>';

    cardContent.innerHTML =
      heroHtml +
      '<div class="attending-card__body' + (heroPhotoSrc ? ' attending-card__body--photo' : '') + '">' +
        '<h2 class="attending-card__name" id="modal-attending-name">' + escapeHtml(a.name) + '</h2>' +
        '<p class="attending-card__title">' + escapeHtml(a.title) + '</p>' +
        '<p class="attending-card__bio">' + escapeHtml(a.bio) + '</p>' +
        '<a href="mailto:' + escapeHtml(a.email) + '" class="attending-card__email-btn">\u2709 ' + escapeHtml(a.email) + '</a>' +
      '</div>';

    var inner = modalAttending.querySelector(".modal__inner");
    if (inner) { inner.style.animation = "none"; inner.offsetHeight; inner.style.animation = ""; }
    modalAttending.showModal();
  }

  function buildBubbles(containerId, data) {
    var bubblesEl = document.getElementById(containerId);
    if (!bubblesEl || !data.length) return;

    data.forEach(function (a) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "attending-bubble";
      btn.setAttribute("aria-label", "Learn more about " + a.name);
      btn.innerHTML =
        '<div class="attending-bubble__circle" style="background:' + a.color + '">' +
          '<div class="attending-bubble__initials">' + escapeHtml(a.initials) + '</div>' +
          '<img class="attending-bubble__photo" src="' + a.photo + '" alt="' + escapeHtml(a.name) + '" onerror="this.style.display=\'none\'">' +
        '</div>' +
        '<span class="attending-bubble__name">' + escapeHtml(a.name) + '</span>' +
        '<span class="attending-bubble__role">' + escapeHtml(a.title) + '</span>';

      bindHover(btn);
      btn.addEventListener("click", function (e) { e.currentTarget.blur(); openPersonModal(a); });
      bubblesEl.appendChild(btn);
    });
  }

  buildBubbles("attending-bubbles", (window.ABOUT_ATTENDINGS || []).concat(window.ABOUT_FACULTY || []));
  buildBubbles("resident-bubbles",  window.ABOUT_RESIDENTS  || []);
  buildBubbles("student-bubbles",   window.ABOUT_STUDENTS   || []);

  // Show "none listed" hint for students when empty
  var studentContainer = document.getElementById("student-bubbles");
  var studentHint      = document.getElementById("students-empty");
  if (studentHint && studentContainer && !studentContainer.hasChildNodes()) {
    studentHint.removeAttribute("hidden");
  }

  document.getElementById("modal-attending-close")?.addEventListener("click", function () { modalAttending?.close(); });
  modalAttending?.addEventListener("click", function (e) { if (e.target === modalAttending) modalAttending.close(); });

  // ── Nav tab switching ────────────────────────────────────────────────────
  function activatePage(pageKey) {
    document.querySelectorAll(".site-nav__tab").forEach(function (t) {
      t.classList.remove("site-nav__tab--active");
      t.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".page-section").forEach(function (s) {
      s.classList.remove("page-section--active");
    });
    var matchingTab = document.querySelector("[data-page='" + pageKey + "']");
    if (matchingTab) {
      matchingTab.classList.add("site-nav__tab--active");
      matchingTab.setAttribute("aria-selected", "true");
    }
    var target = document.getElementById("page-" + pageKey);
    if (target) target.classList.add("page-section--active");
  }

  document.querySelectorAll(".site-nav__tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      if (tab.dataset.page) activatePage(tab.dataset.page);
    });
  });

  // Support deep-linking from other pages (e.g. ventilator.html → index.html#about)
  if (window.location.hash === "#about") {
    activatePage("about");
    history.replaceState(null, "", window.location.pathname);
  }

  // ── Responsive cabinet scaling ───────────────────────────────────────────
  (function scaleCabinet() {
    const stage   = document.querySelector(".cabinet-stage");
    const cabinet = document.querySelector(".cabinet-scale");
    if (!stage || !cabinet) return;

    const W = 980, H = 780;
    const BOOST = 1.22;

    // Compute document-relative top once per update (scroll-independent)
    function docOffsetTop(el) {
      let top = 0;
      while (el) { top += el.offsetTop; el = el.offsetParent; }
      return top;
    }

    function update() {
      const avW = stage.offsetWidth;
      const avH = window.innerHeight - docOffsetTop(stage) - 24;
      const s   = Math.min(avW / W, Math.max(avH, H * 0.35) / H) * BOOST;
      cabinet.style.transform    = `scale(${s})`;
      cabinet.style.marginBottom = `${Math.round((s - 1) * H)}px`;
    }

    new ResizeObserver(update).observe(stage);
    window.addEventListener("resize", update);
    update();
  })();

})();

// ── Anesthesia AI Chat (server-side via Supabase Edge Function; sign-in required) ──
(function initChat() {
  var AUTH_URL = "platform/auth.html";

  var panel      = document.getElementById("chat-panel");
  var messagesEl = document.getElementById("chat-messages");
  var inputEl    = document.getElementById("chat-input");
  var sendBtn    = document.getElementById("chat-send");
  var closeBtn   = document.getElementById("chat-close");
  var keyBtn     = document.getElementById("chat-key-btn");
  var monitorBtn = document.getElementById("monitor-ai-btn");

  if (!panel) return;

  var history = [];
  var busy    = false;

  function openPanel() {
    panel.setAttribute("aria-hidden", "false");
    monitorBtn && monitorBtn.setAttribute("aria-expanded", "true");
    if (!window.SB || !window.SB.client) {
      appendMsg("system", "Assistant unavailable (configuration).");
      setTimeout(function () { inputEl && inputEl.focus(); }, 80);
      return;
    }
    window.SB.client.auth.getSession().then(function (res) {
      if (!res.data.session) {
        showSignInCard();
      } else if (messagesEl.children.length === 0) {
        appendMsg("ai", "Don't be afraid to ask me anything about anesthesia — that's what attendings (AI) are for! We're here to help you learn. (Up to 15 questions per day while signed in.)");
      }
      setTimeout(function () { inputEl && inputEl.focus(); }, 80);
    });
  }

  function closePanel() {
    panel.setAttribute("aria-hidden", "true");
    monitorBtn && monitorBtn.setAttribute("aria-expanded", "false");
  }

  monitorBtn && monitorBtn.addEventListener("click", function (e) {
    e.currentTarget.blur();
    panel.getAttribute("aria-hidden") === "false" ? closePanel() : openPanel();
  });

  closeBtn && closeBtn.addEventListener("click", closePanel);
  keyBtn   && keyBtn.addEventListener("click", function () { showSignInCard(true); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.getAttribute("aria-hidden") === "false") closePanel();
  });

  function appendMsg(role, text) {
    var div = document.createElement("div");
    div.className = "chat-msg chat-msg--" + role;
    if (role === "ai" && typeof marked !== "undefined") {
      div.innerHTML = marked.parse(text, { breaks: true, gfm: true });
    } else {
      div.textContent = text;
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "chat-typing";
    el.id = "chat-typing-indicator";
    el.innerHTML = "<span></span><span></span><span></span>";
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById("chat-typing-indicator");
    if (el) el.remove();
  }

  function showSignInCard(replacing) {
    var existing = document.getElementById("chat-signin-card");
    if (existing && !replacing) return;
    if (existing) existing.remove();

    var card = document.createElement("div");
    card.className = "chat-apikey-card chat-signin-card";
    card.id = "chat-signin-card";
    card.innerHTML =
      "<p><strong>Sign in</strong> to use the AI attending. Your questions are logged for education quality (up to <strong>15 per day</strong>).</p>" +
      "<a class=\"chat-signin-card__link\" href=\"" + AUTH_URL + "\">Sign in or create account</a>";
    messagesEl.appendChild(card);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function sendMessage() {
    if (busy) return;
    var text = (inputEl && inputEl.value || "").trim();
    if (!text) return;
    if (!window.invokeAIChat || !window.SB) {
      appendMsg("system", "\u26A0 Assistant unavailable. Refresh the page or try again later.");
      return;
    }

    busy = true;
    sendBtn && (sendBtn.disabled = true);

    window.SB.client.auth.getSession().then(function (res) {
      if (!res.data.session) {
        openPanel();
        return null;
      }

      inputEl.value = "";
      appendMsg("user", text);
      history.push({ role: "user", content: text });
      showTyping();

      return window.invokeAIChat("pyxis", history);
    }).then(function (r) {
      if (r === null || r === undefined) return;
      hideTyping();
      if (!r.ok) {
        if (r.code === "auth") {
          appendMsg("system", "\u26A0 Please sign in to use the assistant.");
          showSignInCard(true);
        } else if (r.code === "rate_limit") {
          appendMsg("system", "\u26A0 " + (r.message || "Daily limit reached."));
        } else {
          appendMsg("system", "\u26A0 " + (r.message || "Something went wrong."));
        }
        return;
      }
      history.push({ role: "assistant", content: r.reply });
      appendMsg("ai", r.reply);
    }).catch(function () {
      hideTyping();
      appendMsg("system", "\u26A0 Could not reach the assistant. Check your connection and try again.");
    }).finally(function () {
      busy = false;
      sendBtn && (sendBtn.disabled = false);
      inputEl && inputEl.focus();
    });
  }

  sendBtn && sendBtn.addEventListener("click", sendMessage);
  inputEl && inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
