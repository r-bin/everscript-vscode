// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Ownership: Terranigma inside VS Code — the Maps panel as the game's main view
// (core/game-views.ts) and its command. Called from src/extension.js.

const vscode = require('vscode');
const gameViews = require('../../../dist/core/game-views');

function activate(context) {
    const maps = () => require('./maps');   // lazy: the panel code loads when first opened
    context.subscriptions.push(
        vscode.commands.registerCommand('everscript.openTerraMaps', column => maps().openTerraMaps(column)),
        gameViews.registerGameView('terra', {
            open: column => maps().openTerraMaps(column),
            panel: () => maps().getTerraMapsPanel(),
            refresh: () => maps().refreshTerraMaps(),
        }),
    );
}

module.exports = { activate };
