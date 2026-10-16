'use strict';
// Ownership: Secret of Mana inside VS Code — the read-only som:// file system and the Maps panel as
// the game's main view (core/game-views.js). Called from src/extension.js.

const roms = require('../../core/roms/host');
const gameViews = require('../../core/game-views');

function activate(context) {
    // som:// (resources/README.md): its own tree, never mixed into soe://.
    const manaResources = require('./resources').registerManaResources(context, () => ({ path: roms.romPathFor('mana') }));
    const maps = () => require('./maps');   // lazy: the panel code loads when first opened
    context.subscriptions.push(
        roms.onDidChangeRoms(() => manaResources.refresh()),
        gameViews.registerGameView('mana', {
            open: column => maps().openManaMaps(column),
            panel: () => maps().getManaMapsPanel(),
            refresh: () => maps().refreshManaMaps(),
        }),
    );
}

module.exports = { activate };
