// Ownership: the ROM panel's webview (docs/architecture/multi-game.md §6). The page is
// webview/rom-panel.{js,css}; this file only creates the panel, sends state and relays messages.

import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { sourceDir } from '../../platform/source-dir';

const PAGE = path.join(sourceDir(__dirname), 'webview');

let panel: vscode.WebviewPanel | null = null;
let lastState: unknown = null;

function html(webview: vscode.Webview, root: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const uri = (f: string) => webview.asWebviewUri(vscode.Uri.file(path.join(PAGE, f)));
    return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${uri('rom-panel.css')}"></head>
<body data-root="${encodeURIComponent(root)}"><main id="app"></main>
<script nonce="${nonce}" src="${uri('rom-panel.js')}"></script></body></html>`;
}

/** Opens (or reveals) the ROM panel with `state`; `onMessage` handles the page's requests. */
function openRomPanel(context: vscode.ExtensionContext, state: unknown, onMessage: (msg: { command: string; root: string; [k: string]: unknown }) => void): void {
    lastState = state;
    if (panel) { panel.reveal(); panel.webview.postMessage({ command: 'state', state }); return; }
    const created = vscode.window.createWebviewPanel('everscript.roms', 'ROMs', vscode.ViewColumn.Active, {
        enableScripts: true, localResourceRoots: [vscode.Uri.file(PAGE)],
    });
    panel = created;
    created.webview.html = html(created.webview, context.extensionPath);
    created.webview.onDidReceiveMessage((msg: { command: string; [k: string]: unknown }) => {
        if (msg.command === 'ready') created.webview.postMessage({ command: 'state', state: lastState });
        else onMessage({ ...msg, root: context.extensionPath });
    }, null, context.subscriptions);
    created.onDidDispose(() => { panel = null; }, null, context.subscriptions);
}

function refreshRomPanel(state: unknown): void {
    lastState = state;
    if (panel) panel.webview.postMessage({ command: 'state', state });
}

export { openRomPanel, refreshRomPanel };
