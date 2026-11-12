// Convert a HiROM Secret of Evermore image into an 8 MB SA-1 image that boots and plays like the original with the
// SA-1 held in reset: the S-CPU does everything, as before (docs/sa1/port.md).
//   npm run sa1 -- [clean rom] [out.sfc] [--fill ff|db] [--upper hardware|mesen|snes9x2005|fill]
//   (ROM: argument, else the base ROM of the ROM library; output: out/soe-sa1.sfc)
// The SA-1 maps ROM twice: $C0-$FF linearly (64 KB banks, like HiROM), $00-$3F/$80-$BF:8000+ LoROM-style (32 KB
// banks). Each of the four 1 MB "Super MMC" registers CXB-FXB ($2220-$2223) picks the block $C0/$D0/$E0/$F0 show;
// with bit 7 clear the LoROM areas stay on blocks 0-3 whatever the register says. So one image holds both views:
//   block 0    $00-$1F:8000+   bank $00 only: header, vectors and the vector entries
//   block 1    $20-$3F:8000+   unused (fill; the derived-ROM marker at its end)
//   block 2    $80-$9F:8000+   the upper halves of HiROM banks $80-$9F (file x8000-xFFFF), packed 32 KB per bank
//   block 3    $A0-$BF:8000+   the same for $A0-$BF (its second half is the HiROM 4th MB, see --upper); the boot
//                              block at $B8:8000 (that half is read only at $B0:E653+)
//   blocks 4-7 $C0-$FF         the original 4 MB HiROM view, linear; the boot block sets CXB-FXB to 4-7
// No byte moves inside a view, so every address the game uses (code in $80+, data in $C0+, 24-bit pointers) reads
// the same byte as under HiROM. Only bank $00's LoROM view differs from HiROM's $00:8000+, which the game uses only
// for its vectors (knowledge/routines/CPU_VECTORS.md), and 4 bytes of the reset code jump to the boot block.
// Until the bank registers are set, $C0-$FF show blocks 0-3; the reset code reads no ROM there before $80:B5B6.
// The setup must cost no time: the engine is busy at most NMIs, so any extra cycle drifts WRAM for good
// (docs/reverse-engineering/c-to-rom.md §7a), and the reset code seeds the RNG from the PPU counters at $80:81A1
// (RNG_SEED_0.md). The boot block pays for it by switching FastROM on first: the reset code before $80:810A runs
// from slow ROM (8 master clocks a byte) at power-on, in the boot block it runs fast (6), and NOPs fill the rest,
// so it reaches $80:810F on the original's master clock. Only power-on takes the boot block (the jump replaces
// $80:802D); the game's own reset (script opcode $AB) enters at $80:8034 with FastROM already on and runs the
// original code, which then costs what it always cost.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readVectors, bankZeroEntry, hardwareMirror, checksum } = require('../exhirom/convert.js');
const { markDerived } = require('../derived-marker');

export const REPO = resolve(dirname(new URL(import.meta.url).pathname), '..', '..');
const MB = 0x100000;
export const OUT_SIZE = 8 * MB;
export const LINEAR = 4 * MB;           // block 4: where $C0:0000 points after the stub
const BANK_REGS = [0x2220, 0x2221, 0x2222, 0x2223];   // CXB, DXB, EXB, FXB
const BANK_VALUES = [4, 5, 6, 7];       // bit 7 clear: the LoROM areas keep blocks 0-3
const SBWE = 0x2226;                    // S-CPU BW-RAM write enable; at reset all of BW-RAM is write-protected (BWPA $FF)
// The power-on path of the reset code from $80:802D up to its FastROM switch at $80:810A (LDA #$01; STA $420D), and
// where it goes on; the boot block at $B8:8000 replaces it. $80:802D-$803B sets up the stack, D and DB (PROLOGUE);
// $80:803C-$8109 writes the PPU/CPU registers.
const COLD = 0x802D, INIT = 0x803C, FASTROM = 0x810A, RESUME = 0x810F;
const PROLOGUE = 'a2 ff 1f 9a f4 00 00 a9 00 00 5b 4b ab e2 30';  // LDX #$1FFF; TXS; PEA $0000; LDA #$0000; TCD; PHK; PLB; SEP #$30
const BOOT = 0xB88000;
const loRomFile = (bus: number) => (((bus >> 16) & 0x3F) >> 5 | ((bus >> 16) & 0x80 ? 2 : 0)) * MB + ((bus >> 16) & 0x1F) * 0x8000 + (bus & 0x7FFF);
const HEADER = 0xFFB0, HEADER_END = 0xFFE0, VECTORS = 0xFFE0;
const MAP_MODE = 0xFFD5, ROM_TYPE = 0xFFD6, ROM_SIZE = 0xFFD7, COMPLEMENT = 0xFFDC;
export const SA1_MAP_MODE = 0x23, SA1_ROM_TYPE = 0x35, SIZE_8MB = 0x0D;   // SA-1, ROM + RAM + battery, 8 MB

