'use strict';
// Ownership: the ROM library inside VS Code (docs/architecture/multi-game.md §5–§6): the status bar
// item, Everscript: Switch ROM, the ROM panel, asking for a ROM when there is none, and telling the
// rest of the extension when the selected ROM changes. Game-neutral: games come from the registry.

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const lib = require('../../../dist/platform');
const { openRomPanel, refreshRomPanel } = require('./panel');

const listeners = new Set();
let statusItem = null;

/** Called with the selected library entry (or null) whenever the selection or the library changes. */
function onDidChangeRoms(fn) {
    listeners.add(fn);
    return { dispose: () => listeners.delete(fn) };
}

function changed() {
    updateStatus();
    refreshRomPanel(panelState());
    for (const fn of listeners) { try { fn(lib.selectedRom()); } catch (_) { /* a listener's problem */ } }
}

function label(entry) {
    const game = entry.game ? lib.gameById(entry.game) : null;
    const name = game ? game.name.replace(/^Secret of /, '') : (entry.title || path.basename(entry.path));
    const what = entry.match === 'derived' ? `${entry.variant} + ${entry.derivedKind}` : (entry.variant || 'unknown variant');
    return `${name} · ${what}`;
}

function updateStatus() {
    if (!statusItem) return;
    const sel = lib.selectedRom() || lib.listRoms()[0] || null;
    statusItem.text = sel ? `$(circuit-board) ${label(sel)}` : '$(circuit-board) No ROM';
    statusItem.tooltip = sel ? `${sel.path}\nClick: Switch ROM` : 'No ROM loaded — click to add one';
    statusItem.show();
}

/** Everything the panel shows. */
function panelState() {
    const roms = lib.listRoms();
    const games = lib.listGames().map(g => ({
        id: g.id, name: g.name, docs: g.docs, capabilities: g.capabilities,
        base: lib.baseVariant(g).name, basePath: lib.baseRom(g.id)?.path || null,
    }));
    return { games, roms, selected: lib.selectedRom()?.path || null };
}

async function addViaDialog() {
    const picked = await vscode.window.showOpenDialog({
        canSelectMany: true, openLabel: 'Add ROM', filters: { 'SNES ROM': ['sfc', 'smc', 'swc', 'fig'] },
    });
    for (const uri of picked || []) addPath(uri.fsPath);
}

function addPath(file) {
    const entry = lib.addRom(file);
    if (!entry) { vscode.window.showErrorMessage(`Everscript: cannot read ${file}`); return null; }
    if (!lib.selectedRom()) lib.selectRom(entry.path);
    if (!entry.game) vscode.window.showWarningMessage(`Everscript: ${path.basename(file)} ("${entry.title}") is no game the plugin knows yet.`);
    changed();
    return entry;
}

function handlePanelMessage(msg) {
    switch (msg.command) {
        case 'add': return addViaDialog();
        case 'drop': for (const u of msg.uris || []) { try { addPath(vscode.Uri.parse(u).fsPath); } catch (_) {} } return;
        case 'select': lib.selectRom(msg.path); return changed();
        case 'remove': lib.removeRom(msg.path); return changed();
        case 'base': lib.setBaseRom(msg.path); return changed();
        case 'docs': return vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path.join(msg.root, msg.docs)));
    }
}

/** First start with the library: adopt the ROMs the old settings and the workspace pointed at. */
function seedFromOldSettings() {
    if (lib.loadLibrary().roms.length) return;
    const cfg = vscode.workspace.getConfiguration('everscript');
    const found = [cfg.get('romPath'), cfg.get('manaRomPath')].filter(Boolean);
    for (const folder of vscode.workspace.workspaceFolders || []) {
        if (folder.uri.scheme !== 'file') continue;
        try {
            for (const n of fs.readdirSync(folder.uri.fsPath)) if (/\.(sfc|smc)$/i.test(n)) found.push(path.join(folder.uri.fsPath, n));
        } catch (_) {}
    }
    for (const f of found) if (fs.existsSync(f)) lib.addRom(f);
    const first = lib.listRoms().find(r => r.game);
    if (first) lib.selectRom(first.path);
}

/** Call after the games are registered (extension.js does that first). */
function activateRoms(context) {
    if (context.globalStorageUri) lib.setLibraryDir(context.globalStorageUri.fsPath);
    seedFromOldSettings();

    statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusItem.command = 'everscript.switchRom';
    context.subscriptions.push(
        statusItem,
        vscode.commands.registerCommand('everscript.switchRom', () => openRomPanel(context, panelState(), handlePanelMessage)),
        vscode.commands.registerCommand('everscript.addRom', addViaDialog),
    );
    updateStatus();

    if (!lib.listRoms().some(r => r.game)) {
        vscode.window.showInformationMessage('Everscript works on your own game ROM. Drop one in to start.', 'Add ROM…', 'Open ROM panel')
            .then(choice => {
                if (choice === 'Add ROM…') addViaDialog();
                else if (choice) vscode.commands.executeCommand('everscript.switchRom');
            });
    }
}

/** The ROM file a game's scheme means right now (selected, else base), or null. */
function romPathFor(game) {
    return lib.romFor(game)?.path || null;
}

module.exports = { activateRoms, onDidChangeRoms, romPathFor };
