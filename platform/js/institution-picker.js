/**
 * Searchable medical-school picker (canonical list + Other).
 * Requires window.SB (Supabase client). Institutions table is publicly readable.
 */
(function () {
  'use strict';

  const OTHER = '__other__';
  const PINNED_SHORT = ['Yale', 'UCSF', 'Harvard', 'Stanford', 'Johns Hopkins'];

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function kindLabel(kind) {
    if (kind === 'do') return 'DO';
    if (kind === 'canada_md') return 'Canada';
    if (kind === 'caribbean') return 'Caribbean';
    if (kind === 'allied') return 'Program';
    return 'MD';
  }

  async function loadInstitutions() {
    if (Array.isArray(window.__institutionsCache)) return window.__institutionsCache;
    const sb = window.SB && window.SB.client;
    if (!sb) {
      window.__institutionsCache = [];
      return window.__institutionsCache;
    }
    const { data, error } = await sb
      .from('institutions')
      .select('id, canonical_name, short_name, kind, country, aliases')
      .order('canonical_name');
    if (error) {
      console.warn('institution-picker: failed to load institutions', error.message);
      window.__institutionsCache = [];
    } else {
      window.__institutionsCache = data || [];
    }
    return window.__institutionsCache;
  }

  function haystack(inst) {
    return [inst.canonical_name, inst.short_name, ...(inst.aliases || [])]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();
  }

  function filterInstitutions(list, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) {
      const pinned = [];
      for (const short of PINNED_SHORT) {
        const hit = list.find(
          (i) => (i.short_name || '').toLowerCase() === short.toLowerCase()
        );
        if (hit) pinned.push(hit);
      }
      return pinned;
    }
    const words = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const inst of list) {
      const h = haystack(inst);
      if (!words.every((w) => h.includes(w))) continue;
      let score = 0;
      const name = (inst.canonical_name || '').toLowerCase();
      const short = (inst.short_name || '').toLowerCase();
      if (short === q || name === q) score += 100;
      if (short.startsWith(q) || name.startsWith(q)) score += 40;
      if (short.includes(q)) score += 20;
      scored.push({ inst, score });
    }
    scored.sort((a, b) => b.score - a.score || a.inst.canonical_name.localeCompare(b.inst.canonical_name));
    return scored.slice(0, 12).map((s) => s.inst);
  }

  function displayLabel(inst) {
    if (!inst) return '';
    if (inst.short_name && inst.canonical_name.indexOf(inst.short_name) === -1) {
      return inst.short_name + ' — ' + inst.canonical_name;
    }
    return inst.canonical_name;
  }

  /**
   * @param {HTMLElement} container
   * @param {{
   *   required?: boolean,
   *   disabled?: boolean,
   *   disabledReason?: string,
   *   placeholder?: string,
   *   inputId?: string,
   * }} [opts]
   */
  function mount(container, opts) {
    opts = opts || {};
    if (!container) return null;

    container.classList.add('inst-picker');
    container.innerHTML = `
      <input type="hidden" class="inst-picker__id" value="" />
      <div class="inst-picker__combo">
        <input
          class="inst-picker__search"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="false"
          autocomplete="off"
          spellcheck="false"
          maxlength="160"
          placeholder="${esc(opts.placeholder || 'Search medical schools…')}"
          ${opts.inputId ? 'id="' + esc(opts.inputId) + '"' : ''}
          ${opts.disabled ? 'disabled' : ''}
        />
        <ul class="inst-picker__list" role="listbox" hidden></ul>
      </div>
      <p class="inst-picker__hint">Type to choose from the canonical school list, or pick Other to type a name.</p>
      <div class="inst-picker__other-wrap" hidden>
        <label class="inst-picker__other-label">School / program name</label>
        <input class="inst-picker__other" type="text" maxlength="160" placeholder="Type the school or program" ${opts.disabled ? 'disabled' : ''} />
      </div>
      <p class="inst-picker__disabled-note" hidden></p>
    `;

    const search = container.querySelector('.inst-picker__search');
    const hiddenId = container.querySelector('.inst-picker__id');
    const listEl = container.querySelector('.inst-picker__list');
    const otherWrap = container.querySelector('.inst-picker__other-wrap');
    const otherInput = container.querySelector('.inst-picker__other');
    const hint = container.querySelector('.inst-picker__hint');
    const disabledNote = container.querySelector('.inst-picker__disabled-note');
    let items = [];
    let open = false;
    let active = -1;
    let otherMode = false;
    let chosen = null;

    if (opts.disabled) {
      hint.hidden = true;
      disabledNote.hidden = false;
      disabledNote.textContent =
        opts.disabledReason ||
        'Your teaching affiliation was set when this account was approved.';
    }

    function setExpanded(v) {
      open = v;
      listEl.hidden = !v;
      search.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (!v) active = -1;
    }

    function applyOtherMode(on, keepQuery) {
      otherMode = on;
      otherWrap.hidden = !on;
      if (on) {
        hiddenId.value = '';
        chosen = null;
        if (!keepQuery) search.value = 'Other (not listed)';
        otherInput.focus();
      }
    }

    function selectInst(inst) {
      chosen = inst;
      otherMode = false;
      otherWrap.hidden = true;
      otherInput.value = '';
      hiddenId.value = inst.id;
      search.value = displayLabel(inst);
      setExpanded(false);
    }

    function render(filtered) {
      const rows = [];
      filtered.forEach((inst, idx) => {
        const sub = kindLabel(inst.kind) + (inst.short_name ? ' · ' + inst.short_name : '');
        rows.push(
          `<li class="inst-picker__option" role="option" data-idx="${idx}" data-id="${esc(inst.id)}">` +
            `<span class="inst-picker__option-name">${esc(inst.canonical_name)}</span>` +
            `<span class="inst-picker__option-meta">${esc(sub)}</span>` +
          `</li>`
        );
      });
      rows.push(
        `<li class="inst-picker__option inst-picker__option--other" role="option" data-idx="${filtered.length}" data-id="${OTHER}">` +
          `<span class="inst-picker__option-name">Other (not listed)</span>` +
          `<span class="inst-picker__option-meta">Type a school or program name</span>` +
        `</li>`
      );
      listEl.innerHTML = rows.length
        ? rows.join('')
        : `<li class="inst-picker__option inst-picker__option--muted">No matches</li>` +
          rows[rows.length - 1];
      listEl.querySelectorAll('.inst-picker__option[data-id]').forEach((el) => {
        el.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          const id = el.getAttribute('data-id');
          if (id === OTHER) {
            applyOtherMode(true);
            setExpanded(false);
            return;
          }
          const inst = filtered.find((i) => i.id === id);
          if (inst) selectInst(inst);
        });
      });
    }

    async function refreshList() {
      const all = await loadInstitutions();
      const q = otherMode && search.value === 'Other (not listed)' ? '' : search.value;
      const filtered = filterInstitutions(all, q);
      render(filtered);
      return filtered;
    }

    search.addEventListener('focus', async () => {
      if (opts.disabled) return;
      await refreshList();
      setExpanded(true);
    });

    search.addEventListener('input', async () => {
      if (opts.disabled) return;
      if (otherMode && search.value !== 'Other (not listed)') {
        otherMode = false;
        otherWrap.hidden = true;
      }
      hiddenId.value = '';
      chosen = null;
      await refreshList();
      setExpanded(true);
    });

    search.addEventListener('keydown', async (e) => {
      if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
        await refreshList();
        setExpanded(true);
      }
      const optsEls = [...listEl.querySelectorAll('.inst-picker__option[data-id]')];
      if (e.key === 'Escape') {
        setExpanded(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        active = Math.min(active + 1, optsEls.length - 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active = Math.max(active - 1, 0);
      } else if (e.key === 'Enter') {
        if (open && optsEls[active]) {
          e.preventDefault();
          optsEls[active].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        }
        return;
      } else {
        return;
      }
      optsEls.forEach((el, i) => el.classList.toggle('is-active', i === active));
      if (optsEls[active]) optsEls[active].scrollIntoView({ block: 'nearest' });
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) setExpanded(false);
    });

    function getValue() {
      if (otherMode) {
        const other = otherInput.value.trim();
        return {
          institution_id: null,
          institution_other: other || null,
          display: other,
          isOther: true,
        };
      }
      if (chosen && hiddenId.value) {
        return {
          institution_id: hiddenId.value,
          institution_other: null,
          display: chosen.canonical_name,
          isOther: false,
        };
      }
      const typed = search.value.trim();
      if (!typed || typed === 'Other (not listed)') {
        return { institution_id: null, institution_other: null, display: '', isOther: false };
      }
      return {
        institution_id: null,
        institution_other: typed,
        display: typed,
        isOther: true,
      };
    }

    async function setValue(state) {
      const all = await loadInstitutions();
      const id = state && state.institution_id;
      const other = (state && (state.institution_other || '')) || '';
      if (id) {
        const inst = all.find((i) => i.id === id);
        if (inst) {
          selectInst(inst);
          return;
        }
      }
      if (other) {
        applyOtherMode(true, true);
        search.value = 'Other (not listed)';
        otherInput.value = other;
        return;
      }
      const label = (state && state.display) || '';
      if (label) {
        const exact = all.find(
          (i) =>
            i.canonical_name === label ||
            (i.short_name && i.short_name.toLowerCase() === label.toLowerCase())
        );
        if (exact) {
          selectInst(exact);
          return;
        }
        applyOtherMode(true, true);
        search.value = 'Other (not listed)';
        otherInput.value = label;
        return;
      }
      chosen = null;
      otherMode = false;
      hiddenId.value = '';
      search.value = '';
      otherInput.value = '';
      otherWrap.hidden = true;
    }

    function reset() {
      setValue({});
    }

    loadInstitutions().then((all) => {
      if (!all.length && hint) {
        hint.textContent =
          'School list is unavailable until the institutions table is loaded. You can still type a name via Other.';
      }
    });

    return { getValue, setValue, reset, loadInstitutions };
  }

  window.InstitutionPicker = { mount, loadInstitutions };
})();
