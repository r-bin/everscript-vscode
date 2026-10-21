// Boot Terranigma headless on the extension's emulator core and make the first room load a room of our choice
// (docs/terra/README.md §5): the shared start of tools/terra/check-room.mts and check-exit.mts.
// Plays the opening (title, new game, the default name, the chapter card: START and A, one a second) up to the
// first run of the room loader $86:86ED, sets `$047E` = room and `$0480` = room × 2 there (as a room change
// does) and lets the room come up. The Terranigma ROM comes from the ROM library.
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

const require = createRequire(import.meta.url);
export const ROOT = path.join(import.meta.dirname, '..', '..');
const { romOrExit } = require(path.join(ROOT, 'tools/rom'));
const CORE = path.join(ROOT, 'src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
export const PAD = { START: 0x1000, A: 0x80 };

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TerraSession {
    /** The core's Module (readMemory, writeMemory, addExecBreakpoint, onBreakpointHit, …). */
    M: any;
    heap(): Uint8Array;
    rom: Uint8Array;
    step(pad: number): void;
    wait(frames: number): void;
    press(pad: number): void;
    r16(addr: number): number;
    w16(addr: number, v: number): void;
}

/** Start the game and bring up room `id` in place of the first room; resolves once it has had 240 frames. */
export function bootIntoRoom(id: number): Promise<TerraSession> {
    const romPath: string = romOrExit('terra');
    return new Promise((resolve, reject) => {
        const g = globalThis as any;
        g.Module = { locateFile: (f: string) => path.join(path.dirname(CORE), f), onRuntimeInitialized: () => {
            const M = g.Module, heap = () => g.HEAPU8 as Uint8Array;
            const rom = new Uint8Array(fs.readFileSync(romPath));
            const p = M._my_malloc(rom.length); heap().set(rom, p);
            M._startWithRom(p, rom.length, 32040);
            const step = (pad: number) => { M._setJoypadInput(pad); M._mainLoop(); };
            const wait = (n: number) => { for (let i = 0; i < n; i++) step(0); };
            const press = (pad: number) => { for (let i = 0; i < 3; i++) step(pad); step(0); step(0); };
            const r16 = (a: number) => M.readMemory(a) | (M.readMemory(a + 1) << 8);
            const w16 = (a: number, v: number) => { M.writeMemory(a, v & 0xFF); M.writeMemory(a + 1, (v >> 8) & 0xFF); };
            let forced = false;
            M.onBreakpointHit = () => {
                if (!forced) { w16(0x7E047E, id); w16(0x7E0480, id * 2); forced = true; }
                return false;
            };
            for (let t = 0; t < 30; t++) { wait(60); if (t > 5) press(t % 2 ? PAD.A : PAD.START); }
            M.addExecBreakpoint(0x8686ED); M.addExecBreakpoint(0xC686ED);
            for (let t = 0; t < 600 && !forced; t++) step(0);
            M.removeExecBreakpoint(0x8686ED); M.removeExecBreakpoint(0xC686ED);
            M.onBreakpointHit = null;
            if (!forced) { reject(new Error('the room loader never ran')); return; }
            wait(240);
            resolve({ M, heap, rom, step, wait, press, r16, w16 });
        } };
        g.require = require; g.__dirname = path.dirname(CORE); g.__filename = CORE;
        vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });
    });
}
