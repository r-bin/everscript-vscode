// TODO port to TS (docs/todo/port-to-ts.md)
    // Sampled each frame while the game's ROM runs (samplePreLoopState); read by the overlays and the game's panels.
    let lastSampledPreState = null;
    // -- Boot: register error handlers BEFORE acquiring vscode API so any
    //    init failure is captured.  'var' lets onerror reference the variable
    //    before the assignment below runs.
    var vscodeApi; // eslint-disable-line no-var

    function collectCrashContext(extra) {
      var ctx = Object.assign({}, extra || {});
      ctx.rom = (typeof currentRomName === 'string') ? currentRomName : '';
      ctx.frame = (typeof romFrameCount === 'number') ? romFrameCount : 0;
      ctx.mapId = (typeof cachedMapId === 'number') ? cachedMapId : -1;
      if (typeof lastSampledPreState !== 'undefined' && lastSampledPreState) {
        ctx.camX = lastSampledPreState.camX;
        ctx.camY = lastSampledPreState.camY;
        if (ctx.mapId < 0 && typeof lastSampledPreState.mapId === 'number') {
          ctx.mapId = lastSampledPreState.mapId;
        }
      }
      try {
        var m = (typeof getModule === 'function') ? getModule() : (window.Module || null);
        if (m && typeof m.getCPUState === 'function') {
          ctx.cpu = m.getCPUState();
        }
      } catch (_) {}
      try {
        if (typeof scriptSlotTrackers !== 'undefined' && Array.isArray(scriptSlotTrackers)) {
          ctx.scriptSlots = scriptSlotTrackers
            .map(function(t, idx) { return { slot: idx, state: t.state, loc: t.loc, entity: t.entity }; })
            .filter(function(t) { return t.state > 0 || t.loc > 0; });
        }
      } catch (_) {}
      return ctx;
    }

    function reportEmulatorCrash(type, message, details) {
      var data = collectCrashContext(Object.assign({ type: type, message: String(message || 'Unknown error') }, details || {}));
      console.error('[EVS CRASH]', data);
      if (vscodeApi) {
        vscodeApi.postMessage(Object.assign({ command: 'emulatorCrash' }, data));
      }
    }

    window.onerror = function(msg, src, line, col, error) {
      console.error('[EVS webview error]', msg, src || '', line || '', col || '', error);
      reportEmulatorCrash('window_onerror', msg, {
        source: src,
        line: line,
        col: col,
        stack: error && error.stack ? error.stack : (new Error().stack)
      });
    };
    window.addEventListener('unhandledrejection', function(evt) {
      var r = evt.reason instanceof Error ? evt.reason.message : String(evt.reason || 'unhandledrejection');
      var st = evt.reason instanceof Error && evt.reason.stack ? evt.reason.stack : null;
      console.error('[EVS webview rejection]', r);
      reportEmulatorCrash('unhandledrejection', r, { stack: st });
    });
    document.addEventListener('securitypolicyviolation', function(evt) {
      console.error('[EVS CSP violation]', evt.blockedURI, evt.violatedDirective);
      reportEmulatorCrash('securitypolicyviolation', 'CSP: ' + evt.blockedURI + ' blocked by ' + evt.violatedDirective, {});
    });

    console.log('[EVS webview] boot start');
    try {
      vscodeApi = acquireVsCodeApi();
    } catch(e) {
      console.error('[EVS webview] acquireVsCodeApi failed:', String(e));
    }

    if (vscodeApi) {
      vscodeApi.postMessage({ command: 'webviewBoot' });
    } else {
      console.error('[EVS webview] vscodeApi unavailable - host unreachable');
    }
    console.log('[EVS webview] boot done, api:', vscodeApi ? 'ok' : 'MISSING');

    // ROM state. Declared before any boot code runs: renderRomOffer() and
    // reportEmulatorCrash() read it synchronously, and reading a let before its
    // declaration throws and kills the whole script (dead launcher buttons).
    let romLoaded = false;
    let loadedRomData = null;
    let loadedRomName = 'game';
    let romLaunchTimestamp = 0;
    let romFrameCount = 0;
    // Set per ROM by emulator-profile.js (emuGateRom): the game's work runs only for its ROM;
    // the script stack hook and trace (TRACE / STACK, the .evs debugger) only in the full profile too.
    let emuGameRom = true;
    let emuScriptHook = true;
    let emuMuted = false;

    function romStage(text) {
      console.log('[EVS romStage]', text);
      if (vscodeApi) vscodeApi.postMessage({ command: 'romLoadLog', text });
    }

    // -- Module stub (set before core script tag, so onRuntimeInitialized fires) -
    var Module = {
      locateFile: function(filename) {
        // Route the WASM request to the webview-accessible URI.
        if (typeof filename === 'string' && filename.endsWith('.wasm')) return '//@@coreWasmUri';
        return filename;
      },
      onRuntimeInitialized: function() {
        // Core is ready. Signal host so any pending ROM can be delivered.
        romStage('core runtime initialized');
        if (vscodeApi) vscodeApi.postMessage({ command: 'ready' });
        // CDL a dead host never wrote goes to the library now, ROM or not (06-cdl-rescue.js).
        if (typeof cdlRescueSend === 'function') cdlRescueSend();
        startRenderLoop();
      },
      onAbort: function(reason) {
        const msg = reason ? String(reason) : 'unknown abort';
        reportEmulatorCrash('core_abort', 'Core aborted: ' + msg, { stack: (new Error()).stack });
      },
      printErr: function(text) {
        console.error('[EVS core stderr]', text);
        if (typeof text === 'string' && /abort|assert|exception|fatal/i.test(text)) {
          reportEmulatorCrash('core_assert', text, {});
        } else if (vscodeApi && typeof text === 'string' && text.trim()) {
          vscodeApi.postMessage({ command: 'emulatorStderr', text: text });
        }
      }
    };

    function loadCoreScript() {
      const script = document.createElement('script');
      script.src = '//@@coreJsUri';
      script.onload = function() {
        romStage('core script loaded');
      };
      script.onerror = function() {
        if (vscodeApi) vscodeApi.postMessage({ command: 'ejsError', error: 'Failed to load core script: //@@coreJsUri' });
      };
      document.body.appendChild(script);
    }
    loadCoreScript();

    // -- ROM offer, quick launch & drag-and-drop ------------------------------
    let currentOfferData = //@@romOffer;

    let overlayFocusCol = 0; // 0 = Center, 1 = Right
    let overlayCol0Idx = 1;  // Start at Vanilla ROM
    let overlayCol1Idx = 0;
    let selectedCore = 'fork';
    let selectedPreset = 'default';
    let sramMode = 'default';
    let alwaysRecordEnabled = true;
    let currentRomSha1 = '';
    let currentSramMode = 'default';
    let currentIsolatedSram = false;
    let lastStartingSramB64 = '';
    let lastSavedSramB64 = '';
    let clearRecentConfirming = false;

    window.startKeySuppressedUntilRelease = false;
    window.ignoreStartUntil = 0;

    function getInitialCol0Index(items) {
      const vBtn = document.getElementById('vanillaBtn');
      if (vBtn && !vBtn.disabled) {
        const vIdx = items.indexOf(vBtn);
        if (vIdx >= 0) return vIdx;
      }
      return 0;
    }

    try {
      const savedCol = sessionStorage.getItem('evs_overlayCol');
      if (savedCol !== null) overlayFocusCol = parseInt(savedCol, 10);
      const savedCol0 = sessionStorage.getItem('evs_overlayCol0');
      if (savedCol0 !== null) overlayCol0Idx = parseInt(savedCol0, 10);
      const savedCol1 = sessionStorage.getItem('evs_overlayCol1');
      if (savedCol1 !== null) overlayCol1Idx = parseInt(savedCol1, 10);
      const savedCore = sessionStorage.getItem('evs_selectedCore');
      if (savedCore) selectedCore = savedCore;
      const savedPreset = sessionStorage.getItem('evs_selectedPreset');
      if (savedPreset) selectedPreset = savedPreset;
      const savedSramMode = sessionStorage.getItem('evs_sramMode');
      if (savedSramMode === 'default' || savedSramMode === 'individual') {
        sramMode = savedSramMode;
      } else {
        const savedSram = sessionStorage.getItem('evs_isolatedSram');
        if (savedSram !== null) sramMode = savedSram === 'true' ? 'individual' : 'default';
      }
      const savedRec = sessionStorage.getItem('evs_alwaysRecord');
      if (savedRec !== null) alwaysRecordEnabled = savedRec === 'true';
    } catch (_) {}

    function getLaunchOptions() {
      const isCdl = selectedPreset === 'cdl';
      const effectiveSram = isCdl ? 'individual' : sramMode;
      return {
        core: selectedCore,
        preset: selectedPreset,
        sramMode: effectiveSram,
        isolatedSram: effectiveSram === 'individual',
        alwaysRecord: isCdl ? true : alwaysRecordEnabled
      };
    }

    const PRESETS = ['default', 'everscript', 'cdl', 'clean'];
    const PRESET_LABELS = { default: 'Default', everscript: 'Everscript', cdl: 'CDL', clean: 'Clean' };

    function updateSidebarUi() {
      updateOpenModeUi();
      const corePill = document.getElementById('launcher-val-core');
      if (corePill) {
        corePill.textContent = selectedCore === 'vanilla' ? 'snes9x-wasm' : 'snes9x-wasm fork';
        corePill.classList.toggle('active', selectedCore === 'fork');
      }

      const presetPill = document.getElementById('launcher-val-preset');
      if (presetPill) {
        presetPill.textContent = PRESET_LABELS[selectedPreset] || selectedPreset;
        presetPill.classList.add('active');
      }

      const isCdl = selectedPreset === 'cdl';

      const recRow = document.getElementById('launcher-row-2');
      const recPill = document.getElementById('launcher-val-record');
      const recBtns = recRow ? recRow.querySelectorAll('.menu-stepper-btn') : [];
      if (recRow) recRow.classList.toggle('disabled', isCdl);
      for (let i = 0; i < recBtns.length; i++) recBtns[i].disabled = isCdl;
      if (recPill) {
        const effectiveRec = isCdl ? true : alwaysRecordEnabled;
        recPill.textContent = effectiveRec ? 'ON' : 'OFF';
        recPill.classList.toggle('active', effectiveRec);
      }

      const sramRow = document.getElementById('launcher-row-3');
      const sramPill = document.getElementById('launcher-val-sram');
      const sramBtns = sramRow ? sramRow.querySelectorAll('.menu-stepper-btn') : [];
      if (sramRow) sramRow.classList.toggle('disabled', isCdl);
      for (let i = 0; i < sramBtns.length; i++) sramBtns[i].disabled = isCdl;
      if (sramPill) {
        const effectiveSram = isCdl ? 'individual' : sramMode;
        sramPill.textContent = effectiveSram === 'individual' ? 'Individual' : 'Default';
        sramPill.classList.toggle('active', effectiveSram === 'default');
      }
    }

    function resetClearRecentButton() {
      clearRecentConfirming = false;
      const btn = document.getElementById('clearRecentBtn');
      if (btn) {
        btn.textContent = '[B] Clear';
        btn.className = 'menu-action-pill';
      }
    }

    function cancelClearRecentConfirm() {
      if (!clearRecentConfirming) return;
      resetClearRecentButton();
      if (typeof playMenuSound === 'function') playMenuSound('click_cancel');
    }

    function handleClearRecentAction() {
      if (!clearRecentConfirming) {
        clearRecentConfirming = true;
        const btn = document.getElementById('clearRecentBtn');
        if (btn) {
          btn.textContent = 'Confirm? [B] Yes / [A] No';
          btn.className = 'menu-action-pill danger confirming';
        }
        if (typeof playMenuSound === 'function') playMenuSound('click_nav');
        return;
      }

      resetClearRecentButton();
      if (vscodeApi) vscodeApi.postMessage({ command: 'clearRecentRoms' });
      if (typeof playMenuSound === 'function') playMenuSound('click_confirm');
    }

    function launchSelectedRom() {
      const items = getOverlayCol0Focusables();
      if (!items.length) return;
      const idx = Math.max(0, Math.min(overlayCol0Idx, items.length - 1));
      const el = items[idx];
      if (el && typeof el.click === 'function') {
        window.startKeySuppressedUntilRelease = true;
        window.ignoreStartUntil = performance.now() + 600;
        el.click();
        if (typeof playMenuSound === 'function') playMenuSound('click_confirm');
      }
    }

    function initSidebarControls() {
      updateSidebarUi();

      for (let r = 0; r < 6; r++) {
        const row = document.getElementById('launcher-row-' + r);
        if (row) {
          row.onclick = (e) => {
            overlayFocusCol = 1;
            overlayCol1Idx = r;
            setOverlayFocus(r, 1);
            if (row.classList.contains('disabled')) return;

            const stepper = e.target.closest('.menu-stepper-btn');
            if (stepper) {
              const step = parseInt(stepper.getAttribute('data-step') || '1', 10);
              changeOverlayValue(step);
              return;
            }

            if (r === 5 || e.target.closest('#clearRecentBtn')) {
              handleClearRecentAction();
              return;
            }

            const pill = e.target.closest('.menu-pill');
            if (pill) {
              changeOverlayValue(1);
              return;
            }

            // Clicking row label or background only focuses the row, does not step
          };
        }
      }
    }

    function renderRomOffer(data) {
      if (!data) return;
      currentOfferData = data;
      if (data.sessionSettings) {
        if (data.sessionSettings.core) selectedCore = data.sessionSettings.core;
        if (data.sessionSettings.preset) selectedPreset = data.sessionSettings.preset;
        if (data.sessionSettings.sramMode === 'default' || data.sessionSettings.sramMode === 'individual') sramMode = data.sessionSettings.sramMode;
        else if (typeof data.sessionSettings.isolatedSram === 'boolean') sramMode = data.sessionSettings.isolatedSram ? 'individual' : 'default';
        if (typeof data.sessionSettings.alwaysRecord === 'boolean') alwaysRecordEnabled = data.sessionSettings.alwaysRecord;
        if (data.sessionSettings.openMode === 'new' || data.sessionSettings.openMode === 'continue') openMode = data.sessionSettings.openMode;
      }
      initSidebarControls();

      const vBtn = document.getElementById('vanillaBtn');
      const vDesc = document.getElementById('vanilla-desc');
      if (vBtn && vDesc) {
        if (data.vanilla && data.vanilla.available) {
          vBtn.classList.remove('disabled');
          vBtn.disabled = false;
          const regPrefix = data.vanilla.region ? '[' + data.vanilla.region + '] ' : '';
          vDesc.textContent = regPrefix + (data.vanilla.name || 'Vanilla ROM') + (data.vanilla.sizeFormatted ? ' (' + data.vanilla.sizeFormatted + ')' : '');
          vBtn.title = 'Load the base ROM: ' + (data.vanilla.path || '');
          vDesc.setAttribute('data-base', vDesc.textContent);
          updateVanillaOpenNote();
        } else {
          vBtn.classList.add('disabled');
          vBtn.disabled = true;
          vDesc.textContent = 'Not found (Everscript: Switch ROM)';
          vBtn.title = 'No base ROM for this game in the ROM library. Add yours with Everscript: Switch ROM.';
        }
      }

      const recentSection = document.getElementById('recent-roms-section');
      const recentList = document.getElementById('recent-roms-list');
      if (recentSection && recentList) {
        recentList.innerHTML = '';
        if (data.recent && data.recent.length > 0) {
          recentSection.style.display = 'flex';
          for (const item of data.recent) {
            const row = document.createElement('div');
            row.className = 'recent-rom-item' + (item.exists ? '' : ' missing');
            row.tabIndex = 0;
            row.title = (item.isCustomMap ? ('[Custom Map] ' + (item.vfsUri ? item.vfsUri + ' - ' : '')) : '') + (item.path || item.name);

            // Left: Big square for map preview or region badge
            const square = document.createElement('div');
            square.className = 'recent-rom-square';
            if (item.previewDataUri) {
              const img = document.createElement('img');
              img.src = item.previewDataUri;
              img.alt = 'Map Preview';
              img.title = item.isCustomMap ? ('Custom Map: ' + (item.customName || item.name)) : 'ROM Preview';
              square.appendChild(img);
            } else {
              const badge = document.createElement('div');
              const reg = item.region || '?';
              badge.className = 'recent-rom-square-badge badge-' + (reg === '?' ? 'unk' : reg);
              badge.textContent = item.icon || reg;
              square.appendChild(badge);
            }

            // Right: Information (upper name, lower details)
            const info = document.createElement('div');
            info.className = 'recent-rom-info';

            const nameEl = document.createElement('div');
            nameEl.className = 'recent-rom-name';
            nameEl.textContent = item.isCustomMap && item.customName ? item.customName : item.name;

            const detailsEl = document.createElement('div');
            detailsEl.className = 'recent-rom-details';

            if (item.region && item.region !== 'MAP' && item.region !== '?') {
              const regPill = document.createElement('span');
              regPill.className = 'recent-rom-pill badge-' + item.region;
              regPill.textContent = item.region;
              detailsEl.appendChild(regPill);
            }

            const metaSpan = document.createElement('span');
            const metaParts = [];
            if (item.sizeFormatted) metaParts.push(item.sizeFormatted);
            if (item.timeFormatted) metaParts.push(item.timeFormatted);
            if (!item.exists) metaParts.push('(missing)');
            metaSpan.textContent = metaParts.join(' - ');
            detailsEl.appendChild(metaSpan);

            info.appendChild(nameEl);
            info.appendChild(detailsEl);

            row.appendChild(square);
            row.appendChild(info);
            romSessionAttach(row, item, detailsEl);

            row.addEventListener('click', () => {
              if (item.exists) {
                try { initAudio(); } catch (_) {}
                try { ensureAudioRunning(); } catch (_) {}
                if (vscodeApi) vscodeApi.postMessage(Object.assign({ command: 'loadRecentRom', path: item.path, name: item.name, kind: item.kind, resume: romSessionResumeId(item) }, getLaunchOptions()));
              }
            });
            row.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                row.click();
              }
            });

            recentList.appendChild(row);
          }
        } else {
          recentSection.style.display = 'none';
        }
        if (!romLoaded) {
          const items0 = getOverlayCol0Focusables();
          overlayCol0Idx = getInitialCol0Index(items0);
          overlayFocusCol = 0;
          setOverlayFocus(overlayCol0Idx, overlayFocusCol);
        }
      }
    }

    function getOverlayCol0Focusables() {
      const list = [];
      const dropZone = document.getElementById('rom-drop-zone');
      if (dropZone) list.push(dropZone);
      const vBtn = document.getElementById('vanillaBtn');
      if (vBtn && !vBtn.disabled) list.push(vBtn);
      const items = document.querySelectorAll('.recent-rom-item:not(.missing)');
      items.forEach(it => list.push(it));
      return list;
    }

    function getOverlayCol1Focusables() {
      const list = [];
      for (let i = 0; i < 6; i++) {
        const row = document.getElementById('launcher-row-' + i);
        if (row) list.push(row);
      }
      return list;
    }

    function getOverlayFocusables() {
      return overlayFocusCol === 0 ? getOverlayCol0Focusables() : getOverlayCol1Focusables();
    }

    function setOverlayFocus(idx, col) {
      if (typeof col === 'number') overlayFocusCol = col;
      const items0 = getOverlayCol0Focusables();
      const items1 = getOverlayCol1Focusables();

      items0.forEach(el => el.classList.remove('keyboard-focused'));
      items1.forEach(el => el.classList.remove('selected'));

      const activeItems = overlayFocusCol === 0 ? items0 : items1;
      if (!activeItems.length) return;

      if (idx < 0) idx = 0;
      if (idx >= activeItems.length) idx = activeItems.length - 1;

      if (overlayFocusCol === 0) overlayCol0Idx = idx;
      else overlayCol1Idx = idx;

      try {
        sessionStorage.setItem('evs_overlayCol', String(overlayFocusCol));
        sessionStorage.setItem('evs_overlayCol0', String(overlayCol0Idx));
        sessionStorage.setItem('evs_overlayCol1', String(overlayCol1Idx));
      } catch (_) {}

      const target = activeItems[idx];
      if (target) {
        if (overlayFocusCol === 0) {
          target.classList.add('keyboard-focused');
        } else {
          target.classList.add('selected');
        }
        if (typeof target.focus === 'function') {
          try { target.focus(); } catch (_) {}
        }
        if (typeof target.scrollIntoView === 'function') {
          try { target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); } catch (_) {}
        }
      }
    }

    function moveOverlaySelection(delta) {
      resetClearRecentButton();
      const items = getOverlayFocusables();
      if (!items.length) return;
      const curIdx = overlayFocusCol === 0 ? overlayCol0Idx : overlayCol1Idx;
      const next = curIdx < 0 ? 0 : (curIdx + delta + items.length) % items.length;
      setOverlayFocus(next);
      if (typeof playMenuSound === 'function') playMenuSound('click_nav');
    }

    function changeOverlayValue(delta) {
      if (overlayFocusCol !== 1) return;
      const step = delta >= 0 ? 1 : -1;
      if (overlayCol1Idx === 0) {
        // Row 0: Core (toggle between fork and vanilla)
        selectedCore = (selectedCore === 'fork') ? 'vanilla' : 'fork';
        try { sessionStorage.setItem('evs_selectedCore', selectedCore); } catch (_) {}
        updateSidebarUi();
        if (vscodeApi) vscodeApi.postMessage({ command: 'setSessionSettings', core: selectedCore });
        if (typeof playMenuSound === 'function') playMenuSound('click_toggle');
      } else if (overlayCol1Idx === 1) {
        // Row 1: Preset
        const curIdx = Math.max(0, PRESETS.indexOf(selectedPreset));
        const nextIdx = Math.max(0, Math.min(curIdx + step, PRESETS.length - 1));
        if (nextIdx !== curIdx) {
          selectedPreset = PRESETS[nextIdx];
          try {
            sessionStorage.setItem('evs_selectedPreset', selectedPreset);
          } catch (_) {}
          updateSidebarUi();
          if (vscodeApi) vscodeApi.postMessage({
            command: 'setSessionSettings',
            preset: selectedPreset
          });
          if (typeof playMenuSound === 'function') playMenuSound('click_toggle');
        }
      } else if (overlayCol1Idx === 2) {
        // Row 2: Always record (toggle)
        if (selectedPreset === 'cdl') return;
        alwaysRecordEnabled = !alwaysRecordEnabled;
        try { sessionStorage.setItem('evs_alwaysRecord', String(alwaysRecordEnabled)); } catch (_) {}
        updateSidebarUi();
        if (vscodeApi) vscodeApi.postMessage({ command: 'setSessionSettings', alwaysRecord: alwaysRecordEnabled });
        if (typeof playMenuSound === 'function') playMenuSound('click_toggle');
      } else if (overlayCol1Idx === 4) {
        // Row 4: Open ROM (New game / Continue)
        toggleOpenMode();
      } else if (overlayCol1Idx === 3) {
        // Row 3: SRAM (Default / Individual)
        if (selectedPreset === 'cdl') return;
        sramMode = (sramMode === 'default') ? 'individual' : 'default';
        try { sessionStorage.setItem('evs_sramMode', sramMode); } catch (_) {}
        updateSidebarUi();
        if (vscodeApi) vscodeApi.postMessage({ command: 'setSessionSettings', sramMode: sramMode, isolatedSram: sramMode === 'individual' });
        if (typeof playMenuSound === 'function') playMenuSound('click_toggle');
      }
    }

    // L / R move the focus between the two panels by direction and stop at the edge: L = the ROM column
    // (center), R = Settings (right); pressing toward the side already focused does nothing. Tab toggles.
    // Each panel keeps the row it was left on (switchOverlayColumn).
    function moveOverlayColumn(delta) {
      const col = delta < 0 ? 0 : 1;
      if (col === overlayFocusCol) return;
      switchOverlayColumn(col);
    }

    function switchOverlayColumn(col) {
      resetClearRecentButton();
      if (typeof col !== 'number') col = overlayFocusCol === 0 ? 1 : 0;
      overlayFocusCol = col;
      const targetIdx = overlayFocusCol === 0 ? overlayCol0Idx : overlayCol1Idx;
      setOverlayFocus(targetIdx, overlayFocusCol);
      if (typeof playMenuSound === 'function') playMenuSound('wheel_turn');
    }
