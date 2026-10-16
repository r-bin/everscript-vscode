'use strict';
// Ownership: the Secret of Mana Maps panel (lifecycle + data). It reads only
// `som://` through vscode.workspace.fs; the page itself lives in webview/.
// State owned here: the one open panel.

const crypto = require('crypto');
const vscode = require('vscode');

const SOM_ROOT = vscode.Uri.parse('som://rom/');
const { pageHtml, ROOTS } = require('./page');

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
        return { error: `No Secret of Mana ROM found (${why}). Add it with Everscript: Switch ROM.` };
    }
}

/** @param {vscode.Webview} webview @param {object} init */
function render(webview, init) {
    return pageHtml(file => String(webview.asWebviewUri(vscode.Uri.file(file))),
        { cspSource: webview.cspSource, nonce: crypto.randomBytes(16).toString('hex'), init });
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
async function openManaMaps(column = vscode.ViewColumn.Active) {
    if (panel) { panel.reveal(column); return panel; }
    panel = vscode.window.createWebviewPanel('everscript.manaMaps', 'Secret of Mana — Maps', column, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [...ROOTS.map(r => vscode.Uri.file(r)), SOM_ROOT],
    });
    panel.onDidDispose(() => { panel = null; });
    panel.webview.onDidReceiveMessage(msg => answer(panel, msg));
    panel.webview.html = render(panel.webview, await loadInit(panel.webview));
    return panel;
}

/** Re-read `som://` (e.g. after the ROM setting changed). */
async function refreshManaMaps() {
    if (!panel) return;
    panel.webview.html = render(panel.webview, await loadInit(panel.webview));
}

function getManaMapsPanel() {
    return panel;
}

module.exports = { openManaMaps, refreshManaMaps, getManaMapsPanel };
