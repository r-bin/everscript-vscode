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

let _panel   = null;
let _pending = null; // { dataUrl, name } to send once the webview signals ready
let _extensionPath = '';

function _resetPanelHtml() {
    if (!_panel || !_extensionPath) return;
    const vendorBase = path.join(_extensionPath, 'emulator', 'vendor', 'emulatorjs');
    _panel.webview.html = _buildHtml(_panel.webview, vendorBase);
}

/**
 * Open (or reveal) the emulator panel.
 *
 * @param {object} context   VS Code extension context.
 * @param {object} [rom]     Optional { dataUrl, name } to auto-load on open.
 */
function openEmulatorPanel(context, rom) {
    if (rom) _pending = rom;
    _extensionPath = context.extensionPath;

    const vendorBase = path.join(context.extensionPath, 'emulator', 'vendor', 'emulatorjs');

    if (_panel) {
        _panel.reveal(vscode.ViewColumn.Beside, true);
        if (_pending) {
            // EmulatorJS only consumes the ROM URL during bootstrap.
            // Rebuild the webview so a new ROM always starts from a clean runtime.
            _resetPanelHtml();
        }
        return;
    }

    _panel = vscode.window.createWebviewPanel(
        'everscriptEmulator',
        'Everscript Emulator',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(context.extensionPath)],
        },
    );

    _panel.webview.html = _buildHtml(_panel.webview, vendorBase);

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
        }
    }, undefined, context.subscriptions);

    _panel.onDidDispose(() => { _panel = null; _pending = null; }, null, context.subscriptions);
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

function _buildHtml(webview, vendorBase) {
    const nonce = _nonce();

    const loaderUri = webview.asWebviewUri(vscode.Uri.file(path.join(vendorBase, 'loader.js')));
    const vendorUri = webview.asWebviewUri(vscode.Uri.file(vendorBase));

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
      height: 180px; min-height: 140px; max-height: 220px;
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
    #ss-header span { color: #555; }
    #ss-table { width: 100%; border-collapse: collapse; }
    #ss-table th {
      text-align: left; padding: 2px 6px;
      color: #666; font-weight: normal; font-size: 10px;
      position: sticky; top: 24px; background: #111; border-bottom: 1px solid #222;
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
      <b>SCRIPT STACK</b>
      <span id="ss-count">waiting...</span>
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
    const RAM_TAG      = [82, 65, 77, 32]; // "RAM "
    const WRAM_SIZE    = 0x20000;

    function readU16(w, off) { return (w[off] | (w[off + 1] << 8)) >>> 0; }
    function readU24(w, off) { return (w[off] | (w[off + 1] << 8) | (w[off + 2] << 16)) >>> 0; }

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

    /** Render 20-slot script stack from raw WRAM bytes. */
    function updateScriptStack(wram) {
      const tbody = document.getElementById('ss-tbody');
      if (!tbody) return;
      let rows = '';
      let active = 0;
      for (let i = 0; i < SLOT_COUNT; i++) {
        const base = SCRIPT_BASE + i * SLOT_SIZE;
        if (base + SLOT_SIZE > wram.length) break;
        const loc = readU24(wram, base + 0x00);
        if (loc === 0) continue; // inactive slot
        active++;
        const state  = readU16(wram, base + 0x03);
        const timer1 = readU16(wram, base + 0x05);
        const entity = readU16(wram, base + 0x0D);
        const cls    = state === 2 ? 'exec' : state === 4 ? 'wait' : 'dead';
        const sname  = state === 2 ? 'exec' : state === 4 ? 'wait' : state === 0 ? 'dead' : '0x' + state.toString(16);
        rows += '<tr class="' + cls + '">' +
          '<td>' + i + '</td>' +
          '<td>' + loc.toString(16).toUpperCase().padStart(6, '0') + '</td>' +
          '<td>' + sname + '</td>' +
          '<td>' + entity.toString(16).toUpperCase().padStart(4, '0') + '</td>' +
          '<td>' + timer1 + '</td>' +
          '</tr>';
      }
      if (rows === '') {
        rows = '<tr><td colspan="5" style="color:#555;text-align:center;padding:6px">no active scripts</td></tr>';
      }
      tbody.innerHTML = rows;
      document.getElementById('ss-count').textContent = active + ' active';
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

          // Inject EmulatorJSGetState if the build doesn't provide it.
          if (typeof gm.Module.EmulatorJSGetState !== 'function') {
            gm.Module.EmulatorJSGetState = function() {
              try {
                gm.Module._cmd_save_state();
                return gm.Module.FS.readFile('/game.state');
              } catch (e) { return null; }
            };
          }

          function poll() {
            try {
              const raw = gm.getState();
              if (raw) {
                const wram = parseWramFromState(raw);
                if (wram) {
                  updateScriptStack(wram);
                  // Post a small WRAM window to the host for Memory Radar live mode.
                  const start = SCRIPT_BASE;
                  const end   = Math.min(wram.length, SCRIPT_BASE + SLOT_COUNT * SLOT_SIZE + 1);
                  vscodeApi.postMessage({ command: 'wramDelta', offset: start, data: Array.from(wram.subarray(start, end)) });
                }
              }
            } catch (_) { /* silently skip on error */ }
            setTimeout(poll, 500);
          }
          poll();
        } catch (_) {
          setTimeout(attempt, 2000);
        }
      }
      attempt();
    }

    // ── EmulatorJS bootstrap ───────────────────────────────────────────────

    function startEjs(dataUrl, name) {
      document.getElementById('overlay').style.display = 'none';

      window.EJS_player        = '#ejs-container';
      window.EJS_core          = 'snes9x';
      window.EJS_gameUrl       = dataUrl;
      window.EJS_gameName      = name || 'game';
      window.EJS_pathtodata    = '${vendorUri}/';
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

function _nonce() {
    let n = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) n += chars[Math.floor(Math.random() * chars.length)];
    return n;
}

module.exports = { openEmulatorPanel, sendRomFile: _sendRomFile };
