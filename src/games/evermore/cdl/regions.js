'use strict';

/**
 * games/evermore/cdl/regions.js
 *
 * What the CDL export knows about Secret of Evermore before any CDL data: the room blobs, the
 * map pointer table, the room enter script table, the strings with their key table, and the
 * two string key readers. Handed to the export as `gameRegions` (platform/cdl/known-regions.js
 * owns the header and how regions are merged). Region kinds and rules: that file.
 */

const { hex } = require('../../../../dist/platform/cdl/rom-map');
const { dbLines, labelExpr } = require('../../../platform/cdl/known-regions');
const maps = require('../../../../dist/games/evermore/maps');

const CDL_CODE = 0x01, CDL_DATA = 0x02;

// String key table: 3-byte entries, low 23 bits are the string's ROM offset
// from $C00000 packed as (bank << 15) | (addr & $7FFF); bit 23 = compressed.
const STRING_KEYS = 0x11D000;
const STRING_COUNT = 3002;
const STRING_CHUNK = 0x8000;
const STRKEY_FN = 'function strkey(a) = ((a-$C00000)&$FFFF)+(((a-$C00000)&$7F8000)>>1)';

// The title alone, so ROM hacks and other layouts get the known regions too;
// a room whose blob does not decode is skipped (roomRegions), not fatal.
function isEvermore(map) {
    return !!(map.header && /SECRET OF EVERMORE/.test(map.header.title));
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

// Room enter scripts: $928000 + 0x1B + 5*id, read by func_CCCE99 through the hardware
// multiplier (8x8 bit, so at most 256 rooms). Only the first 3 bytes of an entry are read
// (a packed script pointer); the table ends where the global script pointer table starts,
// at $928000 + word[$928000], which the last entry overlaps.
const SCRIPT_BANK = 0x128000;
const ENTER_TABLE = SCRIPT_BANK + 0x1B;

function enterScriptRegion(rom, map, steps) {
    const end = SCRIPT_BANK + (rom[SCRIPT_BANK] | (rom[SCRIPT_BANK + 1] << 8));
    if (end <= ENTER_TABLE || end > SCRIPT_BANK + 0x8000) { steps.push('Room enter scripts: table end not found, not seeded.'); return []; }
    const lines = [];
    for (let o = ENTER_TABLE, id = 0; o < end; o += 5, id++) {
        const n = Math.min(5, end - o);
        lines.push(dbLines([...rom.subarray(o, o + n)])[0] + `    ; room ${hex(id, 2)}` + (n < 5 ? ` (${n} bytes; overlaps the global script table)` : ''));
    }
    steps.push(`Room enter scripts: table at $${hex(map.canonical(ENTER_TABLE), 6)}, ${lines.length} entries (5 bytes, id*5 via the 8x8-bit multiplier: max 256 rooms), labelled room_enter_scripts.`);
    return [{ start: ENTER_TABLE, end, kind: 'bytes', name: 'room_enter_scripts', note: 'room id -> enter script (3-byte packed pointer + 2 bytes), stride 5', lines }];
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

// The string key table's readers never hold $91D000 as one operand: they build the
// pointer at $26-$28 from two immediates (`lda #$0091 : sta $28 : ldy #$D000`, then
// `lda [$26],y`). Each occurrence becomes a region whose immediates are expressions of
// string_keys, so a moved table repoints them. The table must then stay inside one
// $xx8000-$xxFFFF half (read through the $80 mirror, like the original $91D000).
const KEY_READER = [0xA9, 0x91, 0x00, 0x85, 0x28, 0xA0, 0x00, 0xD0];

function stringKeyReaders(rom, map, steps) {
    const regions = [];
    for (let o = 0; o + KEY_READER.length <= Math.min(rom.length, 0x400000); o++) {
        if (rom[o] !== 0xA9 || KEY_READER.some((b, i) => rom[o + i] !== b)) continue;
        regions.push({
            start: o, end: o + KEY_READER.length, kind: 'bytes', name: 'string_keys_ref_' + regions.length,
            note: 'string key table base, built as bank:$28 + offset:y for `lda [$26],y`',
            lines: ['    lda.w #(string_keys-$400000)>>16', '    sta.b $28', '    ldy.w #(string_keys-$400000)&$FFFF'],
        });
    }
    steps.push(`String key readers: ${regions.length} (${regions.map(r => '$' + hex(map.canonical(r.start), 6)).join(', ')}), immediates written as expressions of string_keys.`);
    return regions;
}

/**
 * Evermore's regions, or null when the ROM is not Evermore (title) or too small.
 * @returns {{ regions: object[], defines: string[] } | null}
 */
function evermoreRegions(rom, map, cdl, steps) {
    if (!isEvermore(map) || rom.length <= STRING_KEYS + STRING_COUNT * 3 || rom.length <= maps.MAP_LIST_ADDR + maps.MAX_ROOMS * 4) return null;
    try {
        const regions = [].concat(roomRegions(rom, map, steps), enterScriptRegion(rom, map, steps), stringRegions(rom, map, cdl, steps), stringKeyReaders(rom, map, steps));
        return { regions, defines: [STRKEY_FN] };
    } catch (err) {
        // A hack with the vanilla title but moved tables: keep the header only.
        steps.push('Content: titled Secret of Evermore, but its tables do not decode (' + err.message + '); only the header is seeded.');
        return null;
    }
}

module.exports = { evermoreRegions, stringText };
