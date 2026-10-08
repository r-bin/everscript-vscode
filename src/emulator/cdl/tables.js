'use strict';

/**
 * emulator/cdl/tables.js
 *
 * Pre-baked ROM lookup tables (HP per level, XP thresholds, damage curves,
 * dispatch tables) from the recorded xrefs. No core data beyond what exists:
 *   - a site is an instruction reading ROM with abs,X / abs,Y / long,X; its
 *     operand is static, so every recorded address gives the index it used
 *   - sites with the same base are one table; neighbouring bases read with the
 *     same index set are fields of one record (stride = gcd of the indices)
 *   - the index source is found by walking back from the site (lda $wram / asl / tax),
 *     the result by walking forward (sta $wram, or the A operand of cmp/adc/sbc)
 *   - entries are classified: increasing / decreasing curve, code pointers, lookup
 * Heuristic: a wrong guess only mislabels a comment, never changes the export bytes.
 */

const { hex, countText } = require('./rom-map');
const { decodeAt } = require('./disasm');
const { SPACE, XR, EXT_HEAD, CDL_CODE, XREFS_PER_PC } = require('./xref-index');

const SITE_MODES = new Set(['absx', 'absy', 'longx']);
const MEM_MODES = new Set(['dp', 'dpx', 'dpy', 'abs', 'absx', 'absy', 'long', 'longx']);
const COMBINE = new Set(['CMP', 'ADC', 'SBC', 'AND', 'ORA', 'EOR', 'BIT', 'CPX', 'CPY']);
const A_STEPS = new Set(['ASL', 'LSR', 'ROL', 'ROR', 'AND', 'ORA', 'EOR', 'ADC', 'SBC', 'CLC', 'SEC', 'XBA', 'INC', 'DEC', 'REP', 'SEP']);
const STOP = new Set(['JSR', 'JSL', 'RTS', 'RTL', 'RTI', 'JMP', 'JML', 'BRA', 'BRL', 'PLA', 'PLX', 'PLY', 'MVN', 'MVP']);
const WALK = 12;
const VALUE_MAX = 512;

const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };

