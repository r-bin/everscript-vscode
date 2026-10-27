// TODO port to TS (docs/todo/port-to-ts.md)

    // -- What the user did, in the Emulator log ------------------------------------------------
    // "What broke what": every menu step and press, menu open / close / tab, every button clicked outside
    // the menu (panels, screen chips, the ROM picker), and what writes into the game (an injected script, a
    // cheat, a reset, a rewind, the speed) goes to the Emulator output channel as
    //   UI f=<frame> <what>
    // with the replay frame it happened before, so a line lines up with a recording's frames (and with the
    // W lines an injection leaves there). Lines are batched once a second (no per-frame round trip).
    // The game's own joypad input is not logged: the recording holds it.
    const UI_LOG_FLUSH_MS = 1000;
    let uiLogLines = [];

    function uiLog(what) {
      const frame = typeof tasSessionFrame === 'number' ? tasSessionFrame : -1;
      uiLogLines.push('f=' + frame + ' ' + what);
    }

    function uiLogFlush() {
      if (!uiLogLines.length || !vscodeApi) return;
      vscodeApi.postMessage({ command: 'uiLog', lines: uiLogLines });
      uiLogLines = [];
    }
    setInterval(uiLogFlush, UI_LOG_FLUSH_MS);
    window.addEventListener('pagehide', uiLogFlush);

    const uiText = el => (el ? el.textContent.replace(/\s+/g, ' ').replace(/^>\s*/, '').trim() : '');

    // The menu row the cursor is on: "TAB > label" and its value ("ON", "4x", ...).
    function uiMenuRow() {
      const tab = uiText(document.getElementById('menu-tab-btn-' + menuActiveTab)) || ('tab ' + menuActiveTab);
      const panel = document.getElementById('menu-panel-' + menuActiveTab);
      const rows = panel && typeof menuSelectableRows === 'function' ? menuSelectableRows(panel) : [];
      const row = rows[menuSelectedRow];
      const label = row ? (uiText(row.querySelector('.menu-row-label')) || uiText(row)).slice(0, 80) : 'row ' + menuSelectedRow;
      return { where: tab + ' > ' + label, value: () => (row ? uiText(row.querySelector('.menu-pill')) : '') };
    }

    // Wraps a page function (a global function declaration) so a call is logged first or after.
    function uiWrap(name, describe) {
      const fn = window[name];
      if (typeof fn !== 'function') return;
      window[name] = function () {
        const before = describe.before ? describe.before.apply(null, arguments) : null;
        const result = fn.apply(this, arguments);
        const line = describe.after ? describe.after(before, arguments, result) : before;
        if (line) uiLog(line);
        return result;
      };
    }

    uiWrap('openEmulatorMenu', { before: () => (isMenuOpen ? null : 'menu open') });
    uiWrap('closeEmulatorMenu', { before: () => (isMenuOpen ? 'menu close' : null) });
    uiWrap('selectMenuTab', {
      before: () => menuActiveTab,
      after: was => (was === menuActiveTab ? null : 'menu tab ' + uiText(document.getElementById('menu-tab-btn-' + menuActiveTab))),
    });
    uiWrap('changeMenuValue', {
      before: () => uiMenuRow(),
      after: (row, a) => 'menu ' + row.where + (a[0] > 0 ? ' (+1)' : ' (-1)') + (row.value() ? ' = ' + row.value() : ''),
    });
    uiWrap('activateMenuRow', {
      before: () => uiMenuRow(),
      after: row => 'menu ' + row.where + ' (B)' + (row.value() ? ' = ' + row.value() : ''),
    });
    uiWrap('injectEverscript', { after: (_b, a, ok) => 'inject ' + String(a[0]).slice(0, 120) + (ok ? '' : ' (refused)') });
    uiWrap('setCheat', { before: (id, on) => 'cheat ' + id + ' ' + (on ? 'on' : 'off') });
    uiWrap('giveMoney', { before: () => 'cheat money' });
    uiWrap('healParty', { before: () => 'cheat heal' });
    uiWrap('setSpeedMultiplier', { before: v => 'speed ' + v + 'x' });
    uiWrap('tasRewind', { before: () => 'rewind' });
    uiWrap('tasSoftReset', { before: () => 'soft reset' });
    uiWrap('bootRom', { before: (_d, name) => 'boot ' + (name || '') });

    // Clicks outside the menu (the menu's own clicks end in the functions above).
    document.addEventListener('click', evt => {
      const el = evt.target && evt.target.closest ? evt.target.closest('button, [data-action], .screen-chip, a') : null;
      if (!el || el.closest('#emulator-menu')) return;
      const label = (el.getAttribute('aria-label') || el.title || uiText(el) || el.id || el.tagName).slice(0, 80);
      uiLog('click ' + (el.id ? '#' + el.id + ' ' : '') + label);
    }, true);
