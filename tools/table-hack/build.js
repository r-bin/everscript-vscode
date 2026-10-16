#!/usr/bin/env node
// Build a table-hack ROM (docs/table-hack.md §0), optionally with an everscript IPS patch applied on top.
//   node tools/table-hack/build.js --rom <clean rom> [--tables all|name,name] [--ips everscript.ips] [--out file]
// everscript writes into the vanilla tables (string keys, room enter scripts, script pointer slots); with a table
// moved, each such IPS record goes to the moved copy instead, and a string key past the vanilla 3002 grows the table.
'use strict';
const fs = require('fs'), path = require('path');
const { TABLES, build, finish, hex } = require('./tables');

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
function buildWithIps(source, names, ips) {
    const recs = ips ? parseIps(ips) : [];
    const rom = source.length % 1024 === 512 ? source.subarray(512) : source;
    const span = names.map(name => {
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
    const { image, moves } = build(source, names, keys ? { string_keys: added } : {});
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

function main() {
    const a = process.argv.slice(2), opt = n => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1]; };
    const romPath = opt('rom') || process.env.SOE_ROM || process.env.EVERSCRIPT_ROM;
    if (!romPath || !fs.existsSync(romPath)) { console.error('usage: build.js --rom <clean rom> [--tables all|a,b] [--ips file] [--out file]'); process.exit(2); }
    const t = opt('tables') || 'all';
    const names = t === 'all' ? Object.keys(TABLES) : t.split(',').filter(Boolean);
    const ipsPath = opt('ips');
    const out = opt('out') || path.join(REPO, 'out', 'table-hack', 'soe-tables.sfc');
    const { image, moves, redirected } = buildWithIps(new Uint8Array(fs.readFileSync(romPath)), names, ipsPath ? fs.readFileSync(ipsPath) : null);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, image);
    for (const m of moves) console.log(`${m.name}: ${m.count}${m.added ? ' + ' + m.added : ''} entries, ${hex(m.from)} -> ${hex(m.bus)}; ${m.rewritten.join('; ')}`);
    for (const r of redirected) console.log('ips: ' + r);
    console.log(`wrote ${out}`);
}

if (require.main === module) main();
module.exports = { parseIps, buildWithIps };
