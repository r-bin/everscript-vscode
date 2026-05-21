'use strict';

/**
 * emulator/panel.js
 *
 * VS Code webview panel for the embedded SNES emulator.
 * Uses EmulatorJS (snes9x libretro core) to run SNES ROMs inside VS Code.
 *
 * Vendor files live in emulator/vendor/emulatorjs/ (bundled with the extension).
 * ROMs are read from disk by the host and sent as base64 data URLs so that
 * arbitrary file-system paths don't need to be added to localResourceRoots.
 */

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');

let _panel         = null;
let _pending       = null; // { dataUrl, name } to send once the webview signals ready
let _extensionPath = '';
let _buildChannel  = null; // output channel from the last buildAndRun call
let _panelCorePath = null; // resolved corePath the current panel was created with

/** Resolve the snesCorePath setting to an EmulatorJS-compatible .data bundle. */
function _resolveCorePath() {
    const raw = vscode.workspace.getConfiguration('everscript').get('snesCorePath', '').trim();
  if (!raw) return { path: '', warning: '' };
    const resolved = path.isAbsolute(raw) ? raw : path.resolve(raw);
  if (!fs.existsSync(resolved)) {
    return { path: '', warning: `Configured everscript.snesCorePath does not exist: ${resolved}` };
  }
  if (resolved.toLowerCase().endsWith('.data')) {
    return { path: resolved, warning: '' };
  }
  return {
    path: '',
    warning: 'everscript.snesCorePath must point to an EmulatorJS SNES core bundle (*.data). Raw snes9x2005-wasm .js/.wasm builds are not loaded directly by EmulatorJS.',
  };
}

function _resetPanelHtml() {
    if (!_panel || !_extensionPath) return;
    const vendorBase = path.join(_extensionPath, 'emulator', 'vendor', 'emulatorjs');
    _panel.webview.html = _buildHtml(_panel.webview, vendorBase, _panelCorePath);
}

/**
 * Open (or reveal) the emulator panel.
 *
 * @param {object} context   VS Code extension context.
 * @param {object} [rom]     Optional { dataUrl, name } to auto-load on open.
 */
function openEmulatorPanel(context, rom, channel) {
    if (rom) _pending = rom;
    if (channel) _buildChannel = channel;
    _extensionPath = context.extensionPath;

  const coreConfig = _resolveCorePath();
  const customCorePath = coreConfig.path;
    const vendorBase = path.join(context.extensionPath, 'emulator', 'vendor', 'emulatorjs');

  if (coreConfig.warning) {
    if (_buildChannel) _buildChannel.appendLine(`[Everscript] ${coreConfig.warning}`);
    vscode.window.showWarningMessage(`Everscript Emulator: ${coreConfig.warning}`);
  }

    // If the core changed since the panel was created, dispose so we can recreate
    // with the correct localResourceRoots (those are fixed at panel creation time).
    if (_panel && _panelCorePath !== customCorePath) {
        _panel.dispose();
        _panel = null;
    }

    if (_panel) {
        _panel.reveal(vscode.ViewColumn.Beside, true);
        if (_pending) {
            // EmulatorJS only consumes the ROM URL during bootstrap.
            // Rebuild the webview so a new ROM always starts from a clean runtime.
            _resetPanelHtml();
        }
        return;
    }

    const resourceRoots = [vscode.Uri.file(context.extensionPath)];
    if (customCorePath) {
        resourceRoots.push(vscode.Uri.file(path.dirname(customCorePath)));
    }

    _panelCorePath = customCorePath;

    _panel = vscode.window.createWebviewPanel(
        'everscriptEmulator',
        'Everscript Emulator',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: resourceRoots,
        },
    );

    _panel.webview.html = _buildHtml(_panel.webview, vendorBase, customCorePath);

    _panel.webview.onDidReceiveMessage(msg => {
        switch (msg.command) {
            case 'ready':
                if (_pending) {
                    _panel.webview.postMessage({ command: 'loadRom', dataUrl: _pending.dataUrl, name: _pending.name });
                    _pending = null;
                }
                break;

            case 'pickRom': {
                vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel:     'Load ROM',
                    filters:       { 'SNES ROM': ['smc', 'sfc', 'fig', 'bin'] },
                }).then(uris => {
                    if (!uris || !uris.length) return;
                    _sendRomFile(uris[0].fsPath);
                });
                break;
            }

            case 'wramDelta':
                // Forward WRAM deltas to the Memory Radar live mode (future).
                break;

            case 'ejsLaunching':
                if (_buildChannel) _buildChannel.appendLine(`[Everscript] Launching emulator: ${msg.name}`);
                break;

            case 'ejsBlobReady':
                if (_buildChannel) _buildChannel.appendLine(`[Everscript] ROM blob created: ${(msg.size / 1024 / 1024).toFixed(2)} MB — handing off to EmulatorJS`);
                break;

            case 'debugApiStatus':
              if (_buildChannel) _buildChannel.appendLine(`[Everscript] ${msg.text}`);
              break;

            case 'debugBreakpointHit':
              if (_buildChannel) {
                _buildChannel.appendLine(`[Everscript] Breakpoint hit: ${msg.type} @ ${msg.address} pc=${msg.pc}`);
              }
              break;

            case 'ejsError':
                if (_buildChannel) _buildChannel.appendLine(`[Everscript] Emulator error: ${msg.error}`);
                vscode.window.showErrorMessage('Everscript Emulator: ' + msg.error);
                break;

            case 'gameStarted':
                if (_buildChannel) _buildChannel.appendLine(`[Everscript] Emulator started: ${msg.name}`);
                vscode.window.setStatusBarMessage(`$(check) Emulator: ${msg.name} running`, 5000);
                break;
        }
    }, undefined, context.subscriptions);

    _panel.onDidDispose(() => { _panel = null; _pending = null; _panelCorePath = null; }, null, context.subscriptions);
}

