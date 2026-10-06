'use strict';

/**
 * emulator/cdl/known-regions.js
 *
 * What the export knows about a ROM before any CDL data: the header, and for
 * Secret of Evermore the room blobs, the map pointer table, the strings and
 * the string key table. Each region replaces the CDL's guess for its bytes:
 *   blob   -> incbin of its own file (rooms/room_XX.bin)
 *   bytes  -> db lines under a label (header, strings)
 *   table  -> pointer entries written as label expressions, so a moved target
 *             moves its pointer with it
 * Every region is a plain slice of the ROM, so a wrong end only moves a label;
 * the rebuild stays byte-identical either way.
 */

const { hex } = require('./rom-map');
const maps = require('../../maps');

const CDL_CODE = 0x01, CDL_DATA = 0x02;

// String key table: 3-byte entries, low 23 bits are the string's ROM offset
// from $C00000 packed as (bank << 15) | (addr & $7FFF); bit 23 = compressed.
const STRING_KEYS = 0x11D000;
const STRING_COUNT = 3002;
const STRING_CHUNK = 0x8000;
const STRKEY_FN = 'function strkey(a) = ((a-$C00000)&$FFFF)+(((a-$C00000)&$7F8000)>>1)';

function headerRegions(rom, map, steps) {
    const h = map.header;
    if (!h) { steps.push('Header: none found, no header labels.'); return []; }
    const base = map.type === 'LoROM' ? 0x7FB0 : 0xFFB0;
    if (base + 0x50 > rom.length) return [];
    const at = (o, n) => [...rom.subarray(base + o, base + o + n)];
    steps.push(`Header: "${h.title}", ${map.type}, ${rom.length} bytes; labels rom_header ($${hex(map.canonical(base), 6)}) and rom_vectors.`);
    return [
        { start: base, end: base + 0x30, kind: 'bytes', name: 'rom_header', note: `${h.title} - ${map.type}`, lines: dbLines(at(0, 0x30)) },
        { start: base + 0x30, end: base + 0x50, kind: 'bytes', name: 'rom_vectors', note: 'native $FFE0-$FFEF, emulation $FFF0-$FFFF', lines: dbLines(at(0x30, 0x20)) },
    ];
}

function dbLines(bytes, per = 16) {
    const out = [];
    for (let i = 0; i < bytes.length; i += per) out.push('    db ' + bytes.slice(i, i + per).map(b => '$' + hex(b, 2)).join(','));
    return out;
}

function isEvermore(map) {
    return !!(map.header && /SECRET OF EVERMORE/.test(map.header.title) && map.type === 'HiROM');
}

function roomRegions(rom, map, steps) {
    const regions = [];
    const skipped = [];
    const nameOf = id => 'room_' + hex(id, 2);
    for (let id = 0; id < maps.MAX_ROOMS; id++) {
        const ptr = rom[maps.MAP_LIST_ADDR + id * 4] | (rom[maps.MAP_LIST_ADDR + id * 4 + 1] << 8) | (rom[maps.MAP_LIST_ADDR + id * 4 + 2] << 16);
        const off = map.busToRom(ptr);
        try {
            if (off < 0) throw new Error('pointer $' + hex(ptr, 6) + ' is not ROM');
            const end = maps.objectAreaEnd(rom, maps.parseBlobLayout(rom, off));
            if ((off >> 16) !== ((end - 1) >> 16)) throw new Error('crosses a bank');
            regions.push({ start: off, end, kind: 'blob', name: nameOf(id), file: 'rooms/' + nameOf(id) + '.bin', note: 'room ' + hex(id, 2) });
        } catch (err) {
            skipped.push(hex(id, 2) + ': ' + err.message);
        }
    }
    const table = {
        start: maps.MAP_LIST_ADDR, end: maps.MAP_LIST_ADDR + maps.MAX_ROOMS * 4, kind: 'table', name: 'map_table',
        note: 'room id -> blob (dl pointer, db pad); slot $7F onward is not a room',
        entry: i => {
            const o = maps.MAP_LIST_ADDR + i * 4;
            return { ptr: rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16), pad: rom[o + 3], name: nameOf(i) };
        },
    };
    const named = new Set(regions.map(r => r.name));
    table.lines = [];
    for (let i = 0; i < maps.MAX_ROOMS; i++) {
        const e = table.entry(i);
        const r = regions.find(x => x.name === e.name);
        const expr = named.has(e.name) ? labelExpr(e.name, e.ptr - map.canonical(r.start)) : '$' + hex(e.ptr, 6);
        table.lines.push(`    dl ${expr} : db $${hex(e.pad, 2)}`);
    }
    const bytes = regions.reduce((s, r) => s + r.end - r.start, 0);
    steps.push(`Rooms: map table at $${hex(map.canonical(maps.MAP_LIST_ADDR), 6)}, ${regions.length}/${maps.MAX_ROOMS} blobs carved to rooms/ (${bytes} bytes), ends from the blob layout + object area.` +
        (skipped.length ? ' Skipped: ' + skipped.join('; ') + '.' : ''));
    return [table, ...regions];
}

function labelExpr(name, delta) {
    if (!delta) return name;
    return name + (delta < 0 ? '-$' + hex(-delta, 6) : '+$' + hex(delta, 6));
}

