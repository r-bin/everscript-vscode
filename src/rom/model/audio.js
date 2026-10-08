'use strict';
// Ownership: the audio regions of a Secret of Evermore ROM, measured by
// following every transfer record of every song descriptor. Pure.
//
// $81:9900 song count, $81:9903 pointers to descriptors. A descriptor is
// [count:16] then count × [length:16][rom_src:24][spc_dest:16]. Every copy
// reads upper halves only: past $FFFF it continues at the next bank's $8000.

const { hex } = require('./util');

const SONG_COUNT = 0x019900, SONG_POINTERS = 0x019903;
const FINE_END = 0x01B710;   // below: per-song tables, interleaved record by record

/** File ranges a copy of `len` bytes from upper-half offset `off` reads. */
function upperWalk(off, len) {
    const out = [];
    while (len > 0) {
        const bankEnd = (off | 0xFFFF) + 1;
        const n = Math.min(len, bankEnd - off);
        out.push([off, off + n]);
        len -= n;
        off = bankEnd + 0x8000;
    }
    return out;
}

/** Bytes read sequentially from `cur`, hopping halves; returns [bytes, next]. */
function take(rom, cur, n, ranges) {
    const bytes = [];
    for (const [a, b] of upperWalk(cur, n)) {
        ranges.push([a, b]);
        for (let i = a; i < b; i++) bytes.push(rom[i]);
        cur = b;
    }
    if ((cur & 0xFFFF) === 0) cur += 0x8000;
    return [bytes, cur];
}

function songs(rom) {
    const r24 = o => rom[o] | rom[o + 1] << 8 | rom[o + 2] << 16;
    const count = rom[SONG_COUNT];
    const res = [];
    for (let s = 0; s <= count; s++) {
        const desc = [], data = [];
        let cur = r24(SONG_POINTERS + s * 3) & 0x3FFFFF, b;
        [b, cur] = take(rom, cur, 2, desc);
        const n = b[0] | b[1] << 8;
        for (let k = 0; k < n; k++) {
            [b, cur] = take(rom, cur, 7, desc);
            const len = b[0] | b[1] << 8, src = (b[2] | b[3] << 8 | b[4] << 16) & 0x3FFFFF;
            if (src + len > rom.length) throw new Error('song 0x' + hex(s, 2) + ' reads past the ROM');
            data.push(...upperWalk(src, len));
        }
        res.push({ song: s, desc, data });
    }
    return res;
}

const ids = v => v.length > 10 ? `${v.length} songs` : v.map(x => '0x' + hex(x, 2)).join(', ');

/** Claims for the driver, the song tables, the descriptors and every song's data. */
function audioRegions(rom, R) {
    R(0x0180DC, 0x0180DC + 6112, '🎵', 'Wolfgang v3 SPC700 driver', 'uploaded to SPC `$0700`');
    R(0x019900, 0x019902, '🎵', 'Song count', '`0x46` (songs `0x00..0x46`)');
    R(0x019903, 0x019903 + 213, '📋', 'Song pointer table', '71 × 24-bit pointers to the descriptors in `$8A..$8B`');
    R(0x0199D8, 0x0199D8 + 70, '📋', 'Internal song index sequence', '`0x01..0x46`');
    R(0x019A1E, 0x019A1E + 90, '📋', 'Song dependency table', 'SFX `0..89` → soundbank song needed in ARAM');
    R(0x0C8362, 0x0C8442, '📋', 'SFX translation table', 'opcode `0x30` (`sound`): 112 words, `$FFFF` = muted; animation opcode `0x2E` indexes it too');
    R(0x0C8442, 0x0C8442 + 146, '📋', 'Music translation table', 'opcode `0x33` (`music`): 73 words → song id');

    const list = songs(rom);
    for (const r of list) for (const [a, b] of r.desc) R(a, b, '📋', 'Song descriptors', '`[count:16]` + count × `[len:16][src:24][spc_dest:16]`; song `0x00` has 407 records');

    // Which songs load each byte, then runs of bytes with the same set.
    const owner = new Map();
    for (const r of list) for (const [a, b] of r.data) for (let i = a; i < b; i++) {
        let set = owner.get(i);
        if (!set) owner.set(i, set = new Set());
        set.add(r.song);
    }
    const runs = [];
    for (const k of [...owner.keys()].sort((a, b) => a - b)) {
        const set = owner.get(k), sig = [...set].sort((a, b) => a - b).join(',');
        const l = runs[runs.length - 1];
        if (l && l.e === k && l.sig === sig) l.e++;
        else runs.push({ s: k, e: k + 1, sig, set });
    }
    // Rows of at least 2 KB inside one half; the interleaved head stays one row.
    const rows = [];
    for (const r of runs) {
        const fine = r.s < FINE_END, l = rows[rows.length - 1];
        const joins = l && (l.s >> 15) === (r.s >> 15) && l.e === r.s && l.fine === fine && (fine || l.e - l.s < 2048);
        if (joins) { l.e = r.e; l.parts.push(r); } else rows.push({ s: r.s, e: r.e, fine, parts: [r] });
    }
    for (const r of rows) {
        if (r.fine) { R(r.s, r.e, '🎵', 'Per-song tables', 'small per-song records, interleaved, all 71 songs'); continue; }
        const excl = new Map(), sharers = new Set();
        let shared = 0;
        for (const p of r.parts) {
            const n = p.e - p.s;
            if (p.set.size === 1) { const k = [...p.set][0]; excl.set(k, (excl.get(k) || 0) + n); }
            else { shared += n; p.set.forEach(x => sharers.add(x)); }
        }
        const ex = [...excl.keys()].sort((a, b) => a - b);
        const name = !shared && ex.length === 1 ? (ex[0] === 0 ? 'Song 0x00 (base soundbank)' : `Song 0x${hex(ex[0], 2)}`)
            : !ex.length ? 'Shared samples'
            : ex.length === 1 ? `Song 0x${hex(ex[0], 2)} + shared samples` : `Songs 0x${hex(ex[0], 2)}–0x${hex(ex[ex.length - 1], 2)}`;
        const notes = [];
        if (ex.length) notes.push('exclusive: ' + ex.map(k => `0x${hex(k, 2)} (${excl.get(k).toLocaleString('en-US')} B)`).join(', '));
        if (shared) notes.push(`shared samples: ${shared.toLocaleString('en-US')} B, used by ${ids([...sharers].sort((a, b) => a - b))}`);
        R(r.s, r.e, '🎵', name, notes.join('; '));
    }
}

module.exports = { audioRegions };
