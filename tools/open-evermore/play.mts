// One lockstep run for prove.mts: the original and a layout of the same tree, each in its own snes9x core (the
// extension's, one VM context each), fed the same playback, compared after every frame (docs/open-evermore/README.md
// §5, G1).
//   node tools/open-evermore/play.mts <original.sfc> <layout.sfc> <movie.evsmv> <moved.json> <result.json>
// moved.json: [{ key, a, b, length }] — file offset of each moved resource in the original (a) and the layout (b).
// A frame passes when WRAM is identical, or when every differing byte lies in a long pointer ($80-$BF:8000+ or
// $C0-$FF form), or a 16-bit one whose bank is kept elsewhere, that points to the same resource and offset in both,
// or is a lone bank byte of one moved resource: the layout moved what it points at, nothing else. Every 60 frames the screen, VRAM and the PC must be identical too.
// A frame that is not in step may start a drift: with the tiles moved, a room load takes a little more or less time,
// so mid-load frames end at different points (measured 2026-11-19: moving rooms gives none; keeping each tile's page
// offset and bank half does not remove them; cause still open, docs/open-evermore/progress.md). A drift must end in step within MAX_DRIFT frames, and the
// playback must end in step. Only differing frames are examined, and only their findings are kept (spare the SSD).
// Exit 0 = ran (the verdict is in result.json).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const require = createRequire(import.meta.url);
const { parseMovie, groupEvents, wramCrc, WRAM_BASE, WRAM_SIZE, AUDIO_RATE } = require('../../dist/platform/tas/movie');

