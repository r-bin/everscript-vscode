// Open a Terranigma chest in the running game (docs/terra/README.md §3.9, §5).
//   node tools/terra/check-chest.mts <room id, hex> [chest index]   (npm run build:ts first)
// Brings the room up (boot.mts), stands the player below the chest facing up (a closed chest opens only so), presses
// A, and prints the chest cell's map word and the chest's opened flag before and after, next to what roomChests
// reads from the ROM.
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { bootIntoRoom, PAD, ROOT } from './boot.mts';

const require = createRequire(import.meta.url);
const terra = require(path.join(ROOT, 'dist/games/terra'));
const id = parseInt(process.argv[2] ?? '', 16), which = Number(process.argv[3] ?? 0);
if (!Number.isInteger(id)) { console.error('usage: node tools/terra/check-chest.mts <room id, hex> [chest index]'); process.exit(2); }
/** The player's character record ($7E:1000): +0 x, +2 y of its 16 px box's bottom centre. */
const PLAYER = 0x7E1000, UP = 0x0800;

bootIntoRoom(id).then(({ M, rom, step, wait, press, r16, w16 }) => {
    const chest = terra.roomChests(rom, id)[which];
    if (!chest) { console.error(`room ${terra.hex3(id)} has no chest #${which}`); process.exit(2); }
    for (let t = 0; t < 70; t++) { press(PAD.A); wait(10); }
    const width = r16(0x7E0826) >> 4, cell = 0x7EA000 + (chest.y * width + chest.x) * 2;
    const flag = () => chest.opened === null ? '-' : String((M.readMemory(0x7E06C0 + (chest.opened >> 3)) >> (chest.opened & 7)) & 1);
    const before = `map word $${r16(cell).toString(16)}, flag ${flag()}`;
    for (let f = 0; f < 5; f++) { w16(PLAYER, chest.x * 16 + 8); w16(PLAYER + 2, (chest.y + 2) * 16); step(0); }
    for (let f = 0; f < 20; f++) step(UP);
    for (let k = 0; k < 20; k++) { press(PAD.A); wait(20); }
    const opened = chest.opened === null ? 'none' : '$' + chest.opened.toString(16);
    console.log(`room ${terra.hex3(id)} chest #${which} (${chest.x},${chest.y}, contents $${chest.contents.toString(16)}, opened flag ${opened}): `
        + `before ${before}; after map word $${r16(cell).toString(16)}, flag ${flag()}`);
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
