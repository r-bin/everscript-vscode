// One lockstep run for prove.mts: the original and a layout of the same tree, each in its own snes9x core (the
// extension's, one VM context each), fed the same playback, compared after every frame (docs/open-evermore/README.md
// §5, G1).
//   node tools/open-evermore/play.mts <original.sfc> <layout.sfc> <movie.evsmv> <moved.json> <result.json>
// moved.json: [{ key, a, b, length }] — file offset of each moved resource in the original (a) and the layout (b).
// A frame passes when WRAM is identical, or when every differing byte lies in a long pointer ($80-$BF:8000+ or
// $C0-$FF form) that points to the same resource and offset in both: the layout moved what it points at, nothing
// else. Every 60 frames the screen and the PC must be identical too. Only differing frames are examined, and only
// their findings are kept (spare the SSD). Exit 0 = ran (the verdict is in result.json).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { parseMovie, groupEvents, wramCrc, WRAM_BASE, WRAM_SIZE, AUDIO_RATE } = require('../../dist/platform/tas/movie');

const CORE = join(dirname(new URL(import.meta.url).pathname), '../../src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
const STATE_EVERY = 60, CHUNK = 4096;

export interface Moved { key: string; a: number; b: number; length: number }

export interface PlayResult {
    frames: number;
    /** Frames whose WRAM differed only in translated pointers. */
    translated: number;
    /** WRAM addresses that held such pointers. */
    pointerBytes: string[];
    /** The playback's own WRAM checks on the original: "ok" or the first frame it lost them. */
    sync: string;
    /** The first real difference, if any. */
    difference: null | { frame: number; what: string; bytes: string[] };
}

/** True when `x` and `y` (24-bit bus values) are the same pointer into (or just past) a moved resource. */
export function samePointer(x: number, y: number, moved: Moved[]): boolean {
    if (x === y) return false;
    const bankX = x >> 16, bankY = y >> 16;
    if (bankX < 0x80 || (bankX & 0xC0) !== (bankY & 0xC0)) return false;          // same form: $80-$BF or $C0-$FF
    if (bankX < 0xC0 && ((x & 0xFFFF) < 0x8000 || (y & 0xFFFF) < 0x8000)) return false;
    const offX = x & 0x3FFFFF, offY = y & 0x3FFFFF;
    // `<=`: the engine also keeps a pointer one past a blob's end (seen at $7E00AA for room $31's object area).
    return moved.some(r => offX >= r.a && offX <= r.a + r.length && offY - r.b === offX - r.a);
}

/** Differing bytes not explained by translated pointers, as "$7Exxxx:aa/bb"; `seen` collects the explained ones. */
export function realDifferences(wa: Uint8Array, wb: Uint8Array, moved: Moved[], seen: Set<number>): string[] {
    const real: string[] = [];
    const covered = new Set<number>();
    for (let i = 0; i < wa.length; i++) {
        if (wa[i] === wb[i] || covered.has(i)) continue;
        let ok = false;
        for (let w = Math.max(0, i - 2); w <= i && w + 2 < wa.length && !ok; w++) {
            const x = wa[w] | (wa[w + 1] << 8) | (wa[w + 2] << 16), y = wb[w] | (wb[w + 1] << 8) | (wb[w + 2] << 16);
            if (samePointer(x, y, moved)) { ok = true; for (let j = w; j < w + 3; j++) { covered.add(j); seen.add(j); } }
        }
        if (!ok) real.push(`$${(0x7E0000 + i).toString(16)}:${wa[i].toString(16)}/${wb[i].toString(16)}`);
    }
    return real;
}

function boot(): Promise<any> {
    const src = readFileSync(CORE, 'utf8');
    return new Promise(resolve => {
        const ctx: any = { console, require, __dirname: dirname(CORE), __filename: CORE, WebAssembly, TextDecoder, TextEncoder, URL, setTimeout, clearTimeout, performance, process, Buffer };
        ctx.Module = { locateFile: (f: string) => join(dirname(CORE), f), onRuntimeInitialized: () => resolve(ctx) };
        ctx.globalThis = ctx;
        createContext(ctx);
        runInContext(src, ctx, { filename: CORE });
    });
}

async function main(): Promise<void> {
    const [romA, romB, moviePath, movedPath, outPath] = process.argv.slice(2);
    const moved: Moved[] = JSON.parse(readFileSync(movedPath, 'utf8'));
    const machines = await Promise.all([boot(), boot()]);
    machines.forEach((c, i) => {
        const rom = readFileSync(i === 0 ? romA : romB);
        const p = c.Module._my_malloc(rom.length);
        c.HEAPU8.set(rom, p);                          // read HEAPU8 each time: it is replaced when memory grows
        c.Module._startWithRom(p, rom.length, AUDIO_RATE);
    });
    const [A, B] = machines.map(c => c.Module);
    const movie = parseMovie(readFileSync(moviePath, 'utf8'), basename(moviePath));
    const events = groupEvents(movie.events);
    const wa = new Uint8Array(WRAM_SIZE), wb = new Uint8Array(WRAM_SIZE);
    const screen = (i: number) => createHash('md5').update(new Uint8Array(machines[i].HEAPU8.buffer, machines[i].Module._getScreenBuffer(), 512 * 448 * 4)).digest('hex');
    const seen = new Set<number>();
    const result: PlayResult = { frames: 0, translated: 0, pointerBytes: [], sync: 'ok', difference: null };
    let desync = -1;
    for (let k = 0; k < movie.count && !result.difference; k++) {
        for (const ev of events.get(k) || []) {
            for (const M of [A, B]) {
                if (ev.kind === 'W') for (let i = 0; i < ev.bytes.length; i++) M.writeMemory(ev.addr + i, ev.bytes[i]);
                else if (ev.kind === 'R') M._softReset();
            }
            if (ev.kind === 'S' && desync < 0 && wramCrc((a: number, n: number) => A.readMemoryRange(a, n)) !== ev.crc) desync = k;
        }
        for (const M of [A, B]) { M._setJoypadInput(movie.pads[k]); M._mainLoop(); }
        result.frames = k + 1;
        for (let o = 0; o < WRAM_SIZE; o += CHUNK) { wa.set(A.readMemoryRange(WRAM_BASE + o, CHUNK), o); wb.set(B.readMemoryRange(WRAM_BASE + o, CHUNK), o); }
        if (Buffer.compare(wa, wb) !== 0) {
            const real = realDifferences(wa, wb, moved, seen);
            if (real.length) {
                const first = parseInt(real[0].slice(1, 7), 16) - 0x7E0000;
                const around = (w: Uint8Array) => Array.from(w.subarray(Math.max(0, first - 4), first + 6), b => b.toString(16).padStart(2, '0')).join(' ');
                result.difference = { frame: k, what: `WRAM (from $${(0x7E0000 + Math.max(0, first - 4)).toString(16)}: ${around(wa)} / ${around(wb)})`, bytes: real.slice(0, 24) };
            }
            else result.translated++;
        }
        if (!result.difference && ((k + 1) % STATE_EVERY === 0 || k === movie.count - 1)) {
            const pa = A.getCPUState().pc, pb = B.getCPUState().pc;
            if (pa !== pb) result.difference = { frame: k, what: `PC ${pa.toString(16)} / ${pb.toString(16)}`, bytes: [] };
            else if (screen(0) !== screen(1)) result.difference = { frame: k, what: 'screen', bytes: [] };
        }
    }
    result.sync = desync < 0 ? 'ok' : 'lost at frame ' + desync;
    result.pointerBytes = [...seen].sort((x, y) => x - y).map(i => '$' + (0x7E0000 + i).toString(16));
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
