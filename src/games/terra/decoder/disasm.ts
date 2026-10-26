// Ownership: a documented Terranigma routine (code.ts) disassembled from the ROM at run time, and what it refers to:
// calls into other documented routines, WRAM it addresses, the COP commands it uses. Linear: from the routine's
// address to its end, following REP / SEP, taking a COP's argument bytes from COP_COMMANDS. An unknown COP stops the
// listing, as its argument bytes are not known.

import { decodeAt, relativeTarget } from '../../../platform/cdl/disasm';
import { OPCODES } from '../../../platform/snes/opcodes-65816';
import { hiromFileOffset } from '../../../platform/snes/hirom';
import { COP_COMMANDS, TERRA_ROUTINES, routineAt, type TerraRoutine } from './code';

export interface AsmLine { addr: number; bytes: number[]; text: string; note?: string }
export interface RoutineRefs {
    /** Documented routines this one calls or jumps to (by name), other targets as bus addresses. */
    calls: string[];
    targets: number[];
    /** WRAM bus addresses addressed directly ($0000-$1FFF as $7E, long $7E / $7F). */
    wram: number[];
    /** Character-record fields: an indexed operand below $0200 (`+$26`, `$7F:+$12`). */
    fields: string[];
    cops: number[];
}

// Flags in the CDL byte / ext byte that platform decodeAt reads the widths from.
const CDL_M8 = 0x20, CDL_X8 = 0x10, EXT_M16 = 0x08, EXT_X16 = 0x10;
const h = (v: number, w: number) => v.toString(16).toUpperCase().padStart(w, '0');
const bus = (v: number) => '$' + h(v >> 16, 2) + ':' + h(v & 0xFFFF, 4);

function operandText(mode: string, v: number, len: number, target: number | null): string {
    const n = len - 1, x = (s: string) => '$' + h(v, n * 2) + s;
    switch (mode) {
        case 'imp': return '';
        case 'acc': return 'A';
        case 'imm8': case 'immM': case 'immX': return '#' + x('');
        case 'rel8': case 'rel16': return bus(target!);
        case 'bm': return '$' + h(v & 0xFF, 2) + ',$' + h(v >> 8, 2);
        case 'dpx': case 'absx': case 'longx': return x(',X');
        case 'dpy': case 'absy': return x(',Y');
        case 'idp': return '(' + x('') + ')';
        case 'idpx': case 'iabsx': return '(' + x(',X') + ')';
        case 'idpy': return '(' + x('') + '),Y';
        case 'ildp': case 'ilabs': return '[' + x('') + ']';
        case 'ildpy': return '[' + x('') + '],Y';
        case 'sr': return x(',S');
        case 'isry': return '(' + x(',S') + '),Y';
        case 'iabs': return '(' + x('') + ')';
        default: return x('');
    }
}

