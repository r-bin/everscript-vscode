// What vanilla writes in VRAM, CGRAM, OAM and ARAM while a stored playback plays (docs/open-evermore/memory.md §2,
// tracker docs/todo/wram-allocation.md M0/M2). Per block of each memory: `used` = share of samples where the block held a
// non-zero byte, `churn` = share where it changed since the previous sample. Prints one JSON object.
//
//   node tools/open-evermore/memory-probe.mts <rom> <movie.evsmv> [--every 4]
//
// Offsets are bytes (a VRAM word address is half). Needs dist/ (npm run build:ts) for the movie parser.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { boot } from '../c-to-rom/emu.mts';

const require = createRequire(import.meta.url);
const { parseMovie, groupEvents } = require('../../dist/platform/tas/movie');

/** The debugger core's space ids (exports.c getSpacePtr) and the block size each is measured in. */
const SPACES = { vram: { id: 0, block: 0x400 }, cgram: { id: 1, block: 0x20 }, oam: { id: 2, block: 0x20 }, aram: { id: 4, block: 0x400 } } as const;
type Space = keyof typeof SPACES;

const args = process.argv.slice(2);
const flag = args.indexOf('--every');
const every = flag >= 0 ? Number(args.splice(flag, 2)[1]) : 4;
const [romPath, moviePath] = args;
if (!romPath || !moviePath || !(every >= 1)) {
    console.error('usage: node tools/open-evermore/memory-probe.mts <rom> <movie.evsmv> [--every 4]');
    process.exit(2);
}
const movie = parseMovie(readFileSync(moviePath, 'utf8'), moviePath);
const events: Map<number, { kind: string; addr: number; bytes: number[] }[]> = groupEvents(movie.events);
const core = await boot(new Uint8Array(readFileSync(romPath)), movie.meta.audio);
const read = (s: Space): Uint8Array => {
    const p = core.M._getSpacePtr(SPACES[s].id), n = core.M._getSpaceSize(SPACES[s].id);
    return new Uint8Array((globalThis as unknown as { HEAPU8: Uint8Array }).HEAPU8.buffer, p, n).slice();
};
const names = Object.keys(SPACES) as Space[];
const prev = {} as Record<Space, Uint8Array>, used = {} as Record<Space, number[]>, churn = {} as Record<Space, number[]>;
for (const s of names) {
    prev[s] = read(s);
    const blocks = Math.ceil(prev[s].length / SPACES[s].block);
    used[s] = new Array(blocks).fill(0); churn[s] = new Array(blocks).fill(0);
}
let samples = 0;
for (let f = 0; f < movie.count; f++) {
    for (const ev of events.get(f) ?? []) if (ev.kind === 'W') ev.bytes.forEach((b, i) => core.M.writeMemory(ev.addr + i, b));
    core.frame(movie.pads[f] ?? 0);
    if (f % every) continue;
    samples++;
    for (const s of names) {
        const cur = read(s), size = SPACES[s].block;
        for (let b = 0; b < used[s].length; b++) {
            let changed = false, nonzero = false;
            for (let i = b * size; i < Math.min((b + 1) * size, cur.length); i++) { if (cur[i] !== prev[s][i]) changed = true; if (cur[i]) nonzero = true; }
            if (changed) churn[s][b]++;
            if (nonzero) used[s][b]++;
        }
        prev[s] = cur;
    }
}
const share = (n: number) => +(n / samples).toFixed(3);
const out: Record<string, unknown> = { movie: moviePath.split('/').pop(), frames: movie.count, samples, every };
for (const s of names) out[s] = used[s].map((u, b) => ({ at: '$' + (b * SPACES[s].block).toString(16).toUpperCase().padStart(4, '0'), used: share(u), churn: share(churn[s][b]) }));
console.log(JSON.stringify(out, null, 1));
