// Ownership: Terranigma inside VS Code — the read-only terra:// file system and the Maps panel as the
// game's main view (core/game-views.ts) and its command. Called from src/extension.js.

import * as vscode from 'vscode';
import * as gameViews from '../../core/game-views';
import * as roms from '../../core/roms/host';
import { registerTerraResources } from './resources';

function activate(context: vscode.ExtensionContext) {
    // terra:// (resources/README.md): its own tree, never mixed into another game's.
    const resources = registerTerraResources(context, () => ({ path: roms.romPathFor('terra') }));
    const maps = (): typeof import('./maps') => require('./maps');   // lazy: the panel code loads when first opened
    context.subscriptions.push(
        roms.onDidChangeRoms(() => resources.refresh()),
        vscode.commands.registerCommand('everscript.openTerraMaps', (column?: vscode.ViewColumn) => maps().openTerraMaps(column)),
        gameViews.registerGameView('terra', {
            open: (column?: vscode.ViewColumn) => maps().openTerraMaps(column),
            panel: () => maps().getTerraMapsPanel(),
            refresh: () => maps().refreshTerraMaps(),
        }),
    );
}

export { activate };
