/**
 * instructor-dashboard.js — Full instructor dashboard logic
 *
 * Tabs: Cohort Overview, Scenario Performance, Tutorial Engagement,
 *       Pyxis Exploration, Individual Learners, Export
 * Features: Cohort management, date-range filtering, CSV export
 */
(function () {
  'use strict';
  if (!window.SB) return;

  const sb = SB.client;

  /* ── State ──────────────────────────────────────────────────────────── */
  let allProfiles  = [];   // all student profiles
  let allCohorts   = [];
  let allMembers   = [];   // [{cohort_id, user_id}]
  let attempts     = [];
  let steps        = [];
  let tutEvents    = [];
  let debriefs     = [];
  let pyxisEvents  = [];
  let filteredUserIds = null; // null = all

  /** Cached filtered rows for learner tab (cohort + dates) */
  let __dashFiltered = { a: null, s: null, d: null, p: null };

  const FILTER_TRAINING_NONE = '__training_none__';
  const FILTER_AFFILIATION_NONE = '__affiliation_none__';

  function collectTrainingLevels(profiles) {
    const s = new Set();
    for (const p of profiles) {
      const t = (p.training_level || '').trim();
      if (t) s.add(t);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }

  function collectInstitutions(profiles) {
    const s = new Set();
    for (const p of profiles) {
      const i = (p.institution || '').trim();
      if (i) s.add(i);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }

  function fillTrainingSelect(sel, profiles, preserveValue) {
    if (!sel) return;
    const cur = preserveValue != null ? preserveValue : sel.value;
    sel.innerHTML = '';
    sel.appendChild(new Option('All', 'all'));
    if (profiles.some(p => !(p.training_level || '').trim())) {
      sel.appendChild(new Option('Undesignated', FILTER_TRAINING_NONE));
    }
    for (const t of collectTrainingLevels(profiles)) {
      sel.appendChild(new Option(t, t));
    }
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : 'all';
  }

  function fillAffiliationSelect(sel, profiles, preserveValue) {
    if (!sel) return;
    const cur = preserveValue != null ? preserveValue : sel.value;
    sel.innerHTML = '';
    sel.appendChild(new Option('All', 'all'));
    if (profiles.some(p => !(p.institution || '').trim())) {
      sel.appendChild(new Option('Undesignated', FILTER_AFFILIATION_NONE));
    }
    for (const i of collectInstitutions(profiles)) {
      sel.appendChild(new Option(i, i));
    }
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : 'all';
  }

  function populateProfileFilterDropdowns() {
    fillTrainingSelect($('filter-training'), allProfiles);
    fillAffiliationSelect($('filter-affiliation'), allProfiles);
    fillTrainingSelect($('learner-filter-training'), allProfiles);
    fillAffiliationSelect($('learner-filter-affiliation'), allProfiles);
    fillTrainingSelect($('cohort-add-filter-training'), allProfiles);
    fillAffiliationSelect($('cohort-add-filter-affiliation'), allProfiles);
  }

  function profileMatchesTrainingPick(p, trainingVal) {
    if (trainingVal === 'all') return true;
    const tl = (p.training_level || '').trim();
    if (trainingVal === FILTER_TRAINING_NONE) return !tl;
    return tl === trainingVal;
  }

  function profileMatchesAffiliationPick(p, affiliationVal) {
    if (affiliationVal === 'all') return true;
    const ins = (p.institution || '').trim();
    if (affiliationVal === FILTER_AFFILIATION_NONE) return !ins;
    return ins === affiliationVal;
  }

  function profileMatchesNameSearch(p, q) {
    if (!q) return true;
    const name = (p.display_name || '').toLowerCase();
    return name.includes(q) || String(p.id).toLowerCase().includes(q);
  }

  function computeFilteredUserIds() {
    const cohortId = $('filter-cohort')?.value || 'all';
    const training = $('filter-training')?.value || 'all';
    const affiliation = $('filter-affiliation')?.value || 'all';

    if (cohortId === 'all' && training === 'all' && affiliation === 'all') {
      return null;
    }

    let pool = new Set(allProfiles.map(p => p.id));

    if (cohortId !== 'all') {
      const memberIds = new Set(
        allMembers.filter(m => m.cohort_id === cohortId).map(m => m.user_id)
      );
      pool = new Set([...pool].filter(id => memberIds.has(id)));
    }

    if (training !== 'all') {
      pool = new Set(
        [...pool].filter((id) => {
          const p = allProfiles.find(pr => pr.id === id);
          return p && profileMatchesTrainingPick(p, training);
        })
      );
    }

    if (affiliation !== 'all') {
      pool = new Set(
        [...pool].filter((id) => {
          const p = allProfiles.find(pr => pr.id === id);
          return p && profileMatchesAffiliationPick(p, affiliation);
        })
      );
    }

    return pool;
  }

  function getProfilesMatchingGlobalUserFilter() {
    if (filteredUserIds === null) return allProfiles.slice();
    return allProfiles.filter(p => filteredUserIds.has(p.id));
  }

  function applyLearnerTabLocalFilters(profiles) {
    const training = $('learner-filter-training')?.value || 'all';
    const affiliation = $('learner-filter-affiliation')?.value || 'all';
    const q = ($('learner-search-name')?.value || '').trim().toLowerCase();
    return profiles.filter(
      p =>
        profileMatchesTrainingPick(p, training) &&
        profileMatchesAffiliationPick(p, affiliation) &&
        profileMatchesNameSearch(p, q)
    );
  }

  function refreshLearnerDropdown() {
    const base = getProfilesMatchingGlobalUserFilter();
    const list = applyLearnerTabLocalFilters(base);
    populateLearnerDropdown(list);
  }

  function applyCohortPickerFilters(profiles) {
    const training = $('cohort-add-filter-training')?.value || 'all';
    const affiliation = $('cohort-add-filter-affiliation')?.value || 'all';
    const q = ($('cohort-add-search-name')?.value || '').trim().toLowerCase();
    return profiles.filter(
      p =>
        profileMatchesTrainingPick(p, training) &&
        profileMatchesAffiliationPick(p, affiliation) &&
        profileMatchesNameSearch(p, q)
    );
  }

  /** Expected Pyxis drawers (keep in sync with js/data.js PYXIS_DRAWERS / LEFT / aux) */
  const PYXIS_CATALOG = [
    { type: 'main', id: 'induction', label: 'Induction' },
    { type: 'main', id: 'paralytics', label: 'Paralytics' },
    { type: 'main', id: 'pressors', label: 'Hemodynamic Control' },
    { type: 'main', id: 'reversal', label: 'Reversal / Rescue' },
    { type: 'main', id: 'supportive', label: 'Supportive Care' },
    { type: 'left', id: 'airway', label: 'Airway' },
    { type: 'left', id: 'lines', label: 'Lines & Infusion' },
    { type: 'aux', id: 'aux_sharps', label: 'Auxiliary & Sharps' },
  ];

  function drawerKey(dt, id) {
    return (dt || '') + '|' + (id || '');
  }

  function getDrawerLabel(drawerType, drawerId) {
    const row = PYXIS_CATALOG.find(c => c.type === drawerType && c.id === drawerId);
    return row ? row.label : (drawerId || '—');
  }

  /** Pretty-print stored item ids (metoprolol → Metoprolol) when we don't load data.js */
  function formatItemIdLabel(itemId) {
    if (!itemId) return '—';
    if (String(itemId).startsWith('supply:')) return itemId.slice(7).replace(/-/g, ' ');
    return String(itemId)
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function parseExtra(ex) {
    if (ex == null) return {};
    if (typeof ex === 'string') {
      try {
        return JSON.parse(ex);
      } catch {
        return {};
      }
    }
    return typeof ex === 'object' ? ex : {};
  }

  /** Parent drawer / context for an item event (DB columns or legacy extra.*) */
  function getItemParentLabel(e) {
    if (e.drawer_type === 'cabinet' && e.drawer_id === 'controlled_rack') {
      return 'Controlled substance rack';
    }
    if (e.drawer_type && e.drawer_id) {
      return getDrawerLabel(e.drawer_type, e.drawer_id);
    }
    const ex = parseExtra(e.extra);
    if (ex.parent_drawer_type && ex.parent_drawer_id) {
      return getDrawerLabel(ex.parent_drawer_type, ex.parent_drawer_id);
    }
    return '—';
  }

  function getItemDisplayName(e) {
    const ex = parseExtra(e.extra);
    if (ex.item_name && String(ex.item_name).trim()) return String(ex.item_name).trim();
    return formatItemIdLabel(e.item_id);
  }

  /** Match item_detail_dwell to item rows: drawer + item_id (type not stored on dwell) */
  function dwellTripleKey(e) {
    return [e.drawer_type || '', e.drawer_id || '', e.item_id || ''].join('::');
  }

  function viewAggKey(e) {
    return [e.drawer_type || '', e.drawer_id || '', e.item_type || '', e.item_id || ''].join('::');
  }

  /* ── DOM refs ───────────────────────────────────────────────────────── */
  const $  = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  function openModalSafe(el) {
    if (!el) return;
    if (typeof el.showModal === 'function') {
      try {
        el.showModal();
        return;
      } catch (_) {
        // fall through to open attribute fallback
      }
    }
    el.setAttribute('open', '');
  }

  function closeModalSafe(el) {
    if (!el) return;
    if (typeof el.close === 'function') {
      try {
        el.close();
        return;
      } catch (_) {
        // fall through to open attribute fallback
      }
    }
    el.removeAttribute('open');
  }

  function applyWelcomeHeader(profile) {
    const h = $('welcome-name');
    const m = $('welcome-meta');
    if (!h) return;
    const name = profile?.display_name?.trim();
    h.textContent = name ? `Welcome, ${name}` : 'Instructor Dashboard';
    if (m) {
      const aff = profile?.institution?.trim();
      if (aff) {
        m.textContent = aff;
        m.removeAttribute('hidden');
      } else {
        m.textContent = '';
        m.setAttribute('hidden', '');
      }
    }
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  async function init() {
    const user = await SB.getUser();
    if (!user) return;
    const profile = await SB.getProfile();
    if (profile) applyWelcomeHeader(profile);

    setupTabs();
    setupCohortModal();
    $('cohort-modal-close')?.addEventListener('click', () => {
      document.getElementById('cohort-modal')?.close();
    });
    window.openAccountModal = async () => {
      const p = await SB.getProfile();
      if (p) {
        const n = $('inst-profile-name');
        const a = $('inst-profile-affiliation');
        if (n) n.value = p.display_name || '';
        if (a) a.value = p.institution || '';
        const st = $('inst-profile-save-status');
        if (st) st.textContent = '';
      }
      openModalSafe($('account-modal'));
    };
    window.closeAccountModal = () => closeModalSafe($('account-modal'));
    $('btn-account-settings')?.addEventListener('click', () => window.openAccountModal());
    $('btn-apply-filters').addEventListener('click', applyFilters);

    let learnerSearchT;
    $('learner-filter-training')?.addEventListener('change', refreshLearnerDropdown);
    $('learner-filter-affiliation')?.addEventListener('change', refreshLearnerDropdown);
    $('learner-search-name')?.addEventListener('input', () => {
      clearTimeout(learnerSearchT);
      learnerSearchT = setTimeout(refreshLearnerDropdown, 180);
    });

    let cohortSearchT;
    ['cohort-add-filter-training', 'cohort-add-filter-affiliation'].forEach((id) => {
      $(id)?.addEventListener('change', () => {
        const cid = $('cohort-member-editor')?.dataset?.cohortId;
        if (cid) populateAddUserDropdown(cid);
      });
    });
    $('cohort-add-search-name')?.addEventListener('input', () => {
      clearTimeout(cohortSearchT);
      cohortSearchT = setTimeout(() => {
        const cid = $('cohort-member-editor')?.dataset?.cohortId;
        if (cid) populateAddUserDropdown(cid);
      }, 180);
    });
    $('btn-export-attempts').addEventListener('click', () => exportCSV('attempts'));
    $('btn-export-steps').addEventListener('click', () => exportCSV('steps'));
    $('btn-export-tutorials').addEventListener('click', () => exportCSV('tutorials'));
    $('btn-export-pyxis')?.addEventListener('click', () => exportCSV('pyxis'));
    $('learner-select').addEventListener('change', onLearnerChange);

    $('inst-profile-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('inst-profile-name')?.value.trim() ?? '';
      const aff = $('inst-profile-affiliation')?.value.trim() ?? '';
      const st = $('inst-profile-save-status');
      if (st) {
        st.textContent = 'Saving…';
        st.style.color = '#58687a';
      }
      const { data, error } = await SB.updateProfile({
        display_name: name || null,
        institution: aff || 'Yale',
      });
      if (error) {
        if (st) {
          st.textContent = error.message || 'Could not save';
          st.style.color = '#d44';
        }
        return;
      }
      if (st) {
        st.textContent = 'Saved.';
        st.style.color = '#2a7';
      }
      applyWelcomeHeader(data);
    });

    // Password update
    $('set-pw-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = $('new-pw').value;
      const st = $('pw-update-status');
      st.textContent = 'Updating…';
      st.style.color = '#58687a';
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) {
        st.textContent = error.message;
        st.style.color = '#d44';
      } else {
        st.textContent = 'Password updated!';
        st.style.color = '#2a7';
        $('new-pw').value = '';
      }
    });

    await loadAll();
    applyFilters();
  }

  /* ── Data loading ───────────────────────────────────────────────────── */
  async function loadAll() {
    const [pRes, cRes, mRes, aRes, sRes, tRes, dRes, pxRes] = await Promise.all([
      sb.from('profiles').select('*').eq('role', 'student'),
      sb.from('cohorts').select('*').order('created_at', { ascending: false }),
      sb.from('cohort_members').select('*'),
      sb.from('scenario_attempts').select('*').order('started_at', { ascending: false }),
      sb.from('step_events').select('*'),
      sb.from('tutorial_events').select('*'),
      sb.from('ai_outputs').select('*, scenario_attempts!inner(user_id, scenario_id, scenario_name)').order('created_at', { ascending: false }),
      sb.from('pyxis_events').select('*').order('created_at', { ascending: false }),
    ]);

    allProfiles = pRes.data || [];
    allCohorts  = cRes.data || [];
    allMembers  = mRes.data || [];
    attempts    = aRes.data || [];
    steps       = sRes.data || [];
    tutEvents   = tRes.data || [];
    debriefs    = dRes.data || [];
    if (pxRes.error) {
      console.warn('[instructor] pyxis_events:', pxRes.error.message);
      pyxisEvents = [];
    } else {
      pyxisEvents = pxRes.data || [];
    }

    populateProfileFilterDropdowns();
    populateCohortDropdown();
    renderCohortList();
  }

  /* ── Filtering ──────────────────────────────────────────────────────── */
  function applyFilters() {
    const startDate = $('filter-start').value;
    const endDate   = $('filter-end').value;

    filteredUserIds = computeFilteredUserIds();

    // Filter attempts by user + date
    let fa = attempts;
    if (filteredUserIds) fa = fa.filter(a => filteredUserIds.has(a.user_id));
    if (startDate) fa = fa.filter(a => a.started_at >= startDate);
    if (endDate) fa = fa.filter(a => a.started_at <= endDate + 'T23:59:59');

    const attemptIds = new Set(fa.map(a => a.id));
    let fs = steps.filter(s => attemptIds.has(s.attempt_id));
    let ft = tutEvents;
    if (filteredUserIds) ft = ft.filter(t => filteredUserIds.has(t.user_id));
    if (startDate) ft = ft.filter(t => t.created_at >= startDate);
    if (endDate) ft = ft.filter(t => t.created_at <= endDate + 'T23:59:59');

    let fd = debriefs;
    if (filteredUserIds) fd = fd.filter(d => filteredUserIds.has(d.scenario_attempts?.user_id));

    let fpx = pyxisEvents;
    if (filteredUserIds) fpx = fpx.filter(e => filteredUserIds.has(e.user_id));
    if (startDate) fpx = fpx.filter(e => e.created_at >= startDate);
    if (endDate) fpx = fpx.filter(e => e.created_at <= endDate + 'T23:59:59');

    __dashFiltered = { a: fa, s: fs, d: fd, p: fpx };

    const visibleProfiles = getProfilesMatchingGlobalUserFilter();
    refreshLearnerDropdown();

    renderOverview(fa, fs, ft, visibleProfiles);
    renderScenarios(fa, fs);
    renderTutorials(ft);
    renderPyxis(fpx, visibleProfiles);
    renderLearnerDetail();
  }

  /* ── Tab: Overview ──────────────────────────────────────────────────── */
  function renderOverview(fa, fs, ft, profiles) {
    const userIds = new Set(fa.map(a => a.user_id));
    $('stat-learners').textContent = profiles.length;
    $('stat-total-attempts').textContent = fa.length;

    const completed = fa.filter(a => a.completion_status === 'completed');
    const rate = fa.length ? ((completed.length / fa.length) * 100).toFixed(0) : '—';
    $('stat-completion-rate').textContent = fa.length ? rate + '%' : '—';

    const durations = completed.filter(a => a.total_seconds != null).map(a => a.total_seconds);
    $('stat-cohort-avg-time').textContent = durations.length
      ? (durations.reduce((s, v) => s + v, 0) / durations.length).toFixed(1) : '—';

    const latencies = fs.filter(s => s.latency_seconds != null).map(s => s.latency_seconds);
    $('stat-avg-latency').textContent = latencies.length
      ? (latencies.reduce((s, v) => s + v, 0) / latencies.length).toFixed(1) : '—';

    const tutUsers = new Set(ft.map(t => t.user_id));
    $('stat-tutorial-rate').textContent = profiles.length
      ? ((tutUsers.size / profiles.length) * 100).toFixed(0) + '%' : '—';

    // Scenario summary table
    const byScenario = groupBy(fa, 'scenario_id');
    const rows = Object.entries(byScenario).map(([scId, arr]) => {
      const comp = arr.filter(a => a.completion_status === 'completed');
      const dur = comp.filter(a => a.total_seconds).map(a => a.total_seconds);
      const scSteps = fs.filter(s => arr.some(a => a.id === s.attempt_id));
      const correct = scSteps.filter(s => s.is_correct).length;
      const total = scSteps.length;
      const displayName = arr[0]?.scenario_name || scId;
      return {
        scenario: displayName,
        attempts: arr.length,
        completed: comp.length,
        avgTime: dur.length ? (dur.reduce((s, v) => s + v, 0) / dur.length).toFixed(1) : '—',
        accuracy: total ? ((correct / total) * 100).toFixed(0) + '%' : '—'
      };
    });

    if (!rows.length) {
      $('overview-scenario-table').innerHTML = '<p class="dash-empty">No scenario data for current filters.</p>';
      return;
    }

    let html = '<table class="inst-table"><thead><tr><th>Scenario</th><th>Attempts</th><th>Completed</th><th>Avg Time (s)</th><th>Step Accuracy</th></tr></thead><tbody>';
    for (const r of rows) {
      html += `<tr><td>${esc(r.scenario)}</td><td>${r.attempts}</td><td>${r.completed}</td><td>${r.avgTime}</td><td>${r.accuracy}</td></tr>`;
    }
    html += '</tbody></table>';
    $('overview-scenario-table').innerHTML = html;
  }

  /* ── Tab: Scenario Performance ──────────────────────────────────────── */
  function renderScenarios(fa, fs) {
    // Heatmap: median latency per scenario+step
    const byScenario = groupBy(fa, 'scenario_id');
    let heatHtml = '';
    for (const [scId, arr] of Object.entries(byScenario)) {
      const attemptIds = new Set(arr.map(a => a.id));
      const scSteps = fs.filter(s => attemptIds.has(s.attempt_id));
      const byStep = groupBy(scSteps, 'step_number');
      const stepNums = Object.keys(byStep).sort((a, b) => +a - +b);
      if (!stepNums.length) continue;

      const scenDisplayName = arr[0]?.scenario_name || scId;
      heatHtml += `<div style="margin-bottom:1rem"><strong>${esc(scenDisplayName)}</strong><div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">`;
      for (const sn of stepNums) {
        const lats = byStep[sn].filter(s => s.latency_seconds).map(s => s.latency_seconds);
        const med = lats.length ? median(lats) : 0;
        const bg = latencyColor(med);
        heatHtml += `<div class="heatmap-cell" style="background:${bg}" title="Step ${sn}: median ${med.toFixed(1)}s">S${sn}<br>${med.toFixed(1)}s</div>`;
      }
      heatHtml += '</div></div>';
    }
    $('heatmap-container').innerHTML = heatHtml || '<p class="dash-empty">No step data for current filters.</p>';

    // Wrong answers
    const wrongSteps = fs.filter(s => !s.is_correct);
    const wrongGroups = {};
    for (const s of wrongSteps) {
      const scAttempt = fa.find(a => a.id === s.attempt_id);
      const scId = scAttempt ? (scAttempt.scenario_name || scAttempt.scenario_id) : 'unknown';
      const label = s.choice_label || ('Option ' + (s.answer_index + 1));
      const wKey = `${scId}|Step ${s.step_number}|${label}`;
      wrongGroups[wKey] = (wrongGroups[wKey] || 0) + 1;
    }
    const wrongRows = Object.entries(wrongGroups)
      .map(([k, count]) => { const [sc, step, choice] = k.split('|'); return { sc, step, choice, count }; })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    if (!wrongRows.length) {
      $('wrong-answers-container').innerHTML = '<p class="dash-empty">No incorrect answers for current filters.</p>';
    } else {
      let wHtml = '<table class="inst-table"><thead><tr><th>Scenario</th><th>Step</th><th>Wrong Choice</th><th>Count</th></tr></thead><tbody>';
      for (const r of wrongRows) {
        wHtml += `<tr><td>${esc(r.sc)}</td><td>${esc(r.step)}</td><td>${esc(r.choice)}</td><td>${r.count}</td></tr>`;
      }
      wHtml += '</tbody></table>';
      $('wrong-answers-container').innerHTML = wHtml;
    }
  }

  /* ── Tab: Tutorials ─────────────────────────────────────────────────── */
  function renderTutorials(ft) {
    const byMonitor = groupBy(ft, 'monitor');
    const rows = Object.entries(byMonitor).map(([mon, arr]) => {
      const users = new Set(arr.map(e => e.user_id));
      const dwells = arr.filter(e => e.dwell_seconds).map(e => e.dwell_seconds);
      return {
        monitor: mon,
        opens: arr.filter(e => e.event_type === 'opened').length,
        totalEvents: arr.length,
        uniqueUsers: users.size,
        avgDwell: dwells.length ? (dwells.reduce((s, v) => s + v, 0) / dwells.length).toFixed(1) : '—'
      };
    });

    if (!rows.length) {
      $('tutorial-stats-container').innerHTML = '<p class="dash-empty">No tutorial data for current filters.</p>';
    } else {
      let html = '<table class="inst-table"><thead><tr><th>Monitor</th><th>Opens</th><th>Total Events</th><th>Unique Users</th><th>Avg Dwell (s)</th></tr></thead><tbody>';
      for (const r of rows) {
        html += `<tr><td>${esc(r.monitor)}</td><td>${r.opens}</td><td>${r.totalEvents}</td><td>${r.uniqueUsers}</td><td>${r.avgDwell}</td></tr>`;
      }
      html += '</tbody></table>';

      const quizRowsByPreset = {};
      let linkedPresetCount = 0;
      for (const ev of ft) {
        if (ev.monitor === 'ventwaves' && ev.event_type === 'preset_selected' && ev.event_value) {
          const pv = parseExtra(ev.event_value);
          if (pv && pv.source === 'scenario') linkedPresetCount++;
        }
        if (ev.monitor !== 'ventwaves' || ev.event_type !== 'quiz_answer' || !ev.event_value) continue;
        const qv = parseExtra(ev.event_value);
        const preset = qv.preset || 'unknown';
        if (!quizRowsByPreset[preset]) {
          quizRowsByPreset[preset] = { preset, attempts: 0, correct: 0 };
        }
        quizRowsByPreset[preset].attempts++;
        if (qv.is_correct === true) quizRowsByPreset[preset].correct++;
      }
      const quizRows = Object.values(quizRowsByPreset).sort((a, b) => b.attempts - a.attempts);
      if (quizRows.length) {
        html += `<h3 class="dash-section__title" style="margin:1rem 0 0.45rem;font-size:0.85rem">Ventilator pattern recognition</h3>`;
        html += `<p class="inst-hint">Quiz attempts: ${quizRows.reduce((s, r) => s + r.attempts, 0)} · Scenario-linked wave preset opens: ${linkedPresetCount}</p>`;
        html += '<table class="inst-table"><thead><tr><th>Preset</th><th>Quiz attempts</th><th>Correct</th><th>Accuracy</th></tr></thead><tbody>';
        for (const r of quizRows) {
          const acc = r.attempts ? ((r.correct / r.attempts) * 100).toFixed(0) + '%' : '—';
          html += `<tr><td>${esc(r.preset)}</td><td>${r.attempts}</td><td>${r.correct}</td><td>${acc}</td></tr>`;
        }
        html += '</tbody></table>';
      }
      $('tutorial-stats-container').innerHTML = html;
    }

    // Pathology selections
    const pathEvents = ft.filter(e => e.event_type === 'pathology_selected' && e.event_value);
    const pathCounts = {};
    for (const e of pathEvents) {
      const k = `${e.monitor}|${e.event_value}`;
      pathCounts[k] = (pathCounts[k] || 0) + 1;
    }
    const pathRows = Object.entries(pathCounts)
      .map(([k, count]) => { const [mon, path] = k.split('|'); return { mon, path, count }; })
      .sort((a, b) => b.count - a.count);

    if (!pathRows.length) {
      $('pathology-stats-container').innerHTML = '<p class="dash-empty">No pathology selection data.</p>';
    } else {
      let html = '<table class="inst-table"><thead><tr><th>Monitor</th><th>Pathology</th><th>Selections</th></tr></thead><tbody>';
      for (const r of pathRows) {
        html += `<tr><td>${esc(r.mon)}</td><td>${esc(r.path)}</td><td>${r.count}</td></tr>`;
      }
      html += '</tbody></table>';
      $('pathology-stats-container').innerHTML = html;
    }
  }

  /* ── Tab: Individual Learners ───────────────────────────────────────── */
  function onLearnerChange() {
    const uid = $('learner-select').value;
    $('learner-detail').hidden = !uid;
    if (uid) renderLearnerDetail();
  }

  function renderLearnerDetail() {
    const uid = $('learner-select').value;
    if (!uid) return;

    const fa = __dashFiltered.a != null ? __dashFiltered.a : attempts;
    const fs = __dashFiltered.s != null ? __dashFiltered.s : steps;
    const fd = __dashFiltered.d != null ? __dashFiltered.d : debriefs;
    const fpx = __dashFiltered.p || [];

    const profile = allProfiles.find(p => p.id === uid);
    $('learner-detail-name').textContent = profile?.display_name || profile?.id?.slice(0, 8) || 'Learner';

    const ua = fa.filter(a => a.user_id === uid);
    const uaIds = new Set(ua.map(a => a.id));
    const us = fs.filter(s => uaIds.has(s.attempt_id));
    const comp = ua.filter(a => a.completion_status === 'completed');
    const durations = comp.filter(a => a.total_seconds).map(a => a.total_seconds);
    const correct = us.filter(s => s.is_correct).length;

    $('learner-stats').innerHTML = `
      <div class="dash-stat"><div class="dash-stat__value">${ua.length}</div><div class="dash-stat__label">Attempts</div></div>
      <div class="dash-stat"><div class="dash-stat__value">${comp.length}</div><div class="dash-stat__label">Completed</div></div>
      <div class="dash-stat"><div class="dash-stat__value">${us.length ? ((correct / us.length) * 100).toFixed(0) + '%' : '—'}</div><div class="dash-stat__label">Accuracy</div></div>
      <div class="dash-stat"><div class="dash-stat__value">${durations.length ? (durations.reduce((s,v)=>s+v,0)/durations.length).toFixed(1) : '—'}</div><div class="dash-stat__label">Avg Time (s)</div></div>`;

    // Scenario history
    if (!ua.length) {
      $('learner-history').innerHTML = '<p class="dash-empty">No attempts.</p>';
    } else {
      let html = '<table class="inst-table"><thead><tr><th>Scenario</th><th>Started</th><th>Status</th><th>Duration (s)</th><th>Steps Correct</th></tr></thead><tbody>';
      for (const a of ua) {
        const aSteps = us.filter(s => s.attempt_id === a.id);
        const aCorrect = aSteps.filter(s => s.is_correct).length;
        html += `<tr>
          <td>${esc(a.scenario_name || a.scenario_id)}</td>
          <td>${new Date(a.started_at).toLocaleDateString()}</td>
          <td>${a.completion_status}</td>
          <td>${a.total_seconds ?? '—'}</td>
          <td>${aCorrect}/${aSteps.length}</td>
        </tr>`;
      }
      html += '</tbody></table>';
      $('learner-history').innerHTML = html;
    }

    // Debriefs
    const ud = fd.filter(d => d.scenario_attempts?.user_id === uid);
    if (!ud.length) {
      $('learner-debriefs').innerHTML = '<p class="dash-empty">No debriefs.</p>';
    } else {
      let html = '';
      for (const d of ud) {
        let body = '';
        try {
          const dj = typeof d.debrief_json === 'string' ? JSON.parse(d.debrief_json) : d.debrief_json;
          if (dj.strengths?.length) {
            body += '<h4>Strengths</h4><ul>' + dj.strengths.map(s => `<li>${esc(s)}</li>`).join('') + '</ul>';
          }
          if (dj.gaps?.length) {
            body += '<h4>Areas for Growth</h4><ul>' + dj.gaps.map(g => `<li>${esc(g)}</li>`).join('') + '</ul>';
          }
          if (dj.teaching_points?.length) {
            body += '<h4>Teaching Points</h4><ul>' + dj.teaching_points.map(tp => `<li>${esc(typeof tp === 'string' ? tp : tp.text)}</li>`).join('') + '</ul>';
          }
        } catch { body = '<p>(raw debrief data)</p>'; }

        const scenName = d.scenario_attempts?.scenario_name || d.scenario_attempts?.scenario_id || 'Unknown';
        html += `<div class="debrief-card">
          <div class="debrief-card__header">
            <span class="debrief-card__scenario">${esc(scenName)}</span>
            <span class="debrief-card__date">${new Date(d.created_at).toLocaleDateString()}</span>
          </div>
          <div class="debrief-card__body">${body}</div>
        </div>`;
      }
      $('learner-debriefs').innerHTML = html;
    }

    // Pyxis exploration (same filters as cohort)
    const upx = fpx.filter(e => e.user_id === uid);
    const opens = upx.filter(e => e.event_type === 'drawer_open');
    const dwells = upx.filter(e => e.event_type === 'contents_dwell' && e.dwell_seconds != null);
    const itemViews = upx.filter(e => e.event_type === 'item_detail_view');
    const sumDwell = dwells.reduce((s, e) => s + (e.dwell_seconds || 0), 0);
    const byDrawer = {};
    for (const o of opens) {
      const k = drawerKey(o.drawer_type, o.drawer_id);
      byDrawer[k] = (byDrawer[k] || 0) + 1;
    }
    const dwellByKey = {};
    for (const d of dwells) {
      const k = drawerKey(d.drawer_type, d.drawer_id);
      if (!dwellByKey[k]) dwellByKey[k] = [];
      dwellByKey[k].push(d.dwell_seconds);
    }

    let pyxisHtml = `
      <div class="dash-stat-grid" style="margin-bottom:1rem">
        <div class="dash-stat"><div class="dash-stat__value">${opens.length}</div><div class="dash-stat__label">Drawer opens</div></div>
        <div class="dash-stat"><div class="dash-stat__value">${Object.keys(byDrawer).length}</div><div class="dash-stat__label">Unique drawers</div></div>
        <div class="dash-stat"><div class="dash-stat__value">${itemViews.length}</div><div class="dash-stat__label">Item views</div></div>
        <div class="dash-stat"><div class="dash-stat__value">${sumDwell}</div><div class="dash-stat__label">Total dwell (s) in drawers</div></div>
      </div>`;

    const rows = Object.entries(byDrawer)
      .map(([k, count]) => {
        const pipe = k.indexOf('|');
        const dt = pipe >= 0 ? k.slice(0, pipe) : '';
        const did = pipe >= 0 ? k.slice(pipe + 1) : k;
        let dwellDisp = '—';
        if (dwellByKey[k] && dwellByKey[k].length) {
          dwellDisp = median(dwellByKey[k]).toFixed(1);
        }
        return { k, label: getDrawerLabel(dt, did), count, dwell: dwellDisp };
      })
      .sort((a, b) => b.count - a.count);

    if (!rows.length) {
      pyxisHtml += '<p class="dash-empty">No Pyxis drawer events in this date range.</p>';
    } else {
      pyxisHtml += '<table class="inst-table"><thead><tr><th>Drawer</th><th>Opens</th><th>Median dwell (s)</th></tr></thead><tbody>';
      for (const r of rows) {
        pyxisHtml += `<tr><td>${esc(r.label)}</td><td>${r.count}</td><td>${r.dwell}</td></tr>`;
      }
      pyxisHtml += '</tbody></table>';
    }

    const upxDwell = upx.filter(e => e.event_type === 'item_detail_dwell' && e.item_id && e.dwell_seconds != null);
    const dwellL = {};
    for (const ev of upxDwell) {
      const tk = dwellTripleKey(ev);
      if (!dwellL[tk]) dwellL[tk] = [];
      dwellL[tk].push(ev.dwell_seconds);
    }
    const byIL = {};
    function bumpL(e, isControlled) {
      const k = viewAggKey(e);
      if (!byIL[k]) {
        byIL[k] = {
          sample: e,
          item_type: e.item_type || (isControlled ? 'medication' : ''),
          item_id: e.item_id,
          views: 0,
          repeats: 0,
        };
      }
      byIL[k].views++;
      if (e.is_repeat === true || e.is_repeat === 'true') byIL[k].repeats++;
    }
    for (const e of upx.filter(x => x.event_type === 'item_detail_view' && x.item_id)) bumpL(e, false);
    for (const e of upx.filter(x => x.event_type === 'controlled_cell_open' && x.item_id)) bumpL(e, true);
    const itemSorted = Object.values(byIL).sort((a, b) => b.views - a.views);

    pyxisHtml += '<h3 class="dash-section__title" style="margin:1rem 0 0.5rem;font-size:0.85rem">Medications &amp; equipment (detail modals)</h3>';
    if (!itemSorted.length) {
      pyxisHtml +=
        '<p class="dash-empty">No per-item opens in this range (signed-in Pyxis use only).</p>';
    } else {
      pyxisHtml +=
        '<table class="inst-table"><thead><tr><th>Parent context</th><th>Item</th><th>Type</th><th>ID</th><th>Views</th><th>Repeats</th><th>Median dwell (s)</th></tr></thead><tbody>';
      for (const r of itemSorted) {
        const ev = r.sample;
        const tk = dwellTripleKey(ev);
        const dl = dwellL[tk];
        const md = dl && dl.length ? median(dl).toFixed(1) : '—';
        pyxisHtml += `<tr>
          <td>${esc(getItemParentLabel(ev))}</td>
          <td><strong>${esc(getItemDisplayName(ev))}</strong></td>
          <td>${esc(r.item_type || '—')}</td>
          <td><code style="font-size:0.78rem">${esc(r.item_id)}</code></td>
          <td>${r.views}</td>
          <td>${r.repeats}</td>
          <td>${md}</td>
        </tr>`;
      }
      pyxisHtml += '</tbody></table>';
    }

    $('learner-pyxis').innerHTML = pyxisHtml;
  }

  /* ── Tab: Pyxis ───────────────────────────────────────────────────── */
  function renderPyxis(fpx, visibleProfiles) {
    const learnersWithData = new Set(fpx.map(e => e.user_id));
    $('pyxis-stat-learners').textContent = learnersWithData.size;

    const drawerOpens = fpx.filter(e => e.event_type === 'drawer_open');
    $('pyxis-stat-opens').textContent = drawerOpens.length;
    const repeats = drawerOpens.filter(e => e.is_repeat === true).length;
    $('pyxis-stat-repeats').textContent = repeats;

    const itemViews = fpx.filter(e => e.event_type === 'item_detail_view').length;
    $('pyxis-stat-items').textContent = itemViews;

    // Aggregate by drawer
    const byKey = {};
    for (const o of drawerOpens) {
      const k = drawerKey(o.drawer_type, o.drawer_id);
      if (!byKey[k]) byKey[k] = { opens: [], users: new Set(), repeats: 0 };
      byKey[k].opens.push(o);
      byKey[k].users.add(o.user_id);
      if (o.is_repeat) byKey[k].repeats++;
    }

    const dwells = fpx.filter(e => e.event_type === 'contents_dwell' && e.dwell_seconds != null);
    const dwellMedian = {};
    for (const d of dwells) {
      const k = drawerKey(d.drawer_type, d.drawer_id);
      if (!dwellMedian[k]) dwellMedian[k] = [];
      dwellMedian[k].push(d.dwell_seconds);
    }

    const drawerRows = Object.keys(byKey)
      .map(k => {
        const pipe = k.indexOf('|');
        const dt = pipe >= 0 ? k.slice(0, pipe) : '';
        const did = pipe >= 0 ? k.slice(pipe + 1) : k;
        const dm = dwellMedian[k] && dwellMedian[k].length ? median(dwellMedian[k]) : null;
        return {
          label: getDrawerLabel(dt, did),
          opens: byKey[k].opens.length,
          uniqueUsers: byKey[k].users.size,
          repeats: byKey[k].repeats,
          medDwell: dm != null ? dm.toFixed(1) : '—',
        };
      })
      .sort((a, b) => b.opens - a.opens);

    if (!drawerRows.length) {
      $('pyxis-drawer-table').innerHTML = '<p class="dash-empty">No Pyxis drawer data for current filters. Learners must be signed in on the Pyxis page.</p>';
    } else {
      let html = '<table class="inst-table"><thead><tr><th>Drawer</th><th>Opens</th><th>Unique learners</th><th>Repeat opens</th><th>Median dwell (s)</th></tr></thead><tbody>';
      for (const r of drawerRows) {
        html += `<tr><td>${esc(r.label)}</td><td>${r.opens}</td><td>${r.uniqueUsers}</td><td>${r.repeats}</td><td>${r.medDwell}</td></tr>`;
      }
      html += '</tbody></table>';
      $('pyxis-drawer-table').innerHTML = html;
    }

    // Coverage: % of visible learners who opened each catalog drawer at least once
    const nLearners = visibleProfiles.length;
    if (!nLearners) {
      $('pyxis-coverage-table').innerHTML = '<p class="dash-empty">No learners in the current cohort filter.</p>';
    } else {
      let covHtml = '<table class="inst-table"><thead><tr><th>Drawer</th><th>Learners opened / total</th><th>Coverage</th></tr></thead><tbody>';
      for (const c of PYXIS_CATALOG) {
        const u = new Set();
        for (const o of drawerOpens) {
          if (o.drawer_type === c.type && o.drawer_id === c.id) u.add(o.user_id);
        }
        const pct = ((u.size / nLearners) * 100).toFixed(0);
        covHtml += `<tr><td>${esc(c.label)}</td><td>${u.size} / ${nLearners}</td><td>${pct}%</td></tr>`;
      }
      covHtml += '</tbody></table>';
      $('pyxis-coverage-table').innerHTML = covHtml;
    }

    // Supply bins
    const binOpens = fpx.filter(e => e.event_type === 'supply_bin_open' && e.bin_id);
    const binCount = {};
    for (const e of binOpens) {
      binCount[e.bin_id] = (binCount[e.bin_id] || 0) + 1;
    }
    const binRows = Object.entries(binCount).sort((a, b) => b[1] - a[1]);
    if (!binRows.length) {
      $('pyxis-supply-table').innerHTML = '<p class="dash-empty">No supply bin opens in this range.</p>';
    } else {
      let bhtml = '<table class="inst-table"><thead><tr><th>Bin ID</th><th>Opens</th></tr></thead><tbody>';
      for (const [bid, n] of binRows) {
        bhtml += `<tr><td>${esc(bid)}</td><td>${n}</td></tr>`;
      }
      bhtml += '</tbody></table>';
      $('pyxis-supply-table').innerHTML = bhtml;
    }

    // Per-medication / per-equipment: item_detail_view + controlled_cell_open, keyed by drawer + type + id
    const itemDetailEv = fpx.filter(e => e.event_type === 'item_detail_view' && e.item_id);
    const controlledEv = fpx.filter(e => e.event_type === 'controlled_cell_open' && e.item_id);
    const dwellEv = fpx.filter(e => e.event_type === 'item_detail_dwell' && e.item_id && e.dwell_seconds != null);
    const dwellByTriple = {};
    for (const ev of dwellEv) {
      const tk = dwellTripleKey(ev);
      if (!dwellByTriple[tk]) dwellByTriple[tk] = [];
      dwellByTriple[tk].push(ev.dwell_seconds);
    }

    const byItemAgg = {};
    function bumpViewRow(e, isControlled) {
      const k = viewAggKey(e);
      if (!byItemAgg[k]) {
        byItemAgg[k] = {
          sample: e,
          item_type: e.item_type || (isControlled ? 'medication' : ''),
          item_id: e.item_id,
          views: 0,
          users: new Set(),
          repeats: 0,
        };
      }
      byItemAgg[k].views++;
      byItemAgg[k].users.add(e.user_id);
      if (e.is_repeat === true || e.is_repeat === 'true') byItemAgg[k].repeats++;
    }
    for (const e of itemDetailEv) bumpViewRow(e, false);
    for (const e of controlledEv) bumpViewRow(e, true);

    const itemRows = Object.values(byItemAgg).sort((a, b) => b.views - a.views);
    if (!itemRows.length) {
      $('pyxis-items-table').innerHTML =
        '<p class="dash-empty">No per-item data yet. Students must be <strong>signed in</strong> and open a drug or equipment tile (e.g. Metoprolol) from a drawer. If the table stays empty, confirm migration <code>012_create_pyxis_events.sql</code> is applied in Supabase.</p>';
    } else {
      let ihtml =
        '<table class="inst-table"><thead><tr><th>Parent drawer / context</th><th>Item</th><th>Type</th><th>ID</th><th>Views</th><th>Learners</th><th>Repeat views</th><th>Median modal dwell (s)</th></tr></thead><tbody>';
      for (const r of itemRows) {
        const ev = r.sample;
        const parent = esc(getItemParentLabel(ev));
        const name = esc(getItemDisplayName(ev));
        const tk = dwellTripleKey(ev);
        const dwellList = dwellByTriple[tk];
        const medDwell =
          dwellList && dwellList.length ? median(dwellList).toFixed(1) : '—';
        ihtml += `<tr>
          <td>${parent}</td>
          <td><strong>${name}</strong></td>
          <td>${esc(r.item_type || '—')}</td>
          <td><code style="font-size:0.78rem">${esc(r.item_id)}</code></td>
          <td>${r.views}</td>
          <td>${r.users.size}</td>
          <td>${r.repeats}</td>
          <td>${medDwell}</td>
        </tr>`;
      }
      ihtml += '</tbody></table>';
      $('pyxis-items-table').innerHTML = ihtml;
    }
  }

  /* ── Cohort management ──────────────────────────────────────────────── */
  function setupCohortModal() {
    $('btn-manage-cohorts').addEventListener('click', () => {
      renderCohortList();
      populateAddUserDropdown();
      $('cohort-modal').showModal();
    });
    $('btn-create-cohort').addEventListener('click', createCohort);
    $('btn-add-member').addEventListener('click', addMember);
  }

  async function createCohort() {
    const name = $('cohort-name').value.trim();
    if (!name) return alert('Cohort name is required.');
    const user = await SB.getUser();
    const { data, error } = await sb.from('cohorts').insert({
      name,
      description: $('cohort-desc').value.trim() || null,
      start_date: $('cohort-start').value || null,
      end_date: $('cohort-end').value || null,
      created_by: user.id
    }).select().single();

    if (error) return alert('Error creating cohort: ' + error.message);
    allCohorts.unshift(data);
    $('cohort-name').value = '';
    $('cohort-desc').value = '';
    $('cohort-start').value = '';
    $('cohort-end').value = '';
    populateCohortDropdown();
    renderCohortList();
  }

  function populateCohortDropdown() {
    const sel = $('filter-cohort');
    const cur = sel.value;
    sel.innerHTML = '<option value="all">All Learners</option>';
    for (const c of allCohorts) {
      const dates = [c.start_date, c.end_date].filter(Boolean).join(' – ');
      sel.innerHTML += `<option value="${c.id}">${esc(c.name)}${dates ? ' (' + dates + ')' : ''}</option>`;
    }
    sel.value = cur || 'all';
  }

  function renderCohortList() {
    const container = $('cohort-list');
    if (!allCohorts.length) { container.innerHTML = '<p class="dash-empty">No cohorts yet.</p>'; return; }
    let html = '';
    for (const c of allCohorts) {
      const memberCount = allMembers.filter(m => m.cohort_id === c.id).length;
      const dates = [c.start_date, c.end_date].filter(Boolean).join(' – ');
      html += `<div class="cohort-card">
        <div class="cohort-card__info">
          <div class="cohort-card__name">${esc(c.name)}</div>
          <div class="cohort-card__meta">${memberCount} member${memberCount !== 1 ? 's' : ''}${dates ? ' · ' + dates : ''}</div>
        </div>
        <div class="cohort-card__actions">
          <button class="inst-btn inst-btn--small inst-btn--outline" onclick="window.__editCohortMembers('${c.id}')">Members</button>
          <button class="inst-btn inst-btn--small inst-btn--danger" onclick="window.__deleteCohort('${c.id}')">Delete</button>
        </div>
      </div>`;
    }
    container.innerHTML = html;
  }

  window.__editCohortMembers = function (cohortId) {
    $('cohort-member-editor').hidden = false;
    const cohort = allCohorts.find(c => c.id === cohortId);
    $('cohort-member-title').textContent = `Members of ${cohort?.name || 'Cohort'}`;
    $('cohort-member-editor').dataset.cohortId = cohortId;
    renderMembers(cohortId);
    populateAddUserDropdown(cohortId);
  };

  function renderMembers(cohortId) {
    const members = allMembers.filter(m => m.cohort_id === cohortId);
    if (!members.length) {
      $('cohort-member-list').innerHTML = '<p class="dash-empty">No members yet.</p>';
      return;
    }
    let html = '';
    for (const m of members) {
      const p = allProfiles.find(pr => pr.id === m.user_id);
      const label = p?.display_name || p?.id?.slice(0, 8) || 'unknown';
      html += `<span class="member-badge">${esc(label)}<button class="member-badge__remove" onclick="window.__removeMember('${cohortId}','${m.user_id}')">×</button></span>`;
    }
    $('cohort-member-list').innerHTML = html;
  }

  function populateAddUserDropdown(cohortId) {
    const sel = $('cohort-add-user');
    const currentMembers = cohortId
      ? new Set(allMembers.filter(m => m.cohort_id === cohortId).map(m => m.user_id))
      : new Set();
    const pool = applyCohortPickerFilters(allProfiles)
      .filter(p => !currentMembers.has(p.id))
      .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));

    sel.innerHTML = '<option value="">— Add a learner —</option>';
    for (const p of pool) {
      const opt = document.createElement('option');
      opt.value = p.id;
      const label = p.display_name || p.id.slice(0, 8);
      const sub = [(p.training_level || '').trim(), (p.institution || '').trim()]
        .filter(Boolean)
        .join(' · ');
      opt.textContent = sub ? `${label} — ${sub}` : label;
      sel.appendChild(opt);
    }
  }

  async function addMember() {
    const cohortId = $('cohort-member-editor').dataset.cohortId;
    const userId = $('cohort-add-user').value;
    if (!cohortId || !userId) return;
    const { error } = await sb.from('cohort_members').insert({ cohort_id: cohortId, user_id: userId });
    if (error) return alert('Error adding member: ' + error.message);
    allMembers.push({ cohort_id: cohortId, user_id: userId, added_at: new Date().toISOString() });
    renderMembers(cohortId);
    populateAddUserDropdown(cohortId);
    renderCohortList();
  }

  window.__removeMember = async function (cohortId, userId) {
    const { error } = await sb.from('cohort_members').delete().eq('cohort_id', cohortId).eq('user_id', userId);
    if (error) return alert('Error removing member: ' + error.message);
    allMembers = allMembers.filter(m => !(m.cohort_id === cohortId && m.user_id === userId));
    renderMembers(cohortId);
    populateAddUserDropdown(cohortId);
    renderCohortList();
  };

  window.__deleteCohort = async function (cohortId) {
    if (!confirm('Delete this cohort? Members will be removed but student data is preserved.')) return;
    const { error } = await sb.from('cohorts').delete().eq('id', cohortId);
    if (error) return alert('Error deleting cohort: ' + error.message);
    allCohorts = allCohorts.filter(c => c.id !== cohortId);
    allMembers = allMembers.filter(m => m.cohort_id !== cohortId);
    populateCohortDropdown();
    renderCohortList();
    $('cohort-member-editor').hidden = true;
  };

  /* ── Tab switching ──────────────────────────────────────────────────── */
  function setupTabs() {
    const tabs      = $$('.inst-tab');
    const tabSelect = document.getElementById('inst-tab-select');

    function activateTab(tabName) {
      tabs.forEach(t => t.classList.remove('inst-tab--active'));
      $$('.inst-panel').forEach(p => p.hidden = true);
      const matchingTab = document.querySelector(`.inst-tab[data-tab="${tabName}"]`);
      if (matchingTab) matchingTab.classList.add('inst-tab--active');
      const panel = $('panel-' + tabName);
      if (panel) panel.hidden = false;
      if (tabSelect && tabSelect.value !== tabName) tabSelect.value = tabName;
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    });

    // Mobile: dropdown drives navigation
    if (tabSelect) {
      tabSelect.addEventListener('change', () => activateTab(tabSelect.value));
    }
  }

  /* ── Learner dropdown ───────────────────────────────────────────────── */
  function populateLearnerDropdown(profiles) {
    const sel = $('learner-select');
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Choose a learner —</option>';
    for (const p of profiles) {
      const opt = document.createElement('option');
      opt.value = p.id;
      const label = p.display_name || p.id.slice(0, 8);
      const sub = [(p.training_level || '').trim(), (p.institution || '').trim()]
        .filter(Boolean)
        .join(' · ');
      opt.textContent = sub ? `${label} — ${sub}` : label;
      sel.appendChild(opt);
    }
    if (cur && profiles.some(p => p.id === cur)) sel.value = cur;
    else {
      sel.value = '';
      $('learner-detail').hidden = true;
    }
  }

  /* ── CSV export ─────────────────────────────────────────────────────── */
  function exportCSV(type) {
    let rows, filename;
    const cohortId = $('filter-cohort').value;
    const startDate = $('filter-start').value;
    const endDate = $('filter-end').value;

    if (type === 'attempts') {
      rows = filterRows(attempts, 'user_id', 'started_at', startDate, endDate);
      filename = 'scenario_attempts.csv';
    } else if (type === 'steps') {
      const validAttempts = new Set(filterRows(attempts, 'user_id', 'started_at', startDate, endDate).map(a => a.id));
      rows = steps.filter(s => validAttempts.has(s.attempt_id));
      filename = 'step_events.csv';
    } else if (type === 'pyxis') {
      rows = filterRows(pyxisEvents, 'user_id', 'created_at', startDate, endDate);
      filename = 'pyxis_events.csv';
    } else {
      rows = filterRows(tutEvents, 'user_id', 'created_at', startDate, endDate);
      filename = 'tutorial_events.csv';
    }

    if (!rows.length) return alert('No data to export for current filters.');

    const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p.display_name || p.id.slice(0, 8)]));

    const cols = Object.keys(rows[0]);
    const header = cols.join(',');
    const body = rows.map(r => cols.map(c => {
      let v = r[c];
      if (c === 'user_id' && profileMap[v]) v = profileMap[v];
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');

    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  function filterRows(arr, userCol, dateCol, startDate, endDate) {
    let out = arr;
    if (filteredUserIds) out = out.filter(r => filteredUserIds.has(r[userCol]));
    if (startDate) out = out.filter(r => r[dateCol] >= startDate);
    if (endDate) out = out.filter(r => r[dateCol] <= endDate + 'T23:59:59');
    return out;
  }

  /* ── Utilities ──────────────────────────────────────────────────────── */
  function groupBy(arr, key) {
    const map = {};
    for (const item of arr) {
      const k = item[key] ?? 'unknown';
      (map[k] = map[k] || []).push(item);
    }
    return map;
  }

  function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  function latencyColor(sec) {
    if (sec <= 5) return '#22c55e';
    if (sec <= 10) return '#eab308';
    if (sec <= 20) return '#f97316';
    return '#ef4444';
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  /* ── Start ──────────────────────────────────────────────────────────── */
  init();
})();
