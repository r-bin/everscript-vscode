// Build a HiROM image in which the bound C routines replace their asm (docs/reverse-engineering/c-to-rom.md §10).
//
// The image starts as the clean ROM, extended to 4 MB the way the table hack does it (the 4th MB is what the bundled
// core shows past a 3 MB ROM), so tables, assets and every routine not in C stay the vanilla bytes. Every
// `SOE_BIND(name, 0x80AD62, RTL)` in reconstructed-c/ gets
//   - a bridge (generated asm): registers → soe_regs_t record on the stack, the C pseudo-registers in fresh stack as
//     the direct page, the call, registers back from the record;
//   - a trampoline at the routine's entry: JML bridge (RTL routines, 4 bytes) or JSL bridge / RTS (RTS routines,
//     5 bytes). The rest of the old routine stays, so code that jumps into its middle still works.
// Calypsi (calypsi.mts) compiles every C file that includes soe.h; the linker keeps what the bridges reach. Code goes
// to banks F8-FB (file 0x380000 and up): the 4th MB, away from the one read past 3 MB ($B0:E653, knowledge/rom/80d113.md).
// The linker gets no RAM besides the pseudo-registers, so a static variable in C fails the link instead of writing
// WRAM the original does not.
//   node tools/c-to-rom/build.mts [--rom <clean rom>] [--out out/c-to-rom/soe-c.sfc] [--skip name,name] [--optimize]
// --skip leaves those routines in asm (a speed experiment: the bridges cost cycles, c-to-rom.md §10).
// --optimize compiles the SOE_OPTIMIZE variants (off by default: the documented code is what runs).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { REPO, stripHeader, hex } from './emu.mts';
import { calypsi } from './calypsi.mts';
import { walk, cdlFor } from './disasm.mts';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
const C_DIR = join(REPO, 'reconstructed-c');
const INCLUDE = join(C_DIR, 'include');
const RUNTIME = join(REPO, 'tools/c-to-rom/runtime.s');
export const OUT = join(REPO, 'out/c-to-rom');
export const IMAGE = join(OUT, 'soe-c.sfc');
const CODE_BANKS = [0xF8, 0xF9, 0xFA, 0xFB];     // file 0x380000-0x3BFFFF
const DP_SIZE = 32;                               // pseudo-registers (_Dp, _Vfp) live in this much fresh stack
const MODEL = ['--core=65816', '--code-model=large', '--data-model=large'];
// -O1, not -O2: Calypsi 5.18 at -O2 drops the reload after testing a byte's sign through `lda 0,s` and computes with
// the stack byte below it (found by G1 on $8F:A963, c-to-rom.md §10).
const OPT = ['-O1', '--speed'];

export interface Binding { name: string; addr: number; ret: 'RTL' | 'RTS'; file: string }

/** Every C file of the build: the ones written against soe.h. */
export function sourceFiles(dir = C_DIR): string[] {
    return readdirSync(dir).flatMap(f => {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) return f === 'include' ? [] : sourceFiles(p);
        return f.endsWith('.c') && /#include\s+"soe\.h"/.test(readFileSync(p, 'utf8')) ? [p] : [];
    });
}

export function bindings(files: string[]): Binding[] {
    const out: Binding[] = [];
    for (const file of files) {
        const re = /SOE_BIND\(\s*(\w+)\s*,\s*0x([0-9A-Fa-f]{6})\s*,\s*(RTL|RTS)\s*\)/g;
        for (const m of readFileSync(file, 'utf8').matchAll(re))
            out.push({ name: m[1], addr: parseInt(m[2], 16), ret: m[3] as 'RTL' | 'RTS', file: relative(REPO, file) });
    }
    // a file may bind a routine twice: the documented code and its SOE_OPTIMIZE variant
    const unique = out.filter((b, i) => out.findIndex(o => o.addr === b.addr && o.name === b.name && o.file === b.file) === i);
    out.length = 0;
    out.push(...unique);
    const seen = new Map<number, Binding>();
    for (const b of out) {
        if ((b.addr & 0x8000) === 0 || b.addr >> 16 < 0x80 || b.addr >> 16 > 0xBF)
            throw new Error(`${b.name}: bind the execution address ($80-$BF:8000+), not ${hex(b.addr)}`);
        const other = seen.get(b.addr);
        if (other) throw new Error(`${hex(b.addr)} bound twice: ${other.name} (${other.file}) and ${b.name} (${b.file})`);
        seen.set(b.addr, b);
    }
    return out.sort((a, b) => a.addr - b.addr);
}

