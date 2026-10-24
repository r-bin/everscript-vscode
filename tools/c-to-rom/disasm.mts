// A linear 65816 listing of the base ROM (or any image), for writing C against the asm: follows REP/SEP for operand
// widths, stops after N instructions. Widths after a merge of paths may be wrong; the CDL library knows better.
//   node tools/c-to-rom/disasm.mts <bus address hex> [count=40] [--m8] [--x8] [--rom <file>]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { stripHeader } from './emu.mts';

const require = createRequire(import.meta.url);
const { OPCODES, MODE_SIZE } = require('../../dist/platform/snes/opcodes-65816');

const h = (v: number, n: number) => v.toString(16).toUpperCase().padStart(n, '0');

/** HiROM: bus address to file offset (both the $C0+ and the $80+ upper-half forms). */
export const fileOffset = (bus: number) => bus & 0x3FFFFF;

export interface Line { pc: number; bytes: number[]; text: string; m8: boolean; x8: boolean }

export function disassemble(rom: Uint8Array, pc: number, count: number, m8 = false, x8 = false): Line[] {
    const out: Line[] = [];
    for (let i = 0; i < count; i++) {
        const at = fileOffset(pc), op = rom[at], { mnemonic, mode } = OPCODES[op];
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
        out.push({ pc, bytes, text: `${mnemonic} ${arg[mode]}`.trim(), m8, x8 });
        if (mnemonic === 'REP') { if (v & 0x20) m8 = false; if (v & 0x10) x8 = false; }
        if (mnemonic === 'SEP') { if (v & 0x20) m8 = true; if (v & 0x10) x8 = true; }
        pc = next;
    }
    return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const a = process.argv.slice(2), flag = (n: string) => a.includes('--' + n);
    const ri = a.indexOf('--rom');
    const romPath = ri >= 0 ? a[ri + 1] : require('../rom').baseRomOrExit('evermore');
    const [addr, count = '40'] = a.filter((x, i) => !x.startsWith('--') && i !== ri + 1 || ri < 0 && !x.startsWith('--'));
    const rom = stripHeader(new Uint8Array(readFileSync(romPath)));
    for (const l of disassemble(rom, parseInt(addr, 16), Number(count), flag('m8'), flag('x8')))
        console.log(`${h(l.pc >> 16, 2)}:${h(l.pc & 0xFFFF, 4)}  ${l.bytes.map(b => h(b, 2)).join(' ').padEnd(12)} ${l.m8 ? 'm8' : '  '}${l.x8 ? 'x8' : '  '} ${l.text}`);
}
