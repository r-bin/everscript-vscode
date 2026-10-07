'use strict';

/**
 * debugger/emulator/panel-webview.js
 *
 * Owns: the emulator webview HTML template.
 * Single export: buildHtml(webview, coreJsUri, coreWasmUri, coreLabel, corePathDisplay) -> string
 */

const {
    getBottomBarCss,
    getBottomBarTabButtonsHtml,
    getBottomBarViewsHtml,
    getBottomBarClientScript,
} = require('./bottom-bar-views');
const { getCdlCss, getCdlTabButtonHtml, getCdlViewHtml, getCdlClientScript } = require('./cdl-view');
const { getCdlFloatCss, getCdlFloatHtml, getCdlFloatScript } = require('./cdl-float');
const { getCdlStripsScript } = require('./cdl-strips');
const { getFpsCss, getFpsChipHtml, getFpsClientScript } = require('./fps-meter');
const { getTasCss, getTasTabButtonHtml, getTasChipHtml, getTasOverlayHtml, getTasViewHtml, getTasClientScript } = require('./tas-view');

function _nonce() {
    let n = '';
    const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) n += ch[Math.floor(Math.random() * ch.length)];
    return n;
}

function parseRoomTriggers(rom, mapId) {
    if (!rom || typeof mapId !== 'number' || mapId < 0 || mapId > 0x90) return null;
    const headerOffset = (rom.length % 1024 === 512) ? 512 : 0;
    const mapTableRom = headerOffset + 0x1ffde7;
    const ptrAddr = mapTableRom + mapId * 4;
    if (ptrAddr + 3 >= rom.length) return null;
    const dataSnes = rom[ptrAddr] | (rom[ptrAddr + 1] << 8) | (rom[ptrAddr + 2] << 16);
    if (dataSnes === 0 || dataSnes === 0xFFFFFF) return null;
    const dataRom = headerOffset + (((dataSnes >> 16) & 0x3f) * 0x10000 + (dataSnes & 0xffff));
    if (dataRom + 20 >= rom.length) return null;

    const offX = rom[dataRom + 0];
    const offY = rom[dataRom + 1];

    const stepLen = rom[dataRom + 0x0d] | (rom[dataRom + 0x0d + 1] << 8);
    const stepTableRom = dataRom + 0x0d + 2;
    const bLenRom = stepTableRom + stepLen;
    if (bLenRom + 2 >= rom.length) return null;
    const bLen = rom[bLenRom] | (rom[bLenRom + 1] << 8);
    const bTableRom = bLenRom + 2;

    const stepOn = [];
    if (stepLen >= 6 && stepLen % 6 === 0 && stepLen <= 600) {
        for (let p = 0; p < stepLen; p += 6) {
            const at = stepTableRom + p;
            if (at + 5 >= rom.length) break;
            stepOn.push({
                y1: rom[at + 0],
                x1: rom[at + 1],
                y2: rom[at + 2],
                x2: rom[at + 3],
                scriptId: rom[at + 4] | (rom[at + 5] << 8),
            });
        }
    }

    const bTrigger = [];
    if (bLen >= 6 && bLen % 6 === 0 && bLen <= 600) {
        for (let p = 0; p < bLen; p += 6) {
            const at = bTableRom + p;
            if (at + 5 >= rom.length) break;
            bTrigger.push({
                y1: rom[at + 0],
                x1: rom[at + 1],
                y2: rom[at + 2],
                x2: rom[at + 3],
                scriptId: rom[at + 4] | (rom[at + 5] << 8),
            });
        }
    }

    return { offX, offY, stepOn, bTrigger };
}

