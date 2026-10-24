// One headless snes9x core (the extension's debugger build) for the C-to-ROM tools: boot a ROM image, step frames,
// read WRAM and the CPU. The core is an Emscripten module with one global `Module`, so a process holds one core.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
export const REPO = join(dirname(new URL(import.meta.url).pathname), '..', '..');
export const CORE = join(REPO, 'src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
const movie = require('../../dist/platform/tas/movie');
export const AUDIO_RATE: number = movie.AUDIO_RATE;
export const WRAM_SIZE = 0x20000;

export interface Cpu { pc: number; a: number; x: number; y: number; sp: number; p: number; db: number; pb: number }
export interface Core {
    M: any;
    /** Run one frame with this joypad word. */
    frame(pad?: number): void;
    /** All 128 KB of WRAM, a copy. */
    wram(): Uint8Array;
    cpu(): Cpu;
    screen(): Uint8Array;
}

/** tas/host.ts coreId(): a movie is only replayed on the core build it was recorded on. */
export function coreId(): string {
    return createHash('sha256').update(readFileSync(CORE.replace(/\.js$/, '.wasm'))).digest('hex').slice(0, 16);
}

/** Load the core, boot `rom` (power-on, empty SRAM) and resolve once it is ready. */
export function boot(rom: Uint8Array): Promise<Core> {
    return new Promise(resolve => {
        const g = globalThis as any;
        g.Module = {
            locateFile: (f: string) => join(dirname(CORE), f),
            onRuntimeInitialized: () => {
                const M = g.Module, heap = () => g.HEAPU8 as Uint8Array;
                const p = M._my_malloc(rom.length);
                heap().set(rom, p);
                M._startWithRom(p, rom.length, AUDIO_RATE);
                resolve({
                    M,
                    frame(pad = 0) { M._setJoypadInput(pad); M._mainLoop(); },
                    wram() {
                        // readMemoryRange returns at most 4096 bytes per call
                        const w = new Uint8Array(WRAM_SIZE);
                        for (let o = 0; o < WRAM_SIZE; o += 4096) w.set(M.readMemoryRange(0x7E0000 + o, 4096), o);
                        return w;
                    },
                    cpu: () => M.getCPUState(),
                    screen: () => new Uint8Array(heap().buffer, M._getScreenBuffer(), 512 * 448 * 4),
                });
            },
        };
        g.require = require; g.__dirname = dirname(CORE); g.__filename = CORE;
        vm.runInThisContext(readFileSync(CORE, 'utf8'), { filename: CORE });
    });
}

/** The clean 3 MB ROM without a copier header. */
export function stripHeader(b: Uint8Array): Uint8Array {
    return b.length % 1024 === 512 ? b.subarray(512) : b;
}

export const hex = (v: number, n = 6) => '$' + v.toString(16).toUpperCase().padStart(n, '0');
