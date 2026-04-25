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

  function addStepRow(existingStep) {
    const list = qs('#mf-steps-list');
    if (!list) return;
    const idx = stepCount++;
    const div = document.createElement('div');
    div.className = 'motif-step-row';
    div.dataset.stepIdx = idx;
    div.innerHTML = `
      <div class="motif-step-row__header">
        <strong>Step ${idx + 1}</strong>
        <button type="button" class="inst-btn inst-btn--sm inst-btn--danger motif-step-remove">Remove</button>
      </div>
      <div class="motif-form__row">
        <label class="motif-form__label">Phase
          <input type="text" class="motif-form__input mf-step-phase" placeholder="Deterioration / Intervention / Resolution" value="${escHtml(existingStep?.phase || '')}" />
        </label>
        <label class="motif-form__label">Clinical domain tag
          <input type="text" class="motif-form__input mf-step-domain" placeholder="e.g. hemodynamic_monitoring" value="${escHtml(existingStep?.clinical_domain || '')}" />
        </label>
      </div>
      <label class="motif-form__label" style="display:block;margin-bottom:10px">Narrative prompt for AI
        <textarea class="motif-form__input mf-step-prompt" rows="2" placeholder="Describe what the patient looks like at this stage — used to guide the AI's clue and question text">${escHtml(existingStep?.narrative_prompt || '')}</textarea>
      </label>
      <div class="motif-form__row">
        <label class="motif-form__label">Step effect profile (physics for the step)
          <input type="text" class="motif-form__input mf-step-effect" placeholder="e.g. moderate_hypotension" value="${escHtml(existingStep?.effect_profile || '')}" />
        </label>
      </div>
      <div class="mf-step-choices">
        ${(existingStep?.choices || [{},{},{},{}]).map((c, ci) => `
          <div class="motif-form__row motif-choice-row">
            <label style="flex:0 0 24px;font-weight:700">${String.fromCharCode(65+ci)}.</label>
            <input type="text" class="motif-form__input mf-choice-action" placeholder="Clinical action" value="${escHtml(c.clinical_action || '')}" />
            <label style="white-space:nowrap;display:flex;align-items:center;gap:4px">
              <input type="checkbox" class="mf-choice-correct" ${c.is_correct ? 'checked' : ''} /> Correct
            </label>
            <input type="text" class="motif-form__input motif-form__input--sm mf-choice-effect" placeholder="Effect profile" value="${escHtml(c.effect_profile || '')}" />
          </div>
        `).join('')}
      </div>`;

    div.querySelector('.motif-step-remove').addEventListener('click', () => {
      div.remove();
      renumberSteps();
    });
    list.appendChild(div);
  }

  function renumberSteps() {
    qs('#mf-steps-list').querySelectorAll('.motif-step-row__header strong').forEach((el, i) => {
      el.textContent = `Step ${i + 1}`;
    });
  }

  function collectMotifFormData() {
    const steps = Array.from(qs('#mf-steps-list').querySelectorAll('.motif-step-row')).map(row => {
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
    const saveBtn = qs('#mf-save-btn');
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

  function closeMotifEditor() {
    qs('#motif-editor').hidden = true;
    editingMotifId = null;
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
      .select('id, created_at, patient_summary, status, reviewer_notes, motif_id, scenario_motifs(title)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) {
      listEl.innerHTML = `<p class="inst-hint" style="color:#ef4444">Failed to load cases: ${error?.message}</p>`;
      return;
    }
    if (data.length === 0) {
      listEl.innerHTML = '<p class="inst-hint">No generated cases yet. Click "Generate New Case" to create one.</p>';
      return;
    }

    listEl.innerHTML = `
      <table class="inst-table">
        <thead><tr>
          <th>Patient</th><th>Motif</th><th>Status</th><th>Generated</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${data.map(c => `
            <tr>
              <td>${escHtml(c.patient_summary || '—')}</td>
              <td>${escHtml(c.scenario_motifs?.title || '—')}</td>
              <td><span class="motif-status motif-status--${c.status}">${c.status}</span></td>
              <td style="white-space:nowrap">${new Date(c.created_at).toLocaleDateString()}</td>
              <td>
                ${c.status === 'pending' ? `
                  <button class="inst-btn inst-btn--sm inst-btn--primary" data-approve="${c.id}">Approve</button>
                  <button class="inst-btn inst-btn--sm inst-btn--danger"  data-reject="${c.id}">Reject</button>
                ` : ''}
                <button class="inst-btn inst-btn--sm" data-preview="${c.id}">Preview</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    listEl.querySelectorAll('[data-approve]').forEach(btn =>
      btn.addEventListener('click', () => reviewCase(btn.dataset.approve, 'approved'))
    );
    listEl.querySelectorAll('[data-reject]').forEach(btn =>
      btn.addEventListener('click', () => reviewCase(btn.dataset.reject, 'rejected'))
    );
    listEl.querySelectorAll('[data-preview]').forEach(btn =>
      btn.addEventListener('click', () => previewCase(btn.dataset.preview))
    );
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
      .select('id, title')
      .eq('is_active', true)
      .order('title');
    if (!data) return;
    select.innerHTML = data.map(m =>
      `<option value="${m.id}">${escHtml(m.title)}</option>`
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

  // ── Wiring ───────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function init() {
    // Tab activation triggers data load
    document.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]');
      if (tab?.dataset.tab === 'motifs') {
        loadMotifs();
      } else if (tab?.dataset.tab === 'generated') {
        loadGeneratedCases();
        populateMotifSelect();
      }
    });

    // Motif editor
    qs('#btn-add-motif')?.addEventListener('click', () => openMotifEditor(null));
    qs('#btn-add-step')?.addEventListener('click', () => addStepRow());
    qs('#mf-cancel-btn')?.addEventListener('click', closeMotifEditor);
    qs('#motif-form')?.addEventListener('submit', saveMotif);

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