/** Read a ROM file from disk and send it to the webview. */
function _sendRomFile(romPath) {
    const romName = path.basename(romPath);
    try {
        const romData = fs.readFileSync(romPath);
        const dataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
    _pending = { dataUrl, name: romName };
    _resetPanelHtml();
    } catch (e) {
        vscode.window.showErrorMessage('Failed to read ROM: ' + e.message);
    }
}

function _buildHtml(webview, vendorBase, customCorePath) {
    const nonce = _nonce();

    const loaderUri = webview.asWebviewUri(vscode.Uri.file(path.join(vendorBase, 'loader.js')));
    const vendorUri = webview.asWebviewUri(vscode.Uri.file(vendorBase));
  const customCoreUri = customCorePath ? webview.asWebviewUri(vscode.Uri.file(customCorePath)).toString() : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src * blob: data: 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval';
    style-src * 'unsafe-inline' blob: data:;
    img-src * blob: data:;
    media-src * blob: data:;
    connect-src * blob: data:;
    worker-src blob: data:;
    font-src * blob: data:;
  ">
  <title>Everscript Emulator</title>
  <style nonce="${nonce}">
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; flex-direction: column; }
    #ejs-container { flex: 1; min-height: 0; overflow: hidden; }
    #overlay {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #111; color: #ccc;
      font-family: monospace; gap: 16px; z-index: 100;
    }
    #overlay h2 { color: #eee; font-size: 18px; }
    #pickBtn { padding: 10px 24px; background: #1a6; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    #pickBtn:hover { background: #0c5; }
    #status { font-size: 12px; color: #888; max-width: 400px; text-align: center; }
    /* Script stack */
    #script-stack {
      height: 220px; min-height: 180px; max-height: 320px;
      background: #0d0d0d; border-top: 1px solid #333;
      overflow-y: auto; font-family: monospace; font-size: 11px;
      display: none;
    }
    #script-stack.visible { display: block; }
    #ss-header {
      position: sticky; top: 0;
      background: #1a1a1a; padding: 3px 8px;
      color: #aaa; font-size: 10px; letter-spacing: 0.05em;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid #333;
    }
    #ss-title { display: flex; gap: 10px; align-items: center; }
    #ss-header span { color: #777; }
    #ss-controls { display: flex; gap: 6px; align-items: center; }
    .ss-btn {
      border: 1px solid #444; background: #181818; color: #ccc;
      padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;
    }
    .ss-btn:hover { background: #222; }
    .ss-btn:disabled { opacity: 0.45; cursor: default; }
    #ss-meta {
      position: sticky; top: 24px;
      background: #141414; border-bottom: 1px solid #222;
      padding: 4px 8px; display: flex; gap: 12px; flex-wrap: wrap;
      color: #777; font-size: 10px;
    }
    .ss-ok { color: #7ad67a; }
    .ss-warn { color: #d9c36a; }
    .ss-bad { color: #d98383; }
    #ss-table { width: 100%; border-collapse: collapse; }
    #ss-table th {
      text-align: left; padding: 2px 6px;
      color: #666; font-weight: normal; font-size: 10px;
      position: sticky; top: 52px; background: #111; border-bottom: 1px solid #222;
    }
    #ss-table td { padding: 1px 6px; color: #ccc; }
    #ss-table tr.exec td { color: #6f6; }
    #ss-table tr.wait td { color: #ff6; }
    #ss-table tr.dead td { color: #633; }
  </style>
</head>
<body>
  <div id="overlay">
    <h2>Everscript Emulator</h2>
    <button id="pickBtn">Load ROM...</button>
    <div id="status">Select a SNES ROM (.smc / .sfc) to begin.</div>
  </div>
  <div id="ejs-container"></div>
  <div id="script-stack">
    <div id="ss-header">
      <div id="ss-title">
        <b>SCRIPT STACK</b>
        <span id="ss-count">waiting...</span>
      </div>
      <div id="ss-controls">
        <button id="ss-pause-btn" class="ss-btn" disabled>pause</button>
        <button id="ss-resume-btn" class="ss-btn" disabled>resume</button>
        <button id="ss-hook-btn" class="ss-btn" disabled>arm stack hook</button>
      </div>
    </div>
    <div id="ss-meta">
      <span id="ss-api-status">api: checking...</span>
      <span id="ss-cpu-status">pc: ------</span>
      <span id="ss-pause-state">running</span>
      <span id="ss-break-status">hook: unavailable</span>
      <span id="ss-last-hit">last: -</span>
    </div>
    <table id="ss-table">
      <thead><tr><th>#</th><th>PC</th><th>state</th><th>entity</th><th>timer</th></tr></thead>
      <tbody id="ss-tbody"></tbody>
    </table>
  </div>

  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();

    window.addEventListener('DOMContentLoaded', () => {
      vscodeApi.postMessage({ command: 'ready' });
    });

    document.getElementById('pickBtn').addEventListener('click', () => {
      vscodeApi.postMessage({ command: 'pickRom' });
      document.getElementById('status').textContent = 'Waiting for file picker...';
    });

    window.addEventListener('message', evt => {
      if (evt.data.command === 'loadRom') startEjs(evt.data.dataUrl, evt.data.name);
    });

    // ── WRAM / Script stack ────────────────────────────────────────────────

    const SCRIPT_BASE  = 0x28FC;
    const SLOT_SIZE    = 0x4F;
    const SLOT_COUNT   = 20;
    const SCRIPT_REGION_SIZE = SLOT_SIZE * SLOT_COUNT;
    const SCRIPT_STACK_BUS_ADDR = 0x7E0000 + SCRIPT_BASE;
    const SCRIPT_BREAK_WATCH_OFFSETS = [0x00, 0x03, 0x0D];
    const RAM_TAG      = [82, 65, 77, 32]; // "RAM "
    const WRAM_SIZE    = 0x20000;

    let scriptHookArmed = false;
    let activeScriptWatchpoints = [];
    let lastDebugStatus = '';

    function readU16(w, off) { return (w[off] | (w[off + 1] << 8)) >>> 0; }
    function readU24(w, off) { return (w[off] | (w[off + 1] << 8) | (w[off + 2] << 16)) >>> 0; }
    function formatHex(value, width) {
      return (value >>> 0).toString(16).toUpperCase().padStart(width, '0');
    }

    function setText(id, text, className) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.className = className || '';
    }

    function getGameManager() {
      return window.EJS_emulator && window.EJS_emulator.gameManager;
    }

    function getModule() {
      const gm = getGameManager();
      return gm && gm.Module ? gm.Module : null;
    }

    function hasDebuggerApi(module) {
      return !!module &&
        typeof module.getCPUState === 'function' &&
        typeof module.readMemoryRange === 'function' &&
        typeof module.pauseEmulation === 'function' &&
        typeof module.resumeEmulation === 'function';
    }

    function hasWriteBreakpointApi(module) {
      return hasDebuggerApi(module) &&
        typeof module.addWriteBreakpoint === 'function' &&
        typeof module.removeWriteBreakpoint === 'function';
    }

    function reportDebugStatus(text) {
      if (text === lastDebugStatus) return;
      lastDebugStatus = text;
      vscodeApi.postMessage({ command: 'debugApiStatus', text });
    }

    function setControlEnabled(id, enabled) {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    }

    /** Scan a snes9x save-state blob for the 128 KB RAM block. */
    function parseWramFromState(raw) {
      const d = (raw instanceof Uint8Array) ? raw : new Uint8Array(raw);
      const limit = d.length - 8 - WRAM_SIZE;
      for (let i = 0; i < limit; i++) {
        if (d[i] === RAM_TAG[0] && d[i+1] === RAM_TAG[1] &&
            d[i+2] === RAM_TAG[2] && d[i+3] === RAM_TAG[3]) {
          const sizeBE = ((d[i+4] << 24) | (d[i+5] << 16) | (d[i+6] << 8) | d[i+7]) >>> 0;
          const sizeLE = (d[i+4] | (d[i+5] << 8) | (d[i+6] << 16) | (d[i+7] << 24)) >>> 0;
          if (sizeBE === WRAM_SIZE || sizeLE === WRAM_SIZE) {
            return d.subarray(i + 8, i + 8 + WRAM_SIZE);
          }
        }
      }
      return null;
    }

    function buildScriptRows(region) {
      const rows = [];
      for (let i = 0; i < SLOT_COUNT; i++) {
        const base = i * SLOT_SIZE;
        if (base + SLOT_SIZE > region.length) break;
        const loc = readU24(region, base + 0x00);
        if (loc === 0) continue;
        const state  = readU16(region, base + 0x03);
        const timer1 = readU16(region, base + 0x05);
        const entity = readU16(region, base + 0x0D);
        rows.push({ slot: i, loc, state, timer1, entity });
      }
      return rows;
    }

    /** Render 20-slot script stack from raw script-region bytes. */
    function updateScriptStack(region) {
      const tbody = document.getElementById('ss-tbody');
      if (!tbody) return;
      let rows = '';
      const parsedRows = buildScriptRows(region);
      for (const row of parsedRows) {
        const { slot, loc, state, timer1, entity } = row;
        const cls    = state === 2 ? 'exec' : state === 4 ? 'wait' : 'dead';
        const sname  = state === 2 ? 'exec' : state === 4 ? 'wait' : state === 0 ? 'dead' : '0x' + state.toString(16);
        rows += '<tr class="' + cls + '">' +
          '<td>' + slot + '</td>' +
          '<td>' + formatHex(loc, 6) + '</td>' +
          '<td>' + sname + '</td>' +
          '<td>' + formatHex(entity, 4) + '</td>' +
          '<td>' + timer1 + '</td>' +
          '</tr>';
      }
      if (rows === '') {
        rows = '<tr><td colspan="5" style="color:#555;text-align:center;padding:6px">no active scripts</td></tr>';
      }
      tbody.innerHTML = rows;
      document.getElementById('ss-count').textContent = parsedRows.length + ' active';
    }

    function injectStateReader(module) {
      if (typeof module.EmulatorJSGetState === 'function') return;
      module.EmulatorJSGetState = function() {
        try {
          module._cmd_save_state();
          return module.FS.readFile('/game.state');
        } catch (_) {
          return null;
        }
      };
    }

    function readScriptStackRegion(gm) {
      const module = gm && gm.Module;
      if (!module) return { mode: 'connecting', bytes: null };

      if (hasDebuggerApi(module)) {
        return {
          mode: 'custom-debugger',
          bytes: module.readMemoryRange(SCRIPT_STACK_BUS_ADDR, SCRIPT_REGION_SIZE),
        };
      }

      injectStateReader(module);
      const raw = (typeof gm.getState === 'function') ? gm.getState() : module.EmulatorJSGetState();
      if (!raw) return { mode: 'save-state-unavailable', bytes: null };
      const wram = parseWramFromState(raw);
      if (!wram) return { mode: 'save-state-unavailable', bytes: null };
      return {
        mode: 'save-state',
        bytes: wram.subarray(SCRIPT_BASE, SCRIPT_BASE + SCRIPT_REGION_SIZE),
      };
    }

    function buildScriptStackWatchpoints() {
      const watches = [];
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const base = SCRIPT_BASE + slot * SLOT_SIZE;
        for (const offset of SCRIPT_BREAK_WATCH_OFFSETS) {
          watches.push(base + offset);
        }
      }
      return watches;
    }

    function disarmScriptStackHook(module) {
      if (module && typeof module.removeWriteBreakpoint === 'function') {
        for (const addr of activeScriptWatchpoints) module.removeWriteBreakpoint(addr);
      }
      activeScriptWatchpoints = [];
      scriptHookArmed = false;
      setText('ss-break-status', 'hook: off', 'ss-warn');
      const btn = document.getElementById('ss-hook-btn');
      if (btn) btn.textContent = 'arm stack hook';
    }

    function armScriptStackHook(module) {
      if (!hasWriteBreakpointApi(module)) return false;
      disarmScriptStackHook(module);
      activeScriptWatchpoints = buildScriptStackWatchpoints();
      for (const addr of activeScriptWatchpoints) module.addWriteBreakpoint(addr);
      scriptHookArmed = true;
      setText('ss-break-status', 'hook: armed (' + activeScriptWatchpoints.length + ')', 'ss-ok');
      const btn = document.getElementById('ss-hook-btn');
      if (btn) btn.textContent = 'disarm stack hook';
      return true;
    }

    function installDebuggerBridge(module) {
      if (!hasDebuggerApi(module)) return;
      if (module.__everscriptDebuggerBridgeInstalled) return;
      module.__everscriptDebuggerBridgeInstalled = true;
      module.onBreakpointHit = function(event) {
        const addrText = event.type === 'write'
          ? '7E' + formatHex(event.address, 4)
          : formatHex(event.address, 6);
        setText('ss-last-hit', 'last: ' + event.type + ' @ ' + addrText + ' pc ' + formatHex(event.pc, 6), 'ss-bad');
        setText('ss-pause-state', 'paused', 'ss-bad');
        vscodeApi.postMessage({
          command: 'debugBreakpointHit',
          type: event.type,
          address: addrText,
          pc: formatHex(event.pc, 6),
        });
      };
    }

    function refreshDebuggerUi(module, sourceMode) {
      const customApi = hasDebuggerApi(module);
      const writeApi  = hasWriteBreakpointApi(module);

      if (customApi) {
        const cpu = module.getCPUState();
        setText('ss-api-status', 'api: custom debugger active', 'ss-ok');
        setText('ss-cpu-status', 'pc: ' + formatHex(cpu.pc, 6) + ' pb:' + formatHex(cpu.pb, 2) + ' a:' + formatHex(cpu.a, 4), 'ss-ok');
        reportDebugStatus('Custom debugger API active (' + sourceMode + ') pc=' + formatHex(cpu.pc, 6));
      } else {
        setText('ss-api-status', 'api: ' + (sourceMode === 'save-state' ? 'save-state fallback' : 'not available'), 'ss-warn');
        setText('ss-cpu-status', 'pc: ------', 'ss-warn');
        reportDebugStatus(sourceMode === 'save-state'
          ? 'Using save-state fallback for script stack (custom debugger API unavailable)'
          : 'Custom debugger API unavailable');
      }

      setControlEnabled('ss-pause-btn', customApi);
      setControlEnabled('ss-resume-btn', customApi);
      setControlEnabled('ss-hook-btn', writeApi);

      if (!writeApi) {
        disarmScriptStackHook(module);
        setText('ss-break-status', 'hook: unavailable', 'ss-warn');
      }
    }

    /** Start the WRAM polling loop after game loads. */
    function startWramPolling() {
      const el = document.getElementById('script-stack');
      if (el) el.classList.add('visible');

      document.getElementById('ss-count').textContent = 'connecting...';

      function attempt() {
        try {
          const gm = window.EJS_emulator && window.EJS_emulator.gameManager;
          if (!gm || !gm.Module) { setTimeout(attempt, 1000); return; }

          installDebuggerBridge(gm.Module);
          refreshDebuggerUi(gm.Module, 'connecting');

          function poll() {
            try {
              const source = readScriptStackRegion(gm);
              refreshDebuggerUi(gm.Module, source.mode);
              if (source.bytes) {
                updateScriptStack(source.bytes);
                vscodeApi.postMessage({ command: 'wramDelta', offset: SCRIPT_BASE, data: Array.from(source.bytes) });
              } else {
                document.getElementById('ss-count').textContent = source.mode === 'connecting' ? 'connecting...' : 'unavailable';
              }
            } catch (_) { /* silently skip on error */ }
            setTimeout(poll, 250);
          }
          poll();
        } catch (_) {
          setTimeout(attempt, 2000);
        }
      }
      attempt();
    }

    document.getElementById('ss-pause-btn').addEventListener('click', () => {
      const module = getModule();
      if (!hasDebuggerApi(module)) return;
      module.pauseEmulation();
      setText('ss-pause-state', 'paused', 'ss-bad');
      setText('ss-last-hit', 'last: manual pause', 'ss-warn');
    });

    document.getElementById('ss-resume-btn').addEventListener('click', () => {
      const module = getModule();
      if (!hasDebuggerApi(module)) return;
      module.resumeEmulation();
      setText('ss-pause-state', 'running', 'ss-ok');
    });

    document.getElementById('ss-hook-btn').addEventListener('click', () => {
      const module = getModule();
      if (!hasWriteBreakpointApi(module)) return;
      if (scriptHookArmed) disarmScriptStackHook(module);
      else armScriptStackHook(module);
    });

    // ── EmulatorJS bootstrap ───────────────────────────────────────────────

    function startEjs(dataUrl, name) {
      document.getElementById('overlay').style.display = 'none';
      vscodeApi.postMessage({ command: 'ejsLaunching', name });

      // EmulatorJS uses fetch() internally. VS Code webview sandboxes silently block
      // fetch() on data: URLs, causing EJS to fall back to its file browser.
      // Convert the base64 data URL to a Blob URL before handing it to EmulatorJS.
      let gameUrl = dataUrl;
      if (dataUrl && dataUrl.startsWith('data:')) {
        try {
          const comma  = dataUrl.indexOf(',');
          const mime   = (dataUrl.slice(0, comma).match(/:(.*?);/) || [,'application/octet-stream'])[1];
          const binStr = atob(dataUrl.slice(comma + 1));
          const buf    = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) buf[i] = binStr.charCodeAt(i);
          gameUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
          vscodeApi.postMessage({ command: 'ejsBlobReady', name, size: buf.length });
        } catch (e) {
          vscodeApi.postMessage({ command: 'ejsError', error: 'Blob URL conversion failed: ' + e.message });
        }
      }

      window.EJS_player        = '#ejs-container';
      window.EJS_core          = 'snes9x';
      window.EJS_gameUrl       = gameUrl;
      window.EJS_gameName      = name || 'game';
      window.EJS_pathtodata    = '${vendorUri}/';
      window.EJS_paths         = ${customCoreUri ? `{ 'snes9x-wasm.data': '${customCoreUri}', 'snes9x-legacy-wasm.data': '${customCoreUri}' }` : 'undefined'};
      window.EJS_startOnLoaded = true;
      window.EJS_threads       = false;
      window.EJS_onGameStart   = function() {
        vscodeApi.postMessage({ command: 'gameStarted', name: window.EJS_gameName });
        setTimeout(startWramPolling, 1500); // slight delay to let emulator settle
      };

      const s = document.createElement('script');
      s.src = '${loaderUri}';
      document.head.appendChild(s);
    }
  </script>
