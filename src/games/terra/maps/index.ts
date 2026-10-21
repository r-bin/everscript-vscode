// Ownership: the Terranigma Maps panel (lifecycle + data). It reads only `terra://` through
// vscode.workspace.fs; the page itself lives in webview/ (built from the shared editor shell).
// State owned here: the one open panel.

import * as crypto from 'crypto';
import * as vscode from 'vscode';

import { pageHtml, ROOTS } from './page';

const ROOT = vscode.Uri.parse('terra://rom/');

let panel: vscode.WebviewPanel | null = null;

async function readJson(p: string) {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.parse(`terra://rom/${p}`));
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
}

/** Everything the page needs, or an error to show instead. */
async function loadInit(webview: vscode.Webview) {
    try {
        const info = await readJson('info.json');
        if (!info.supported) return { error: 'This Terranigma release is recognised, but only the European ROM (eu) is decoded. Pick it with Everscript: Switch ROM.' };
        const [rooms, groups, cellTypes] = await Promise.all([readJson('rooms/index.json'), readJson('groups/index.json'), readJson('cell-types.json')]);
        return { supported: true, rooms, groups, cellTypes, terraBase: String(webview.asWebviewUri(ROOT)) };
    } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        return { error: `No Terranigma ROM found (${why}). Add it with Everscript: Switch ROM.` };
    }
}

function render(webview: vscode.Webview, init: object) {
    return pageHtml(file => String(webview.asWebviewUri(vscode.Uri.file(file))),
        { cspSource: webview.cspSource, nonce: crypto.randomBytes(16).toString('hex'), init });
}

/** The page asks for a terra://rom/ file (a room's data); send its text back. */
async function answer(p: vscode.WebviewPanel | null, msg: { command?: string; path?: unknown } | null) {
    if (!p || !msg || msg.command !== 'read' || typeof msg.path !== 'string' || msg.path.includes('..')) return;
    let text: string | null = null;
    try { text = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.parse('terra://rom/' + msg.path))).toString('utf8'); }
    catch { text = null; }
    p.webview.postMessage({ command: 'file', path: msg.path, text });
}

/** Open (or reveal) the Maps panel. */
async function openTerraMaps(column = vscode.ViewColumn.Active) {
    if (panel) { panel.reveal(column); return panel; }
    const created = vscode.window.createWebviewPanel('everscript.terraMaps', 'Terranigma — Maps', column, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [...ROOTS.map(r => vscode.Uri.file(r)), ROOT],
    });
    panel = created;
    created.onDidDispose(() => { panel = null; });
    created.webview.onDidReceiveMessage(msg => answer(panel, msg));
    created.webview.html = '<!DOCTYPE html><html><body style="padding:24px;opacity:.8">Reading the room table…</body></html>';
    created.webview.html = render(created.webview, await loadInit(created.webview));
    return created;
}

/** Re-read `terra://` (e.g. after the ROM changed). */
async function refreshTerraMaps() {
    if (!panel) return;
    panel.webview.html = render(panel.webview, await loadInit(panel.webview));
}

function getTerraMapsPanel() {
    return panel;
}

export { openTerraMaps, refreshTerraMaps, getTerraMapsPanel };