function findTables(lib, rom, map, index) {
    const head = off => off >= 0 && off < rom.length && (lib.ext[off] & EXT_HEAD) ? decodeAt(rom, off, lib.cdl[off], lib.ext[off]) : null;
    const busAt = (pc, off, p) => (pc & 0xFF0000) | ((pc + (p - off)) & 0xFFFF);

    function prevHead(off) {
        for (let p = off - 1; p >= off - 4 && p >= 0; p--) {
            const ins = head(p);
            if (ins && p + ins.len === off) return p;
        }
        return -1;
    }

    /** "$7E4EA2" / "$7E4E00..$7E4E70" / "C8:1234" for what a memory instruction touched. */
    function touched(pc) {
        const all = (index.byPc.get(pc) || []).filter(x => !(x.flags & XR.DMA));
        const wram = all.filter(x => (x.spaceAddr >>> 24) === SPACE.WRAM);
        const list = wram.length ? wram : all;
        if (!list.length) return null;
        const name = x => {
            const space = x.spaceAddr >>> 24, a = x.spaceAddr & 0xFFFFFF;
            if (space === SPACE.WRAM) return '$' + hex(0x7E0000 + a, 6);
            if (space === SPACE.ROM) return index.labelName(a) || '$' + hex(map.canonical(a), 6);
            return '$' + hex(a, space === SPACE.IO ? 4 : 6);
        };
        const sorted = list.slice().sort((a, b) => a.spaceAddr - b.spaceAddr);
        return sorted.length === 1 ? name(sorted[0]) : name(sorted[0]) + '..' + name(sorted[sorted.length - 1]) + ' (' + sorted.length + ')';
    }

    const operandText = ins => (ins.mode.startsWith('imm') ? '#$' + hex(ins.operand, ins.len > 2 ? 4 : 2) : '');

    /** Where register `want` (X, Y or A) got its value before `off`: [source text, steps]. */
    function traceBack(pc, off, want) {
        const steps = [];
        let p = off;
        for (let n = 0; n < WALK; n++) {
            p = prevHead(p);
            if (p < 0) break;
            const ins = head(p), m = ins.mnemonic;
            if (STOP.has(m)) break;
            if (want === 'A') {
                if (m === 'LDA') {
                    if (ins.mode.startsWith('imm')) return [operandText(ins), steps];
                    return [touched(busAt(pc, off, p)) || 'memory', steps];
                }
                if (m === 'TXA' || m === 'TYA') { steps.unshift(m.toLowerCase()); want = m[1]; continue; }
                if (m === 'TDC' || m === 'TSC') return [m.toLowerCase(), steps];
                if (A_STEPS.has(m) && (ins.mode === 'acc' || ins.mode.startsWith('imm') || ins.mode === 'imp' || MEM_MODES.has(ins.mode))) {
                    if (m !== 'CLC' && m !== 'SEC' && m !== 'REP' && m !== 'SEP') {
                        const arg = ins.mode === 'acc' || ins.mode === 'imp' ? '' : ' ' + (operandText(ins) || touched(busAt(pc, off, p)) || '?');
                        steps.unshift(m.toLowerCase() + arg);
                    }
                    continue;
                }
                continue;
            }
            const other = want === 'X' ? 'Y' : 'X';
            if (m === 'LD' + want) {
                if (ins.mode.startsWith('imm')) return [operandText(ins), steps];
                return [touched(busAt(pc, off, p)) || 'memory', steps];
            }
            if (m === 'TA' + want) { steps.unshift(m.toLowerCase()); want = 'A'; continue; }
            if (m === 'T' + other + want) { steps.unshift(m.toLowerCase()); want = other; continue; }
            if (m === 'IN' + want || m === 'DE' + want) { steps.unshift(m.toLowerCase()); continue; }
            if (m === 'TS' + want) return ['tsx', steps];
        }
        return [null, steps];
    }

    /** Where the loaded value goes: "sta $7E4EB0", or the combine op itself. */
    function traceForward(pc, off, ins) {
        const m = ins.mnemonic;
        if (COMBINE.has(m)) {
            const reg = m === 'CPX' ? 'X' : m === 'CPY' ? 'Y' : 'A';
            const [src, steps] = traceBack(pc, off, reg);
            return m.toLowerCase() + ' with ' + reg + (src ? ' = ' + [src, ...steps].join(' > ') : '');
        }
        let reg = m === 'LDX' ? 'X' : m === 'LDY' ? 'Y' : 'A';
        const steps = [];
        let p = off + ins.len;
        for (let n = 0; n < WALK; n++) {
            const next = head(p);
            if (!next || STOP.has(next.mnemonic) || next.mode === 'rel8' || next.mode === 'rel16') break;
            const nm = next.mnemonic;
            if (nm === 'ST' + reg && MEM_MODES.has(next.mode)) {
                return [...steps, 'st' + reg.toLowerCase() + ' ' + (touched(busAt(pc, off, p)) || '?')].join(' > ');
            }
            const arg = () => (next.mode === 'acc' || next.mode === 'imp' ? '' : ' ' + (operandText(next) || touched(busAt(pc, off, p)) || '?'));
            const transfer = { TAX: ['A', 'X'], TAY: ['A', 'Y'], TXA: ['X', 'A'], TYA: ['Y', 'A'] }[nm];
            if (transfer && transfer[0] === reg) {
                reg = transfer[1];
                steps.push(nm.toLowerCase());
            } else if (reg === 'A' && COMBINE.has(nm)) {
                return [...steps, nm.toLowerCase() + arg()].join(' > ');
            } else if (reg === 'A' && A_STEPS.has(nm) && !['CLC', 'SEC', 'REP', 'SEP'].includes(nm)) {
                steps.push(nm.toLowerCase() + arg());
            }
            p += next.len;
        }
        return steps.length ? steps.join(' > ') + ' > ?' : null;
    }

    // 1. sites
    const byBase = new Map();
    for (const [pc, list] of index.byPc) {
        const off = map.busToRom(pc);
        const ins = head(off);
        if (!ins || !SITE_MODES.has(ins.mode)) continue;
        const reads = list.filter(x => (x.spaceAddr >>> 24) === SPACE.ROM && (x.flags & XR.READ) && !(x.flags & XR.DMA));
        if (!reads.length) continue;
        let base;
        if (ins.mode === 'longx') {
            base = map.busToRom(ins.operand);
            if (base < 0) continue;
        } else {
            const votes = new Map();
            for (const x of reads) {
                const a = x.spaceAddr & 0xFFFFFF;
                const b = a - (((map.canonical(a) & 0xFFFF) - ins.operand) & 0xFFFF);
                votes.set(b, (votes.get(b) || 0) + 1);
            }
            base = [...votes].sort((a, b) => b[1] - a[1])[0][0];
            if (base < 0) continue;
        }
        const idx = reads.map(x => (x.spaceAddr & 0xFFFFFF) - base).filter(i => i >= 0 && i < 0x10000);
        const stat = lib.stats.get((SPACE.ROM << 24) | pc);
        const capped = !!(stat && stat.count >= XREFS_PER_PC);
        if (capped) idx.push(stat.lo - base, stat.hi - base);
        const uniq = [...new Set(idx.filter(i => i >= 0 && i < 0x10000))].sort((a, b) => a - b);
        if (uniq.length < 2) continue;
        const width = reads.some(x => x.flags & XR.WORD) ? 2 : 1;
        const site = { pc, off, ins, width, capped, pointer: reads.some(x => x.flags & XR.POINTER) };
        const t = byBase.get(base) || byBase.set(base, { base, idx: new Set(), sites: [], width: 1, capped: false, pointer: false }).get(base);
        uniq.forEach(i => t.idx.add(i));
        t.sites.push(site);
        t.width = Math.max(t.width, width);
        t.capped = t.capped || capped;
        t.pointer = t.pointer || site.pointer;
    }

    // 2. fields of one record: neighbouring bases read with the same index set
    const bases = [...byBase.values()].map(b => ({ ...b, idx: [...b.idx].sort((x, y) => x - y) })).sort((a, b) => a.base - b.base);
    const tables = [];
    for (const b of bases) {
        const diffs = b.idx.slice(1).map((v, i) => v - b.idx[i]);
        b.stride = b.capped ? b.width : Math.max(b.width, diffs.reduce(gcd, 0));
        const sig = b.idx.join(',');
        const last = tables[tables.length - 1];
        if (last && last.sig === sig && b.base - last.base < last.stride) {
            last.fields.push({ at: b.base - last.base, width: b.width, sites: b.sites });
            last.span = Math.max(last.span, b.base - last.base + b.width);
            last.pointer = last.pointer || b.pointer;
            continue;
        }
        tables.push({ base: b.base, sig, idx: b.idx, stride: b.stride, capped: b.capped, pointer: b.pointer,
            span: b.width, fields: [{ at: 0, width: b.width, sites: b.sites }] });
    }

    // 3. shape, room, values, index source and result
    const starts = new Set(tables.map(t => t.base));
    for (const t of tables) {
        t.size = Math.max(t.stride, t.span);
        t.minIdx = t.idx[0];
        t.maxIdx = t.idx[t.idx.length - 1];
        t.entries = Math.floor(t.maxIdx / t.size) + 1;
        const end = t.base + t.maxIdx + t.size;
        let room = end;
        while (room < rom.length && room - end < 0x10000 && !(lib.cdl[room] & CDL_CODE) && !starts.has(room)) room++;
        t.roomEntries = Math.floor((room - t.base) / t.size);
        t.reads = 0;
        for (let o = t.base; o < Math.min(end, rom.length); o++) t.reads += (lib.romHits && lib.romHits[o]) || 0;

        const f0 = t.fields[0];
        const values = [];
        for (let k = 0; k < Math.min(t.entries, VALUE_MAX); k++) {
            const o = t.base + k * t.size;
            if (o + f0.width > rom.length) break;
            values.push(f0.width === 2 ? rom[o] | (rom[o + 1] << 8) : rom[o]);
        }
        t.values = values;
        let up = 0, down = 0;
        for (let i = 1; i < values.length; i++) { if (values[i] > values[i - 1]) up++; else if (values[i] < values[i - 1]) down++; }
        const bank = map.canonical(t.base) & 0xFF0000;
        const codeTargets = f0.width === 2 ? values.filter(v => { const o = map.busToRom(bank | v); return o >= 0 && (lib.ext[o] & EXT_HEAD); }).length : 0;
        if (t.pointer || (values.length >= 2 && codeTargets >= values.length * 0.75)) t.kind = 'code pointers';
        else if (values.length >= 4 && up >= values.length - 1 - Math.floor(values.length / 16) && down === 0) t.kind = 'increasing curve';
        else if (values.length >= 4 && down >= values.length - 1 - Math.floor(values.length / 16) && up === 0) t.kind = 'decreasing curve';
        else t.kind = 'lookup';

        for (const f of t.fields) {
            for (const s of f.sites) {
                const [src, steps] = traceBack(s.pc, s.off, s.ins.mode === 'absy' ? 'Y' : 'X');
                s.index = src ? [src, ...steps].join(' > ') : steps.length ? '? > ' + steps.join(' > ') : null;
                s.result = traceForward(s.pc, s.off, s.ins);
            }
        }
    }
    return tables;
}

