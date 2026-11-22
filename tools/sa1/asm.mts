// The few 65816 instructions the SA-1 boot block is made of, each as its bytes plus the bus cycles it spends, so
// boot.mts reads like assembly and can be timed to the master clock.
//
// Timing (master clocks, MesenCE SnesMemoryManager::GenerateMasterClockTable):
//   every instruction byte is fetched once from ROM: 8 clocks from slow ROM, 6 with FastROM on ($420D = 1, banks $80+)
//   an internal cycle ("io") and an access to an I/O page ($2000-$5FFF: PPU, SA-1, CPU registers) take 6
//   an access to low WRAM ($0000-$1FFF, here always the stack) takes 8
// DRAM refresh is not modelled: it stalls the CPU 40 clocks once a scanline, and how much of it falls into a stretch
// of code depends on where that code's cycle boundaries land (boot.mts carries a measured correction).
//
// To add an instruction form: give its bytes and count its cycles from a 65816 reference (opcode fetch and operand
// bytes are in `bytes`; every other cycle is either `io` or `ram`), then add it to decode() if the boot block has to
// recognise it in the original ROM.
const h2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');
const h4 = (v: number) => v.toString(16).toUpperCase().padStart(4, '0');

export interface Ins {
    /** The instruction as assembly text, for listings and error messages. */
    text: string;
    bytes: number[];
    /** Cycles that cost 6 clocks whatever the ROM speed: internal cycles and I/O-page accesses. */
    io: number;
    /** Cycles that access low WRAM (8 clocks). */
    ram: number;
}

const ins = (text: string, bytes: number[], io = 0, ram = 0): Ins => ({ text, bytes, io, ram });
const word = (v: number) => [v & 0xFF, (v >> 8) & 0xFF];

// Loads, register widths and transfers
export const LDA8 = (v: number) => ins(`LDA #$${h2(v)}`, [0xA9, v]);
export const LDA16 = (v: number) => ins(`LDA #$${h4(v)}`, [0xA9, ...word(v)]);
export const LDX16 = (v: number) => ins(`LDX #$${h4(v)}`, [0xA2, ...word(v)]);
export const SEP = (bits: number) => ins(`SEP #$${h2(bits)}`, [0xE2, bits], 1);
export const REP = (bits: number) => ins(`REP #$${h2(bits)}`, [0xC2, bits], 1);
export const TXS = ins('TXS', [0x9A], 1);
export const TCD = ins('TCD', [0x5B], 1);
export const NOP = ins('NOP', [0xEA], 1);

// Stores to I/O registers (one write per byte stored)
export const STA8 = (reg: number) => ins(`STA $${h4(reg)}`, [0x8D, ...word(reg)], 1);
export const STA16 = (reg: number) => ins(`STA $${h4(reg)}`, [0x8D, ...word(reg)], 2);
export const STZ8 = (reg: number) => ins(`STZ $${h4(reg)}`, [0x9C, ...word(reg)], 1);
export const STZ16 = (reg: number) => ins(`STZ $${h4(reg)}`, [0x9C, ...word(reg)], 2);

// Stack
export const PEA = (v: number) => ins(`PEA $${h4(v)}`, [0xF4, ...word(v)], 0, 2);
export const PHA8 = ins('PHA', [0x48], 1, 1);
export const PHK = ins('PHK', [0x4B], 1, 1);
export const PLB = ins('PLB', [0xAB], 2, 1);

// Jumps
export const JML = (bus: number) => ins(`JML $${h2(bus >> 16)}:${h4(bus & 0xFFFF)}`, [0x5C, ...word(bus), bus >> 16]);

/** Master clocks the instructions take when fetched at `fetch` clocks a byte (8 slow ROM, 6 FastROM), refresh aside. */
export function clocks(list: Ins[], fetch: 6 | 8): number {
    return list.reduce((n, i) => n + i.bytes.length * fetch + 6 * i.io + 8 * i.ram, 0);
}

/**
 * Reads the game's code from `from` to `to` (bank $80 addresses, HiROM file = address & $FFFF) as the instruction
 * forms above, following SEP/REP for the widths of A and X. Throws on anything else, so the boot block can only be
 * built from code it understands. `m16`/`x16`: the widths at `from`.
 */
export function decode(rom: Uint8Array, from: number, to: number, m16: boolean, x16: boolean): Ins[] {
    const out: Ins[] = [];
    const at = (pc: number) => rom[pc & 0xFFFF];
    const operand = (pc: number) => at(pc + 1) | (at(pc + 2) << 8);
    for (let pc = from; pc < to;) {
        const op = at(pc);
        let i: Ins;
        switch (op) {
            case 0xA9: i = m16 ? LDA16(operand(pc)) : LDA8(at(pc + 1)); break;
            case 0xA2: if (!x16) throw new Error(`$80:${h4(pc)}: 8-bit LDX not supported`); i = LDX16(operand(pc)); break;
            case 0x8D: case 0x9C: {
                const reg = operand(pc);
                if (reg < 0x2000 || reg >= 0x6000) throw new Error(`$80:${h4(pc)}: store to $${h4(reg)}, not an I/O register`);
                i = op === 0x9C ? (m16 ? STZ16(reg) : STZ8(reg)) : (m16 ? STA16(reg) : STA8(reg));
                break;
            }
            case 0xE2: i = SEP(at(pc + 1)); if (at(pc + 1) & 0x20) m16 = false; if (at(pc + 1) & 0x10) x16 = false; break;
            case 0xC2: i = REP(at(pc + 1)); if (at(pc + 1) & 0x20) m16 = true; if (at(pc + 1) & 0x10) x16 = true; break;
            case 0x9A: i = TXS; break;
            case 0x5B: i = TCD; break;
            case 0xF4: i = PEA(operand(pc)); break;
            case 0x4B: i = PHK; break;
            case 0xAB: i = PLB; break;
            default: throw new Error(`$80:${h4(pc)}: opcode $${h2(op)} is not one the boot block knows (tools/sa1/asm.mts)`);
        }
        out.push(i);
        pc += i.bytes.length;
    }
    return out;
}
