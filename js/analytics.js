/**
 * analytics.js — Passive behavioral tracking for Yale Anesthesia Tutorial
 *
 * Requires the GA4 gtag snippet to be loaded before this script.
 * Replace G-XXXXXXXXXX in both HTML files with your Measurement ID.
 *
 * All custom events appear in GA4 under:
 *   Reports → Engagement → Events
 */
(function () {
  'use strict';

  // ── Core helper ────────────────────────────────────────────────────────────
  function track(name, params) {
    if (typeof gtag === 'undefined') return;
    gtag('event', name, params || {});
  }

  // Returns a function that, when called, gives elapsed seconds since creation
  function makeTimer() {
    const start = Date.now();
    return () => Math.round((Date.now() - start) / 1000);
  }

  // Track how long a <dialog> stays open
  function trackDialogDwell(dialogId, eventName, extraParams) {
    const dialog = document.getElementById(dialogId);
    if (!dialog) return;
    let elapsed = null;
    dialog.addEventListener('toggle', e => {
      if (e.newState === 'open') {
        elapsed = makeTimer();
      } else if (elapsed) {
        track(eventName, Object.assign({ dwell_seconds: elapsed() }, extraParams || {}));
        elapsed = null;
      }
    });
  }

  // ── Identify which page we're on ──────────────────────────────────────────
  const PAGE = location.pathname.toLowerCase().includes('ventilator') ? 'ventilator' : 'pyxis';

  // ── Viewport / device info on load ────────────────────────────────────────
  track('page_load', {
    page:             PAGE,
    viewport_width:   window.innerWidth,
    viewport_height:  window.innerHeight,
    is_mobile:        window.innerWidth < 768,
  });

  // ── Session duration on unload ────────────────────────────────────────────
  const sessionTimer = makeTimer();
  window.addEventListener('pagehide', () => {
    track('session_end', {
      page:             PAGE,
      duration_seconds: sessionTimer(),
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  PYXIS PAGE
  // ══════════════════════════════════════════════════════════════════════════

  if (PAGE === 'pyxis') {

    // ── Page tab navigation ──────────────────────────────────────────────────
    document.querySelectorAll('.site-nav__tab').forEach(tab => {
      tab.addEventListener('click', () => {
        track('page_tab_switch', { tab: tab.dataset.page || tab.textContent.trim() });
      });
    });

    // ── Drawer opens (main drawers + left drawers) ───────────────────────────
    document.querySelectorAll('.main-drawer').forEach(el => {
      el.addEventListener('click', () => {
        track('drawer_open', { drawer_id: el.dataset.drawerId, drawer_type: 'main' });
      });
    });
    document.querySelectorAll('.left-drawer').forEach(el => {
      el.addEventListener('click', () => {
        track('drawer_open', {
          drawer_id: el.id.replace('left-drawer-', ''),
          drawer_type: 'left',
        });
      });
    });

    // ── Supply bin opens ─────────────────────────────────────────────────────
    document.querySelectorAll('.supply-bin').forEach(el => {
      el.addEventListener('click', () => {
        track('supply_bin_open', { bin_id: el.dataset.supplyId });
      });
    });

    // ── Gas canister (volatile anesthetics) ──────────────────────────────────
    document.getElementById('gas-canister-btn')?.addEventListener('click', () => {
      track('gas_canister_open');
    });

    // ── Med & equipment detail views (tiles are dynamically injected) ─────────
    const viewedItems  = new Set();
    let   detailTimer  = null;
    let   detailItemId = null;

    const contentsBody = document.getElementById('modal-contents-body');
    contentsBody?.addEventListener('click', e => {
      const medTile   = e.target.closest('.med-tile');
      const equipTile = e.target.closest('.equip-tile');
      const tile = medTile || equipTile;
      if (!tile) return;

      const type     = medTile ? 'medication' : 'equipment';
      const itemId   = tile.dataset.medId || tile.dataset.itemId;
      const key      = type + '_' + itemId;
      const isRepeat = viewedItems.has(key);
      viewedItems.add(key);
      detailItemId = itemId;

      track('item_detail_view', {
        item_type:            type,
        item_id:              itemId,
        is_repeat_view:       isRepeat,
        session_unique_total: viewedItems.size,
      });
    });

    // Detail modal dwell time
    const detailDialog = document.getElementById('modal-detail');
    detailDialog?.addEventListener('toggle', e => {
      if (e.newState === 'open') {
        detailTimer = makeTimer();
      } else if (detailTimer) {
        track('item_detail_dwell', {
          item_id:        detailItemId || 'unknown',
          dwell_seconds:  detailTimer(),
        });
        detailTimer = null;
      }
    });

    // ── "Back to Drawer" button ──────────────────────────────────────────────
    document.getElementById('modal-detail-back')?.addEventListener('click', () => {
      track('back_to_drawer_used', { item_id: detailItemId || 'unknown' });
    });

    // ── Team bubble clicks (attendings, residents, students) ─────────────────
    document.addEventListener('click', e => {
      const bubble = e.target.closest('.attending-bubble');
      if (!bubble) return;
      track('team_bubble_click', {
        person_name: bubble.querySelector('.attending-bubble__name')?.textContent?.trim() || 'unknown',
        person_role: bubble.querySelector('.attending-bubble__role')?.textContent?.trim() || 'unknown',
      });
    });

    // ── Email link clicks ─────────────────────────────────────────────────────
    document.addEventListener('click', e => {
      const link = e.target.closest('a[href^="mailto:"]');
      if (!link) return;
      track('email_link_click', {
        email:  link.href.replace('mailto:', ''),
        person: link.closest('dialog, .modal__inner')
                    ?.querySelector('h2, h3')?.textContent?.trim() || 'unknown',
      });
    });

    // ── Session-end coverage report ───────────────────────────────────────────
    window.addEventListener('pagehide', () => {
      if (viewedItems.size > 0) {
        track('session_coverage', { unique_items_viewed: viewedItems.size });
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  VENTILATOR PAGE
  // ══════════════════════════════════════════════════════════════════════════

  if (PAGE === 'ventilator') {

    // ── Mode changes (VCV ↔ PCV) ──────────────────────────────────────────────
    document.getElementById('btn-vc')?.addEventListener('click', () => {
      track('ventilator_mode_change', { mode: 'VCV' });
    });
    document.getElementById('btn-pc')?.addEventListener('click', () => {
      track('ventilator_mode_change', { mode: 'PCV' });
    });

    // ── Scenario panel open/close ─────────────────────────────────────────────
    let scenPanelTimer = null;
    document.getElementById('scenario-open-btn')?.addEventListener('click', () => {
      scenPanelTimer = makeTimer();
      track('scenario_panel_opened');
    });
    document.getElementById('scen-panel-close-btn')?.addEventListener('click', () => {
      track('scenario_panel_closed', {
        dwell_seconds: scenPanelTimer ? scenPanelTimer() : null,
      });
      scenPanelTimer = null;
    });

    // ── Scenario selected ─────────────────────────────────────────────────────
    let activeScenarioName  = null;
    let activeScenarioTimer = null;
    let stepNumber          = 0;
    let correctAnswers      = 0;

    document.addEventListener('click', e => {
      const card = e.target.closest('.scen-card');
      if (!card) return;
      const idx = parseInt(card.dataset.scenIdx, 10);
      const titleEl = card.querySelector('.scen-card__title');
      activeScenarioName  = titleEl?.textContent?.trim() || ('Scenario ' + idx);
      activeScenarioTimer = makeTimer();
      stepNumber          = 0;
      correctAnswers      = 0;
      track('scenario_started', {
        scenario_index: idx,
        scenario_name:  activeScenarioName,
      });
    });

    // ── Answer latency + correctness (MutationObserver on #scen-qa) ──────────
    let stepShownAt = null;

    const scenQA = document.getElementById('scen-qa');
    if (scenQA) {
      new MutationObserver(() => {
        // New step rendered when fresh .scen-choice buttons appear
        if (scenQA.querySelector('.scen-choice:not([disabled])')) {
          stepShownAt = Date.now();
          stepNumber++;
        }
      }).observe(scenQA, { childList: true, subtree: true });
    }

    document.addEventListener('click', e => {
      const choice = e.target.closest('.scen-choice');
      if (!choice || !stepShownAt) return;
      const isCorrect = choice.classList.contains('scen-choice--correct') ||
                        // Check after a brief delay since class is added post-click
                        choice.dataset.choiceIdx !== undefined;
      const latency = Math.round((Date.now() - stepShownAt) / 1000);
      // Determine correctness from dataset if available
      track('scenario_answer', {
        scenario_name:    activeScenarioName || 'unknown',
        step_number:      stepNumber,
        answer_index:     parseInt(choice.dataset.choiceIdx, 10),
        latency_seconds:  latency,
      });
      stepShownAt = null;
    });

    // ── Scenario completion (resolution screen shown) ─────────────────────────
    document.getElementById('scen-restart-btn')?.addEventListener('click', () => {
      track('scenario_completed', {
        scenario_name:   activeScenarioName || 'unknown',
        total_seconds:   activeScenarioTimer ? activeScenarioTimer() : null,
        steps_completed: stepNumber,
      });
      stepNumber          = 0;
      activeScenarioTimer = null;
    });

    // ── TOF tutorial open + dwell ─────────────────────────────────────────────
    document.getElementById('tof-card')?.addEventListener('click', () => {
      track('tof_tutorial_opened');
    });
    trackDialogDwell('tof-modal', 'tof_tutorial_dwell');

    // TOF preset button clicks
    document.addEventListener('click', e => {
      const btn = e.target.closest('#tof-preset-btns button, #tof-drug-btns button');
      if (btn) track('tof_preset_selected', { preset: btn.textContent?.trim() });
    });

    // ── Monitor tutorial opens + dwell ────────────────────────────────────────
    ['ecg', 'abp', 'spo2', 'bis', 'spectral', 'etco2', 'ventwaves'].forEach(id => {
      document.getElementById('trig-' + id)?.addEventListener('click', () => {
        track('monitor_tutorial_opened', { monitor: id });
      });
      trackDialogDwell('tut-' + id, 'monitor_tutorial_dwell', { monitor: id });
    });

    // ── Pathology dropdown changes in tutorials ────────────────────────────────
    [
      ['tut-ecg-select',   'ecg'],
      ['tut-abp-select',   'abp'],
      ['tut-spo2-select',  'spo2'],
      ['tut-bis-select',       'bis'],
      ['tut-spectral-select',  'spectral'],
      ['tut-etco2-select', 'etco2_patterns'],
      ['tut-gas-select',   'etco2_gas'],
      ['vent-tut-preset',  'ventwaves'],
    ].forEach(([selId, monitor]) => {
      document.getElementById(selId)?.addEventListener('change', function () {
        track('tutorial_pathology_selected', { monitor, pathology: this.value });
      });
    });

    // ── EtCO2 tab switches ────────────────────────────────────────────────────
    document.getElementById('tut-etco2-tabs')
      ?.querySelectorAll('.mon-tut__tab')
      .forEach(tab => {
        tab.addEventListener('click', () => {
          track('etco2_tab_switched', { tab: tab.dataset.tab });
        });
      });

    document.getElementById('tut-ventwaves-tabs')
      ?.querySelectorAll('.vent-tut__tab')
      .forEach(tab => {
        tab.addEventListener('click', () => {
          track('ventwaves_tab_switched', { tab: tab.dataset.tab });
        });
      });

    document.addEventListener('ventwave_focus_preset', (e) => {
      const d = e.detail || {};
      track('ventwaves_preset_linked', {
        preset: d.preset || null,
        source: d.source || 'tutorial',
        scenario_id: d.scenario_id || null,
        step_index: d.step_index ?? null,
      });
    });

    document.addEventListener('ventwave_quiz_answered', (e) => {
      const d = e.detail || {};
      track('ventwaves_quiz_answer', {
        preset: d.preset || null,
        selected_index: d.selected_index ?? null,
        correct_index: d.correct_index ?? null,
        is_correct: !!d.is_correct,
      });
    });

    // ── Tutorial reset buttons ────────────────────────────────────────────────
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-tut-reset]');
      if (btn) track('tutorial_reset', { monitor: btn.dataset.tutReset });
    });

  }

  // ══════════════════════════════════════════════════════════════════════════
  //  FEEDBACK WIDGET — both pages
  // ══════════════════════════════════════════════════════════════════════════

  const FEEDBACK_KEY   = 'fbPanelOpen';
  const feedbackWidget = document.getElementById('feedback-widget');
  const feedbackTab    = document.getElementById('feedback-tab');
  const feedbackClose  = feedbackWidget?.querySelector('.feedback-widget__close');

  if (feedbackWidget && feedbackTab) {
    function setFeedbackOpen(open) {
      feedbackWidget.classList.toggle('is-open', open);
      feedbackTab.setAttribute('aria-expanded', String(open));
      sessionStorage.setItem(FEEDBACK_KEY, open ? '1' : '0');
    }

    // Restore panel state when navigating between pages
    if (sessionStorage.getItem(FEEDBACK_KEY) === '1') setFeedbackOpen(true);

    feedbackTab.addEventListener('click', () => {
      const willOpen = !feedbackWidget.classList.contains('is-open');
      setFeedbackOpen(willOpen);
      if (willOpen) track('feedback_form_opened', { page: PAGE });
    });

    feedbackClose?.addEventListener('click', () => setFeedbackOpen(false));
  }

})();
