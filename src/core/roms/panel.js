'use strict';
// Ownership: the ROM panel's webview (docs/architecture/multi-game.md §6). The page is
// webview/rom-panel.{js,css}; this file only creates the panel, sends state and relays messages.

const vscode = require('vscode');
const path = require('path');
const crypto = require('crypto');

let panel = null;
let lastState = null;

function html(webview, root) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const uri = f => webview.asWebviewUri(vscode.Uri.file(path.join(__dirname, 'webview', f)));
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${uri('rom-panel.css')}"></head>
<body data-root="${encodeURIComponent(root)}"><main id="app"></main>
<script nonce="${nonce}" src="${uri('rom-panel.js')}"></script></body></html>`;
}

/** Opens (or reveals) the ROM panel with `state`; `onMessage` handles the page's requests. */
function openRomPanel(context, state, onMessage) {
    lastState = state;
    if (panel) { panel.reveal(); panel.webview.postMessage({ command: 'state', state }); return; }
    panel = vscode.window.createWebviewPanel('everscript.roms', 'ROMs', vscode.ViewColumn.Active, {
        enableScripts: true, localResourceRoots: [vscode.Uri.file(path.join(__dirname, 'webview'))],
    });
    panel.webview.html = html(panel.webview, context.extensionPath);
    panel.webview.onDidReceiveMessage(msg => {
        if (msg.command === 'ready') panel.webview.postMessage({ command: 'state', state: lastState });
        else onMessage({ ...msg, root: context.extensionPath });
    }, null, context.subscriptions);
    panel.onDidDispose(() => { panel = null; }, null, context.subscriptions);
}

function refreshRomPanel(state) {
    lastState = state;
    if (panel) panel.webview.postMessage({ command: 'state', state });
}

module.exports = { openRomPanel, refreshRomPanel };
