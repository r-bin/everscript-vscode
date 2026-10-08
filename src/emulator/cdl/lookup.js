'use strict';

/**
 * emulator/cdl/lookup.js
 *
 * Answers "who calls / who touches this address" for the CDL tab's lookup box.
 * Accepts 7E4E57, $7E:4E57, 4E57 (WRAM bank $7E), 2118 (I/O), C0:8000 / 808000 (ROM).
 */

const { hex, busName, countText } = require('./rom-map');
const { flagText, SPACE } = require('./xref-index');
const { valuesSeen } = require('./wram-export');
const { tableAt, tableTitle } = require('./tables');
const { regsByPc, basesByPc } = require('./library-ext');
const { returnsByEntry } = require('./recomp-analysis');

function parseQuery(text) {
    const clean = String(text || '').replace(/[$\s:_]/g, '').replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]{1,6}$/.test(clean)) return null;
    const value = parseInt(clean, 16);
    const hasBank = clean.length > 4;
    const bank = hasBank ? value >>> 16 : 0;
    const a = value & 0xFFFF;
    if (bank === 0x7E || bank === 0x7F) return { space: SPACE.WRAM, addr: value - 0x7E0000 };
    const lowBank = (bank & 0x7F) < 0x40;
    if (lowBank && a < 0x2000) return { space: SPACE.WRAM, addr: a };
    if (lowBank && ((a >= 0x2100 && a < 0x2200) || (a >= 0x4000 && a < 0x4400))) return { space: SPACE.IO, addr: a };
    return { space: SPACE.ROM, bus: hasBank ? value : 0xC00000 | a };
}

function accessorLines(index, list) {
    if (!list.length) return ['  (no recorded accesses)'];
    return list.map(a => '  ' + flagText(a.flags).padEnd(12) + index.describePc(a.pc)
        + (a.bulk ? '  [bulk $' + hex(a.lo, 4) + '-$' + hex(a.hi, 4) + ']' : ''));
}

/**
 * @param lib   CdlLibrary
 * @param index buildIndex() result
 * @param map   createRomMap() result
 * @returns {string[]} lines
 */