const hex = (v: number, n: number) => v.toString(16).toUpperCase().padStart(n, '0');

/** Bus address of a byte in the LoROM view of block 0 ($00:8000+ = file 0x0000+). */
const bankZero = (addr: number) => addr - 0x8000;

export type Upper = 'hardware' | 'mesen' | 'snes9x2005' | 'fill';
// What the HiROM 4th MB (file 0x300000-0x3FFFFF, never ROM of its own) answered; the game reads it once at $80:D113
// (knowledge/routines/row_table_low_bytes_from_bank_b0.md), so the SA-1 image must answer the same.
//   hardware    the original cartridge (2 MB + 1 MB chips: 0x300000+ shows 0x200000+)
//   mesen       MesenCE, which maps every 4 KB page of the 4th MB to page 0x200000 (BaseCartridge::Init); for the proof
//   snes9x2005  the bundled core (offset % size)
//   fill        the fill byte (trap image)
const UPPER: Record<Exclude<Upper, 'fill'>, (rom: Uint8Array, off: number) => number> = {
    hardware: (rom, off) => rom[hardwareMirror(off, rom.length)],
    mesen: (rom, off) => rom[0x200000 + (off & 0xFFF)],
    snes9x2005: (rom, off) => rom[off % rom.length],
};

// Master clocks of the few instruction forms the boot block uses, by fetch speed (8 slow ROM, 6 FastROM): every
// byte is fetched once; I/O writes ($2000-$5FFF pages) and internal cycles take 6, stack accesses (low WRAM) 8
// (MesenCE GenerateMasterClockTable).
interface Op { bytes: number[]; io: number; ram: number }
const op = (bytes: number[], io = 0, ram = 0): Op => ({ bytes, io, ram });
const clocks = (ops: Op[], fetch: number) => ops.reduce((n, o) => n + o.bytes.length * fetch + 6 * o.io + 8 * o.ram, 0);
const NOP = op([0xEA], 1);
// DRAM refresh stalls the CPU 40 clocks once a scanline, at the first cycle boundary after a fixed H position, so
// how much of a stall lands in a stretch of code depends on where its cycle boundaries fall. Measured in MesenCE
// (2026-11-12): the original's $80:802D-$810F takes 2,346 clocks (2,266 + two stalls); the boot block as built
// below takes 8 fewer than its own model + 80. The padding makes up that difference; the proof checks the result.
const REFRESH_FIT = Number(process.env.SA1_REFRESH_FIT ?? 8);
// The prologue as it runs at $80, and as the boot block runs it in $B8, where PHK would push $B8: SEP #$30 first,
// then LDA #$80; PHA; PLB leaves DB = $80 and the same byte on the stack, and LDA #$00 the original's A and flags.
const prologue = (dbFromK: boolean): Op[] => [op([0xA2, 0xFF, 0x1F]), op([0x9A], 1), op([0xF4, 0x00, 0x00], 0, 2),
    op([0xA9, 0x00, 0x00]), op([0x5B], 1), ...(dbFromK
        ? [op([0x4B], 1, 1), op([0xAB], 2, 1), op([0xE2, 0x30], 1)]
        : [op([0xE2, 0x30], 1), op([0xA9, 0x80]), op([0x48], 1, 1), op([0xAB], 2, 1), op([0xA9, 0x00])])];