function stringText(bytes) {
    let s = '';
    for (const b of bytes) {
        if (b === 0) s += '[END]';
        else if (b === 0x0A) s += '[LF]';
        else if (b >= 0x20 && b < 0x7F) s += String.fromCharCode(b);
        else s += '[' + hex(b, 2) + ']';
    }
    return s;
}

function stringRegions(rom, map, cdl, steps) {
    const keys = [];
    for (let i = 0; i < STRING_COUNT; i++) {
        const o = STRING_KEYS + i * 3;
        const v = rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16);
        const packed = v & 0x7FFFFF;
        keys.push({ index: i, raw: v, compressed: !!(v & 0x800000), off: ((packed >> 15) << 16) | (packed & 0x7FFF) });
    }
    const starts = [...new Set(keys.map(k => k.off))].sort((a, b) => a - b);
    const firstKey = new Map();
    for (const k of keys) if (!firstKey.has(k.off)) firstKey.set(k.off, k);

    const regions = [];
    let fromCdl = 0, toChunkEnd = 0, plainEnds = 0;
    for (let n = 0; n < starts.length; n++) {
        const start = starts[n];
        const chunkEnd = start - (start % 0x10000) + STRING_CHUNK;
        if (start >= chunkEnd || start >= rom.length) continue;
        const k = firstKey.get(start);
        let end = n + 1 < starts.length && starts[n + 1] < chunkEnd ? starts[n + 1] : -1;
        if (end < 0 && !k.compressed) {
            const z = rom.indexOf(0, start);
            if (z >= 0 && z < chunkEnd) { end = z + 1; plainEnds++; }
        }
        if (end < 0 && cdl) {
            let e = start;
            while (e < chunkEnd && (cdl[e] & CDL_DATA) && !(cdl[e] & CDL_CODE)) e++;
            if (e > start) { end = e; fromCdl++; }
        }
        if (end < 0) { end = chunkEnd; toChunkEnd++; }
        const bytes = [...rom.subarray(start, end)];
        const lines = dbLines(bytes);
        const shared = keys.filter(x => x.off === start).length;
        regions.push({
            start, end, kind: 'bytes', name: 'str_' + hex(k.index, 4), lines,
            note: (k.compressed ? 'compressed' : '"' + stringText(bytes).slice(0, 60) + '"') + (shared > 1 ? ` (${shared} keys)` : ''),
        });
    }
    const named = new Map(regions.map(r => [r.start, r.name]));
    const lines = keys.map(k => {
        const name = named.get(k.off);
        if (!name) return '    dl $' + hex(k.raw, 6);
        return '    dl strkey(' + name + ')' + (k.compressed ? '|$800000' : '') + '    ; ' + hex(k.index, 4);
    });
    const table = { start: STRING_KEYS, end: STRING_KEYS + STRING_COUNT * 3, kind: 'table', name: 'string_keys', note: 'string index -> string (strkey packing, bit 23 = compressed)', lines };
    const compressed = keys.filter(k => k.compressed).length;
    steps.push(`Strings: key table at $${hex(map.canonical(STRING_KEYS), 6)}, ${STRING_COUNT} keys (${compressed} compressed), ${regions.length} strings labelled str_<index> in banks $C0-$C3. ` +
        `Each string ends where the next one starts; the last one per 32 KB chunk ends at its terminator (${plainEnds}), the end of the CDL-read run (${fromCdl}), or the chunk end (${toChunkEnd}, end not known: no decompressor yet).`);
    return [table, ...regions];
}

/**
 * Known regions for this ROM, sorted and non-overlapping (a later region that
 * overlaps an earlier one is dropped and reported).
 * @returns {{ regions: object[], defines: string[], steps: string[] }}
 */
function findKnownRegions(rom, map, cdl) {
    const steps = [];
    let all = headerRegions(rom, map, steps);
    const defines = [];
    if (isEvermore(map) && rom.length > STRING_KEYS + STRING_COUNT * 3 && rom.length > maps.MAP_LIST_ADDR + maps.MAX_ROOMS * 4) {
        all = all.concat(roomRegions(rom, map, steps), stringRegions(rom, map, cdl, steps));
        defines.push(STRKEY_FN);
    } else {
        steps.push('Content: not a Secret of Evermore HiROM image, only the header is seeded.');
    }
    all.sort((a, b) => a.start - b.start || b.end - a.end);
    const regions = [], dropped = [];
    for (const r of all) {
        const prev = regions[regions.length - 1];
        const crosses = map.segment && Math.floor(r.start / map.segment) !== Math.floor((r.end - 1) / map.segment);
        if ((prev && r.start < prev.end) || crosses) dropped.push(r.name + (crosses ? ' (crosses a bank)' : ' (overlaps ' + prev.name + ')'));
        else regions.push(r);
    }
    if (dropped.length) steps.push('Dropped: ' + dropped.join(', ') + '.');
    if (cdl) {
        let codeInside = 0;
        for (const r of regions) for (let o = r.start; o < r.end; o++) if (cdl[o] & CDL_CODE) codeInside++;
        if (codeInside) steps.push(`Warning: the CDL saw ${codeInside} bytes inside known regions execute as code; the known region wins.`);
    }
    return { regions, defines, steps };
}

module.exports = { findKnownRegions, stringText };