const CORE = join(dirname(new URL(import.meta.url).pathname), '../../src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
const STATE_EVERY = 60, CHUNK = 4096;
/** Frames a drift may last before it counts as a difference. */
export const MAX_DRIFT = 60;
/** Bytes below the stack pointer treated as dead. */
const STACK = 0x100;

export interface Moved { key: string; a: number; b: number; length: number }

export interface PlayResult {
    frames: number;
    /** Frames whose WRAM differed only in translated pointers. */
    translated: number;
    /** WRAM addresses that held such pointers. */
    pointerBytes: string[];
    /** The playback's own WRAM checks on the original: "ok" or the first frame it lost them. */
    sync: string;
    /** Drifts that ended in step: [first frame, frames], the first 20. */
    drifts: [number, number][];
    driftCount: number;
    /** The first difference that did not end in step within MAX_DRIFT frames (or by the end), if any. */
    difference: null | { frame: number; what: string; bytes: string[] };
}

/** True when `x` and `y` (24-bit bus values) are the same pointer into (or just past) a moved resource. */
export function samePointer(x: number, y: number, moved: Moved[]): boolean {
    if (x === y) return false;
    const bankX = x >> 16, bankY = y >> 16;
    // Each a ROM pointer, in either form ($80-$BF:8000+ or $C0-$FF): a resource moved to another bank half changes form.
    if (bankX < 0x80 || bankY < 0x80) return false;
    if ((bankX < 0xC0 && (x & 0xFFFF) < 0x8000) || (bankY < 0xC0 && (y & 0xFFFF) < 0x8000)) return false;
    const offX = x & 0x3FFFFF, offY = y & 0x3FFFFF;
    // `<=`: the engine also keeps a pointer one past a blob's end (seen at $7E00AA for room $31's object area).
    return moved.some(r => offX >= r.a && offX <= r.a + r.length && offY - r.b === offX - r.a);
}

/** True when 16-bit `x` and `y` are the same offset into (or just past) one moved resource, bank kept elsewhere
 *  (the tile decoder leaves the low 16 bits of the last tile's pointer at $7E0012 after reusing $14). */
export function sameShortPointer(x: number, y: number, moved: Moved[]): boolean {
    if (x === y) return false;
    return moved.some(r => {
        const offX = x - (r.a & 0xFFFF);
        return offX >= 0 && offX <= r.length && y - (r.b & 0xFFFF) === offX && (r.a & 0xFFFF) + r.length <= 0x10000 && (r.b & 0xFFFF) + r.length <= 0x10000;
    });
}

/** True when bytes `x` and `y` are the bank of one moved resource in each layout, in the same form: what is left of
 *  a long pointer once its 16-bit part is cleared ($7E00B2 after a room load, seen when rooms change banks). */
export function sameBank(x: number, y: number, moved: Moved[]): boolean {
    if (x === y || x < 0x80 || y < 0x80 || (x & 0xC0) !== (y & 0xC0)) return false;
    return moved.some(r => (r.a >> 16) === (x & 0x3F) && (r.b >> 16) === (y & 0x3F));
}

/** Differing bytes not explained by translated pointers, as "$7Exxxx:aa/bb"; `seen` collects the explained ones. */
export function realDifferences(wa: Uint8Array, wb: Uint8Array, moved: Moved[], seen: Set<number>, dead: (i: number) => boolean = () => false): string[] {
    const real: string[] = [];
    const covered = new Set<number>();
    for (let i = 0; i < wa.length; i++) {
        if (wa[i] === wb[i] || covered.has(i) || dead(i)) continue;
        let ok = false;
        for (let w = Math.max(0, i - 2); w <= i && w + 2 < wa.length && !ok; w++) {
            const x = wa[w] | (wa[w + 1] << 8) | (wa[w + 2] << 16), y = wb[w] | (wb[w + 1] << 8) | (wb[w + 2] << 16);
            if (samePointer(x, y, moved)) { ok = true; for (let j = w; j < w + 3; j++) { covered.add(j); seen.add(j); } }
        }
        for (let w = Math.max(0, i - 1); w <= i && w + 1 < wa.length && !ok; w++) {
            if (sameShortPointer(wa[w] | (wa[w + 1] << 8), wb[w] | (wb[w + 1] << 8), moved)) { ok = true; for (let j = w; j < w + 2; j++) { covered.add(j); seen.add(j); } }
        }
        if (!ok && sameBank(wa[i], wb[i], moved)) { ok = true; seen.add(i); }
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
    // VRAM from a save state: this core keeps it at offset 0xC14, 64 KiB, just before WRAM (checked: WRAM at 0x10C14).
    const vram = (i: number) => { const M = machines[i].Module, p = M._saveState(); const h = createHash('md5').update(new Uint8Array(machines[i].HEAPU8.buffer, p + 0xC14, 0x10000)).digest('hex'); M._free?.(p); return h; };
    const seen = new Set<number>();
    const result: PlayResult = { frames: 0, translated: 0, pointerBytes: [], sync: 'ok', drifts: [], driftCount: 0, difference: null };
    let desync = -1;
    let drift: { frame: number; what: string; bytes: string[] } | null = null;
    let check = false;
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
        let off: { frame: number; what: string; bytes: string[] } | null = null;
        for (let o = 0; o < WRAM_SIZE; o += CHUNK) { wa.set(A.readMemoryRange(WRAM_BASE + o, CHUNK), o); wb.set(B.readMemoryRange(WRAM_BASE + o, CHUNK), o); }
        if (Buffer.compare(wa, wb) !== 0) {
            // Dead stack: below an equal stack pointer nothing is read before it is written, and an interrupt that
            // landed elsewhere during a drift leaves its pushes at another depth there.
            const spA = A.getCPUState().sp, spB = B.getCPUState().sp;
            const real = realDifferences(wa, wb, moved, seen, i => spA === spB && i <= spA && i > spA - STACK);
            if (real.length) {
                const first = parseInt(real[0].slice(1, 7), 16) - 0x7E0000;
                const around = (w: Uint8Array) => Array.from(w.subarray(Math.max(0, first - 4), first + 6), b => b.toString(16).padStart(2, '0')).join(' ');
                off = { frame: k, what: `WRAM (from $${(0x7E0000 + Math.max(0, first - 4)).toString(16)}: ${around(wa)} / ${around(wb)})`, bytes: real.slice(0, 24) };
            }
            else result.translated++;
        }
        // Screen and PC every STATE_EVERY frames, or at the first in-step frame after a drift covered the check.
        if ((k + 1) % STATE_EVERY === 0 || k === movie.count - 1) check = true;
        if (!off && check) {
            const pa = A.getCPUState().pc, pb = B.getCPUState().pc;
            if (pa !== pb) off = { frame: k, what: `PC ${pa.toString(16)} / ${pb.toString(16)}`, bytes: [] };
            else if (screen(0) !== screen(1)) off = { frame: k, what: 'screen', bytes: [] };
            else if (vram(0) !== vram(1)) off = { frame: k, what: 'VRAM', bytes: [] };
            else check = false;
        }
        if (off) {
            drift ??= off;
            if (k - drift.frame >= MAX_DRIFT || k === movie.count - 1) result.difference = { frame: drift.frame, what: `${drift.what}; still at frame ${k}: ${off.what}`, bytes: off.bytes };
        } else if (drift) {
            if (result.drifts.length < 20) result.drifts.push([drift.frame, k - drift.frame]);
            result.driftCount++;
            drift = null;
        }
    }
    result.sync = desync < 0 ? 'ok' : 'lost at frame ' + desync;
    result.pointerBytes = [...seen].sort((x, y) => x - y).map(i => '$' + (0x7E0000 + i).toString(16));
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
