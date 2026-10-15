'use strict';
// Ownership: the Secret of Mana Maps panel (lifecycle + data). It reads only
// `som://` through vscode.workspace.fs; the page itself lives in webview/.
// State owned here: the one open panel.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vscode = require('vscode');

const SOM_ROOT = vscode.Uri.parse('som://rom/');
const WEBVIEW_DIR = path.join(__dirname, 'webview');
// Map-view pieces shared with the Evermore Rooms tab (chips, their CSS, the animation player).
const MAP_VIEW_DIR = path.join(__dirname, '..', 'shared', 'webview', 'map-view');
// The game-neutral editor core (history, sessions, grid strokes, tool strip) the editor page is built on.
const EDITOR_CORE_DIR = path.join(__dirname, '..', 'shared', 'webview', 'map-editor-core');

/** @type {vscode.WebviewPanel | null} */
let panel = null;

/** @param {string} p */
async function readJson(p) {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.parse(`som://rom/${p}`));
    return JSON.parse(Buffer.from(bytes).toString('utf8'));
}

/** Everything the page needs, or an error to show instead. */
async function loadInit(/** @type {vscode.Webview} */ webview) {
    try {
        const [info, maps, areas] = await Promise.all([readJson('info.json'), readJson('maps/index.json'), readJson('areas/index.json')]);
        return { title: info.title, maps, areas, somBase: String(webview.asWebviewUri(SOM_ROOT)) };
    } catch (err) {
        const why = err && /** @type {Error} */ (err).message || String(err);
        return { error: `No Secret of Mana ROM found (${why}). Set everscript.manaRomPath to your ROM file.` };
    }
}

/** @param {vscode.Webview} webview @param {vscode.Uri} base @param {object} init */
function pageHtml(webview, base, init) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const values = /** @type {Record<string, string>} */ ({
        cspSource: webview.cspSource,
        nonce,
        styleUri: String(webview.asWebviewUri(vscode.Uri.joinPath(base, 'style.css'))),
        scriptUri: String(webview.asWebviewUri(vscode.Uri.joinPath(base, 'main.js'))),
        mapSvgJs: String(webview.asWebviewUri(vscode.Uri.joinPath(base, 'map-svg.js'))),
        mapViewCss: String(webview.asWebviewUri(vscode.Uri.file(path.join(MAP_VIEW_DIR, 'map-view.css')))),
        animJs: String(webview.asWebviewUri(vscode.Uri.file(path.join(MAP_VIEW_DIR, 'tile-animation.js')))),
        chipsJs: String(webview.asWebviewUri(vscode.Uri.file(path.join(MAP_VIEW_DIR, 'view-chips.js')))),
        coreCss: String(webview.asWebviewUri(vscode.Uri.file(path.join(EDITOR_CORE_DIR, 'map-editor-core.css')))),
        coreHistoryJs: String(webview.asWebviewUri(vscode.Uri.file(path.join(EDITOR_CORE_DIR, 'edit-history.js')))),
        coreSessionJs: String(webview.asWebviewUri(vscode.Uri.file(path.join(EDITOR_CORE_DIR, 'edit-session.js')))),
        coreGridJs: String(webview.asWebviewUri(vscode.Uri.file(path.join(EDITOR_CORE_DIR, 'edit-grid.js')))),
        coreToolsJs: String(webview.asWebviewUri(vscode.Uri.file(path.join(EDITOR_CORE_DIR, 'edit-tools.js')))),
        editorModelJs: String(webview.asWebviewUri(vscode.Uri.joinPath(base, 'editor-model.js'))),
        editorJs: String(webview.asWebviewUri(vscode.Uri.joinPath(base, 'editor.js'))),
        init: JSON.stringify(init).replace(/</g, '\\u003c'),
    });
    const html = fs.readFileSync(path.join(WEBVIEW_DIR, 'index.html'), 'utf8');
    return html.replace(/\{\{(\w+)\}\}/g, (_, k) => values[k] ?? '');
}

/** The page asks for a som://rom/ file (collision, animation); send its text back. */
async function answer(p, msg) {
    if (!p || !msg || msg.command !== 'read' || typeof msg.path !== 'string' || msg.path.includes('..')) return;
    let text = null;
    try { text = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.parse('som://rom/' + msg.path))).toString('utf8'); }
    catch { text = null; }
    p.webview.postMessage({ command: 'file', path: msg.path, text });
}

/** Open (or reveal) the Maps panel. */
async function openManaMaps() {
    if (panel) { panel.reveal(); return panel; }
    const base = vscode.Uri.file(WEBVIEW_DIR);
    panel = vscode.window.createWebviewPanel('everscript.manaMaps', 'Secret of Mana — Maps', vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [base, vscode.Uri.file(MAP_VIEW_DIR), vscode.Uri.file(EDITOR_CORE_DIR), SOM_ROOT],
    });
    panel.onDidDispose(() => { panel = null; });
    panel.webview.onDidReceiveMessage(msg => answer(panel, msg));
    panel.webview.html = pageHtml(panel.webview, base, await loadInit(panel.webview));
    return panel;
}

/** Re-read `som://` (e.g. after the ROM setting changed). */
async function refreshManaMaps() {
    if (!panel) return;
    panel.webview.html = pageHtml(panel.webview, vscode.Uri.file(WEBVIEW_DIR), await loadInit(panel.webview));
}

module.exports = { openManaMaps, refreshManaMaps };