/** The original register writes $80:803C-$8109: 8-bit LDA # / STA abs / STZ abs only, to I/O pages. */
function initOps(rom: Uint8Array): Op[] {
    const ops: Op[] = [];
    for (let pc = INIT; pc < FASTROM;) {
        const o = rom[pc];
        if (o === 0xA9) { ops.push(op([o, rom[pc + 1]])); pc += 2; continue; }
        const a = rom[pc + 1] | (rom[pc + 2] << 8);
        if ((o !== 0x8D && o !== 0x9C) || a < 0x2000 || a >= 0x6000) throw new Error(`$80:${hex(pc, 4)}: not a register write the boot block can move`);
        ops.push(op([o, rom[pc + 1], rom[pc + 2]], 1)); pc += 3;
    }
    const pro = Buffer.from(rom.subarray(COLD, INIT)).toString('hex').replace(/(..)(?!$)/g, '$1 ');
    if (pro !== PROLOGUE) throw new Error(`$80:${hex(COLD, 4)} is not the expected reset prologue: ${pro}`);
    const tail = [...rom.subarray(FASTROM, RESUME)].join(',');
    if (tail !== '169,1,141,13,66') throw new Error(`$80:${hex(FASTROM, 4)} is not LDA #$01; STA $420D`);
    return ops;
}

/**
 * The boot block: FastROM on (A is 16-bit here: SEP/REP around it), the prologue, the original register writes, the
 * SA-1 bank registers and BW-RAM write enable (16-bit stores set two registers each: CXB+DXB, EXB+FXB, SBWE+CBWE),
 * A and flags as the original leaves them (A = $0001), back to $80:810F; NOPs before the switch (14 clocks) and
 * after (12) make its time equal the original's.
 */
function bootBlock(rom: Uint8Array): { bytes: number[]; clocks: number; slowNops: number; fastNops: number } {
    const init = initOps(rom), fastRom = [op([0xA9, 0x01]), op([0x8D, 0x0D, 0x42], 1)];
    const fastRom16 = [op([0xE2, 0x20], 1), ...fastRom, op([0xC2, 0x20], 1)];
    const sta16 = (reg: number, v: number) => [op([0xA9, v & 0xFF, v >> 8]), op([0x8D, reg & 0xFF, reg >> 8], 2)];
    const setup = [op([0xC2, 0x20], 0, 1), ...sta16(BANK_REGS[0], BANK_VALUES[0] | (BANK_VALUES[1] << 8)),
        ...sta16(BANK_REGS[2], BANK_VALUES[2] | (BANK_VALUES[3] << 8)), ...sta16(SBWE, 0x0080), op([0xE2, 0x20], 0, 1), op([0xA9, 0x01])];
    const back = op([0x5C, RESUME & 0xFF, RESUME >> 8, 0x80]);
    const original = clocks([...prologue(true), ...init, ...fastRom], 8);
    const fixed = clocks([op([0x5C, 0, 0, 0])], 8) + clocks(fastRom16, 8) + clocks([...prologue(false), ...init, ...setup, back], 6);
    for (let slow = 0; slow < 12; slow++) {
        const rest = original + REFRESH_FIT - fixed - 14 * slow;
        if (rest < 0 || rest % 12) continue;
        const nops = (n: number) => Array<Op>(n).fill(NOP);
        const ops = [...nops(slow), ...fastRom16, ...prologue(false), ...init, ...setup, ...nops(rest / 12), back];
        return { bytes: ops.flatMap(o => o.bytes), clocks: original, slowNops: slow, fastNops: rest / 12 };
    }
    throw new Error(`no NOP padding makes the boot block take the original's ${original} master clocks`);
}

/**
 * MesenCE's header score (BaseCartridge::GetHeaderScore) at each base it tries; the highest wins, ties go to the
 * later base. Only block 0 may win: the linear copy of the original header at 0x40FFC0 would make Mesen map the
 * cart as ExHiROM around the SA-1.
 */
