// The boot block: the code that sets the SA-1's bank registers at power-on without costing the game a single
// master clock (docs/sa1/port.md §3).
//
// Why it has to be free: the reset code seeds the RNG from the PPU counters at $80:81A1 (RNG_SEED_0.md) and the
// engine is busy at most NMIs, so one extra cycle anywhere changes the seed or drifts WRAM for good
// (docs/reverse-engineering/c-to-rom.md §7a).
//
// How it pays for itself: at power-on the reset code runs $80:802D-$8109 (stack/D/DB set-up, then 70-odd PPU and
// CPU register writes) from slow ROM, 8 clocks a byte, and only then turns FastROM on at $80:810A. The boot block
// turns FastROM on first and runs the same code at 6 clocks a byte; the clocks it saves pay for the SA-1 set-up,
// and NOPs fill the rest so it arrives at $80:810F on the original's master clock.
//
//   $80:802D  JML $B8:8000        (in the LoROM view only; replaces LDX #$1FFF; TXS)
//   $B8:8000  NOP x slow          padding before the switch, 14 clocks each
//             SEP #$20 / LDA #$01 / STA $420D                 FastROM on (A is 16-bit here)
//             REP #$20
//             the original $80:802D-$8109, decoded from the ROM, with PHK; PLB replaced (see movedCode)
//             REP #$20 / LDA #$0504 / STA $2220 / LDA #$0706 / STA $2222 / LDA #$0080 / STA $2226 / SEP #$20
//             LDA #$01            A and flags as the original's LDA #$01 at $80:810A leaves them
//             NOP x fast          padding after the switch, 12 clocks each
//             JML $80:810F
//
// Only power-on comes through $80:802D. The game's own reset (script opcode $AB) re-enters at $80:8034 with FastROM
// already on and runs the original code; the bank registers keep their values across it.
//
// To change the set-up (more SA-1 registers, other values): edit sa1Setup(); the padding adapts. Then run
// `npm run sa1:measure -- --fit`: DRAM refresh is not in the cost model, and a changed block can need another
// REFRESH_FIT. `npm run sa1 -- --listing` prints the block.
import { type Ins, decode, clocks, JML, SEP, REP, LDA8, LDA16, STA8, STA16, PHA8, PHK, PLB, NOP } from './asm.mts';
import { BANK_REGISTERS, BANK_VALUES, SBWE } from './layout.mts';

/** $80:802D power-on entry (the reset entry in bank $00 jumps here), $80:810A FastROM switch, $80:810F resume. */
export const COLD = 0x80802D, FASTROM = 0x80810A, RESUME = 0x80810F;
/** Where the block goes: LoROM $B8:8000 = the HiROM 4th MB's mirror, which the game reads only at $B0:E653+. */
export const BOOT = 0xB88000;
/**
 * Master clocks to add for DRAM refresh landing differently in the block than in the original: the one thing the
 * cost model can't predict (40 clocks once a scanline, at the next cycle boundary). Measured in MesenCE (2026-11-12):
 * the original takes 2,346 clocks from $80:802D to $80:810F (model 2,266 + two stalls), and the block with 0 here
 * arrives on the same clock, so both get the same two stalls. A changed block may not:
 * `npm run sa1:measure -- --fit` finds the value.
 */
export const REFRESH_FIT = 0;
const SLOW = 8, FAST = 6, SLOW_NOP = SLOW + 6, FAST_NOP = FAST + 6;

/** CXB+DXB, EXB+FXB and SBWE (+CBWE = 0) with three 16-bit stores; A is 16-bit inside, 8-bit after. */
function sa1Setup(): Ins[] {
    const pair = (lo: number, hi: number) => lo | (hi << 8);
    return [
        REP(0x20),
        LDA16(pair(BANK_VALUES[0], BANK_VALUES[1])), STA16(BANK_REGISTERS[0]),
        LDA16(pair(BANK_VALUES[2], BANK_VALUES[3])), STA16(BANK_REGISTERS[2]),
        LDA16(0x0080), STA16(SBWE),
        SEP(0x20),
    ];
}

/** FastROM on (fetched slow). A is 16-bit at $80:802D, so it is narrowed first; the REP after it is fetched fast. */
const fastRomOn = (): Ins[] => [SEP(0x20), LDA8(0x01), STA8(0x420D)];

/**
 * The original code as the block runs it in bank $B8. PHK; PLB would set DB = $B8, so after the original
 * SEP #$30 the block does LDA #$80; PHA; PLB (DB = $80, same byte left on the stack) and LDA #$00 (A as before).
 * The flags differ from the original's until the next LDA, and no instruction in between reads them.
 */
function movedCode(original: Ins[]): Ins[] {
    const k = original.findIndex(i => i.text === 'PHK');
    if (k < 0 || original[k + 1]?.text !== 'PLB' || original[k + 2]?.text !== 'SEP #$30') {
        throw new Error('the reset prologue does not end in PHK; PLB; SEP #$30');
    }
    return [...original.slice(0, k), original[k + 2], LDA8(0x80), PHA8, PLB, LDA8(0x00), ...original.slice(k + 3)];
}

export interface BootBlock {
    code: Ins[];
    bytes: number[];
    /** Master clocks from $80:802D to $80:810F by the model, the same for the original and the block. */
    clocks: number;
    slowNops: number;
    fastNops: number;
}

/** Builds the block from the user's ROM (the original code is read from it, never stored in the repo). */
export function bootBlock(rom: Uint8Array, refreshFit = REFRESH_FIT): BootBlock {
    const original = decode(rom, COLD, FASTROM, true, true);
    const switchCode = decode(rom, FASTROM, RESUME, false, false).map(i => i.text).join('; ');
    if (switchCode !== 'LDA #$01; STA $420D') throw new Error(`$80:810A is "${switchCode}", not the FastROM switch`);
    const originalClocks = clocks([...original, LDA8(0x01), STA8(0x420D)], SLOW);

    const slowPart = fastRomOn(), fastPart = [REP(0x20), ...movedCode(original), ...sa1Setup(), LDA8(0x01)], back = JML(RESUME);
    // The jump at $80:802D and the switch are fetched slow, everything after the $420D write fast.
    const fixed = clocks([JML(BOOT)], SLOW) + clocks(slowPart, SLOW) + clocks([...fastPart, back], FAST);
    for (let slowNops = 0; slowNops < 12; slowNops++) {
        const rest = originalClocks + refreshFit - fixed - SLOW_NOP * slowNops;
        if (rest < 0 || rest % FAST_NOP) continue;
        const fastNops = rest / FAST_NOP;
        const code = [...Array<Ins>(slowNops).fill(NOP), ...slowPart, ...fastPart, ...Array<Ins>(fastNops).fill(NOP), back];
        return { code, bytes: code.flatMap(i => i.bytes), clocks: originalClocks, slowNops, fastNops };
    }
    throw new Error(`no NOP padding makes the boot block take the original's ${originalClocks} master clocks`);
}

/** The block as an assembly listing, one instruction a line. */
export function listing(block: BootBlock): string[] {
    const lines: string[] = [];
    let pc = BOOT;
    for (const i of block.code) {
        const bytes = i.bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        lines.push(`$${(pc >> 16).toString(16).toUpperCase()}:${(pc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}  ${bytes.padEnd(12)} ${i.text}`);
        pc += i.bytes.length;
    }
    return lines;
}
