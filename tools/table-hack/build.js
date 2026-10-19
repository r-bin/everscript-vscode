#!/usr/bin/env node
// TODO port to TS (docs/todo/port-to-ts.md)
// Build a table-hack ROM (docs/table-hack.md §0), optionally with an everscript IPS patch applied on top.
//   node tools/table-hack/build.js --rom <clean rom> [--tables all|name,name] [--ips everscript.ips] [--out file]
//                                  [--add-enemy <record>,..] [--recolor-room <room>,..]   (test content, see testContent)
//                                  [--add-animation <record>:<facings>,..] [--dog-slot <form>:<slot>=<record|@n>,..]
// everscript writes into the vanilla tables (string keys, room enter scripts, script pointer slots); with a table
// moved, each such IPS record goes to the moved copy instead, and a string key past the vanilla 3002 grows the table.
'use strict';
const fs = require('fs'), path = require('path');
const { TABLES, build, finish, hex, familyCount, ANIMATION_RECORD_POOL } = require('./tables');
const { paletteAddress } = require('./hooks');
const { markDerived } = require('../derived-marker');

const REPO = path.resolve(__dirname, '..', '..');
const KEY_SPAN = 0x8000;      // a key is a 16-bit byte offset, and the table must stay inside one 32 KB half

/** IPS records: [{ off, bytes }]. */
function parseIps(buf) {
    if (buf.toString('latin1', 0, 5) !== 'PATCH') throw new Error('not an IPS patch');
    const recs = [];
    let o = 5;
    for (;;) {
        const off = (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2];
        if (off === 0x454F46) break;                 // "EOF"
        let n = (buf[o + 3] << 8) | buf[o + 4];
        o += 5;
        if (n) { recs.push({ off, bytes: buf.subarray(o, o + n) }); o += n; }
        else { n = (buf[o] << 8) | buf[o + 1]; recs.push({ off, bytes: Buffer.alloc(n, buf[o + 2]) }); o += 3; }
    }
    return recs;
}

/**
 * Build with `names` moved and `ips` applied; returns { image, moves, redirected }. An IPS record inside a moved
 * table's old place is written into the moved copy instead; string keys past the vanilla table grow it.
 */
function buildWithIps(source, names, ips, extra = {}, after = []) {
    const recs = ips ? parseIps(ips) : [];
    const rom = source.length % 1024 === 512 ? source.subarray(512) : source;
    const span = names.filter(name => TABLES[name]).map(name => {
        const t = TABLES[name], start = typeof t.start === 'function' ? t.start(rom) : t.start, len = t.count(rom) * t.entry;
        // the enter table's last entry overlaps the script pointer table: its span ends where that table starts
        const end = name === 'string_keys' ? start + KEY_SPAN : t.wipeEnd ? t.wipeEnd(rom) : start + len;
        return { name, t, start, len, end };
    });
    const tableOf = r => {
        const s = span.find(x => r.off >= x.start && r.off < x.end);
        if (s && r.off + r.bytes.length > s.end) throw new Error(`IPS record ${hex(r.off)} runs past ${s.name}`);
        return s;
    };
    const added = [];
    const keys = span.find(x => x.name === 'string_keys');
    for (const r of recs) {
        if (tableOf(r) !== keys || !keys) continue;
        if ((r.off - keys.start) % 3 || r.bytes.length % 3) throw new Error(`IPS record ${hex(r.off)} is not whole string keys`);
        for (let i = 0; i < r.bytes.length; i += 3) {
            const k = (r.off - keys.start + i) / 3 - keys.len / 3;
            if (k >= 0) added[k] = r.bytes[i] | (r.bytes[i + 1] << 8) | (r.bytes[i + 2] << 16);
        }
    }
    for (let i = 0; i < added.length; i++) if (added[i] === undefined) added[i] = 0;
    const { image, moves } = build(source, names, keys ? { ...extra, string_keys: added } : extra);
    for (const f of after) f(image);
    const redirected = [];
    for (const r of recs) {
        const s = tableOf(r);
        if (!s) { image.set(r.bytes, r.off); continue; }
        const to = s.t.to + (r.off - s.start);
        image.set(r.bytes, to);
        redirected.push(`${s.name} +${hex(r.off - s.start, 4)} (${r.bytes.length} B at ${hex(r.off)}) -> ${hex(to)}`);
    }
    finish(image);
    return { image, moves, redirected };
}

