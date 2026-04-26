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
    const idx = parseInt(card.dataset.scenIdx, 10);
    // Map scenario index to ID by reading from the page or known order
    const scenIds = ['hypo', 'anaphylaxis', 'bronchospasm'];
    activeScenarioId = scenIds[idx] || null;
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
    if (!activeScenarioId || stepResults.length === 0) return;

    const debrief = DebriefEngine.generateDebrief(activeScenarioId, stepResults);
    if (!debrief) return;

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

    // Teaching points
    const tEl = document.getElementById('debrief-teaching');
    tEl.innerHTML = debrief.teaching_points.map(t => `<li>${t}</li>`).join('');

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

    // AI Debrief — personalised coaching narrative, loaded asynchronously
    const aiSection = document.getElementById('debrief-ai-section');
    const aiBody    = document.getElementById('debrief-ai-body');
    if (aiSection && aiBody && window.ScenarioCoach) {
      aiSection.hidden = false;
      aiBody.className = 'debrief-ai-body debrief-ai-body--loading';
      aiBody.innerHTML = '<span class="scen-ai-coaching__spinner"></span> Generating personalised debrief\u2026';

      window.ScenarioCoach.requestDebrief({
        scenarioTitle:  window._activeScenTitle ?? activeScenarioId ?? '',
        patientContext: '',
        attemptId:      window._currentAttemptId ?? null,
        steps: (window._scenStepHistory ?? []).map(h => ({
          question:    h.question,
          choice_text: h.choice_text,
          is_correct:  h.is_correct,
          domain:      h.domain,
        })),
      }).then(text => {
        if (text) {
          aiBody.className = 'debrief-ai-body';
          aiBody.textContent = text;
        } else {
          aiSection.hidden = true;
        }
      });
    } else if (aiSection) {
      aiSection.hidden = true;
    }

    // Sign-in prompt for anonymous users
    const signinPrompt = document.getElementById('debrief-signin-prompt');
    const user = window.SB ? await SB.getUser() : null;
    if (signinPrompt) signinPrompt.hidden = !!user;

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
