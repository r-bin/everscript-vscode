'use strict';
// The ROM library from the command line (docs/architecture/multi-game.md §5): the same file VS Code uses.
//   npm run roms                  list
//   npm run roms -- add <path>    add (or refresh) a ROM
//   npm run roms -- select <path> make it the selected ROM
//   npm run roms -- base <path>   mark it as its game's base ROM by hand
//   npm run roms -- remove <path>
const lib = require('../dist/platform');
require('../dist/games').registerGames();

const [cmd = 'list', file] = process.argv.slice(2);
const actions = { add: lib.addRom, select: lib.selectRom, base: lib.setBaseRom, remove: lib.removeRom };
if (cmd !== 'list') {
    if (!actions[cmd] || !file) { console.error('usage: roms.js [list | add|select|base|remove <path>]'); process.exit(2); }
    if (actions[cmd](file) === null) { console.error(`cannot read ${file}`); process.exit(1); }
}
const sel = lib.selectedRom();
console.log(`library: ${lib.libraryPath()}`);
for (const r of lib.listRoms()) {
    const base = lib.baseRom(r.game || '')?.path === r.path ? '★' : ' ';
    const what = r.match === 'derived' ? `${r.variant} + ${r.derivedKind}` : (r.variant || r.match);
    console.log(`${sel?.path === r.path ? '>' : ' '}${base} ${(r.game || '?').padEnd(9)} ${what.padEnd(16)} ${r.path}`);
}