/** The routine's lines; data ranges come out as 16-byte rows. */
export function disassembleRoutine(rom: Uint8Array, r: TerraRoutine): AsmLine[] {
    const out: AsmLine[] = [];
    if (r.kind === 'data') {
        for (let a = r.addr; a < r.addr + r.len; a += 16) {
            const bytes = Array.from(rom.subarray(hiromFileOffset(a), hiromFileOffset(a) + Math.min(16, r.addr + r.len - a)));
            out.push({ addr: a, bytes, text: 'db ' + bytes.map(b => '$' + h(b, 2)).join(',') });
        }
        return out;
    }
    let m8 = !!r.m8, x8 = !!r.x8;
    for (let a = r.addr; a < r.addr + r.len;) {
        const off = hiromFileOffset(a);
        const ins = decodeAt(rom, off, (m8 ? CDL_M8 : 0) | (x8 ? CDL_X8 : 0), (m8 ? 0 : EXT_M16) | (x8 ? 0 : EXT_X16));
        if (!ins) break;
        const { mnemonic, mode } = OPCODES[ins.op];
        const v = ins.operand;
        if (ins.op === 0xC2) { if (v & 0x20) m8 = false; if (v & 0x10) x8 = false; }
        if (ins.op === 0xE2) { if (v & 0x20) m8 = true; if (v & 0x10) x8 = true; }
        let len = ins.len, note: string | undefined;
        if (ins.op === 0x02) {
            const cop = COP_COMMANDS.find(c => c.n === v);
            if (!cop) {
                out.push({ addr: a, bytes: Array.from(rom.subarray(off, off + 2)), text: 'COP #$' + h(v, 2), note: 'arguments of this command not decoded: listing stops' });
                break;
            }
            len += cop.args;
            const b = Array.from(rom.subarray(off + 2, off + 2 + cop.args));
            const long = (i: number) => bus(b[i] | b[i + 1] << 8 | b[i + 2] << 16);
            const args = cop.args === 1 ? '$' + h(b[0], 2) : cop.args === 2 ? '$' + h(b[0] | b[1] << 8, 4)
                : cop.args === 3 ? long(0) : cop.args === 4 ? '$' + h(b[0], 2) + ', ' + long(1) : '';
            out.push({ addr: a, bytes: Array.from(rom.subarray(off, off + len)), text: 'COP #$' + h(v, 2) + (args ? '  ' + args : ''), note: r.notes?.[a - r.addr] ?? cop.what });
            a = (a >> 16 << 16) | ((a + len) & 0xFFFF);
            continue;
        }
        const target = mode === 'rel8' || mode === 'rel16' ? relativeTarget(ins, a)
            : (mode === 'abs' || mode === 'iabsx') && (mnemonic === 'JSR' || mnemonic === 'JMP') ? (a >> 16 << 16) | v
                : mode === 'long' && (mnemonic === 'JSL' || mnemonic === 'JML') ? v : null;
        const named = target !== null ? routineAt(target) : undefined;
        if (named && target !== null && named.addr === target && named !== r) note = named.name;
        const own = r.notes?.[a - r.addr];
        if (own) note = note ? note + ': ' + own : own;
        out.push({ addr: a, bytes: Array.from(rom.subarray(off, off + len)), text: (mnemonic + ' ' + operandText(mode, v, len, target)).trimEnd(), note });
        a = (a >> 16 << 16) | ((a + len) & 0xFFFF);
    }
    return out;
}

/** What the routine refers to, from its listing. */
export function routineRefs(rom: Uint8Array, r: TerraRoutine): RoutineRefs {
    const calls = new Set<string>(), targets = new Set<number>(), wram = new Set<number>(), cops = new Set<number>(), fields = new Set<string>();
    if (r.kind === 'data') return { calls: [], targets: [], wram: [], fields: [], cops: [] };
    for (const line of disassembleRoutine(rom, r)) {
        const op = line.bytes[0], { mnemonic, mode } = OPCODES[op];
        const v = line.bytes.slice(1).reduce((acc, b, i) => acc | (b << (8 * i)), 0);
        if (op === 0x02) { cops.add(line.bytes[1]); continue; }
        if (['JSR', 'JSL', 'JMP', 'JML'].includes(mnemonic) && (mode === 'abs' || mode === 'long')) {
            const t = mode === 'long' ? v : (line.addr >> 16 << 16) | v;
            const named = routineAt(t);
            if (named && named.addr === t) calls.add(named.name); else targets.add(t);
        }
        const indexed = mode === 'absx' || mode === 'absy' || mode === 'longx';
        const low = v & 0xFFFF, bank = v >> 16;
        if (indexed && low < 0x200 && (mode !== 'longx' || bank === 0x7E || bank === 0x7F)) {
            fields.add((mode === 'longx' ? '$' + h(bank, 2) + ':' : '') + '+$' + h(low, 2));
        } else if (['abs', 'absx', 'absy'].includes(mode) && v < 0x2000 && !['JSR', 'JMP'].includes(mnemonic)) wram.add((0x7E << 16) | v);
        else if ((mode === 'long' || mode === 'longx') && (bank === 0x7E || bank === 0x7F)) wram.add(v);
    }
    return { calls: [...calls], targets: [...targets].sort((a, b) => a - b), wram: [...wram].sort((a, b) => a - b),
        fields: [...fields].sort(), cops: [...cops].sort((a, b) => a - b) };
}

/** Documented routines that call `name` (static calls between documented routines only). */
export function routineCallers(rom: Uint8Array, name: string): string[] {
    return TERRA_ROUTINES.filter(r => r.name !== name && routineRefs(rom, r).calls.includes(name)).map(r => r.name);
}

/** `$84:9990`, for Markdown. */
export const busText = bus;
