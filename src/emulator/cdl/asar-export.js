'use strict';

/**
 * emulator/cdl/asar-export.js
 *
 * CDL library + ROM -> Asar project that reassembles byte-exact:
 *   main.asm              mapper + incsrc of every bank
 *   banks/bank_XX.asm     code (with callers / accesses as comments) and data
 *   rom.bin               copy of the ROM; unreached / DMA runs are incbin slices
 *   tables.md             ROM lookup tables: shape, index source, result (tables.js)
 *   rooms/, rom.cdl, build.sh, build-cdl.js, export.json, STEPS.md  (asar-build.js)
 * Known regions (known-regions.js: header, rooms, strings, their pointer
 * tables) are placed first and override the CDL's view of their bytes.
 * Pass 1 picks instruction boundaries over the whole ROM so labels are only
 * emitted where a line starts; pass 2 writes the text.
 */

const fs = require('fs');
const path = require('path');
const { createRomMap, hex, countText } = require('./rom-map');
const { buildIndex, SPACE } = require('./xref-index');
const { decodeAt, formatInstruction, staticTarget } = require('./disasm');
const { findKnownRegions } = require('./known-regions');
const { writeBuildFiles } = require('./asar-build');
const { writeRecompSeeds } = require('./recomp-seeds');
const { findTables, tablesReport, tableComment } = require('./tables');

const CDL_CODE = 0x01, CDL_DATA = 0x02;
const EXT_DMA = 0x01, EXT_APU = 0x02, EXT_HEAD = 0x04, EXT_POINTER = 0x20;
const INCBIN_MIN = 32;
const LIST_MAX = 6;

function addrText(index, space, addr) {
    if (space === SPACE.WRAM) return '$' + hex(0x7E0000 + addr, 6);
    if (space === SPACE.IO) return '$' + hex(addr, 4);
    if (space === SPACE.ROM) return index.labelName(addr) || 'rom:' + hex(addr, 6);
    return '$' + hex(addr, 6);
}

function clip(list, max) {
    return list.length > max ? list.slice(0, max).concat('+' + (list.length - max) + ' more') : list;
}

/** Pass 1: instruction length per head offset (0 = data byte). */
function pickBoundaries(rom, lib, map) {
    const insLen = new Uint8Array(rom.length);
    const conflicts = new Set();
    for (let seg = 0; seg < rom.length; seg += map.segment) {
        const end = Math.min(seg + map.segment, rom.length);
        let off = seg;
        while (off < end) {
            if (!(lib.ext[off] & EXT_HEAD)) { off++; continue; }
            const ins = decodeAt(rom, off, lib.cdl[off], lib.ext[off]);
            let ok = ins && off + ins.len <= end && !ins.conflict;
            for (let i = 1; ok && i < ins.len; i++) if (lib.ext[off + i] & EXT_HEAD) ok = false;
            if (!ok) { if (ins && ins.conflict) conflicts.add(off); off++; continue; }
            insLen[off] = ins.len;
            off += ins.len;
        }
    }
    return { insLen, conflicts };
}

