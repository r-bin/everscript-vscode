// Composition root (docs/architecture/multi-game.md §2): the game-neutral layers, then the one list
// of games. Each game's extension.ts registers what it offers; removing a game is deleting its folder,
// its line here and its line in src/games/index.ts.

import type * as vscode from 'vscode';
import * as evermore from './games/evermore/extension';
import * as mana from './games/mana/extension';
import * as terra from './games/terra/extension';
import { registerGames } from './games';
import { activateRoms } from './core/roms/host';
import { activateGameViews } from './core/game-views';
import { registerMcpServer } from './core/mcp';
import { checkLastSession, emergencySave } from './core/emulator/panel';

const GAMES: { activate(context: vscode.ExtensionContext): void | Promise<void> }[] = [evermore, mana, terra];

function activate(context: vscode.ExtensionContext) {
    // The game descriptors, then the ROM library: every reader asks it which ROM to use (§3, §5).
    registerGames();
    activateRoms(context);
    for (const game of GAMES) game.activate(context);
    // After the games: their own Switch ROM listeners (caches) run before views are swapped.
    activateGameViews(context);
    // AI clients read the games' file systems over MCP (core/mcp/README.md).
    registerMcpServer(context);
    // An emulator session a stopped extension host left open (core/emulator/session-watch.ts).
    checkLastSession(context);
}

// VS Code closing: the emulator's CDL and replay in memory go to disk first.
function deactivate() {
    emergencySave();
}

export { activate, deactivate };

