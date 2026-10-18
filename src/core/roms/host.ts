// Ownership: the ROM library inside VS Code (docs/architecture/multi-game.md §5–§6): the status bar
// item, Everscript: Switch ROM, the ROM panel, asking for a ROM when there is none, and telling the
// rest of the extension when the selected ROM changes. Game-neutral: games come from the registry.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as lib from '../../platform';
import { openRomPanel, refreshRomPanel } from './panel';

type RomEntry = lib.LibraryEntry;

const listeners = new Set<(entry: RomEntry | null) => void>();
let statusItem: vscode.StatusBarItem | null = null;

/** Called with the selected library entry (or null) whenever the selection or the library changes. */
function onDidChangeRoms(fn: (entry: RomEntry | null) => void): vscode.Disposable {
    listeners.add(fn);
    return { dispose: () => listeners.delete(fn) };
}

function changed() {
    updateStatus();
    refreshRomPanel(panelState());
    for (const fn of listeners) { try { fn(lib.selectedRom()); } catch (_) { /* a listener's problem */ } }
}

function label(entry: RomEntry): string {
    const game = entry.game ? lib.gameById(entry.game) : null;
    const name = game ? game.name.replace(/^Secret of /, '') : (entry.title || path.basename(entry.path));
    const what = entry.match === 'derived' ? `${entry.variant} + ${entry.derivedKind}` : (entry.variant || 'unknown variant');
    return `${name} · ${what}`;
}

function updateStatus() {
    if (!statusItem) return;
    const sel = lib.selectedRom() || lib.listRoms()[0] || null;
    const item = statusItem;
    item.text = sel ? `$(circuit-board) ${label(sel)}` : '$(circuit-board) No ROM';
    item.tooltip = sel ? `${sel.path}\nClick: Switch ROM` : 'No ROM loaded — click to add one';
    item.show();
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

function addPath(file: string): RomEntry | null {
    const entry = lib.addRom(file);
    if (!entry) { vscode.window.showErrorMessage(`Everscript: cannot read ${file}`); return null; }
    if (!lib.selectedRom()) lib.selectRom(entry.path);
    if (!entry.game) vscode.window.showWarningMessage(`Everscript: ${path.basename(file)} ("${entry.title}") is no game the plugin knows yet.`);
    changed();
    return entry;
}

/** The ROM panel's requests (webview/rom-panel.js). */
type PanelMessage = { command: string; root: string; path?: string; uris?: string[]; docs?: string };

function handlePanelMessage(msg: PanelMessage) {
    switch (msg.command) {
        case 'add': return addViaDialog();
        case 'drop': for (const u of msg.uris || []) { try { addPath(vscode.Uri.parse(u).fsPath); } catch (_) {} } return;
        case 'select': if (msg.path) lib.selectRom(msg.path); return changed();
        case 'remove': if (msg.path) lib.removeRom(msg.path); return changed();
        case 'base': if (msg.path) lib.setBaseRom(msg.path); return changed();
        case 'docs': return msg.docs ? vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path.join(msg.root, msg.docs))) : undefined;
    }
}

/** First start with the library: adopt the ROMs the old settings and the workspace pointed at. */
function seedFromOldSettings() {
    if (lib.loadLibrary().roms.length) return;
    const cfg = vscode.workspace.getConfiguration('everscript');
    const found = [cfg.get<string>('romPath'), cfg.get<string>('manaRomPath')].filter((f): f is string => !!f);
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
function activateRoms(context: vscode.ExtensionContext): void {
    if (context.globalStorageUri) lib.setLibraryDir(context.globalStorageUri.fsPath);
    seedFromOldSettings();

    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusItem = item;
    item.command = 'everscript.switchRom';
    context.subscriptions.push(
        item,
        vscode.commands.registerCommand('everscript.switchRom', () => openRomPanel(context, panelState(), (m) => handlePanelMessage(m as PanelMessage))),
        vscode.commands.registerCommand('everscript.addRom', addViaDialog),
    );
    updateStatus();

    if (!lib.listRoms().some(r => r.game)) {
        vscode.window.showInformationMessage('Everscript works on your own game ROM. Drop one in to start.', 'Add ROM…', 'Open ROM panel')
            ?.then?.(choice => {
                if (choice === 'Add ROM…') addViaDialog();
                else if (choice) vscode.commands.executeCommand('everscript.switchRom');
            });
    }
}

/** The ROM file a game's scheme means right now (selected, else base), or null. */
function romPathFor(game: string): string | null {
    return lib.romFor(game)?.path || null;
}

/** `Evermore · us`: the ROM a game's panels show right now (romFor), for their titles; null when none. */
function romLabel(game: string): string | null {
    const entry = lib.romFor(game);
    return entry ? label(entry) : null;
}

/** The game of the selected ROM (`evermore`, `mana`, …), or null when none is selected. */
function selectedGame(): string | null {
    return lib.selectedRom()?.game || null;
}

export { activateRoms, onDidChangeRoms, romPathFor, romLabel, selectedGame };
