// TODO port to TS (docs/todo/port-to-ts.md)

    // -- ROM picker: new game or continue a session -------------------------------------
    // Each recent ROM row ends in a preview square: NEW (power-on) or the screenshot of a session of
    // that ROM where it was last played (newest first; the host lists them: tas/resume.ts). Left / Right
    // on a focused row walk NEW -> newest -> older; the setting "Open ROM" picks where a row starts
    // (New, or Continue = the newest session). Launching a row on a session sends its recording id
    // (resume) with the load: the host continues it once the ROM has booted (tas/host.ts resume()).
    let openMode = 'new';                // 'new' | 'continue' (session setting, saved by the host)
    const romSessionPick = new Map();    // row key (ROM path) -> 0 = NEW, i = sessions[i - 1]

    function romSessionDefault(item) {
      return openMode === 'continue' && item.sessions && item.sessions.length ? 1 : 0;
    }

    function romSessionIndex(item) {
      const n = item.sessions ? item.sessions.length : 0;
      const key = item.path || item.name;
      const at = romSessionPick.has(key) ? romSessionPick.get(key) : romSessionDefault(item);
      return Math.max(0, Math.min(n, at));
    }

    /** The recording id to continue for this row, or '' for a clean boot. */
    function romSessionResumeId(item) {
      const at = romSessionIndex(item);
      return at > 0 ? item.sessions[at - 1].id : '';
    }

    function romSessionPlayed(frames) {
      const total = Math.round((frames || 0) / 60.0988);
      const h = Math.floor(total / 3600), m = Math.floor(total / 60) % 60, s = total % 60;
      return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
    }

    /** Fills the row's preview square and its caption for the chosen entry. */
    function romSessionRender(row, item) {
      const square = row.querySelector('.recent-rom-session');
      const caption = row.querySelector('.recent-rom-session-caption');
      if (!square) return;
      const sessions = item.sessions || [];
      const at = romSessionIndex(item);
      square.innerHTML = '';
      square.classList.toggle('is-new', at === 0);
      square.classList.toggle('has-more', sessions.length > 0);
      const s = at > 0 ? sessions[at - 1] : null;
      if (s && s.thumb) {
        const img = document.createElement('img');
        img.src = s.thumb;
        img.alt = 'Where the session stopped';
        square.appendChild(img);
      } else {
        const label = document.createElement('div');
        label.className = 'recent-rom-session-new';
        label.textContent = s ? 'SAVED' : 'NEW';
        square.appendChild(label);
      }
      if (sessions.length) {
        const prev = document.createElement('span');
        prev.className = 'recent-rom-session-arrow prev';
        prev.textContent = '<';
        prev.setAttribute('data-step', '-1');
        const next = document.createElement('span');
        next.className = 'recent-rom-session-arrow next';
        next.textContent = '>';
        next.setAttribute('data-step', '1');
        const count = document.createElement('span');
        count.className = 'recent-rom-session-count';
        count.textContent = at === 0 ? 'new' : at + '/' + sessions.length;
        square.appendChild(prev);
        square.appendChild(next);
        square.appendChild(count);
      }
      square.title = s ? 'Continue the session started ' + (s.started ? new Date(s.started).toLocaleString() : '?')
        + ' (stopped ' + (s.savedFormatted || '?') + ', ' + romSessionPlayed(s.frame) + ' played). Left / Right: other sessions'
        : 'New game: power-on' + (sessions.length ? '. Left / Right: continue a session' : '');
      if (caption) {
        caption.textContent = s ? 'continue ' + romSessionPlayed(s.frame) + ' (' + (s.savedFormatted || '?') + ')' : (sessions.length ? 'new game' : '');
        caption.classList.toggle('continue', !!s);
      }
    }

    /** Left / Right on a recent ROM row. Returns true when the choice moved. */
    function romSessionStep(row, delta) {
      const item = row && row.evsRomItem;
      if (!item || !item.sessions || !item.sessions.length) return false;
      const at = romSessionIndex(item);
      const next = Math.max(0, Math.min(item.sessions.length, at + (delta < 0 ? -1 : 1)));
      if (next === at) return false;
      romSessionPick.set(item.path || item.name, next);
      romSessionRender(row, item);
      if (typeof playMenuSound === 'function') playMenuSound('click_nav');
      return true;
    }

    /** Left / Right in the picker's ROM column: the focused row's session choice. */
    function romSessionStepFocused(delta) {
      const items = getOverlayCol0Focusables();
      const el = items[overlayCol0Idx];
      if (el && el.classList.contains('recent-rom-item')) romSessionStep(el, delta);
    }

    /** The preview square and caption of a recent ROM row (rendered by romSessionRender). */
    function romSessionAttach(row, item, detailsEl) {
      row.evsRomItem = item;
      const square = document.createElement('div');
      square.className = 'recent-rom-session';
      square.addEventListener('click', (e) => {
        const arrow = e.target.closest('[data-step]');
        if (!arrow) return;
        e.stopPropagation();
        romSessionStep(row, parseInt(arrow.getAttribute('data-step'), 10));
      });
      row.appendChild(square);
      if (item.sessions && item.sessions.length) {
        const caption = document.createElement('span');
        caption.className = 'recent-rom-session-caption';
        detailsEl.appendChild(caption);
      }
      romSessionRender(row, item);
    }

    function updateOpenModeUi() {
      const pill = document.getElementById('launcher-val-open');
      if (pill) {
        pill.textContent = openMode === 'continue' ? 'Continue' : 'New game';
        pill.classList.toggle('active', openMode === 'continue');
      }
    }

    /** The base ROM button says when it will continue its newest session. */
    function updateVanillaOpenNote() {
      const vDesc = document.getElementById('vanilla-desc');
      const v = currentOfferData && currentOfferData.vanilla;
      if (!vDesc || !v || !v.available) return;
      const vs = v.sessions || [];
      vDesc.textContent = (vDesc.getAttribute('data-base') || vDesc.textContent)
        + (openMode === 'continue' && vs.length ? ' - continue (' + (vs[0].savedFormatted || '?') + ')' : '');
    }

    /** The "Open ROM" setting: re-aims every row that was not stepped by hand. */
    function toggleOpenMode() {
      openMode = openMode === 'continue' ? 'new' : 'continue';
      romSessionPick.clear();
      document.querySelectorAll('.recent-rom-item').forEach(row => { if (row.evsRomItem) romSessionRender(row, row.evsRomItem); });
      updateOpenModeUi();
      updateVanillaOpenNote();
      if (vscodeApi) vscodeApi.postMessage({ command: 'setSessionSettings', openMode: openMode });
      if (typeof playMenuSound === 'function') playMenuSound('click_toggle');
    }
