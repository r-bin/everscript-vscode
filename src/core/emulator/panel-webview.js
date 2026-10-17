'use strict';

/**
 * debugger/emulator/panel-webview.js
 *
 * Owns: the emulator webview HTML template.
 * Single export: buildHtml(webview, coreJsUri, coreWasmUri, coreLabel, corePathDisplay, romOfferData, options) -> string
 *   options.profile  'full' or 'recorder' (webview/emulator-profile.js hides what a profile or a
 *                    non-Evermore ROM does not get: elements marked data-needs="full" / "evermore")
 *   options.scripts  webview URIs of the game's page files (Evermore: its rom-game.js), emulator-profile.js,
 *                    emulator-panels.js and replays-list.js,
 *                    loaded before the inline script; options.styles  of webview/emulator-profile.css
 *                    and emulator-panels.css
 *   options.gameView the game's part of the page ({ css, tabButtonsHtml, viewsHtml, clientScript, and its
 *                    pause-menu tabs menuCss, menuTabButtonsHtml, menuPanelsHtml, and its screen layer:
 *                    overlaysScript and overlayTogglesScript, spliced where they ran before, and screenChipsHtml;
 *                    its script VM: stackScript, traceScript, scriptDebugScript, soundSourceScript, soundChipHtml },
 *                    strings; Evermore's: src/games/evermore/emulator/host.js webview()); none for
 *                    the recorder. The page calls into it only behind typeof guards.
 */

const { getCdlCss, getCdlTabButtonHtml, getCdlViewHtml, getCdlClientScript } = require('./cdl-view');
const { getCdlFloatCss, getCdlFloatHtml, getCdlFloatScript } = require('./cdl-float');
const { getCdlStripsScript } = require('./cdl-strips');
const { getFpsCss, getFpsChipHtml, getFpsClientScript } = require('./fps-meter');
const { getTasCss, getTasBadgeHtml, getTasChipHtml, getTasOverlayHtml, getTasViewHtml, getTasClientScript } = require('./tas-view');
const { getMemoryBridgeClientScript } = require('./memory-bridge-view');
const { getApuStreamClientScript } = require('./apu-stream-view');
const { getMenuCss, getMenuHtml, getMenuClientScript } = require('./menu/menu-view');

function _nonce() {
    let n = '';
    const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) n += ch[Math.floor(Math.random() * ch.length)];
    return n;
}

// -----------------------------------------------------------------------------
//  HTML template
// -----------------------------------------------------------------------------

