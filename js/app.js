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
  const modalContents      = document.getElementById("modal-contents");
  const modalDetail        = document.getElementById("modal-detail");
  const contentsTitle      = document.getElementById("modal-contents-title");
  const contentsBody       = document.getElementById("modal-contents-body");
  const contentsFooter     = document.getElementById("modal-contents-footer");
  const contentsOpenDetail = document.getElementById("modal-contents-open-detail");
  const contentsClose      = document.getElementById("modal-contents-close");
  const detailTitle        = document.getElementById("modal-detail-title");
  const detailBody         = document.getElementById("modal-detail-body");
  const detailClose        = document.getElementById("modal-detail-close");
  const mainDrawerEls      = document.querySelectorAll(".main-drawer");
  const leftDrawerEls      = document.querySelectorAll(".left-drawer");
  const cellEls            = document.querySelectorAll(".drawer-cell");
  const supplyBinEls       = document.querySelectorAll(".supply-bin");

  let pendingDetailHandler = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Modal helpers ──────────────────────────────────────────────────────
  function openContentsModal(title, bodyHtml, hasFooter, detailHandler) {
    contentsTitle.textContent = title;
    contentsBody.innerHTML    = bodyHtml;
    contentsFooter.hidden     = !hasFooter;
    pendingDetailHandler      = detailHandler || null;
    modalContents.showModal();
  }

  function openDetailModal(title, bodyHtml) {
    detailTitle.textContent = title;
    detailBody.innerHTML    = bodyHtml;
    modalDetail.showModal();
  }

  // ── Render helpers ─────────────────────────────────────────────────────
  function renderMedicationDetail(medId) {
    const med = meds[medId];
    if (!med) return;

    const imgHtml = `
      <div class="detail-image-area">
        <img class="detail-image-display"
             src="images/${escapeHtml(med.id)}.jpg"
             alt="${escapeHtml(med.name)}"
             onerror="this.parentElement.style.display='none'">
      </div>`;

    const html = `
      ${imgHtml}
      <dl class="detail-list">
        <dt>Class</dt>
        <dd>${escapeHtml(med.class || "")}</dd>
        ${med.controlled ? `<dt>Controlled</dt><dd>${escapeHtml(med.schedule || "Controlled substance")}</dd>` : ""}
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
      ${med.pearl ? `<div class="detail-pearl"><strong>Pearl:</strong> ${escapeHtml(med.pearl)}</div>` : ""}`;

    openDetailModal(med.name, html);
  }

  function renderEquipmentDetail(item) {
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
    openDetailModal(item.name, html);
  }

  // ── Selection handlers ─────────────────────────────────────────────────
  function selectMainDrawer(drawerId) {
    const drawer = drawers.find(d => d.id === drawerId);
    if (!drawer) return;

    const tilesHtml = (drawer.medicationIds || []).map(medId => {
      const med = meds[medId];
      if (!med) return "";
      return `<button type="button" class="med-tile" data-med-id="${escapeHtml(medId)}">
        <span class="med-tile__name">${escapeHtml(med.name)}</span>
        <span class="med-tile__class">${escapeHtml(med.class || "")}</span>
      </button>`;
    }).join("");

    openContentsModal(
      drawer.label,
      tilesHtml || "<p class='empty-hint'>No items in this drawer.</p>",
      (drawer.medicationIds || []).length > 0,
      null
    );

    contentsBody.querySelectorAll(".med-tile").forEach(tile => {
      tile.addEventListener("click", () => {
        pendingDetailHandler = () => renderMedicationDetail(tile.dataset.medId);
        contentsOpenDetail.click();
      });
    });
  }

  function selectLeftDrawer(drawerId) {
    const drawer = leftDrawers.find(d => d.id === drawerId);
    if (!drawer) return;

    const tilesHtml = (drawer.items || []).map(item => {
      return `<button type="button" class="equip-tile" data-item-id="${escapeHtml(item.id)}">
        <span class="equip-tile__name">${escapeHtml(item.name)}</span>
        <span class="equip-tile__cat">${escapeHtml(item.category || "")}</span>
      </button>`;
    }).join("");

    openContentsModal(
      drawer.label,
      tilesHtml || "<p class='empty-hint'>No items in this drawer.</p>",
      (drawer.items || []).length > 0,
      null
    );

    contentsBody.querySelectorAll(".equip-tile").forEach(tile => {
      const item = (drawer.items || []).find(i => i.id === tile.dataset.itemId);
      tile.addEventListener("click", () => {
        pendingDetailHandler = () => renderEquipmentDetail(item);
        contentsOpenDetail.click();
      });
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
    const html = `<p class="detail-body">${escapeHtml(bin.description || bin.label || "")}</p>`;
    openContentsModal(bin.label, html, false, null);
  }

  // ── Wire up controls ───────────────────────────────────────────────────
  contentsClose?.addEventListener("click", () => modalContents?.close());
  detailClose?.addEventListener("click",   () => modalDetail?.close());
  contentsOpenDetail?.addEventListener("click", () => {
    if (typeof pendingDetailHandler === "function") pendingDetailHandler();
  });

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

  buildBubbles("attending-bubbles", window.ABOUT_ATTENDINGS || []);
  buildBubbles("resident-bubbles",  window.ABOUT_RESIDENTS  || []);

  document.getElementById("modal-attending-close")?.addEventListener("click", function () { modalAttending?.close(); });
  modalAttending?.addEventListener("click", function (e) { if (e.target === modalAttending) modalAttending.close(); });

  // ── Nav tab switching ────────────────────────────────────────────────────
  document.querySelectorAll(".site-nav__tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".site-nav__tab").forEach(function (t) {
        t.classList.remove("site-nav__tab--active");
        t.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".page-section").forEach(function (s) {
        s.classList.remove("page-section--active");
      });
      tab.classList.add("site-nav__tab--active");
      tab.setAttribute("aria-selected", "true");
      var target = document.getElementById("page-" + tab.dataset.page);
      if (target) target.classList.add("page-section--active");
    });
  });

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

