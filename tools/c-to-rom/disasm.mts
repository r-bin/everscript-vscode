// A linear 65816 listing of the base ROM (or any image), for writing C against the asm. Operand widths come from the
// CDL library of the ROM where it recorded the instruction (ACC8/IDX8 on opcode heads, cdl-recorder skill), else
// from following REP/SEP from the given entry widths. `*` marks widths taken from the CDL; `?` code never recorded.
//   node tools/c-to-rom/disasm.mts <bus address hex> [count=40] [--walk] [--m8] [--x8] [--rom <file>]
// --walk: the whole routine (every path from the entry to its returns), not `count` linear instructions.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { stripHeader } from './emu.mts';

const require = createRequire(import.meta.url);
const { OPCODES, MODE_SIZE } = require('../../dist/platform/snes/opcodes-65816');

const h = (v: number, n: number) => v.toString(16).toUpperCase().padStart(n, '0');

/** HiROM: bus address to file offset (both the $C0+ and the $80+ upper-half forms). */
export const fileOffset = (bus: number) => bus & 0x3FFFFF;

export interface Line { pc: number; bytes: number[]; text: string; m8: boolean; x8: boolean; cdl: boolean | null }

const CDL_CODE = 0x01, CDL_IDX8 = 0x10, CDL_ACC8 = 0x20;
const CDL_DIR = join(homedir(), 'Library/Application Support/Code/User/globalStorage/rbin.everscript/cdl-library');

/** rom.cdl of this ROM's CDL library (one flag byte per file offset), or null. */
export function cdlFor(rom: Uint8Array): Uint8Array | null {
    const f = join(CDL_DIR, createHash('sha1').update(rom.subarray(0, 0x300000)).digest('hex'), 'rom.cdl');
    try {
        return existsSync(f) ? new Uint8Array(readFileSync(f)) : null;
    } catch {
        return null;
    }
}

export function disassemble(rom: Uint8Array, pc: number, count: number, m8 = false, x8 = false, cdl: Uint8Array | null = null): Line[] {
    const out: Line[] = [];
    for (let i = 0; i < count; i++) {
        const at = fileOffset(pc), op = rom[at], { mnemonic, mode } = OPCODES[op];
        const flags = cdl && at < cdl.length ? cdl[at] : 0;
        if (flags & CDL_CODE) { m8 = (flags & CDL_ACC8) !== 0; x8 = (flags & CDL_IDX8) !== 0; }
        let size = MODE_SIZE[mode];
        if (size === 'M') size = m8 ? 1 : 2;
        if (size === 'X') size = x8 ? 1 : 2;
        const bytes = Array.from(rom.subarray(at, at + 1 + (size as number)));
        const v = bytes.slice(1).reduce((s, b, k) => s | b << (8 * k), 0);
        const next = (pc & 0xFF0000) | ((pc + bytes.length) & 0xFFFF);
        const rel = (d: number) => '$' + h((pc & 0xFF0000) | ((next + d) & 0xFFFF), 6);
        const arg: Record<string, string> = {
            imp: '', acc: 'A', imm8: `#$${h(v, 2)}`, immM: `#$${h(v, 2 * (size as number))}`, immX: `#$${h(v, 2 * (size as number))}`,
            dp: `$${h(v, 2)}`, dpx: `$${h(v, 2)},x`, dpy: `$${h(v, 2)},y`, idp: `($${h(v, 2)})`, idpx: `($${h(v, 2)},x)`,
            idpy: `($${h(v, 2)}),y`, ildp: `[$${h(v, 2)}]`, ildpy: `[$${h(v, 2)}],y`, abs: `$${h(v, 4)}`, absx: `$${h(v, 4)},x`,
            absy: `$${h(v, 4)},y`, long: `$${h(v, 6)}`, longx: `$${h(v, 6)},x`, sr: `$${h(v, 2)},s`, isry: `($${h(v, 2)},s),y`,
            rel8: rel((v << 24) >> 24), rel16: rel((v << 16) >> 16), iabs: `($${h(v, 4)})`, iabsx: `($${h(v, 4)},x)`,
            ilabs: `[$${h(v, 4)}]`, bm: `$${h(v & 0xFF, 2)},$${h(v >> 8, 2)}`, pea: `$${h(v, 4)}`, pei: `($${h(v, 2)})`,
        };
        out.push({ pc, bytes, text: `${mnemonic} ${arg[mode]}`.trim(), m8, x8, cdl: cdl ? (flags & CDL_CODE) !== 0 : null });
        if (mnemonic === 'REP') { if (v & 0x20) m8 = false; if (v & 0x10) x8 = false; }
        if (mnemonic === 'SEP') { if (v & 0x20) m8 = true; if (v & 0x10) x8 = true; }
        pc = next;
    }
    return out;
}

