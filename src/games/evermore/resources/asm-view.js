'use strict';
// Ownership: `soe://rom/<offset>.asm` (and `soe://bus/<addr>.asm`): a readable
// 65816 listing at a ROM address, and the short excerpt the Music tab shows for
// engine code that sent a sound. Pure: ROM bytes in, lines out.
//
// The ROM does not say where instructions start or how wide A/X are. A listing
// starts at the address (or, around a call, at the earliest point within 48
// bytes whose decode lands exactly on that call), assumes 16-bit A/X until a
// REP/SEP says otherwise, and says so. Calls and long operands are named from
// localizations (functions, tables).

const { OPCODES, instructionLength, endsFlow } = require('../../../shared/opcodes-65816');
const { getFunction } = require('../localizations/functions');
const { getTable } = require('../localizations/tables');

const SYNC_BYTES = 48;
const SUSPECT = new Set(['BRK', 'COP', 'WDM', 'STP', 'WAI', 'XCE']);

const h = (v, d) => '$' + (v >>> 0).toString(16).toUpperCase().padStart(d, '0');

/** HiROM bus address -> file offset, or null (WRAM, I/O, lower halves). */
function busToFile(bus) {
    const bank = bus >> 16, lo = bus & 0xFFFF;
    if (bank >= 0xC0) return bus - 0xC00000;
    if (bank >= 0x40 && bank < 0x7E) return bus - 0x400000;
    if ((bank < 0x40 || (bank >= 0x80 && bank < 0xC0)) && lo >= 0x8000) return ((bank & 0x3F) << 16) | lo;
    return null;
}

function nameOf(addr) {
    const f = getFunction(addr) || getFunction((addr & 0x3FFFFF) | 0x800000) || getFunction((addr & 0x3FFFFF) | 0xC00000);
    if (f) return f.name;
    const t = getTable(addr & 0x3FFFFF) || getTable(addr);
    return t ? t.name : null;
}

function operandText(ins, addr) {
    const v = ins.operand, h2 = h(v, 2), h4 = h(v, 4), h6 = h(v, 6);
    switch (ins.mode) {
        case 'imp': return '';
        case 'acc': return 'a';
        case 'imm8': case 'immM': case 'immX': return '#' + (ins.len === 2 ? h2 : h4);
        case 'rel8': return h((addr & 0xFF0000) | ((addr + 2 + ((v << 24) >> 24)) & 0xFFFF), 6);
        case 'rel16': return h((addr & 0xFF0000) | ((addr + 3 + ((v << 16) >> 16)) & 0xFFFF), 6);
        case 'dp': return h2; case 'dpx': return h2 + ',x'; case 'dpy': return h2 + ',y';
        case 'idp': return '(' + h2 + ')'; case 'idpx': return '(' + h2 + ',x)'; case 'idpy': return '(' + h2 + '),y';
        case 'ildp': return '[' + h2 + ']'; case 'ildpy': return '[' + h2 + '],y';
        case 'sr': return h2 + ',s'; case 'isry': return '(' + h2 + ',s),y';
        case 'abs': return h4; case 'absx': return h4 + ',x'; case 'absy': return h4 + ',y';
        case 'long': return h6; case 'longx': return h6 + ',x';
        case 'iabs': return '(' + h4 + ')'; case 'iabsx': return '(' + h4 + ',x)'; case 'ilabs': return '[' + h4 + ']';
        case 'bm': return h(v & 0xFF, 2) + ',' + h(v >>> 8, 2);
        case 'pea': return h4; case 'pei': return '(' + h2 + ')';
        default: return '';
    }
}

/** Decodes `count` instructions from bus address `bus`: [{ addr, bytes, op, text, name? }]. */
function decode(rom, bus, count, state) {
    const out = [], st = state || { m8: false, x8: false };
    let addr = bus;
    for (let i = 0; i < count; i++) {
        const off = busToFile(addr);
        if (off === null || off >= rom.length) break;
        const op = rom[off], o = OPCODES[op], len = instructionLength(op, st.m8, st.x8);
        let operand = 0;
        for (let k = len - 1; k >= 1; k--) operand = operand * 256 + rom[off + k];
        const ins = { mnemonic: o.mnemonic, mode: o.mode, len, operand };
        const arg = operandText(ins, addr);
        const target = o.mode === 'long' ? operand : (o.mnemonic === 'JSR' || o.mnemonic === 'JMP') && o.mode === 'abs' ? (addr & 0xFF0000) | operand : null;
        const line = { addr, bytes: Array.from(rom.subarray(off, off + len)), op, text: o.mnemonic.toLowerCase() + (arg ? ' ' + arg : '') };
        if (target !== null && nameOf(target)) line.name = nameOf(target);
        out.push(line);
        if (o.mnemonic === 'REP') { if (operand & 0x20) st.m8 = false; if (operand & 0x10) st.x8 = false; }
        if (o.mnemonic === 'SEP') { if (operand & 0x20) st.m8 = true; if (operand & 0x10) st.x8 = true; }
        addr = (addr & 0xFF0000) | ((addr + len) & 0xFFFF);
        if (state && state.stopAtEnd && endsFlow(op)) break;
    }
    return out;
}

/** The earliest start within SYNC_BYTES before `mark` whose decode lands on it, plausibly. */
function syncTo(rom, mark) {
    for (let start = mark - SYNC_BYTES; start < mark; start++) {
        if ((start & 0xFFFF) < 0x8000 && (mark & 0xFFFF) >= 0x8000) continue;
        const lines = decode(rom, start, 40, { m8: false, x8: false });
        const at = lines.findIndex(l => l.addr === mark);
        if (at < 0 || lines.slice(0, at).some(l => SUSPECT.has(OPCODES[l.op].mnemonic))) continue;
        if (lines.slice(0, at).some(l => endsFlow(l.op))) continue;   // start after a return or jump only
        return lines.slice(0, at + 4);
    }
    return null;
}

/**
 * The code that made a call returning to `ret` (a JSL is 4 bytes, a JSR 3): a few
 * instructions before it, the call (mark: true) and after. { lines, start, assumed }.
 */
function asmAroundCall(rom, ret, before = 7) {
    const callAt = [4, 3].map(n => ret - n).find(a => {
        const off = busToFile(a);
        return off !== null && (rom[off] === (ret - a === 4 ? 0x22 : 0x20));
    });
    const mark = callAt === undefined ? ret : callAt;
    const synced = syncTo(rom, mark) || decode(rom, mark, 4);
    const i = synced.findIndex(l => l.addr === mark);
    const lines = synced.slice(Math.max(0, i - before));
    lines.forEach(l => { if (l.addr === mark) l.mark = true; });
    return { lines, name: nameOf(ret), assumed: '16-bit A/X assumed until a REP/SEP' };
}

function lineText(l) {
    const bytes = l.bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
    return h(l.addr, 6) + '  ' + bytes.padEnd(12) + l.text.padEnd(22) + (l.name ? '; ' + l.name : '') + (l.mark ? '   <- here' : '');
}

/** The listing file: 48 instructions from `bus`, stopping after a return. */
function asmListing(rom, bus) {
    const name = nameOf(bus);
    const lines = decode(rom, bus, 48, { m8: false, x8: false, stopAtEnd: true });
    return '; ' + h(bus, 6) + (name ? '  ' + name : '') + '\n; 65816, 16-bit A/X assumed until a REP/SEP\n\n' + lines.map(lineText).join('\n') + '\n';
}

module.exports = { asmListing, asmAroundCall, lineText, busToFile };