export function mesenHeaderScores(img: Uint8Array): Record<string, number> {
    const out: Record<string, number> = {};
    for (const base of [0, 0x8000, 0x400000, 0x408000]) {
        const h = base + 0x7FB0;
        const mode = img[h + 0x25] & ~0x10;
        let score = 0;
        if ((mode === 0x20 || mode === 0x22) && (base & ~0x400000) < 0x8000) score++;
        else if ((mode === 0x21 || mode === 0x25) && (base & ~0x400000) >= 0x8000) score++;
        if (img[h + 0x26] < 0x08) score++;
        if (img[h + 0x27] < 0x10) score++;
        if (img[h + 0x28] < 0x08) score++;
        const cc = img[h + 0x2C] | (img[h + 0x2D] << 8), cs = img[h + 0x2E] | (img[h + 0x2F] << 8);
        if (cs + cc === 0xFFFF && cs !== 0 && cc !== 0) score += 8;
        const reset = img[base + 0x7FFC] | (img[base + 0x7FFD] << 8);
        if (reset < 0x8000) { out[hex(base, 6)] = -1; continue; }
        const op = img[base + (reset & 0x7FFF)];
        if ([0x18, 0x78, 0x4C, 0x5C, 0x20, 0x22, 0x9C].includes(op)) score += 8;
        else if ([0xC2, 0xE2, 0xA9, 0xA2, 0xA0].includes(op)) score += 4;
        else if ([0x00, 0xFF, 0xCC].includes(op)) score -= 8;
        out[hex(base, 6)] = Math.max(0, score);
    }
    return out;
}

export interface Report {
    fill: number; upper: Upper; checksum: number;
    boot: { at: number; bytes: number[]; clocks: number; slowNops: number; fastNops: number };
    /** Bytes of blocks 2-3 that differ from the HiROM view on purpose: the jump at $80:802D and the boot block. */
    patched: [number, number][];
    entries: { start: number; length: number; exit: string; vectors: string[] }[];
    scores: Record<string, number>;
}

/** Ranges of the image convert() writes on purpose; everything else is fill. */
export function usedRanges(rom: Uint8Array, r: Report): [number, number][] {
    return [
        ...r.entries.map(e => [bankZero(e.start), bankZero(e.start) + e.length] as [number, number]),
        [bankZero(HEADER), bankZero(VECTORS) + 0x20],
        [2 * MB, 4 * MB], [LINEAR, LINEAR + 4 * MB],
    ];
}

