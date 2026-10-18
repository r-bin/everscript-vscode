// Ownership: each game's main view (Evermore: the Memory Radar; Mana and Terranigma: their Maps
// panels), which one opens for the selected ROM, and the ROM each open view shows
// (docs/architecture/multi-game.md §6: one command, any game; panels keep their ROM). Games register
// their view. Switch ROM refreshes the selected game's open view; views of other games keep the ROM
// they had (the library remembers one per game), so Evermore and Mana can sit side by side. Every
// view's title names its ROM. Knows no game by name.

import * as vscode from 'vscode';
import * as roms from './roms/host';

/** A game's main view. `panel()` returns its open WebviewPanel, if any. */
interface GameView { open(column?: vscode.ViewColumn): unknown; panel(): vscode.WebviewPanel | null | undefined; refresh?(): void }

const views = new Map<string, GameView>();
/** The title each panel was created with, before the ROM was added to it. */
const baseTitles = new WeakMap<vscode.WebviewPanel, string>();

function registerGameView(gameId: string, view: GameView): vscode.Disposable {
    views.set(gameId, view);
    return { dispose: () => { if (views.get(gameId) === view) views.delete(gameId); } };
}

/**
 * Opens the selected game's view when that game is not `exceptGame` (the caller's own game) and has
 * one. True when it opened something, so the caller does not open its own view.
 */
function openSelectedGameView(column?: vscode.ViewColumn, exceptGame?: string): boolean {
    const game = roms.selectedGame();
    if (!game || game === exceptGame) return false;
    const view = views.get(game);
    if (!view) return false;
    view.open(column);
    retitle();
    return true;
}

/** `Memory Radar — Evermore · us`: each open view's title says which ROM it shows. */
function retitle() {
    for (const [game, view] of views) {
        let panel;
        try { panel = view.panel(); } catch (_) { continue; }
        if (!panel) continue;
        if (!baseTitles.has(panel)) baseTitles.set(panel, panel.title);
        const rom = roms.romLabel(game);
        const base = baseTitles.get(panel) ?? panel.title;
        const title = rom ? `${base} — ${rom}` : base;
        if (panel.title !== title) panel.title = title;
    }
}

/** Switch ROM: the selected game's open view follows the selection; the others keep their ROM. */
function onRomChanged() {
    const game = roms.selectedGame();
    const target = game ? views.get(game) : null;
    if (target && target.panel() && target.refresh) target.refresh();
    retitle();
}

function activateGameViews(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        roms.onDidChangeRoms(() => onRomChanged()),
        // A view opened by its own command gets its ROM in the title as its tab appears.
        vscode.window.tabGroups?.onDidChangeTabs?.(() => retitle()) ?? { dispose() {} },
    );
}

export type { GameView };
export { registerGameView, openSelectedGameView, activateGameViews };
