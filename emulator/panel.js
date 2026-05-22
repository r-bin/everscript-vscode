'use strict';

/**
 * emulator/panel.js
 *
 * Minimal snes9x2005-wasm runner — no EmulatorJS wrapper.
 * The Emscripten-compiled core is loaded directly inside the VS Code webview.
 *
 * Core API (lrusso/snes9x2005-wasm):
 *   Module._startWithRom(ptr, size, audioFreq)   start emulation
 *   Module._mainLoop()                            advance one frame
 *   Module._getScreenBuffer()                     ptr -> 512x448 RGBA8888
 *   Module._getSoundBuffer()                      ptr -> stereo Int16 PCM
 *   Module._setJoypadInput(bits)                  player-1 bitmask
 *   Module._setJoypadInput2(bits)                 player-2 bitmask
 *   Module._my_malloc(size) / Module._my_free(ptr)
 *   Module._saveState()                           ptr -> save-state bytes
 *   Module._getStateSaveSize()                    save-state byte count
 *   Module._loadState(ptr, size)
 *   HEAPU8                                        global Uint8Array (WASM memory)
 *
 * Custom debugger API (requires custom build — not in plain lrusso build):
 *   Module.getCPUState()  Module.readMemoryRange()  Module.pauseEmulation()
 *   Module.resumeEmulation()  Module.addExecBreakpoint()  Module.addWriteBreakpoint()
 *   Module.removeExecBreakpoint()  Module.removeWriteBreakpoint()
 *   Module.onBreakpointHit = fn({ type, address, pc })
 */

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');

const CORE_SUBDIR = path.join('emulator', 'core');
const CORE_JS     = 'snes9x_2005.js';
const CORE_WASM   = 'snes9x_2005.wasm';

let _panel         = null;   // active WebviewPanel
let _pending       = null;   // { dataUrl, name } waiting to load
let _extensionPath = '';
let _buildChannel  = null;   // output channel for build log

function _nonce() {
    let n = '';
    const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) n += ch[Math.floor(Math.random() * ch.length)];
    return n;
}

/**
 * Resolve the snes9x core to use.
 * everscript.snesCorePath (if set) must point to a snes9x2005-wasm .js file.
 * Falls back to the bundled emulator/core/snes9x_2005.js.
 * Returns { path, wasmPath, label, warning? }.
 */
function _resolveCore() {
    const raw = vscode.workspace.getConfiguration('everscript').get('snesCorePath', '').trim();
    if (raw) {
        const resolved = path.isAbsolute(raw) ? raw : path.resolve(raw);
        if (!fs.existsSync(resolved))
            return { path: '', wasmPath: '', label: '', warning: `snesCorePath "${raw}" does not exist` };
        if (!resolved.toLowerCase().endsWith('.js'))
            return { path: '', wasmPath: '', label: '', warning: `snesCorePath must point to a snes9x2005-wasm .js build, got "${path.extname(resolved)}"` };
        const wasmPath = path.join(path.dirname(resolved), CORE_WASM);
        return { path: resolved, wasmPath, label: path.basename(resolved) };
    }
    const jsPath   = path.join(_extensionPath, CORE_SUBDIR, CORE_JS);
    const wasmPath = path.join(_extensionPath, CORE_SUBDIR, CORE_WASM);
    return { path: jsPath, wasmPath, label: CORE_JS + ' (bundled)' };
}

function _resetPanelHtml() {
    if (!_panel || !_extensionPath) return;
    const core = _resolveCore();
    if (!core.path) {
        if (core.warning && _buildChannel) _buildChannel.appendLine(`[Everscript] ${core.warning}`);
        return;
    }
    const coreJsUri   = _panel.webview.asWebviewUri(vscode.Uri.file(core.path)).toString();
    const coreWasmUri = _panel.webview.asWebviewUri(vscode.Uri.file(core.wasmPath)).toString();
    _panel.webview.html = _buildHtml(_panel.webview, coreJsUri, coreWasmUri, core.label, core.path);
}

/**
 * Open (or reveal) the emulator panel.
 * @param {object} context   VS Code extension context.
 * @param {object} [rom]     Optional { dataUrl, name } to auto-load.
 * @param {object} [channel] Optional OutputChannel for build log.
 */
