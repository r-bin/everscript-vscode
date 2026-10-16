#!/usr/bin/env node
'use strict';
// Which room scripts can be cut off by leaving the room (docs/cheats.md § Leaving a
// room cuts every running script). A map change ends every script thread, so a
// script that writes the save block at two different ticks can be stopped in
// between. This runs every step-on and B-button trigger of every room through the
// simulation and lists:
//
//   keep  — the reward lands before the script's own "done" flag: cut in between,
//           keep the reward, the pickup is full again next time
//   lose  — the "done" flag lands before the reward: cut in between, lose it
//
// with the nearest exit (box gap in 16-px cells) and that exit's window (ticks from
// stepping on it to the map change, and whether it stops both characters first).
//
//   node tools/simulation/exit-cutoff.js [rom]
//
// Writes nothing. Ticks are lower bounds where an engine wait (0x2e) is involved.

const fs = require('fs');
const path = require('path');
const sim = require('../../src/simulation');
const script = require('../../src/script');

const ROM = require('../rom').romOrExit('evermore', process.argv[2]);
const rom = new Uint8Array(fs.readFileSync(ROM));
const S = sim.createSimulator(rom);
const OPTS = { maxPaths: 48, maxSteps: 40000, maxTicks: 900, rejoin: false };

// Save-block writes that are bookkeeping, not progress: loot mailbox and bonus,
// "loot successful", music / camera / screen state, the hut to enter, scratch.
const BOOKKEEPING = (a) => a === 0x22ea || a === 0x22eb || a === 0x234b || a === 0x2461 || a === 0x2539 ||
    (a >= 0x2380 && a <= 0x2440) || (a >= 0x2490 && a <= 0x24ff) || a >= 0x2500;
const PROGRESS = (a) => a >= 0x2258 && a < 0x2834 && !BOOKKEEPING(a);
const tick = (t) => { const m = /tick (\d+)/.exec(t); return m ? +m[1] : null; };
const gap = (a, b) => Math.max(0, a[0] - b[2], b[0] - a[2]) + Math.max(0, a[1] - b[3], b[1] - a[3]);
const hx = (v, n = 2) => v.toString(16).padStart(n, '0');

const rows = [];
for (let id = 0; id < 0x7f; id++) {
    const m = script.buildRoomScriptModel(rom, id);
    const triggers = [...m.stepOn.map((t, i) => ['step-on', i, t]), ...m.bTrigger.map((t, i) => ['b-button', i, t])];
    const exits = [], others = [];
    for (const [kind, i, t] of triggers) {
        let r;
        try { r = S.run(t.scriptAddressSnes, OPTS); } catch { continue; }
        const events = r.paths.flatMap((p) => p.steps.filter((s) => s.kind === 'event').map((s) => s.event));
        const maps = events.filter((e) => e.type === 'map').map((e) => tick(e.time)).filter((k) => k !== null);
        const box = [t.x1, t.y1, t.x2, t.y2];
        if (kind === 'step-on' && maps.length) {
            exits.push({ box, window: Math.min(...maps), stops: events.some((e) => e.opcode === 0xc0 || e.opcode === 0xbc) });
        } else others.push({ kind, i, t, box, r });
    }
    for (const { kind, i, t, box, r } of others) {
        for (const p of r.paths) {
            const tested = p.steps.filter((s) => s.kind === 'decide').map((s) => sim.key(s.cond)).join(' ');
            const writes = p.steps.filter((s) => s.kind === 'event').map((s) => s.event)
                .filter((e) => (e.type === 'write' || e.type === 'flag') && PROGRESS(e.addr) && tick(e.time) !== null);
            const isDone = (e) => e.type === 'flag' && tested.includes('$' + e.addr.toString(16));
            const done = writes.find(isDone);
            if (!done) continue;
            const d = tick(done.time);
            const near = exits.map((e) => ({ ...e, gap: gap(box, e.box) })).sort((a, b) => a.gap - b.gap)[0];
            const row = (way, gift) => rows.push({
                way, ticks: Math.abs(d - tick(gift.time)), at: tick(gift.time), room: id, trigger: `${kind} #${i}`,
                entry: t.scriptAddressSnes, gift: gift.summary, done: done.summary, near,
            });
            const before = writes.find((e) => !isDone(e) && tick(e.time) < d);
            const after = writes.find((e) => !isDone(e) && tick(e.time) > d);
            if (before) row('keep', before);
            if (after) row('lose', after);
        }
    }
}

const seen = new Set();
rows.sort((a, b) => (a.way === b.way ? b.ticks - a.ticks : a.way === 'keep' ? -1 : 1));
for (const r of rows) {
    const k = r.way + r.room + r.trigger;
    if (seen.has(k)) continue;
    seen.add(k);
    const exit = r.near ? `exit ${String(r.near.gap).padStart(2)} cells, window ${r.near.window}${r.near.stops ? ' (stops both)' : ''}` : 'no exit';
    // A kept reward has to land before the exit's map change to be any use.
    const fits = r.way === 'keep' && !(r.near && r.at < r.near.window) ? '  (lands after the window: no use)' : '';
    console.log(`${r.way}  ${String(r.ticks).padStart(3)} ticks  room ${hx(r.room)} ${script.mapName(r.room)}  ${r.trigger} $${hx(r.entry, 6)}  ${exit}`);
    console.log(`      ${r.way === 'keep' ? 'gives' : 'then '} @${r.at} ${r.gift.replace(/\s+/g, ' ').slice(0, 70)}  |  done ${r.done.replace(/\s+/g, ' ').slice(0, 60)}${fits}`);
}