function lookup(lib, index, map, text, opts) {
    const describeScript = (opts && opts.describeScript) || (s => '$' + hex(s, 6));
    const q = parseQuery(text);
    if (!q) return ['Enter an address: 7E4E57, 4E57, 2118, C0:8000'];
    if (q.space === SPACE.WRAM || q.space === SPACE.IO) {
        const name = q.space === SPACE.WRAM ? '$' + hex(0x7E0000 + q.addr, 6) + ' (WRAM)' : '$' + hex(q.addr, 4) + ' (I/O)';
        const lines = [name];
        if (q.space === SPACE.WRAM) {
            const values = valuesSeen(lib.wvals, q.addr);
            if (values && values.length) {
                lines.push('values written: ' + (values.length > 24
                    ? values.length + ' distinct ($' + hex(values[0], 2) + '-$' + hex(values[values.length - 1], 2) + ')'
                    : values.map(v => '$' + hex(v, 2)).join(' ')));
            }
            if (lib.hasHits) lines.push('hits: ' + countText(lib.wramReads[q.addr]) + ' reads, ' + countText(lib.wramWrites[q.addr]) + ' writes');
            const word = index.accessorsOf(SPACE.WRAM, q.addr - 1).filter(a => a.flags & 8);
            if (word.length) lines.push('also the high byte of word $' + hex(0x7E0000 + q.addr - 1, 6) + ' (' + word.length + ' accessors)');
        }
        lines.push('accessed by:', ...accessorLines(index, index.accessorsOf(q.space, q.addr)));
        if (q.space === SPACE.WRAM) {
            const scripts = index.scriptAccessorsOf(q.addr);
            if (scripts.length) {
                lines.push('script instructions:', ...scripts.map(s => '  ' + flagText(s.flags).padEnd(12) + describeScript(s.script)
                    + (s.bulk ? '  [bulk: ' + s.count + ' addresses]' : '')));
            }
        }
        return lines;
    }
    const off = map.busToRom(q.bus);
    if (off < 0) return ['$' + hex(q.bus, 6) + ' is not ROM, WRAM or I/O'];
    const lines = [busName(map.canonical(off)) + ' (ROM $' + hex(off, 6) + ')'];
    const cdl = lib.cdl[off], ext = lib.ext[off];
    const kinds = [];
    if (ext & 0x04) kinds.push('opcode');
    else if (cdl & 0x01) kinds.push('operand');
    if (cdl & 0x02) kinds.push('data');
    if (ext & 0x01) kinds.push('DMA source');
    if (ext & 0x02) kinds.push('APU stream');
    if (ext & 0x20) kinds.push('jump-table pointer');
    if (ext & 0x80) kinds.push('HDMA table');
    lines.push('seen as: ' + (kinds.join(', ') || 'unreached'));
    if (lib.hasHits && lib.romHits[off]) lines.push((ext & 0x04 ? 'executed ' : 'read ') + countText(lib.romHits[off]) + ' times');
    const label = index.labelName(off);
    if (label) lines.push('label: ' + label);
    const table = opts && opts.tables ? tableAt(opts.tables, off) : null;
    if (table) {
        const k = Math.floor((off - table.base) / table.size);
        lines.push('in ' + tableTitle(table, map) + ' (entry ' + k + ' +$' + hex((off - table.base) % table.size, 2) + ')');
        for (const s of table.fields[0].sites.slice(0, 4)) {
            if (s.index) lines.push('  index: ' + s.index);
            if (s.result) lines.push('  result: ' + s.result);
        }
    }
    if (cdl & 0x01) {
        const f = index.functionOf(off);
        if (f >= 0) {
            lines.push('in function: ' + index.labelName(f) + (f !== off ? ' +$' + hex(off - f, 2) : ''));
            const callers = (index.callers.get(f) || []).filter(c => c.kind & 0x11);
            lines.push('function called by:', ...(callers.length ? [...new Set(callers.map(c => '  ' + index.describePc(c.from)))] : ['  (no recorded calls)']));
        }
        const bus = map.canonical(off);
        const pcs = [...index.byPc.keys()].filter(pc => map.busToRom(pc) === off);
        const regs = regsByPc(lib), bases = basesByPc(lib);
        for (const pc of new Set([...pcs, ...[...regs.keys()].filter(p => map.busToRom(p) === off)])) {
            const r = regs.get(pc);
            if (r) {
                const fmt = (set, w) => [...set].sort((a, b) => a - b).map(v => '$' + hex(v, w)).join(' ');
                lines.push('registers at ' + busName(pc) + ': DB ' + (fmt(r.db, 2) || '?') + ', D ' + (fmt(r.d, 4) || '?') + (r.y.size ? ', Y ' + fmt(r.y, 4) : ''));
            }
            const b = bases.get(pc);
            if (b) lines.push('pointer bases: ' + b.slice(0, 12).map(x => '$' + hex(x.base, 6)).join(' ') + (b.length > 12 ? ' +' + (b.length - 12) : ''));
        }
        if (f === off) {
            const returns = returnsByEntry(lib);
            const ret = returns.get(bus) || [...returns].find(([e]) => map.busToRom(e) === off)?.[1];
            if (ret && ret.variants.size) lines.push('entry -> exit widths: ' + [...ret.variants].map(([k, v]) => k + ' -> ' + [...v].join('/')).join(', '));
            if (ret && ret.modified.size) lines.push('adjusts its return address (inline data after the call?)');
            if (ret && !ret.normal && ret.dropped.size) lines.push('never returned normally (frame unwound)');
        }
        const here = (index.callers.get(off) || []).filter(c => f !== off || !(c.kind & 0x11));
        if (here.length) lines.push('jumped to from:', ...[...new Set(here.map(c => '  ' + index.describePc(c.from)))]);
        const touched = [];
        for (const [pc, list] of index.byPc) {
            if (map.busToRom(pc) !== off) continue;
            for (const x of list) {
                const space = x.spaceAddr >>> 24, addr = x.spaceAddr & 0xFFFFFF;
                const where = space === SPACE.WRAM ? '$' + hex(0x7E0000 + addr, 6)
                    : space === SPACE.IO ? '$' + hex(addr, 4)
                    : space === SPACE.ROM ? (index.labelName(addr) || busName(map.canonical(addr))) : '$' + hex(addr, 6);
                touched.push('  ' + flagText(x.flags).padEnd(12) + where);
            }
        }
        if (touched.length) lines.push('this instruction accesses:', ...touched.slice(0, 40));
    }
    if (cdl & 0x02 || ext & 0x01) lines.push('read by:', ...accessorLines(index, index.accessorsOf(SPACE.ROM, off)));
    return lines;
}

module.exports = { lookup, parseQuery };
