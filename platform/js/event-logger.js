/**
 * event-logger.js — Dual-logs interactions to Supabase for authenticated users.
 *
 * Loaded on the public site (index.html / ventilator.html) AFTER supabase-client.js.
 * If the user is not authenticated, this script is a complete no-op.
 * GA4 analytics.js continues to run independently for all users.
 */
(function () {
  'use strict';

  if (!window.SB) return;

  const PAGE = location.pathname.toLowerCase().includes('ventilator') ? 'ventilator' : 'pyxis';

  let userId    = null;
  let sessionId = sessionStorage.getItem('sb_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    sessionStorage.setItem('sb_session_id', sessionId);
  }

  // Current attempt tracking
  let currentAttemptId   = null;
  let currentScenarioId  = null;
  let currentStepNumber  = 0;
  let attemptStartedAt   = null;
  let stepShownAt        = null;

  // ── Auth-aware nav ──────────────────────────────────────────────────────

  function platformDashPrefix() {
    return location.pathname.indexOf('/ventilator') >= 0 ? '../platform/' : 'platform/';
  }

  function updateNav(user, role) {
    const signInLinks = document.querySelectorAll('.site-nav__tab--signin');
    const pre = platformDashPrefix();
    signInLinks.forEach(link => {
      if (user) {
        const dest = (role === 'instructor' || role === 'admin')
          ? pre + 'instructor.html'
          : pre + 'student.html';
        link.href = dest;
        link.textContent = 'My Dashboard';
      }
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    const user = await SB.getUser();
    if (!user) {
      console.log('[event-logger] No authenticated user — logging disabled.');
      return;
    }
    userId = user.id;
    console.log('[event-logger] Authenticated as', user.email, '— logging enabled for', PAGE);

    const role = await SB.getRole();
    updateNav(user, role);

    if (PAGE === 'ventilator') attachVentilatorListeners();
    if (PAGE === 'pyxis') attachPyxisListeners();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function insert(table, row) {
    const { error } = await SB.client.from(table).insert(row);
    if (error) console.warn('[event-logger] insert into', table, 'failed:', error.message, row);
  }

  async function logPyxis(row) {
    if (!userId) return;
    await insert('pyxis_events', Object.assign({ user_id: userId, session_id: sessionId }, row));
  }

  async function update(table, id, fields) {
    const { error } = await SB.client.from(table).update(fields).eq('id', id);
    if (error) console.warn('[event-logger] update', table, id, 'failed:', error.message);
  }

  // ── Ventilator page listeners ────────────────────────────────────────────

  function attachVentilatorListeners() {

    // Scenario started (clicking a scenario card)
    document.addEventListener('click', async (e) => {
      const card = e.target.closest('.scen-card');
      if (!card) return;

      const scenIdx  = card.dataset.scenIdx;
      const titleEl  = card.querySelector('.scen-card__title');
      const scenName = titleEl?.textContent?.trim() || ('Scenario ' + scenIdx);

      attemptStartedAt  = new Date().toISOString();
      currentStepNumber = 0;
      currentScenarioId = scenIdx;

      const { data, error } = await SB.client.from('scenario_attempts').insert({
        user_id:           userId,
        session_id:        sessionId,
        scenario_id:       scenIdx,
        scenario_name:     scenName,
        started_at:        attemptStartedAt,
        completion_status: 'in_progress',
      }).select('id').single();

      if (error) console.warn('[event-logger] scenario_attempts insert failed:', error.message);
      if (data) currentAttemptId = data.id;
    });

    // Detect new step rendered (MutationObserver on #scen-qa)
    const scenQA = document.getElementById('scen-qa');
    if (scenQA) {
      new MutationObserver(() => {
        if (scenQA.querySelector('.scen-choice:not([disabled])')) {
          stepShownAt = Date.now();
          currentStepNumber++;
        }
      }).observe(scenQA, { childList: true, subtree: true });
    }

    // Answer clicked
    document.addEventListener('click', async (e) => {
      const choice = e.target.closest('.scen-choice');
      if (!choice || !stepShownAt || !currentAttemptId) return;

      const latency    = Math.round((Date.now() - stepShownAt) / 1000);
      const answerIdx  = parseInt(choice.dataset.choiceIdx, 10);
      const choiceLabel = choice.textContent?.trim() || '';

      // Determine correctness after a micro-delay (class added post-click by ventilator.js)
      setTimeout(async () => {
        const isCorrect = choice.classList.contains('scen-choice--correct');

        await insert('step_events', {
          attempt_id:      currentAttemptId,
          step_number:     currentStepNumber,
          answer_index:    answerIdx,
          is_correct:      isCorrect,
          latency_seconds: latency,
          choice_label:    choiceLabel,
        });
      }, 100);

      stepShownAt = null;
    });

    // Scenario completed (restart/resolution button)
    document.getElementById('scen-restart-btn')?.addEventListener('click', async () => {
      if (!currentAttemptId) return;

      const totalSec = attemptStartedAt
        ? Math.round((Date.now() - new Date(attemptStartedAt).getTime()) / 1000)
        : null;

      await update('scenario_attempts', currentAttemptId, {
        completed_at:      new Date().toISOString(),
        total_seconds:     totalSec,
        completion_status: 'completed',
      });

      currentAttemptId  = null;
      currentStepNumber = 0;
      attemptStartedAt  = null;
    });

    // Monitor tutorial interactions
    ['ecg', 'abp', 'spo2', 'bis', 'spectral', 'etco2', 'ventwaves'].forEach(monitorId => {
      // Opened
      document.getElementById('trig-' + monitorId)?.addEventListener('click', () => {
        insert('tutorial_events', {
          user_id:    userId,
          session_id: sessionId,
          monitor:    monitorId,
          event_type: 'opened',
        });
      });
    });

    // Pathology dropdown changes
    [
      ['tut-ecg-select',   'ecg'],
      ['tut-abp-select',   'abp'],
      ['tut-spo2-select',  'spo2'],
      ['tut-bis-select',      'bis'],
      ['tut-spectral-select', 'spectral'],
      ['tut-etco2-select', 'etco2'],
      ['tut-gas-select',   'etco2_gas'],
      ['vent-tut-preset',  'ventwaves'],
    ].forEach(([selId, monitor]) => {
      document.getElementById(selId)?.addEventListener('change', function () {
        insert('tutorial_events', {
          user_id:     userId,
          session_id:  sessionId,
          monitor:     monitor,
          event_type:  'pathology_selected',
          event_value: this.value,
        });
      });
    });

    // EtCO2 tab switches
    document.getElementById('tut-etco2-tabs')
      ?.querySelectorAll('.mon-tut__tab')
      .forEach(tab => {
        tab.addEventListener('click', () => {
          insert('tutorial_events', {
            user_id:     userId,
            session_id:  sessionId,
            monitor:     'etco2',
            event_type:  'tab_switched',
            event_value: tab.dataset.tab,
          });
        });
      });

    document.getElementById('tut-ventwaves-tabs')
      ?.querySelectorAll('.vent-tut__tab')
      .forEach(tab => {
        tab.addEventListener('click', () => {
          insert('tutorial_events', {
            user_id:     userId,
            session_id:  sessionId,
            monitor:     'ventwaves',
            event_type:  'tab_switched',
            event_value: tab.dataset.tab,
          });
        });
      });

    // TOF tutorial
    document.getElementById('tof-card')?.addEventListener('click', () => {
      insert('tutorial_events', {
        user_id:    userId,
        session_id: sessionId,
        monitor:    'tof',
        event_type: 'opened',
      });
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#tof-preset-btns button, #tof-drug-btns button');
      if (btn) {
        insert('tutorial_events', {
          user_id:     userId,
          session_id:  sessionId,
          monitor:     'tof',
          event_type:  'preset_selected',
          event_value: btn.textContent?.trim(),
        });
      }
    });
  }

  // ── Pyxis page listeners ─────────────────────────────────────────────────
  // Mirrors js/analytics.js for signed-in users → public.pyxis_events (see 012_create_pyxis_events.sql).

  function attachPyxisListeners() {
    const drawerVisitCounts = new Map();
    const uniqueDrawerKeys = new Set();
    const viewedItems = new Set();
    const supplyBinKeys = new Set();

    let contentsCtx = null;
    let detailItemId = null;
    let detailTimer = null;

    function flushContentsDwell() {
      if (!contentsCtx || contentsCtx.openedAt == null) return;
      const dwell = Math.round((Date.now() - contentsCtx.openedAt) / 1000);
      logPyxis({
        event_type: 'contents_dwell',
        drawer_id: contentsCtx.drawerId,
        drawer_type: contentsCtx.drawerType,
        dwell_seconds: Math.max(0, dwell),
      });
      contentsCtx = null;
    }

    function beginContentsDrawer(drawerId, drawerType) {
      flushContentsDwell();
      contentsCtx = { drawerId: drawerId, drawerType: drawerType, openedAt: Date.now() };
    }

    function trackDrawerOpen(drawerKey, drawerType, drawerId) {
      const n = (drawerVisitCounts.get(drawerKey) || 0) + 1;
      drawerVisitCounts.set(drawerKey, n);
      uniqueDrawerKeys.add(drawerKey);
      logPyxis({
        event_type: 'drawer_open',
        drawer_id: drawerId,
        drawer_type: drawerType,
        is_repeat: n > 1,
        extra: { visit_count_session: n },
      });
    }

    document.querySelectorAll('.site-nav__tab').forEach(tab => {
      tab.addEventListener('click', () => {
        logPyxis({
          event_type: 'page_tab_switch',
          tab_id: tab.dataset.page || tab.textContent.trim(),
        });
      });
    });

    document.querySelectorAll('.main-drawer').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.drawerId;
        if (!id) return;
        trackDrawerOpen('main:' + id, 'main', id);
        beginContentsDrawer(id, 'main');
      });
    });

    document.querySelectorAll('.left-drawer').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.id.replace('left-drawer-', '');
        trackDrawerOpen('left:' + id, 'left', id);
        beginContentsDrawer(id, 'left');
      });
    });

    document.getElementById('side-aux')?.addEventListener('click', () => {
      trackDrawerOpen('aux:aux_sharps', 'aux', 'aux_sharps');
      beginContentsDrawer('aux_sharps', 'aux');
    });

    document.getElementById('gas-canister-btn')?.addEventListener('click', () => {
      detailItemId = 'volatile_agents';
      logPyxis({ event_type: 'gas_canister_open' });
    });

    document.querySelectorAll('.supply-bin').forEach(el => {
      el.addEventListener('click', () => {
        const binId = el.dataset.supplyId;
        if (binId) {
          supplyBinKeys.add(binId);
          detailItemId = 'supply:' + binId;
        }
        logPyxis({
          event_type: 'supply_bin_open',
          bin_id: binId || null,
        });
      });
    });

    document.querySelectorAll('.drawer-cell').forEach(el => {
      el.addEventListener('click', () => {
        const idx = el.dataset.controlledIndex;
        const ctrl = window.PYXIS_CONTROLLED_CELLS || [];
        const medId = idx != null ? ctrl[parseInt(idx, 10)] : null;
        if (medId) detailItemId = medId;
        logPyxis({
          event_type: 'controlled_cell_open',
          item_type: 'medication',
          item_id: medId || (idx != null ? 'controlled_idx_' + idx : null),
          drawer_type: 'cabinet',
          drawer_id: 'controlled_rack',
          extra: { controlled_index: idx != null ? parseInt(idx, 10) : null },
        });
      });
    });

    const contentsBody = document.getElementById('modal-contents-body');
    contentsBody?.addEventListener('click', e => {
      const medTile = e.target.closest('.med-tile');
      const equipTile = e.target.closest('.equip-tile');
      const tile = medTile || equipTile;
      if (!tile) return;
      const type = medTile ? 'medication' : 'equipment';
      const itemId =
        (medTile && (medTile.dataset.medId || medTile.getAttribute('data-med-id'))) ||
        (equipTile && (equipTile.dataset.itemId || equipTile.getAttribute('data-item-id'))) ||
        '';
      if (!itemId) return;
      const key = type + '_' + itemId;
      const isRepeat = viewedItems.has(key);
      viewedItems.add(key);
      detailItemId = itemId;
      const itemName =
        tile.querySelector('.med-tile__name, .equip-tile__name')?.textContent?.trim() || null;
      const modalContentsEl = document.getElementById('modal-contents');
      const ctxActive =
        modalContentsEl &&
        modalContentsEl.open &&
        contentsCtx &&
        contentsCtx.drawerId != null
          ? contentsCtx
          : null;
      logPyxis({
        event_type: 'item_detail_view',
        item_type: type,
        item_id: itemId,
        drawer_id: ctxActive ? ctxActive.drawerId : null,
        drawer_type: ctxActive ? ctxActive.drawerType : null,
        is_repeat: isRepeat,
        session_unique_items: viewedItems.size,
        extra: Object.assign(
          { item_name: itemName },
          ctxActive
            ? { parent_drawer_id: ctxActive.drawerId, parent_drawer_type: ctxActive.drawerType }
            : {},
        ),
      });
    });

    const detailDialog = document.getElementById('modal-detail');
    detailDialog?.addEventListener('toggle', e => {
      if (e.newState === 'open') {
        detailTimer = Date.now();
      } else if (detailTimer != null) {
        const dwell = Math.round((Date.now() - detailTimer) / 1000);
        const mc = document.getElementById('modal-contents');
        const id = detailItemId || '';
        const fromDrawerGrid =
          mc &&
          mc.open &&
          contentsCtx &&
          id &&
          !String(id).startsWith('supply:') &&
          id !== 'volatile_agents';
        logPyxis({
          event_type: 'item_detail_dwell',
          item_id: detailItemId || null,
          drawer_id: fromDrawerGrid ? contentsCtx.drawerId : null,
          drawer_type: fromDrawerGrid ? contentsCtx.drawerType : null,
          dwell_seconds: dwell,
        });
        detailTimer = null;
      }
    });

    document.getElementById('modal-detail-back')?.addEventListener('click', () => {
      logPyxis({
        event_type: 'back_to_drawer',
        item_id: detailItemId || null,
        drawer_id: contentsCtx ? contentsCtx.drawerId : null,
        drawer_type: contentsCtx ? contentsCtx.drawerType : null,
      });
    });

    document.addEventListener('click', e => {
      const bubble = e.target.closest('.attending-bubble');
      if (!bubble) return;
      logPyxis({
        event_type: 'team_bubble_click',
        extra: {
          person_name: bubble.querySelector('.attending-bubble__name')?.textContent?.trim() || null,
          person_role: bubble.querySelector('.attending-bubble__role')?.textContent?.trim() || null,
        },
      });
    });

    document.addEventListener('click', e => {
      const link = e.target.closest('a[href^="mailto:"]');
      if (!link) return;
      logPyxis({
        event_type: 'email_link_click',
        extra: {
          email: link.href.replace(/^mailto:/i, ''),
          person: link.closest('dialog, .modal__inner')?.querySelector('h2, h3')?.textContent?.trim() || null,
        },
      });
    });

    const modalContents = document.getElementById('modal-contents');
    modalContents?.addEventListener('toggle', e => {
      if (e.newState === 'closed') {
        flushContentsDwell();
      }
    });

    const FEEDBACK_KEY = 'fbPanelOpen';
    const feedbackWidget = document.getElementById('feedback-widget');
    const feedbackTab = document.getElementById('feedback-tab');
    if (feedbackWidget && feedbackTab) {
      feedbackTab.addEventListener('click', () => {
        const willOpen = !feedbackWidget.classList.contains('is-open');
        if (willOpen) {
          logPyxis({
            event_type: 'feedback_opened',
            extra: { page: PAGE },
          });
        }
      });
    }

    window.addEventListener('pagehide', () => {
      if (!userId) return;
      flushContentsDwell();
      if (viewedItems.size > 0 || uniqueDrawerKeys.size > 0) {
        logPyxis({
          event_type: 'session_coverage',
          session_unique_drawers: uniqueDrawerKeys.size,
          session_unique_items: viewedItems.size,
          extra: {
            unique_bins: supplyBinKeys.size,
            page: PAGE,
            session_storage_feedback_open: sessionStorage.getItem(FEEDBACK_KEY) === '1',
          },
        });
      }
    });
  }

  // ── Mark abandoned attempts on page leave ────────────────────────────────

  window.addEventListener('pagehide', () => {
    if (!currentAttemptId || !userId) return;
    // Best-effort: use sendBeacon-style via Supabase (may not always complete)
    update('scenario_attempts', currentAttemptId, {
      completion_status: 'abandoned',
    });
  });

  // ── Start ────────────────────────────────────────────────────────────────

  init();

})();