/** Every instruction reachable from `entry` inside its bank without following calls: branches and jumps with a
 * fixed target are followed, RTS/RTL/RTI and indirect jumps end a path. Sorted by address. */
export function walk(rom: Uint8Array, entry: number, cdl: Uint8Array | null, m8 = false, x8 = false, max = 2000): Line[] {
    const seen = new Map<number, Line>();
    const todo: [number, boolean, boolean][] = [[entry, m8, x8]];
    while (todo.length && seen.size < max) {
        let [pc, pm, px] = todo.pop()!;
        while (!seen.has(pc) && seen.size < max) {
            const [l] = disassemble(rom, pc, 1, pm, px, cdl);
            seen.set(pc, l);
            ({ m8: pm, x8: px } = l);
            const op = l.bytes[0];
            if (l.text.startsWith('REP')) { if (l.bytes[1] & 0x20) pm = false; if (l.bytes[1] & 0x10) px = false; }
            if (l.text.startsWith('SEP')) { if (l.bytes[1] & 0x20) pm = true; if (l.bytes[1] & 0x10) px = true; }
            const target = /\$([0-9A-F]{6})$/.exec(l.text);
            const branch = OPCODES[op].mode === 'rel8' || OPCODES[op].mode === 'rel16';
            if (branch && target) todo.push([parseInt(target[1], 16), pm, px]);
            if (op === 0x4C) todo.push([(pc & 0xFF0000) | (l.bytes[1] | l.bytes[2] << 8), pm, px]);   // JMP abs
            if ([0x60, 0x6B, 0x40, 0x80, 0x82, 0x4C, 0x5C, 0x6C, 0x7C, 0xDC, 0xDB].includes(op)) break;
            pc = (pc & 0xFF0000) | ((pc + l.bytes.length) & 0xFFFF);
        }
    }
    return [...seen.values()].sort((a, b) => a.pc - b.pc);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const a = process.argv.slice(2), flag = (n: string) => a.includes('--' + n);
    const ri = a.indexOf('--rom');
    const romPath = ri >= 0 ? a[ri + 1] : require('../rom').baseRomOrExit('evermore');
    const [addr, count = '40'] = a.filter((x, i) => !x.startsWith('--') && i !== ri + 1 || ri < 0 && !x.startsWith('--'));
    const rom = stripHeader(new Uint8Array(readFileSync(romPath)));
    const list = flag('walk') ? walk(rom, parseInt(addr, 16), cdlFor(rom), flag('m8'), flag('x8'))
        : disassemble(rom, parseInt(addr, 16), Number(count), flag('m8'), flag('x8'), cdlFor(rom));
    let last = -1;
    for (const l of list) {
        if (last >= 0 && l.pc !== last) console.log('        ...');
        last = (l.pc & 0xFF0000) | ((l.pc + l.bytes.length) & 0xFFFF);
        console.log(`${h(l.pc >> 16, 2)}:${h(l.pc & 0xFFFF, 4)}  ${l.bytes.map(b => h(b, 2)).join(' ').padEnd(12)} ${l.cdl === null ? ' ' : l.cdl ? '*' : '?'}${l.m8 ? 'm8' : '  '}${l.x8 ? 'x8' : '  '} ${l.text}`);
    }
}
