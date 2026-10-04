'use strict';

/**
 * debugger/emulator/panel-webview.js
 *
 * Owns: the emulator webview HTML template.
 * Single export: buildHtml(webview, coreJsUri, coreWasmUri, coreLabel, corePathDisplay) -> string
 */

function _nonce() {
    let n = '';
    const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) n += ch[Math.floor(Math.random() * ch.length)];
    return n;
}


// -----------------------------------------------------------------------------
//  HTML template
// -----------------------------------------------------------------------------

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
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%; background: #000; overflow: hidden;
      display: flex; flex-direction: column; font-family: monospace;
    }
    /* -- Screen -------------------------------------------------------- */
    #screen-wrap {
      flex: 1; min-height: 0; background: #000;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    #screen {
      display: block;
      width: 512px; height: 448px;
      image-rendering: pixelated; image-rendering: crisp-edges;
    }
    /* -- ROM picker overlay --------------------------------------------- */
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
    /* -- Resizer & Script stack panel ----------------------------------- */
    #ss-resizer {
      height: 5px; background: #222; cursor: row-resize; flex-shrink: 0;
      border-top: 1px solid #333; border-bottom: 1px solid #111;
      transition: background 0.15s;
    }
    #ss-resizer:hover, #ss-resizer.dragging { background: #007acc; }

    #script-stack {
      height: 240px; min-height: 28px; max-height: 80vh;
      background: #0d0d0d; border-top: 1px solid #333;
      font-size: 11px; display: none; flex-direction: column; overflow: hidden;
    }
    #script-stack.visible { display: flex; }
    #script-stack.collapsed {
      height: 28px !important; min-height: 28px !important; overflow: hidden !important;
    }
    #script-stack.collapsed > :not(#ss-header) {
      display: none !important;
    }
    #ss-header {
      position: sticky; top: 0;
      background: #1a1a1a; padding: 3px 8px;
      color: #aaa; font-size: 10px; letter-spacing: 0.05em;
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid #333; flex-shrink: 0;
    }
    #ss-tabs { display: flex; gap: 4px; align-items: center; }
    .ss-tab {
      border: 1px solid #333; background: #141414; color: #888;
      padding: 3px 8px; border-radius: 3px; font-size: 10px; cursor: pointer;
      font-family: inherit; font-weight: bold;
    }
    .ss-tab:hover { background: #222; color: #ccc; }
    .ss-tab.active { background: #007acc; color: #fff; border-color: #007acc; }
    #ss-controls { display: flex; gap: 6px; align-items: center; }

    .ss-tab-view { display: none; flex: 1; min-height: 0; flex-direction: column; overflow: hidden; }
    .ss-tab-view.active { display: flex; }

    #ss-trace-header {
      background: #121212; border-bottom: 1px solid #1d1d1d;
      padding: 4px 8px; display: flex; justify-content: space-between; align-items: center;
      font-size: 10px; color: #888; flex-shrink: 0;
    }
    #ss-trace-controls { display: flex; gap: 6px; align-items: center; }
    #ss-trace-controls label { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: #888; cursor: pointer; user-select: none; }
    #ss-trace-log {
      flex: 1; min-height: 0; background: #0c0c0c; padding: 4px 8px;
      font-family: monospace; font-size: 11px; line-height: 1.45;
      overflow-y: auto; overflow-x: hidden;
    }
    #ss-trace-log.hide-inactive .ss-trace-entry.end { display: none !important; }
    .ss-trace-entry { display: flex; flex-direction: column; padding: 1px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
    .ss-trace-row { display: flex; gap: 6px; white-space: nowrap; padding: 1px 0; }
    .ss-trace-sub { display: flex; gap: 4px; white-space: nowrap; padding: 1px 0; font-family: monospace; font-size: 11px; }
    .ss-trace-arrow { color: #c586c0; font-weight: bold; }
    .ss-trace-time { color: #569cd6; font-size: 10px; min-width: 95px; }
    .ss-trace-lookup { color: #4ec9b0; font-weight: bold; }
    .ss-trace-tag { font-weight: bold; min-width: 120px; }
    .ss-trace-tag.start  { color: #6f9; }
    .ss-trace-tag.resume { color: #ff6; }
    .ss-trace-tag.step   { color: #69f; }
    .ss-trace-tag.end    { color: #f66; }
    .ss-trace-addr       { color: #4ec9b0; }
    .ss-trace-bytes      { color: #888; font-size: 10px; font-family: monospace; }
    .ss-trace-text       { color: #d4d4d4; }

    #ss-view-stack { overflow-y: auto; }
    #ss-view-debug { overflow-y: auto; }
    .ss-btn            { border: 1px solid #444; background: #181818; color: #ccc; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer; }
    .ss-btn:hover      { background: #222; }
    .ss-btn:disabled   { opacity: 0.45; cursor: default; }
    #ss-core-row       { background: #0e0e0e; border-bottom: 1px solid #1e1e1e; padding: 2px 8px; display: flex; gap: 8px; align-items: center; color: #555; font-size: 10px; overflow: hidden; flex-shrink: 0; }
    #ss-core-label     { color: #444; flex-shrink: 0; }
    #ss-core-name      { color: #7a9a7a; flex-shrink: 0; }
    #ss-core-path      { color: #4a4a4a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    #ss-meta           { background: #141414; border-bottom: 1px solid #222; padding: 4px 8px; display: flex; gap: 12px; flex-wrap: wrap; color: #777; font-size: 10px; flex-shrink: 0; }
    #ss-breakpoints    { background: #121212; border-bottom: 1px solid #1d1d1d; padding: 6px 8px; display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
    #ss-bp-controls    { display: flex; gap: 6px; align-items: center; }
    #ss-bp-input       { width: 108px; background: #0e0e0e; border: 1px solid #333; color: #ddd; padding: 3px 5px; border-radius: 3px; font: inherit; }
    #ss-bp-input::placeholder { color: #555; }
    #ss-bp-list        { display: flex; gap: 6px; flex-wrap: wrap; min-height: 20px; }
    .ss-bp-chip        { display: inline-flex; align-items: center; gap: 6px; padding: 2px 6px; border: 1px solid #2d4b2d; border-radius: 999px; background: rgba(122, 214, 122, 0.08); color: #b8ddb8; }
    .ss-bp-chip button { border: none; background: transparent; color: #888; cursor: pointer; font: inherit; line-height: 1; }
    .ss-bp-chip button:hover { color: #ddd; }
    .ss-bp-empty       { color: #555; }
    .ss-ok   { color: #7ad67a; }
    .ss-warn { color: #d9c36a; }
    .ss-bad  { color: #d98383; }
    #ss-detail             { background: #101010; border-bottom: 1px solid #1d1d1d; padding: 6px 8px; color: #8b8b8b; font-size: 10px; white-space: pre-wrap; font-family: monospace; line-height: 1.35; flex-shrink: 0; }
    #ss-table              { width: 100%; border-collapse: collapse; }
    #ss-table th           { text-align: left; padding: 2px 6px; color: #666; font-weight: normal; font-size: 10px; position: sticky; top: 0; background: #111; border-bottom: 1px solid #222; }
    #ss-table td           { padding: 1px 6px; color: #ccc; }
    #ss-table tr.exec td   { color: #6f6; }
    #ss-table tr.wait td   { color: #ff6; }
    #ss-table tr.dead td   { color: #633; }
    #ss-table tr.focus td  { background: rgba(122, 214, 122, 0.08); }
    .sx-kw                 { color: #569cd6; font-weight: bold; }
    .sx-num                { color: #b5cea8; }
    .sx-str                { color: #ce9178; }
    .sx-aside              { color: #777; }
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

  <div id="ss-resizer" title="Drag to resize panel"></div>

  <div id="script-stack">
    <div id="ss-header">
      <div id="ss-tabs">
        <button id="ss-tab-trace" class="ss-tab active" type="button">SCRIPT TRACE (<span id="ss-tab-trace-count">0</span>)</button>
        <button id="ss-tab-stack" class="ss-tab" type="button">SCRIPT STACK (<span id="ss-count">waiting...</span>)</button>
        <button id="ss-tab-debug" class="ss-tab" type="button">DEBUGGER &amp; HOOKS</button>
      </div>
      <div id="ss-controls">
        <button id="ss-pause-btn"  class="ss-btn" disabled>pause</button>
        <button id="ss-resume-btn" class="ss-btn" disabled>resume</button>
        <button id="ss-toggle-btn" class="ss-btn">hide panel</button>
      </div>
    </div>

    <!-- Tab 1: Script Trace Log (Active by default) -->
    <div id="ss-view-trace" class="ss-tab-view active">
      <div id="ss-trace-header">
        <div id="ss-trace-controls">
          <button id="ss-trace-clear-btn" class="ss-btn" type="button">clear</button>
          <button id="ss-trace-copy-btn" class="ss-btn" type="button">copy</button>
          <label id="ss-trace-scroll-label"><input type="checkbox" id="ss-trace-scroll" checked /> auto-scroll</label>
          <label id="ss-trace-hide-inactive-label"><input type="checkbox" id="ss-trace-hide-inactive" /> hide inactive</label>
        </div>
        <span id="ss-trace-count">0 lines</span>
      </div>
      <div id="ss-trace-log"></div>
    </div>

    <!-- Tab 2: Script Stack live slot table -->
    <div id="ss-view-stack" class="ss-tab-view">
      <div id="ss-detail">waiting for script stack detail...</div>
      <table id="ss-table">
        <thead><tr><th>#</th><th>PC</th><th>state</th><th>next</th><th>entity</th><th>timer</th></tr></thead>
        <tbody id="ss-tbody"></tbody>
      </table>
    </div>

    <!-- Tab 3: Debugger & Breakpoints -->
    <div id="ss-view-debug" class="ss-tab-view">
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
        <span id="ss-exec-break-status">script bp: unavailable</span>
        <span id="ss-debug-link-status">dbg: disconnected</span>
        <span id="ss-last-hit">last: -</span>
      </div>
      <div style="background:#141414;padding:4px 8px;display:flex;gap:6px;border-bottom:1px solid #222;">
        <button id="ss-hook-btn" class="ss-btn" disabled>arm stack hook</button>
        <button id="ss-hook-all-btn" class="ss-btn" disabled>break all hooks</button>
        <button id="ss-debug-link-btn" class="ss-btn">connect dbg</button>
      </div>
      <div id="ss-breakpoints">
        <div id="ss-bp-controls">
          <span>manual script breakpoints</span>
          <input id="ss-bp-input" type="text" placeholder="94E5FB / 0x94E5FB" spellcheck="false" />
          <button id="ss-bp-add-btn" class="ss-btn" disabled>add</button>
        </div>
        <div id="ss-bp-list"><span class="ss-bp-empty">no manual script breakpoints</span></div>
      </div>
    </div>
  </div>

  <!-- Module object must be declared before the core script loads. -->
  <script>
    // -- Boot: register error handlers BEFORE acquiring vscode API so any
    //    init failure is captured.  'var' lets onerror reference the variable
    //    before the assignment below runs.
    var vscodeApi; // eslint-disable-line no-var

    window.onerror = function(msg, src, line) {
      console.error('[EVS webview]', msg, src || '', line || '');
      if (vscodeApi) vscodeApi.postMessage({ command: 'ejsError',
        error: msg + (src ? ' [' + src.split('/').pop() + ':' + line + ']' : '') });
    };
    window.addEventListener('unhandledrejection', function(evt) {
      var r = evt.reason instanceof Error ? evt.reason.message : String(evt.reason || 'unhandledrejection');
      console.error('[EVS webview rejection]', r);
      if (vscodeApi) vscodeApi.postMessage({ command: 'ejsError', error: r });
    });
    document.addEventListener('securitypolicyviolation', function(evt) {
      console.error('[EVS CSP violation]', evt.blockedURI, evt.violatedDirective);
      if (vscodeApi) vscodeApi.postMessage({ command: 'ejsError',
        error: 'CSP: ' + evt.blockedURI + ' blocked by ' + evt.violatedDirective });
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

    function romStage(text) {
      console.log('[EVS romStage]', text);
      if (vscodeApi) vscodeApi.postMessage({ command: 'romLoadLog', text });
    }

    // -- Module stub (set before core script tag, so onRuntimeInitialized fires) -
    var Module = {
      locateFile: function(filename) {
        // Route the WASM request to the webview-accessible URI.
        if (typeof filename === 'string' && filename.endsWith('.wasm')) return '${coreWasmUri}';
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
        if (vscodeApi) vscodeApi.postMessage({ command: 'ejsError', error: 'Core aborted: ' + msg });
      }
    };

    function loadCoreScript() {
      const script = document.createElement('script');
      script.src = '${coreJsUri}';
      script.onload = function() {
        romStage('core script loaded');
      };
      script.onerror = function() {
        if (vscodeApi) vscodeApi.postMessage({ command: 'ejsError', error: 'Failed to load core script: ${coreJsUri}' });
      };
      document.body.appendChild(script);
    }

    // -- ROM picker ------------------------------------------------------------
    document.getElementById('pickBtn').addEventListener('click', () => {
      initAudio();
      ensureAudioRunning();
      vscodeApi.postMessage({ command: 'pickRom' });
      document.getElementById('load-status').textContent = 'Waiting for file picker...';
    });

    window.addEventListener('message', evt => {
      if (evt.data.command === 'hostStatus') {
        const el = document.getElementById('load-status');
        if (!el) return;
        const level = evt.data.level || 'info';
        el.textContent = evt.data.text || '';
        el.style.color =
          level === 'error'
            ? '#ff8c8c'
            : (level === 'ok' ? '#7ad67a' : '#c8c8c8');
        return;
      }
      if (evt.data.command === 'loadRom') {
        romStage('loadRom received: ' + (evt.data.name || 'game'));
        startWithRom(evt.data.dataUrl, evt.data.name);
      }
    });

    // -- Audio -----------------------------------------------------------------
    // ScriptProcessorNode reading directly from the core's exported Float32 planar
    // buffer. snes9x2005-wasm exposes 2048 samples for left followed by 2048 for right.
    const AUDIO_FREQ      = 44100;
    const AUDIO_BLOCK_SIZE = 2048;

    let audioCtx  = null;
    let audioNode = null;
    let audioResumeHandlersInstalled = false;

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
        audioNode = audioCtx.createScriptProcessor(AUDIO_BLOCK_SIZE, 0, 2);
        audioNode.onaudioprocess = function(e) {
          const L = e.outputBuffer.getChannelData(0);
          const R = e.outputBuffer.getChannelData(1);
          const m = getModule();
          if (!romLoaded || !m || typeof m._getSoundBuffer !== 'function') {
            L.fill(0);
            R.fill(0);
            return;
          }
          try {
            const ptr = m._getSoundBuffer();
            if (!ptr) {
              L.fill(0);
              R.fill(0);
              return;
            }
            const samples = new Float32Array(HEAPF32.buffer, ptr, AUDIO_BLOCK_SIZE * 2);
            for (let i = 0; i < AUDIO_BLOCK_SIZE; i++) {
              L[i] = samples[i];
              R[i] = samples[i + AUDIO_BLOCK_SIZE];
            }
          } catch (_) {
            L.fill(0);
            R.fill(0);
          }
        };
        audioNode.connect(audioCtx.destination);
        ensureAudioRunning();
      } catch (err) {
        vscodeApi.postMessage({ command: 'ejsError', error: 'Audio init failed: ' + err.message });
      }
    }

    // -- Input -----------------------------------------------------------------
    // Button bitmask positions:
    //   R=4, L=5, X=6, A=7, RIGHT=8, LEFT=9, DOWN=10, UP=11,
    //   START=12, SELECT=13, Y=14, B=15
    // TODO: Make keybindings configurable via VS Code settings (\`everscript.emulatorKeybindings\`)
    // and provide an in-webview interactive controller remapping dialog.
    const KEY_MAP = {
      'ArrowRight': 1 << 8,  'ArrowLeft': 1 << 9,
      'ArrowDown':  1 << 10, 'ArrowUp':   1 << 11,
      'Enter':      1 << 12, ' ':         1 << 13,
      'v': 1 << 7,  'V': 1 << 7,   // A
      'c': 1 << 15, 'C': 1 << 15,  // B
      'd': 1 << 6,  'D': 1 << 6,   // X
      'x': 1 << 14, 'X': 1 << 14,  // Y
      'a': 1 << 5,  'A': 1 << 5,   // L
      's': 1 << 4,  'S': 1 << 4,   // R
    };
    let keyInput = 0;
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const m = getModule();
        if (m && hasDebuggerApi(m)) {
          const pauseEl = document.getElementById('ss-pause-state');
          const isPaused = pauseEl && pauseEl.textContent.trim() === 'paused';
          if (isPaused) {
            m.resumeEmulation();
            setText('ss-pause-state', 'running', 'ss-ok');
            setText('ss-last-hit', 'last: resumed via Escape', 'ss-ok');
          } else {
            m.pauseEmulation();
            setText('ss-pause-state', 'paused', 'ss-bad');
            setText('ss-last-hit', 'last: paused via Escape', 'ss-warn');
          }
          e.preventDefault();
          return;
        }
      }
      if (e.repeat) return;
      const bit = KEY_MAP[e.key];
      if (bit) { keyInput |= bit; e.preventDefault(); }
    });
    document.addEventListener('keyup', e => {
      const bit = KEY_MAP[e.key];
      if (bit) keyInput &= ~bit;
    });

    // -- ROM loading -----------------------------------------------------------
    let romLoaded = false;
    let romLaunchTimestamp = 0;
    let romFrameCount = 0;

    function startWithRom(dataUrl, name) {
      try {
        romStage('decode begin: ' + (name || 'game'));
        const comma   = dataUrl.indexOf(',');
        const binStr  = atob(dataUrl.slice(comma + 1));
        const romData = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) romData[i] = binStr.charCodeAt(i);
        romStage('decode complete: ' + romData.length + ' bytes');

        romStage('core start begin');
        const ptr = Module._my_malloc(romData.length);
        HEAPU8.set(romData, ptr);
        Module._startWithRom(ptr, romData.length, AUDIO_FREQ);
        Module._my_free(ptr);
        romStage('core start complete');

        romLoaded = true;
        romLaunchTimestamp = performance.now();
        romFrameCount = 0;
        initAudio();
        ensureAudioRunning();
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('script-stack').classList.add('visible');
        window.dispatchEvent(new Event('resize'));
        startWramPolling();
        vscodeApi.postMessage({ command: 'gameStarted', name: name || 'game' });
        romStage('launch success: ' + (name || 'game'));
      } catch (e) {
        romStage('launch failed: ' + e.message);
        vscodeApi.postMessage({ command: 'ejsError', error: 'ROM load failed: ' + e.message });
        document.getElementById('load-status').textContent = 'Error: ' + e.message;
      }
    }

    // -- Render loop -----------------------------------------------------------
    function startRenderLoop() {
      const canvas    = document.getElementById('screen');
      const wrap      = document.getElementById('screen-wrap');
      const ctx       = canvas.getContext('2d');
      const imageData = ctx.createImageData(512, 448);
      canvas.setAttribute('tabindex', '0');
      canvas.addEventListener('click', () => {
        canvas.focus();
        keyInput |= (1 << 15);
        setTimeout(() => {
          keyInput &= ~(1 << 15);
        }, 120);
      });
      let lastWrapWidth = -1;
      let lastWrapHeight = -1;

      // Scale the fixed-size 512x448 canvas to the largest size that fits the panel.
      function resizeCanvas(force) {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!force && W === lastWrapWidth && H === lastWrapHeight) return;
        lastWrapWidth = W;
        lastWrapHeight = H;
        if (!W || !H) return;
        const scale = Math.max(Math.min(W / 512, H / 448), 0.01);
        canvas.style.width = (512 * scale) + 'px';
        canvas.style.height = (448 * scale) + 'px';
      }
      if (window.ResizeObserver) new ResizeObserver(() => resizeCanvas(true)).observe(wrap);
      window.addEventListener('resize', () => resizeCanvas(true));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resizeCanvas(true);
      });
      resizeCanvas(true);

      let lastFrameTimestamp = performance.now();
      const FRAME_INTERVAL_MS = 1000 / 60; // 16.666 ms

      function frame(timestamp) {
        requestAnimationFrame(frame);
        if (!timestamp) timestamp = performance.now();
        const elapsed = timestamp - lastFrameTimestamp;
        if (elapsed < FRAME_INTERVAL_MS - 2.0) return;
        lastFrameTimestamp = timestamp - (elapsed % FRAME_INTERVAL_MS);

        resizeCanvas(false);
        if (romLoaded) {
          romFrameCount++;
          Module._setJoypadInput(keyInput);
          Module._mainLoop();
          const fbPtr = Module._getScreenBuffer();
          if (fbPtr) {
            imageData.data.set(new Uint8ClampedArray(HEAPU8.buffer, fbPtr, 512 * 448 * 4));
            ctx.putImageData(imageData, 0, 0);
          }
          checkScriptExecutionTrace();
        }
      }
      requestAnimationFrame(frame);
    }

    // -- WRAM / Script stack ---------------------------------------------------
    const SCRIPT_BASE              = 0x28FC;
    const SLOT_SIZE                = 0x4F;
    const SLOT_COUNT               = 20;
    const SCRIPT_REGION_SIZE       = SLOT_SIZE * SLOT_COUNT;
    const SCRIPT_STACK_BUS_ADDR    = 0x7E0000 + SCRIPT_BASE;
    const SCRIPT_ARG_OFFSET        = 0x0F;
    const SCRIPT_ARG_BYTES         = 0x20;
    const SCRIPT_BREAK_WATCH_OFFSETS = [0x00, 0x03, 0x0D];
    const RAM_TAG                  = [82, 65, 77, 32]; // "RAM "
    const WRAM_SIZE                = 0x20000;

    let scriptHookArmed         = false;
    let breakOnObservedHookWrites = false;
    let activeScriptWatchpoints = [];
    let previousScriptRegion    = null;
    let lastDebugStatus         = '';
    let manualScriptBreakpoints = [];
    let lastFocusedScriptLoc    = '';
    let lastTriggeredScriptLoc  = 0;

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

    function slotPtrToIndex(ptr) {
      const raw = ptr >>> 0;
      const delta = raw - SCRIPT_BASE;
      if (!raw || delta < 0 || delta >= SCRIPT_REGION_SIZE || (delta % SLOT_SIZE) !== 0) return -1;
      return delta / SLOT_SIZE;
    }

    function stateName(state) {
      return state === 2 ? 'exec' : state === 4 ? 'wait' : state === 0 ? 'dead' : '0x' + state.toString(16);
    }

    function slotShort(slot) {
      return 's' + slot.slot + '@' + fmtHex(slot.loc, 6) + '(' + stateName(slot.state) + ')';
    }

    function formatArgWords(words) {
      return words.map((value, index) => 'w' + index.toString(16).toUpperCase() + '=' + fmtHex(value, 4)).join(' ');
    }

    function formatArgBytes(bytes) {
      return bytes.map(value => fmtHex(value, 2)).join(' ');
    }

    function buildScriptChains(slots) {
      const liveSlots = slots.filter(slot => slot.live);
      const bySlot = new Map(liveSlots.map(slot => [slot.slot, slot]));
      const targeted = new Set();
      for (const slot of liveSlots) if (slot.nextSlot >= 0) targeted.add(slot.nextSlot);
      const heads = liveSlots.filter(slot => !targeted.has(slot.slot));
      const visited = new Set();
      const chains = [];
      const sources = heads.length ? heads : liveSlots;
      for (const head of sources) {
        if (visited.has(head.slot)) continue;
        const chain = [];
        let current = head;
        while (current && !visited.has(current.slot)) {
          visited.add(current.slot);
          chain.push(current.slot);
          current = current.nextSlot >= 0 ? bySlot.get(current.nextSlot) || null : null;
        }
        if (chain.length) chains.push(chain);
      }
      return chains;
    }

    function buildScriptSnapshot(region) {
      const slots = [];
      for (let i = 0; i < SLOT_COUNT; i++) {
        const base = i * SLOT_SIZE;
        if (base + SLOT_SIZE > region.length) break;
        const loc = readU24(region, base + 0x00);
        const state = readU16(region, base + 0x03);
        const timer1 = readU16(region, base + 0x05);
        const nextPtr = readU16(region, base + 0x0B);
        const entity = readU16(region, base + 0x0D);
        const argsBytes = Array.from(region.subarray(base + SCRIPT_ARG_OFFSET, base + SCRIPT_ARG_OFFSET + SCRIPT_ARG_BYTES));
        const argWords = [];
        for (let offset = 0; offset < argsBytes.length; offset += 2) {
          argWords.push(((argsBytes[offset] || 0) | ((argsBytes[offset + 1] || 0) << 8)) >>> 0);
        }
        const live = loc !== 0 || state !== 0 || entity !== 0 || nextPtr !== 0;
        slots.push({
          slot: i,
          loc,
          state,
          timer1,
          nextPtr,
          nextSlot: slotPtrToIndex(nextPtr),
          entity,
          argsBytes,
          argWords,
          live,
        });
      }
      const liveSlots = slots.filter(slot => slot.live);
      const activeSlots = liveSlots.filter(slot => slot.state === 2);
      return { slots, liveSlots, activeSlots, chains: buildScriptChains(slots) };
    }

    function renderScriptDetail(snapshot) {
      const detail = document.getElementById('ss-detail');
      if (!detail) return;
      const focus = snapshot.activeSlots[0] || snapshot.liveSlots[0] || null;
      const execText = snapshot.activeSlots.length
        ? snapshot.activeSlots.map(slotShort).join(' -> ')
        : 'none';
      const currentText = snapshot.activeSlots.length === 1
        ? slotShort(snapshot.activeSlots[0])
        : snapshot.activeSlots.length > 1
          ? 'ambiguous (' + snapshot.activeSlots.map(slot => 's' + slot.slot).join(', ') + ')'
          : 'none';
      const chainText = snapshot.chains.length
        ? snapshot.chains.map(chain => chain.map(slotId => 's' + slotId).join(' -> ')).join(' | ')
        : 'none';
      const lines = [];
      lines.push('exec slots: ' + execText);
      lines.push('current active: ' + currentText + ' (state==2; not always the bottom slot)');
      lines.push('scheduler chain: ' + chainText);
      if (focus) {
        lines.push('focus slot: ' + slotShort(focus) + ' next=' + (focus.nextSlot >= 0 ? ('s' + focus.nextSlot) : '--') + ' entity=' + fmtHex(focus.entity, 4));
        lines.push('args[0x0F..0x2E] words: ' + formatArgWords(focus.argWords));
        lines.push('args[0x0F..0x2E] bytes: ' + formatArgBytes(focus.argsBytes));
      } else {
        lines.push('focus slot: none');
        lines.push('args[0x0F..0x2E] words: none');
        lines.push('args[0x0F..0x2E] bytes: none');
      }
      detail.textContent = lines.join('\\n');
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

    function renderManualExecBreakpoints() {
      const list = document.getElementById('ss-bp-list');
      if (!list) return;
      if (!manualScriptBreakpoints.length) {
        list.innerHTML = '<span class="ss-bp-empty">no manual script breakpoints</span>';
        return;
      }
      list.innerHTML = manualScriptBreakpoints.map(addr =>
        '<span class="ss-bp-chip">' + fmtBreakpointAddr(addr) +
        ' <button type="button" data-remove-exec-bp="' + addr + '">x</button></span>'
      ).join('');
    }

    function updateExecBreakpointStatus(enabled) {
      const status = enabled
        ? (manualScriptBreakpoints.length ? 'script bp: ' + manualScriptBreakpoints.length + ' manual' : 'script bp: ready')
        : 'script bp: unavailable';
      setText('ss-exec-break-status', status, enabled ? (manualScriptBreakpoints.length ? 'ss-ok' : 'ss-warn') : 'ss-warn');
    }

    function parseExecBreakpointInput(raw) {
      const text = String(raw || '').trim().replace(/^\$/u, '0x');
      if (!text) return null;
      if (!/^(?:0x)?[0-9a-f]{1,6}$/i.test(text)) return null;
      return parseInt(text, 16) >>> 0;
    }

    function addManualExecBreakpoint(raw) {
      const addr = parseExecBreakpointInput(raw);
      if (addr == null) return false;
      if (manualScriptBreakpoints.includes(addr)) return true;
      manualScriptBreakpoints = manualScriptBreakpoints.concat([addr]).sort((a, b) => a - b);
      const m = getModule();
      renderManualExecBreakpoints();
      updateExecBreakpointStatus(hasDebuggerApi(m));
      setText('ss-last-hit', 'last: added script breakpoint @ ' + fmtBreakpointAddr(addr), 'ss-ok');
      return true;
    }

    function removeManualExecBreakpoint(addr) {
      const next = manualScriptBreakpoints.filter(value => value !== addr);
      if (next.length === manualScriptBreakpoints.length) return;
      manualScriptBreakpoints = next;
      renderManualExecBreakpoints();
      updateExecBreakpointStatus(hasDebuggerApi(getModule()));
      setText('ss-last-hit', 'last: removed script breakpoint @ ' + fmtBreakpointAddr(addr), 'ss-warn');
      if (lastTriggeredScriptLoc === (addr >>> 0)) lastTriggeredScriptLoc = 0;
    }

    function reportScriptFocus(snapshot) {
      const focus = snapshot.activeSlots[0] || snapshot.liveSlots[0] || null;
      const addr = focus && focus.loc ? fmtHex(focus.loc, 6) : '';
      if (addr === lastFocusedScriptLoc) return;
      lastFocusedScriptLoc = addr;
      vscodeApi.postMessage({
        command: 'scriptFocus',
        address: addr,
        slot: focus ? focus.slot : null,
        state: focus ? stateName(focus.state) : 'none',
      });
    }

    function checkManualScriptBreakpoints(snapshot, m) {
      if (!hasDebuggerApi(m) || !manualScriptBreakpoints.length || !snapshot.activeSlots.length) {
        if (!snapshot.liveSlots.some(slot => slot.loc === lastTriggeredScriptLoc)) lastTriggeredScriptLoc = 0;
        return;
      }
      const hit = snapshot.activeSlots.find(slot => manualScriptBreakpoints.includes(slot.loc >>> 0));
      if (!hit) {
        if (!snapshot.liveSlots.some(slot => slot.loc === lastTriggeredScriptLoc)) lastTriggeredScriptLoc = 0;
        return;
      }
      if (lastTriggeredScriptLoc === (hit.loc >>> 0)) return;
      lastTriggeredScriptLoc = hit.loc >>> 0;
      m.pauseEmulation();
      setText('ss-pause-state', 'paused', 'ss-bad');
      setText('ss-last-hit', 'last: byte script @ ' + fmtHex(hit.loc, 6) + ' slot s' + hit.slot, 'ss-bad');
      vscodeApi.postMessage({ command: 'byteScriptBreakpointHit', address: fmtHex(hit.loc, 6), slot: hit.slot });
    }

    function reportDebugStatus(text) {
      if (text === lastDebugStatus) return;
      lastDebugStatus = text;
      vscodeApi.postMessage({ command: 'debugApiStatus', text });
    }

    function reportHookStatus(text) {
      vscodeApi.postMessage({ command: 'debugHookStatus', text });
    }

    function reportHookObserved(text) {
      vscodeApi.postMessage({ command: 'debugHookObserved', text });
    }

    function reportHookBreak(text) {
      vscodeApi.postMessage({ command: 'debugHookBreak', text });
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

    function updateScriptStack(snapshot) {
      const tbody = document.getElementById('ss-tbody');
      if (!tbody) return;
      const focusSlot = snapshot.activeSlots.length ? snapshot.activeSlots[0].slot : -1;
      let html = '';
      for (const { slot, loc, state, nextSlot, timer1, entity } of snapshot.liveSlots) {
        const cls   = (state === 2 ? 'exec' : state === 4 ? 'wait' : 'dead') + (slot === focusSlot ? ' focus' : '');
        const sname = stateName(state);
        html += '<tr class="' + cls + '"><td>' + slot + '</td><td>' +
          fmtHex(loc, 6) + '</td><td>' + sname + '</td><td>' +
          (nextSlot >= 0 ? nextSlot : '--') + '</td><td>' +
          fmtHex(entity, 4) + '</td><td>' + timer1 + '</td></tr>';
      }
      if (!html) html = '<tr><td colspan="6" style="color:#555;text-align:center;padding:6px">no active scripts</td></tr>';
      tbody.innerHTML = html;
      document.getElementById('ss-count').textContent = snapshot.liveSlots.length + ' active';
      renderScriptDetail(snapshot);
    }

    function disarmScriptStackHook(m) {
      const wasArmed = scriptHookArmed || breakOnObservedHookWrites;
      if (m && typeof m.removeWriteBreakpoint === 'function')
        for (const addr of activeScriptWatchpoints) m.removeWriteBreakpoint(addr);
      activeScriptWatchpoints = [];
      previousScriptRegion = null;
      scriptHookArmed = false;
      breakOnObservedHookWrites = false;
      setText('ss-break-status', 'hook: off', 'ss-warn');
      const btn = document.getElementById('ss-hook-btn');
      if (btn) btn.textContent = 'arm stack hook';
      const allBtn = document.getElementById('ss-hook-all-btn');
      if (allBtn) allBtn.textContent = 'break all hooks';
      if (wasArmed) reportHookStatus('Script hook disarmed');
    }

    function armScriptStackHook(m) {
      if (!hasWriteBreakpointApi(m)) return false;
      disarmScriptStackHook(m);
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const base = SCRIPT_BASE + slot * SLOT_SIZE;
        for (const offset of SCRIPT_BREAK_WATCH_OFFSETS) activeScriptWatchpoints.push(base + offset);
      }
      for (const addr of activeScriptWatchpoints) m.addWriteBreakpoint(addr);
      scriptHookArmed = true;
      setText('ss-break-status', 'hook: armed (' + activeScriptWatchpoints.length + ')', 'ss-ok');
      const btn = document.getElementById('ss-hook-btn');
      if (btn) btn.textContent = 'disarm stack hook';
      reportHookStatus('Script hook armed with ' + activeScriptWatchpoints.length + ' WRAM offset watchpoints');
      return true;
    }

    function toggleBreakAllHooks() {
      breakOnObservedHookWrites = !breakOnObservedHookWrites;
      const btn = document.getElementById('ss-hook-all-btn');
      if (btn) btn.textContent = breakOnObservedHookWrites ? 'ignore hook writes' : 'break all hooks';
      setText('ss-break-status',
        breakOnObservedHookWrites ? 'hook: break on all observed writes' : (scriptHookArmed ? 'hook: armed (' + activeScriptWatchpoints.length + ')' : 'hook: off'),
        breakOnObservedHookWrites ? 'ss-bad' : (scriptHookArmed ? 'ss-ok' : 'ss-warn'));
      reportHookStatus(breakOnObservedHookWrites ? 'Break-all-hooks enabled' : 'Break-all-hooks disabled');
    }

    function traceHookActivity(region) {
      if (!scriptHookArmed || !region || region.length < SCRIPT_REGION_SIZE) {
        previousScriptRegion = region ? region.slice() : null;
        return;
      }
      if (!previousScriptRegion || previousScriptRegion.length !== region.length) {
        previousScriptRegion = region.slice();
        return;
      }
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const slotBase = slot * SLOT_SIZE;
        for (const offset of SCRIPT_BREAK_WATCH_OFFSETS) {
          const index = slotBase + offset;
          const before = previousScriptRegion[index];
          const after = region[index];
          if (before === after) continue;
          const addr = SCRIPT_BASE + slot * SLOT_SIZE + offset;
          const msg = 'Hook trace observed write @ 7E' + fmtHex(addr, 4) +
            ' slot=' + slot + ' off=0x' + fmtHex(offset, 2) +
            ' ' + fmtHex(before, 2) + '->' + fmtHex(after, 2);
          setText('ss-last-hit', 'last: ' + msg, breakOnObservedHookWrites ? 'ss-bad' : 'ss-warn');
          reportHookObserved(msg);
          if (breakOnObservedHookWrites) {
            const m = getModule();
            if (hasDebuggerApi(m)) m.pauseEmulation();
            setText('ss-pause-state', 'paused', 'ss-bad');
            reportHookBreak(msg + ' [paused by break-all-hooks]');
          }
          previousScriptRegion = region.slice();
          return;
        }
      }
      previousScriptRegion = region.slice();
    }

    function installDebuggerBridge(m) {
      if (!hasDebuggerApi(m) || m.__everscriptBridgeInstalled) return;
      m.__everscriptBridgeInstalled = true;
      reportHookStatus('Debugger bridge installed; waiting for breakpoint events');
      m.onBreakpointHit = function(event) {
        const addrText = event.type === 'write'
          ? '7E' + fmtHex(event.address, 4)
          : fmtBreakpointAddr(event.address);
        const details = event.type === 'write' ? ' value ' + fmtHex(event.value || 0, 2) : '';
        setText('ss-last-hit', 'last: ' + event.type + ' @ ' + addrText + details + ' pc ' + fmtHex(event.pc, 6), 'ss-bad');
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
        reportDebugStatus('Custom debugger API active (' + sourceMode + ')');
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
      setControlEnabled('ss-hook-all-btn', customApi);
      setControlEnabled('ss-bp-add-btn', customApi);
      const bpInput = document.getElementById('ss-bp-input');
      if (bpInput) bpInput.disabled = !customApi;
      updateExecBreakpointStatus(customApi);
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
            traceHookActivity(src.bytes);
            const snapshot = buildScriptSnapshot(src.bytes);
            updateScriptStack(snapshot);
            reportScriptFocus(snapshot);
            checkManualScriptBreakpoints(snapshot, m);
            checkScriptExecutionTrace();
            vscodeApi.postMessage({ command: 'wramDelta', offset: SCRIPT_BASE, data: Array.from(src.bytes) });
          } else {
            document.getElementById('ss-count').textContent =
              src.mode === 'connecting' ? 'connecting...' : 'unavailable';
          }
        } catch (_) { /* silently skip on error */ }
      }

      setInterval(pollOnce, 250);
    }

    // -- Script stack controls -------------------------------------------------
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

    document.getElementById('ss-hook-all-btn').addEventListener('click', () => {
      const m = getModule();
      if (!hasDebuggerApi(m)) return;
      if (!scriptHookArmed && hasWriteBreakpointApi(m)) armScriptStackHook(m);
      toggleBreakAllHooks();
    });

    document.getElementById('ss-debug-link-btn').addEventListener('click', () => {
      vscodeApi.postMessage({ command: 'connectDebugger' });
    });

    const toggleStackBtn = document.getElementById('ss-toggle-btn');
    if (toggleStackBtn) {
      toggleStackBtn.addEventListener('click', () => {
        const stack = document.getElementById('script-stack');
        stack.classList.toggle('collapsed');
        const isCollapsed = stack.classList.contains('collapsed');
        toggleStackBtn.textContent = isCollapsed ? 'show panel' : 'hide panel';
        window.dispatchEvent(new Event('resize'));
      });
    }

    function selectTab(tabName) {
      const tabs = ['trace', 'stack', 'debug'];
      for (const t of tabs) {
        const btn = document.getElementById('ss-tab-' + t);
        const view = document.getElementById('ss-view-' + t);
        if (btn) btn.classList.toggle('active', t === tabName);
        if (view) view.classList.toggle('active', t === tabName);
      }
    }
    const tabTraceBtn = document.getElementById('ss-tab-trace');
    if (tabTraceBtn) tabTraceBtn.addEventListener('click', () => selectTab('trace'));
    const tabStackBtn = document.getElementById('ss-tab-stack');
    if (tabStackBtn) tabStackBtn.addEventListener('click', () => selectTab('stack'));
    const tabDebugBtn = document.getElementById('ss-tab-debug');
    if (tabDebugBtn) tabDebugBtn.addEventListener('click', () => selectTab('debug'));

    const resizer = document.getElementById('ss-resizer');
    if (resizer) {
      let isDragging = false;
      let startY = 0;
      let startH = 0;
      resizer.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        const stackEl = document.getElementById('script-stack');
        startH = stackEl ? stackEl.getBoundingClientRect().height : 260;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta = startY - e.clientY;
        const newH = Math.max(80, Math.min(window.innerHeight - 100, startH + delta));
        const stackEl = document.getElementById('script-stack');
        if (stackEl) stackEl.style.height = newH + 'px';
        window.dispatchEvent(new Event('resize'));
      });
      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }

    document.getElementById('ss-bp-add-btn').addEventListener('click', () => {
      const input = document.getElementById('ss-bp-input');
      if (!input) return;
      if (addManualExecBreakpoint(input.value)) input.value = '';
      else setText('ss-last-hit', 'last: invalid script breakpoint address', 'ss-bad');
    });

    document.getElementById('ss-bp-input').addEventListener('keydown', (evt) => {
      if (evt.key !== 'Enter') return;
      evt.preventDefault();
      document.getElementById('ss-bp-add-btn').click();
    });

    document.getElementById('ss-bp-list').addEventListener('click', (evt) => {
      const btn = evt.target && evt.target.closest ? evt.target.closest('[data-remove-exec-bp]') : null;
      if (!btn) return;
      const addr = parseInt(btn.getAttribute('data-remove-exec-bp') || '', 10);
      if (!Number.isFinite(addr)) return;
      removeManualExecBreakpoint(addr >>> 0);
    });

    function escH(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    const SCRIPT_TOKEN = /("[^"]*")|(\\([^()]*\\))|(\\$[0-9a-fA-F]+|0x[0-9a-fA-F]+|\\b0d\\d+\\b|\\b\\d+\\b)|(^[A-Z][A-Z_?]+(?: [A-Z][A-Z_?]+)?\\b|\\b_[a-z_]+(?=\\())/g;

    function scriptHighlight(text) {
      let out = '';
      let last = 0;
      let m;
      const src = String(text || '');
      const re = new RegExp(SCRIPT_TOKEN.source, 'g');
      while ((m = re.exec(src))) {
        out += escH(src.slice(last, m.index));
        if (m[2]) {
          const aside = !src.slice(m.index + m[0].length).trim();
          const inner = '(' + scriptHighlight(m[2].slice(1, -1)) + ')';
          out += aside ? '<span class="sx-aside">' + inner + '</span>' : inner;
        } else {
          out += '<span class="' + (m[1] ? 'sx-str' : m[3] ? 'sx-num' : 'sx-kw') + '">' + escH(m[0]) + '</span>';
        }
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      return out + escH(src.slice(last));
    }

    const scriptSlotTrackers = Array.from({ length: SLOT_COUNT }, () => ({
      loc: 0,
      state: 0,
      timer1: 0,
      entity: 0,
      initialized: false,
    }));

    let totalTraceCount = 0;

    function isValidScriptAddr(loc) {
      if (typeof loc !== 'number' || isNaN(loc)) return false;
      const raw = loc >>> 0;
      if (raw === 0 || raw === 0x555555 || raw === 0xFFFFFF) return false;
      const bank = (raw >>> 16) & 0xFF;
      const addr = raw & 0xFFFF;
      if (bank < 0x80 || addr < 0x8000) return false;
      return true;
    }

    function checkScriptExecutionTrace() {
      const m = getModule();
      if (!m || !hasDebuggerApi(m)) return;
      const region = m.readMemoryRange(SCRIPT_STACK_BUS_ADDR, SCRIPT_REGION_SIZE);
      if (!region || region.length < SCRIPT_REGION_SIZE) return;

      const batch = [];

      for (let s = 0; s < SLOT_COUNT; s++) {
        const base = s * SLOT_SIZE;
        const loc = readU24(region, base + 0x00);
        const state = readU16(region, base + 0x03);
        const timer1 = readU16(region, base + 0x05);
        const entity = readU16(region, base + 0x0D);
        const tracker = scriptSlotTrackers[s];

        if (!tracker.initialized) {
          tracker.loc = loc;
          tracker.state = state;
          tracker.timer1 = timer1;
          tracker.entity = entity;
          tracker.initialized = true;
          continue;
        }

        let event = null;
        let targetLoc = 0;

        // Condition 1: New script started
        if ((tracker.state === 0 || tracker.loc === 0) && (state !== 0 && loc !== 0)) {
          event = 'start';
          targetLoc = loc;
        }
        // Condition 2: Slot was waiting (state 4) and resumed to executing (state 2)
        else if (tracker.state === 4 && state === 2) {
          event = 'resume';
          targetLoc = loc;
        }
        // Condition 3: Slot was waiting, still waiting, but loc advanced (ran & slept within this frame)
        else if (tracker.state === 4 && state === 4 && loc !== tracker.loc && tracker.loc !== 0) {
          event = 'resume';
          targetLoc = tracker.loc;
        }
        // Condition 4: Slot executing and stepped loc
        else if (tracker.state === 2 && state === 2 && loc !== tracker.loc && loc !== 0) {
          event = 'step';
          targetLoc = loc;
        }
        // Condition 5: Slot ended
        else if (tracker.state !== 0 && state === 0 && tracker.loc !== 0) {
          event = 'end';
          targetLoc = tracker.loc;
        }

        // Filter cold-RAM garbage or uninitialized addresses
        if (event && !isValidScriptAddr(targetLoc)) {
          event = null;
        }

        // Room 0x15 enter script executes in frame 1 and reaches 0xBC8006 before frame poll.
        // Catch when slot 0 starts and points to 0xBC8000..0xBC8008, resetting targetLoc to 0xBC8000
        if (s === 0 && event === 'start' && targetLoc >= 0xBC8000 && targetLoc <= 0xBC8008) {
          targetLoc = 0xBC8000;
        }

        if (event && targetLoc > 0) {
          let rawBytes = [];
          try {
            const buf = m.readMemoryRange(targetLoc, 32);
            if (buf && buf.length) rawBytes = Array.from(buf);
          } catch (_) {}
          const elapsedSec = romLaunchTimestamp > 0 ? ((performance.now() - romLaunchTimestamp) / 1000) : 0;
          const timeStr = '+' + elapsedSec.toFixed(2) + 's, f' + romFrameCount;
          batch.push({
            slot: s,
            entity,
            event,
            loc: targetLoc,
            nextLoc: loc,
            state,
            timer1,
            bytes: rawBytes,
            timeStr,
            frame: romFrameCount,
          });
        }

        tracker.loc = loc;
        tracker.state = state;
        tracker.timer1 = timer1;
        tracker.entity = entity;
      }

      if (batch.length > 0 && vscodeApi) {
        vscodeApi.postMessage({ command: 'scriptTraceBatch', items: batch });
      }
    }

    function appendTraceEntries(entries) {
      const container = document.getElementById('ss-trace-log');
      if (!container || !entries || !entries.length) return;
      const frag = document.createDocumentFragment();
      for (const entry of entries) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ss-trace-entry ' + (entry.event || '');
        if (entry.html) {
          wrapper.innerHTML = entry.html;
        } else {
          wrapper.textContent = entry.line || '';
        }
        frag.appendChild(wrapper);
      }
      container.appendChild(frag);
      while (container.childNodes.length > 250) {
        container.removeChild(container.firstChild);
      }
      totalTraceCount += entries.length;
      const countEl = document.getElementById('ss-trace-count');
      if (countEl) {
        countEl.textContent = totalTraceCount + ' lines';
      }
      const tabCountEl = document.getElementById('ss-tab-trace-count');
      if (tabCountEl) {
        tabCountEl.textContent = totalTraceCount;
      }
      const autoScroll = document.getElementById('ss-trace-scroll');
      if (autoScroll && autoScroll.checked) {
        container.scrollTop = container.scrollHeight;
      }
    }

    window.addEventListener('message', evt => {
      if (!evt.data) return;
      if (evt.data.command === 'debuggerConnectionStatus') {
        setText('ss-debug-link-status', 'dbg: ' + evt.data.text, evt.data.ok ? 'ss-ok' : 'ss-warn');
      } else if (evt.data.command === 'scriptTraceLogged') {
        appendTraceEntries(evt.data.entries);
      }
    });

    const clearBtn = document.getElementById('ss-trace-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const log = document.getElementById('ss-trace-log');
        if (log) log.innerHTML = '';
        totalTraceCount = 0;
        const count = document.getElementById('ss-trace-count');
        if (count) count.textContent = '0 lines';
        const tabCount = document.getElementById('ss-tab-trace-count');
        if (tabCount) tabCount.textContent = '0';
      });
    }

    const copyBtn = document.getElementById('ss-trace-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const log = document.getElementById('ss-trace-log');
        if (!log) return;
        const text = log.innerText || log.textContent || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text);
        }
      });
    }

    const hideInactive = document.getElementById('ss-trace-hide-inactive');
    if (hideInactive) {
      hideInactive.addEventListener('change', () => {
        const log = document.getElementById('ss-trace-log');
        if (log) {
          if (hideInactive.checked) log.classList.add('hide-inactive');
          else log.classList.remove('hide-inactive');
        }
        if (vscodeApi) {
          vscodeApi.postMessage({ command: 'setHideInactiveTrace', hideInactive: hideInactive.checked });
        }
      });
    }

    renderManualExecBreakpoints();

    loadCoreScript();
  </script>
</body>
</html>`;
}

module.exports = { buildHtml: _buildHtml };
