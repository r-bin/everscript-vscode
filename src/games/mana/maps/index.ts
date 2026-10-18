// Ownership: the Secret of Mana Maps panel (lifecycle + data). It reads only
// `som://` through vscode.workspace.fs; the page itself lives in webview/.
// State owned here: the one open panel.

import * as crypto from 'crypto';
import * as vscode from 'vscode';

import { pageHtml, ROOTS } from './page';

const SOM_ROOT = vscode.Uri.parse('som://rom/');

let panel: vscode.WebviewPanel | null = null;

async function readJson(p: string) {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.parse(`som://rom/${p}`));
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
}

/** Everything the page needs, or an error to show instead. */
async function loadInit(webview: vscode.Webview) {
    try {
        const [info, maps, areas] = await Promise.all([readJson('info.json'), readJson('maps/index.json'), readJson('areas/index.json')]);
        return { title: info.title, maps, areas, somBase: String(webview.asWebviewUri(SOM_ROOT)) };
    } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        return { error: `No Secret of Mana ROM found (${why}). Add it with Everscript: Switch ROM.` };
    }
}

function render(webview: vscode.Webview, init: object) {
    return pageHtml(file => String(webview.asWebviewUri(vscode.Uri.file(file))),
        { cspSource: webview.cspSource, nonce: crypto.randomBytes(16).toString('hex'), init });
}

/** The page asks for a som://rom/ file (collision, animation); send its text back. */
async function answer(p: vscode.WebviewPanel | null, msg: { command?: string; path?: unknown } | null) {
    if (!p || !msg || msg.command !== 'read' || typeof msg.path !== 'string' || msg.path.includes('..')) return;
    let text: string | null = null;
    try { text = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.parse('som://rom/' + msg.path))).toString('utf8'); }
    catch { text = null; }
    p.webview.postMessage({ command: 'file', path: msg.path, text });
}

/** Open (or reveal) the Maps panel. */
async function openManaMaps(column = vscode.ViewColumn.Active) {
    if (panel) { panel.reveal(column); return panel; }
    const created = vscode.window.createWebviewPanel('everscript.manaMaps', 'Secret of Mana — Maps', column, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [...ROOTS.map(r => vscode.Uri.file(r)), SOM_ROOT],
    });
    panel = created;
    created.onDidDispose(() => { panel = null; });
    created.webview.onDidReceiveMessage(msg => answer(panel, msg));
    created.webview.html = render(created.webview, await loadInit(created.webview));
    return created;
}

/** Re-read `som://` (e.g. after the ROM setting changed). */
async function refreshManaMaps() {
    if (!panel) return;
    panel.webview.html = render(panel.webview, await loadInit(panel.webview));
}

function getManaMapsPanel() {
    return panel;
}

export { openManaMaps, refreshManaMaps, getManaMapsPanel };