/**
 * Can the routine be replaced by a trampoline at its entry? Its own code from the entry must end in the declared
 * return (RTL/RTS), never by jumping back above the entry (a loop label is no routine), and nothing may enter the
 * bytes the trampoline overwrites: no branch of its own, no control-flow edge in the CDL library.
 */
export function checkBindings(rom: Uint8Array, list: Binding[]): string[] {
    const cdl = cdlFor(rom);
    let edges: Map<number, number> | null = null;
    try {
        const { CdlLibrary } = require('../../dist/platform/cdl/library');
        edges = new CdlLibrary(join(homedir(), 'Library/Application Support/Code/User/globalStorage/rbin.everscript/cdl-library'), rom).edges;
    } catch { /* no library: only the static checks */ }
    const problems: string[] = [];
    for (const b of list) {
        let body = walk(rom, b.addr, cdl);
        let rets = new Set(body.map(l => l.text).filter(t => /^(RTS|RTL|RTI)$/.test(t)));
        if (!rets.has(b.ret)) {
            const bodyM8 = walk(rom, b.addr, cdl, true);
            const retsM8 = new Set(bodyM8.map(l => l.text).filter(t => /^(RTS|RTL|RTI)$/.test(t)));
            if (retsM8.has(b.ret)) {
                body = bodyM8;
                rets = retsM8;
            }
        }
        const inner = (t: number) => t > b.addr && t < b.addr + trampSize(b);
        if (!rets.size) problems.push(`${b.name}: no return reachable from ${hex(b.addr)} (a label inside another routine?)`);
        else if (!rets.has(b.ret) || rets.size > 1) problems.push(`${b.name}: declared ${b.ret}, its code returns with ${[...rets].join('/')}`);
        for (const l of body) {
            const m = /\$([0-9A-F]{6})$/.exec(l.text);
            if (!m || !/^(B|JMP|BRL)/.test(l.text)) continue;
            const t = parseInt(m[1], 16);
            if (inner(t)) problems.push(`${b.name}: ${hex(l.pc)} ${l.text} lands inside the trampoline`);
        }
        const own = new Set(body.flatMap(l => l.bytes.map((_, i) => l.pc + i)));
        for (let k = 0; k < trampSize(b); k++)
            if (!own.has(b.addr + k)) { problems.push(`${b.name}: shorter than its ${trampSize(b)}-byte trampoline (byte ${hex(b.addr + k)} is not its code)`); break; }
        if (edges) {
            let called = false;
            for (const [k, kind] of edges) {
                const from = Math.floor(k / 0x1000000), to = k % 0x1000000;
                if (to === b.addr && (kind & (FLOW_CALL | FLOW_JUMP))) called = true;
                if (inner(to) && !(from >= b.addr && from < b.addr + trampSize(b))) problems.push(`${b.name}: recorded flow ${hex(from)} -> ${hex(to)} lands inside the trampoline`);
            }
            if (!called) problems.push(`${b.name}: the CDL library has no call or jump to ${hex(b.addr)} (reached only by falling through?)`);
        }
    }
    return problems;
}

const FLOW_CALL = 1, FLOW_JUMP = 2;      // platform/snes/opcodes-65816.ts FLOW
const tramp = (b: Binding) => `tramp_${b.addr.toString(16)}`;
const trampSize = (b: Binding) => (b.ret === 'RTL' ? 4 : 5);

