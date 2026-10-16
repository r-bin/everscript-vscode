'use strict';
// Composition root (docs/architecture/multi-game.md §2): the game-neutral layers, then the one list
// of games. Each game's extension.js registers what it offers; removing a game is deleting its folder,
// its line here and its line in src/games/index.ts.

const GAMES = [
    require('./games/evermore/extension'),
    require('./games/mana/extension'),
    require('./games/terra/extension'),
];

function activate(context) {
    // The game descriptors, then the ROM library: every reader asks it which ROM to use (§3, §5).
    require('../dist/games').registerGames();
    require('./core/roms/host').activateRoms(context);
    for (const game of GAMES) game.activate(context);
    // After the games: their own Switch ROM listeners (caches) run before views are swapped.
    require('./core/game-views').activateGameViews(context);
    // AI clients read the games' file systems over MCP (core/mcp/README.md).
    require('./core/mcp').registerMcpServer(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
