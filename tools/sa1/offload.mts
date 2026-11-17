// The pathfinding offload experiment (docs/sa1/offload.md): an SA-1 image whose SA-1 CPU runs Evermore's
// spare-time pathfinding steps. Built on the C1 image (convert.mts); plays, but no longer in lockstep with the
// original.
//   npm run sa1:offload -- [--rom <clean rom>] [--out out/sa1/soe-sa1-offload.sfc] [--listing]
// Needs Asar (PATH or ASAR=) and the CDL export out/recomp/asar/{functions.json,rom.cdl} (npm run recomp).
//
// 1. convert() gives the C1 image; the header's BW-RAM grows to 256 KB (the WRAM mirror lives at $42-$43).
// 2. Banks $8F, $90, $80 and $8C (their LoROM views) are copied to $21-$24 in block 1. Same offsets, so branches,
//    JSR/JMP, jump tables and PHK-relative tables keep working.
// 3. In the copies, every instruction of the pathfinding call tree (TREE, decoded with the CDL's M/X flags) is
//    retargeted: long WRAM operands $7E/$7F → $42/$43, PEA $7E7E → $4242 (data bank), JSL/JML inside the tree →
//    the copy, the loop's exit → sa1_done, the S-CPU multiplier → the SA-1's (JSL to helpers of the same length),
//    the loop's frame counter read → STOP. Anything else that would reach S-CPU-only memory is refused.
// 4. offload.asm is assembled at $20:8000; $8F:9817 (LoROM view) jumps to it; bank $00 gets the SA-1 vector stub.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { convert, REPO } from './convert.mts';
import { loRomFile } from './layout.mts';
import { finishChecksum, assertMesenPicksBlockZero, bankZero } from './header.mts';

const require = createRequire(import.meta.url);
const { instructionLength, OPCODES } = require('../../dist/platform/snes/opcodes-65816');

const ASM = join(REPO, 'tools/sa1/offload.asm');
const CODE = 0x208000;
const SA1_VECTOR = 0x00E000;                         // bank $00 (block 0), free in the C1 image
const SRAM_SIZE = 0xFFD8, BWRAM_256K = 0x08;
const RELOCATE: Record<number, number> = { 0x8F: 0x21, 0x90: 0x22, 0x80: 0x23, 0x8C: 0x24 };
const WRAM_BANK: Record<number, number> = { 0x7E: 0x42, 0x7F: 0x43 };
const SPARE = 0x8F9817, SPARE_EXIT_JML = 0x8F9863, FRAME_READS = [0x8F981D, 0x8F9821];
// field_spare_time_loop and the code its jump table ($8F:9867) runs: the two step routines' bodies. The functions
// they call are found through functions.json's callees (the closed pathfinding call tree, offload.md §2).
const REGIONS: [number, number][] = [[0x8F9817, 0x8F9867], [0x8F9AC6, 0x8F9F05], [0x8FA4CA, 0x8FA723]];
const LONG_OPS = new Set([0x0F, 0x1F, 0x2F, 0x3F, 0x4F, 0x5F, 0x6F, 0x7F, 0x8F, 0x9F, 0xAF, 0xBF, 0xCF, 0xDF, 0xEF, 0xFF, 0x22, 0x5C]);
const DP_LONG_INDIRECT = new Set([0x07, 0x17, 0x27, 0x37, 0x47, 0x57, 0x67, 0x77, 0x87, 0x97, 0xA7, 0xB7, 0xC7, 0xD7, 0xE7, 0xF7]);
const CDL_CODE = 0x01, CDL_X8 = 0x10, CDL_M8 = 0x20;
// What offload.asm's copy_back writes back to WRAM. Every store of the offloaded code must land in one of these
// (checkStore). Entity fields are stored through an index register holding the record's address (records
// $3DE5-$50FF: 30 at $3DE5 + n·$8E, the Boy $4E89 and the Dog $4F37 of $AE, two at $4FE5 + n·$8E). copy_back moves
// whole records; the fields are listed anyway, so a store to a new one is noticed.
export const ENTITY_FIELDS = [0x10, 0x12, 0x14, 0x22, 0x64, 0x6C];
const COPIED: [number, number][] = [[0x3BC3, 0x5100], [0x0133, 0x013B]];      // task slots + entity records, the RNG
const THREAD_WORD = 0x7E0009;                                                   // long,X: script thread slot + 9
const STORES = new Set(['STA', 'STX', 'STY', 'STZ', 'INC', 'DEC', 'ASL', 'LSR', 'ROL', 'ROR', 'TSB', 'TRB']);

const hex = (v: number, n = 6) => v.toString(16).toUpperCase().padStart(n, '0');
const bus = (v: number) => `$${hex(v >> 16, 2)}:${hex(v & 0xFFFF, 4)}`;

