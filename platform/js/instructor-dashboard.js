/**
 * instructor-dashboard.js — Full instructor dashboard logic
 *
 * Tabs: Cohort Overview, Scenario Performance, Tutorial Engagement,
 *       Individual Learners, Export
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
  let filteredUserIds = null; // null = all

  /* ── DOM refs ───────────────────────────────────────────────────────── */
  const $  = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ── Init ───────────────────────────────────────────────────────────── */
  async function init() {
    const user = await SB.getUser();
    if (!user) return;
    const profile = await SB.getProfile();
    if (profile?.display_name) {
      $('welcome-name').textContent = `Welcome, ${profile.display_name}`;
    }

    setupTabs();
    setupCohortModal();
    $('btn-apply-filters').addEventListener('click', applyFilters);
    $('btn-export-attempts').addEventListener('click', () => exportCSV('attempts'));
    $('btn-export-steps').addEventListener('click', () => exportCSV('steps'));
    $('btn-export-tutorials').addEventListener('click', () => exportCSV('tutorials'));
    $('learner-select').addEventListener('change', onLearnerChange);

    await loadAll();
    applyFilters();
  }

  /* ── Data loading ───────────────────────────────────────────────────── */
  async function loadAll() {
    const [pRes, cRes, mRes, aRes, sRes, tRes, dRes] = await Promise.all([
      sb.from('profiles').select('*').eq('role', 'student'),
      sb.from('cohorts').select('*').order('created_at', { ascending: false }),
      sb.from('cohort_members').select('*'),
      sb.from('scenario_attempts').select('*').order('started_at', { ascending: false }),
      sb.from('step_events').select('*'),
      sb.from('tutorial_events').select('*'),
      sb.from('ai_outputs').select('*, scenario_attempts!inner(user_id, scenario_id, scenario_name)').order('created_at', { ascending: false })
    ]);

    allProfiles = pRes.data || [];
    allCohorts  = cRes.data || [];
    allMembers  = mRes.data || [];
    attempts    = aRes.data || [];
    steps       = sRes.data || [];
    tutEvents   = tRes.data || [];
    debriefs    = dRes.data || [];

    populateCohortDropdown();
    populateLearnerDropdown(allProfiles);
    renderCohortList();
  }

  /* ── Filtering ──────────────────────────────────────────────────────── */
  function applyFilters() {
    const cohortId  = $('filter-cohort').value;
    const startDate = $('filter-start').value;
    const endDate   = $('filter-end').value;

    // Determine user set
    if (cohortId === 'all') {
      filteredUserIds = null;
    } else {
      const memberIds = allMembers
        .filter(m => m.cohort_id === cohortId)
        .map(m => m.user_id);
      filteredUserIds = new Set(memberIds);
    }

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

    // Update learner dropdown to filtered set
    let visibleProfiles = allProfiles;
    if (filteredUserIds) visibleProfiles = allProfiles.filter(p => filteredUserIds.has(p.id));
    populateLearnerDropdown(visibleProfiles);

    renderOverview(fa, fs, ft, visibleProfiles);
    renderScenarios(fa, fs);
    renderTutorials(ft);
    renderLearnerDetail(fa, fs, fd);
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
    const wrongSteps = fs.filter(s => !s.is_correct && s.choice_label);
    const wrongGroups = {};
    for (const s of wrongSteps) {
      const key = `${s.attempt_id}__step${s.step_number}`;
      const scAttempt = fa.find(a => a.id === s.attempt_id);
      const scId = scAttempt ? (scAttempt.scenario_name || scAttempt.scenario_id) : 'unknown';
      const wKey = `${scId}|Step ${s.step_number}|${s.choice_label}`;
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

  function renderLearnerDetail(fa, fs, fd) {
    const uid = $('learner-select').value;
    if (!uid) return;

    if (!fa) {
      fa = attempts; fs = steps; fd = debriefs;
    }

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
    sel.innerHTML = '<option value="">— Add a learner —</option>';
    for (const p of allProfiles) {
      if (currentMembers.has(p.id)) continue;
      const label = p.display_name || p.id.slice(0, 8);
      sel.innerHTML += `<option value="${p.id}">${esc(label)}</option>`;
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
    const tabs = $$('.inst-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('inst-tab--active'));
        tab.classList.add('inst-tab--active');
        $$('.inst-panel').forEach(p => p.hidden = true);
        const target = 'panel-' + tab.dataset.tab;
        const panel = $(target);
        if (panel) panel.hidden = false;
      });
    });
  }

  /* ── Learner dropdown ───────────────────────────────────────────────── */
  function populateLearnerDropdown(profiles) {
    const sel = $('learner-select');
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Choose a learner —</option>';
    for (const p of profiles) {
      const label = p.display_name || p.id.slice(0, 8);
      sel.innerHTML += `<option value="${p.id}">${esc(label)}</option>`;
    }
    if (cur && profiles.some(p => p.id === cur)) sel.value = cur;
    else { sel.value = ''; $('learner-detail').hidden = true; }
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
