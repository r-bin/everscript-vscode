// Check a Terranigma exit against the running game (docs/terra/README.md §3.7, §5).
//   node tools/terra/check-exit.mts <room id, hex> [exit index] [--flag <hex>]   (npm run build:ts first)
// Brings the room up (boot.mts), presses A until the player's character (`$0DEE`) has a position, then stands it
// inside the exit's rectangle — its entity at the rectangle's top-left cell, the position words the exit check
// reads (`$095E`/`$0960` pixels, `$0962`/`$0964` cells) held there — and waits for the exit check ($8D:8797)
// to set the next room (`$047C`). Prints the room the game took and the one roomExits reads from the ROM.
// `--flag n` sets event flag n first (bit n & 7 of `$7E:06C0 + (n >> 3)`), to see which choice an exit by flag takes.
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { bootIntoRoom, PAD, ROOT } from './boot.mts';

const require = createRequire(import.meta.url);
const terra = require(path.join(ROOT, 'dist/games/terra'));

const args = process.argv.slice(2);
const flagAt = args.indexOf('--flag');
const flag = flagAt >= 0 ? parseInt(args.splice(flagAt, 2)[1], 16) : null;
const id = parseInt(args[0] ?? '', 16);
const which = Number(args[1] ?? 0);
if (!Number.isInteger(id)) { console.error('usage: node tools/terra/check-exit.mts <room id, hex> [exit index] [--flag <hex>]'); process.exit(2); }

bootIntoRoom(id).then(({ M, rom, step, wait, press, r16, w16 }) => {
    const exit = terra.roomExits(rom, id)[which];
    if (!exit) { console.error(`room ${terra.hex3(id)} has no exit #${which}`); process.exit(2); }
    const player = () => (0x7E << 16) | r16(0x7E0DEE);   // the record is in bank $7E
    for (let t = 0; t < 60 && !(r16(player()) && r16(player() + 2)); t++) { press(PAD.A); wait(20); }
    if (!r16(player())) { console.error('the player character never got a position (an event still runs)'); process.exit(1); }
    if (flag !== null) M.writeMemory(0x7E06C0 + (flag >> 3), M.readMemory(0x7E06C0 + (flag >> 3)) | (1 << (flag & 7)));
    const px = exit.x * 16, py = exit.y * 16;
    let taken = 0;
    for (let f = 0; f < 300 && !taken; f++) {
        // The entity's position is the box's bottom centre: 8 px right of and 16 px below the box's top-left.
        w16(player(), px + 8); w16(player() + 2, py + 16);
        w16(0x7E095E, px); w16(0x7E0960, py); w16(0x7E0962, exit.x); w16(0x7E0964, exit.y);
        step(0);
        taken = r16(0x7E047C);
    }
    const expected = exit.targets.map((t: { room: number; flag: number | null }) => terra.hex3(t.room) + (t.flag ? ' (flag ' + t.flag.toString(16) + ')' : '')).join(' or ');
    if (!taken) { console.log(`room ${terra.hex3(id)} exit #${which} (${exit.x},${exit.y}): the game took no exit; the table says ${expected}`); process.exit(1); }
    const ok = exit.targets.some((t: { room: number }) => t.room === taken);
    console.log(`room ${terra.hex3(id)} exit #${which} (${exit.x},${exit.y})${flag !== null ? ' with flag ' + flag.toString(16) : ''}: the game goes to ${terra.hex3(taken)}; the table says ${expected} — ${ok ? 'agree' : 'DIFFER'}`);
    process.exit(ok ? 0 : 1);
}).catch(e => { console.error(e.message); process.exit(1); });
