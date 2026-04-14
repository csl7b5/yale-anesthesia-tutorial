/**
 * auth-guard.js — Protects dashboard pages
 *
 * Include on student.html and instructor.html.
 * Redirects to auth.html if not logged in.
 * Redirects to correct dashboard if role doesn't match page.
 */
(function () {
  'use strict';

  const PAGE_ROLE = document.body.dataset.requiredRole;

  async function guard() {
    const user = await window.SB.getUser();
    if (!user) {
      window.location.replace('auth.html');
      return;
    }

    const role = await window.SB.getRole();

    if (PAGE_ROLE === 'instructor' && role !== 'instructor' && role !== 'admin') {
      window.location.replace('student.html');
      return;
    }

    if (PAGE_ROLE === 'student' && (role === 'instructor' || role === 'admin')) {
      window.location.replace('instructor.html');
      return;
    }

    document.body.classList.add('auth-ready');
  }

  if (window.SB) {
    guard();
  } else {
    window.addEventListener('load', guard);
  }
})();
