// Press A at a Terranigma cell in the running game: a closed door (metatile $0F3) or a pot ($0FA-$0FC)
// (docs/terra/README.md §3.9).
//   node tools/terra/check-press.mts <room id, hex> <x> <y>   (npm run build:ts first)
// Brings the room up (boot.mts), stands the player below the cell facing up, presses A, and prints every layer-0
// cell whose map word changed, the next room ($047C) and what the player holds ($0988), frame by frame where they change.
import { bootIntoRoom, PAD } from './boot.mts';

const id = parseInt(process.argv[2] ?? '', 16), cx = Number(process.argv[3]), cy = Number(process.argv[4]);
if (!Number.isInteger(id) || !Number.isInteger(cx) || !Number.isInteger(cy)) {
    console.error('usage: node tools/terra/check-press.mts <room id, hex> <x> <y>'); process.exit(2);
}
/** The player's character record ($7E:1000): +0 x, +2 y of its 16 px box's bottom centre. */
const PLAYER = 0x7E1000, UP = 0x0800;

bootIntoRoom(id).then(({ step, wait, press, r16, w16 }) => {
    for (let t = 0; t < 70; t++) { press(PAD.A); wait(10); }
    const width = r16(0x7E0826) >> 4, height = r16(0x7E082A) >> 4;
    const snap = () => { const m: number[] = []; for (let i = 0; i < width * height; i++) m.push(r16(0x7EA000 + i * 2)); return m; };
    for (let f = 0; f < 5; f++) { w16(PLAYER, cx * 16 + 8); w16(PLAYER + 2, (cy + 2) * 16); step(0); }
    for (let f = 0; f < 20; f++) step(UP);
    const before = snap();
    console.log(`room $${id.toString(16)} cell (${cx},${cy}) word $${before[cy * width + cx].toString(16)}, player at (${r16(0x7E0962)},${r16(0x7E0964)}) facing ${r16(0x7E0956)}`);
    let last = '';
    for (let f = 0; f < 240; f++) {
        step(f < 3 ? PAD.A : 0);
        const now = snap(), changed: string[] = [];
        now.forEach((w, i) => { if ((w & 0x7FFF) !== (before[i] & 0x7FFF)) changed.push(`(${i % width},${(i / width) | 0}) $${before[i].toString(16)}→$${w.toString(16)}`); });
        const line = `next room $${r16(0x7E047C).toString(16)}, held $${r16(0x7E0988).toString(16)} $09C7=$${r16(0x7E09C7).toString(16)}; ${changed.join(' ') || 'no cell changed'}`;
        if (line !== last) { console.log(`frame ${f}: ${line}`); last = line; }
    }
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
