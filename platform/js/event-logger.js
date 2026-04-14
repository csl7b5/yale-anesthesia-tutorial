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

  function updateNav(user, role) {
    const signInLinks = document.querySelectorAll('.site-nav__tab--signin');
    signInLinks.forEach(link => {
      if (user) {
        const dest = (role === 'instructor' || role === 'admin')
          ? 'platform/instructor.html'
          : 'platform/student.html';
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

      const { data } = await insert('scenario_attempts', {
        user_id:           userId,
        session_id:        sessionId,
        scenario_id:       scenIdx,
        scenario_name:     scenName,
        started_at:        attemptStartedAt,
        completion_status: 'in_progress',
      }).select('id').single();

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

      // Determine correctness after a micro-delay (class added post-click by ventilator.js)
      setTimeout(async () => {
        const isCorrect = choice.classList.contains('scen-choice--correct');

        await insert('step_events', {
          attempt_id:      currentAttemptId,
          step_number:     currentStepNumber,
          answer_index:    answerIdx,
          is_correct:      isCorrect,
          latency_seconds: latency,
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
    ['ecg', 'abp', 'spo2', 'etco2'].forEach(monitorId => {
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
      ['tut-etco2-select', 'etco2'],
      ['tut-gas-select',   'etco2_gas'],
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

  function attachPyxisListeners() {
    // We can add Pyxis-specific Supabase logging here in a future milestone
    // (drawer opens, item views, etc.)
    // For now the GA4 analytics.js handles Pyxis tracking for all users.
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
