// Ownership: Terranigma inside VS Code — the Maps panel as the game's main view
// (core/game-views.ts) and its command. Called from src/extension.js.

import * as vscode from 'vscode';
import * as gameViews from '../../core/game-views';

function activate(context: vscode.ExtensionContext) {
    const maps = (): typeof import('./maps') => require('./maps');   // lazy: the panel code loads when first opened
    context.subscriptions.push(
        vscode.commands.registerCommand('everscript.openTerraMaps', (column?: vscode.ViewColumn) => maps().openTerraMaps(column)),
        gameViews.registerGameView('terra', {
            open: (column?: vscode.ViewColumn) => maps().openTerraMaps(column),
            panel: () => maps().getTerraMapsPanel(),
            refresh: () => maps().refreshTerraMaps(),
        }),
    );
}

export { activate };
