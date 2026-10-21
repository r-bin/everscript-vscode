// Ownership: what a map's animated tiles and palettes do over time, by running the
// game's own code on platform/snes/cpu65816.ts / snes-bus.ts.
//
// Load ($00:C481 order): $01:F403 (chars, palettes; $1C = header byte 0, $1B = byte 1),
// $01:B0EC (animated character blocks) and $01:B17E (character pixel effects), both
// with $1C = byte 0, then $02:BC7E (palette effects) with $1C = byte 1.
// Each frame ($00:B0BB): $01:B033, $01:BFE0, $02:BAD6 with $F4/$F5 the frame counter,
// then the NMI copies at $00:C304 (block DMA from $DC:[$92] to [$96], effect records
// from $7F:8200 to VRAM; ends with RTS). Palettes are the $0600 shadow (BG half).
// Data bank 0 throughout, as the routines that need another set their own.

import { Rom } from './rom';
import { ManaHeader } from './header';
import { Cpu65816 } from '../../../platform/snes/cpu65816';
import { SnesBus } from '../../../platform/snes/snes-bus';

/** One moment where something on screen changes: new character data and colours. */
export interface AnimationStep {
    frame: number;
    chars: Map<number, Uint8Array>;      // char index -> 32 bytes
    colours: Map<number, number>;        // CGRAM index (0-127) -> BGR555
}

export interface AnimationTrace {
    /** Frames recorded; the recording loops after this many. */
    length: number;
    /** State at frame 0 of the recording. */
    vram: Uint8Array;
    cgram: Uint16Array;
    steps: AnimationStep[];
    /** Every character and colour that changes during the recording. */
    chars: Set<number>;
    colours: Set<number>;
}

const WARMUP = 64;

function shadowColours(bus: SnesBus): Uint16Array {
    const out = new Uint16Array(128);
    for (let i = 0; i < 128; i++) out[i] = (bus.wram[0x600 + i * 2] | (bus.wram[0x601 + i * 2] << 8)) & 0x7FFF;
    return out;
}

/** Run a map's animation for `length` frames (after a short warm-up). Null when nothing moves. */
export function traceAnimation(rom: Rom, header: ManaHeader, length = 480): AnimationTrace | null {
    const [b0, b1] = header.bytes;
    if (!(b0 & 0xC0) && !(b1 & 0x80)) return null;
    const bus = new SnesBus(rom), cpu = new Cpu65816(bus);
    const call = (addr: number, dp: Record<number, number> = {}, rts = false) => {
        for (const [k, v] of Object.entries(dp)) bus.wram[Number(k)] = v;
        cpu.db = 0; cpu.d = 0;
        cpu.call(addr, { rts });
    };
    call(0x01F403, { 0x1C: b0, 0x1B: b1 });
    call(0x01B0EC, { 0x1C: b0 });
    call(0x01B17E, { 0x1C: b0 });
    call(0x02BC7E, { 0x1C: b1 });
    bus.takeDirtyChars();

    let frame = 0;
    const runFrame = () => {
        bus.wram[0xF4] = frame & 0xFF; bus.wram[0xF5] = (frame >> 8) & 0xFF;
        call(0x01B033); call(0x01BFE0); call(0x02BAD6);
        call(0x00C304, {}, true);
        frame++;
    };
    for (let i = 0; i < WARMUP; i++) runFrame();
    bus.takeDirtyChars();

    const vram = bus.vram.slice();
    let colours = shadowColours(bus);
    const cgram = colours.slice();
    const steps: AnimationStep[] = [];
    const allChars = new Set<number>(), allColours = new Set<number>();
    const shown = new Map<number, Uint8Array>();
    for (let f = 0; f < length; f++) {
        runFrame();
        const step: AnimationStep = { frame: f, chars: new Map(), colours: new Map() };
        for (const c of bus.takeDirtyChars()) {
            const data = bus.vram.slice(c * 32, c * 32 + 32);
            const before = shown.get(c) ?? vram.subarray(c * 32, c * 32 + 32);
            if (data.every((v, i) => v === before[i])) continue;     // rewritten with the same pixels
            shown.set(c, data);
            step.chars.set(c, data);
            allChars.add(c);
        }
        const now = shadowColours(bus);
        for (let i = 0; i < 128; i++) if (now[i] !== colours[i]) { step.colours.set(i, now[i]); allColours.add(i); }
        colours = now;
        if (step.chars.size || step.colours.size) steps.push(step);
    }
    if (!steps.length) return null;
    return { length, vram, cgram, steps, chars: allChars, colours: allColours };
}
