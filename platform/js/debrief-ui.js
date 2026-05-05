/**
 * debrief-ui.js — Renders the debrief modal after scenario completion.
 *
 * Hooks into the scenario resolution flow: when #scen-restart-btn is visible,
 * a "View Debrief" button is injected. Clicking it opens the debrief modal.
 *
 * Requires: debrief-engine.js, debrief-data.js, supabase-client.js (all loaded first)
 */
(function () {
  'use strict';

  if (!window.DebriefEngine) return;

  // ── Track step results as the student plays ─────────────────────────────

  const stepResults = [];
  let activeScenarioId = null;
  let stepShownAt = null;
  let currentStep = 0;

  // Detect scenario start
  document.addEventListener('click', e => {
    const card = e.target.closest('.scen-card');
    if (!card) return;
    // Read the ID directly from the card's data attribute — no hardcoded list needed
    activeScenarioId = card.dataset.scenId || null;
    stepResults.length = 0;
    currentStep = 0;
  });

  // Detect new step rendered
  const scenQA = document.getElementById('scen-qa');
  if (scenQA) {
    new MutationObserver(() => {
      if (scenQA.querySelector('.scen-choice:not([disabled])')) {
        stepShownAt = Date.now();
        currentStep++;
      }
    }).observe(scenQA, { childList: true, subtree: true });
  }

  // Detect answer
  document.addEventListener('click', e => {
    const choice = e.target.closest('.scen-choice');
    if (!choice || !stepShownAt) return;
    const latency = Math.round((Date.now() - stepShownAt) / 1000);

    setTimeout(() => {
      const isCorrect = choice.classList.contains('scen-choice--correct');
      stepResults.push({ step: currentStep, correct: isCorrect, latency });
    }, 120);

    stepShownAt = null;
  });

  // ── Inject "View Debrief" button into resolution screen ─────────────────

  const observer = new MutationObserver(() => {
    const resolution = document.getElementById('scen-resolution');
    if (!resolution || resolution.hidden) return;
    if (resolution.querySelector('.debrief-trigger')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'scen-next-btn debrief-trigger';
    btn.textContent = '📋 View Debrief';
    btn.addEventListener('click', showDebrief);

    const restartBtn = document.getElementById('scen-restart-btn');
    if (restartBtn) {
      restartBtn.parentNode.insertBefore(btn, restartBtn);
    } else {
      resolution.appendChild(btn);
    }
  });

  const scenActive = document.getElementById('scen-active');
  const scenResolution = document.getElementById('scen-resolution');
  if (scenResolution) {
    observer.observe(scenResolution, { attributes: true, attributeFilter: ['hidden'] });
  }
  if (scenActive) {
    observer.observe(scenActive, { attributes: true, attributeFilter: ['hidden'] });
  }

  // ── Show debrief ────────────────────────────────────────────────────────

  async function showDebrief() {
    if (!activeScenarioId) return;

    // Generate debrief; fall back to a generic shell if this scenario isn't in the data yet
    let debrief = stepResults.length > 0
      ? DebriefEngine.generateDebrief(activeScenarioId, stepResults)
      : null;

    if (!debrief) {
      const allCorrect = stepResults.length > 0 && stepResults.every(s => s.correct);
      debrief = {
        summary: stepResults.length === 0
          ? 'Scenario complete.'
          : allCorrect
            ? 'Excellent work — you chose the correct intervention at every step.'
            : 'Scenario complete. Review the teaching points below to reinforce your understanding.',
        strengths: [],
        gaps: [],
        teaching_points: [],
        next_drill: null,
        step_details: stepResults.map((s, i) => ({
          step: i + 1, correct: s.correct, latency: s.latency, domains: [],
        })),
        avg_latency: stepResults.length
          ? Math.round(stepResults.reduce((a, r) => a + r.latency, 0) / stepResults.length)
          : 0,
        weak_domains_raw: [],
      };
    }

    const modal = document.getElementById('debrief-modal');
    if (!modal) return;

    // Summary
    document.getElementById('debrief-summary').textContent = debrief.summary;

    // Strengths
    const sEl = document.getElementById('debrief-strengths');
    sEl.innerHTML = debrief.strengths.length > 0
      ? debrief.strengths.map(s => `<li>${s}</li>`).join('')
      : '<li class="debrief-dialog__none">None identified this attempt</li>';

    // Gaps
    const gEl = document.getElementById('debrief-gaps');
    gEl.innerHTML = debrief.gaps.length > 0
      ? debrief.gaps.map(g => `<li>${g}</li>`).join('')
      : '<li class="debrief-dialog__none">None — nice work</li>';

    // Step details
    const stepsEl = document.getElementById('debrief-steps');
    stepsEl.innerHTML = debrief.step_details.map(s =>
      `<div class="debrief-step ${s.correct ? 'debrief-step--correct' : 'debrief-step--wrong'}">
        <span class="debrief-step__icon">${s.correct ? '✓' : '✗'}</span>
        <span class="debrief-step__label">Step ${s.step}</span>
        <span class="debrief-step__time">${s.latency}s</span>
        <span class="debrief-step__domains">${s.domains.join(', ')}</span>
      </div>`
    ).join('');

    // Key Strengths to Demonstrate (scenario-specific, always shown)
    const ksEl = document.getElementById('debrief-key-strengths');
    if (ksEl) {
      ksEl.innerHTML = (debrief.key_strengths || []).length > 0
        ? debrief.key_strengths.map(s => `<li>${s}</li>`).join('')
        : '<li class="debrief-dialog__none">See teaching points below</li>';
    }

    // Common Pitfalls (scenario-specific, always shown)
    const pfEl = document.getElementById('debrief-pitfalls');
    if (pfEl) {
      pfEl.innerHTML = (debrief.common_pitfalls || []).length > 0
        ? debrief.common_pitfalls.map(p => `<li>${p}</li>`).join('')
        : '<li class="debrief-dialog__none">None listed</li>';
    }

    // High-Yield Pearls (scenario-specific, always shown)
    const pearlEl = document.getElementById('debrief-pearls');
    if (pearlEl) {
      pearlEl.innerHTML = (debrief.high_yield_pearls || []).length > 0
        ? debrief.high_yield_pearls.map(p => `<li>${p}</li>`).join('')
        : '';
    }

    // Domain review teaching points (performance-based)
    const tEl = document.getElementById('debrief-teaching');
    const domainSection = document.getElementById('debrief-domain-teaching-section');
    if (tEl && debrief.teaching_points && debrief.teaching_points.length > 0) {
      tEl.innerHTML = debrief.teaching_points.map(t => `<li>${t}</li>`).join('');
      if (domainSection) domainSection.hidden = false;
    } else {
      if (domainSection) domainSection.hidden = true;
    }

    // Drill
    const drillSection = document.getElementById('debrief-drill-section');
    const drillFeedback = document.getElementById('debrief-drill-feedback');
    drillFeedback.hidden = true;

    if (debrief.next_drill) {
      drillSection.hidden = false;
      document.getElementById('debrief-drill-prompt').textContent = debrief.next_drill.prompt;
      const choicesEl = document.getElementById('debrief-drill-choices');
      choicesEl.innerHTML = debrief.next_drill.choices.map((c, i) =>
        `<button class="debrief-drill-btn" data-drill-idx="${i}">${c.text}</button>`
      ).join('');

      choicesEl.querySelectorAll('.debrief-drill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.drillIdx, 10);
          const isCorrect = idx === debrief.next_drill.correct_index;

          choicesEl.querySelectorAll('.debrief-drill-btn').forEach((b, j) => {
            b.disabled = true;
            if (j === debrief.next_drill.correct_index) b.classList.add('debrief-drill-btn--correct');
            else if (j === idx && !isCorrect) b.classList.add('debrief-drill-btn--wrong');
          });

          drillFeedback.textContent = (isCorrect ? '✓ Correct. ' : '✗ Incorrect. ') + debrief.next_drill.explanation;
          drillFeedback.className = 'debrief-dialog__drill-feedback ' +
            (isCorrect ? 'debrief-dialog__drill-feedback--correct' : 'debrief-dialog__drill-feedback--wrong');
          drillFeedback.hidden = false;
        });
      });
    } else {
      drillSection.hidden = true;
    }

    // AI Debrief — opt-in via button; requires sign-in
    const aiSigninNote = document.getElementById('debrief-ai-signin-note');
    const aiBtn        = document.getElementById('debrief-ai-btn');
    const aiBody       = document.getElementById('debrief-ai-body');
    const signinPrompt = document.getElementById('debrief-signin-prompt');

    // Reset state each time modal opens
    if (aiBtn)        { aiBtn.hidden = false; aiBtn.disabled = false; }
    if (aiBody)       { aiBody.hidden = true; aiBody.textContent = ''; aiBody.className = 'debrief-ai-body'; }
    if (aiSigninNote) aiSigninNote.hidden = true;

    const user = window.SB ? await SB.getUser().catch(() => null) : null;

    if (!user) {
      // Not signed in — show sign-in note, hide button
      if (aiBtn)        aiBtn.hidden = true;
      if (aiSigninNote) aiSigninNote.hidden = false;
      if (signinPrompt) signinPrompt.hidden = false;
    } else {
      // Signed in — show the generate button
      if (signinPrompt) signinPrompt.hidden = true;
      if (aiBtn && window.ScenarioCoach) {
        // Capture scenario context now (before the button is clicked)
        const _title   = window._activeScenTitle || activeScenarioId || '';
        const _steps   = (window._scenStepHistory || []).map(h => ({
          question:    h.question,
          choice_text: h.choice_text,
          is_correct:  h.is_correct,
          domain:      h.domain,
        }));
        const _attempt = window._currentAttemptId || null;

        aiBtn.onclick = async () => {
          aiBtn.hidden = true;
          if (aiBody) {
            aiBody.hidden = false;
            aiBody.className = 'debrief-ai-body debrief-ai-body--loading';
            aiBody.innerHTML = '<span class="scen-ai-coaching__spinner"></span> Generating personalised debrief\u2026';
          }
          const text = await window.ScenarioCoach.requestDebrief({
            scenarioTitle:  _title,
            patientContext: '',
            attemptId:      _attempt,
            steps:          _steps,
          }).catch(() => null);

          if (text && aiBody) {
            aiBody.className = 'debrief-ai-body';
            aiBody.textContent = text;
          } else if (aiBody) {
            aiBody.className = 'debrief-ai-body';
            aiBody.textContent = 'AI debrief unavailable. Please try again later.';
          }
        };
      } else if (aiBtn) {
        // ScenarioCoach not loaded
        aiBtn.hidden = true;
      }
    }

    // Save to Supabase if authenticated
    if (user && window.SB) {
      const { data: attempts } = await SB.client
        .from('scenario_attempts')
        .select('id')
        .eq('user_id', user.id)
        .eq('scenario_id', activeScenarioId)
        .eq('completion_status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1);

      if (attempts && attempts.length > 0) {
        await SB.client.from('ai_outputs').insert({
          attempt_id:       attempts[0].id,
          source:           'rule_based',
          debrief_json:     debrief,
          weak_domains:     debrief.weak_domains_raw || [],
          recommended_next: debrief.next_drill?.domain || null,
        });
      }
    }

    modal.showModal();
  }

  // ── Close ───────────────────────────────────────────────────────────────

  document.getElementById('debrief-close')?.addEventListener('click', () => {
    document.getElementById('debrief-modal')?.close();
  });

  document.getElementById('debrief-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  });

})();
