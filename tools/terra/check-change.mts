// Switch a Terranigma map change on in the running game and see what the room load draws (docs/terra/README.md §3.8, §5).
//   node tools/terra/check-change.mts <room id, hex> <bit>   (npm run build:ts first)
// Brings room $103 up (boot.mts), sets bit n of `$7E:0710`, enters the room as an exit does (next room `$047C`,
// arrival `$0492`/`$0494`, bit 15 of `$097C`), then prints every cell of both layers that differs from the room as
// loadRoom builds it — next to the cells changeCells computes from the ROM. (Entering once: some rooms run an event
// on entry that holds a second, forced room change.)
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { bootIntoRoom, PAD, ROOT } from './boot.mts';

const require = createRequire(import.meta.url);
const terra = require(path.join(ROOT, 'dist/games/terra'));
const id = parseInt(process.argv[2] ?? '', 16), bit = Number(process.argv[3]);
if (!Number.isInteger(id) || !Number.isInteger(bit)) { console.error('usage: node tools/terra/check-change.mts <room id, hex> <bit>'); process.exit(2); }
const LAYER_MAPS = [0x7EA000, 0x7EE000];

bootIntoRoom(0x103).then(({ M, rom, wait, press, r16, w16 }) => {
    for (let t = 0; t < 70; t++) { press(PAD.A); wait(10); }
    const room = terra.loadRoom(rom, id);
    const change = terra.roomChanges(rom, id).find((c: { bit: number }) => c.bit === bit);
    if (!room || !change) { console.error(`room ${terra.hex3(id)} has no map change on bit ${bit}`); process.exit(2); }
    M.writeMemory(0x7E0710 + (bit >> 3), M.readMemory(0x7E0710 + (bit >> 3)) | (1 << (bit & 7)));
    w16(0x7E047C, id); w16(0x7E0492, 16 * 16); w16(0x7E0494, 16 * 16); w16(0x7E097C, r16(0x7E097C) | 0x8000);
    wait(240);
    if (r16(0x7E047E) !== id) { console.error(`the game did not enter room ${terra.hex3(id)}`); process.exit(1); }
    const off = room.layers.map((l: { cells: Uint16Array }) => Array.from(l.cells, (w: number) => w & 0x7FFF));
    const on = room.layers.map((l: { index: number; cells: Uint16Array }) =>
        Array.from({ length: l.cells.length }, (_, i) => r16(LAYER_MAPS[l.index] + i * 2) & 0x7FFF));
    const cell = (layer: number, x: number, y: number, k = room.layers.findIndex((l: { index: number }) => l.index === layer)) => k * 0x100000 + y * room.layers[k].w + x;
    const table = new Map<number, string>(terra.changeCells(room, change).map(([layer, x, y, w]: number[]) => [cell(layer, x, y), `${layer}:${x},${y}=$${w.toString(16)}`]));
    const wrong: string[] = [], other: string[] = [];
    for (const [layer, x, y, w] of terra.changeCells(room, change) as number[][]) {
        const k = room.layers.findIndex((l: { index: number }) => l.index === layer), got = on[k][y * room.layers[k].w + x];
        if (got !== w) wrong.push(`${layer}:${x},${y} is $${got.toString(16)}, not $${w.toString(16)}`);
    }
    room.layers.forEach((l: { index: number; w: number }, k: number) => on[k].forEach((v: number, i: number) => {
        if (v !== off[k][i] && !table.has(cell(l.index, i % l.w, Math.floor(i / l.w)))) other.push(`${l.index}:${i % l.w},${Math.floor(i / l.w)}`);
    }));
    console.log(`room ${terra.hex3(id)} bit ${bit}: the table writes ${[...table.values()].join(' ')}; `
        + (wrong.length ? 'the game DIFFERS: ' + wrong.join(', ') : 'the game has all of them')
        + (other.length ? ` (the room also changed ${other.length} other cell${other.length === 1 ? '' : 's'} itself: ${other.slice(0, 8).join(' ')}${other.length > 8 ? ' …' : ''})` : ''));
    process.exit(wrong.length ? 1 : 0);
}).catch(e => { console.error(e.message); process.exit(1); });
