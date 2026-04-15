/**
 * ai-chat.js — Calls Supabase Edge Function `ai-chat` (OpenAI server-side).
 * Requires: supabase-client.js (window.SB), @supabase/supabase-js
 *
 * Daily limit (15) and DB logging are enforced in the Edge Function.
 */
(function () {
  'use strict';

  /**
   * @param {'pyxis'|'ventilator'} page
   * @param {{ role: string, content: string }[]} messages  user/assistant only (no system)
   * @returns {Promise<{ ok: boolean, reply?: string, remaining_today?: number, code?: string, message?: string }>}
   */
  window.invokeAIChat = async function (page, messages) {
    if (!window.SB || !SB.client) {
      return { ok: false, code: 'config', message: 'Sign-in service not loaded.' };
    }

    let { data: { session } } = await SB.client.auth.getSession();
    if (!session) {
      return { ok: false, code: 'auth', message: 'Please sign in to use the assistant.' };
    }

    // Refresh so access_token is valid (expired tokens cause gateway "Invalid JWT").
    const { data: refreshed } = await SB.client.auth.refreshSession();
    if (refreshed.session) session = refreshed.session;

    const { data: json, error: fnErr } = await SB.client.functions.invoke('ai-chat', {
      body: {
        page: page === 'ventilator' ? 'ventilator' : 'pyxis',
        messages: messages,
      },
      headers: {
        Authorization: 'Bearer ' + session.access_token,
      },
    });

    if (fnErr) {
      let code = 'http';
      let message = fnErr.message || 'Request failed.';
      try {
        const ctx = fnErr.context;
        if (ctx && typeof ctx.body === 'string') {
          const parsed = JSON.parse(ctx.body);
          if (parsed.error) code = parsed.error;
          if (parsed.message) message = parsed.message;
        }
      } catch (_) {}
      return { ok: false, code, message };
    }

    if (json && json.reply) {
      return {
        ok: true,
        reply: json.reply,
        remaining_today: typeof json.remaining_today === 'number' ? json.remaining_today : undefined,
      };
    }

    return {
      ok: false,
      code: (json && json.error) || 'unknown',
      message: (json && json.message) || 'Unexpected response.',
    };
  };
})();
