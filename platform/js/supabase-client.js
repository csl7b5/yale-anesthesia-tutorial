/**
 * supabase-client.js — Supabase init + auth helpers
 *
 * Loads the Supabase JS client from CDN (added via <script> in HTML).
 * The anon key is a public/publishable key safe for client-side use;
 * all data access is gated by Row Level Security policies.
 */
(function () {
  'use strict';

  const SUPABASE_URL  = 'https://fpdlxevzbyqkztauwtno.supabase.co';
  const SUPABASE_ANON = 'sb_publishable_IPL8H5MvvizvGjNPf0sYzQ_AWKLzR48';

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

  async function getUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  }

  async function getProfile() {
    const user = await getUser();
    if (!user) return null;
    const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
    return data;
  }

  async function getRole() {
    const profile = await getProfile();
    return profile?.role || null;
  }

  async function signInWithEmail(email) {
    const redirectBase = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const { data, error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectBase + 'auth-callback.html',
      },
    });
    return { data, error };
  }

  async function signOut() {
    await sb.auth.signOut();
    window.location.href = 'auth.html';
  }

  window.SB = {
    client:          sb,
    getUser,
    getProfile,
    getRole,
    signInWithEmail,
    signOut,
  };
})();