function openEmulatorPanel(context, rom, channel) {
    if (rom)     _pending      = rom;
    if (channel) _buildChannel = channel;
    _extensionPath = context.extensionPath;

    if (_panel) {
        _panel.reveal(vscode.ViewColumn.Beside, true);
        if (_pending) _resetPanelHtml();
        return;
    }

    const core    = _resolveCore();
    if (core.warning) {
        if (_buildChannel) _buildChannel.appendLine(`[Everscript] ${core.warning}`);
        vscode.window.showWarningMessage(`Everscript Emulator: ${core.warning}`);
    }
    const coreDir = core.path
        ? path.dirname(core.path)
        : path.join(context.extensionPath, CORE_SUBDIR);

    _panel = vscode.window.createWebviewPanel(
        'everscriptEmulator',
        'Everscript Emulator',
        vscode.ViewColumn.Beside,
        {
            enableScripts:          true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(context.extensionPath),
                vscode.Uri.file(coreDir),
            ],
        },
    );

    _resetPanelHtml();

    _panel.webview.onDidReceiveMessage(msg => {
        switch (msg.command) {
            case 'ready':
                if (_pending) {
                    _panel.webview.postMessage({ command: 'loadRom', dataUrl: _pending.dataUrl, name: _pending.name });
                    _pending = null;
                }
                break;

            case 'pickRom':
                vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel:     'Load ROM',
                    filters:       { 'SNES ROM': ['smc', 'sfc', 'fig', 'bin'] },
                }).then(uris => {
                    if (!uris || !uris.length) return;
                    _sendRomFile(uris[0].fsPath);
                });
                break;

            case 'wramDelta':
                // Reserved — forward to Memory Radar live mode.
                break;

            case 'gameStarted':
                if (_buildChannel) _buildChannel.appendLine(`[Everscript] Emulator started: ${msg.name}`);
                vscode.window.setStatusBarMessage(`$(check) Emulator: ${msg.name} running`, 5000);
                break;

            case 'ejsError':
                if (_buildChannel) {
                    _buildChannel.appendLine(`[Everscript] Emulator error: ${msg.error}`);
                    _buildChannel.show(true);
                }
                break;

            case 'debugApiStatus':
                if (_buildChannel) _buildChannel.appendLine(`[Everscript] ${msg.text}`);
                break;

            case 'debugBreakpointHit':
                if (_buildChannel) _buildChannel.appendLine(
                    `[Everscript] Breakpoint hit: ${msg.type} @ ${msg.address} pc=${msg.pc}`);
                break;
        }
    }, undefined, context.subscriptions);

    _panel.onDidDispose(() => { _panel = null; _pending = null; }, null, context.subscriptions);
}

/** Read a ROM file from disk and send it to the open webview. */
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

// ─────────────────────────────────────────────────────────────────────────────
//  HTML template
// ─────────────────────────────────────────────────────────────────────────────