</body>
</html>`;
}

/**
 * Build the webview HTML for the custom snes9x2005-wasm core.
 * The core exposes: _setJoypadInput, _my_malloc, _my_free, _startWithRom,
 *                   _mainLoop, _getScreenBuffer  (512×448 RGBA8).
 */
function _buildCustomCoreHtml(webview, corePath) {
    const nonce   = _nonce();
    const coreUri = webview.asWebviewUri(vscode.Uri.file(corePath));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    script-src * blob: data: 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval';
    style-src * 'unsafe-inline' blob: data:;
    img-src * blob: data:;
    media-src * blob: data:;
    connect-src * blob: data:;
    worker-src blob: data:;
    font-src * blob: data:;
  ">
  <title>Everscript Emulator (custom core)</title>
  <style nonce="${nonce}">
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; flex-direction: column; }
    #screen-wrap { flex: 1; min-height: 0; background: #000; position: relative; overflow: hidden; }
    #screen { display: block; image-rendering: pixelated; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
    #overlay {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #111; color: #ccc;
      font-family: monospace; gap: 16px; z-index: 100;
    }
    #overlay h2 { color: #eee; font-size: 18px; }
    #pickBtn { padding: 10px 24px; background: #1a6; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    #pickBtn:hover { background: #0c5; }
    #status { font-size: 12px; color: #888; max-width: 400px; text-align: center; }
    #core-badge { font-size: 10px; color: #555; margin-top: -8px; }
  </style>
</head>
<body>
  <div id="overlay">
    <h2>Everscript Emulator</h2>
    <div id="core-badge">core: snes9x2005-wasm (custom)</div>
    <button id="pickBtn">Load ROM...</button>
    <div id="status">Select a SNES ROM (.smc / .sfc) to begin.</div>
  </div>
  <div id="screen-wrap">
    <canvas id="screen" width="512" height="448"></canvas>
  </div>

  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();
    let romLoaded = false;

    // snes9x2005-wasm sets Module on the global scope.
    // Hook onRuntimeInitialized BEFORE loading the script.
    var Module = {
      onRuntimeInitialized: function () {
        // Signal the host that we are ready to receive a ROM.
        vscodeApi.postMessage({ command: 'ready' });
        startRenderLoop();
      }
    };

    document.getElementById('pickBtn').addEventListener('click', () => {
      vscodeApi.postMessage({ command: 'pickRom' });
      document.getElementById('status').textContent = 'Waiting for file picker...';
    });

    window.addEventListener('message', evt => {
      if (evt.data.command === 'loadRom') loadRom(evt.data.dataUrl, evt.data.name);
    });

    function loadRom(dataUrl, name) {
      try {
        const comma  = dataUrl.indexOf(',');
        const binStr = atob(dataUrl.slice(comma + 1));
        const romData = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) romData[i] = binStr.charCodeAt(i);

        const ptr = Module._my_malloc(romData.length);
        HEAPU8.set(romData, ptr);
        Module._startWithRom(ptr, romData.length, 44100);
        Module._my_free(ptr);

        romLoaded = true;
        document.getElementById('overlay').style.display = 'none';
        vscodeApi.postMessage({ command: 'gameStarted', name: name || 'game' });
      } catch (e) {
        vscodeApi.postMessage({ command: 'ejsError', error: 'ROM load failed: ' + e.message });
        document.getElementById('status').textContent = 'Error: ' + e.message;
      }
    }

    // Button mapping (same layout as doc/script.js in snes9x2005-wasm).
    // Bits: R=4, L=5, X=6, A=7, RIGHT=8, LEFT=9, DOWN=10, UP=11,
    //       START=12, SELECT=13, Y=14, B=15
    const KEY_MAP = {
      'ArrowRight': 1 << 8,  'ArrowLeft': 1 << 9,
      'ArrowDown':  1 << 10, 'ArrowUp':   1 << 11,
      'Enter':      1 << 12, 'Shift':     1 << 13,
      'z':  1 << 15, 'Z':  1 << 15,   // B
      'a':  1 << 7,  'A':  1 << 7,    // A
      'x':  1 << 6,  'X':  1 << 6,    // X
      's':  1 << 14, 'S':  1 << 14,   // Y
      'd':  1 << 5,  'D':  1 << 5,    // L
      'c':  1 << 4,  'C':  1 << 4,    // R
    };
    let keyInput = 0;
    document.addEventListener('keydown', e => {
      if (e.repeat) return;
      const bit = KEY_MAP[e.key];
      if (bit) { keyInput |= bit; e.preventDefault(); }
    });
    document.addEventListener('keyup', e => {
      const bit = KEY_MAP[e.key];
      if (bit) keyInput &= ~bit;
    });

    function startRenderLoop() {
      const canvas = document.getElementById('screen');
      const wrap   = document.getElementById('screen-wrap');
      const ctx    = canvas.getContext('2d');
      let imageData = ctx.createImageData(512, 448);

      // Scale canvas CSS size to fill the panel while keeping 512:448 aspect ratio.
      function resizeCanvas() {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        const ratio = 512 / 448;
        let w = W, h = W / ratio;
        if (h > H) { h = H; w = H * ratio; }
        canvas.style.width  = Math.round(w) + 'px';
        canvas.style.height = Math.round(h) + 'px';
      }
      new ResizeObserver(resizeCanvas).observe(wrap);
      resizeCanvas();

      function frame() {
        if (romLoaded) {
          Module._setJoypadInput(keyInput);
          Module._mainLoop();
          const ptr = Module._getScreenBuffer();
          const raw = new Uint8ClampedArray(HEAPU8.buffer, ptr, 512 * 448 * 4);
          imageData.data.set(raw);
          ctx.putImageData(imageData, 0, 0);
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }
  </script>
  <script src="${coreUri}"></script>
</body>
</html>`;
}

function _nonce() {
    let n = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) n += chars[Math.floor(Math.random() * chars.length)];
    return n;
}

module.exports = { openEmulatorPanel, sendRomFile: _sendRomFile };
