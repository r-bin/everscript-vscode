'use strict';

/**
 * emulator/panel.js
 *
 * VS Code webview panel for the embedded SNES emulator POC.
 *
 * Phase 1 (this file): keyboard-capture test.
 *   - Opens a panel with a canvas and a live key log.
 *   - Proves that the VS Code webview can receive keyboard input.
 *   - User can pick a ROM file; the path is sent to the webview for display.
 *
 * Phase 2: swap the HTML/JS for a real Snes9x WASM build.
 *   - The WRAM delta messages will feed the Memory Radar live mode.
 *   - See docs/web-emulator-plan.md for the full architecture.
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

    _panel = vscode.window.createWebviewPanel(
        'everscriptEmulator',
        'Everscript Emulator (POC)',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
        },
    );

    _panel.webview.html = _buildHtml(_panel.webview, context);

    _panel.webview.onDidReceiveMessage(msg => {
        switch (msg.command) {
            case 'ready':
                // Phase 2: send initial ROM path here
                break;

            case 'pickRom': {
                vscode.window.showOpenDialog({
                    canSelectMany: false,
                    openLabel:     'Load ROM',
                    filters:       { 'SNES ROM': ['smc', 'sfc', 'fig', 'bin'] },
                }).then(uris => {
                    if (!uris || !uris.length) return;
                    const romPath = uris[0].fsPath;
                    const romName = path.basename(romPath);
                    _panel.webview.postMessage({ command: 'loadRom', path: romPath, name: romName });
                });
                break;
            }

            case 'wramDelta':
                // Phase 2: forward WRAM deltas to the Memory Radar or Call Log.
                // msg.data = Uint8Array-like buffer of the interesting WRAM region.
                break;

            case 'keyEvent':
                // Phase 2: mirror controller state for the debugger step-on-key feature.
                break;
        }
    }, undefined, context.subscriptions);

    _panel.onDidDispose(() => { _panel = null; }, null, context.subscriptions);
}

function _buildHtml(webview, context) {
    const nonce = _nonce();
    const htmlPath = path.join(context.extensionPath, 'emulator', 'webview', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf-8');
    // Inject nonce for CSP compliance
    html = html.replace(/\$\{nonce\}/g, nonce);
    return html;
}

function _nonce() {
    let n = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) n += chars[Math.floor(Math.random() * chars.length)];
    return n;
}

module.exports = { openEmulatorPanel };