function bridgesAsm(list: Binding[]): string {
    const lines = ['; generated by tools/c-to-rom/build.mts: one bridge and one trampoline per SOE_BIND', '            .extern _Dp'];
    for (const b of list) {
        lines.push(
            `            .extern ${b.name}_bind`,
            `            .section farcode,text`,
            `            .public bridge_${b.name}`,
            `bridge_${b.name}:`,
            '            php',
            '            rep     #0x38',
            '            phb',
            '            phd',
            '            phy',
            '            phx',
            '            pha',
            '            tsc',
            '            inc     a',
            '            tax                         ; X = the record',
            '            tsc',
            '            sec',
            `            sbc     ##${DP_SIZE}`,
            '            tcs',
            '            inc     a',
            '            tcd                         ; the pseudo-registers: fresh stack',
            '            stx     dp:.tiny _Dp',
            '            stz     dp:.tiny (_Dp+2)',
            `            jsl     long:${b.name}_bind`,
            '            tsc',
            '            clc',
            `            adc     ##${DP_SIZE}`,
            '            tcs',
            '            pla',
            '            plx',
            '            ply',
            '            pld',
            '            plb',
            '            plp',
            '            rtl',
            `            .section ${tramp(b)},text,root`,
            b.ret === 'RTL' ? `            jmp     long:bridge_${b.name}` : `            jsl     long:bridge_${b.name}\n            rts`,
        );
    }
    return lines.join('\n') + '\n';
}

/** For soe_call_rts: per bank, the address of an RTL byte ($6B) the routine's 16-bit return can land on. */
function gadgetsAsm(rom: Uint8Array): string {
    const words: number[] = [];
    for (let bank = 0; bank < 256; bank++) {
        let at = 0;
        if (bank >= 0x80) {
            const base = (bank & 0x3F) << 16;
            for (let a = 0x8000; a <= 0xFFFF; a++) if (rom[base + a] === 0x6B) { at = a; break; }
        }
        words.push(at);
    }
    const rows = [];
    for (let i = 0; i < 256; i += 8) rows.push('            .word   ' + words.slice(i, i + 8).map(w => '0x' + w.toString(16)).join(', '));
    return ['; generated by tools/c-to-rom/build.mts from the ROM: an RTL byte per bank (0 = none)',
        '            .section cfar,rodata', '            .public soe_rtl_gadgets', 'soe_rtl_gadgets:', ...rows].join('\n') + '\n';
}

function rulesScm(list: Binding[]): string {
    const code = CODE_BANKS.map(b => `    (memory Code${b.toString(16)} (address (#x${b.toString(16)}0000 . #x${b.toString(16)}ffff)) (type ROM) (section farcode cfar switch farswitch))`);
    const tr = list.map(b => `    (memory T${b.addr.toString(16)} (address (#x${b.addr.toString(16)} . #x${(b.addr + trampSize(b) - 1).toString(16)})) (section ${tramp(b)}))`);
    return ['(define memories', "  '((memory DirectPage (address (#x0 . #xff)) (section registers))", ...code, ...tr,
        '    (base-address _DirectPageStart DirectPage 0)', '  ))'].join('\n') + '\n';
}

/** Intel hex records → [bus address, byte][] */
function parseHex(text: string): Map<number, number> {
    const out = new Map<number, number>();
    let upper = 0;
    for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith(':')) continue;
        const b = Buffer.from(line.slice(1), 'hex');
        const n = b[0], addr = b[1] << 8 | b[2], type = b[3];
        if (type === 0) for (let i = 0; i < n; i++) out.set((upper + addr + i) >>> 0, b[4 + i]);
        else if (type === 4) upper = (b[4] << 8 | b[5]) << 16;
    }
    return out;
}

export interface BuildResult { image: Uint8Array; bindings: Binding[]; symbols: Record<string, number>; codeBytes: number }

export interface BuildOptions { skip?: string[]; optimize?: boolean }