/** BGR555 with red and blue swapped, so a copy is told apart at a glance. Word 0 (the transparent colour) stays. */
function recolor(bytes) {
    const out = Uint8Array.from(bytes);
    for (let i = 2; i < out.length; i += 2) {
        const c = out[i] | (out[i + 1] << 8);
        const v = ((c & 0x1F) << 10) | (c & 0x3E0) | ((c >> 10) & 0x1F);
        out[i] = v & 0xFF; out[i + 1] = v >> 8;
    }
    return out;
}

/**
 * Test content on top of the moved tables: `enemies` = record numbers to copy as new enemies, each with its own
 * recoloured sprite palette; `rooms` = room ids whose first tile family is replaced by a new, recoloured family.
 * The room edit changes that room's blob (two bytes): it is a test of the moved family table, not part of the hack.
 */
function testContent(rom, names, { enemies = [], rooms = [], animations = [], dogSlots = [] }) {
    const extra = { characters: [], enemy_index: [], sprite_palettes: [], map_palettes: [] }, after = [], made = [];
    const need = list => list.forEach(n => { if (!names.includes(n)) throw new Error(`this test needs --tables to include ${n}`); });
    if (enemies.length) need(['characters', 'enemy_index', 'sprite_palettes']);
    if (rooms.length) need(['map_palettes']);
    const RECORDS = 0x0EB678, STRIDE = 74, VANILLA_RECORDS = TABLES.characters.count(rom), VANILLA_IDS = TABLES.enemy_index.count(rom);
    for (const n of enemies) {
        const rec = Uint8Array.from(rom.subarray(RECORDS + STRIDE * n, RECORDS + STRIDE * (n + 1)));
        const pal = rec[9] | (rec[10] << 8);
        const k = extra.sprite_palettes.push(recolor(rom.subarray(0x100000 + pal, 0x100000 + pal + 32))) - 1;
        const addr = paletteAddress(k);
        rec[9] = addr & 0xFF; rec[10] = addr >> 8;
        const at = (RECORDS & 0xFFFF) + STRIDE * (VANILLA_RECORDS + extra.characters.push(rec) - 1);
        const id = VANILLA_IDS + extra.enemy_index.push(at) - 1;
        made.push(`enemy ${hex(id, 2)}: record ${VANILLA_RECORDS + extra.characters.length - 1} at $B8:${at.toString(16).toUpperCase()} (copy of record ${n}), sprite palette $${addr.toString(16).toUpperCase().padStart(4, '0')} (bank $FA)`);
    }
    if (rooms.length) {
        const maps = require('../../dist/games/evermore/maps');
        const first = familyCount(rom);
        for (const room of rooms) {
            const ptr = rom[0x1FFDE7 + room * 4] | (rom[0x1FFDE8 + room * 4] << 8) | (rom[0x1FFDE9 + room * 4] << 16);
            const at = maps.parseBlobLayout(rom, ptr & 0x3FFFFF).payloadOffset + 1;
            const fam = rom[at] | (rom[at + 1] << 8);
            const id = first + extra.map_palettes.push(recolor(rom.subarray(0x1CC322 + 32 * fam, 0x1CC322 + 32 * fam + 32))) - 1;
            after.push(img => { img[at] = id & 0xFF; img[at + 1] = id >> 8; });
            made.push(`room ${hex(room, 2)}: family ${fam} -> new family ${id} (recoloured copy), blob byte ${hex(at)}`);
        }
    }
    // Animation records: copies of vanilla record groups in the pool that animate_ids leaves free in bank $C4.
    // A record is [script:16][bank:8][flags:8]; a group is one record per facing (4 for $40-flagged groups).
    const added = [];
    if (animations.length) need(['animate_ids']);
    let at = ANIMATION_RECORD_POOL.start;
    for (const spec of animations) {
        const [rec, facings] = spec.split(':').map(Number);
        const bytes = rom.subarray(0x040000 + rec, 0x040000 + rec + 4 * facings);
        if (at + bytes.length > ANIMATION_RECORD_POOL.end) throw new Error('the animation record pool is full');
        const where = at;
        after.push(img => img.set(bytes, where));
        added.push(where & 0xFFFF);
        made.push(`animation @${added.length - 1}: record $${(where & 0xFFFF).toString(16).toUpperCase()} = copy of $${rec.toString(16).toUpperCase()} (${facings} facings)`);
        at += bytes.length;
    }
    // Dog form slots: $CF945F lists the six forms; slot s of a form is at +10 + 2s (src/games/evermore/sprites/dog-forms.ts).
    for (const spec of dogSlots) {
        const [, form, slot, value] = /^(\d+):(\d+)=(@?\w+)$/.exec(spec) || [];
        if (form === undefined) throw new Error(`--dog-slot ${spec}: want <form>:<slot>=<record|@n>`);
        const rec = value[0] === '@' ? added[Number(value.slice(1))] : Number(value);
        if (rec === undefined) throw new Error(`--dog-slot ${spec}: no animation ${value}`);
        const ptr = rom[0x0F945F + 2 * form] | (rom[0x0F9460 + 2 * form] << 8);
        const o = 0x0F0000 + ptr + 10 + 2 * Number(slot);
        const old = rom[o] | (rom[o + 1] << 8);
        after.push(img => { img[o] = rec & 0xFF; img[o + 1] = rec >> 8; });
        made.push(`dog form ${form} slot ${slot} ($CF${(ptr + 10 + 2 * slot).toString(16).toUpperCase()}): $${old.toString(16).toUpperCase()} -> $${rec.toString(16).toUpperCase()}`);
    }
    return { extra, after, made };
}

