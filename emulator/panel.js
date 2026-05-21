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

let _panel = null;

function openEmulatorPanel(context) {
    if (_panel) {
        _panel.reveal(vscode.ViewColumn.One);
        return;
    }

    const vendorBase = path.join(context.extensionPath, 'emulator', 'vendor', 'emulatorjs');

    _panel = vscode.window.createWebviewPanel(
        'everscriptEmulator',
        'Everscript Emulator',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.file(context.extensionPath)],
        },
    );

    _panel.webview.html = _buildHtml(_panel.webview, vendorBase);

    _panel.webview.onDidReceiveMessage(msg => {
        switch (msg.command) {
            case 'pickRom': {
                vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel:     'Load ROM',
                    filters:       { 'SNES ROM': ['smc', 'sfc', 'fig', 'bin'] },
                }).then(uris => {
                    if (!uris || !uris.length) return;
                    const romPath = uris[0].fsPath;
                    const romName = path.basename(romPath);
                    try {
                        const romData = fs.readFileSync(romPath);
                        const romDataUrl = 'data:application/octet-stream;base64,' + romData.toString('base64');
                        _panel.webview.postMessage({ command: 'loadRom', dataUrl: romDataUrl, name: romName });
                    } catch (e) {
                        vscode.window.showErrorMessage('Failed to read ROM: ' + e.message);
                    }
                });
                break;
            }

            case 'wramDelta':
                // Forward WRAM deltas to the Memory Radar live mode (future).
                break;
        }
    }, undefined, context.subscriptions);

    _panel.onDidDispose(() => { _panel = null; }, null, context.subscriptions);
}

function _buildHtml(webview, vendorBase) {
    const nonce = _nonce();

    // Convert local paths to webview-accessible URIs
    const loaderUri   = webview.asWebviewUri(vscode.Uri.file(path.join(vendorBase, 'loader.js')));
    const cssUri      = webview.asWebviewUri(vscode.Uri.file(path.join(vendorBase, 'emulator.css')));
    const vendorUri   = webview.asWebviewUri(vscode.Uri.file(vendorBase));

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
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    #ejs-container { width: 100%; height: 100%; }
    #overlay {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: #111; color: #ccc;
      font-family: monospace; gap: 16px;
      z-index: 100;
    }
    #overlay h2 { color: #eee; font-size: 18px; }
    #pickBtn {
      padding: 10px 24px; background: #1a6; color: #fff;
      border: none; border-radius: 4px; cursor: pointer; font-size: 14px;
    }
    #pickBtn:hover { background: #0c5; }
    #status { font-size: 12px; color: #888; max-width: 400px; text-align: center; }
  </style>
</head>
<body>
  <div id="overlay">
    <h2>Everscript Emulator</h2>
    <button id="pickBtn">Load ROM...</button>
    <div id="status">Select a SNES ROM (.smc / .sfc) to begin.</div>
  </div>
  <div id="ejs-container"></div>

  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();

    document.getElementById('pickBtn').addEventListener('click', () => {
      vscodeApi.postMessage({ command: 'pickRom' });
      document.getElementById('status').textContent = 'Waiting for file picker…';
    });

    window.addEventListener('message', evt => {
      const msg = evt.data;
      if (msg.command === 'loadRom') {
        startEjs(msg.dataUrl, msg.name);
      }
    });

    function startEjs(dataUrl, name) {
      document.getElementById('overlay').style.display = 'none';

      window.EJS_player       = '#ejs-container';
      window.EJS_core         = 'snes9x';
      window.EJS_gameUrl      = dataUrl;
      window.EJS_gameName     = name || 'game';
      window.EJS_pathtodata   = '${vendorUri}/';
      window.EJS_startOnLoaded = true;
      window.EJS_threads      = false;
      window.EJS_onGameStart  = function() {
        vscodeApi.postMessage({ command: 'gameStarted', name: window.EJS_gameName });
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

module.exports = { openEmulatorPanel };
