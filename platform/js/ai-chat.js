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

    const base = SB.client.supabaseUrl;
    const anon = SB.client.supabaseKey;
    const url = base.replace(/\/$/, '') + '/functions/v1/ai-chat';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session.access_token,
        apikey: anon,
      },
      body: JSON.stringify({
        page: page === 'ventilator' ? 'ventilator' : 'pyxis',
        messages: messages,
      }),
    });

    let json = {};
    try {
      json = await res.json();
    } catch (_) {
      return { ok: false, code: 'parse', message: 'Invalid response from server.' };
    }

    if (!res.ok) {
      return {
        ok: false,
        code: json.error || 'http',
        message: json.message || ('Error ' + res.status),
      };
    }

    if (json.reply) {
      return {
        ok: true,
        reply: json.reply,
        remaining_today: typeof json.remaining_today === 'number' ? json.remaining_today : undefined,
      };
    }

    return { ok: false, code: json.error || 'unknown', message: json.message || 'Unexpected response.' };
  };
})();