function exportAsar(lib, romInput, outDir) {
    const rom = romInput.length % 1024 === 512 ? romInput.subarray(512) : romInput;
    const map = createRomMap(rom);
    const index = buildIndex(lib, map);
    const segName = off => 'seg_' + hex(map.canonical(off), 6);
    const { insLen, conflicts } = pickBoundaries(rom, lib, map);
    const tables = findTables(lib, rom, map, index);
    const tableAtBase = new Map(tables.map(t => [t.base, t]));

    const known = findKnownRegions(rom, map, lib.cdl);
    const regionAt = new Map(known.regions.map(r => [r.start, r]));
    const inRegion = new Uint8Array(rom.length);
    for (const r of known.regions) inRegion.fill(1, r.start, r.end);
    for (let off = 0; off < rom.length; off++) {
        if (insLen[off] && (inRegion[off] || inRegion[off + insLen[off] - 1])) insLen[off] = 0;
    }

    // A label is emitted only where a line starts; inside a known region only its own.
    const insideIns = new Uint8Array(rom.length);
    for (let off = 0; off < rom.length; off++) for (let i = 1; i < insLen[off]; i++) insideIns[off + i] = 1;
    const emitted = new Set([...index.labels.keys()].filter(off => !insideIns[off] && !inRegion[off]));
    for (const r of known.regions) emitted.add(r.start);
    const nameOf = off => (regionAt.has(off) ? regionAt.get(off).name : index.labelName(off));

    // Every bus PC seen in edges / xrefs, grouped by ROM offset.
    const pcsAt = new Map();
    const notePc = pc => {
        const off = map.busToRom(pc);
        if (off < 0) return;
        const s = pcsAt.get(off);
        if (s) s.add(pc); else pcsAt.set(off, new Set([pc]));
    };
    for (const pc of index.byPc.keys()) notePc(pc);
    for (const b of index.bulk) notePc(b.pc);
    const targetsFrom = new Map();
    for (const [key, kind] of lib.edges) {
        const from = Math.floor(key / 0x1000000), to = key % 0x1000000;
        const off = map.busToRom(from);
        if (off < 0) continue;
        const list = targetsFrom.get(off) || [];
        list.push({ to, kind });
        targetsFrom.set(off, list);
    }

    // Known region containing a ROM offset (regions are sorted and disjoint).
    const regionStarts = known.regions.map(r => r.start);
    function regionOf(off) {
        let lo = 0, hi = regionStarts.length - 1, best = -1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; if (regionStarts[mid] <= off) { best = mid; lo = mid + 1; } else hi = mid - 1; }
        return best >= 0 && off < known.regions[best].end ? known.regions[best] : null;
    }

    // A 24-bit operand may name a label through a mirror ($9FFDE7 for map_table at
    // $DFFDE7) or point inside a known region (map_table+1). The expression keeps
    // the exact bytes, and the operand follows the label when it moves.
    function resolveLong(bus, off) {
        let name = emitted.has(off) ? nameOf(off) : null;
        if (!name) {
            const r = regionOf(off);
            if (!r) return null;
            name = r.name + (off > r.start ? '+$' + hex(off - r.start, 4) : '');
        }
        const delta = bus - map.canonical(off);
        return delta ? name + (delta < 0 ? '-$' : '+$') + hex(Math.abs(delta), 6) : name;
    }

    function resolve(bus, width) {
        const off = map.busToRom(bus);
        if (off < 0) return null;
        if (width === 24) return resolveLong(bus, off);
        if (map.canonical(off) !== bus) return null;
        if (width === 'rel' && !emitted.has(off)) {
            const segBase = off - (off % map.segment);
            return segBase === off ? segName(off) : segName(segBase) + '+$' + hex(off - segBase, 4);
        }
        if (!emitted.has(off)) return null;
        if (width === 16 && map.type !== 'LoROM' && (bus & 0xFFFF) < 0x8000 && !index.callers.has(off)) return null;
        return nameOf(off);
    }

    function instructionComment(off, ins, addr, asm) {
        const parts = [];
        const st0 = staticTarget(ins, addr);
        const stOff = st0 === null ? -1 : map.busToRom(st0);
        const stName = stOff >= 0 ? index.labelName(stOff) : null;
        if (stName && !(asm || '').includes(stName)) parts.push('= ' + stName);
        const targets = targetsFrom.get(off);
        if (targets) {
            const st = staticTarget(ins, addr);
            const shown = targets.filter(t => st === null || map.busToRom(t.to) !== map.busToRom(st));
            if (shown.length) {
                parts.push('-> ' + clip(shown.map(t => {
                    const o = map.busToRom(t.to);
                    return (o >= 0 && index.labelName(o)) || '$' + hex(t.to, 6);
                }), LIST_MAX).join(', '));
            }
        }
        const pcs = pcsAt.get(off);
        if (pcs) {
            const acc = [];
            for (const pc of pcs) {
                for (const x of index.byPc.get(pc) || []) acc.push(addrText(index, x.spaceAddr >>> 24, x.spaceAddr & 0xFFFFFF));
                for (const b of index.bulk) {
                    if (b.pc === pc) acc.push(addrText(index, b.space, b.lo) + '..' + addrText(index, b.space, b.hi) + ' (bulk)');
                }
            }
            if (acc.length) parts.push('[' + clip([...new Set(acc)], 4).join(', ') + ']');
        }
        return parts.join('  ');
    }

    function headerLines(off) {
        const name = index.labelName(off);
        const kind = index.labels.get(off);
        const lines = [];
        if (kind === 'func') {
            lines.push('', '; ' + ('==== ' + name + ' ').padEnd(70, '='));
            const callers = (index.callers.get(off) || []).filter(c => c.kind & 0x11);
            if (callers.length) {
                const names = [...new Set(callers.map(c => index.describePc(c.from)))];
                lines.push('; called by: ' + clip(names, LIST_MAX).join(', '));
            }
            if (lib.romHits && lib.romHits[off]) lines.push('; executed ' + countText(lib.romHits[off]) + ' times');
        } else if (kind === 'data' || kind === 'gfx' || kind === 'ptrs') {
            const readers = index.accessorsOf(SPACE.ROM, off).map(a => index.describePc(a.pc));
            lines.push('');
            if (readers.length) lines.push('; read by: ' + clip([...new Set(readers)], LIST_MAX).join(', '));
            if (lib.romHits && lib.romHits[off]) lines.push('; first byte read ' + countText(lib.romHits[off]) + ' times');
            if (tableAtBase.has(off)) lines.push('; table: ' + tableComment(tableAtBase.get(off), map));
        }
        lines.push(name + ':');
        return lines;
    }

    function dataLines(start, end) {
        const out = [];
        let off = start;
        while (off < end) {
            const cat = b => (lib.cdl[b] === 0 && lib.ext[b] === 0) ? 'unreached' : (lib.ext[b] & EXT_DMA) ? 'gfx' : 'data';
            const c = cat(off);
            let runEnd = off + 1;
            while (runEnd < end && cat(runEnd) === c) runEnd++;
            if ((c === 'unreached' || c === 'gfx') && runEnd - off >= INCBIN_MIN) {
                out.push('    incbin rom.bin:' + hex(off, 6) + '-' + hex(runEnd, 6) + '    ; ' + (runEnd - off) + ' bytes ' + c);
                off = runEnd;
                continue;
            }
            const pointerRun = (lib.ext[off] & EXT_POINTER) && ((runEnd - off) % 2 === 0);
            for (let p = off; p < runEnd;) {
                if (pointerRun) {
                    const n = Math.min(8, (runEnd - p) >> 1);
                    const words = [], targets = [];
                    for (let i = 0; i < n; i++) {
                        const w = rom[p + i * 2] | (rom[p + i * 2 + 1] << 8);
                        words.push('$' + hex(w, 4));
                        const t = map.busToRom((map.canonical(p) & 0xFF0000) | w);
                        targets.push(t >= 0 && index.labelName(t) ? index.labelName(t) : '?');
                    }
                    out.push('    dw ' + words.join(',') + '    ; ' + targets.join(' '));
                    p += n * 2;
                } else {
                    const n = Math.min(16, runEnd - p);
                    const bytes = [];
                    for (let i = 0; i < n; i++) bytes.push('$' + hex(rom[p + i], 2));
                    const note = lib.ext[p] & EXT_APU ? '    ; apu' : '';
                    out.push('    db ' + bytes.join(',') + note);
                    p += n;
                }
            }
            off = runEnd;
        }
        return out;
    }

    fs.mkdirSync(path.join(outDir, 'banks'), { recursive: true });
    fs.writeFileSync(path.join(outDir, 'rom.bin'), rom);
    const includes = [];
    let codeLines = 0;

    for (let seg = 0; seg < rom.length; seg += map.segment) {
        const end = Math.min(seg + map.segment, rom.length);
        const base = map.canonical(seg);
        const lines = ['; ' + hex(base >>> 16, 2) + ' - ROM $' + hex(seg, 6) + '-$' + hex(end - 1, 6), '',
            'org $' + hex(base, 6), segName(seg) + ':'];
        let off = seg;
        while (off < end) {
            const region = regionAt.get(off);
            if (region) {
                lines.push('', '; ' + ('==== ' + region.name + ' ').padEnd(70, '='), '; ' + region.note, region.name + ':');
                lines.push(...(region.kind === 'blob' ? ['    incbin ' + region.file] : region.lines));
                off = region.end;
                continue;
            }
            if (emitted.has(off)) lines.push(...headerLines(off));
            if (insLen[off]) {
                const ins = decodeAt(rom, off, lib.cdl[off], lib.ext[off]);
                const addr = map.canonical(off);
                const asm = formatInstruction(ins, addr, resolve);
                const raw = [];
                for (let i = 0; i < ins.len; i++) raw.push('$' + hex(rom[off + i], 2));
                const text = '    ' + (asm || 'db ' + raw.join(','));
                const note = (asm ? '' : ins.mnemonic.toLowerCase() + ' (target not addressable)  ') + instructionComment(off, ins, addr, asm);
                lines.push(note ? text.padEnd(36) + '; ' + note : text);
                codeLines++;
                off += ins.len;
                continue;
            }
            let stop = off + 1;
            while (stop < end && !insLen[stop] && !emitted.has(stop)) stop++;   // region starts are in emitted
            if (conflicts.has(off)) lines.push('    ; M/X conflict: executed with both register widths, kept as bytes');
            lines.push(...dataLines(off, stop));
            off = stop;
        }
        const name = 'bank_' + hex(base >>> 16, 2) + (map.segment < 0x10000 ? '_' + hex(base & 0xFFFF, 4) : '') + '.asm';
        fs.writeFileSync(path.join(outDir, 'banks', name), lines.join('\n') + '\n');
        includes.push('incsrc "banks/' + name + '"');
    }

    const s = lib.summary ? lib.summary() : null;
    const mapper = { LoROM: 'lorom', HiROM: 'hirom', ExHiROM: 'exhirom' }[map.type] || 'hirom';
    const main = [
        '; Generated by Everscript from the CDL library (' + (lib.hash || '') + ')',
        '; ROM: ' + (map.header ? map.header.title : '?') + ' - ' + map.type + ', ' + rom.length + ' bytes',
        s ? '; coverage: ' + s.code + ' code bytes, ' + s.data + ' data bytes, ' + index.entries.length + ' functions' : '',
        '; Build: ./build.sh  (asar --fix-checksum=off main.asm -> build/out.sfc, byte-identical to the',
        ';   source ROM, plus build/out.cdl). Export history: STEPS.md',
        '',
        mapper,
        '',
        ...known.defines,
        '',
        ...includes,
        '',
    ].join('\n');
    const mainPath = path.join(outDir, 'main.asm');
    fs.writeFileSync(mainPath, main);
    const recomp = writeRecompSeeds({ lib, map, index, known, outDir });
    known.steps.push(recomp.step);
    const report = tablesReport(tables, map, index, lib);
    fs.writeFileSync(path.join(outDir, 'tables.md'), report.text + '\n');
    known.steps.push('ROM lookup tables: tables.md with ' + tables.length + ' tables ('
        + Object.entries(report.counts).map(([k, n]) => n + ' ' + k).join(', ') + ').');
    const build = writeBuildFiles({ lib, rom, map, outDir, known, labels: [...emitted].map(o => [nameOf(o), o]), banks: includes.length, functions: index.entries.length });
    return { mainPath, build, recomp, known, tables: tables.length, banks: includes.length, functions: index.entries.length, codeLines, index, map };
}

module.exports = { exportAsar };