function _buildHtml(webview, coreJsUri, coreWasmUri, coreLabel, corePathDisplay, romOfferData, options) {
    const nonce = _nonce();
    const opts = options || {};
    const profile = opts.profile === 'recorder' ? 'recorder' : 'full';
    const game = Object.assign({ css: '', tabButtonsHtml: '', viewsHtml: '', clientScript: '', menuCss: '', menuTabButtonsHtml: '', menuPanelsHtml: '',
        overlaysScript: '', overlayTogglesScript: '', screenChipsHtml: '', stackScript: '', traceScript: '', scriptDebugScript: '',
        soundSourceScript: '', soundChipHtml: '' }, opts.gameView || {});
    const config = JSON.stringify({ profile }).replace(/</g, '\\u003c');
    const files = (opts.styles || []).map(u => `<link rel="stylesheet" href="${u}">`)
        .concat((opts.scripts || []).map(u => `<script src="${u}"></script>`)).join('\n  ');

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
    #menu-inspect-card {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: 480px;
      max-width: 94%;
      background: #14141c;
      border: 1px solid #36364a;
      border-radius: 5px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.9);
      z-index: 70;
      color: #ccc;
      font-family: monospace;
      font-size: 11px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto !important;
    }
    #menu-inspect-card.hidden {
      display: none !important;
    }
    .inspect-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 10px;
      background: #1c1c28;
      border-bottom: 1px solid #2d2d3e;
      font-weight: bold;
      color: #4ec9b0;
    }
    #inspect-close-btn {
      background: transparent;
      border: none;
      color: #778899;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 3px;
    }
    #inspect-close-btn:hover {
      color: #ff6666;
      background: rgba(255, 100, 100, 0.15);
    }
    .inspect-body {
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 220px;
      overflow-y: auto;
    }
    .inspect-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      padding: 5px 10px;
      background: #181822;
      border-top: 1px solid #282836;
    }
    .inspect-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .inspect-label {
      color: #8899aa;
    }
    .inspect-val {
      color: #fff;
      font-weight: 600;
    }
    .inspect-script-box {
      background: #0d0d12;
      border: 1px solid #242432;
      border-radius: 3px;
      padding: 6px 8px;
      font-size: 10px;
      line-height: 1.4;
      max-height: 110px;
      overflow-y: auto;
      white-space: pre-wrap;
      color: #9cdcfe;
    }
    .inspect-states-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .inspect-state-btn {
      background: #1e1e28;
      border: 1px solid #36364a;
      color: #aaa;
      padding: 3px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-family: inherit;
    }
    .inspect-state-btn:hover {
      background: #303040;
      color: #fff;
    }
    .inspect-state-btn.active {
      background: rgba(78, 201, 176, 0.2);
      border-color: #4ec9b0;
      color: #4ec9b0;
      font-weight: bold;
    }
    .inspect-danger-btn {
      background: #421616 !important;
      border-color: #882b2b !important;
      color: #ffaaaa !important;
    }
    .inspect-danger-btn:hover {
      background: #622020 !important;
      color: #fff !important;
    }
    #screen-overlay-bar {
      display: none !important;
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 20;
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
    /* -- ROM picker overlay --------------------------------------------- */
    #overlay {
      position: fixed; inset: 0; z-index: 100;
      display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start;
      background: #0f0f11; color: #ccc; padding: 12px 16px 10px;
      overflow: hidden; box-sizing: border-box;
    }
    .overlay-card {
      width: 100%; max-width: 480px; height: 100%; max-height: 100%;
      display: flex; flex-direction: column;
      align-items: stretch; gap: 8px; box-sizing: border-box;
    }
    .overlay-header {
      text-align: center; flex-shrink: 0;
    }
    .overlay-header h2 {
      margin: 0; color: #eee; font-size: 17px; font-weight: 600; letter-spacing: -0.01em;
    }
    .overlay-subtitle {
      font-size: 11px; color: #666; margin-top: 1px; font-family: monospace;
    }

    /* Drag and Drop Zone */
    #rom-drop-zone {
      width: 100%; box-sizing: border-box; flex-shrink: 0;
      border: 2px dashed #33333d; border-radius: 8px;
      background: rgba(255, 255, 255, 0.02);
      padding: 8px 12px; text-align: center;
      cursor: pointer; user-select: none;
      transition: border-color 0.15s, background 0.15s, transform 0.15s;
      display: flex; flex-direction: column; align-items: center; gap: 2px;
    }
    #rom-drop-zone:hover {
      border-color: #4a4a58;
      background: rgba(255, 255, 255, 0.04);
    }
    #rom-drop-zone.drag-active, body.window-drag-active #rom-drop-zone {
      border-color: #1a6;
      background: rgba(17, 170, 102, 0.12);
      box-shadow: 0 0 14px rgba(17, 170, 102, 0.25);
      transform: scale(1.01);
    }
    .drop-zone-icon {
      font-size: 20px; line-height: 1; margin-bottom: 1px;
    }
    .drop-zone-title {
      font-size: 12px; font-weight: 600; color: #ddd;
    }
    .drop-zone-sub {
      font-size: 10px; color: #777;
    }

    /* Action Buttons Row */
    .overlay-action-row {
      display: flex; width: 100%; gap: 8px; flex-shrink: 0;
    }
    .rom-action-btn {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 6px 10px; border-radius: 6px; cursor: pointer; font-family: inherit;
      border: 1px solid #333; background: #1a1a20; color: #eee;
      transition: background 0.12s, border-color 0.12s; min-height: 40px; text-align: center; box-sizing: border-box;
    }
    .rom-action-btn:hover {
      background: #24242c; border-color: #444; color: #fff;
    }
    .rom-action-btn.primary {
      background: #107c41; border-color: #16934f; color: #fff;
    }
    .rom-action-btn.primary:hover {
      background: #149b52; border-color: #1bb761;
    }
    .rom-action-btn.disabled {
      opacity: 0.45; cursor: not-allowed; border-color: #252528; background: #141416; color: #666;
    }
    .rom-action-btn .btn-main {
      font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;
    }
    .rom-action-btn .btn-meta {
      font-size: 10px; opacity: 0.75; margin-top: 1px; font-family: monospace;
      max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    #pickBtn:hover { background: #0c5; }
    #load-status {
      font-size: 11px; color: #888; text-align: center; min-height: 15px; flex-shrink: 0;
    }

    /* Recent ROMs Section */
    .recent-roms-section {
      width: 100%; display: flex; flex-direction: column; gap: 6px;
      margin-top: 2px; border-top: 1px solid #222; padding-top: 8px;
      flex: 1; min-height: 0; overflow: hidden;
    }
    .recent-roms-header {
      font-size: 10px; font-weight: 600; color: #888;
      text-transform: uppercase; letter-spacing: 0.05em;
      display: flex; justify-content: space-between; align-items: center;
      flex-shrink: 0;
    }
    .clear-recent-btn {
      background: transparent; border: 1px solid #3c3c4a;
      color: #8899aa; border-radius: 3px; padding: 1px 6px;
      font-size: 9px; cursor: pointer; font-family: inherit;
      transition: all 0.12s;
    }
    .clear-recent-btn:hover {
      background: rgba(255, 60, 60, 0.15); border-color: #c33; color: #f66;
    }
    .recent-roms-list {
      display: flex; flex-direction: column; gap: 4px;
      flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px;
    }
    .recent-rom-item {
      display: flex; align-items: center; gap: 10px;
      padding: 6px 10px; background: #15151a; border: 1px solid #252530;
      border-radius: 6px; cursor: pointer; transition: all 0.12s ease;
      user-select: none; text-align: left; flex-shrink: 0;
    }
    .recent-rom-item:hover {
      background: #1d1d26; border-color: #383848;
    }
    .recent-rom-item.keyboard-focused, .rom-action-btn.keyboard-focused, .clear-recent-btn.keyboard-focused {
      outline: 2px solid #4ec9b0 !important; outline-offset: 1px !important;
      box-shadow: 0 0 10px rgba(78, 201, 176, 0.45) !important;
      background: rgba(78, 201, 176, 0.08) !important;
    }
    .recent-rom-item.missing {
      opacity: 0.45; cursor: not-allowed;
    }

    .recent-rom-square {
      width: 48px; height: 48px; min-width: 48px; min-height: 48px;
      border-radius: 5px; overflow: hidden; background: #0c0c10;
      border: 1px solid #2e2e3e; display: flex; align-items: center; justify-content: center;
      position: relative; flex-shrink: 0; box-shadow: inset 0 0 4px rgba(0,0,0,0.6);
    }
    .recent-rom-square img {
      width: 100%; height: 100%; object-fit: cover;
      image-rendering: pixelated; display: block;
    }
    .recent-rom-square-badge {
      font-size: 16px; font-weight: bold; font-family: monospace;
      letter-spacing: 0.05em; color: #8899aa;
    }
    .recent-rom-square-badge.badge-US { color: #569cd6; }
    .recent-rom-square-badge.badge-EU { color: #dcdcaa; }
    .recent-rom-square-badge.badge-DE { color: #ce9178; }
    .recent-rom-square-badge.badge-FR { color: #4ec9b0; }
    .recent-rom-square-badge.badge-ES { color: #c586c0; }
    .recent-rom-square-badge.badge-unk { color: #667788; }

    .recent-rom-info {
      flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column;
      justify-content: center; gap: 3px;
    }
    .recent-rom-name {
      font-size: 12px; color: #eee; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      line-height: 1.2;
    }
    .recent-rom-details {
      display: flex; align-items: center; gap: 6px;
      font-size: 10px; color: #888899; font-family: monospace;
      line-height: 1.2;
    }
    .recent-rom-pill {
      padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: bold;
      font-family: monospace; border: 1px solid #3c3c4e; background: #20202a;
    }
    .recent-rom-pill.badge-US { color: #569cd6; border-color: #2b4c6e; background: rgba(86, 156, 214, 0.12); }
    .recent-rom-pill.badge-EU { color: #dcdcaa; border-color: #5c5c36; background: rgba(220, 220, 170, 0.12); }
    .recent-rom-pill.badge-DE { color: #ce9178; border-color: #5c3c32; background: rgba(206, 145, 120, 0.12); }
    .recent-rom-pill.badge-FR { color: #4ec9b0; border-color: #245248; background: rgba(78, 201, 176, 0.12); }
    .recent-rom-pill.badge-ES { color: #c586c0; border-color: #583355; background: rgba(197, 134, 192, 0.12); }

    /* -- Resizer & Bottom panel ------------------------------------ */
    #main-container {
      display: flex; flex-direction: column; width: 100%; height: 100%;
      overflow: hidden; position: relative;
    }

    #ss-resizer {
      height: 5px; width: 100%; background: #1c1c22; cursor: row-resize; flex-shrink: 0;
      border-top: 1px solid #2e2e38; border-bottom: 1px solid #111;
      transition: background 0.15s;
    }
    #ss-resizer:hover, #ss-resizer.dragging { background: #007acc; }

    #script-stack {
      height: 260px; min-height: 80px; max-height: calc(100vh - 100px); width: 100%;
      background: #0d0d0d; border-top: 1px solid #2a2a35;
      font-size: 11px; display: none; flex-direction: column; overflow: hidden; flex-shrink: 0;
    }
    #script-stack.visible { display: flex; }
    #script-stack.collapsed {
      height: 28px !important; min-height: 28px !important;
    }
    #ss-header {
      background: #16161c; padding: 4px 8px;
      color: #aaa; font-size: 10px;
      display: flex; flex-direction: column; gap: 4px;
      border-bottom: 1px solid #2a2a35; flex-shrink: 0;
    }
    #ss-header-top {
      display: flex; justify-content: space-between; align-items: center; width: 100%;
    }
    #ss-header-title {
      font-weight: bold; letter-spacing: 0.05em; color: #778899; font-size: 10px;
    }
    #ss-tabs {
      display: flex; flex-wrap: wrap; gap: 3px; align-items: center;
    }
    .ss-tab {
      border: 1px solid #2e2e38; background: #141418; color: #8899aa;
      padding: 3px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;
      font-family: inherit; font-weight: 600; white-space: nowrap;
    }
    .ss-tab:hover { background: #22222c; color: #fff; }
    .ss-tab.active { background: #007acc; color: #fff; border-color: #007acc; }
    #ss-controls { display: flex; gap: 4px; align-items: center; }

    .ss-tab-view { display: none; flex: 1; min-height: 0; flex-direction: column; overflow: hidden; }
    .ss-tab-view.active { display: flex; }

    #ss-trace-log {
      flex: 1; min-height: 0; background: #0c0c0c; padding: 4px 8px;
      font-family: monospace; font-size: 11px; line-height: 1.45;
      overflow-y: auto; overflow-x: hidden;
    }
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
    ${game.css}
    ${getCdlCss()}
    ${getCdlFloatCss()}
    ${getTasCss()}
    ${getFpsCss()}
    ${getMenuCss()}
    ${game.menuCss}
  </style>
  <script type="application/json" id="emu-config">${config}</script>
  ${files}
</head>
<body class="profile-${profile}">
  <div id="overlay">
    <div class="overlay-card">
      <div class="overlay-header">
        <h2 data-needs="full">Everscript Emulator</h2>
        <h2 data-needs="recorder">SNES CDL Recorder</h2>
        <div class="overlay-subtitle">snes9x2005-wasm</div>
      </div>

      <div id="rom-drop-zone" class="rom-drop-zone" title="Drag and drop a SNES ROM here, or click to browse">
        <div class="drop-zone-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="4"></rect><path d="M6 12h4m-2-2v4"></path><circle cx="15" cy="11" r="1" fill="currentColor"></circle><circle cx="18" cy="13" r="1" fill="currentColor"></circle></svg></div>
        <div class="drop-zone-title">Drop SNES ROM here</div>
        <div class="drop-zone-sub">Drag &amp; drop any .smc / .sfc file, or click to browse</div>
      </div>

      <div class="overlay-action-row">
        <button id="vanillaBtn" class="rom-action-btn primary" data-needs="full" type="button" title="Load the base ROM of the selected game (ROM library)">
          <div class="btn-main"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg> <span>Load Vanilla ROM</span></div>
          <div class="btn-meta" id="vanilla-desc">Base ROM</div>
        </button>
        <button id="pickBtn" class="rom-action-btn secondary" type="button" title="Choose a ROM file from disk">
          <div class="btn-main"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg> <span>Load ROM...</span></div>
          <div class="btn-meta">Browse files</div>
        </button>
      </div>

      <div id="load-status">Select a SNES ROM (.smc / .sfc) to begin.</div>

      <div id="recent-roms-section" class="recent-roms-section" style="display:none;">
        <div class="recent-roms-header">
          <span>Recent &amp; Generated ROMs</span>
          <button id="clearRecentBtn" class="clear-recent-btn" type="button" title="Clear recent ROMs history">Clear</button>
        </div>
        <div id="recent-roms-list" class="recent-roms-list"></div>
      </div>
    </div>
  </div>

  <div id="main-container">
    <div id="screen-wrap">
      <canvas id="extended-map"></canvas>
      <canvas id="extended-entities"></canvas>
      <canvas id="extended-foreground"></canvas>
      <canvas id="screen" width="512" height="448"></canvas>
      <canvas id="extended-overlay"></canvas>
      ${getCdlFloatHtml()}
      ${getTasOverlayHtml()}
      <div id="emu-side-left" class="emu-side"></div>
      <div id="emu-side-right" class="emu-side"></div>
      ${getTasBadgeHtml()}
      ${getMenuHtml({ tabButtonsHtml: game.menuTabButtonsHtml, panelsHtml: game.menuPanelsHtml })}
      <div id="menu-inspect-card" class="hidden">
        <div class="inspect-header">
          <span id="inspect-title">INSPECTOR</span>
          <button id="inspect-close-btn" type="button" title="Close">[X]</button>
        </div>
        <div id="inspect-body" class="inspect-body"></div>
        <div id="inspect-footer" class="inspect-footer"></div>
      </div>
      <div id="screen-overlay-bar">
        <button id="screen-menu-btn" class="screen-chip" type="button" title="Quick Menu (Start)">MENU</button>
        ${game.screenChipsHtml}
        ${game.soundChipHtml}
        <button id="screen-speed-chip" class="screen-chip" type="button" title="Speed-up (#)">SPEED x1</button>
        <button id="screen-focus-chip" class="screen-chip" type="button" title="Keep the focus on the emulator: Tab and debugger stops do not move it">KEEP FOCUS OFF</button>
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
        <div id="ss-header-top">
          <span id="ss-header-title">EMULATOR</span>
          <div id="ss-controls">
            <button id="ss-toggle-btn" class="ss-btn" title="Toggle Panel">hide panel</button>
          </div>
        </div>
        <div id="ss-tabs">
          <button id="ss-tab-trace" class="ss-tab" data-needs="full evermore" type="button">TRACE (<span id="ss-tab-trace-count">0</span>)</button>
          <button id="ss-tab-stack" class="ss-tab" data-needs="full evermore" type="button">STACK (<span id="ss-count">waiting...</span>)</button>
          ${game.tabButtonsHtml}
          ${getCdlTabButtonHtml()}
        </div>
      </div>

      <!-- Panels: each is placed in a side bar, here, or only in its pause-menu tab (webview/emulator-panels.js) -->
      <!-- Script Trace Log -->
      <div id="ss-view-trace" class="ss-tab-view" data-needs="full evermore">
        <div id="ss-trace-log"></div>
      </div>

      <!-- Script Stack live slot table -->
      <div id="ss-view-stack" class="ss-tab-view" data-needs="full evermore">
        <div id="ss-detail">waiting for script stack detail...</div>
        <table id="ss-table">
          <thead><tr><th>#</th><th>PC</th><th>state</th><th>next</th><th>entity</th><th>timer</th></tr></thead>
          <tbody id="ss-tbody"></tbody>
        </table>
      </div>

      ${game.viewsHtml}

      ${getCdlViewHtml()}

      ${getTasViewHtml()}
    </div>
  </div>

  <!-- Module object must be declared before the core script loads. -->
  <script>
    // Sampled each frame while an Evermore-compatible ROM runs (samplePreLoopState); read by the overlays and the game's panels.
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
    // Set per ROM by emulator-profile.js (emuGateRom): Evermore-only work runs only for Evermore;
    // the script stack hook and trace (TRACE / STACK, the .evs debugger) only in the full profile too.
    let emuEvermore = true;
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
      script.src = '${coreJsUri}';
      script.onload = function() {
        romStage('core script loaded');
      };
      script.onerror = function() {
        if (vscodeApi) vscodeApi.postMessage({ command: 'ejsError', error: 'Failed to load core script: ${coreJsUri}' });
      };
      document.body.appendChild(script);
    }
    loadCoreScript();

    // -- ROM offer, quick launch & drag-and-drop ------------------------------
    let currentOfferData = ${JSON.stringify(romOfferData || null)};

    function renderRomOffer(data) {
      if (!data) return;
      currentOfferData = data;
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

      const clearBtn = document.getElementById('clearRecentBtn');
      if (clearBtn) {
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          vscodeApi.postMessage({ command: 'clearRecentRoms' });
          const statusEl = document.getElementById('load-status');
          if (statusEl) statusEl.textContent = 'Recent ROMs cleared.';
        };
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
                if (vscodeApi) vscodeApi.postMessage({ command: 'loadRecentRom', path: item.path, name: item.name, kind: item.kind });
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
          setOverlayFocus(0);
        }
      }
    }

    let overlayFocusedIdx = -1;

    function getOverlayFocusables() {
      const list = [];
      const vBtn = document.getElementById('vanillaBtn');
      if (vBtn && !vBtn.disabled) list.push(vBtn);
      const pBtn = document.getElementById('pickBtn');
      if (pBtn) list.push(pBtn);
      const clearBtn = document.getElementById('clearRecentBtn');
      const recentSec = document.getElementById('recent-roms-section');
      if (clearBtn && recentSec && recentSec.style.display !== 'none') list.push(clearBtn);
      const items = document.querySelectorAll('.recent-rom-item:not(.missing)');
      items.forEach(it => list.push(it));
      return list;
    }

    function setOverlayFocus(idx) {
      const items = getOverlayFocusables();
      if (!items.length) {
        overlayFocusedIdx = -1;
        return;
      }
      items.forEach(el => el.classList.remove('keyboard-focused'));
      if (idx < 0) idx = 0;
      if (idx >= items.length) idx = items.length - 1;
      overlayFocusedIdx = idx;
      const target = items[overlayFocusedIdx];
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

    function activateOverlayFocused() {
      const items = getOverlayFocusables();
      if (overlayFocusedIdx >= 0 && overlayFocusedIdx < items.length) {
        items[overlayFocusedIdx].click();
      }
    }

    let lastOverlayGamepadPoll = 0;
    function pollGamepadOverlay() {
      if (romLoaded) return;
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      let pad = null;
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) { pad = gamepads[i]; break; }
      }
      if (!pad) return;

      const now = performance.now();
      if (now - lastOverlayGamepadPoll < 160) return;

      const dUp = (pad.buttons[12] && pad.buttons[12].pressed) || (pad.axes[1] && pad.axes[1] < -0.5);
      const dDown = (pad.buttons[13] && pad.buttons[13].pressed) || (pad.axes[1] && pad.axes[1] > 0.5);
      const dLeft = (pad.buttons[14] && pad.buttons[14].pressed) || (pad.axes[0] && pad.axes[0] < -0.5);
      const dRight = (pad.buttons[15] && pad.buttons[15].pressed) || (pad.axes[0] && pad.axes[0] > 0.5);
      const btnA = (pad.buttons[0] && pad.buttons[0].pressed) || (pad.buttons[9] && pad.buttons[9].pressed);
      const btnB = (pad.buttons[1] && pad.buttons[1].pressed);

      if (dUp || dDown) {
        lastOverlayGamepadPoll = now;
        const items = getOverlayFocusables();
        if (items.length) {
          const delta = dUp ? -1 : 1;
          const next = overlayFocusedIdx < 0 ? 0 : (overlayFocusedIdx + delta + items.length) % items.length;
          setOverlayFocus(next);
        }
      } else if (dLeft || dRight) {
        lastOverlayGamepadPoll = now;
        if (overlayFocusedIdx === 0 && dRight) setOverlayFocus(1);
        else if (overlayFocusedIdx === 1 && dLeft) setOverlayFocus(0);
      } else if (btnA) {
        lastOverlayGamepadPoll = now + 160;
        if (overlayFocusedIdx >= 0) activateOverlayFocused();
        else setOverlayFocus(0);
      } else if (btnB) {
        lastOverlayGamepadPoll = now;
        const items = getOverlayFocusables();
        items.forEach(el => el.classList.remove('keyboard-focused'));
        overlayFocusedIdx = -1;
      }
    }

    document.getElementById('pickBtn').addEventListener('click', () => {
      try { initAudio(); } catch (_) {}
      try { ensureAudioRunning(); } catch (_) {}
      if (vscodeApi) vscodeApi.postMessage({ command: 'pickRom' });
      const statusEl = document.getElementById('load-status');
      if (statusEl) statusEl.textContent = 'Waiting for file picker...';
    });

    const dropZone = document.getElementById('rom-drop-zone');
    if (dropZone) {
      dropZone.addEventListener('click', () => {
        document.getElementById('pickBtn').click();
      });
    }

    const vanillaBtn = document.getElementById('vanillaBtn');
    if (vanillaBtn) {
      vanillaBtn.addEventListener('click', () => {
        if (vanillaBtn.disabled) return;
        try { initAudio(); } catch (_) {}
        try { ensureAudioRunning(); } catch (_) {}
        if (vscodeApi) vscodeApi.postMessage({ command: 'loadVanillaRom' });
        const statusEl = document.getElementById('load-status');
        if (statusEl) statusEl.textContent = 'Loading Vanilla ROM...';
      });
    }

    function isFileTransfer(evt) {
      return evt.dataTransfer && Array.from(evt.dataTransfer.types || []).includes('Files');
    }

    window.addEventListener('dragenter', evt => {
      if (isFileTransfer(evt)) {
        evt.preventDefault();
        document.body.classList.add('window-drag-active');
        if (dropZone) dropZone.classList.add('drag-active');
      }
    });

    window.addEventListener('dragover', evt => {
      if (isFileTransfer(evt)) {
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
      }
    });

    window.addEventListener('dragleave', evt => {
      if (evt.clientX <= 0 || evt.clientY <= 0 || evt.clientX >= window.innerWidth || evt.clientY >= window.innerHeight) {
        document.body.classList.remove('window-drag-active');
        if (dropZone) dropZone.classList.remove('drag-active');
      }
    });

    window.addEventListener('drop', evt => {
      document.body.classList.remove('window-drag-active');
      if (dropZone) dropZone.classList.remove('drag-active');

      if (!evt.dataTransfer || !evt.dataTransfer.files || !evt.dataTransfer.files.length) return;
      evt.preventDefault();
      evt.stopPropagation();

      const file = evt.dataTransfer.files[0];
      const fileName = file.name || 'game.sfc';
      const filePath = file.path || '';

      try { initAudio(); } catch (_) {}
      try { ensureAudioRunning(); } catch (_) {}
      const statusEl = document.getElementById('load-status');
      if (statusEl) statusEl.textContent = 'Reading dropped ROM: ' + fileName + '...';

      const reader = new FileReader();
      reader.onload = function(e) {
        const dataUrl = e.target.result;
        vscodeApi.postMessage({
          command: 'romDropped',
          name: fileName,
          path: filePath,
          dataUrl: dataUrl,
          size: file.size,
        });
        startWithRom(dataUrl, fileName);
      };
      reader.onerror = function(err) {
        if (statusEl) statusEl.textContent = 'Failed to read dropped file: ' + (err && err.message || '');
      };
      reader.readAsDataURL(file);
    });

    if (currentOfferData) {
      renderRomOffer(currentOfferData);
    }

    window.addEventListener('load', () => {
      try { window.focus(); } catch (_) {}
      if (!romLoaded) setOverlayFocus(0);
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
      if (evt.data.command === 'romOfferInfo') {
        renderRomOffer(evt.data.data);
        return;
      }
      if (evt.data.command === 'loadRom') {
        if (evt.data.alchemyIcons && typeof loadedAlchemyIcons !== 'undefined') loadedAlchemyIcons = evt.data.alchemyIcons;
        if (evt.data.scriptDebug && typeof sdbgConfigure === 'function') sdbgConfigure(evt.data.scriptDebug);
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
          if (!romLoaded || emuMuted || !m || typeof m._getSoundBuffer !== 'function') {
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
    var isLensModeActive = false;
    var zoomLevel = 1.0;
    var panX = 0;
    var panY = 0;
    var updateScreenLayout = function() {};
    var zoomAt = function() {};
    var resetZoom = function() {};
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
    // Speed multipliers: 1/4x, 1/2x, 1x, 2x, 4x
    const SPEED_FACTORS = [0.25, 0.5, 1.0, 2.0, 4.0];
    const SPEED_LABELS = ['1/4x', '1/2x', '1x', '2x', '4x'];
    let speedIndex = 2; // default: 1x
    let speedMultiplier = 1.0;
    let speedAccumulator = 0;
    let speedUp = false;

    function setSpeedMultiplier(val) {
      if (typeof val === 'number') {
        speedMultiplier = val;
        const found = SPEED_FACTORS.indexOf(val);
        if (found !== -1) speedIndex = found;
      }
      speedUp = (speedMultiplier > 1.0);
      const chip = document.getElementById('screen-speed-chip');
      if (chip) {
        chip.textContent = 'SPEED ' + SPEED_LABELS[speedIndex];
        chip.classList.toggle('active', speedMultiplier !== 1.0);
      }
      const menuVal = document.getElementById('menu-val-speed');
      if (menuVal) {
        menuVal.textContent = SPEED_LABELS[speedIndex];
      }
    }

    function setSpeedUp(on) {
      setSpeedMultiplier(on ? 4.0 : 1.0);
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
      if (!romLoaded) {
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        const k = e.key;
        if (k === 'ArrowDown' || k === 's' || k === 'S') {
          const items = getOverlayFocusables();
          if (items.length) {
            const next = overlayFocusedIdx < 0 ? 0 : (overlayFocusedIdx + 1) % items.length;
            setOverlayFocus(next);
            e.preventDefault();
          }
          return;
        }
        if (k === 'ArrowUp' || k === 'w' || k === 'W') {
          const items = getOverlayFocusables();
          if (items.length) {
            const next = overlayFocusedIdx < 0 ? 0 : (overlayFocusedIdx - 1 + items.length) % items.length;
            setOverlayFocus(next);
            e.preventDefault();
          }
          return;
        }
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
          if (overlayFocusedIdx === 1) { setOverlayFocus(0); e.preventDefault(); return; }
        }
        if (k === 'ArrowRight' || k === 'd' || k === 'D') {
          if (overlayFocusedIdx === 0) { setOverlayFocus(1); e.preventDefault(); return; }
        }
        if (k === 'Enter' || k === ' ' || k === 'v' || k === 'V') {
          if (overlayFocusedIdx >= 0) {
            activateOverlayFocused();
            e.preventDefault();
          } else {
            setOverlayFocus(0);
            e.preventDefault();
          }
          return;
        }
        if (k === 'Escape' || k === 'c' || k === 'C' || k === 'b' || k === 'B') {
          const items = getOverlayFocusables();
          items.forEach(el => el.classList.remove('keyboard-focused'));
          overlayFocusedIdx = -1;
          e.preventDefault();
          return;
        }
        return;
      }
      if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
      if (e.repeat) return;
      const bit = (typeof dynamicKeyToBit !== 'undefined' && dynamicKeyToBit[e.key]) ? dynamicKeyToBit[e.key] : KEY_MAP[e.key];
      if (bit) { keyInput |= bit; e.preventDefault(); }
    });
    document.addEventListener('keyup', e => {
      if (!romLoaded) return;
      if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
      const bit = (typeof dynamicKeyToBit !== 'undefined' && dynamicKeyToBit[e.key]) ? dynamicKeyToBit[e.key] : KEY_MAP[e.key];
      if (bit) keyInput &= ~bit;
    });
    // Focus left the panel (a debugger stop focuses the editor): the key-ups go
    // elsewhere, so release everything instead of holding e.g. Start forever.
    window.addEventListener('blur', () => { keyInput = 0; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) keyInput = 0; });

    // -- ROM loading -----------------------------------------------------------
    // (ROM state is declared at boot, above romStage: the ROM offer and crash
    // reporting read it before this point, and a let read early throws.)

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
        if (typeof gameRomReset === 'function') gameRomReset();
        if (typeof emuGateRom === 'function') emuGateRom(romData);
        romStage('core start begin');
        cdlBeforeRomChange();
        tasFlush();
        const ptr = Module._my_malloc(romData.length);
        HEAPU8.set(romData, ptr);
        Module._startWithRom(ptr, romData.length, AUDIO_FREQ);
        Module._my_free(ptr);
        if (typeof sdbgOnBoot === 'function') sdbgOnBoot();
        romStage('core start complete');

        romLoaded = true;
        loadedRomData = romData;
        loadedRomName = name || 'game';
        if (typeof gameTraceReset === 'function') gameTraceReset();
        romLaunchTimestamp = performance.now();
        romFrameCount = 0;
        initAudio();
        ensureAudioRunning();
        document.getElementById('overlay').style.display = 'none';
        if (typeof emuPanelsLayout === 'function') emuPanelsLayout();
        window.dispatchEvent(new Event('resize'));
        if (emuScriptHook) startWramPolling();
        if (emuEvermore) vscodeApi.postMessage({ command: 'requestAlchemyIcons' });
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
      // A click on the focused screen presses B; the click that focuses it only focuses.
      let canvasHadFocus = false;
      canvas.addEventListener('mousedown', () => { canvasHadFocus = document.hasFocus() && document.activeElement === canvas; });
      canvas.addEventListener('click', () => {
        canvas.focus();
        if (!canvasHadFocus) return;
        keyInput |= (1 << 15);
        setTimeout(() => {
          keyInput &= ~(1 << 15);
        }, 120);
      });
      let lastWrapWidth = -1;
      let lastWrapHeight = -1;

      // Zoom & Pan state
      zoomLevel = 1.0;
      panX = 0;
      panY = 0;

      updateScreenLayout = function() {
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
        if (romLoaded && lastSampledPreState) {
          if (typeof renderExtendedMapAndOverlays === 'function') renderExtendedMapAndOverlays(lastSampledPreState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx);
        }
      };

      zoomAt = function(nextZoom, cx, cy) {
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
      };

      resetZoom = function() {
        zoomLevel = 1.0;
        panX = 0;
        panY = 0;
        updateScreenLayout();
      };

      // Trackpad pinch-to-zoom (wheel with ctrlKey/metaKey) and two-finger pan (wheel)
      wrap.addEventListener('wheel', (e) => {
        const isLens = (typeof isMenuOpen !== 'undefined' && isMenuOpen && typeof menuActiveTab !== 'undefined' && menuActiveTab === 0);
        if (typeof isMenuOpen !== 'undefined' && isMenuOpen && !isLens) {
          const menuCard = document.getElementById('menu-card');
          if (menuCard && menuCard.contains(e.target)) {
            // Inside menu card: allow natural scroll of menu list, do NOT zoom/pan map!
            return;
          }
        }
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
      let dragDist = 0;
      wrap.addEventListener('mousedown', (e) => {
        dragDist = 0;
        if (e.button === 2) return; // Right-click handled by contextmenu
        const isLens = (typeof isMenuOpen !== 'undefined' && isMenuOpen && typeof menuActiveTab !== 'undefined' && menuActiveTab === 0);
        if (typeof isMenuOpen !== 'undefined' && isMenuOpen && !isLens) {
          const menuCard = document.getElementById('menu-card');
          if (menuCard && menuCard.contains(e.target)) return;
        }
        if (isLens) {
          const menuHeader = document.getElementById('menu-header');
          if (menuHeader && menuHeader.contains(e.target)) return;
        }
        if (isLens || e.button === 1 || e.altKey || (e.target !== canvas && !e.target.closest('.screen-chip'))) {
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
        if (!romLoaded || !lastLayout || typeof injectEverscript !== 'function') return;
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
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        dragDist += Math.abs(dx) + Math.abs(dy);
        panX = panBaseX + dx;
        panY = panBaseY + dy;
        updateScreenLayout();
      });
      window.addEventListener('mouseup', () => {
        isPanning = false;
      });

      wrap.addEventListener('click', (e) => {
        if (dragDist > 6) return;
        const inspectCard = document.getElementById('menu-inspect-card');
        if (inspectCard && inspectCard.contains(e.target)) return;
        const menuCard = document.getElementById('menu-card');
        if (menuCard && menuCard.contains(e.target)) return;
        if (e.target.closest && (e.target.closest('.screen-chip') || e.target.closest('.screen-btn'))) return;

        // If paused, inspector click allows selecting character, trigger, or object
        if (emuEvermore && typeof isEmulatorPaused === 'function' && isEmulatorPaused() && romLoaded && lastLayout) {
          const rect = wrap.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const worldX = Math.round(lastLayout.camX + (mouseX - lastLayout.emuX) / lastLayout.scaleSnes);
          const worldY = Math.round(lastLayout.camY + (mouseY - lastLayout.emuY) / lastLayout.scaleSnes);
          if (typeof handleMapInspectClick === 'function') {
            handleMapInspectClick(worldX, worldY, mouseX, mouseY);
          }
        }
      });

      const inspectCloseBtn = document.getElementById('inspect-close-btn');
      if (inspectCloseBtn) {
        inspectCloseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof closeInspector === 'function') closeInspector();
        });
      }

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
        resetZoom();
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
        if (typeof pollGamepadMenu === 'function') pollGamepadMenu();
        if (typeof pollGamepadOverlay === 'function') pollGamepadOverlay();

        try {
          const paused = isEmulatorPaused();
          if (paused !== emulatorPausedState) {
            emulatorPausedState = paused;
            cdlOnPauseChanged(paused);
            tasOnPauseChanged(paused);
            if (typeof sdbgOnPauseChanged === 'function') sdbgOnPauseChanged(paused);
            apuPauseChanged(paused);
          }
          fpsTick(timestamp, romLoaded && !paused);
          if (paused) {
            if (timestamp - lastPausedFrame < PAUSED_FRAME_MS) return;
            lastPausedFrame = timestamp;
          }

          resizeCanvas(false);
          if (romLoaded && paused) {
            if (typeof renderExtendedMapAndOverlays === 'function') renderExtendedMapAndOverlays(lastSampledPreState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx);
            apuStreamTick(Module, true);
          } else if (romLoaded) {
            romFrameCount++;
            // Sample camera and entity state BEFORE _mainLoop() to match rendered frame
            const preState = emuEvermore && typeof samplePreLoopState === 'function' ? samplePreLoopState() : null;
            lastSampledPreState = preState;
            const m = getModule();
            // A replay must see exactly the recorded memory: no cheat writes.
            if (m && emuEvermore && !tasReplaying() && typeof maintainCheats === 'function') maintainCheats(m);
            if (speedMultiplier < 1.0) {
              speedAccumulator += speedMultiplier;
              if (speedAccumulator < 1.0) {
                const fbPtr = Module._getScreenBuffer();
                if (fbPtr) {
                  imageData.data.set(new Uint8ClampedArray(HEAPU8.buffer, fbPtr, 512 * 448 * 4));
                  ctx.putImageData(imageData, 0, 0);
                }
                if (typeof renderExtendedMapAndOverlays === 'function') renderExtendedMapAndOverlays(preState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx);
                return;
              }
              speedAccumulator -= 1.0;
            }
            for (let extra = (speedMultiplier > 1.0 ? Math.floor(speedMultiplier) - 1 : 0); extra > 0 && !isEmulatorPaused(); extra--) {
              tasApplyInput(Module, keyInput);
              Module._mainLoop();
              fpsCountFrame(Module);
              romFrameCount++;
              apuStreamTick(Module, false);
            }
            tasApplyInput(Module, keyInput);
            Module._mainLoop();
            fpsCountFrame(Module);
            const fbPtr = Module._getScreenBuffer();
            if (fbPtr) {
              imageData.data.set(new Uint8ClampedArray(HEAPU8.buffer, fbPtr, 512 * 448 * 4));
              ctx.putImageData(imageData, 0, 0);
            }
            if (typeof renderExtendedMapAndOverlays === 'function') renderExtendedMapAndOverlays(preState, canvas, extMapCanvas, extMapCtx, extEntCanvas, extEntCtx, extFgCanvas, extFgCtx, extOverCanvas, extOverCtx);
            tasDrawOverlay();
            if (emuScriptHook && typeof checkScriptExecutionTrace === 'function') checkScriptExecutionTrace();
            apuStreamTick(Module, false);
          }
        } catch (frameErr) {
          reportEmulatorCrash('frame_loop_error', frameErr && frameErr.message ? frameErr.message : String(frameErr), {
            stack: frameErr && frameErr.stack ? frameErr.stack : null
          });
        }
      }
      requestAnimationFrame(frame);
    }

    // Where the screen sits (set by the game's renderer each frame; read by the CDL float and the clicks).
    let lastLayout = null;
    ${game.overlaysScript}

    // -- WRAM / Script stack ---------------------------------------------------
    ${game.stackScript}

    let lastDebugStatus = '';
    const RAM_TAG                  = [82, 65, 77, 32]; // "RAM "
    const WRAM_SIZE                = 0x20000;


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
    function installDebuggerBridge(m) {
      if (!hasDebuggerApi(m) || m.__everscriptBridgeInstalled) return;
      m.__everscriptBridgeInstalled = true;
      reportHookStatus('Debugger bridge installed; waiting for breakpoint events');
      m.onBreakpointHit = function(event) {
        // The VS Code script debugger's interpreter hook decides for itself (false = keep running).
        if (event.type === 'exec' && typeof sdbgOnHit === 'function' && event.address === SDBG_DISPATCH && sdbg.armed) return sdbgOnHit(m);
        // Who sent a sound effect (sound-source-view.js): record, keep running.
        if (event.type === 'exec' && typeof sndOnHit === 'function' && event.address === SND_SEND && sndArmed) return sndOnHit(m);
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
      setControlEnabled('ss-hook-btn',   writeApi);
      setControlEnabled('ss-hook-all-btn', customApi);
      setControlEnabled('ss-bp-add-btn', customApi);
      const bpInput = document.getElementById('ss-bp-input');
      if (bpInput) bpInput.disabled = !customApi;
      if (typeof updateExecBreakpointStatus === 'function') updateExecBreakpointStatus(customApi);
      if (!writeApi && typeof disarmScriptStackHook === 'function') {
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
          // The game's script VM (Evermore: stack-view.js); without one only the debugger status updates.
          const src = typeof readScriptStackRegion === 'function' ? readScriptStackRegion() : { mode: hasDebuggerApi(m) ? 'debugger' : 'unavailable', bytes: null };
          refreshDebuggerUi(m, src.mode);
          if (src.bytes) {
            traceHookActivity(src.bytes);
            const snapshot = buildScriptSnapshot(src.bytes);
            updateScriptStack(snapshot);
            reportScriptFocus(snapshot);
            checkManualScriptBreakpoints(snapshot, m);
            checkScriptExecutionTrace();
            if (!tasReplaying() && typeof maintainCheats === 'function') maintainCheats(m);
            if (typeof refreshActiveBottomTab === 'function') refreshActiveBottomTab();
          } else {
            document.getElementById('ss-count').textContent =
              src.mode === 'connecting' ? 'connecting...' : 'unavailable';
          }
        } catch (_) { /* silently skip on error */ }
      }

      wramPollTimer = setInterval(pollOnce, 250);
    }

    const debugLinkBtn = document.getElementById('ss-debug-link-btn');
    if (debugLinkBtn) {
      debugLinkBtn.addEventListener('click', () => {
        vscodeApi.postMessage({ command: 'connectDebugger' });
      });
    }

    const toggleStackBtn = document.getElementById('ss-toggle-btn');
    if (toggleStackBtn) {
      toggleStackBtn.addEventListener('click', () => {
        const stack = document.getElementById('script-stack');
        if (!stack) return;
        stack.classList.toggle('collapsed');
        const isCollapsed = stack.classList.contains('collapsed');
        toggleStackBtn.textContent = isCollapsed ? 'show panel' : 'hide panel';
        window.dispatchEvent(new Event('resize'));
      });
    }

    ${game.overlayTogglesScript}

    // Keep the focus on the emulator when the VS Code debugger stops (the host re-reveals the panel).
    // Also keeps Tab in the emulator (emulator-profile.js).
    let keepFocusOnBreak = false;
    // save: a change by the user, kept by the host (not when the host sends the saved value).
    function setKeepFocusChip(on, save) {
      keepFocusOnBreak = !!on;
      const chip = document.getElementById('screen-focus-chip');
      if (chip) {
        chip.textContent = keepFocusOnBreak ? 'KEEP FOCUS ON' : 'KEEP FOCUS OFF';
        chip.classList.toggle('active', keepFocusOnBreak);
      }
      if (save) vscodeApi.postMessage({ command: 'setKeepFocusOnBreak', on: keepFocusOnBreak });
    }
    const focusChip = document.getElementById('screen-focus-chip');
    if (focusChip) {
      focusChip.addEventListener('click', (e) => {
        e.stopPropagation();
        setKeepFocusChip(!keepFocusOnBreak, true);
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

    const menuBtn = document.getElementById('screen-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof openEmulatorMenu === 'function') openEmulatorMenu();
      });
    }

    ${game.clientScript}

    ${getCdlFloatScript()}

    ${getCdlClientScript()}

    ${getCdlStripsScript()}

    ${getTasClientScript()}

    ${game.scriptDebugScript}

    ${getMemoryBridgeClientScript()}

    ${game.soundSourceScript}
    ${getApuStreamClientScript()}

    ${getFpsClientScript()}

    ${getMenuClientScript()}

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
        document.body.style.cursor = 'row-resize';
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

    function escH(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    ${game.traceScript}

    window.addEventListener('message', evt => {
      if (!evt.data) return;
      if (handleCdlMessage(evt.data)) return;
      if (handleTasMessage(evt.data)) return;
      if (typeof sdbgHandleMessage === 'function' && sdbgHandleMessage(evt.data)) return;
      if (evt.data.command === 'keepFocusOnBreak') { setKeepFocusChip(evt.data.on); return; }
      if (evt.data.command === 'focusScreen') {
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
        return;
      }
      if (evt.data.command === 'debuggerConnectionStatus') {
        setText('ss-debug-link-status', 'dbg: ' + evt.data.text, evt.data.ok ? 'ss-ok' : 'ss-warn');
      } else if (evt.data.command === 'scriptTraceLogged') {
        if (typeof appendTraceEntries === 'function') appendTraceEntries(evt.data.entries);
      } else if (evt.data.command === 'roomMapRendered') {
        if (typeof gameOnRoomMap === 'function') gameOnRoomMap(evt.data);
      } else if (evt.data.command === 'idleSprites') {
        const got = evt.data.sprites || {};
        if (typeof idleSprites !== 'undefined') for (const k in got) idleSprites.set(k, got[k]);
      } else if (evt.data.command === 'injectEverscript') {
        if (typeof injectEverscript === 'function') injectEverscript(evt.data.code);
      } else if (evt.data.command === 'alchemyIconsLoaded') {
        if (evt.data.alchemy && typeof updateAlchemyTab === 'function') {
          loadedAlchemyIcons = evt.data.alchemy;
          if (emuPanelVisible('alchemy')) {
            const rom = loadedRomData ? ((loadedRomData.length % 1024 === 512) ? loadedRomData.subarray(512) : loadedRomData) : null;
            updateAlchemyTab(lastSampledPreState, rom);
          }
        }
      }
    });

    if (typeof renderManualExecBreakpoints === 'function') renderManualExecBreakpoints();
    initCdlTab();
  </script>
</body>
</html>`;
}

module.exports = {
  buildHtml: _buildHtml,
};