export function convert(source: Uint8Array, opts: { fill?: number; upper?: Upper; mark?: (img: Uint8Array) => void } = {}): { image: Uint8Array; report: Report } {
    const rom = source.length % 1024 === 512 ? source.subarray(512) : source;
    const fill = opts.fill ?? 0xFF, upper = opts.upper ?? 'hardware';
    if (rom.length > 4 * MB || rom.length < 0x10000) throw new Error(`expected a HiROM image of 64 KB-4 MB, got ${rom.length} bytes`);
    if ((rom[MAP_MODE] & ~0x10) !== 0x21) throw new Error(`map mode $${hex(rom[MAP_MODE], 2)} at $FFD5 is not HiROM`);
    if (upper !== 'fill' && !UPPER[upper]) throw new Error(`unknown upper mode ${upper}`);
    /** The byte HiROM file offset `off` (0 - 4 MB) answered. */
    const hirom = (off: number) => off < rom.length ? rom[off] : upper === 'fill' ? fill : UPPER[upper](rom, off);

    const image = new Uint8Array(OUT_SIZE).fill(fill);
    for (let off = 0; off < 4 * MB; off++) image[LINEAR + off] = hirom(off);
    // Blocks 2-3: LoROM bank n:8000+o = HiROM bank n:8000+o, i.e. file n*0x10000 + 0x8000 + o.
    for (let n = 0; n < 0x40; n++) {
        for (let o = 0; o < 0x8000; o++) image[2 * MB + n * 0x8000 + o] = hirom(n * 0x10000 + 0x8000 + o);
    }

    // Block 0: the original vector entries at their bank-$00 addresses, the stub, header and vectors.
    const entries = new Map<number, Report['entries'][number]>();
    for (const v of readVectors(rom)) {
        if (!entries.has(v.target)) entries.set(v.target, { ...bankZeroEntry(rom, v.target, v.name === 'RESET'), vectors: [] });
        entries.get(v.target)!.vectors.push(v.name);
    }
    for (const e of entries.values()) image.set(rom.subarray(e.start, e.start + e.length), bankZero(e.start));
    // The boot block and the jump to it, in the LoROM views only; the linear copy keeps the original bytes.
    const boot = { at: BOOT, ...bootBlock(rom) }, bootFile = loRomFile(BOOT), jumpFile = loRomFile(0x800000 | COLD);
    image.set(boot.bytes, bootFile);
    image.set([0x5C, BOOT & 0xFF, (BOOT >> 8) & 0xFF, BOOT >> 16], jumpFile);   // JML $B8:8000
    const patched: [number, number][] = [[jumpFile, jumpFile + 4], [bootFile, bootFile + boot.bytes.length]];
    const header = rom.slice(HEADER, HEADER_END);
    header[MAP_MODE - HEADER] = SA1_MAP_MODE;
    header[ROM_TYPE - HEADER] = SA1_ROM_TYPE;
    header[ROM_SIZE - HEADER] = SIZE_8MB;
    header.set([0xFF, 0xFF, 0x00, 0x00], COMPLEMENT - HEADER);
    image.set(header, bankZero(HEADER));
    image.set(rom.subarray(VECTORS, VECTORS + 0x20), bankZero(VECTORS));
    // The linear copy keeps the original header as data, but without a valid checksum pair it can't outscore block 0.
    image.fill(0, LINEAR + COMPLEMENT, LINEAR + COMPLEMENT + 4);
    if (opts.mark) opts.mark(image);
    const sum = checksum(image);
    image.set([~sum & 0xFF, (~sum >> 8) & 0xFF, sum & 0xFF, sum >> 8], bankZero(COMPLEMENT));

    const scores = mesenHeaderScores(image);
    const best = Math.max(...Object.values(scores));
    if (scores['000000'] !== best || Object.values(scores).filter(s => s === best).length > 1) {
        throw new Error(`MesenCE would not pick the SA-1 header at 0x7FC0: ${JSON.stringify(scores)}`);
    }
    return { image, report: { fill, upper, checksum: sum, boot, patched, entries: [...entries.values()], scores } };
}

function main(): void {
    const args = process.argv.slice(2);
    const take = (flag: string) => { const i = args.indexOf(flag); return i < 0 ? null : args.splice(i, 2)[1]; };
    const fill = parseInt(take('--fill') ?? 'ff', 16), upper = (take('--upper') ?? 'hardware') as Upper;
    const src: string = require('../rom').baseRomOrExit('evermore', args[0]);
    const out = args[1] || join(REPO, 'out', 'soe-sa1.sfc');
    const source = new Uint8Array(readFileSync(src));
    const base = source.length % 1024 === 512 ? source.subarray(512) : source;
    // The derived-ROM marker (multi-game.md §4) goes at the end of the unused block 1.
    const mark = (img: Uint8Array) => markDerived(img, base, 2 * MB - 64, 'sa1');
    const { image, report } = convert(source, { fill, upper, mark });
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, image);
    console.log(`wrote ${out}: 8 MB SA-1 (map mode $${hex(SA1_MAP_MODE, 2)}, type $${hex(SA1_ROM_TYPE, 2)}), checksum $${hex(report.checksum, 4)}, fill $${hex(fill, 2)}, 4th MB: ${upper}`);
    const b = report.boot;
    console.log(`  $80:${hex(COLD, 4)} JML $${hex(BOOT, 6)}: ${b.bytes.length}-byte boot block (CXB-FXB = ${BANK_VALUES.join(',')}, SBWE = $80), ${b.clocks} master clocks like the original (${b.slowNops} + ${b.fastNops} NOPs)`);
    for (const e of report.entries) console.log(`  bank-$00 entry $00:${hex(e.start, 4)} (${e.vectors.join(', ')}): ${e.length} bytes, then ${e.exit}`);
    console.log(`  MesenCE header scores: ${Object.entries(report.scores).map(([b, s]) => `0x${b}=${s}`).join(' ')}`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
