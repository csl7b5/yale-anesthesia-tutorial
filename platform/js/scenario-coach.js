/**
 * scenario-coach.js
 * Client-side helpers for AI coaching and debrief via the scenario-coach edge function.
 * Requires window.SB (Supabase client with active session) to be available.
 *
 * Usage:
 *   ScenarioCoach.requestStepCoaching({ ... })  → Promise<string | null>
 *   ScenarioCoach.requestDebrief({ ... })        → Promise<string | null>
 */
window.ScenarioCoach = (() => {
  const FUNCTION_NAME = 'scenario-coach';

  /** Invoke the edge function with an authenticated Bearer token. */
  async function callEdgeFn(payload) {
    if (!window.SB?.client) return null;
    const { data: { session } } = await window.SB.client.auth.getSession();
    if (!session?.access_token) return null;

    try {
      const { data, error } = await window.SB.client.functions.invoke(FUNCTION_NAME, {
        body: payload,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        console.warn('[scenario-coach] edge fn error:', error.message);
        return null;
      }
      return data?.reply ?? null;
    } catch (err) {
      console.warn('[scenario-coach] fetch error:', err);
      return null;
    }
  }

  /**
   * Request per-step coaching after a learner selects a scenario answer.
   *
   * @param {object} opts
   * @param {string}   opts.scenarioId          - scenario id (e.g. 'bronchospasm')
   * @param {string}   opts.scenarioTitle        - display title
   * @param {string}   [opts.patientContext]     - brief patient description shown to AI
   * @param {string}   opts.stepClue             - the monitor clue text for this step
   * @param {string}   opts.question             - the MCQ question text
   * @param {string}   opts.choiceText           - the choice the learner selected
   * @param {boolean}  opts.isCorrect
   * @param {string}   opts.hardcodedFeedback    - the existing hardcoded feedback text
   * @param {Array}    [opts.stepHistory]        - [{question, correct}] for prior steps
   * @returns {Promise<string|null>}
   */
  async function requestStepCoaching(opts) {
    return callEdgeFn({
      mode: 'coaching',
      scenario_title:      opts.scenarioTitle,
      patient_context:     opts.patientContext ?? '',
      step_clue:           opts.stepClue ?? '',
      question:            opts.question,
      choice_text:         opts.choiceText,
      is_correct:          opts.isCorrect,
      hardcoded_feedback:  opts.hardcodedFeedback,
      step_history:        opts.stepHistory ?? [],
    });
  }

  /**
   * Request a full end-of-scenario debrief.
   *
   * @param {object} opts
   * @param {string}   opts.scenarioTitle
   * @param {string}   [opts.patientContext]
   * @param {string}   [opts.attemptId]       - UUID from scenario_attempts; stored in ai_outputs
   * @param {Array}    opts.steps             - [{question, choice_text, is_correct, domain}]
   * @returns {Promise<string|null>}
   */
  async function requestDebrief(opts) {
    return callEdgeFn({
      mode:            'debrief',
      scenario_title:  opts.scenarioTitle,
      patient_context: opts.patientContext ?? '',
      attempt_id:      opts.attemptId ?? null,
      steps:           opts.steps,
    });
  }

  return { requestStepCoaching, requestDebrief };
})();
