// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// How node tools find a ROM: through the ROM library, the same one VS Code uses
// (docs/architecture/multi-game.md §5; `npm run roms` lists and adds). No environment variables.
const fs = require('fs');
const { identifyRom } = require('../dist/platform');
const games = require('../dist/games');

/** The ROM a tool should read: `explicit` if given, else the game's selected-or-base ROM. Exits when none. */
function romOrExit(game, explicit) {
    const p = explicit || games.romPath(game);
    if (p && fs.existsSync(p)) return p;
    console.error(`No ${game} ROM: add one with \`npm run roms -- add <path>\`${explicit ? ` (${explicit} not found)` : ''}.`);
    process.exit(2);
}

/** The base ROM builders start from (multi-game.md §4). An explicit path must be that base variant. */
function baseRomOrExit(game, explicit) {
    const p = explicit || games.baseRomPath(game);
    if (!p || !fs.existsSync(p)) {
        console.error(`No ${game} base ROM: add it with \`npm run roms -- add <path>\`${explicit ? ` (${explicit} not found)` : ''}.`);
        process.exit(2);
    }
    games.registerGames();
    const id = identifyRom(fs.readFileSync(p));
    const base = require('../dist/platform').gameById(game)?.variants.find(v => v.base);
    if (id.game !== game || id.match !== 'known' || id.variant !== base?.id) {
        console.error(`${p} is not the ${game} base ROM (${base?.name}); builders start from the clean base ROM.`);
        process.exit(2);
    }
    return p;
}

module.exports = { romOrExit, baseRomOrExit };
