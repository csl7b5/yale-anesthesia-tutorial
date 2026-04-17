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
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZGx4ZXZ6Ynlxa3p0YXV3dG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTU1MTIsImV4cCI6MjA5MTc3MTUxMn0.uUaPku_1h3Uz95YidWEXrRwWbJ3NBVrNpWtN_XsjIjg';

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

  /**
   * @param {{ fullName?: string, school?: string, trainingLevel?: string }} [meta] — optional; stored in auth user metadata and copied to profiles by handle_new_user.
   */
  async function signUpWithPassword(email, password, meta) {
    const dataPayload = {};
    if (meta?.fullName && String(meta.fullName).trim()) {
      dataPayload.full_name = String(meta.fullName).trim();
    }
    if (meta?.school && String(meta.school).trim()) {
      dataPayload.school = String(meta.school).trim();
    }
    if (meta?.trainingLevel && String(meta.trainingLevel).trim()) {
      dataPayload.training_level = String(meta.trainingLevel).trim();
    }
    const opts = Object.keys(dataPayload).length
      ? { email, password, options: { data: dataPayload } }
      : { email, password };
    const { data, error } = await sb.auth.signUp(opts);
    return { data, error };
  }

  async function updateProfile(updates) {
    const user = await getUser();
    if (!user) return { data: null, error: { message: 'Not signed in' } };
    const { data, error } = await sb
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    return { data, error };
  }

  async function signInWithPassword(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
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
    signUpWithPassword,
    signInWithPassword,
    updateProfile,
    signOut,
  };
})();
