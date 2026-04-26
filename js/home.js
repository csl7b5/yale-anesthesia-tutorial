/* ===========================================================
 * Anesthesia Playground — Home page
 * - 3D feature carousel (auto-rotate, dots, swipe, hover-pause)
 * - Scroll reveal for sections
 * - Animated mini-vent number ticker
 * - Respects prefers-reduced-motion
 * =========================================================== */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Carousel ──────────────────────────────────────────────
  var stage = document.querySelector(".home-carousel__stage");
  var dotsWrap = document.querySelector(".home-carousel__dots");
  if (stage && dotsWrap) {
    var cards = Array.prototype.slice.call(stage.querySelectorAll(".home-card"));
    var dots = Array.prototype.slice.call(dotsWrap.querySelectorAll(".home-carousel__dot"));
    var idx = 0;
    var timer = null;
    var ROTATE_MS = 5000;

    function setActive(next) {
      var n = cards.length;
      idx = ((next % n) + n) % n;
      var leftIdx  = (idx - 1 + n) % n;
      var rightIdx = (idx + 1) % n;
      cards.forEach(function (card, i) {
        card.classList.remove("is-active", "is-side-left", "is-side-right");
        if (i === idx) {
          card.classList.add("is-active");
          card.setAttribute("aria-hidden", "false");
        } else if (i === leftIdx) {
          card.classList.add("is-side-left");
          card.setAttribute("aria-hidden", "true");
        } else if (i === rightIdx) {
          card.classList.add("is-side-right");
          card.setAttribute("aria-hidden", "true");
        } else {
          // Cards beyond left/right neighbors stay offstage (default state).
          card.setAttribute("aria-hidden", "true");
        }
      });
      dots.forEach(function (d, i) {
        d.classList.toggle("is-active", i === idx);
        d.setAttribute("aria-selected", i === idx ? "true" : "false");
      });
    }

    function next()     { setActive(idx + 1); }

    function start() {
      if (prefersReduced) return;
      stop();
      timer = window.setInterval(next, ROTATE_MS);
    }
    function stop() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    setActive(0);
    start();

    dots.forEach(function (d, i) {
      d.addEventListener("click", function () {
        setActive(i);
        start(); // restart timer after manual nav
      });
    });

    // Click a side card to advance toward it
    cards.forEach(function (card, i) {
      card.addEventListener("click", function () {
        if (card.classList.contains("is-side-left"))  { setActive(idx - 1); start(); }
        else if (card.classList.contains("is-side-right")) { setActive(idx + 1); start(); }
      });
    });

    // Pause on hover / keyboard focus
    stage.addEventListener("mouseenter", stop);
    stage.addEventListener("mouseleave", start);
    stage.addEventListener("focusin", stop);
    stage.addEventListener("focusout", start);

    // Touch swipe
    var touchX = null;
    stage.addEventListener("touchstart", function (e) {
      touchX = e.touches && e.touches[0] ? e.touches[0].clientX : null;
      stop();
    }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      if (touchX == null) return;
      var endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : touchX;
      var dx = endX - touchX;
      if (Math.abs(dx) > 40) setActive(idx + (dx < 0 ? 1 : -1));
      touchX = null;
      start();
    });

    // Pause when tab not visible
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
  }

  // ── Scroll reveal ─────────────────────────────────────────
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    if (prefersReduced || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: "-8% 0px -10% 0px", threshold: 0.05 });
      revealEls.forEach(function (el) { io.observe(el); });
    }
  }

  // ── Mini-ventilator number ticker (subtle realism) ────────
  if (!prefersReduced) {
    var pip = document.querySelector('[data-vent="pip"]');
    var rr  = document.querySelector('[data-vent="rr"]');
    var vt  = document.querySelector('[data-vent="vt"]');
    var co2 = document.querySelector('[data-vent="co2"]');
    var hr  = document.querySelector('[data-vital="hr"]');
    var bp  = document.querySelector('[data-vital="bp"]');
    var spo2 = document.querySelector('[data-vital="spo2"]');
    var pip0 = 24, rr0 = 12, vt0 = 480, co20 = 38, hr0 = 78, bps = 118, bpd = 72, spo20 = 99;

    function jitter(base, range) { return base + Math.round((Math.random() - 0.5) * range); }

    function tick() {
      if (pip)  pip.textContent  = String(jitter(pip0, 2));
      if (rr)   rr.textContent   = String(jitter(rr0, 1));
      if (vt)   vt.textContent   = String(jitter(vt0, 16));
      if (co2)  co2.textContent  = String(jitter(co20, 2));
      if (hr)   hr.textContent   = String(jitter(hr0, 4));
      if (spo2) spo2.textContent = String(Math.min(100, jitter(spo20, 1)));
      if (bp)   bp.textContent   = jitter(bps, 4) + "/" + jitter(bpd, 3);
    }
    tick();
    window.setInterval(tick, 1600);
  }

  // ── Start-exploring dropdown menu ─────────────────────────
  (function initCtaMenu() {
    var wrap   = document.getElementById("home-cta-menu");
    var btn    = document.getElementById("home-cta-explore");
    var panel  = document.getElementById("home-cta-explore-list");
    if (!wrap || !btn || !panel) return;

    function open() {
      panel.removeAttribute("hidden");
      btn.setAttribute("aria-expanded", "true");
      // Defer the data-open flip so the panel transitions from
      // its default (closed) styles instead of jumping in.
      window.requestAnimationFrame(function () {
        wrap.setAttribute("data-open", "true");
      });
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onKeydown, true);
    }
    function close() {
      wrap.removeAttribute("data-open");
      btn.setAttribute("aria-expanded", "false");
      // Allow the close transition to play before re-adding [hidden].
      window.setTimeout(function () {
        if (wrap.getAttribute("data-open") !== "true") {
          panel.setAttribute("hidden", "");
        }
      }, 220);
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKeydown, true);
    }
    function isOpen() { return wrap.getAttribute("data-open") === "true"; }

    function onDocClick(e) {
      if (!wrap.contains(e.target)) close();
    }
    function onKeydown(e) {
      if (e.key === "Escape") { close(); btn.focus(); }
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      isOpen() ? close() : open();
    });
    // Close when an item is selected so the page navigation feels snappy
    panel.querySelectorAll("a.home-cta-menu__item").forEach(function (a) {
      a.addEventListener("click", function () { close(); });
    });
  })();

  // ── Auth-aware Sign In tab + hero CTA (flip to "Dashboard"/"Go to dashboard"
  //    when already logged in) ──
  function syncAuthTab() {
    try {
      var navTab = document.getElementById("home-signin-tab");
      var heroCta = document.getElementById("home-cta-signup");
      if (!window.SB || typeof window.SB.getUser !== "function") return;
      window.SB.getUser().then(function (user) {
        if (!user) return;
        if (navTab) {
          navTab.textContent = "My Dashboard";
          navTab.setAttribute("href", "platform/instructor.html");
        }
        if (heroCta) {
          heroCta.textContent = "My Dashboard";
          heroCta.setAttribute("href", "platform/instructor.html");
        }
      }).catch(function () { /* no-op */ });
    } catch (_) { /* no-op */ }
  }
  function trySyncAuth(attempt) {
    if (window.SB && typeof window.SB.getUser === "function") {
      syncAuthTab();
    } else if (attempt < 20) {
      window.setTimeout(function () { trySyncAuth(attempt + 1); }, 150);
    }
  }
  if (document.readyState === "complete" || document.readyState === "interactive") {
    trySyncAuth(0);
  } else {
    document.addEventListener("DOMContentLoaded", function () { trySyncAuth(0); });
  }
})();