export async function buildImage(source: Uint8Array, workDir = join(OUT, 'obj'), opts: BuildOptions = {}): Promise<BuildResult> {
    const skip = opts.skip || [];
    const rom = stripHeader(source);
    const { build: base4mb, finish } = require('../table-hack/tables');
    const image: Uint8Array = base4mb(rom, []).image;
    const files = sourceFiles();
    const list = bindings(files).filter(b => !skip.includes(b.name));
    const problems = checkBindings(rom, list);
    if (problems.length) throw new Error('bindings that cannot be trampolined:\n  ' + problems.join('\n  '));
    rmSync(workDir, { recursive: true, force: true });
    mkdirSync(workDir, { recursive: true });
    const [cc, as, ln] = await Promise.all([calypsi('cc65816'), calypsi('as65816'), calypsi('ln65816')]);
    const objs: string[] = [];
    for (const f of files) {
        const o = join(workDir, basename(f, '.c') + '.o');
        execFileSync(cc, [...MODEL, ...OPT, ...(opts.optimize ? ['-DSOE_OPTIMIZE'] : []), '-I', INCLUDE, f, '-o', o], { stdio: ['ignore', 'pipe', 'pipe'] });
        objs.push(o);
    }
    const gen: Record<string, string> = { 'bridges.s': bridgesAsm(list), 'gadgets.s': gadgetsAsm(rom) };
    for (const [name, text] of Object.entries(gen)) writeFileSync(join(workDir, name), text);
    for (const s of [join(workDir, 'bridges.s'), join(workDir, 'gadgets.s'), RUNTIME]) {
        const o = join(workDir, basename(s, '.s') + '.o');
        execFileSync(as, [...MODEL, s, '-o', o], { stdio: ['ignore', 'pipe', 'pipe'] });
        objs.push(o);
    }
    writeFileSync(join(workDir, 'rules.scm'), rulesScm(list));
    const elf = join(workDir, 'soe-c.elf');
    const roots = list.flatMap(b => ['--root-symbol', `bridge_${b.name}`]);
    execFileSync(ln, [...objs, join(workDir, 'rules.scm'), '--output-format', 'intel-hex', '--list-file', join(workDir, 'soe-c.lst'),
        '-o', elf, ...(list.length ? ['--program-root', `bridge_${list[0].name}`] : []), ...roots], { stdio: ['ignore', 'pipe', 'pipe'] });
    const bytes = parseHex(readFileSync(elf.replace(/\.elf$/, '.hex'), 'utf8'));
    let codeBytes = 0;
    for (const [bus, v] of bytes) {
        const bank = bus >> 16;
        if (CODE_BANKS.includes(bank)) codeBytes++;
        else if (!list.some(b => bus >= b.addr && bus < b.addr + trampSize(b))) throw new Error(`the link wrote ${hex(bus)}, outside the code banks and trampolines`);
        image[bus & 0x3FFFFF] = v;
    }
    finish(image);
    const symbols: Record<string, number> = {};
    for (const m of readFileSync(join(workDir, 'soe-c.lst'), 'utf8').matchAll(/^\s+(\w+) = ([0-9a-f]{6})$/gm)) symbols[m[1]] = parseInt(m[2], 16);
    return { image, bindings: list, symbols, codeBytes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const a = process.argv.slice(2), opt = (n: string) => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1]; };
    const romPath: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
    const out = opt('out') || IMAGE;
    try {
        const skip = (opt('skip') || '').split(',').filter(Boolean);
        const r = await buildImage(new Uint8Array(readFileSync(romPath)), join(OUT, 'obj'), { skip, optimize: a.includes('--optimize') });
        mkdirSync(OUT, { recursive: true });
        writeFileSync(out, r.image);
        writeFileSync(join(OUT, 'build.json'), JSON.stringify({ bindings: r.bindings, codeBytes: r.codeBytes, symbols: r.symbols }, null, 1));
        console.log(`${relative(REPO, out)}: ${r.bindings.length} bound routines, ${r.codeBytes} bytes of code`);
        for (const b of r.bindings) console.log(`  ${hex(b.addr)} ${b.ret} ${b.name}  (${b.file})`);
    } catch (e: any) {
        // Calypsi prints its diagnostics on stdout/stderr of the failing step
        console.error(String(e.stdout || '') + String(e.stderr || '') || e.message);
        process.exit(1);
    }
}