/** A function's address in the $80-$BF form (functions.json gives `bus` in the $C0+ form). */
const code80 = (f: { bus: number }) => (f.bus & 0x3FFFFF) | 0x800000;

interface Fn { name: string; romOffset: number; size: number; bus: number; entries: string[]; callers: string[]; callees: string[] }

/** The pathfinding call tree: every function called from REGIONS, and what those call. */
export function tree(fns: Fn[]): Fn[] {
    const byName = new Map(fns.map(f => [f.name, f]));
    const inRegion = (c: string) => {
        const m = /\(([0-9A-F]{2}):([0-9A-F]{4})\)/.exec(c);
        if (!m) return false;
        const a = parseInt(m[1] + m[2], 16) | 0x800000;
        return REGIONS.some(([from, to]) => a >= from && a < to);
    };
    const seen = new Set<Fn>(), stack = fns.filter(f => f.callers.some(inRegion));
    while (stack.length) {
        const f = stack.pop()!;
        if (seen.has(f)) continue;
        seen.add(f);
        for (const c of f.callees) { const g = byName.get(c.split(/[ +(]/)[0]); if (g) stack.push(g); }
    }
    return [...seen];
}

interface Labels { [k: string]: number }

function assemble(work: string): { code: Uint8Array; labels: Labels } {
    mkdirSync(work, { recursive: true });
    const wrapper = join(work, 'build.asm'), bin = join(work, 'offload.bin'), sym = join(work, 'offload.sym');
    writeFileSync(wrapper, `norom\norg 0\nbase $${hex(CODE)}\n!SA1_VECTOR = $${hex(SA1_VECTOR & 0xFFFF, 4)}\nincsrc "${ASM}"\n`);
    writeFileSync(bin, new Uint8Array(0));
    execFileSync(process.env.ASAR || 'asar', ['--no-title-check', '--symbols=wla', `--symbols-path=${sym}`, wrapper, bin], { stdio: 'pipe' });
    const labels: Labels = {};
    for (const line of readFileSync(sym, 'utf8').split('\n')) {
        const m = /^([0-9A-F]{2}):([0-9A-F]{4}) (\S+)$/i.exec(line.trim());
        if (m) labels[m[3]] = parseInt(m[1] + m[2], 16);
    }
    return { code: new Uint8Array(readFileSync(bin)), labels };
}

export interface Patch { at: number; what: string }
const dpPointers = new Set<number>();

/** Refuses a store of the offloaded code that copy_back would not bring back to WRAM. */
function checkStore(a: number, op: number, rom: Uint8Array): void {
    const { mnemonic, mode } = OPCODES[op];
    if (!STORES.has(mnemonic) || !/^(abs|long)/.test(mode)) return;
    const hi = a & 0x3FFFFF, v16 = rom[hi + 1] | rom[hi + 2] << 8, v24 = v16 | rom[hi + 3] << 16;
    if (mode.startsWith('long')) {
        if (v24 === THREAD_WORD && mode === 'longx') return;
        if (v24 === 0x004202 || v24 === 0x004203) return;                      // the multiplier, rewritten
        throw new Error(`${bus(a)}: ${mnemonic} ${bus(v24)} is not copied back`);
    }
    if ((mode === 'absx' || mode === 'absy') && v16 < 0x100) {
        if (ENTITY_FIELDS.includes(v16) || ENTITY_FIELDS.includes(v16 - 1)) return;
        throw new Error(`${bus(a)}: ${mnemonic} $${hex(v16, 4)},${mode.slice(-1)} (entity field) is not in ENTITY_FIELDS`);
    }
    if (COPIED.some(([from, to]) => v16 >= from && v16 < to)) return;
    throw new Error(`${bus(a)}: ${mnemonic} $${hex(v16, 4)} is not copied back`);
}

/**
 * Retargets one decoded instruction of the copy (bytes at `file`, original address `a`) for the SA-1.
 * Returns what it did, or null if the instruction needs nothing.
 */
function retarget(img: Uint8Array, file: number, a: number, op: number, m8: boolean, treeEntries: Set<number>, labels: Labels): string | null {
    const opd = img[file + 1] | img[file + 2] << 8 | img[file + 3] << 16;
    const set24 = (v: number) => { img[file + 1] = v & 0xFF; img[file + 2] = v >> 8 & 0xFF; img[file + 3] = v >> 16; };
    if (op === 0x5C && a === SPARE_EXIT_JML) { set24(labels.sa1_done); return `exit → sa1_done`; }
    if (op === 0x22 || op === 0x5C) {
        if (!treeEntries.has(opd)) throw new Error(`${bus(a)}: ${op === 0x22 ? 'JSL' : 'JML'} ${bus(opd)} leaves the pathfinding tree`);
        const to = (RELOCATE[opd >> 16] << 16) | (opd & 0xFFFF);
        set24(to);
        return `${op === 0x22 ? 'JSL' : 'JML'} ${bus(opd)} → ${bus(to)}`;
    }
    if (LONG_OPS.has(op)) {
        const bank = opd >> 16, addr = opd & 0xFFFF;
        if (WRAM_BANK[bank] !== undefined) { set24(WRAM_BANK[bank] << 16 | addr); return `long ${bus(opd)} → ${bus(WRAM_BANK[bank] << 16 | addr)}`; }
        if (bank === 0x00 && addr === 0x4202 && op === 0x8F) { img[file] = 0x22; set24(m8 ? labels.mul_a8 : labels.mul_ab16); return `STA $4202 → JSL ${m8 ? 'mul_a8' : 'mul_ab16'}`; }
        if (bank === 0x00 && addr === 0x4203 && op === 0x8F && m8) { img[file] = 0x22; set24(labels.mul_b8); return 'STA $4203 → JSL mul_b8'; }
        if (bank === 0x00 && addr === 0x4216) { set24(0x002306); return '$4216 → $2306 (SA-1 product)'; }
        // Long,X ($xF with bit 4 set) over a ROM bank with X as the offset (tables at $8F:0000+X) reads ROM too.
        const indexed = (op & 0x1F) === 0x1F;
        const rom = bank >= 0xC0 || ((bank < 0x40 || (bank >= 0x80 && bank < 0xC0)) && (addr >= 0x8000 || (indexed && RELOCATE[bank | 0x80] !== undefined)));
        if (!rom) throw new Error(`${bus(a)}: long access to ${bus(opd)} is not ROM`);
        return null;                                                   // ROM: the SA-1 sees the same bytes
    }
    // PEA of a bank pair (then PLB): WRAM banks move to the mirror. Any other PEA is a return address or a value.
    if (op === 0xF4 && WRAM_BANK[img[file + 1]] !== undefined && WRAM_BANK[img[file + 2]] !== undefined) {
        img[file + 1] = WRAM_BANK[img[file + 1]]; img[file + 2] = WRAM_BANK[img[file + 2]];
        return `PEA $${hex(opd & 0xFFFF, 4)} → $${hex(img[file + 2] << 8 | img[file + 1], 4)} (data bank)`;
    }
    if (op === 0x54 || op === 0x44) {                                   // MVN/MVP dst,src: both banks, and DB = dst after
        if (WRAM_BANK[img[file + 1]] === undefined || WRAM_BANK[img[file + 2]] === undefined) throw new Error(`${bus(a)}: block move outside WRAM`);
        img[file + 1] = WRAM_BANK[img[file + 1]]; img[file + 2] = WRAM_BANK[img[file + 2]];
        return `${op === 0x54 ? 'MVN' : 'MVP'} WRAM → mirror`;
    }
    if (op === 0x6C || op === 0xDC) throw new Error(`${bus(a)}: indirect jump through bank $00`);
    // [dp]: the pointer's bank byte is set at run time, usually outside the tree; sa1_main rebanks the listed
    // pointers when a job starts (dp_pointers in offload.asm).
    if (DP_LONG_INDIRECT.has(op)) { dpPointers.add(img[file + 1]); return `[$${hex(img[file + 1], 2)}] (pointer rebanked at job start)`; }
    if (op === 0x4B && img[file + 1] === 0xAB) throw new Error(`${bus(a)}: PHK PLB (low WRAM through the code bank)`);
    // The loop pushes the frame counter, then runs steps while it is unchanged. In the copy it pushes 0 and runs
    // while STOP is 0: pushing STOP itself would race with the S-CPU's write when the NMI comes before the SA-1
    // enters the loop, and the loop would never end.
    if (op === 0xAD && (opd & 0xFFFF) === 0x0100 && a === FRAME_READS[0]) { img[file] = 0xA9; img[file + 1] = img[file + 2] = 0x00; return 'LDA $0100 → LDA #$0000 (the loop starts from STOP = 0)'; }
    if (op === 0xAD && (opd & 0xFFFF) === 0x0100 && a === FRAME_READS[1]) { img[file + 1] = 0x00; img[file + 2] = 0xF0; return 'LDA $0100 → LDA $F000 (STOP in the mirror)'; }
    return null;
}

export function buildOffload(source: Uint8Array, work: string): { image: Uint8Array; patches: Patch[]; tree: Fn[]; labels: Labels; code: number } {
    const rom = source.length % 1024 === 512 ? source.subarray(512) : source;
    const fnsPath = join(REPO, 'out/recomp/asar/functions.json'), cdlPath = join(REPO, 'out/recomp/asar/rom.cdl');
    if (!existsSync(fnsPath) || !existsSync(cdlPath)) throw new Error('needs out/recomp/asar/functions.json and rom.cdl (npm run recomp)');
    const fns: Fn[] = JSON.parse(readFileSync(fnsPath, 'utf8')), cdl = readFileSync(cdlPath);
    const t = tree(fns);
    const treeEntries = new Set(t.flatMap(f => f.entries.map(e => parseInt(e.slice(1), 16) | 0x800000)));
    for (const f of t) if (RELOCATE[code80(f) >> 16] === undefined) throw new Error(`${f.name} is in bank $${hex(code80(f) >> 16, 2)}, not relocated`);

    const { image } = convert(source);
    image[bankZero(SRAM_SIZE)] = BWRAM_256K;
    for (const [from, to] of Object.entries(RELOCATE)) image.copyWithin(loRomFile(to << 16 | 0x8000), loRomFile(Number(from) << 16 | 0x8000), loRomFile(Number(from) << 16 | 0x8000) + 0x8000);

    const { code, labels } = assemble(work);
    const patches: Patch[] = [];
    const ranges: [number, number][] = [...REGIONS, ...t.map(f => [code80(f), code80(f) + f.size] as [number, number])];
    const done = new Set<number>();
    for (const [from, to] of ranges) {
        for (let a = from; a < to;) {
            const hi = a & 0x3FFFFF;
            if (!(cdl[hi] & CDL_CODE)) { a++; continue; }               // not run in the CDL library: data or dead code
            const op = rom[hi], m8 = !!(cdl[hi] & CDL_M8), x8 = !!(cdl[hi] & CDL_X8);
            const len = instructionLength(op, m8, x8);
            if (!done.has(a)) {
                done.add(a);
                const file = loRomFile(RELOCATE[a >> 16] << 16 | (a & 0xFFFF));
                checkStore(a, op, rom);
                const what = retarget(image, file, a, op, m8, treeEntries, labels);
                if (what) patches.push({ at: a, what });
            }
            a += len;
        }
    }
    // sa1_main rebanks exactly one [dp] pointer, $56-$58 (the raycast's grid pointer).
    if ([...dpPointers].some(d => d !== 0x56)) throw new Error(`[dp] pointers ${[...dpPointers].map(d => '$' + hex(d, 2)).join(', ')}: sa1_main rebanks only $56`);
    for (const want of ['exit → sa1_done', 'STOP']) if (!patches.some(p => p.what.includes(want))) throw new Error(`no patch for ${want}`);

    image.set(code, loRomFile(CODE));
    const hook = loRomFile(SPARE), at = labels.offload_spare;
    image.set([0x5C, at & 0xFF, at >> 8 & 0xFF, at >> 16], hook);
    const vec = bankZero(SA1_VECTOR & 0xFFFF), main = labels.sa1_main;
    if (image.subarray(vec, vec + 4).some(b => b !== 0xFF)) throw new Error('SA-1 vector stub: bank $00 not free there');
    image.set([0x5C, main & 0xFF, main >> 8 & 0xFF, main >> 16], vec);
    finishChecksum(image);
    assertMesenPicksBlockZero(image);
    return { image, patches, tree: t, labels, code: code.length };
}

function main(): void {
    const argv = process.argv.slice(2);
    const opt = (k: string, d: string) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
    const src: string = require('../rom').baseRomOrExit('evermore', argv.includes('--rom') ? opt('rom', '') : undefined);
    const out = resolve(opt('out', join(REPO, 'out', 'sa1', 'soe-sa1-offload.sfc')));
    const { image, patches, tree: t, labels, code } = buildOffload(new Uint8Array(readFileSync(src)), join(dirname(out), 'offload-build'));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, image);
    console.log(`wrote ${out}: ${t.length} functions relocated for the SA-1, ${patches.length} instructions retargeted, ${code} bytes at ${bus(CODE)}`);
    console.log(`  hook ${bus(SPARE)} → offload_spare ${bus(labels.offload_spare)}; SA-1 vector $00:${hex(SA1_VECTOR & 0xFFFF, 4)} → sa1_main ${bus(labels.sa1_main)}`);
    if (argv.includes('--listing')) for (const p of patches) console.log(`  ${bus(p.at)}  ${p.what}`);
    else {
        const kinds = new Map<string, number>();
        for (const p of patches) { const k = p.what.replace(/\$[0-9A-F:]+/g, '…'); kinds.set(k, (kinds.get(k) ?? 0) + 1); }
        for (const [k, n] of kinds) console.log(`  ${n}× ${k}`);
    }
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