function calculateTriggerBox(trigger, trigOffX, trigOffY, camX, camY) {
    const posX = (trigger.x1 - trigOffX) * 16;
    const posY = (trigger.y1 - trigOffY) * 16;
    const boxW = Math.max(1, (trigger.x2 - trigger.x1) * 16);
    const boxH = Math.max(1, (trigger.y2 - trigger.y1) * 16);
    return {
        posX,
        posY,
        boxW,
        boxH,
        sx: (posX - camX) * 2,
        sy: (posY - camY) * 2,
        sw: boxW * 2,
        sh: boxH * 2,
    };
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
      overflow: hidden;
      position: relative;
    }
    #extended-map {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    #extended-entities {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    #extended-foreground {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    #screen {
      position: absolute;
      z-index: 3;
      display: block;
      width: 512px; height: 448px;
      image-rendering: pixelated; image-rendering: crisp-edges;
      outline: none;
      box-shadow: none;
    }
    #screen:focus, #screen:focus-visible {
      outline: none;
      box-shadow: none;
    }
    #extended-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 4;
    }
    #screen-overlay-bar {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 20;
      display: flex;
      gap: 6px;
      pointer-events: none;
    }
    .screen-chip-group {
      display: inline-flex;
      gap: 2px;
      pointer-events: auto;
    }
    .screen-chip {
      pointer-events: auto;
      background: rgba(20, 20, 20, 0.75);
      color: #888;
      border: 1px solid #444;
      border-radius: 3px;
      padding: 2px 7px;
      font-size: 10px;
      font-family: monospace;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .screen-chip:hover {
      background: rgba(35, 35, 35, 0.9);
      color: #ccc;
    }
    .screen-chip.active {
      background: rgba(26, 40, 26, 0.85);
      color: #6f9;
      border-color: #2e7d32;
    }
    #ss-extend-label, #ss-overlay-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: #aaa;
      cursor: pointer;
      user-select: none;
    }
    #ss-extend-label input, #ss-overlay-label input {
      cursor: pointer;
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
    .ss-trace-row { display: flex; gap: 6px; white-space: nowrap; padding: 1px 0; align-items: baseline; }
    .ss-trace-sub { display: flex; gap: 6px; white-space: nowrap; padding: 1px 0; font-family: monospace; font-size: 11px; align-items: baseline; }
    .ss-trace-arrow { color: #c586c0; font-weight: bold; width: 20px; min-width: 20px; flex-shrink: 0; text-align: right; }
    .ss-trace-time { color: #569cd6; font-size: 10px; width: 95px; min-width: 95px; flex-shrink: 0; }
    .ss-trace-lookup { color: #4ec9b0; font-weight: bold; width: 110px; min-width: 110px; flex-shrink: 0; display: inline-block; overflow: hidden; text-overflow: ellipsis; }
    .ss-trace-tag { font-weight: bold; width: 140px; min-width: 140px; flex-shrink: 0; }
    .ss-trace-tag.start  { color: #6f9; }
    .ss-trace-tag.resume { color: #ff6; }
    .ss-trace-tag.step   { color: #69f; }
    .ss-trace-tag.end    { color: #f66; }
    .ss-trace-addr       { color: #4ec9b0; width: 68px; min-width: 68px; flex-shrink: 0; }
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
    ${getBottomBarCss()}
    ${getCdlCss()}
    ${getCdlFloatCss()}
    ${getTasCss()}
    ${getFpsCss()}
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
    <canvas id="extended-map"></canvas>
    <canvas id="extended-entities"></canvas>
    <canvas id="extended-foreground"></canvas>
    <canvas id="screen" width="512" height="448"></canvas>
    <canvas id="extended-overlay"></canvas>
    ${getCdlFloatHtml()}
    ${getTasOverlayHtml()}
    <div id="screen-overlay-bar">
      <button id="screen-extend-toggle" class="screen-chip active" type="button" title="Toggle Extended Map">MAP EXT ON</button>
      <button id="screen-trigger-toggle" class="screen-chip active" type="button" title="Toggle Trigger Overlay (B &amp; Step-on)">TRIGGERS ON</button>
      <button id="screen-fog-toggle" class="screen-chip" type="button" title="Toggle Fog of War outside emulator">FOG OFF</button>
      <button id="screen-speed-chip" class="screen-chip" type="button" title="Speed-up (#)">SPEED x1</button>
      ${getTasChipHtml()}
      ${getFpsChipHtml()}
      <div id="screen-zoom-chip" class="screen-chip-group">
        <button id="screen-zout" class="screen-chip" type="button" title="Zoom out">-</button>
        <span id="screen-zlevel" class="screen-chip" style="cursor:default">100%</span>
        <button id="screen-zin" class="screen-chip" type="button" title="Zoom in">+</button>
        <button id="screen-zfit" class="screen-chip" type="button" title="Fit to viewport">fit</button>
      </div>
    </div>
  </div>

  <div id="ss-resizer" title="Drag to resize panel"></div>

  <div id="script-stack">
    <div id="ss-header">
      <div id="ss-tabs">
        <button id="ss-tab-trace" class="ss-tab active" type="button">SCRIPT TRACE (<span id="ss-tab-trace-count">0</span>)</button>
        <button id="ss-tab-stack" class="ss-tab" type="button">SCRIPT STACK (<span id="ss-count">waiting...</span>)</button>
        ${getBottomBarTabButtonsHtml()}
        ${getCdlTabButtonHtml()}
        ${getTasTabButtonHtml()}
        <button id="ss-tab-debug" class="ss-tab" type="button">DEBUGGER &amp; HOOKS</button>
      </div>
      <div id="ss-controls">
        <label id="ss-extend-label" title="Toggle extended map background"><input type="checkbox" id="ss-extend-toggle" checked /> extend map</label>
        <label id="ss-overlay-label" title="Toggle trigger overlay"><input type="checkbox" id="ss-overlay-toggle" checked /> triggers</label>
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

    ${getBottomBarViewsHtml()}

    ${getCdlViewHtml()}

    ${getTasViewHtml()}

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
        if (evt.data.alchemyIcons) loadedAlchemyIcons = evt.data.alchemyIcons;
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
    // Speed-up: '#' runs SPEEDUP_FACTOR frames per display frame (and again to stop).
    const SPEEDUP_FACTOR = 4;
    let speedUp = false;
    function setSpeedUp(on) {
      speedUp = !!on;
      const chip = document.getElementById('screen-speed-chip');
      if (chip) {
        chip.textContent = speedUp ? 'SPEED x' + SPEEDUP_FACTOR : 'SPEED x1';
        chip.classList.toggle('active', speedUp);
      }
    }
    document.addEventListener('keydown', e => {
      if (e.key === '#' && !e.repeat) {
        const tag = e.target && e.target.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          setSpeedUp(!speedUp);
          e.preventDefault();
          return;
        }
      }
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
    let loadedRomData = null;
    let loadedRomName = 'game';
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
        bootRom(romData, name);
      } catch (e) {
        romStage('launch failed: ' + e.message);
        vscodeApi.postMessage({ command: 'ejsError', error: 'ROM load failed: ' + e.message });
        document.getElementById('load-status').textContent = 'Error: ' + e.message;
      }
    }

    // (Re)start the core with a ROM: a power-on, also used to start a replay.
    function bootRom(romData, name) {
      try {
        romStage('core start begin');
        cdlBeforeRomChange();
        tasFlush();
        const ptr = Module._my_malloc(romData.length);
        HEAPU8.set(romData, ptr);
        Module._startWithRom(ptr, romData.length, AUDIO_FREQ);
        Module._my_free(ptr);
        romStage('core start complete');

        romLoaded = true;
        loadedRomData = romData;
        loadedRomName = name || 'game';
        cachedMapId = -1;
        cachedTriggers = null;
        lastRequestedMapId = -1;
        activeRoomMap = null;
        spriteCache.clear();
        romLaunchTimestamp = performance.now();
        romFrameCount = 0;
        initAudio();
        ensureAudioRunning();
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('script-stack').classList.add('visible');
        window.dispatchEvent(new Event('resize'));
        startWramPolling();
        initBottomBarEventListeners();
        vscodeApi.postMessage({ command: 'requestAlchemyIcons' });
        vscodeApi.postMessage({ command: 'gameStarted', name: name || 'game' });
        tasOnBoot(name);
        romStage('launch success: ' + (name || 'game'));
      } catch (e) {
        romStage('launch failed: ' + e.message);
        vscodeApi.postMessage({ command: 'ejsError', error: 'ROM load failed: ' + e.message });
        document.getElementById('load-status').textContent = 'Error: ' + e.message;
      }
    }

    // -- Render loop -----------------------------------------------------------
    function startRenderLoop() {
      const canvas        = document.getElementById('screen');
      const extMapCanvas  = document.getElementById('extended-map');
      const extEntCanvas  = document.getElementById('extended-entities');
      const extFgCanvas   = document.getElementById('extended-foreground');
      const extOverCanvas = document.getElementById('extended-overlay');
      const wrap          = document.getElementById('screen-wrap');
      const ctx           = canvas.getContext('2d');
      const extMapCtx     = extMapCanvas ? extMapCanvas.getContext('2d') : null;
      const extEntCtx     = extEntCanvas ? extEntCanvas.getContext('2d') : null;
      const extFgCtx      = extFgCanvas ? extFgCanvas.getContext('2d') : null;
      const extOverCtx    = extOverCanvas ? extOverCanvas.getContext('2d') : null;
      const imageData     = ctx.createImageData(512, 448);
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

      // Zoom & Pan state
      let zoomLevel = 1.0;
      let panX = 0;
      let panY = 0;

      function updateScreenLayout() {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!W || !H) return;
        const fitScale = Math.max(Math.min(W / 512, H / 448), 0.01);
        const scale = fitScale * zoomLevel;
        canvas.style.width = (512 * scale) + 'px';
        canvas.style.height = (448 * scale) + 'px';
        const emuW = 512 * scale;
        const emuH = 448 * scale;
        const emuX = Math.round((W - emuW) / 2 + panX);
        const emuY = Math.round((H - emuH) / 2 + panY);
        canvas.style.position = 'absolute';
        canvas.style.left = emuX + 'px';
        canvas.style.top = emuY + 'px';
        const zLvlEl = document.getElementById('screen-zlevel');
        if (zLvlEl) zLvlEl.textContent = Math.round(zoomLevel * 100) + '%';
      }

      function zoomAt(nextZoom, cx, cy) {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!W || !H) return;
        nextZoom = Math.max(0.25, Math.min(nextZoom, 10.0));
        if (Math.abs(nextZoom - zoomLevel) < 0.0001) return;
        const fitScale = Math.max(Math.min(W / 512, H / 448), 0.01);
        const oldScale = fitScale * zoomLevel;
        const newScale = fitScale * nextZoom;
        const oldEmuW = 512 * oldScale;
        const newEmuW = 512 * newScale;
        const oldEmuH = 448 * oldScale;
        const newEmuH = 448 * newScale;
        const oldEmuX = (W - oldEmuW) / 2 + panX;
        const oldEmuY = (H - oldEmuH) / 2 + panY;
        const newEmuX = cx - (cx - oldEmuX) * (newScale / oldScale);
        const newEmuY = cy - (cy - oldEmuY) * (newScale / oldScale);
        panX = newEmuX - (W - newEmuW) / 2;
        panY = newEmuY - (H - newEmuH) / 2;
        zoomLevel = nextZoom;
        updateScreenLayout();
      }

      // Trackpad pinch-to-zoom (wheel with ctrlKey/metaKey) and two-finger pan (wheel)
      wrap.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const r = wrap.getBoundingClientRect();
          const cx = e.clientX - r.left;
          const cy = e.clientY - r.top;
          const factor = Math.exp(-e.deltaY * 0.01);
          zoomAt(zoomLevel * factor, cx, cy);
        } else {
          e.preventDefault();
          const k = e.deltaMode === 1 ? 16 : 1;
          panX -= e.deltaX * k;
          panY -= e.deltaY * k;
          updateScreenLayout();
        }
      }, { passive: false });

      // Mouse drag-to-pan (middle click, alt+click, or dragging outside screen canvas)
      let isPanning = false;
      let panStartX = 0;
      let panStartY = 0;
      let panBaseX = 0;
      let panBaseY = 0;
      wrap.addEventListener('mousedown', (e) => {
        if (e.button === 2) return; // Right-click handled by contextmenu
        if (e.button === 1 || e.altKey || (e.target !== canvas && !e.target.closest('.screen-chip'))) {
          isPanning = true;
          panStartX = e.clientX;
          panStartY = e.clientY;
          panBaseX = panX;
          panBaseY = panY;
          e.preventDefault();
        }
      });
      wrap.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!romLoaded || !lastLayout) return;
        const rect = wrap.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const targetX = Math.max(0, Math.round(lastLayout.camX + (mouseX - lastLayout.emuX) / lastLayout.scaleSnes));
        const targetY = Math.max(0, Math.round(lastLayout.camY + (mouseY - lastLayout.emuY) / lastLayout.scaleSnes));
        activeTargetPings.push({ x: targetX, y: targetY, birth: performance.now(), duration: 1200 });
        // wait_for ACTIVE, unlock ACTIVE: the player gets control back on arrival
        const scriptStr = 'walk(ACTIVE, COORDINATE_ABSOLUTE, ' + targetX + ', ' + targetY + ', ACTIVE, ACTIVE)';
        injectEverscript(scriptStr);
      });
      window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        panX = panBaseX + (e.clientX - panStartX);
        panY = panBaseY + (e.clientY - panStartY);
        updateScreenLayout();
      });
      window.addEventListener('mouseup', () => {
        isPanning = false;
      });

      // Zoom buttons
      const zinBtn = document.getElementById('screen-zin');
      const zoutBtn = document.getElementById('screen-zout');
      const zfitBtn = document.getElementById('screen-zfit');
      if (zinBtn) zinBtn.addEventListener('click', () => {
        zoomAt(zoomLevel * 1.25, wrap.clientWidth / 2, wrap.clientHeight / 2);
      });
      if (zoutBtn) zoutBtn.addEventListener('click', () => {
        zoomAt(zoomLevel / 1.25, wrap.clientWidth / 2, wrap.clientHeight / 2);
      });
      if (zfitBtn) zfitBtn.addEventListener('click', () => {
        zoomLevel = 1.0;
        panX = 0;
        panY = 0;
        updateScreenLayout();
      });

      // Scale the canvases to fit the panel and sync dimensions
      function resizeCanvas(force) {
        const W = wrap.clientWidth, H = wrap.clientHeight;
        if (!force && W === lastWrapWidth && H === lastWrapHeight) return;
        lastWrapWidth = W;
        lastWrapHeight = H;
        if (!W || !H) return;
        updateScreenLayout();
        if (extMapCanvas && (extMapCanvas.width !== W || extMapCanvas.height !== H)) {
          extMapCanvas.width = W;
          extMapCanvas.height = H;
        }
        if (extEntCanvas && (extEntCanvas.width !== W || extEntCanvas.height !== H)) {
          extEntCanvas.width = W;
          extEntCanvas.height = H;
        }
        if (extFgCanvas && (extFgCanvas.width !== W || extFgCanvas.height !== H)) {
          extFgCanvas.width = W;
          extFgCanvas.height = H;
        }
        if (extOverCanvas && (extOverCanvas.width !== W || extOverCanvas.height !== H)) {
          extOverCanvas.width = W;
          extOverCanvas.height = H;
        }
      }
      if (window.ResizeObserver) new ResizeObserver(() => resizeCanvas(true)).observe(wrap);
      window.addEventListener('resize', () => resizeCanvas(true));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resizeCanvas(true);
      });
      resizeCanvas(true);

      let lastFrameTimestamp = performance.now();
      const FRAME_INTERVAL_MS = 1000 / 60; // 16.666 ms
      // Paused (Esc, pause button, breakpoint): the core is frozen, so only the
      // extension layers are redrawn - a few times a second, for pan / zoom.
      const PAUSED_FRAME_MS = 250;
      let lastPausedFrame = 0;

      function frame(timestamp) {
        requestAnimationFrame(frame);
        if (!timestamp) timestamp = performance.now();
        const elapsed = timestamp - lastFrameTimestamp;
        if (elapsed < FRAME_INTERVAL_MS - 2.0) return;
        lastFrameTimestamp = timestamp - (elapsed % FRAME_INTERVAL_MS);

        const paused = isEmulatorPaused();
        if (paused !== emulatorPausedState) {
          emulatorPausedState = paused;
          cdlOnPauseChanged(paused);
          tasOnPauseChanged(paused);
        }
        fpsTick(timestamp, romLoaded && !paused);
        if (paused) {
          if (timestamp - lastPausedFrame < PAUSED_FRAME_MS) return;
          lastPausedFrame = timestamp;
        }

        resizeCanvas(false);
        if (romLoaded && paused) {
          renderExtendedMapAndOverlays(lastSampledPreState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx);
        } else if (romLoaded) {
          romFrameCount++;
          // Sample camera and entity state BEFORE _mainLoop() to match rendered frame
          const preState = samplePreLoopState();
          lastSampledPreState = preState;
          const m = getModule();
          // A replay must see exactly the recorded memory: no cheat writes.
          if (m && !tasReplaying()) maintainCheats(m);
          for (let extra = tasExtraFrames() + (speedUp ? SPEEDUP_FACTOR - 1 : 0); extra > 0 && !isEmulatorPaused(); extra--) {
            tasApplyInput(Module, keyInput);
            Module._mainLoop();
            fpsCountFrame(Module);
            romFrameCount++;
          }
          tasApplyInput(Module, keyInput);
          Module._mainLoop();
          fpsCountFrame(Module);
          const fbPtr = Module._getScreenBuffer();
          if (fbPtr) {
            imageData.data.set(new Uint8ClampedArray(HEAPU8.buffer, fbPtr, 512 * 448 * 4));
            ctx.putImageData(imageData, 0, 0);
          }
          renderExtendedMapAndOverlays(preState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx);
          tasDrawOverlay();
          checkScriptExecutionTrace();
        }
      }
      requestAnimationFrame(frame);
    }

    // -- Extended map and triggers overlay -------------------------------------
    let extendMapEnabled = true;
    let triggersOverlayEnabled = true;
    let fogOfWarEnabled = false;
    let cachedMapId = -1;
    let cachedTriggers = null;
    let lastRequestedMapId = -1;
    let lastRequestedObjKey = '';
    let lastRequestedGrassKey = '';
    let lastRequestedLayered = false;
    // Sticky per room: once BG1 has scrolled apart from the camera, the room
    // is drawn from its separate layers (the composite is right only at one scroll).
    let roomParallax = false;
    let cutGrassTileSet = new Set();
    let activeRoomMap = null;
    let lastLayout = null;
    let activeTargetPings = [];

    function getDogPalette(mapId, spriteBank) {
      if (spriteBank === 0xD2) return 0xAE6B; // Act 4 Toaster
      if (mapId >= 69) return 0xAE6B; // Act 4 Omnitopia
      if (mapId >= 49) return 0xAE4B; // Act 3 Gothica (Poodle)
      if (mapId >= 27) return 0xAE2B; // Act 2 Antiqua (Greyhound)
      if (mapId === 0) return 0xB54B;  // Act 0 Podunk
      return 0xAE0B; // Act 1 Prehistoria (Wolf)
    }

    function injectEverscript(codeString) {
      const m = getModule();
      if (!m || !hasDebuggerApi(m)) {
        console.warn('Cannot inject everscript: emulator debugger API not available');
        return false;
      }
      const str = String(codeString || '').trim();
      if (!str) return false;

      let bytecode = null;
      const walkMatch = str.match(/^walk\\s*\\(\\s*(\\w+)\\s*,\\s*(\\w+)\\s*,\\s*(-?\\d+)\\s*,\\s*(-?\\d+)\\s*(?:,\\s*(\\w+)\\s*)?(?:,\\s*(\\w+)\\s*)?\\)/i);
      if (walkMatch) {
        const charName = walkMatch[1].toUpperCase();
        const typeName = walkMatch[2].toUpperCase();
        const targetX = parseInt(walkMatch[3], 10);
        const targetY = parseInt(walkMatch[4], 10);

        let opcode = 0x9D; // COORDINATE_ABSOLUTE
        if (typeName.includes('DIRECT')) opcode = 0x73; // COORDINATE_ABSOLUTE_DIRECT
        else if (typeName.includes('TILE')) opcode = 0x6E;

        // entity tokens: BOY 0x50, DOG 0x51, ACTIVE 0x52, INACTIVE 0x53 (| 0x80)
        const token = name => ({ BOY: 0xD0, DOG: 0xD1, ACTIVE: 0xD2, INACTIVE: 0xD3 })[(name || '').toUpperCase()];
        const charToken = token(charName) || 0xD2;

        bytecode = [
          opcode,
          charToken,
          0x84, targetX & 0xFF, (targetX >> 8) & 0xFF,
          0x84, targetY & 0xFF, (targetY >> 8) & 0xFF,
        ];
        // walk(..., wait_for, unlock) as the compiler emits it: (2e) wait until
        // the character arrives, (2b) make it player/AI controlled again.
        const waitFor = token(walkMatch[5]);
        const unlock = token(walkMatch[6]);
        if (waitFor) {
          bytecode.push(0x2E, waitFor);
          if (unlock) bytecode.push(0x2B, unlock);
        }
        bytecode.push(0x00); // END
      } else {
        const hexMatch = str.match(/^(?:0x)?([0-9a-fA-F\\s,]+)$/);
        if (hexMatch) {
          const parts = str.split(/[\\s,]+/).filter(Boolean);
          bytecode = parts.map(p => parseInt(p, 16) & 0xFF);
          if (bytecode.length && bytecode[bytecode.length - 1] !== 0x00) bytecode.push(0x00);
        }
      }

      if (!bytecode || !bytecode.length) {
        console.warn('Unknown or unparseable everscript:', str);
        return false;
      }

      // Start the script the way the engine does (JSL $8CCE5C -> $8CCF18):
      //  * $8CCF18 takes the first slot in $7E28FC with state 0, stores the
      //    24-bit code pointer at +0, state 2 at +3, clears +5/+9/+B/+D and
      //    the argument block;
      //  * the caller then appends the slot to the run list at $7E2F28,
      //    indexed by $86, zero-terminated. $8CCFFD runs only what is on that
      //    list, so a slot that is merely marked live never executes.
      // Bytecode is fetched with LDA [$82] (a long pointer), so it can live in
      // WRAM: $7FFF00 is never written during play (headless survey), and a
      // walk without a wait runs to its END within the frame anyway.
      // A walk that waits keeps running across frames, so each injection gets
      // its own 0x40-byte buffer: a new right-click must not overwrite the
      // bytecode of a walk that is still waiting.
      let CODE_ADDR = 0x7FFF00;
      if (bytecode.length <= 0x40) {
        const buffer = injectEverscript.nextBuffer || 0;
        CODE_ADDR = 0x7FFF00 + buffer * 0x40;
        injectEverscript.nextBuffer = (buffer + 1) % 4;
      }
      if (bytecode.length > 0x100) {
        console.warn('Injected everscript too long:', bytecode.length);
        return false;
      }
      for (let i = 0; i < bytecode.length; i++) m.writeMemory(CODE_ADDR + i, bytecode[i]);

      const writeWord = (addr, v) => {
        m.writeMemory(addr, v & 0xFF);
        m.writeMemory(addr + 1, (v >> 8) & 0xFF);
      };
      const readWord = (addr) => m.readMemory(addr) | (m.readMemory(addr + 1) << 8);

      let targetSlot = -1;
      for (let s = 0; s < SLOT_COUNT; s++) {
        if (readWord(SCRIPT_STACK_BUS_ADDR + s * SLOT_SIZE + 0x03) === 0) { targetSlot = s; break; }
      }
      const RUN_LIST = 0x7E2F28;
      const RUN_INDEX = 0x7E0086;
      const runIdx = readWord(RUN_INDEX);
      if (targetSlot < 0 || runIdx >= SLOT_COUNT * 2) {
        console.warn('Cannot inject everscript: no free script slot');
        setText('ss-last-hit', 'inject failed: no free script slot', 'ss-warn');
        return false;
      }

      const targetBus = SCRIPT_STACK_BUS_ADDR + targetSlot * SLOT_SIZE;
      for (let i = 0; i < SLOT_SIZE; i++) m.writeMemory(targetBus + i, 0);
      m.writeMemory(targetBus + 0x00, CODE_ADDR & 0xFF);
      m.writeMemory(targetBus + 0x01, (CODE_ADDR >> 8) & 0xFF);
      m.writeMemory(targetBus + 0x02, (CODE_ADDR >> 16) & 0xFF);
      writeWord(targetBus + 0x03, 0x0002);
      // +0x0D (owner) stays 0: an owner would need its +0x3E refcount bumped.

      writeWord(RUN_LIST + runIdx, targetBus & 0xFFFF);
      writeWord(RUN_LIST + runIdx + 2, 0);
      writeWord(RUN_INDEX, runIdx + 2);

      console.log('Injected everscript:', str, 'into slot', targetSlot, 'addr', fmtHex(CODE_ADDR, 6));
      setText('ss-last-hit', 'injected: ' + str + ' -> slot ' + targetSlot, 'ss-ok');
      return true;
    }

    ${parseRoomTriggers.toString()}

    ${calculateTriggerBox.toString()}

    function renderTriggersOverlay(overlayCtx, layout) {
      if (!overlayCtx) return;
      if (!layout) {
        const wrap = document.getElementById('screen-wrap');
        const canvas = document.getElementById('screen');
        const wrapW = wrap ? wrap.clientWidth : 512;
        const wrapH = wrap ? wrap.clientHeight : 448;
        const emuW = canvas ? (parseFloat(canvas.style.width) || 512) : 512;
        const emuH = canvas ? (parseFloat(canvas.style.height) || 448) : 448;
        layout = {
          wrapW: wrapW,
          wrapH: wrapH,
          emuX: (wrapW - emuW) / 2,
          emuY: (wrapH - emuH) / 2,
          emuW: emuW,
          emuH: emuH,
          scaleSnes: emuW / 256,
          camX: 0,
          camY: 0,
          trigOffX: 0,
          trigOffY: 0,
        };
      }
      overlayCtx.clearRect(0, 0, layout.wrapW, layout.wrapH);

      if (fogOfWarEnabled && extendMapEnabled) {
        overlayCtx.save();
        overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        overlayCtx.beginPath();
        overlayCtx.rect(0, 0, layout.wrapW, layout.wrapH);
        overlayCtx.rect(layout.emuX, layout.emuY, layout.emuW, layout.emuH);
        overlayCtx.fill('evenodd');
        overlayCtx.restore();
      }

      if (activeTargetPings.length) {
        const now = performance.now();
        activeTargetPings = activeTargetPings.filter(p => (now - p.birth) < p.duration);
        for (let i = 0; i < activeTargetPings.length; i++) {
          const p = activeTargetPings[i];
          const progress = (now - p.birth) / p.duration;
          const px = layout.emuX + (p.x - layout.camX) * layout.scaleSnes;
          const py = layout.emuY + (p.y - layout.camY) * layout.scaleSnes;
          const radius = (6 + progress * 24) * layout.scaleSnes;
          const alpha = 1.0 - progress;

          overlayCtx.save();
          overlayCtx.strokeStyle = 'rgba(0, 230, 255, ' + alpha.toFixed(2) + ')';
          overlayCtx.lineWidth = Math.max(1, Math.round(2 * layout.scaleSnes));
          overlayCtx.beginPath();
          overlayCtx.arc(px, py, radius, 0, Math.PI * 2);
          overlayCtx.stroke();

          const cs = 4 * layout.scaleSnes;
          overlayCtx.beginPath();
          overlayCtx.moveTo(px - cs, py); overlayCtx.lineTo(px + cs, py);
          overlayCtx.moveTo(px, py - cs); overlayCtx.lineTo(px, py + cs);
          overlayCtx.stroke();
          overlayCtx.restore();
        }
      }

      if (!triggersOverlayEnabled || !cachedTriggers) return;

      const stepOn = cachedTriggers.stepOn || [];
      const bTrigger = cachedTriggers.bTrigger || [];
      if (!stepOn.length && !bTrigger.length) return;

      overlayCtx.save();

      if (!extendMapEnabled) {
        overlayCtx.beginPath();
        overlayCtx.rect(layout.emuX, layout.emuY, layout.emuW, layout.emuH);
        overlayCtx.clip();
      }

      // Step-on triggers: Pink (#ff69b4, rgba(255, 100, 180, 0.22))
      overlayCtx.lineWidth = 1;
      for (let i = 0; i < stepOn.length; i++) {
        const box = calculateTriggerBox(stepOn[i], layout.trigOffX, layout.trigOffY, layout.camX, layout.camY);
        const tx = layout.emuX + (box.posX - layout.camX) * layout.scaleSnes;
        const ty = layout.emuY + (box.posY - layout.camY) * layout.scaleSnes;
        const tw = box.boxW * layout.scaleSnes;
        const th = box.boxH * layout.scaleSnes;

        if (tx + tw <= 0 || tx >= layout.wrapW || ty + th <= 0 || ty >= layout.wrapH) continue;

        overlayCtx.fillStyle = 'rgba(255, 100, 180, 0.22)';
        overlayCtx.fillRect(tx, ty, tw, th);
        overlayCtx.strokeStyle = '#ff69b4';
        overlayCtx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);

        const label = (stepOn[i].scriptId >>> 0).toString(16).toUpperCase();
        overlayCtx.font = '10px monospace';
        const textW = overlayCtx.measureText(label).width;
        const labelX = tx + 2;
        const labelY = ty + 10;
        overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        overlayCtx.fillRect(labelX - 1, labelY - 9, textW + 2, 11);
        overlayCtx.fillStyle = '#ff69b4';
        overlayCtx.fillText(label, labelX, labelY);
      }

      // B-triggers: Yellow (#ffcc00, rgba(255, 210, 0, 0.22))
      for (let i = 0; i < bTrigger.length; i++) {
        const box = calculateTriggerBox(bTrigger[i], layout.trigOffX, layout.trigOffY, layout.camX, layout.camY);
        const tx = layout.emuX + (box.posX - layout.camX) * layout.scaleSnes;
        const ty = layout.emuY + (box.posY - layout.camY) * layout.scaleSnes;
        const tw = box.boxW * layout.scaleSnes;
        const th = box.boxH * layout.scaleSnes;

        if (tx + tw <= 0 || tx >= layout.wrapW || ty + th <= 0 || ty >= layout.wrapH) continue;

        overlayCtx.fillStyle = 'rgba(255, 210, 0, 0.22)';
        overlayCtx.fillRect(tx, ty, tw, th);
        overlayCtx.strokeStyle = '#ffcc00';
        overlayCtx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);

        const label = (bTrigger[i].scriptId >>> 0).toString(16).toUpperCase();
        overlayCtx.font = '10px monospace';
        const textW = overlayCtx.measureText(label).width;
        const labelX = tx + 2;
        const labelY = ty + 10;
        overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        overlayCtx.fillRect(labelX - 1, labelY - 9, textW + 2, 11);
        overlayCtx.fillStyle = '#ffcc00';
        overlayCtx.fillText(label, labelX, labelY);
      }

      overlayCtx.restore();
    }

    // -- Sprite decoding & caching ---------------------------------------------
    function snesToRom(snes) { return snes & 0x3fffff; }
    function atRom(rom, snes) { return rom[snesToRom(snes)]; }
    function readRom24(rom, off) { return rom[off] | (rom[off + 1] << 8) | (rom[off + 2] << 16); }

    const POOL_LARGE = { pointers: 0xec0000, data: 0xd90000, size: 16 };
    const POOL_SMALL = { pointers: 0xd80000, data: 0xd10000, size: 8 };

    function blockBytes(rom, index, pool) {
      const raw = readRom24(rom, snesToRom(pool.pointers + index * 3));
      const compressed = (raw >>> 23) & 1;
      const addr = ((raw & ~(1 << 23)) >>> 0) + pool.data;
      const sub = pool.size / 8;
      const length = (8 * 8 * sub * sub) / 2;
      const out = new Uint8Array(length);
      if (!compressed) {
        for (let i = 0; i < length; i++) out[i] = atRom(rom, addr + i);
        return out;
      }
      let src = addr;
      let dst = 0;
      for (let group = 0; group < length / 16; group++) {
        let bits = atRom(rom, src++);
        for (let bit = 0; bit < 8; bit++, bits >>= 1) {
          if (bits & 1) { dst += 2; continue; }
          out[dst++] = atRom(rom, src++);
          out[dst++] = atRom(rom, src++);
        }
      }
      return out;
    }

    function decodeSpriteBlock(rom, index, large) {
      const pool = large ? POOL_LARGE : POOL_SMALL;
      const d = blockBytes(rom, index, pool);
      const sub = pool.size / 8;
      const pixels = new Uint8Array(pool.size * pool.size);
      let n = 0;
      for (let l = 0; l < sub; l++) {
        for (let row = 0; row < 8; row++) {
          for (let j = 0; j < sub; j++) {
            const base = (j + 2 * l) * 32 + row * 2;
            for (let bit = 7; bit >= 0; bit--) {
              let p = 0;
              if (d[base + 0] & (1 << bit)) p |= 1;
              if (d[base + 1] & (1 << bit)) p |= 2;
              if (d[base + 16] & (1 << bit)) p |= 4;
              if (d[base + 17] & (1 << bit)) p |= 8;
              pixels[n++] = p;
            }
          }
        }
      }
      return { size: pool.size, pixels: pixels };
    }

    function readSpriteInfo(rom, address) {
      const count = atRom(rom, address);
      const dataOffset = atRom(rom, address + 1);
      const chunks = [];
      let cursor = address;
      for (let n = 0; n < count; n++) {
        const c = cursor + dataOffset;
        const flags = atRom(rom, c);
        chunks.push({
          flags: flags,
          x: (atRom(rom, c + 1) << 24) >> 24,
          y: (atRom(rom, c + 2) << 24) >> 24,
          block: atRom(rom, c + 3) | (atRom(rom, c + 4) << 8),
          large: (flags & 1) !== 0,
          flipX: (flags & 0x40) !== 0,
          flipY: (flags & 0x80) !== 0,
          priority: (flags & 0x30) >> 4,
          palette: (flags & 0x0e) >> 1,
        });
        cursor += 5;
      }
      return { address: address, chunks: chunks, size: dataOffset + count * 5 };
    }

    function composeSprite(rom, info) {
      let minX = 0, minY = 0, maxX = 1, maxY = 1;
      for (let i = 0; i < info.chunks.length; i++) {
        const c = info.chunks[i];
        const s = c.large ? 16 : 8;
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.x + s > maxX) maxX = c.x + s;
        if (c.y + s > maxY) maxY = c.y + s;
      }
      const width = maxX - minX;
      const height = maxY - minY;
      const pixels = new Int16Array(width * height).fill(-1);
      // Each pixel's chunk palette bits (OAM palette = entity slot + these).
      const pals = new Uint8Array(width * height);
      for (let priority = 0; priority < 4; priority++) {
        for (let i = info.chunks.length - 1; i >= 0; i--) {
          const c = info.chunks[i];
          if (c.priority !== priority) continue;
          const b = decodeSpriteBlock(rom, c.block, c.large);
          for (let y = 0; y < b.size; y++) {
            for (let x = 0; x < b.size; x++) {
              const sx = c.flipX ? b.size - 1 - x : x;
              const sy = c.flipY ? b.size - 1 - y : y;
              const v = b.pixels[sy * b.size + sx];
              if (!v) continue;
              const px = c.x - minX + x;
              const py = c.y - minY + y;
              if (px < 0 || py < 0 || px >= width || py >= height) continue;
              pixels[py * width + px] = v;
              pals[py * width + px] = c.palette;
            }
          }
        }
      }
      return { width: width, height: height, pixels: pixels, pals: pals, originX: -minX, originY: -minY };
    }

    function paletteAt(rom, palAddr) {
      const addr = (palAddr && palAddr > 0) ? palAddr : 0xad0b;
      const base = snesToRom(0x900000 | addr);
      const out = [];
      for (let i = 0; i < 16; i++) {
        const off = base + i * 2;
        if (off + 2 <= rom.length) {
          const c = rom[off] | (rom[off + 1] << 8);
          out.push([
            (c & 31) * 8,
            ((c >> 5) & 31) * 8,
            ((c >> 10) & 31) * 8,
          ]);
        } else {
          out.push([0, 0, 0]);
        }
      }
      return out;
    }

    function characterPalette(rom, characterOrPal) {
      if (typeof characterOrPal === 'number' && characterOrPal > 256) {
        return paletteAt(rom, characterOrPal);
      }
      const CHARACTER_TABLE = 0x8eb678;
      const CHARACTER_STRIDE = 74;
      let addr = 0xad0b;
      try {
        const recOffset = snesToRom(CHARACTER_TABLE + (characterOrPal || 0) * CHARACTER_STRIDE + 0x09);
        if (recOffset >= 0 && recOffset + 2 <= rom.length) {
          addr = rom[recOffset] | (rom[recOffset + 1] << 8);
        }
      } catch (_) {}
      return paletteAt(rom, addr);
    }

    const spriteCache = new Map();

    // The 16 colours of OBJ palette pal (0..7) in the engine's CGRAM mirror.
    function liveObjPalette(cg, pal) {
      const out = [];
      const base = 256 + (pal & 7) * 32;
      for (let i = 0; i < 16; i++) {
        const c = cg[base + i * 2] | (cg[base + i * 2 + 1] << 8);
        out.push([(c & 31) * 8, ((c >> 5) & 31) * 8, ((c >> 10) & 31) * 8]);
      }
      return out;
    }

    // live: { cg, slot } - draw from the colours the engine has actually
    // loaded in the entity's OBJ slot (and slot + a chunk's palette bits).
    // That is right for palettes an animation script loads (placeholder
    // effects), the ring menu's greyed enemies, flashes; the ROM address in
    // $7E1278 is only the fallback.
    function getDecodedSprite(rom, spritePtr, palAddr, live) {
      let key = spritePtr + '_' + (palAddr || 0xad0b);
      let livePals = null;
      if (live && live.cg && live.cg.length >= 512) {
        const first = (live.slot >> 1) & 7;
        livePals = [];
        let sig = '';
        for (let k = 0; k < 2; k++) {
          const pal = (first + k) & 7;
          livePals.push(liveObjPalette(live.cg, pal));
          const base = 256 + pal * 32;
          for (let i = 2; i < 32; i++) sig += live.cg[base + i].toString(16);
        }
        key = spritePtr + '_L' + first + '_' + sig;
      }
      if (spriteCache.has(key)) return spriteCache.get(key);

      try {
        const info = readSpriteInfo(rom, spritePtr);
        if (!info || !info.chunks || info.chunks.length === 0) {
          spriteCache.set(key, null);
          return null;
        }
        const comp = composeSprite(rom, info);
        if (!comp || comp.width <= 0 || comp.height <= 0) {
          spriteCache.set(key, null);
          return null;
        }
        const palette = paletteAt(rom, palAddr);
        const offCanvas = document.createElement('canvas');
        offCanvas.width = comp.width;
        offCanvas.height = comp.height;
        const offCtx = offCanvas.getContext('2d');
        const imgData = offCtx.createImageData(comp.width, comp.height);
        const data = imgData.data;
        const total = comp.width * comp.height;
        for (let i = 0; i < total; i++) {
          const v = comp.pixels[i];
          if (v > 0) {
            const pal = livePals ? (livePals[comp.pals[i] ? 1 : 0]) : palette;
            const col = pal[v] || [255, 255, 255];
            const dst = i * 4;
            data[dst] = col[0];
            data[dst + 1] = col[1];
            data[dst + 2] = col[2];
            data[dst + 3] = 255;
          }
        }
        offCtx.putImageData(imgData, 0, 0);
        const res = {
          canvas: offCanvas,
          originX: comp.originX,
          originY: comp.originY,
          width: comp.width,
          height: comp.height,
        };
        if (spriteCache.size > 256) spriteCache.clear();
        spriteCache.set(key, res);
        return res;
      } catch (_) {
        spriteCache.set(key, null);
        return null;
      }
    }

    // Port of $8FC773 (src/maps/collision.ts spriteDepth): an entity's OAM
    // priority comes from the collision word of the tile under its feet, which
    // $8FAFE5 caches at +0x3C, against its own plane at +0x18. Priority 3
    // draws over the canopy, priority 2 under it, gate nibble 8 not at all.
    function entityDepth(buf, rel) {
      const cw = buf[rel + 0x3C] | (buf[rel + 0x3D] << 8);
      if (((cw ^ 0x0800) & 0x0F00) === 0) return 'hidden';
      const tilePlane = cw & 0x30;
      const ownPlane = buf[rel + 0x18] & 0x30;
      if (ownPlane !== tilePlane) return ownPlane < tilePlane ? 'front' : 'behind';
      return (cw & 0x1000) ? 'front' : 'behind';
    }

    function drawEntityItems(ctx, items) {
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.isOrb) {
          ctx.save();
          const grad = ctx.createRadialGradient(item.x, item.y, 1, item.x, item.y, item.rad);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.4, '#ffea75');
          grad.addColorStop(1, 'rgba(255, 120, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(item.x, item.y, item.rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.drawImage(item.canvas, item.x, item.y, item.w, item.h);
        }
      }
    }

    // Draws the priority-2 entities on Layer 1 and returns the priority-3 ones,
    // which the caller draws over the foreground (Layer 2).
    function renderExtendedEntities(preState, layout, extEntCanvas, extEntCtx) {
      if (!extEntCtx || !extEntCanvas) return [];
      extEntCtx.clearRect(0, 0, layout.wrapW, layout.wrapH);
      if (!extendMapEnabled || !preState || !loadedRomData) return [];

      const rom = (loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData;
      const drawList = [];

      // 1. Entities from WRAM entBuf (0x7E3DDF)
      if (preState.entBuf) {
        const buf = preState.entBuf;
        const entities = [];
        const visited = new Set();
        let curAddr = buf[0] | (buf[1] << 8);
        let safety = 0;
        while (curAddr >= 0x3DE5 && curAddr < 0x4FE5 && !visited.has(curAddr) && safety++ < 32) {
          visited.add(curAddr);
          entities.push(curAddr);
          const rel = curAddr - 0x3DDF;
          if (rel < 0 || rel + 0x60 > buf.length) break;
          const ptrNext = buf[rel + 0x5E] | (buf[rel + 0x5F] << 8);
          if (!ptrNext) break;
          curAddr = ptrNext;
        }
        if (!visited.has(0x4E89)) entities.push(0x4E89);
        if (!visited.has(0x4F37)) entities.push(0x4F37);

        for (let i = 0; i < entities.length; i++) {
          const addr = entities[i];
          const rel = addr - 0x3DDF;
          if (rel < 0 || rel + 0x8E > buf.length) continue;

          // Draw mode 0 ($8FC6C5) draws a main sprite (+0x06, bank +0x08)
          // unless +0x12 bit 15 hides it, and a secondary one (+0x09, bank
          // +0x0B: the shadow) unless bit 14 does. Nothing else hides a listed
          // entity: +0x10 bit 5 is "scripted" (control(NONE), walk(), every
          // cutscene actor), not "invisible" - skipping it lost the intro's cast.
          const hideFlags = buf[rel + 0x12] | (buf[rel + 0x13] << 8);
          const spriteBank = buf[rel + 0x08];
          const spriteAddr = buf[rel + 0x06] | (buf[rel + 0x07] << 8);
          const mainOk = !(hideFlags & 0x8000) && spriteBank >= 0xC0 && spriteBank <= 0xDF && spriteAddr >= 3;
          const secBank = buf[rel + 0x0B];
          const secAddr = buf[rel + 0x09] | (buf[rel + 0x0A] << 8);
          const secOk = !(hideFlags & 0x4000) && secBank >= 0xC0 && secBank <= 0xDF && secAddr >= 3;
          if (!mainOk && !secOk) continue;

          const isBoy = (addr === 0x4E89);
          const isDog = (addr === 0x4F37);
          const depth = entityDepth(buf, rel);
          if (depth === 'hidden') continue;

          const rawX = buf[rel + 0x1A] | (buf[rel + 0x1B] << 8);
          const posX = rawX >= 0x8000 ? rawX - 0x10000 : rawX;
          const rawY = buf[rel + 0x1C] | (buf[rel + 0x1D] << 8);
          const posY = rawY >= 0x8000 ? rawY - 0x10000 : rawY;
          const rawZ = buf[rel + 0x1E] | (buf[rel + 0x1F] << 8);
          const posZ = rawZ >= 0x8000 ? rawZ - 0x10000 : rawZ;

          // +0x0C is the entity's palette slot; $7E1278 holds the ROM address
          // of the palette loaded in each slot. That is the engine's own answer
          // for the Boy and Dog too (the Dog's changes per act and per floor).
          const slotOffset = buf[rel + 0x0C] & 0x0E;
          let palAddr = preState.palSlotBuf ? (preState.palSlotBuf[slotOffset] | (preState.palSlotBuf[slotOffset + 1] << 8)) : 0;
          if (!palAddr) {
            if (isBoy) {
              palAddr = 0xAD0B;
            } else if (isDog) {
              palAddr = getDogPalette(preState.mapId, spriteBank);
            } else {
              const stype = buf[rel + 0x60] | (buf[rel + 0x61] << 8);
              if (stype >= 0x8000) {
                const recOffset = snesToRom(0x8E0000 | (stype + 0x09));
                if (recOffset >= 0 && recOffset + 2 <= rom.length) {
                  palAddr = rom[recOffset] | (rom[recOffset + 1] << 8);
                }
              }
            }
          }
          if (!palAddr) palAddr = 0xAD0B;

          // $8FC7E8: in a room with effect 2 a plane-0 character is placed
          // against BG1's scroll (it belongs to the parallax layer), and two
          // lines lower than the camera formula gives.
          const onBg1 = preState.roomEffect === 2 && (buf[rel + 0x18] & 0x30) === 0;
          const refX = onBg1 ? preState.bg1X : layout.camX;
          const refY = onBg1 ? preState.bg1Y - 2 : layout.camY;
          const live = { cg: preState.cgramBuf, slot: slotOffset };
          // The secondary sprite sits on the ground (no height) and sorts
          // just behind the main one, as the engine queues it.
          const parts = [];
          if (secOk) parts.push({ ptr: (secBank << 16) | secAddr, lift: 0, sort: posY - 0.5 });
          if (mainOk) parts.push({ ptr: (spriteBank << 16) | spriteAddr, lift: Math.floor(posZ / 16), sort: posY });
          for (let k = 0; k < parts.length; k++) {
            const sprite = getDecodedSprite(rom, parts[k].ptr, palAddr, live);
            if (!sprite) continue;
            const screenX = layout.emuX + (posX - sprite.originX - refX) * layout.scaleSnes;
            const screenY = layout.emuY + (posY - sprite.originY - parts[k].lift - refY) * layout.scaleSnes;
            const screenW = sprite.width * layout.scaleSnes;
            const screenH = sprite.height * layout.scaleSnes;
            if (screenX + screenW <= 0 || screenX >= layout.wrapW || screenY + screenH <= 0 || screenY >= layout.wrapH) continue;
            drawList.push({
              canvas: sprite.canvas,
              x: screenX,
              y: screenY,
              w: screenW,
              h: screenH,
              sortY: parts[k].sort,
              front: depth === 'front',
            });
          }
        }
      }

      // 2. Projectiles from WRAM projBuf (0x7E6387, 8 slots * 44 bytes)
      if (preState.projBuf) {
        const pbuf = preState.projBuf;
        for (let p = 0; p < 8; p++) {
          const rel = p * 44;
          const active = pbuf[rel + 0x10] | (pbuf[rel + 0x11] << 8);
          if (!active) continue;

          // Coordinates are 1/16 subpixels in WRAM ($90DE88 shifts right 4 bits)
          const rawX = pbuf[rel + 0x14] | (pbuf[rel + 0x15] << 8);
          const posX = Math.floor((rawX >= 0x8000 ? rawX - 0x10000 : rawX) / 16);
          const rawY = pbuf[rel + 0x16] | (pbuf[rel + 0x17] << 8);
          const posY = Math.floor((rawY >= 0x8000 ? rawY - 0x10000 : rawY) / 16);
          const rawZ = pbuf[rel + 0x18] | (pbuf[rel + 0x19] << 8);
          const posZ = Math.floor((rawZ >= 0x8000 ? rawZ - 0x10000 : rawZ) / 16);

          const spriteBank = pbuf[rel + 0x08];
          const spriteAddr = pbuf[rel + 0x06] | (pbuf[rel + 0x07] << 8);
          const slotOffset = pbuf[rel + 0x0C] & 0x0E;
          const palAddr = preState.palSlotBuf ? (preState.palSlotBuf[slotOffset] | (preState.palSlotBuf[slotOffset + 1] << 8)) : 0;

          let sprite = null;
          if (spriteBank >= 0xC0 && spriteBank <= 0xDF && spriteAddr >= 3) {
            const spritePtr = (spriteBank << 16) | spriteAddr;
            sprite = getDecodedSprite(rom, spritePtr, palAddr || 0xad0b, { cg: preState.cgramBuf, slot: slotOffset });
          }

          if (sprite) {
            const roomSpriteX = posX - sprite.originX;
            const roomSpriteY = posY - sprite.originY - posZ;
            const screenX = layout.emuX + (roomSpriteX - layout.camX) * layout.scaleSnes;
            const screenY = layout.emuY + (roomSpriteY - layout.camY) * layout.scaleSnes;
            const screenW = sprite.width * layout.scaleSnes;
            const screenH = sprite.height * layout.scaleSnes;

            if (screenX + screenW > 0 && screenX < layout.wrapW && screenY + screenH > 0 && screenY < layout.wrapH) {
              drawList.push({
                canvas: sprite.canvas,
                x: screenX,
                y: screenY,
                w: screenW,
                h: screenH,
                sortY: posY,
                front: true,
              });
            }
          } else {
            const screenX = layout.emuX + (posX - layout.camX) * layout.scaleSnes;
            const screenY = layout.emuY + (posY - posZ - layout.camY) * layout.scaleSnes;
            const rad = Math.max(3, Math.round(5 * layout.scaleSnes));
            if (screenX + rad > 0 && screenX - rad < layout.wrapW && screenY + rad > 0 && screenY - rad < layout.wrapH) {
              drawList.push({
                isOrb: true,
                x: screenX,
                y: screenY,
                rad: rad,
                sortY: posY,
                front: true,
              });
            }
          }
        }
      }

      drawList.sort((a, b) => a.sortY - b.sortY);
      drawEntityItems(extEntCtx, drawList.filter(item => !item.front));
      return drawList.filter(item => item.front);
    }

    // readMemoryRange caps a call at 4096 bytes (the core's static buffer) and
    // returns a short array past that, which silently cut the Boy ($4E89) and
    // Dog ($4F37) off the end of the entity table.
    function readMemoryChunked(m, addr, size) {
      const out = new Uint8Array(size);
      for (let off = 0; off < size; off += 4096) {
        const n = Math.min(4096, size - off);
        out.set(m.readMemoryRange(addr + off, n).subarray(0, n), off);
      }
      return out;
    }

    function samplePreLoopState() {
      const m = getModule();
      if (!m || !hasDebuggerApi(m) || !loadedRomData) return null;
      let camX = 0, camY = 0, mapId = -1, trigOffX = 0, trigOffY = 0, bg1X = 0, bg1Y = 0;
      let iniDisp = 0x0F, cgramBuf = null, mainScreen = 0x17, roomEffect = 0;
      let entBuf = null, palSlotBuf = null, projBuf = null, objStateBuf = null, grassQueueBuf = null, animIdxBuf = null;

      try {
        const camBuf = m.readMemoryRange(0x7E0112, 4);
        if (!camBuf || camBuf.length < 4) return null;
        const rawX = camBuf[0] | (camBuf[1] << 8);
        camX = rawX >= 0x8000 ? rawX - 0x10000 : rawX;
        const rawY = camBuf[2] | (camBuf[3] << 8);
        camY = rawY >= 0x8000 ? rawY - 0x10000 : rawY;
        bg1X = camX;
        bg1Y = camY;

        // BG1 (the canopy layer) scrolls from its own shadow. Most rooms copy
        // the camera into it; a parallax room feeds it from elsewhere
        // ($D09B7A: BG1 from $12/$14, BG2 from the camera $59/$5B).
        const bg1Buf = m.readMemoryRange(0x7E010E, 4);
        if (bg1Buf && bg1Buf.length >= 4) {
          const b1x = bg1Buf[0] | (bg1Buf[1] << 8);
          const b1y = bg1Buf[2] | (bg1Buf[3] << 8);
          bg1X = b1x >= 0x8000 ? b1x - 0x10000 : b1x;
          bg1Y = b1y >= 0x8000 ? b1y - 0x10000 : b1y;
        }

        const mapBuf = m.readMemoryRange(0x7E0ADB, 1);
        if (mapBuf && mapBuf.length >= 1) mapId = mapBuf[0];

        const offBuf = m.readMemoryRange(0x7E0F86, 4);
        if (offBuf && offBuf.length >= 4) {
          const rawOX = offBuf[0] | (offBuf[1] << 8);
          trigOffX = rawOX >= 0x8000 ? rawOX - 0x10000 : rawOX;
          const rawOY = offBuf[2] | (offBuf[3] << 8);
          trigOffY = rawOY >= 0x8000 ? rawOY - 0x10000 : rawOY;
        }

        // The PPU itself when the core exposes it: read before mainLoop() it is
        // exactly what this frame renders with. The game's own shadows run
        // ahead of the picture (the CGRAM mirror by a frame or more, through
        // the upload queue), which showed as the ring menu and death fades
        // landing early on the extended layers.
        const ppu = typeof m._getPpuView === 'function' ? m._getPpuView() : 0;
        if (ppu && typeof HEAPU8 !== 'undefined') {
          cgramBuf = HEAPU8.slice(ppu, ppu + 512);
          iniDisp = HEAPU8[ppu + 512];
          mainScreen = HEAPU8[ppu + 513];
        } else {
          const iniBuf = m.readMemoryRange(INIDISP_SHADOW, 1);
          if (iniBuf && iniBuf.length >= 1) iniDisp = iniBuf[0];
          // One frame behind the mirror is when it reaches CGRAM.
          cgramBuf = lastCgramMirror;
          lastCgramMirror = m.readMemoryRange(CGRAM_MIRROR, 512);
        }
        const effBuf = m.readMemoryRange(ROOM_EFFECT, 1);
        if (effBuf && effBuf.length >= 1) roomEffect = effBuf[0];

        entBuf = readMemoryChunked(m, 0x7E3DDF, 0x1220);
        palSlotBuf = m.readMemoryRange(0x7E1278, 16);
        projBuf = m.readMemoryRange(0x7E6387, 352);
        objStateBuf = m.readMemoryRange(0x7E10CE, 64);
        grassQueueBuf = m.readMemoryRange(0x7E0FD0, 148);
        animIdxBuf = m.readMemoryRange(ANIM_FRAME_INDEX_ADDR, ANIM_MAX_CHANNELS);
      } catch (_) {
        return null;
      }

      return {
        camX: camX,
        camY: camY,
        bg1X: bg1X,
        bg1Y: bg1Y,
        iniDisp: iniDisp,
        cgramBuf: cgramBuf,
        mainScreen: mainScreen,
        roomEffect: roomEffect,
        mapId: mapId,
        trigOffX: trigOffX,
        trigOffY: trigOffY,
        entBuf: entBuf,
        palSlotBuf: palSlotBuf,
        projBuf: projBuf,
        objStateBuf: objStateBuf,
        grassQueueBuf: grassQueueBuf,
        animIdxBuf: animIdxBuf,
      };
    }

    // The engine's INIDISP shadow (NMI copies it to $2100): bit 7 forced
    // blank, low nibble brightness. Room loads and fade_in()/fade_out() and
    // dying go through it.
    const INIDISP_SHADOW = 0x7E0106;
    // The engine's CGRAM mirror (512 bytes, DMA'd to CGRAM). The ring menu
    // halves every colour here rather than using colour math.
    const CGRAM_MIRROR = 0x7E6187;
    // Room header byte 8. Effect 2 ($D09BA7) scrolls BG1 on its own, and
    // $8FC7E8 then places plane-0 characters against BG1, not the camera.
    const ROOM_EFFECT = 0x7E241F;
    let lastCgramMirror = null;

    function bgr15(v) { return [v & 31, (v >> 5) & 31, (v >> 10) & 31]; }
    function median(a) {
      if (!a.length) return 1;
      a.sort((x, y) => x - y);
      return a[a.length >> 1];
    }

    // INIDISP brightness, 0..1 (0 in forced blank). It darkens everything the
    // PPU outputs, so it goes on every extended canvas.
    function screenBrightness(preState) {
      const ini = preState.iniDisp;
      return (ini & 0x80) ? 0 : (ini & 0x0F) / 15;
    }

    // How the BG colours are dimmed/greyed relative to the room's own: the
    // median ratio of the CGRAM mirror against the room palette (colours the
    // room defines only, so engine-loaded sub-palettes and a few cycling
    // colours do not count). Sprites need none of this: they are drawn from
    // the live mirror already.
    function paletteTint(preState, roomPalette) {
      let brightness = 1;
      let saturate = 1;
      const cg = preState.cgramBuf;
      if (cg && cg.length >= 256 && roomPalette && roomPalette.length >= 128) {
        const lum = [];
        const chroma = [];
        for (let c = 16; c < 128; c++) {
          if (!(c & 15)) continue; // colour 0 of a sub-palette is transparent
          const want = bgr15(roomPalette[c]);
          const wantSum = want[0] + want[1] + want[2];
          if (wantSum < 6) continue;
          const have = bgr15(cg[c * 2] | (cg[c * 2 + 1] << 8));
          const haveSum = have[0] + have[1] + have[2];
          const r = haveSum / wantSum;
          lum.push(r);
          const wantChroma = Math.max(want[0], want[1], want[2]) - Math.min(want[0], want[1], want[2]);
          if (wantChroma >= 4 && r > 0.05) {
            const haveChroma = Math.max(have[0], have[1], have[2]) - Math.min(have[0], have[1], have[2]);
            chroma.push(haveChroma / (wantChroma * r));
          }
        }
        // Too few comparable colours (a room with no palette yet): no claim.
        if (lum.length >= 8) {
          brightness = Math.min(1.5, median(lum));
          if (chroma.length >= 8) saturate = Math.min(1.5, median(chroma));
        }
      }
      return { brightness: brightness, saturate: saturate };
    }

    function tintFilter(brightness, saturate) {
      const b = Math.round(brightness * 100) / 100;
      const sat = Math.round(saturate * 100) / 100;
      return (b >= 0.99 && b <= 1.01 && sat >= 0.97 && sat <= 1.03) ? 'none' : 'brightness(' + b + ') saturate(' + sat + ')';
    }

    let lastBrightnessFilter = '';
    function applyScreenBrightness(brightness, canvases) {
      const f = tintFilter(brightness, 1);
      const filter = f === 'none' ? '' : f;
      if (filter === lastBrightnessFilter) return;
      lastBrightnessFilter = filter;
      for (let i = 0; i < canvases.length; i++) if (canvases[i]) canvases[i].style.filter = filter;
    }

    // The engine's per-channel animation state: frame index at $7E4FE6 + ch,
    // countdown at $7E5018 + ch (found by watching WRAM; the holds match the
    // decoded delays). Stepping from it keeps the extension in phase with the
    // screen, and still where the engine has paused a channel.
    const ANIM_FRAME_INDEX_ADDR = 0x7E4FE6;
    const ANIM_MAX_CHANNELS     = 0x32;

    // A group's frames step through the lcm of its channels' frame counts, so
    // the step is the one whose position in every channel matches the engine.
    function animGroupStep(grp, idxBuf) {
      const chans = grp.channels;
      if (!idxBuf || !chans || !chans.length) return 0;
      const steps = grp.frames.length;
      for (let s = 0; s < steps; s++) {
        let ok = true;
        for (let i = 0; i < chans.length; i++) {
          if (s % (grp.chanLens[i] || 1) !== idxBuf[chans[i]]) { ok = false; break; }
        }
        if (ok) return s;
      }
      // Channels out of step with each other (or capped steps): follow the first.
      return idxBuf[chans[0]] % steps;
    }

    function renderExtendedMapAndOverlays(preState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx) {
      if (!preState || !loadedRomData) {
        if (extOverCtx && extOverCanvas) extOverCtx.clearRect(0, 0, extOverCanvas.width, extOverCanvas.height);
        if (extFgCtx && extFgCanvas) extFgCtx.clearRect(0, 0, extFgCanvas.width, extFgCanvas.height);
        if (extEntCtx && extEntCanvas) extEntCtx.clearRect(0, 0, extEntCanvas.width, extEntCanvas.height);
        if (extMapCtx && extMapCanvas) extMapCtx.clearRect(0, 0, extMapCanvas.width, extMapCanvas.height);
        return;
      }

      const camX = preState.camX;
      const camY = preState.camY;
      const mapId = preState.mapId;
      let trigOffX = preState.trigOffX;
      let trigOffY = preState.trigOffY;

      if (mapId < 0 || mapId > 0x90) {
        if (extOverCtx && extOverCanvas) extOverCtx.clearRect(0, 0, extOverCanvas.width, extOverCanvas.height);
        if (extFgCtx && extFgCanvas) extFgCtx.clearRect(0, 0, extFgCanvas.width, extFgCanvas.height);
        if (extEntCtx && extEntCanvas) extEntCtx.clearRect(0, 0, extEntCanvas.width, extEntCanvas.height);
        if (extMapCtx && extMapCanvas) extMapCtx.clearRect(0, 0, extMapCanvas.width, extMapCanvas.height);
        return;
      }

      if (mapId !== cachedMapId) {
        cachedMapId = mapId;
        cachedTriggers = parseRoomTriggers(loadedRomData, mapId);
        spriteCache.clear();
        cutGrassTileSet.clear();
        lastRequestedObjKey = '';
        lastRequestedGrassKey = '';
        roomParallax = false;
      }

      // Parallax: BG1 off the camera. A 16-bit wrap or a masked mode would
      // give a huge offset; that is not a room scrolling, so it is ignored.
      const bg1DX = (preState.bg1X ?? camX) - camX;
      const bg1DY = (preState.bg1Y ?? camY) - camY;
      if ((bg1DX || bg1DY) && Math.abs(bg1DX) < 0x1000 && Math.abs(bg1DY) < 0x1000) roomParallax = true;

      let objectStates = null;
      let objKey = '';
      if (preState.objStateBuf) {
        const mapObj = {};
        let anyObj = false;
        for (let o = 0; o < preState.objStateBuf.length; o++) {
          const val = preState.objStateBuf[o];
          if (val > 0) {
            mapObj[o] = val;
            anyObj = true;
          }
        }
        if (anyObj) {
          objectStates = mapObj;
          objKey = JSON.stringify(objectStates);
        }
      }

      if (preState.grassQueueBuf) {
        const gbuf = preState.grassQueueBuf;
        for (let s = 0; s < 24; s++) {
          const cur = gbuf[2 + s];
          if (cur > 0) {
            const tx = gbuf[0x62 + s * 2];
            const ty = gbuf[0x63 + s * 2];
            cutGrassTileSet.add(tx + ',' + ty);
          }
        }
      }
      const cutTiles = cutGrassTileSet.size > 0 ? Array.from(cutGrassTileSet) : null;
      const grassKey = cutTiles ? cutTiles.sort().join(';') : '';

      if (mapId !== lastRequestedMapId || objKey !== lastRequestedObjKey || grassKey !== lastRequestedGrassKey || roomParallax !== lastRequestedLayered) {
        lastRequestedMapId = mapId;
        lastRequestedObjKey = objKey;
        lastRequestedGrassKey = grassKey;
        lastRequestedLayered = roomParallax;
        if (vscodeApi) {
          vscodeApi.postMessage({
            command: 'requestRoomMap',
            mapId: mapId,
            objectStates: objectStates,
            cutGrassTiles: cutTiles,
            layered: roomParallax,
          });
        }
      }

      if (cachedTriggers && trigOffX === 0 && trigOffY === 0 && (cachedTriggers.offX || cachedTriggers.offY)) {
        trigOffX = cachedTriggers.offX;
        trigOffY = cachedTriggers.offY;
      }

      const wrapW = extMapCanvas ? extMapCanvas.width : (canvas.parentElement ? canvas.parentElement.clientWidth : 512);
      const wrapH = extMapCanvas ? extMapCanvas.height : (canvas.parentElement ? canvas.parentElement.clientHeight : 448);
      const emuW = parseFloat(canvas.style.width) || 512;
      const emuH = parseFloat(canvas.style.height) || 448;
      const emuX = parseFloat(canvas.style.left) || Math.round((wrapW - emuW) / 2);
      const emuY = parseFloat(canvas.style.top) || Math.round((wrapH - emuH) / 2);
      const scaleSnes = emuW / 256;

      const layout = {
        wrapW: wrapW,
        wrapH: wrapH,
        emuX: emuX,
        emuY: emuY,
        emuW: emuW,
        emuH: emuH,
        scaleSnes: scaleSnes,
        camX: camX,
        camY: camY,
        trigOffX: trigOffX,
        trigOffY: trigOffY,
      };
      lastLayout = layout;

      // Parallax rooms: each layer at its own scroll, under/over the sprites
      // in the PPU's order. Animated cells keep their first frame here (the
      // animation overlays are composites of both layers).
      const roomMap = (extendMapEnabled && activeRoomMap && activeRoomMap.mapId === mapId) ? activeRoomMap : null;
      const layered = roomParallax && roomMap && roomMap.layers ? roomMap.layers : null;
      // Main screen (TM): a title card or cutscene that turns BG1/BG2 or the
      // sprites off leaves only the backdrop there, so the extension shows
      // the same instead of the room.
      const tm = preState.mainScreen === undefined ? 0x17 : preState.mainScreen;
      const bgShown = (tm & 0x03) !== 0;
      const objShown = (tm & 0x10) !== 0;
      // Palette dimming (ring menu) on the room images only; brightness on
      // the canvases (below) covers fades and forced blank.
      const tint = paletteTint(preState, roomMap ? roomMap.bgPalette : null);
      const mapFilter = tintFilter(tint.brightness, tint.saturate);
      const drawLayer = (lctx, img, scrollX, scrollY) => {
        if (!img || !img.complete || !img.naturalWidth) return;
        lctx.drawImage(img, emuX - scrollX * scaleSnes, emuY - (scrollY + 1) * scaleSnes,
          roomMap.width * scaleSnes, roomMap.height * scaleSnes);
      };

      // 1. Extended map background (Layer 0) - shifted 1 SNES pixel up to fix vertical seam
      if (extMapCtx && extMapCanvas) {
        extMapCtx.clearRect(0, 0, wrapW, wrapH);
        extMapCtx.filter = mapFilter;
        if (!bgShown) {
          if (roomMap) {
            extMapCtx.fillStyle = '#000';
            extMapCtx.fillRect(emuX - camX * scaleSnes, emuY - (camY + 1) * scaleSnes, roomMap.width * scaleSnes, roomMap.height * scaleSnes);
          }
        } else if (layered) {
          extMapCtx.imageSmoothingEnabled = false;
          extMapCtx.fillStyle = '#000';
          extMapCtx.fillRect(emuX - camX * scaleSnes, emuY - (camY + 1) * scaleSnes, roomMap.width * scaleSnes, roomMap.height * scaleSnes);
          drawLayer(extMapCtx, layered.bg2Low, camX, camY);
          drawLayer(extMapCtx, layered.bg1Low, preState.bg1X, preState.bg1Y);
        } else if (roomMap && roomMap.img) {
          const mapX = emuX - camX * scaleSnes;
          const mapY = emuY - (camY + 1) * scaleSnes;
          const mapW = activeRoomMap.width * scaleSnes;
          const mapH = activeRoomMap.height * scaleSnes;
          extMapCtx.imageSmoothingEnabled = false;
          extMapCtx.drawImage(activeRoomMap.img, mapX, mapY, mapW, mapH);

          if (activeRoomMap.animGroups && activeRoomMap.animGroups.length) {
            for (let g = 0; g < activeRoomMap.animGroups.length; g++) {
              const grp = activeRoomMap.animGroups[g];
              if (!grp.frames || grp.frames.length <= 1) continue;
              grp.frameIdx = animGroupStep(grp, preState.animIdxBuf);
              const curFrame = grp.frames[grp.frameIdx];
              if (curFrame && curFrame.complete && curFrame.naturalWidth > 0) {
                const gx = mapX + grp.x * scaleSnes;
                const gy = mapY + grp.y * scaleSnes;
                const gw = grp.w * scaleSnes;
                const gh = grp.h * scaleSnes;
                extMapCtx.drawImage(curFrame, gx, gy, gw, gh);
              }
            }
          }
        }
      }

      // 2. Extended entities (Layer 1); priority-3 ones come back for Layer 2
      let frontEntities = [];
      if (extEntCtx && extEntCanvas) {
        frontEntities = renderExtendedEntities(preState, layout, extEntCanvas, extEntCtx);
        if (!objShown) {
          extEntCtx.clearRect(0, 0, wrapW, wrapH);
          frontEntities = [];
        }
      }

      // 3. Extended foreground priority tiles (Layer 2)
      if (extFgCtx && extFgCanvas) {
        extFgCtx.clearRect(0, 0, wrapW, wrapH);
        extFgCtx.filter = mapFilter;
        if (!bgShown) {
          // nothing of the room in front of the sprites either
        } else if (layered) {
          extFgCtx.imageSmoothingEnabled = false;
          drawLayer(extFgCtx, layered.bg2High, camX, camY);
          drawLayer(extFgCtx, layered.bg1High, preState.bg1X, preState.bg1Y);
        } else if (roomMap) {
          const mapX = emuX - camX * scaleSnes;
          const mapY = emuY - (camY + 1) * scaleSnes;
          const mapW = activeRoomMap.width * scaleSnes;
          const mapH = activeRoomMap.height * scaleSnes;
          extFgCtx.imageSmoothingEnabled = false;
          if (activeRoomMap.foregroundImg && activeRoomMap.foregroundImg.complete && activeRoomMap.foregroundImg.naturalWidth > 0) {
            extFgCtx.drawImage(activeRoomMap.foregroundImg, mapX, mapY, mapW, mapH);
          }
          if (activeRoomMap.animGroups && activeRoomMap.animGroups.length) {
            for (let g = 0; g < activeRoomMap.animGroups.length; g++) {
              const grp = activeRoomMap.animGroups[g];
              // Priority half only; null when the group has none.
              const curFrame = grp.fgFrames ? grp.fgFrames[grp.frameIdx || 0] : null;
              if (curFrame && curFrame.complete && curFrame.naturalWidth > 0) {
                const gx = mapX + grp.x * scaleSnes;
                const gy = mapY + grp.y * scaleSnes;
                const gw = grp.w * scaleSnes;
                const gh = grp.h * scaleSnes;
                extFgCtx.drawImage(curFrame, gx, gy, gw, gh);
              }
            }
          }
        }
        extFgCtx.filter = 'none';
        drawEntityItems(extFgCtx, frontEntities);
      }

      // Follow the screen's fades (the triggers overlay stays lit).
      applyScreenBrightness(screenBrightness(preState), [extMapCanvas, extEntCanvas, extFgCanvas]);

      // 4. Extended triggers overlay (Layer 4)
      if (extOverCtx && extOverCanvas) {
        renderTriggersOverlay(extOverCtx, layout);
      }
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
      if (!Array.isArray(words) || !words.length) return 'none';
      const nonZero = words
        .map((value, index) => ({ index, value }))
        .filter(item => item.value !== 0);
      if (!nonZero.length) return 'none (all 0000)';
      return nonZero.map(item => 'w' + item.index.toString(16).toUpperCase() + '=' + fmtHex(item.value, 4)).join(' ');
    }

    function buildScriptChains(slots) {
      const liveSlots = slots.filter(slot => slot.state === 2 || slot.state === 4);
      if (!liveSlots.length) return [];
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
        const live = state === 2 || state === 4;
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
      const waitingSlots = liveSlots.filter(slot => slot.state === 4);
      return { slots, liveSlots, activeSlots, waitingSlots, chains: buildScriptChains(slots) };
    }

    function renderScriptDetail(snapshot) {
      const detail = document.getElementById('ss-detail');
      if (!detail) return;
      const lines = [];

      if (snapshot.activeSlots.length > 0) {
        lines.push('active: ' + snapshot.activeSlots.map(slotShort).join(', '));
      } else if (snapshot.waitingSlots && snapshot.waitingSlots.length > 0) {
        lines.push('active: none (' + snapshot.waitingSlots.length + ' waiting)');
      } else {
        lines.push('active: none (all slots idle)');
      }

      if (snapshot.chains.length > 0) {
        lines.push('scheduler chain: ' + snapshot.chains.map(chain => chain.map(slotId => 's' + slotId).join(' -> ')).join(' | '));
      } else {
        lines.push('scheduler chain: idle');
      }

      const focus = snapshot.activeSlots[0] || snapshot.liveSlots[0] || null;
      if (focus) {
        lines.push('focus: ' + slotShort(focus) + ' | next=' + (focus.nextSlot >= 0 ? ('s' + focus.nextSlot) : '--') + ' | entity=' + fmtHex(focus.entity, 4) + ' | timer=' + focus.timer1);
        lines.push('args[0x0F..0x2E] words: ' + formatArgWords(focus.argWords));
      } else {
        const lastSlot = snapshot.slots.find(s => s.loc !== 0);
        if (lastSlot) {
          lines.push('last slot: ' + slotShort(lastSlot) + ' | entity=' + fmtHex(lastSlot.entity, 4));
        }
      }

      detail.textContent = lines.join('\\n');
    }

    // Module is always window.Module (set by the Emscripten core script).
    let emulatorPausedState = false;
    function isEmulatorPaused() {
      const m = window.Module;
      return !!(m && typeof m.isEmulationPaused === 'function' && m.isEmulationPaused());
    }

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
      const text = String(raw || '').trim().replace(/^\\$/u, '0x');
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
      const focusSlot = snapshot.activeSlots.length
        ? snapshot.activeSlots[0].slot
        : (snapshot.liveSlots.length ? snapshot.liveSlots[0].slot : -1);

      let html = '';
      const displaySlots = snapshot.liveSlots.length
        ? snapshot.liveSlots
        : snapshot.slots.filter(s => s.loc !== 0 || s.entity !== 0);

      for (const { slot, loc, state, nextSlot, timer1, entity } of displaySlots) {
        const cls   = (state === 2 ? 'exec' : state === 4 ? 'wait' : 'dead') + (slot === focusSlot ? ' focus' : '');
        const sname = stateName(state);
        html += '<tr class="' + cls + '"><td>' + slot + '</td><td>' +
          fmtHex(loc, 6) + '</td><td>' + sname + '</td><td>' +
          (nextSlot >= 0 ? nextSlot : '--') + '</td><td>' +
          fmtHex(entity, 4) + '</td><td>' + timer1 + '</td></tr>';
      }
      if (!html) html = '<tr><td colspan="6" style="color:#555;text-align:center;padding:6px">no active scripts</td></tr>';
      tbody.innerHTML = html;

      const actLen = snapshot.activeSlots.length;
      const waitLen = snapshot.waitingSlots ? snapshot.waitingSlots.length : 0;
      if (actLen > 0 || waitLen > 0) {
        document.getElementById('ss-count').textContent =
          actLen + ' exec' + (waitLen ? ', ' + waitLen + ' wait' : '');
      } else {
        document.getElementById('ss-count').textContent = '0 active (idle)';
      }

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

    /** Start the WRAM polling cycle (called on every boot; one timer per webview). */
    let wramPollTimer = null;
    function startWramPolling() {
      document.getElementById('ss-count').textContent = 'connecting...';
      if (wramPollTimer) return;

      let polledWhilePaused = false;
      function pollOnce() {
        try {
          const m = getModule();
          if (!m) return;
          installDebuggerBridge(m);
          // Paused: one last refresh shows the frozen state, then nothing changes until resume.
          if (isEmulatorPaused()) {
            if (polledWhilePaused) return;
            polledWhilePaused = true;
          } else {
            polledWhilePaused = false;
          }
          const src = readScriptStackRegion();
          refreshDebuggerUi(m, src.mode);
          if (src.bytes) {
            traceHookActivity(src.bytes);
            const snapshot = buildScriptSnapshot(src.bytes);
            updateScriptStack(snapshot);
            reportScriptFocus(snapshot);
            checkManualScriptBreakpoints(snapshot, m);
            checkScriptExecutionTrace();
            if (!tasReplaying()) maintainCheats(m);
            refreshActiveBottomTab();
          } else {
            document.getElementById('ss-count').textContent =
              src.mode === 'connecting' ? 'connecting...' : 'unavailable';
          }
        } catch (_) { /* silently skip on error */ }
      }

      wramPollTimer = setInterval(pollOnce, 250);
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

    function setExtendMap(enabled) {
      extendMapEnabled = !!enabled;
      const chip = document.getElementById('screen-extend-toggle');
      if (chip) {
        if (extendMapEnabled) {
          chip.classList.add('active');
          chip.textContent = 'MAP EXT ON';
        } else {
          chip.classList.remove('active');
          chip.textContent = 'MAP EXT OFF';
        }
      }
      const cb = document.getElementById('ss-extend-toggle');
      if (cb) cb.checked = extendMapEnabled;
      if (!extendMapEnabled) {
        const extMapCanvas = document.getElementById('extended-map');
        if (extMapCanvas) {
          const extCtx = extMapCanvas.getContext('2d');
          if (extCtx) extCtx.clearRect(0, 0, extMapCanvas.width, extMapCanvas.height);
        }
        const extEntCanvas = document.getElementById('extended-entities');
        if (extEntCanvas) {
          const entCtx = extEntCanvas.getContext('2d');
          if (entCtx) entCtx.clearRect(0, 0, extEntCanvas.width, extEntCanvas.height);
        }
        const extFgCanvas = document.getElementById('extended-foreground');
        if (extFgCanvas) {
          const fgCtx = extFgCanvas.getContext('2d');
          if (fgCtx) fgCtx.clearRect(0, 0, extFgCanvas.width, extFgCanvas.height);
        }
      }
    }

    const extendChip = document.getElementById('screen-extend-toggle');
    if (extendChip) {
      extendChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setExtendMap(!extendMapEnabled);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }

    const extendCb = document.getElementById('ss-extend-toggle');
    if (extendCb) {
      extendCb.addEventListener('change', () => {
        setExtendMap(extendCb.checked);
      });
    }

    function setTriggersOverlay(enabled) {
      triggersOverlayEnabled = !!enabled;
      const chip = document.getElementById('screen-trigger-toggle');
      if (chip) {
        if (triggersOverlayEnabled) {
          chip.classList.add('active');
          chip.textContent = 'TRIGGERS ON';
        } else {
          chip.classList.remove('active');
          chip.textContent = 'TRIGGERS OFF';
        }
      }
      const cb = document.getElementById('ss-overlay-toggle');
      if (cb) cb.checked = triggersOverlayEnabled;
      const extOverCanvas = document.getElementById('extended-overlay');
      if (!triggersOverlayEnabled && !fogOfWarEnabled && extOverCanvas) {
        const extCtx = extOverCanvas.getContext('2d');
        if (extCtx) extCtx.clearRect(0, 0, extOverCanvas.width, extOverCanvas.height);
      }
    }

    const triggerChip = document.getElementById('screen-trigger-toggle');
    if (triggerChip) {
      triggerChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setTriggersOverlay(!triggersOverlayEnabled);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }

    const triggerCb = document.getElementById('ss-overlay-toggle');
    if (triggerCb) {
      triggerCb.addEventListener('change', () => {
        setTriggersOverlay(triggerCb.checked);
      });
    }

    function setFogOfWar(enabled) {
      fogOfWarEnabled = !!enabled;
      const chip = document.getElementById('screen-fog-toggle');
      if (chip) {
        if (fogOfWarEnabled) {
          chip.classList.add('active');
          chip.textContent = 'FOG ON';
        } else {
          chip.classList.remove('active');
          chip.textContent = 'FOG OFF';
        }
      }
      const extOverCanvas = document.getElementById('extended-overlay');
      if (!triggersOverlayEnabled && !fogOfWarEnabled && extOverCanvas) {
        const extCtx = extOverCanvas.getContext('2d');
        if (extCtx) extCtx.clearRect(0, 0, extOverCanvas.width, extOverCanvas.height);
      }
    }

    const fogChip = document.getElementById('screen-fog-toggle');
    if (fogChip) {
      fogChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setFogOfWar(!fogOfWarEnabled);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }

    const speedChip = document.getElementById('screen-speed-chip');
    if (speedChip) {
      speedChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setSpeedUp(!speedUp);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
    }

    ${getBottomBarClientScript()}

    ${getCdlFloatScript()}

    ${getCdlClientScript()}

    ${getCdlStripsScript()}

    ${getTasClientScript()}

    ${getFpsClientScript()}

    function selectTab(tabName) {
      currentBottomTab = tabName;
      const tabs = ['trace', 'stack', 'entities', 'alchemy', 'palettes', 'cheats', 'cdl', 'tas', 'debug'];
      for (const t of tabs) {
        const btn = document.getElementById('ss-tab-' + t);
        const view = document.getElementById('ss-view-' + t);
        if (btn) btn.classList.toggle('active', t === tabName);
        if (view) view.classList.toggle('active', t === tabName);
      }
      refreshActiveBottomTab();
    }
    const tabTraceBtn = document.getElementById('ss-tab-trace');
    if (tabTraceBtn) tabTraceBtn.addEventListener('click', () => selectTab('trace'));
    const tabStackBtn = document.getElementById('ss-tab-stack');
    if (tabStackBtn) tabStackBtn.addEventListener('click', () => selectTab('stack'));
    const tabEntitiesBtn = document.getElementById('ss-tab-entities');
    if (tabEntitiesBtn) tabEntitiesBtn.addEventListener('click', () => selectTab('entities'));
    const tabAlchemyBtn = document.getElementById('ss-tab-alchemy');
    if (tabAlchemyBtn) tabAlchemyBtn.addEventListener('click', () => selectTab('alchemy'));
    const tabPalettesBtn = document.getElementById('ss-tab-palettes');
    if (tabPalettesBtn) tabPalettesBtn.addEventListener('click', () => selectTab('palettes'));
    const tabCheatsBtn = document.getElementById('ss-tab-cheats');
    if (tabCheatsBtn) tabCheatsBtn.addEventListener('click', () => selectTab('cheats'));
    const tabCdlBtn = document.getElementById('ss-tab-cdl');
    if (tabCdlBtn) tabCdlBtn.addEventListener('click', () => { selectTab('cdl'); cdlOnTabShown(); });
    const tabTasBtn = document.getElementById('ss-tab-tas');
    if (tabTasBtn) tabTasBtn.addEventListener('click', () => { selectTab('tas'); if (romLoaded) tasRequestList(); });
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
      if (handleCdlMessage(evt.data)) return;
      if (handleTasMessage(evt.data)) return;
      if (evt.data.command === 'debuggerConnectionStatus') {
        setText('ss-debug-link-status', 'dbg: ' + evt.data.text, evt.data.ok ? 'ss-ok' : 'ss-warn');
      } else if (evt.data.command === 'scriptTraceLogged') {
        appendTraceEntries(evt.data.entries);
      } else if (evt.data.command === 'roomMapRendered') {
        if (evt.data.imageUri) {
          const mapId = evt.data.mapId;
          const img = new Image();
          let fgImg = null;
          if (evt.data.foregroundUri) {
            fgImg = new Image();
            fgImg.src = evt.data.foregroundUri;
          }
          const loadedGroups = [];
          if (Array.isArray(evt.data.animGroups)) {
            for (let i = 0; i < evt.data.animGroups.length; i++) {
              const g = evt.data.animGroups[i];
              const toImg = fUri => {
                const fImg = new Image();
                fImg.src = fUri;
                return fImg;
              };
              const frameImgs = (g.frames || []).map(toImg);
              const fgFrameImgs = Array.isArray(g.fgFrames) ? g.fgFrames.map(toImg) : null;
              loadedGroups.push({
                x: g.x,
                y: g.y,
                w: g.w,
                h: g.h,
                channels: Array.isArray(g.channels) ? g.channels : [],
                chanLens: Array.isArray(g.chanLens) ? g.chanLens : [],
                frames: frameImgs,
                fgFrames: fgFrameImgs,
                frameIdx: 0,
              });
            }
          }
          let layerImgs = null;
          if (evt.data.layers) {
            layerImgs = {};
            for (const k of ['bg1Low', 'bg1High', 'bg2Low', 'bg2High']) {
              const uri = evt.data.layers[k];
              if (!uri) continue;
              layerImgs[k] = new Image();
              layerImgs[k].src = uri;
            }
          }
          img.onload = function() {
            activeRoomMap = {
              mapId: mapId,
              img: img,
              foregroundImg: fgImg,
              layers: layerImgs,
              bgPalette: Array.isArray(evt.data.bgPalette) ? evt.data.bgPalette : null,
              animGroups: loadedGroups,
              width: evt.data.width,
              height: evt.data.height,
              offX: evt.data.offX,
              offY: evt.data.offY,
            };
          };
          img.src = evt.data.imageUri;
        }
      } else if (evt.data.command === 'injectEverscript') {
        injectEverscript(evt.data.code);
      } else if (evt.data.command === 'alchemyIconsLoaded') {
        if (evt.data.alchemy) {
          loadedAlchemyIcons = evt.data.alchemy;
          if (currentBottomTab === 'alchemy') {
            const rom = loadedRomData ? ((loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData) : null;
            updateAlchemyTab(lastSampledPreState, rom);
          }
        }
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
    initCdlTab();

    loadCoreScript();
  </script>
</body>
</html>`;
}

module.exports = {
  buildHtml: _buildHtml,
  parseRoomTriggers,
  calculateTriggerBox,
};
