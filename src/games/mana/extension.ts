// Ownership: Secret of Mana inside VS Code — the read-only som:// file system and the Maps panel as
// the game's main view (core/game-views.ts). Called from src/extension.ts.

import type * as vscode from 'vscode';
import * as roms from '../../core/roms/host';
import * as gameViews from '../../core/game-views';
import { registerManaResources } from './resources';

function activate(context: vscode.ExtensionContext) {
    // som:// (resources/README.md): its own tree, never mixed into soe://.
    const manaResources = registerManaResources(context, () => ({ path: roms.romPathFor('mana') }));
    const maps = (): typeof import('./maps') => require('./maps');   // lazy: the panel code loads when first opened
    context.subscriptions.push(
        roms.onDidChangeRoms(() => manaResources.refresh()),
        gameViews.registerGameView('mana', {
            open: (column?: vscode.ViewColumn) => maps().openManaMaps(column),
            panel: () => maps().getManaMapsPanel(),
            refresh: () => maps().refreshManaMaps(),
        }),
    );
}

export { activate };