// ── Anesthesia AI Chat ────────────────────────────────────────────────────
(function initChat() {
  var SYSTEM_PROMPT =
    "You are an expert anesthesia attending physician helping a 3rd–4th year medical student on their " +
    "anesthesia clerkship. Answer questions about anesthesia medications, airway management, " +
    "IV access, lines, monitoring, equipment, and perioperative concepts. Be concise and " +
    "practical — like a knowledgeable senior resident explaining things at the bedside. " +
    "Keep answers to 3–5 sentences unless asked to elaborate. Always note that responses are " +
    "for educational purposes only and that clinical decisions must follow institutional protocols.";

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

  function getKey()   { return localStorage.getItem("pyxis-oai-key") || ""; }
  function saveKey(k) { localStorage.setItem("pyxis-oai-key", k.trim()); }

  function openPanel() {
    panel.setAttribute("aria-hidden", "false");
    monitorBtn && monitorBtn.setAttribute("aria-expanded", "true");
    if (!getKey()) {
      showKeyCard();
    } else if (messagesEl.children.length === 0) {
      appendMsg("ai", "Don't be afraid to ask me anything about anesthesia - that's what attendings (AI) are for! We're here to help you learn.");
    }
    setTimeout(function () { inputEl && inputEl.focus(); }, 80);
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
  keyBtn   && keyBtn.addEventListener("click", function () { showKeyCard(true); });

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

  function showKeyCard(replacing) {
    var existing = document.getElementById("chat-apikey-card");
    if (existing && !replacing) return;
    if (existing) existing.remove();

    var card = document.createElement("div");
    card.className = "chat-apikey-card";
    card.id = "chat-apikey-card";
    card.innerHTML =
      "<p>Enter your <strong>OpenAI API key</strong> to activate the assistant. " +
      "It is stored only in your browser\u2019s local storage and sent only to OpenAI.</p>" +
      "<input type=\"password\" id=\"chat-key-input\" placeholder=\"sk-...\" autocomplete=\"off\">" +
      "<button type=\"button\" id=\"chat-key-save\">Activate</button>";
    messagesEl.appendChild(card);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    function tryActivate() {
      var val = (document.getElementById("chat-key-input").value || "").trim();
      if (val.startsWith("sk-") && val.length > 20) {
        saveKey(val);
        card.remove();
        appendMsg("ai", "Ready! Ask me anything about anesthesia.");
        inputEl && inputEl.focus();
      } else {
        document.getElementById("chat-key-input").style.borderColor = "#c0402a";
      }
    }

    document.getElementById("chat-key-save").addEventListener("click", tryActivate);
    document.getElementById("chat-key-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") tryActivate();
    });
  }

  function sendMessage() {
    if (busy) return;
    var text = (inputEl && inputEl.value || "").trim();
    if (!text) return;
    if (!getKey()) { openPanel(); return; }

    inputEl.value = "";
    appendMsg("user", text);
    history.push({ role: "user", content: text });

    busy = true;
    sendBtn && (sendBtn.disabled = true);
    showTyping();

    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getKey()
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }].concat(history),
        max_tokens: 520,
        temperature: 0.6
      })
    })
    .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
    .then(function (r) {
      hideTyping();
      if (!r.ok) {
        var code = r.data.error && r.data.error.code;
        appendMsg("system",
          code === "invalid_api_key"
            ? "\u26A0 Invalid API key \u2014 click \u2699 to update it."
            : "\u26A0 " + ((r.data.error && r.data.error.message) || "API error."));
        return;
      }
      var reply = r.data.choices[0].message.content.trim();
      history.push({ role: "assistant", content: reply });
      appendMsg("ai", reply);
    })
    .catch(function () {
      hideTyping();
      appendMsg("system", "\u26A0 Could not reach the AI. Check your connection and API key.");
    })
    .finally(function () {
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