function tableTitle(t, map) {
    const fields = t.fields.length > 1 ? ', ' + t.fields.length + ' fields' : '';
    return 'tbl $' + hex(map.canonical(t.base), 6) + ': ' + (t.fields[0].width === 2 ? 'word ' : 'byte ') + t.kind
        + ', ' + t.entries + (t.capped ? '+' : '') + ' entries of $' + hex(t.size, 2) + fields;
}

/** Short comment for the Asar export header of a table's label. */
function tableComment(t, map) {
    const s = t.fields[0].sites[0];
    const parts = [tableTitle(t, map).replace(/^tbl \$[0-9A-F]+: /, '')];
    if (s.index) parts.push('index ' + s.index);
    if (s.result) parts.push('-> ' + s.result);
    return parts.join('; ');
}

/** tables.md: curves first, then by recorded reads. */
function tablesReport(tables, map, index, lib) {
    const rank = { 'increasing curve': 0, 'decreasing curve': 0, lookup: 1, 'code pointers': 2 };
    const sorted = tables.slice().sort((a, b) => rank[a.kind] - rank[b.kind] || b.reads - a.reads || a.base - b.base);
    const counts = {};
    for (const t of tables) counts[t.kind] = (counts[t.kind] || 0) + 1;
    const lines = [
        '# ROM lookup tables', '',
        'Generated by Everscript from the CDL library (' + (lib.hash || '') + '). Every ROM read through',
        '`abs,X` / `abs,Y` / `long,X`: base, entry size (gcd of the recorded indices), what feeds the',
        'index and where the value goes. Entries are counted up to the highest index seen; "room" is how',
        'many entries fit before the next code byte or table. Heuristic: check before relying on it.', '',
        Object.entries(counts).map(([k, n]) => n + ' ' + k).join(', '), '',
    ];
    for (const t of sorted) {
        const show = v => '$' + hex(v, t.fields[0].width * 2);
        lines.push('## ' + tableTitle(t, map), '');
        lines.push('- ROM $' + hex(t.base, 6) + ', indices seen: ' + t.idx.length + (t.capped ? ' (capped, range from stats)' : '')
            + ' ($' + hex(t.minIdx, 2) + '-$' + hex(t.maxIdx, 2) + '), room for ' + t.roomEntries + ' entries'
            + (t.reads ? ', read ' + countText(t.reads) + ' times' : ''));
        if (t.fields.length > 1) lines.push('- fields: ' + t.fields.map(f => '+$' + hex(f.at, 2) + (f.width === 2 ? ' word' : ' byte')).join(', '));
        if (t.values.length) {
            const v = t.values.length > 24 ? t.values.slice(0, 16).map(show).concat('...', t.values.slice(-4).map(show)) : t.values.map(show);
            lines.push('- values (field +$00): ' + v.join(' ') + (t.values.length > 24 ? '  (' + t.values.length + ')' : ''));
        }
        for (const f of t.fields) {
            for (const s of f.sites) {
                lines.push('- `' + s.ins.mnemonic.toLowerCase() + '` ' + (t.fields.length > 1 ? '+$' + hex(f.at, 2) + ' ' : '') + 'at ' + index.describePc(s.pc)
                    + (s.index ? '; index: ' + s.index : '') + (s.result ? '; result: ' + s.result : ''));
            }
        }
        lines.push('');
    }
    return { text: lines.join('\n'), counts };
}

/** Table containing a ROM offset, or null. */
function tableAt(tables, off) {
    for (const t of tables) if (off >= t.base && off < t.base + t.entries * t.size) return t;
    return null;
}

module.exports = { findTables, tablesReport, tableComment, tableTitle, tableAt };