function _buildHtml(webview, coreJsUri, coreWasmUri, coreLabel, corePathDisplay) {
    const nonce = _nonce();

    // NOTE: Module.locateFile uses the literal CORE_WASM filename constant
    // so the string in the template must match the actual WASM filename.
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
    html, body {
      width: 100%; height: 100%; background: #000; overflow: hidden;
      display: flex; flex-direction: column; font-family: monospace;
    }
    /* ── Screen ──────────────────────────────────────────────────────── */
    #screen-wrap {
      flex: 1; min-height: 0; background: #000;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    #screen {
      display: block;
      width: 512px; height: 448px;
      transform-origin: center center;
      image-rendering: pixelated; image-rendering: crisp-edges;
    }
    /* ── ROM picker overlay ───────────────────────────────────────────── */
    #overlay {
      position: fixed; inset: 0; z-index: 100;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #111; color: #ccc; gap: 16px;
    }
    #overlay h2    { color: #eee; font-size: 18px; }
    #pickBtn       { padding: 10px 24px; background: #1a6; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    #pickBtn:hover { background: #0c5; }
    #load-status   { font-size: 12px; color: #888; max-width: 400px; text-align: center; }
    /* ── Script stack panel ───────────────────────────────────────────── */
    #script-stack {
      height: 220px; min-height: 180px; max-height: 320px;
      background: #0d0d0d; border-top: 1px solid #333;
      overflow-y: auto; font-size: 11px;
      display: none; flex-direction: column;
    }
    #script-stack.visible { display: flex; }
    #ss-header {
      position: sticky; top: 0;
      background: #1a1a1a; padding: 3px 8px;
      color: #aaa; font-size: 10px; letter-spacing: 0.05em;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid #333; flex-shrink: 0;
    }
    #ss-title    { display: flex; gap: 10px; align-items: center; }
    #ss-controls { display: flex; gap: 6px; align-items: center; }
    .ss-btn            { border: 1px solid #444; background: #181818; color: #ccc; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer; }
    .ss-btn:hover      { background: #222; }
    .ss-btn:disabled   { opacity: 0.45; cursor: default; }
    #ss-core-row       { background: #0e0e0e; border-bottom: 1px solid #1e1e1e; padding: 2px 8px; display: flex; gap: 8px; align-items: center; color: #555; font-size: 10px; overflow: hidden; flex-shrink: 0; }
    #ss-core-label     { color: #444; flex-shrink: 0; }
    #ss-core-name      { color: #7a9a7a; flex-shrink: 0; }
    #ss-core-path      { color: #4a4a4a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    #ss-meta           { background: #141414; border-bottom: 1px solid #222; padding: 4px 8px; display: flex; gap: 12px; flex-wrap: wrap; color: #777; font-size: 10px; flex-shrink: 0; }
    .ss-ok   { color: #7ad67a; }
    .ss-warn { color: #d9c36a; }
    .ss-bad  { color: #d98383; }
    #ss-table              { width: 100%; border-collapse: collapse; }
    #ss-table th           { text-align: left; padding: 2px 6px; color: #666; font-weight: normal; font-size: 10px; position: sticky; top: 0; background: #111; border-bottom: 1px solid #222; }
    #ss-table td           { padding: 1px 6px; color: #ccc; }
    #ss-table tr.exec td   { color: #6f6; }
    #ss-table tr.wait td   { color: #ff6; }
    #ss-table tr.dead td   { color: #633; }
  </style>
</head>
<body>
  <div id="overlay">
    <h2>Everscript Emulator</h2>
    <div style="font-size:10px;color:#555;margin-top:-8px">snes9x2005-wasm</div>
    <button id="pickBtn">Load ROM...</button>
    <div id="load-status">Select a SNES ROM (.smc / .sfc) to begin.</div>
  </div>

  <div id="screen-wrap">
    <canvas id="screen" width="512" height="448"></canvas>
  </div>

  <div id="script-stack">
    <div id="ss-header">
      <div id="ss-title">
        <b>SCRIPT STACK</b>
        <span id="ss-count">waiting...</span>
      </div>
      <div id="ss-controls">
        <button id="ss-pause-btn"  class="ss-btn" disabled>pause</button>
        <button id="ss-resume-btn" class="ss-btn" disabled>resume</button>
        <button id="ss-hook-btn"   class="ss-btn" disabled>arm stack hook</button>
      </div>
    </div>
    <div id="ss-core-row" title="${corePathDisplay}">
      <span id="ss-core-label">core:</span>
      <span id="ss-core-name">${coreLabel}</span>
      <span id="ss-core-path">${corePathDisplay}</span>
    </div>
    <div id="ss-meta">
      <span id="ss-api-status">api: not ready</span>
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

  <!-- Module object must be declared before the core script loads. -->
  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();

    // ── Error forwarding ──────────────────────────────────────────────────────
    window.onerror = function(msg, src, line) {
      vscodeApi.postMessage({ command: 'ejsError',
        error: msg + (src ? ' [' + src.split('/').pop() + ':' + line + ']' : '') });
    };
    window.addEventListener('unhandledrejection', function(evt) {
      const r = evt.reason instanceof Error ? evt.reason.message : String(evt.reason || 'unhandledrejection');
      vscodeApi.postMessage({ command: 'ejsError', error: r });
    });

    // ── Module stub (set before core script tag, so onRuntimeInitialized fires) ─
    var Module = {
      locateFile: function(filename) {
        // Route the WASM request to the webview-accessible URI.
        if (filename === 'snes9x_2005.wasm') return '${coreWasmUri}';
        return filename;
      },
      onRuntimeInitialized: function() {
        // Core is ready. Signal host so any pending ROM can be delivered.
        vscodeApi.postMessage({ command: 'ready' });
        startRenderLoop();
      }
    };

    // ── ROM picker ────────────────────────────────────────────────────────────
    document.getElementById('pickBtn').addEventListener('click', () => {
      initAudio();
      ensureAudioRunning();
      vscodeApi.postMessage({ command: 'pickRom' });
      document.getElementById('load-status').textContent = 'Waiting for file picker...';
    });

    window.addEventListener('message', evt => {
      if (evt.data.command === 'loadRom') startWithRom(evt.data.dataUrl, evt.data.name);
    });

    // ── Audio ─────────────────────────────────────────────────────────────────
    // ScriptProcessorNode + ring buffer. Initialized on first ROM load to satisfy
    // the browser autoplay policy. SAMPLES_PER_FRAME = floor(44100/60) stereo pairs.
    const AUDIO_FREQ      = 44100;
    const SAMPLES_PER_FRAME = 735;   // stereo pairs per 60 fps frame at 44100 Hz
    const RING_SIZE       = 8192;    // power of 2

    let audioCtx  = null;
    let audioNode = null;
    let audioResumeHandlersInstalled = false;
    const leftRing  = new Float32Array(RING_SIZE);
    const rightRing = new Float32Array(RING_SIZE);
    let ringWrite = 0;
    let ringRead  = 0;

    function ensureAudioRunning() {
      if (!audioCtx || audioCtx.state === 'running') return;
      audioCtx.resume().catch(err => {
        vscodeApi.postMessage({ command: 'ejsError', error: 'Audio resume failed: ' + err.message });
      });
    }

    function installAudioResumeHandlers() {
      if (audioResumeHandlersInstalled) return;
      audioResumeHandlersInstalled = true;
      const wakeAudio = () => ensureAudioRunning();
      window.addEventListener('pointerdown', wakeAudio, { passive: true });
      window.addEventListener('keydown', wakeAudio, true);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') wakeAudio();
      });
    }

    function initAudio() {
      if (audioCtx) {
        ensureAudioRunning();
        return;
      }
      try {
        audioCtx  = new AudioContext({ sampleRate: AUDIO_FREQ });
        installAudioResumeHandlers();
        // ScriptProcessorNode is deprecated but reliable in VS Code WebViews
        // (AudioWorklet requires a Worker context that can be blocked by CSP).
        audioNode = audioCtx.createScriptProcessor(2048, 0, 2);
        audioNode.onaudioprocess = function(e) {
          const L = e.outputBuffer.getChannelData(0);
          const R = e.outputBuffer.getChannelData(1);
          for (let i = 0; i < L.length; i++) {
            if (ringRead < ringWrite) {
              L[i] = leftRing[ringRead  & (RING_SIZE - 1)];
              R[i] = rightRing[ringRead & (RING_SIZE - 1)];
              ringRead++;
            } else {
              L[i] = R[i] = 0;
            }
          }
        };
        audioNode.connect(audioCtx.destination);
        ensureAudioRunning();
      } catch (err) {
        vscodeApi.postMessage({ command: 'ejsError', error: 'Audio init failed: ' + err.message });
      }
    }

    function pushAudioFrame() {
      if (!audioCtx) return;
      try {
        const ptr   = Module._getSoundBuffer();
        if (!ptr) return;
        const int16 = new Int16Array(HEAPU8.buffer, ptr, SAMPLES_PER_FRAME * 2);
        for (let i = 0; i < SAMPLES_PER_FRAME; i++) {
          leftRing[ringWrite  & (RING_SIZE - 1)] = int16[i * 2]     / 32768.0;
          rightRing[ringWrite & (RING_SIZE - 1)] = int16[i * 2 + 1] / 32768.0;
          ringWrite++;
        }
      } catch (_) { /* ignore audio errors to not disrupt frame loop */ }
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    // Button bitmask positions:
    //   R=4, L=5, X=6, A=7, RIGHT=8, LEFT=9, DOWN=10, UP=11,
    //   START=12, SELECT=13, Y=14, B=15
    const KEY_MAP = {
      'ArrowRight': 1 << 8,  'ArrowLeft': 1 << 9,
      'ArrowDown':  1 << 10, 'ArrowUp':   1 << 11,
      'Enter':      1 << 12, 'Shift':     1 << 13,
      'z': 1 << 15, 'Z': 1 << 15,
      'a': 1 << 7,  'A': 1 << 7,
      'x': 1 << 6,  'X': 1 << 6,
      's': 1 << 14, 'S': 1 << 14,
      'd': 1 << 5,  'D': 1 << 5,
      'c': 1 << 4,  'C': 1 << 4,
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

    // ── ROM loading ───────────────────────────────────────────────────────────
    let romLoaded = false;

    function startWithRom(dataUrl, name) {
      try {
        const comma   = dataUrl.indexOf(',');
        const binStr  = atob(dataUrl.slice(comma + 1));
        const romData = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) romData[i] = binStr.charCodeAt(i);

        const ptr = Module._my_malloc(romData.length);
        HEAPU8.set(romData, ptr);
        Module._startWithRom(ptr, romData.length, AUDIO_FREQ);
        Module._my_free(ptr);

        romLoaded = true;
        initAudio();
        ensureAudioRunning();
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('script-stack').classList.add('visible');
        window.dispatchEvent(new Event('resize'));
        startWramPolling();
        vscodeApi.postMessage({ command: 'gameStarted', name: name || 'game' });
      } catch (e) {
        vscodeApi.postMessage({ command: 'ejsError', error: 'ROM load failed: ' + e.message });
        document.getElementById('load-status').textContent = 'Error: ' + e.message;
      }
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    function startRenderLoop() {
      const canvas    = document.getElementById('screen');
      const wrap      = document.getElementById('screen-wrap');
      const ctx       = canvas.getContext('2d');
      const imageData = ctx.createImageData(512, 448);
      let lastWrapWidth = -1;
      let lastWrapHeight = -1;

      // Scale the fixed-size 512x448 canvas to the largest size that fits the panel.
      function resizeCanvas(force) {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!force && W === lastWrapWidth && H === lastWrapHeight) return;
        lastWrapWidth = W;
        lastWrapHeight = H;
        if (!W || !H) return;
        const scale = Math.min(W / 512, H / 448);
        canvas.style.transform = 'scale(' + Math.max(scale, 0.01) + ')';
      }
      if (window.ResizeObserver) new ResizeObserver(() => resizeCanvas(true)).observe(wrap);
      window.addEventListener('resize', () => resizeCanvas(true));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resizeCanvas(true);
      });
      resizeCanvas(true);

      function frame() {
        resizeCanvas(false);
        if (romLoaded) {
          Module._setJoypadInput(keyInput);
          Module._mainLoop();
          const fbPtr = Module._getScreenBuffer();
          if (fbPtr) {
            imageData.data.set(new Uint8ClampedArray(HEAPU8.buffer, fbPtr, 512 * 448 * 4));
            ctx.putImageData(imageData, 0, 0);
          }
          pushAudioFrame();
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    // ── WRAM / Script stack ───────────────────────────────────────────────────
    const SCRIPT_BASE              = 0x28FC;
    const SLOT_SIZE                = 0x4F;
    const SLOT_COUNT               = 20;
    const SCRIPT_REGION_SIZE       = SLOT_SIZE * SLOT_COUNT;
    const SCRIPT_STACK_BUS_ADDR    = 0x7E0000 + SCRIPT_BASE;
    const SCRIPT_BREAK_WATCH_OFFSETS = [0x00, 0x03, 0x0D];
    const RAM_TAG                  = [82, 65, 77, 32]; // "RAM "
    const WRAM_SIZE                = 0x20000;

    let scriptHookArmed         = false;
    let activeScriptWatchpoints = [];
    let lastDebugStatus         = '';

    function readU16(w, off) { return (w[off] | (w[off + 1] << 8)) >>> 0; }
    function readU24(w, off) { return (w[off] | (w[off + 1] << 8) | (w[off + 2] << 16)) >>> 0; }
    function fmtHex(v, w)    { return (v >>> 0).toString(16).toUpperCase().padStart(w, '0'); }
    function fmtBreakpointAddr(v) {
      const raw = (v >>> 0);
      return raw > 0xFFFF ? fmtHex(raw, 6) : '7E' + fmtHex(raw, 4);
    }

    function setText(id, text, cls) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.className   = cls || '';
    }

    function setControlEnabled(id, enabled) {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    }

    // Module is always window.Module (set by the Emscripten core script).
    function getModule() {
      return window.Module && typeof Module._mainLoop === 'function' ? window.Module : null;
    }

    function hasDebuggerApi(m) {
      return !!m &&
        typeof m.getCPUState     === 'function' &&
        typeof m.readMemoryRange === 'function' &&
        typeof m.pauseEmulation  === 'function' &&
        typeof m.resumeEmulation === 'function';
    }

    function hasWriteBreakpointApi(m) {
      return hasDebuggerApi(m) &&
        typeof m.addWriteBreakpoint    === 'function' &&
        typeof m.removeWriteBreakpoint === 'function';
    }

    function reportDebugStatus(text) {
      if (text === lastDebugStatus) return;
      lastDebugStatus = text;
      vscodeApi.postMessage({ command: 'debugApiStatus', text });
    }

    /** Scan a snes9x save-state blob for the 128 KB WRAM block ("RAM " tag). */
    function parseWramFromState(raw) {
      const d = (raw instanceof Uint8Array) ? raw : new Uint8Array(raw);
      const limit = d.length - 8 - WRAM_SIZE;
      for (let i = 0; i < limit; i++) {
        if (d[i]   === RAM_TAG[0] && d[i+1] === RAM_TAG[1] &&
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

    /** Read script-stack region bytes via custom debugger API or save-state fallback. */
    function readScriptStackRegion() {
      const m = getModule();
      if (!m) return { mode: 'connecting', bytes: null };

      // Preferred: custom debugger API (only available in custom-built core).
      if (hasDebuggerApi(m)) {
        return {
          mode: 'custom-debugger',
          bytes: m.readMemoryRange(SCRIPT_STACK_BUS_ADDR, SCRIPT_REGION_SIZE),
        };
      }

      // Fallback: read via save state.
      try {
        const size = m._getStateSaveSize();
        if (!size) return { mode: 'save-state-unavailable', bytes: null };
        const ptr  = m._saveState();
        if (!ptr)  return { mode: 'save-state-unavailable', bytes: null };
        // Copy bytes out of WASM heap before HEAPU8 might be reassigned.
        const copy = new Uint8Array(size);
        copy.set(new Uint8Array(HEAPU8.buffer, ptr, size));
        const wram = parseWramFromState(copy);
        if (!wram) return { mode: 'save-state-unavailable', bytes: null };
        return {
          mode: 'save-state',
          bytes: wram.subarray(SCRIPT_BASE, SCRIPT_BASE + SCRIPT_REGION_SIZE),
        };
      } catch (_) {
        return { mode: 'save-state-unavailable', bytes: null };
      }
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

    function updateScriptStack(region) {
      const tbody = document.getElementById('ss-tbody');
      if (!tbody) return;
      const parsedRows = buildScriptRows(region);
      let html = '';
      for (const { slot, loc, state, timer1, entity } of parsedRows) {
        const cls   = state === 2 ? 'exec' : state === 4 ? 'wait' : 'dead';
        const sname = state === 2 ? 'exec' : state === 4 ? 'wait' : state === 0 ? 'dead' : '0x' + state.toString(16);
        html += '<tr class="' + cls + '"><td>' + slot + '</td><td>' +
          fmtHex(loc, 6) + '</td><td>' + sname + '</td><td>' +
          fmtHex(entity, 4) + '</td><td>' + timer1 + '</td></tr>';
      }
      if (!html) html = '<tr><td colspan="5" style="color:#555;text-align:center;padding:6px">no active scripts</td></tr>';
      tbody.innerHTML = html;
      document.getElementById('ss-count').textContent = parsedRows.length + ' active';
    }

    function disarmScriptStackHook(m) {
      if (m && typeof m.removeWriteBreakpoint === 'function')
        for (const addr of activeScriptWatchpoints) m.removeWriteBreakpoint(addr);
      activeScriptWatchpoints = [];
      scriptHookArmed = false;
      setText('ss-break-status', 'hook: off', 'ss-warn');
      const btn = document.getElementById('ss-hook-btn');
      if (btn) btn.textContent = 'arm stack hook';
    }

    function armScriptStackHook(m) {
      if (!hasWriteBreakpointApi(m)) return false;
      disarmScriptStackHook(m);
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const base = SCRIPT_STACK_BUS_ADDR + slot * SLOT_SIZE;
        for (const offset of SCRIPT_BREAK_WATCH_OFFSETS) activeScriptWatchpoints.push(base + offset);
      }
      for (const addr of activeScriptWatchpoints) m.addWriteBreakpoint(addr);
      scriptHookArmed = true;
      setText('ss-break-status', 'hook: armed (' + activeScriptWatchpoints.length + ')', 'ss-ok');
      const btn = document.getElementById('ss-hook-btn');
      if (btn) btn.textContent = 'disarm stack hook';
      return true;
    }

    function installDebuggerBridge(m) {
      if (!hasDebuggerApi(m) || m.__everscriptBridgeInstalled) return;
      m.__everscriptBridgeInstalled = true;
      m.onBreakpointHit = function(event) {
        const addrText = fmtBreakpointAddr(event.address);
        setText('ss-last-hit', 'last: ' + event.type + ' @ ' + addrText + ' pc ' + fmtHex(event.pc, 6), 'ss-bad');
        setText('ss-pause-state', 'paused', 'ss-bad');
        vscodeApi.postMessage({ command: 'debugBreakpointHit',
          type: event.type, address: addrText, pc: fmtHex(event.pc, 6) });
      };
    }

    function refreshDebuggerUi(m, sourceMode) {
      const customApi = hasDebuggerApi(m);
      const writeApi  = hasWriteBreakpointApi(m);
      if (customApi) {
        const cpu = m.getCPUState();
        setText('ss-api-status', 'api: custom debugger', 'ss-ok');
        setText('ss-cpu-status',
          'pc: ' + fmtHex(cpu.pc, 6) + ' pb:' + fmtHex(cpu.pb, 2) + ' a:' + fmtHex(cpu.a, 4), 'ss-ok');
        reportDebugStatus('Custom debugger API active (' + sourceMode + ') pc=' + fmtHex(cpu.pc, 6));
      } else {
        const label = sourceMode === 'save-state'      ? 'save-state fallback'
                    : sourceMode === 'connecting'       ? 'connecting...'
                    :                                     'unavailable';
        setText('ss-api-status', 'api: ' + label, sourceMode === 'save-state' ? 'ss-warn' : '');
        setText('ss-cpu-status', 'pc: ------');
        reportDebugStatus(sourceMode === 'save-state'
          ? 'Using save-state fallback for script stack'
          : 'Custom debugger API not available in this build');
      }
      setControlEnabled('ss-pause-btn',  customApi);
      setControlEnabled('ss-resume-btn', customApi);
      setControlEnabled('ss-hook-btn',   writeApi);
      if (!writeApi) {
        disarmScriptStackHook(m);
        setText('ss-break-status', 'hook: unavailable', 'ss-warn');
      }
    }

    /** Start the WRAM polling cycle (called once ROM loads). */
    function startWramPolling() {
      document.getElementById('ss-count').textContent = 'connecting...';

      function pollOnce() {
        try {
          const m = getModule();
          if (!m) return;
          installDebuggerBridge(m);
          const src = readScriptStackRegion();
          refreshDebuggerUi(m, src.mode);
          if (src.bytes) {
            updateScriptStack(src.bytes);
            vscodeApi.postMessage({ command: 'wramDelta', offset: SCRIPT_BASE, data: Array.from(src.bytes) });
          } else {
            document.getElementById('ss-count').textContent =
              src.mode === 'connecting' ? 'connecting...' : 'unavailable';
          }
        } catch (_) { /* silently skip on error */ }
      }

      setInterval(pollOnce, 250);
    }

    // ── Script stack controls ─────────────────────────────────────────────────
    document.getElementById('ss-pause-btn').addEventListener('click', () => {
      const m = getModule();
      if (!hasDebuggerApi(m)) return;
      m.pauseEmulation();
      setText('ss-pause-state', 'paused', 'ss-bad');
      setText('ss-last-hit', 'last: manual pause', 'ss-warn');
    });

    document.getElementById('ss-resume-btn').addEventListener('click', () => {
      const m = getModule();
      if (!hasDebuggerApi(m)) return;
      m.resumeEmulation();
      setText('ss-pause-state', 'running', 'ss-ok');
    });

    document.getElementById('ss-hook-btn').addEventListener('click', () => {
      const m = getModule();
      if (!hasWriteBreakpointApi(m)) return;
      if (scriptHookArmed) disarmScriptStackHook(m);
      else armScriptStackHook(m);
    });
  </script>

  <!-- snes9x2005-wasm Emscripten output.
       Sets global Module (merging with the stub above), HEAPU8, and all _exports. -->
  <script src="${coreJsUri}"></script>
</body>
</html>`;
}

module.exports = { openEmulatorPanel, sendRomFile: _sendRomFile };
