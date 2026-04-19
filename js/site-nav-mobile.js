/**
 * Mobile hamburger for .site-nav — closes on Escape, tab click, and resize to desktop.
 */
(function () {
  'use strict';

  var mq = window.matchMedia('(max-width: 960px)');

  function initNav(nav) {
    var btn = nav.querySelector('.site-nav__menu-btn');
    var tabs = nav.querySelector('.site-nav__tabs');
    if (!btn || !tabs) return;

    function setOpen(open) {
      var is = Boolean(open);
      nav.classList.toggle('site-nav--menu-open', is);
      btn.setAttribute('aria-expanded', is ? 'true' : 'false');
      btn.setAttribute('aria-label', is ? 'Close menu' : 'Open menu');
    }

    btn.addEventListener('click', function () {
      setOpen(!nav.classList.contains('site-nav--menu-open'));
    });

    tabs.addEventListener('click', function () {
      if (mq.matches) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    function onMq() {
      if (!mq.matches) setOpen(false);
    }
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else mq.addListener(onMq);
  }

  document.querySelectorAll('.site-nav').forEach(initNav);
})();
