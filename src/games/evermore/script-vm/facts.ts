// Ownership: what an instruction does, as structured facts read from its operands by the
// meaning of its handler (docs/game-research/script-vm/opcodes.md). Pure.
//
// Only what a handler was read for is a fact here: memory writes, calls and starts, map changes,
// sounds, music, text, spawns, waits. Everything else is `other`, with its operands.

import { Instruction, Operand } from './decode';
import { Expression, constantValue } from './expression';

/** WRAM areas scripts address by offset. */
export const SAVE_AREA = 0x2258;
export const TEMP_AREA = 0x2834;

export type Area = 'save' | 'temp' | 'local';

export type Fact =
    /** A byte or word written; `addr` is absolute for the save and temp areas, the local offset for `local`. */
    | { k: 'write'; area: Area; addr: number; width: 1 | 2; value: number | null; expr: Expression | null }
    /** One bit set (value not 0) or cleared. */
    | { k: 'flag'; area: Area; addr: number; mask: number; value: number | null; expr: Expression }
    /** Two tile coordinates (× 8) written to two words. */
    | { k: 'tilePair'; area: Area; xAddr: number; yAddr: number; x: number; y: number }
    | { k: 'call'; target: number | null; global: number | null; trigger: number | null; args: number; back: boolean }
    | { k: 'start'; target: number | null; args: number }
    /**
     * A map change (`0x22`: the word goes to `$0ADB`, the map id, and the byte after it) or a warp
     * inside the room (`0x21`): x and y in tiles.
     */
    | { k: 'changeMap'; map: number | null; word: number | null; x: number; y: number }
    | { k: 'sound'; index: number }
    | { k: 'music'; index: number }
    /** Text by string key, in a window (`$034D + 0x2C * n`) or the default one. */
    | { k: 'text'; key: number; window: number | null; message: boolean }
    /** An enemy or NPC placed: `index` is the ENEMY value (the word offset into $8E:B55A, halved). */
    | { k: 'spawn'; index: number; state: number | null; x: number | null; y: number | null; spawner: boolean }
    | { k: 'sleep'; ticks: number | null }
    | { k: 'yield' }
    | { k: 'end' }
    | { k: 'other' };

const num = (o: Operand | undefined): number => (o && 'value' in o ? o.value : 0);
const ex = (o: Operand | undefined): Expression | null => (o && o.k === 'E' ? o.expr : null);
const args = (o: Operand | undefined): number => (o && o.k === 'A' ? o.args.length : 0);

function areaAddr(area: Area, offset: number): number {
    return area === 'save' ? SAVE_AREA + offset : area === 'temp' ? TEMP_AREA + offset : offset;
}

const WRITES: Record<number, [Area, 1 | 2]> = {
    0x10: ['save', 1], 0x14: ['save', 1], 0x11: ['temp', 1], 0x15: ['temp', 1], 0x12: ['local', 1], 0x16: ['local', 1],
    0x18: ['save', 2], 0x1C: ['save', 2], 0x19: ['temp', 2], 0x1D: ['temp', 2], 0x1A: ['local', 2], 0x1E: ['local', 2],
};
const FLAGS: Record<number, Area> = { 0x0C: 'save', 0x0D: 'temp', 0x0E: 'local' };
const PAIRS: Record<number, Area> = { 0x1B: 'save', 0xAD: 'temp', 0xAE: 'local' };

export function facts(ins: Instruction): Fact {
    const o = ins.operands;
    const op = ins.opcode;
    if (WRITES[op]) {
        const [area, width] = WRITES[op];
        const e = ex(o[1]);
        return { k: 'write', area, addr: areaAddr(area, num(o[0])), width, value: e ? constantValue(e) : null, expr: e };
    }
    if (op === 0x17) return { k: 'write', area: 'save', addr: SAVE_AREA + num(o[0]), width: 2, value: num(o[1]), expr: null };
    if (FLAGS[op]) {
        const area = FLAGS[op];
        const bit = num(o[0]);
        const e = ex(o[1])!;
        return { k: 'flag', area, addr: areaAddr(area, bit >> 3), mask: 1 << (bit & 7), value: constantValue(e), expr: e };
    }
    if (PAIRS[op]) {
        const area = PAIRS[op];
        return { k: 'tilePair', area, xAddr: areaAddr(area, num(o[0])), yAddr: areaAddr(area, num(o[1])), x: num(o[2]) * 8, y: num(o[3]) * 8 };
    }
    switch (op) {
        case 0x29: case 0xAF: return { k: 'call', target: ins.target, global: null, trigger: null, args: args(o[0]), back: false };
        case 0xA3: case 0xB0: return { k: 'call', target: ins.target, global: num(o[o.length - 1]), trigger: null, args: args(o[0]), back: false };
        case 0xA4: case 0xB1: return { k: 'call', target: ins.target, global: null, trigger: num(o[o.length - 1]), args: args(o[0]), back: false };
        case 0xA5: case 0xA6: case 0xB2: case 0xB3: return { k: 'call', target: ins.target, global: null, trigger: null, args: args(o[0]), back: true };
        case 0x07: case 0xB4: return { k: 'start', target: ins.target, args: args(o[0]) };
        case 0x22: return { k: 'changeMap', map: num(o[2]) & 0xFF, word: num(o[2]), x: num(o[0]), y: num(o[1]) };
        case 0x21: return { k: 'changeMap', map: null, word: null, x: num(o[0]), y: num(o[1]) };
        case 0x30: case 0x31: case 0x32: return { k: 'sound', index: num(o[0]) };
        case 0x33: return { k: 'music', index: num(o[0]) };
        case 0x50: return { k: 'text', key: num(o[1]), window: num(o[0]), message: false };
        case 0x51: return { k: 'text', key: num(o[0]), window: null, message: false };
        case 0x52: return { k: 'text', key: num(o[0]), window: null, message: true };
        case 0x3C: return { k: 'spawn', index: num(o[0]) >> 1, state: num(o[1]), x: num(o[2]), y: num(o[3]), spawner: (num(o[1]) & 0x8000) !== 0 };
        case 0xBA: return { k: 'spawn', index: num(o[0]), state: 0, x: num(o[1]), y: num(o[2]), spawner: false };
        case 0xC2: return { k: 'spawn', index: num(o[0]), state: 0x8000, x: num(o[1]), y: num(o[2]), spawner: true };
        case 0xA2: return { k: 'spawn', index: num(o[0]) >> 1, state: num(o[1]), x: null, y: null, spawner: (num(o[1]) & 0x8000) !== 0 };
        case 0x39: case 0x3B: { const e = ex(o[0]); return { k: 'sleep', ticks: e ? constantValue(e) : null }; }
        case 0xA7: case 0xA8: return { k: 'sleep', ticks: num(o[0]) };
        case 0x38: case 0x3A: return { k: 'yield' };
        case 0x00: return { k: 'end' };
        default: return { k: 'other' };
    }
}
