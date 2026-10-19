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
    let overlayCol0Idx = 0;
    let overlayCol1Idx = 0;

    let selectedCore = 'fork';
    let selectedPreset = 'default';
    let isolatedSramEnabled = false;
    let currentRomSha1 = '';
    let currentIsolatedSram = false;
    let lastSavedSramB64 = '';

    function getLaunchOptions() {
      return {
        core: selectedCore,
        preset: selectedPreset,
        isolatedSram: isolatedSramEnabled
      };
    }

    function initSidebarControls() {
      const coreSel = document.getElementById('coreSelector');
      if (coreSel) {
        coreSel.value = selectedCore;
        coreSel.onchange = () => {
          selectedCore = coreSel.value;
          if (vscodeApi) vscodeApi.postMessage({ command: 'setSessionSettings', core: selectedCore });
        };
      }

      const presetBtns = document.querySelectorAll('.preset-btn');
      presetBtns.forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          presetBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedPreset = btn.getAttribute('data-preset') || 'default';
          if (vscodeApi) vscodeApi.postMessage({ command: 'setSessionSettings', preset: selectedPreset });
        };
      });

      const sramToggle = document.getElementById('isolatedSramToggle');
      if (sramToggle) {
        sramToggle.checked = isolatedSramEnabled;
        sramToggle.onchange = () => {
          isolatedSramEnabled = sramToggle.checked;
          if (vscodeApi) vscodeApi.postMessage({ command: 'setSessionSettings', isolatedSram: isolatedSramEnabled });
        };
      }

      const clearBtn = document.getElementById('clearRecentBtn');
      if (clearBtn) {
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          if (vscodeApi) vscodeApi.postMessage({ command: 'clearRecentRoms' });
          const statusEl = document.getElementById('load-status');
          if (statusEl) statusEl.textContent = 'Recent ROMs cleared.';
        };
      }
    }

    function renderRomOffer(data) {
      if (!data) return;
      currentOfferData = data;
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

            row.addEventListener('click', () => {
              if (item.exists) {
                try { initAudio(); } catch (_) {}
                try { ensureAudioRunning(); } catch (_) {}
                if (vscodeApi) vscodeApi.postMessage(Object.assign({ command: 'loadRecentRom', path: item.path, name: item.name, kind: item.kind }, getLaunchOptions()));
                const statusEl = document.getElementById('load-status');
                if (statusEl) statusEl.textContent = 'Loading ' + item.name + '...';
              } else {
                const statusEl = document.getElementById('load-status');
                if (statusEl) statusEl.textContent = 'File missing: ' + (item.path || item.name);
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
          setOverlayFocus(0, 0);
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
      const coreSel = document.getElementById('coreSelector');
      if (coreSel) list.push(coreSel);
      const presetBtns = document.querySelectorAll('.preset-btn');
      presetBtns.forEach(btn => list.push(btn));
      const sramToggle = document.getElementById('isolatedSramToggle');
      if (sramToggle) list.push(sramToggle);
      const clearBtn = document.getElementById('clearRecentBtn');
      if (clearBtn) list.push(clearBtn);
      return list;
    }

    function getOverlayFocusables() {
      return overlayFocusCol === 0 ? getOverlayCol0Focusables() : getOverlayCol1Focusables();
    }

    function setOverlayFocus(idx, col) {
      if (typeof col === 'number') overlayFocusCol = col;
      const items0 = getOverlayCol0Focusables();
      const items1 = getOverlayCol1Focusables();
      items0.concat(items1).forEach(el => el.classList.remove('keyboard-focused'));

      const activeItems = overlayFocusCol === 0 ? items0 : items1;
      if (!activeItems.length) return;

      if (idx < 0) idx = 0;
      if (idx >= activeItems.length) idx = activeItems.length - 1;

      if (overlayFocusCol === 0) overlayCol0Idx = idx;
      else overlayCol1Idx = idx;

      const target = activeItems[idx];
      if (target) {
        target.classList.add('keyboard-focused');
        if (typeof target.focus === 'function') {
          try { target.focus(); } catch (_) {}
        }
        if (typeof target.scrollIntoView === 'function') {
          try { target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); } catch (_) {}
        }
      }
    }

    function switchOverlayColumn(col) {
      if (typeof col !== 'number') col = overlayFocusCol === 0 ? 1 : 0;
      if (col === overlayFocusCol) return;
      overlayFocusCol = col;
      const targetIdx = overlayFocusCol === 0 ? overlayCol0Idx : overlayCol1Idx;
      setOverlayFocus(targetIdx, overlayFocusCol);
    }