function main() {
    const a = process.argv.slice(2), opt = n => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1]; };
    // usage: build.js [--rom <clean rom>] [--tables all|a,b] [--ips file] [--out file]
    const romPath = require('../rom').baseRomOrExit('evermore', opt('rom'));
    const t = opt('tables') || 'all';
    const names = t === 'all' ? [...Object.keys(TABLES), 'sprite_palettes'] : t.split(',').filter(Boolean);
    const ipsPath = opt('ips');
    const out = opt('out') || path.join(REPO, 'out', 'table-hack', 'soe-tables.sfc');
    const source = new Uint8Array(fs.readFileSync(romPath));
    const rom = source.length % 1024 === 512 ? source.subarray(512) : source;
    const list = n => (opt(n) || '').split(',').filter(Boolean).map(Number);
    const words = n => (opt(n) || '').split(',').filter(Boolean);
    const test = testContent(rom, names, { enemies: list('add-enemy'), rooms: list('recolor-room'),
        animations: words('add-animation'), dogSlots: words('dog-slot') });
    const { image, moves, redirected } = buildWithIps(source, names, ipsPath ? fs.readFileSync(ipsPath) : null, test.extra, test.after);
    // Marks the result as derived from this base ROM, at the directory spot (multi-game.md §4).
    markDerived(image, rom, 0x310000, 'table-hack');
    finish(image);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, image);
    for (const m of moves) console.log(`${m.name}: ${m.count}${m.added ? ' + ' + m.added : ''} entries, ${m.wiped ? hex(m.from) : 'new'} -> ${hex(m.bus)}; ${m.rewritten.join('; ')}`);
    for (const r of redirected) console.log('ips: ' + r);
    for (const m of test.made) console.log('test: ' + m);
    console.log(`wrote ${out}`);
}

if (require.main === module) main();
module.exports = { parseIps, buildWithIps, testContent, recolor };
