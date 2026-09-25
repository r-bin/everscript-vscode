#!/usr/bin/env node
'use strict';
// How well does a tile predict its collision? The measurement behind the
// editor's suggested collision (maps/vanilla-suggest.ts suggestGeometry).
//
// Leave-one-room-out over all 127 vanilla rooms: for every cell, the
// suggestion is learned from the *other* rooms and compared with what the
// cell really has — the situation of a tile placed on a new map. Reports
// accuracy per key and target, and whether the vote share (the score the
// tile list shows) is calibrated.
//
//   npm run check:collision            (EVERSCRIPT_ROM=... to override the ROM)
//
// See docs/map-format/collision-suggestions.md for the numbers and what they
// decided.

const fs = require('fs');
const path = require('path');
const maps = require('../src/maps');

const ROM = process.env.EVERSCRIPT_ROM
    || path.join(__dirname, '..', '..', 'everscript', 'Secret of Evermore (U) [!].smc');
if (!fs.existsSync(ROM)) { console.log('SKIP: ROM not found at ' + ROM); process.exit(0); }
const rom = new Uint8Array(fs.readFileSync(ROM));

const slotOf = (chr) => Math.floor(chr / 0x20) * 8 + Math.floor((chr % 0x20) / 2);

/** Every cell: its room, terrain and canopy graphic, and collision word. */
const cells = [];
for (let id = 0; id < maps.MAX_ROOMS; id++) {
    let r;
    try { r = maps.decodeRoom(rom, id); } catch { continue; }
    const ids = r.tilePalette.concat(r.animatedTiles);
    const g = (w) => { const v = ids[slotOf(w & 0x3ff)]; return v === undefined ? -1 : v; };
    for (let y = 0; y < r.header.heightTiles; y++) {
        for (let x = 0; x < r.header.widthTiles; x++) {
            cells.push({ room: id, t: g(r.layer2VramWords[y][x]), c: g(r.layer1VramWords[y][x]), cw: r.collisionWords[y][x] });
        }
    }
}

/** A leave-one-room-out predictor for `key` -> `target`. */
function predictor(key, target) {
    const all = new Map();
    const perRoom = new Map();
    const bump = (m, k, v) => { let a = m.get(k); if (!a) m.set(k, a = new Map()); a.set(v, (a.get(v) || 0) + 1); };
    for (const c of cells) {
        bump(all, key(c), target(c));
        let r = perRoom.get(c.room); if (!r) perRoom.set(c.room, r = new Map());
        bump(r, key(c), target(c));
    }
    return (c) => {
        const k = key(c);
        const own = perRoom.get(c.room).get(k);
        let best = null; let bestN = 0; let sum = 0;
        for (const [v, n] of all.get(k)) {
            const rest = n - (own.get(v) || 0);
            sum += rest;
            if (rest > bestN) { bestN = rest; best = v; }
        }
        return best === null ? null : { value: best, share: bestN / sum };
    };
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%';
const shape = (c) => c.cw & maps.GEOMETRY_BITS;
const keys = { 'terrain graphic': (c) => c.t, 'terrain + canopy': (c) => c.t + ':' + c.c };
const targets = { 'shape (& 0x0F)': shape, 'full word': (c) => c.cw };

console.log(cells.length + ' cells in ' + new Set(cells.map((c) => c.room)).size + ' rooms\n');
for (const [tn, tf] of Object.entries(targets)) {
    for (const [kn, kf] of Object.entries(keys)) {
        const p = predictor(kf, tf);
        let seen = 0; let hit = 0;
        for (const c of cells) { const s = p(c); if (!s) continue; seen++; if (s.value === tf(c)) hit++; }
        console.log(`${tn.padEnd(15)} by ${kn.padEnd(17)} seen ${pct(seen, cells.length).padStart(6)}   right when seen ${pct(hit, seen).padStart(6)}`);
    }
}

const solid = cells.filter((c) => shape(c) === maps.SOLID).length;
console.log('\nbaseline "always solid": ' + pct(solid, cells.length));

// Calibration of the score the tile list shows: the terrain graphic's vote.
const byTerrain = predictor(keys['terrain graphic'], shape);
const buckets = [[0.95, '>= 95%'], [0.8, '80-95%'], [0.6, '60-80%'], [0, '< 60%']].map(([min, label]) => ({ min, label, n: 0, hit: 0 }));
for (const c of cells) {
    const s = byTerrain(c);
    if (!s) continue;
    const b = buckets.find((x) => s.share >= x.min);
    b.n++; if (s.value === shape(c)) b.hit++;
}
console.log('\nscore (vanilla agreement) -> right in an unseen room, terrain graphic, shape:');
for (const b of buckets) console.log(`  ${b.label.padEnd(7)} ${pct(b.n, cells.length).padStart(6)} of cells   right ${pct(b.hit, b.n).padStart(6)}`);
