/**
 * core/emulator/replay-editor.ts
 *
 * The editor for .evsmv recordings: opening one (double click, or dropping it on VS Code, which opens
 * dropped files instead of handing them to the emulator webview) plays it in the emulator panel.
 * The tab shows what the recording is and can play it again or show it as text.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { parseMovie } from '../../platform/tas/movie';
import { escapeHtml } from '../webview/html';

const VIEW_TYPE = 'everscript.replay';
const FPS = 60.0988;

function duration(frames: number): string {
    const s = Math.round(frames / FPS);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function pageHtml(name: string, text: string, nonce: string): string {
    let rows: [string, string][];
    try {
        const m = parseMovie(text, name);
        rows = [
            ['length', `${duration(m.count)} (${m.count} frames)`],
            ['ROM', m.meta.rom || '?'],
            ['started', m.meta.started || '?'],
            ['core', m.meta.core || '?'],
        ];
        if (m.meta.synced) rows.push(['replayed', 'in sync ' + m.meta.synced]);
        if (m.meta.desync) rows.push(['replayed', 'desync at frame ' + m.meta.desync]);
    } catch (e) {
        rows = [['error', e instanceof Error ? e.message : String(e)]];
    }
    const table = rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
body{font:13px var(--vscode-font-family);color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);padding:16px}
h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;opacity:.5;margin:0 0 8px}
th{text-align:left;font-weight:400;opacity:.6;padding:2px 16px 2px 0}td{padding:2px 0;word-break:break-all}
button{margin:14px 8px 0 0;padding:4px 12px;border:0;border-radius:2px;cursor:pointer;color:var(--vscode-button-foreground);background:var(--vscode-button-background)}
button.alt{color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground)}
</style></head><body>
<h2>Replay</h2><div><b>${escapeHtml(name)}</b></div>
<table>${table}</table>
<p style="opacity:.6">Playing in the emulator. It is also kept in its REPLAYS tab.</p>
<button id="play">Play again</button><button id="text" class="alt">Show as text</button>
<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
document.getElementById('play').addEventListener('click', () => vscode.postMessage({ command: 'play' }));
document.getElementById('text').addEventListener('click', () => vscode.postMessage({ command: 'text' }));
</script></body></html>`;
}

/** Registers the editor; `play(name, text)` hands the recording to the emulator panel. */
function registerReplayEditor(context: vscode.ExtensionContext, play: (name: string, text: string) => void): vscode.Disposable {
    const provider: vscode.CustomReadonlyEditorProvider = {
        openCustomDocument: uri => ({ uri, dispose: () => {} }),
        async resolveCustomEditor(document, panel) {
            const name = path.basename(document.uri.fsPath);
            const text = Buffer.from(await vscode.workspace.fs.readFile(document.uri)).toString('utf8');
            const nonce = Math.random().toString(36).slice(2);
            panel.webview.options = { enableScripts: true };
            panel.webview.html = pageHtml(name, text, nonce);
            panel.webview.onDidReceiveMessage(msg => {
                if (msg.command === 'play') play(name, text);
                else if (msg.command === 'text') vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
            });
            play(name, text);
        },
    };
    return vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, { supportsMultipleEditorsPerDocument: true });
}

export { registerReplayEditor };
