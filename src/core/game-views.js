'use strict';
// Ownership: each game's main view (Evermore: the Memory Radar; Mana and Terranigma: their Maps
// panels) and which one is shown for the selected ROM (docs/architecture/multi-game.md §6: one
// command, any game). Games register their view; on Switch ROM, an open view of another game is
// replaced in the same column by the selected game's view, and the selected game's own open view is
// refreshed. Knows no game by name.

const vscode = require('vscode');
const roms = require('./roms/host');

/** @type {Map<string, { open(column?: vscode.ViewColumn): unknown, panel(): vscode.WebviewPanel | null | undefined, refresh?(): void }>} */
const views = new Map();

/** A game's main view. `panel()` returns its open WebviewPanel, if any. */
function registerGameView(gameId, view) {
    views.set(gameId, view);
    return { dispose: () => { if (views.get(gameId) === view) views.delete(gameId); } };
}

/**
 * Opens the selected game's view when that game is not `exceptGame` (the caller's own game) and has
 * one. True when it opened something, so the caller does not open its own view.
 */
function openSelectedGameView(column, exceptGame) {
    const game = roms.selectedGame();
    if (!game || game === exceptGame) return false;
    const view = views.get(game);
    if (!view) return false;
    view.open(column);
    return true;
}

/** Switch ROM: swap an open view of another game for the selected game's, or refresh its own. */
function onRomChanged() {
    const game = roms.selectedGame();
    const target = game ? views.get(game) : null;
    let column = null;
    for (const [id, view] of views) {
        if (id === game) continue;
        const panel = view.panel();
        if (!panel) continue;
        column = column || panel.viewColumn || vscode.ViewColumn.Active;
        panel.dispose();
    }
    if (!target) return;
    if (column) target.open(column);
    else if (target.panel() && target.refresh) target.refresh();
}

function activateGameViews(context) {
    context.subscriptions.push(roms.onDidChangeRoms(() => onRomChanged()));
}

module.exports = { registerGameView, openSelectedGameView, activateGameViews };
