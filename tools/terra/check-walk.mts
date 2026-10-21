// Walk the player into a cell in the running game and print where it goes (docs/terra/README.md §3.6, §5).
//   node tools/terra/check-walk.mts <room id, hex> <cell x> <cell y> <up|down|left|right> [dx] [dy]   (npm run build:ts first)
// Brings the room up (boot.mts), puts the player's 16 px box on cell (x, y) (+ dx, dy pixels) — its character record
// `$7E:1000`, +0 x and +2 y the box's bottom centre — then holds the direction for 90 frames and prints each new box
// position (`$095E`/`$0960`): where a move stops, and how a diagonal (types 6 and 7) slides it.
import { bootIntoRoom, PAD } from './boot.mts';

const [roomHex, cx, cy, dir, dx = '0', dy = '0'] = process.argv.slice(2);
const PADS: Record<string, number> = { up: 0x0800, down: 0x0400, left: 0x0200, right: 0x0100 };
if (!roomHex || !PADS[dir]) { console.error('usage: node tools/terra/check-walk.mts <room hex> <cell x> <cell y> <up|down|left|right> [dx] [dy]'); process.exit(2); }
/** The player's character record (bank $7E): the first record, the one that moves with the pad. */
const PLAYER = 0x7E1000;

bootIntoRoom(parseInt(roomHex, 16)).then(({ step, wait, press, r16, w16 }) => {
    for (let t = 0; t < 70; t++) { press(PAD.A); wait(10); }
    const x = Number(cx) * 16 + 8 + Number(dx), y = Number(cy) * 16 + 16 + Number(dy);
    for (let f = 0; f < 5; f++) { w16(PLAYER, x); w16(PLAYER + 2, y); step(0); }
    const path: string[] = [];
    for (let f = 0; f < 90; f++) {
        step(PADS[dir]);
        const p = r16(0x7E095E) + ',' + r16(0x7E0960);
        if (p !== path[path.length - 1]) path.push(p);
    }
    console.log(`${dir} from box ${x - 8},${y - 16}: ${path.join(' ')}`);
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
