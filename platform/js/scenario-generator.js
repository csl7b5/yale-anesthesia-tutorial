/**
 * scenario-generator.js
 * Instructor-side UI for:
 *   1. Motif Template Manager (Add / Edit / Archive)
 *   2. AI Scenario Case Generator (generate from motif → review → approve/reject)
 *
 * Requires: window.SB (Supabase client, instructor session)
 * Loaded on: platform/instructor.html
 */
(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

  async function getSession() {
    if (!window.SB?.client) return null;
    const { data: { session } } = await window.SB.client.auth.getSession();
    return session;
  }

  function showStatus(el, msg, isErr) {
    if (!el) return;
    el.textContent = msg;
    el.style.color = isErr ? '#ef4444' : 'var(--text-muted)';
  }

  // ── MOTIF MANAGER ────────────────────────────────────────────────────────

  let editingMotifId = null;
  let stepCount = 0;

  async function loadMotifs() {
    const listEl = qs('#motif-list');
    if (!listEl) return;

    const { data, error } = await window.SB.client
      .from('scenario_motifs')
      .select('id, title, clinical_domain, badge, is_active, created_at, steps')
      .order('created_at', { ascending: false });

    if (error || !data) {
      listEl.innerHTML = `<p class="inst-hint" style="color:#ef4444">Failed to load motifs: ${error?.message}</p>`;
      return;
    }
    if (data.length === 0) {
      listEl.innerHTML = '<p class="inst-hint">No motifs yet. Click "Add Motif" to create one.</p>';
      return;
    }

    listEl.innerHTML = `
      <table class="inst-table">
        <thead><tr>
          <th>Title</th><th>Domain</th><th>Steps</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${data.map(m => `
            <tr>
              <td><strong>${escHtml(m.title)}</strong></td>
              <td>${escHtml(m.clinical_domain)}</td>
              <td>${Array.isArray(m.steps) ? m.steps.length : 0}</td>
              <td><span class="motif-status motif-status--${m.is_active ? 'active' : 'archived'}">${m.is_active ? 'Active' : 'Archived'}</span></td>
              <td>
                <button class="inst-btn inst-btn--sm" data-motif-edit="${m.id}">Edit</button>
                ${m.is_active
                  ? `<button class="inst-btn inst-btn--sm inst-btn--danger" data-motif-archive="${m.id}">Archive</button>`
                  : `<button class="inst-btn inst-btn--sm" data-motif-restore="${m.id}">Restore</button>`
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    listEl.querySelectorAll('[data-motif-edit]').forEach(btn =>
      btn.addEventListener('click', () => openMotifEditor(btn.dataset.motifEdit))
    );
    listEl.querySelectorAll('[data-motif-archive]').forEach(btn =>
      btn.addEventListener('click', () => archiveMotif(btn.dataset.motifArchive, true))
    );
    listEl.querySelectorAll('[data-motif-restore]').forEach(btn =>
      btn.addEventListener('click', () => archiveMotif(btn.dataset.motifRestore, false))
    );
  }

  async function openMotifEditor(motifId) {
    editingMotifId = motifId || null;
    stepCount = 0;
    const editorEl = qs('#motif-editor');
    const titleEl  = qs('#motif-editor-title');
    if (!editorEl) return;

    // Reset form
    qs('#motif-form').reset();
    qs('#mf-steps-list').innerHTML = '';

    if (motifId) {
      titleEl.textContent = 'Edit Motif';
      const { data, error } = await window.SB.client
        .from('scenario_motifs')
        .select('*')
        .eq('id', motifId)
        .single();
      if (error || !data) return;

      qs('#mf-title').value        = data.title;
      qs('#mf-domain').value       = data.clinical_domain;
      qs('#mf-summary').value      = data.summary;
      qs('#mf-badge').value        = data.badge;
      qs('#mf-badge-color').value  = data.badge_color;
      qs('#mf-objectives').value   = (data.learning_objectives || []).join('\n');

      const pc = data.physiology_constraints || {};
      if (pc.cardiacOutput) { qs('#mf-co-min').value = pc.cardiacOutput[0];   qs('#mf-co-max').value = pc.cardiacOutput[1]; }
      if (pc.compliance)    { qs('#mf-comp-min').value = pc.compliance[0];    qs('#mf-comp-max').value = pc.compliance[1]; }
      if (pc.resistance)    { qs('#mf-res-min').value = pc.resistance[0];     qs('#mf-res-max').value = pc.resistance[1]; }

      // Populate steps
      (data.steps || []).forEach(step => addStepRow(step));
    } else {
      titleEl.textContent = 'New Motif';
      addStepRow();  // start with one blank step
    }

    editorEl.hidden = false;
    editorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let currentWizStep = 1;
  const TOTAL_WIZ_STEPS = 4;

  async function openMotifEditor(motifId) {
    editingMotifId = motifId;
    stepCount = 0;
    qs('#mf-steps-list').innerHTML = '';
    currentWizStep = 1;
    updateWizardUI();

    if (motifId) {
      // Edit existing
      const { data, error } = await window.SB.client
        .from('scenario_motifs')
        .select('*')
        .eq('id', motifId)
        .single();
      if (error) { alert('Failed to load motif'); return; }

      qs('#mf-title').value = data.title;
      qs('#mf-domain').value = data.clinical_domain;
      qs('#mf-summary').value = data.summary;
      qs('#mf-badge').value = data.badge;
      qs('#mf-badge-color').value = data.badge_color || '#64748b';
      qs('#mf-objectives').value = (data.learning_objectives || []).join('\n');

      if (data.physiology_constraints) {
        const p = data.physiology_constraints;
        if (p.cardiacOutput) { qs('#mf-co-min').value = p.cardiacOutput[0]; qs('#mf-co-max').value = p.cardiacOutput[1]; }
        if (p.compliance)    { qs('#mf-comp-min').value = p.compliance[0]; qs('#mf-comp-max').value = p.compliance[1]; }
        if (p.resistance)    { qs('#mf-res-min').value = p.resistance[0]; qs('#mf-res-max').value = p.resistance[1]; }
      }

      (data.steps || []).forEach(step => addStepRow(step));
    } else {
      // New motif
      qs('#motif-wizard-form').reset();
      addStepRow();
    }

    qs('#motif-wizard-modal').showModal();
  }

  function closeMotifEditor() {
    qs('#motif-wizard-modal').close();
    editingMotifId = null;
  }

  function updateWizardUI() {
    // Content sections
    for (let i = 1; i <= TOTAL_WIZ_STEPS; i++) {
      const content = qs(`#wiz-content-${i}`);
      if (content) {
        if (i === currentWizStep) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      }
      
      // Indicators
      const ind = qs(`#wiz-step-ind-${i}`);
      if (ind) {
        ind.classList.remove('motif-wizard__step-indicator--active', 'motif-wizard__step-indicator--completed');
        if (i < currentWizStep) ind.classList.add('motif-wizard__step-indicator--completed');
        if (i === currentWizStep) ind.classList.add('motif-wizard__step-indicator--active');
      }
    }

    // Buttons
    qs('#btn-wiz-prev').style.visibility = currentWizStep === 1 ? 'hidden' : 'visible';
    
    if (currentWizStep === TOTAL_WIZ_STEPS) {
      qs('#btn-wiz-next').style.display = 'none';
      qs('#btn-wiz-save').style.display = 'inline-block';
      populateReviewStep();
    } else {
      qs('#btn-wiz-next').style.display = 'inline-block';
      qs('#btn-wiz-save').style.display = 'none';
    }
  }

  function populateReviewStep() {
    qs('#wiz-review-title').textContent = qs('#mf-title').value || '(Untitled)';
    qs('#wiz-review-summary').textContent = qs('#mf-summary').value || '(No summary provided)';
    
    const badge = qs('#mf-badge').value || 'CASE';
    const badgeColor = qs('#mf-badge-color').value || '#64748b';
    const badgeEl = qs('#wiz-review-badge');
    badgeEl.textContent = badge;
    badgeEl.style.backgroundColor = badgeColor + '20'; // Add transparency
    badgeEl.style.color = badgeColor;
    badgeEl.style.borderColor = badgeColor + '40';

    const domainSelect = qs('#mf-domain');
    qs('#wiz-review-domain').textContent = domainSelect.options[domainSelect.selectedIndex]?.text || '';
    
    qs('#wiz-review-step-count').textContent = qs('#mf-steps-list').querySelectorAll('.motif-step-card').length;
    
    const objText = qs('#mf-objectives').value.trim();
    qs('#wiz-review-obj-count').textContent = objText ? objText.split('\n').filter(Boolean).length : 0;
  }

  function addStepRow(existingStep) {
    const list = qs('#mf-steps-list');
    if (!list) return;
    const idx = stepCount++;
    const div = document.createElement('div');
    div.className = 'motif-step-card';
    div.dataset.stepIdx = idx;
    
    div.innerHTML = `
      <div class="motif-step-card__header">
        <div class="motif-step-card__title">Step <span class="step-num">${idx + 1}</span></div>
        <button type="button" class="motif-step-card__remove" title="Remove Step">Remove</button>
      </div>
      
      <div class="wizard-grid" style="row-gap:0.75rem">
        <div class="wizard-field">
          <label class="wizard-label">Phase</label>
          <input type="text" class="wizard-input mf-step-phase" placeholder="Deterioration / Intervention..." value="${escHtml(existingStep?.phase || '')}" />
        </div>
        <div class="wizard-field">
          <label class="wizard-label">Clinical Domain Tag</label>
          <input type="text" class="wizard-input mf-step-domain" placeholder="e.g. hemodynamic_monitoring" value="${escHtml(existingStep?.clinical_domain || '')}" />
        </div>
        <div class="wizard-field wizard-field--full">
          <label class="wizard-label">Narrative Prompt</label>
          <textarea class="wizard-input mf-step-prompt" rows="2" placeholder="Describe the physiology...">${escHtml(existingStep?.narrative_prompt || '')}</textarea>
        </div>
        <div class="wizard-field wizard-field--full">
          <label class="wizard-label">Base Effect Profile (Physics)</label>
          <input type="text" class="wizard-input mf-step-effect" placeholder="e.g. moderate_hypotension" value="${escHtml(existingStep?.effect_profile || '')}" />
        </div>
      </div>
      
      <div style="margin-top:1.5rem">
        <label class="wizard-label">Clinical Choices</label>
        <div class="choice-grid">
          ${(existingStep?.choices || [{},{},{},{}]).map((c, ci) => `
            <div class="choice-row motif-choice-row">
              <div class="choice-row__label">${String.fromCharCode(65+ci)}</div>
              <div class="choice-row__input">
                <input type="text" class="wizard-input mf-choice-action" style="width:100%" placeholder="Clinical action description" value="${escHtml(c.clinical_action || '')}" />
                <input type="text" class="wizard-input mf-choice-effect" style="width:100%; margin-top:0.4rem" placeholder="Effect profile (physics impact)" value="${escHtml(c.effect_profile || '')}" />
              </div>
              <label class="choice-row__correct">
                <input type="checkbox" class="mf-choice-correct" style="width:16px;height:16px;cursor:pointer" ${c.is_correct ? 'checked' : ''} />
                Correct
              </label>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    div.querySelector('.motif-step-card__remove').addEventListener('click', () => {
      div.remove();
      renumberSteps();
    });
    list.appendChild(div);
  }

  function renumberSteps() {
    qs('#mf-steps-list').querySelectorAll('.motif-step-card__header .step-num').forEach((el, i) => {
      el.textContent = i + 1;
    });
  }

  function collectMotifFormData() {
    const steps = Array.from(qs('#mf-steps-list').querySelectorAll('.motif-step-card')).map(row => {
      const choices = Array.from(row.querySelectorAll('.motif-choice-row')).map((cr, ci) => ({
        label:           String.fromCharCode(65 + ci),
        clinical_action: cr.querySelector('.mf-choice-action').value.trim(),
        is_correct:      cr.querySelector('.mf-choice-correct').checked,
        effect_profile:  cr.querySelector('.mf-choice-effect').value.trim(),
      }));
      return {
        phase:            row.querySelector('.mf-step-phase').value.trim(),
        clinical_domain:  row.querySelector('.mf-step-domain').value.trim(),
        narrative_prompt: row.querySelector('.mf-step-prompt').value.trim(),
        effect_profile:   row.querySelector('.mf-step-effect').value.trim(),
        choices,
      };
    });

    return {
      title:                   qs('#mf-title').value.trim(),
      clinical_domain:         qs('#mf-domain').value,
      summary:                 qs('#mf-summary').value.trim(),
      badge:                   qs('#mf-badge').value.trim() || 'CASE',
      badge_color:             qs('#mf-badge-color').value,
      learning_objectives:     qs('#mf-objectives').value.split('\n').map(s => s.trim()).filter(Boolean),
      physiology_constraints: {
        cardiacOutput: [parseFloat(qs('#mf-co-min').value),   parseFloat(qs('#mf-co-max').value)],
        compliance:    [parseFloat(qs('#mf-comp-min').value), parseFloat(qs('#mf-comp-max').value)],
        resistance:    [parseFloat(qs('#mf-res-min').value),  parseFloat(qs('#mf-res-max').value)],
      },
      steps,
    };
  }

  async function saveMotif(e) {
    e.preventDefault();
    const saveBtn = qs('#btn-wiz-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const payload = collectMotifFormData();
    let error;

    if (editingMotifId) {
      ({ error } = await window.SB.client
        .from('scenario_motifs')
        .update(payload)
        .eq('id', editingMotifId));
    } else {
      ({ error } = await window.SB.client
        .from('scenario_motifs')
        .insert(payload));
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Motif';

    if (error) {
      alert('Save failed: ' + error.message);
    } else {
      closeMotifEditor();
      loadMotifs();
    }
  }

  async function archiveMotif(motifId, archive) {
    if (archive && !confirm('Archive this motif? It will no longer be available for generation.')) return;
    const { error } = await window.SB.client
      .from('scenario_motifs')
      .update({ is_active: !archive, archived_at: archive ? new Date().toISOString() : null })
      .eq('id', motifId);
    if (error) { alert('Failed: ' + error.message); return; }
    loadMotifs();
  }

  // ── GENERATED CASES ──────────────────────────────────────────────────────

  async function loadGeneratedCases() {
    const listEl = qs('#generated-cases-list');
    if (!listEl) return;

    const { data, error } = await window.SB.client
      .from('generated_scenarios')
      .select('id, created_at, patient_summary, status, visibility, is_archived, reviewer_notes, motif_id, scenario_motifs(title, badge, badge_color)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      listEl.innerHTML = `<p class="inst-hint" style="color:#ef4444">Failed to load cases: ${error?.message}</p>`;
      return;
    }
    if (data.length === 0) {
      listEl.innerHTML = '<p class="inst-hint">No generated cases yet. Click "Generate New Case" to create one.</p>';
      return;
    }

    const active   = data.filter(c => !c.is_archived);
    const archived = data.filter(c =>  c.is_archived);

    function renderRow(c) {
      const m = c.scenario_motifs || {};
      const badge      = m.badge      || 'CASE';
      const badgeColor = m.badge_color || '#64748b';
      const badgePill  = `<span style="display:inline-block;padding:2px 7px;border-radius:999px;font-size:0.68rem;font-weight:700;
        background:${badgeColor}22;color:${badgeColor};border:1px solid ${badgeColor}55">${escHtml(badge)}</span>`;

      const visLabel = c.status === 'approved'
        ? `<br><span style="font-size:0.72rem;opacity:0.75">${c.visibility === 'public' ? '🌎 Public' : c.visibility === 'hidden' ? '🔒 Private' : '👥 Cohort'}</span>`
        : '';
      const statusChip = c.is_archived
        ? `<span class="motif-status motif-status--archived">Archived</span>`
        : `<span class="motif-status motif-status--${c.status}">${c.status}</span>${visLabel}`;

      const actionBtns = c.is_archived
        ? `<button class="inst-btn inst-btn--sm" data-unarchive="${c.id}">Unarchive</button>
           <button class="inst-btn inst-btn--sm inst-btn--danger" data-delete="${c.id}">Delete</button>`
        : `${c.status === 'pending' ? `
             <button class="inst-btn inst-btn--sm inst-btn--primary" data-publish="${c.id}">Publish</button>
             <button class="inst-btn inst-btn--sm inst-btn--danger"  data-reject="${c.id}">Reject</button>
           ` : `
             <button class="inst-btn inst-btn--sm" data-visibility="${c.id}">👁 Visibility</button>
           `}
           <button class="inst-btn inst-btn--sm" data-edit="${c.id}">✏️ Edit</button>
           <button class="inst-btn inst-btn--sm" data-preview="${c.id}">Preview</button>
           <button class="inst-btn inst-btn--sm inst-btn--danger" data-archive="${c.id}">Archive</button>`;

      return `
        <tr>
          <td>${escHtml(c.patient_summary || '—')}</td>
          <td>${escHtml(m.title || '—')}<br>${badgePill}</td>
          <td>${statusChip}</td>
          <td style="white-space:nowrap">${new Date(c.created_at).toLocaleDateString()}</td>
          <td style="white-space:nowrap;display:flex;flex-wrap:wrap;gap:4px">${actionBtns}</td>
        </tr>`;
    }

    let html = `<table class="inst-table"><thead><tr>
      <th>Patient</th><th>Motif / Badge</th><th>Status</th><th>Generated</th><th>Actions</th>
    </tr></thead><tbody>${active.map(renderRow).join('')}`;

    if (archived.length) {
      html += `<tr><td colspan="5" style="padding:10px 8px 4px;font-size:0.75rem;color:#9ca3af;font-weight:600;letter-spacing:.04em;border-top:2px solid #f3f4f6">
        ARCHIVED (${archived.length})</td></tr>
        ${archived.map(renderRow).join('')}`;
    }
    html += '</tbody></table>';
    listEl.innerHTML = html;

    listEl.querySelectorAll('[data-publish]').forEach(btn =>
      btn.addEventListener('click', () => openPublishModal(btn.dataset.publish, false)));
    listEl.querySelectorAll('[data-visibility]').forEach(btn =>
      btn.addEventListener('click', () => openPublishModal(btn.dataset.visibility, true)));
    listEl.querySelectorAll('[data-reject]').forEach(btn =>
      btn.addEventListener('click', () => reviewCase(btn.dataset.reject, 'rejected')));
    listEl.querySelectorAll('[data-preview]').forEach(btn =>
      btn.addEventListener('click', () => previewCase(btn.dataset.preview)));
    listEl.querySelectorAll('[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => openEditModal(btn.dataset.edit)));
    listEl.querySelectorAll('[data-archive]').forEach(btn =>
      btn.addEventListener('click', () => archiveCase(btn.dataset.archive, true)));
    listEl.querySelectorAll('[data-unarchive]').forEach(btn =>
      btn.addEventListener('click', () => archiveCase(btn.dataset.unarchive, false)));
    listEl.querySelectorAll('[data-delete]').forEach(btn =>
      btn.addEventListener('click', () => deleteCase(btn.dataset.delete)));
  }

  async function loadAssignments() {
    const listEl = qs('#assignments-list');
    if (!listEl) return;

    const { data, error } = await window.SB.client
      .from('case_assignments')
      .select(`
        id,
        created_at,
        status,
        notified_at,
        started_at,
        completed_at,
        assigned_to,
        generated_scenarios (
          id,
          patient_summary,
          scenario_motifs ( title )
        )
      `)
      .order('created_at', { ascending: false });

    let profileMap = {};
    if (data && data.length) {
      const userIds = [...new Set(data.map(a => a.assigned_to).filter(Boolean))];
      if (userIds.length) {
        const { data: profiles } = await window.SB.client
          .from('profiles')
          .select('id, display_name, institution')
          .in('id', userIds);
        if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });
      }
    }
    if (data) data.forEach(a => { a._profile = profileMap[a.assigned_to] || null; });

    if (error || !data) {
      listEl.innerHTML = `<p class="inst-hint" style="color:#ef4444">Failed to load assignments: ${error?.message}</p>`;
      return;
    }
    if (data.length === 0) {
      listEl.innerHTML = '<p class="inst-hint">No assignments yet. Use visibility options on a generated case to assign to a cohort.</p>';
      return;
    }

    listEl.innerHTML = `
      <div class="inst-table-wrap">
        <table class="inst-table">
          <thead><tr>
            <th>Student</th><th>Case</th><th>Status</th><th>Assigned</th><th>Activity</th>
          </tr></thead>
          <tbody>
            ${data.map(a => {
              const studentName = a._profile?.display_name || a.assigned_to?.slice(0, 8) || 'Unknown Student';
              const caseTitle = a.generated_scenarios?.scenario_motifs?.title || 'Unknown Case';

              let statusBadge = '';
              if (a.status === 'completed') statusBadge = '<span class="motif-status motif-status--active">Completed</span>';
              else if (a.status === 'started') statusBadge = '<span class="motif-status motif-status--pending">In Progress</span>';
              else statusBadge = '<span class="motif-status motif-status--archived">Assigned</span>';

              const dates = [];
              if (a.started_at) dates.push(`Started: ${new Date(a.started_at).toLocaleDateString()}`);
              if (a.completed_at) dates.push(`Done: ${new Date(a.completed_at).toLocaleDateString()}`);

              return `
              <tr>
                <td style="font-weight:600">${escHtml(studentName)}</td>
                <td>${escHtml(caseTitle)}</td>
                <td>${statusBadge}</td>
                <td style="white-space:nowrap">${new Date(a.created_at).toLocaleDateString()}</td>
                <td style="font-size:0.8rem; color:#6b7280">${dates.length ? dates.join('<br>') : '—'}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>`;
  }

  async function reviewCase(caseId, status) {
    const notes = status === 'rejected'
      ? prompt('Optional: reason for rejection (shown in logs):') || ''
      : '';
    const { error } = await window.SB.client
      .from('generated_scenarios')
      .update({ status, reviewer_notes: notes, reviewed_at: new Date().toISOString() })
      .eq('id', caseId);
    if (error) { alert('Update failed: ' + error.message); return; }
    loadGeneratedCases();
  }

  async function archiveCase(caseId, archive) {
    if (archive && !confirm('Archive this case? Students will no longer see it, but you can unarchive it at any time.')) return;
    const { error } = await window.SB.client
      .from('generated_scenarios')
      .update({ is_archived: archive })
      .eq('id', caseId);
    if (error) { alert('Update failed: ' + error.message); return; }
    loadGeneratedCases();
  }

  async function togglePrivacy(caseId) {
    // Fetch current visibility first
    const { data, error: fetchErr } = await window.SB.client
      .from('generated_scenarios')
      .select('visibility')
      .eq('id', caseId)
      .single();
    if (fetchErr || !data) { alert('Could not fetch case visibility.'); return; }

    const newVis = data.visibility === 'private' ? 'public' : 'private';
    const { error } = await window.SB.client
      .from('generated_scenarios')
      .update({ visibility: newVis })
      .eq('id', caseId);
    if (error) { alert('Update failed: ' + error.message); return; }
    loadGeneratedCases();
  }

  async function deleteCase(caseId) {
    if (!confirm('Permanently delete this case? This cannot be undone.')) return;
    const { error } = await window.SB.client
      .from('generated_scenarios')
      .delete()
      .eq('id', caseId);
    if (error) { alert('Delete failed: ' + error.message); return; }
    loadGeneratedCases();
  }

  // ── EDIT CASE MODAL ──────────────────────────────────────────────────────

  async function openEditModal(caseId) {
    const modal = qs('#edit-case-modal');
    if (!modal) return;

    qs('#edit-case-id').value = caseId;
    qs('#edit-case-status').textContent = '';
    qs('#edit-steps-container').innerHTML = '<p class="inst-hint">Loading…</p>';
    modal.showModal();

    const { data, error } = await window.SB.client
      .from('generated_scenarios')
      .select('scenario_json, patient_summary, scenario_motifs(badge, badge_color)')
      .eq('id', caseId)
      .single();

    if (error || !data) {
      qs('#edit-steps-container').innerHTML = `<p class="inst-hint" style="color:#ef4444">Failed to load case: ${error?.message}</p>`;
      return;
    }

    const s = data.scenario_json || {};
    qs('#edit-title').value         = s.title || '';
    qs('#edit-summary').value       = data.patient_summary || s.summary || '';
    qs('#edit-badge').value         = s.badge || data.scenario_motifs?.badge || '';
    qs('#edit-badge-color').value   = s.badgeColor || data.scenario_motifs?.badge_color || '#64748b';

    // Render steps
    const steps = s.steps || [];
    if (!steps.length) {
      qs('#edit-steps-container').innerHTML = '<p class="inst-hint">No steps found in this case.</p>';
      return;
    }

    qs('#edit-steps-container').innerHTML = steps.map((step, si) => `
      <fieldset style="border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:0.75rem">
        <legend style="font-size:0.78rem;font-weight:700;color:#374151;padding:0 6px;text-transform:uppercase;letter-spacing:.05em">
          Step ${si + 1} — ${escHtml(step.phase || '')}
        </legend>
        <div style="display:flex;flex-direction:column;gap:0.6rem">
          <label class="inst-account-label">Clue / Clinical Context
            <textarea class="inst-input edit-step-clue" data-step="${si}" rows="3" style="resize:vertical">${escHtml(step.clue || '')}</textarea>
          </label>
          <label class="inst-account-label">Question Prompt
            <textarea class="inst-input edit-step-question" data-step="${si}" rows="2" style="resize:vertical">${escHtml(step.question || '')}</textarea>
          </label>
          <div style="margin-top:0.4rem">
            <p style="font-size:0.72rem;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;margin:0 0 0.4rem">Choices</p>
            ${(step.choices || []).map((ch, ci) => `
              <div style="display:flex;gap:0.5rem;align-items:flex-start;margin-bottom:0.5rem;padding:0.5rem;background:${ch.isCorrect ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.04)'};border-radius:6px;border:1px solid ${ch.isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.12)'}">
                <label style="display:flex;flex-direction:column;gap:2px;min-width:20px;align-items:center;margin-top:4px">
                  <input type="checkbox" class="edit-choice-correct" data-step="${si}" data-choice="${ci}" ${ch.isCorrect ? 'checked' : ''} title="Mark as correct answer" />
                  <span style="font-size:0.6rem;color:#9ca3af">✓</span>
                </label>
                <div style="flex:1;display:flex;flex-direction:column;gap:4px">
                  <textarea class="inst-input edit-choice-text" data-step="${si}" data-choice="${ci}" rows="2" style="resize:vertical;font-size:0.82rem">${escHtml(ch.text || '')}</textarea>
                  <textarea class="inst-input edit-choice-feedback" data-step="${si}" data-choice="${ci}" rows="2" placeholder="Feedback shown after selection…" style="resize:vertical;font-size:0.78rem;color:#6b7280">${escHtml(ch.feedback || '')}</textarea>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </fieldset>
    `).join('');
  }

  async function saveEditedCase(e) {
    e.preventDefault();
    const caseId  = qs('#edit-case-id').value;
    const statusEl = qs('#edit-case-status');
    const saveBtn  = qs('#btn-save-edit');
    saveBtn.disabled = true;
    statusEl.textContent = 'Saving…';
    statusEl.style.color = '#6b7280';

    // Fetch current scenario_json to merge edits into
    const { data, error: fetchErr } = await window.SB.client
      .from('generated_scenarios')
      .select('scenario_json')
      .eq('id', caseId)
      .single();

    if (fetchErr || !data) {
      statusEl.textContent = 'Failed to fetch case for saving.';
      statusEl.style.color = '#ef4444';
      saveBtn.disabled = false;
      return;
    }

    const s = JSON.parse(JSON.stringify(data.scenario_json || {})); // deep clone

    // Apply overview edits
    s.title      = qs('#edit-title').value.trim();
    s.badge      = qs('#edit-badge').value.trim();
    s.badgeColor = qs('#edit-badge-color').value;

    const newSummary = qs('#edit-summary').value.trim();

    // Apply step edits
    const steps = s.steps || [];
    qs('#edit-steps-container').querySelectorAll('.edit-step-clue').forEach(el => {
      const si = +el.dataset.step;
      if (steps[si]) steps[si].clue = el.value.trim();
    });
    qs('#edit-steps-container').querySelectorAll('.edit-step-question').forEach(el => {
      const si = +el.dataset.step;
      if (steps[si]) steps[si].question = el.value.trim();
    });
    qs('#edit-steps-container').querySelectorAll('.edit-choice-text').forEach(el => {
      const si = +el.dataset.step, ci = +el.dataset.choice;
      if (steps[si]?.choices?.[ci]) steps[si].choices[ci].text = el.value.trim();
    });
    qs('#edit-steps-container').querySelectorAll('.edit-choice-feedback').forEach(el => {
      const si = +el.dataset.step, ci = +el.dataset.choice;
      if (steps[si]?.choices?.[ci]) steps[si].choices[ci].feedback = el.value.trim();
    });
    qs('#edit-steps-container').querySelectorAll('.edit-choice-correct').forEach(el => {
      const si = +el.dataset.step, ci = +el.dataset.choice;
      if (steps[si]?.choices?.[ci]) steps[si].choices[ci].isCorrect = el.checked;
    });
    s.steps = steps;

    const { error } = await window.SB.client
      .from('generated_scenarios')
      .update({ scenario_json: s, patient_summary: newSummary })
      .eq('id', caseId);

    if (error) {
      statusEl.textContent = 'Save failed: ' + error.message;
      statusEl.style.color = '#ef4444';
    } else {
      statusEl.textContent = '✓ Saved successfully.';
      statusEl.style.color = '#16a34a';
      setTimeout(() => { qs('#edit-case-modal').close(); loadGeneratedCases(); }, 1200);
    }
    saveBtn.disabled = false;
  }

  // ── PUBLISH MODAL ────────────────────────────────────────────────────────

  async function openPublishModal(caseId, isVisibilityEdit = false) {
    const modal = qs('#publish-case-modal');
    qs('#pub-case-id').value = caseId;

    // Set modal title based on context
    const titleEl = qs('#publish-modal-title');
    if (titleEl) titleEl.textContent = isVisibilityEdit ? 'Manage Visibility' : 'Publish or Assign Case';
    const saveBtn = qs('#btn-save-publish');
    if (saveBtn) saveBtn.textContent = isVisibilityEdit ? 'Save Visibility' : 'Publish Case';

    // If editing existing visibility, pre-select current value
    if (isVisibilityEdit) {
      try {
        const { data } = await window.SB.client
          .from('generated_scenarios')
          .select('visibility')
          .eq('id', caseId)
          .single();
        if (data) {
          const vis = data.visibility === 'public' ? 'public'
                    : data.visibility === 'hidden' ? 'hidden'
                    : 'cohort';
          const radio = qs(`input[name="pub-visibility"][value="${vis}"]`);
          if (radio) radio.checked = true;
          qs('#pub-assign-section').hidden = (vis !== 'cohort');
        }
      } catch(e) {}
    } else {
      // Default to public for new publishes
      const publicRadio = qs('input[name="pub-visibility"][value="public"]');
      if (publicRadio) publicRadio.checked = true;
      qs('#pub-assign-section').hidden = true;
    }

    // Auto-fill author name from profile if available
    try {
      const { data } = await window.SB.client.from('profiles').select('name').eq('id', (await getSession()).user.id).single();
      if (data?.name && !qs('#pub-author-label').value) {
        qs('#pub-author-label').value = 'Dr. ' + data.name.split(' ').pop();
      }
    } catch(e) {}

    // Load cohorts for the dropdown
    try {
      const { data } = await window.SB.client.from('cohorts').select('id, name').order('name');
      const sel = qs('#pub-cohort-select');
      if (data && sel) {
        sel.innerHTML = '<option value="">— Select a cohort —</option>' +
          data.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
      }
    } catch(e) {}

    // Show/hide cohort picker based on radio selection
    qs('#publish-case-form').querySelectorAll('input[name="pub-visibility"]').forEach(r => {
      r.addEventListener('change', () => {
        qs('#pub-assign-section').hidden = (r.value !== 'cohort');
      });
    });

    modal.showModal();
  }

  async function previewCase(caseId) {
    const { data, error } = await window.SB.client
      .from('generated_scenarios')
      .select('scenario_json, patient_summary')
      .eq('id', caseId)
      .single();
    if (error || !data) return;
    const s = data.scenario_json;
    alert(
      `PATIENT: ${data.patient_summary}\n\n` +
      `TITLE: ${s.title}\n\n` +
      `STEPS: ${s.steps?.length ?? 0}\n\n` +
      `Step 1 clue: ${s.steps?.[0]?.clue ?? '—'}\n\n` +
      `Step 1 question: ${s.steps?.[0]?.question ?? '—'}`
    );
  }

  async function populateMotifSelect() {
    const select = qs('#gen-motif-select');
    if (!select) return;
    const { data } = await window.SB.client
      .from('scenario_motifs')
      .select('id, title, badge, badge_color')
      .eq('is_active', true)
      .order('title');
    if (!data) return;
    select.innerHTML = data.map(m =>
      `<option value="${m.id}" data-badge="${escHtml(m.badge||'')}" data-badge-color="${escHtml(m.badge_color||'')}">
         ${escHtml(m.title)}${m.badge ? ' [' + escHtml(m.badge) + ']' : ''}
       </option>`
    ).join('');
  }

  async function runGenerator() {
    const motifId = qs('#gen-motif-select').value;
    if (!motifId) return;
    const seed = {};
    const age = qs('#gen-age').value;
    const sex = qs('#gen-sex').value;
    if (age) seed.age_range = age;
    if (sex) seed.sex = sex;

    const statusEl = qs('#gen-status');
    const runBtn   = qs('#btn-run-generator');
    runBtn.disabled = true;
    showStatus(statusEl, 'Generating — this takes 10–20 seconds…');

    const session = await getSession();
    if (!session) { showStatus(statusEl, 'Not signed in.', true); runBtn.disabled = false; return; }

    try {
      const { data, error } = await window.SB.client.functions.invoke('scenario-generator', {
        body: { motif_id: motifId, seed },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.generated_scenario_id) {
        showStatus(statusEl, 'Generation failed: ' + (error?.message || data?.message || 'Unknown error'), true);
      } else {
        showStatus(statusEl, `✓ Generated: ${data.patient_summary}. Switch to the Generated Cases tab to review.`);
        qs('#generate-form-wrap').hidden = true;
        loadGeneratedCases();
      }
    } catch (err) {
      showStatus(statusEl, 'Error: ' + err.message, true);
    }
    runBtn.disabled = false;
  }

  // ── PUBLISH MODAL HANDLERS ───────────────────────────────────────────────

  async function handlePublishSubmit(e) {
    e.preventDefault();
    const saveBtn = qs('#btn-save-publish');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const caseId = qs('#pub-case-id').value;
    const rawVis = qs('input[name="pub-visibility"]:checked').value; // 'public' | 'cohort' | 'hidden'
    const visibility = rawVis === 'cohort' ? 'private' : rawVis; // DB stores 'private' for cohort-assigned
    const authorLabel = qs('#pub-author-label').value.trim();
    const cohortId = rawVis === 'cohort' ? qs('#pub-cohort-select').value : '';

    if (rawVis === 'cohort' && !cohortId) {
      alert("Please select a cohort to assign the case to.");
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      return;
    }

    try {
      // 0. Fetch the case's motif to inherit badge / badge_color into scenario_json
      const { data: caseData } = await window.SB.client
        .from('generated_scenarios')
        .select('scenario_json, motif_id, scenario_motifs(badge, badge_color)')
        .eq('id', caseId)
        .single();

      let scenarioJson = caseData?.scenario_json ?? {};
      const motifBadge      = caseData?.scenario_motifs?.badge      || scenarioJson.badge      || 'CASE';
      const motifBadgeColor = caseData?.scenario_motifs?.badge_color || scenarioJson.badgeColor || '#64748b';
      // Stamp the motif's badge onto the scenario JSON so the simulator displays the right badge
      scenarioJson = { ...scenarioJson, badge: motifBadge, badgeColor: motifBadgeColor };

      // 1. Update the case record
      const { error: updErr } = await window.SB.client
        .from('generated_scenarios')
        .update({
          status: 'approved',
          visibility: visibility,
          author_label: authorLabel,
          published_at: new Date().toISOString(),
          scenario_json: scenarioJson   // write back with corrected badge
        })
        .eq('id', caseId);

      if (updErr) throw updErr;

      // 2. If assigning to a cohort, get cohort members and create assignments
      if (cohortId) {
        // Find users in this cohort
        const { data: members, error: memErr } = await window.SB.client
          .from('cohort_members')
          .select('user_id')
          .eq('cohort_id', cohortId);
        
        if (memErr) throw memErr;

        if (members && members.length > 0) {
          const assignments = members.map(m => ({
            scenario_id: caseId,
            assigned_to: m.user_id,
            status: 'assigned'
          }));

          // Upsert assignments
          const { error: assignErr } = await window.SB.client
            .from('case_assignments')
            .upsert(assignments, { onConflict: 'scenario_id,assigned_to', ignoreDuplicates: true });
            
          if (assignErr) throw assignErr;

          // 3. Trigger email notification edge function
          const session = await getSession();
          window.SB.client.functions.invoke('send-case-assignment', {
            body: { scenario_id: caseId, cohort_id: cohortId },
            headers: { Authorization: `Bearer ${session.access_token}` },
          }).catch(err => console.error("Email notification failed:", err)); // Non-blocking
        }
      }

      qs('#publish-case-modal').close();
      loadGeneratedCases();
    } catch (err) {
      alert('Failed to publish: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Publish Case';
    }
  }

  // ── Wiring ───────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function init() {
    window.addEventListener('instructor-tab', (ev) => {
      const tab = ev.detail?.tab;
      if (tab === 'motifs') loadMotifs();
      else if (tab === 'generated') {
        loadGeneratedCases();
        populateMotifSelect();
      } else if (tab === 'assignments') loadAssignments();
    });

    // Motif editor (Wizard)
    qs('#btn-add-motif')?.addEventListener('click', () => openMotifEditor(null));
    qs('#btn-add-step')?.addEventListener('click', () => addStepRow());
    qs('#btn-close-wizard')?.addEventListener('click', closeMotifEditor);
    qs('#motif-wizard-form')?.addEventListener('submit', saveMotif);
    
    qs('#btn-wiz-next')?.addEventListener('click', () => {
      // Basic validation check before moving to next step
      const form = qs('#motif-wizard-form');
      if (currentWizStep === 1 && (!qs('#mf-title').value || !qs('#mf-domain').value || !qs('#mf-summary').value)) {
        form.reportValidity(); // triggers HTML5 validation bubbles
        return;
      }
      if (currentWizStep < TOTAL_WIZ_STEPS) {
        currentWizStep++;
        updateWizardUI();
      }
    });

    qs('#btn-wiz-prev')?.addEventListener('click', () => {
      if (currentWizStep > 1) {
        currentWizStep--;
        updateWizardUI();
      }
    });

    // Generator
    qs('#btn-generate-case')?.addEventListener('click', () => {
      const wrap = qs('#generate-form-wrap');
      wrap.hidden = !wrap.hidden;
      if (!wrap.hidden) populateMotifSelect();
    });
    qs('#btn-cancel-generator')?.addEventListener('click', () => {
      qs('#generate-form-wrap').hidden = true;
    });
    qs('#btn-run-generator')?.addEventListener('click', runGenerator);

    // Publish / Visibility modal
    qs('#publish-modal-close')?.addEventListener('click', () => qs('#publish-case-modal').close());
    qs('#btn-cancel-publish')?.addEventListener('click',  () => qs('#publish-case-modal').close());
    qs('#publish-case-form')?.addEventListener('submit', handlePublishSubmit);

    // Toggle cohort dropdown based on visibility radio (initial wiring)
    document.querySelectorAll('input[name="pub-visibility"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        qs('#pub-assign-section').hidden = e.target.value !== 'cohort';
      });
    });

    // Edit Case modal
    qs('#edit-case-close')?.addEventListener('click',  () => qs('#edit-case-modal').close());
    qs('#btn-cancel-edit')?.addEventListener('click',  () => qs('#edit-case-modal').close());
    qs('#edit-case-form')?.addEventListener('submit', saveEditedCase);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
