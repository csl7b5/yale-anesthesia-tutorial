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
    let { data, error } = await sb
      .from('profiles')
      .select('*, institutions(id, short_name, canonical_name)')
      .eq('id', user.id)
      .single();
    if (error) {
      const fallback = await sb.from('profiles').select('*').eq('id', user.id).single();
      data = fallback.data;
    }
    return data || null;
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
   * @param {{ fullName?: string, school?: string, institutionId?: string, institutionOther?: string, trainingLevel?: string }} [meta]
   */
  async function signUpWithPassword(email, password, meta) {
    const dataPayload = {};
    if (meta?.fullName && String(meta.fullName).trim()) {
      dataPayload.full_name = String(meta.fullName).trim();
    }
    if (meta?.school && String(meta.school).trim()) {
      dataPayload.school = String(meta.school).trim();
    }
    if (meta?.institutionId && String(meta.institutionId).trim()) {
      dataPayload.institution_id = String(meta.institutionId).trim();
    }
    if (meta?.institutionOther && String(meta.institutionOther).trim()) {
      dataPayload.institution_other = String(meta.institutionOther).trim();
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

  async function listSchools() {
    const { data, error } = await sb
      .from('institutions')
      .select('id, canonical_name, short_name')
      .order('canonical_name');
    if (error) {
      console.warn('[SB] institutions:', error.message);
      return [];
    }
    return (data || []).map((s) => ({
      id: s.id,
      name: s.canonical_name,
      short_name: s.short_name || s.canonical_name,
      slug: String(s.short_name || s.canonical_name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
    }));
  }

  function fillSchoolSelect(selectEl, schools, selectedId, opts) {
    if (!selectEl) return;
    const blankLabel = opts?.blankLabel || 'Select your school…';
    const includeBlank = opts?.includeBlank !== false;
    const current = selectedId || selectEl.value || '';
    selectEl.innerHTML = includeBlank ? `<option value="">${blankLabel}</option>` : '';
    (schools || []).forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.short_name === s.name ? s.name : `${s.short_name} — ${s.name}`;
      opt.dataset.slug = s.slug || '';
      opt.dataset.name = s.name || '';
      opt.dataset.shortName = s.short_name || '';
      selectEl.appendChild(opt);
    });
    if (current && [...selectEl.options].some((o) => o.value === current)) {
      selectEl.value = current;
    }
  }

  function schoolLabel(school) {
    if (!school) return '';
    return school.short_name || school.name || '';
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
    listSchools,
    fillSchoolSelect,
    schoolLabel,
    signOut,
  };
})();
