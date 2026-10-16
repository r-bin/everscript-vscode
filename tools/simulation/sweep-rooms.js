#!/usr/bin/env node
'use strict';
// Analyse every room with the simulation, one process per room (a room that runs
// away cannot take the others down), and print time, scenarios and what was capped.
//
//   node tools/simulation/sweep-rooms.js [rom] [seconds-per-room]
//
// Writes nothing. Useful after changing src/simulation: compare totals before/after.

const path = require('path');
const { spawnSync } = require('child_process');

const ROM = require('../rom').romOrExit('evermore', process.argv[2]);
const LIMIT = (+process.argv[3] || 60) * 1000;

if (process.argv[2] === '--room') {
    const fs = require('fs');
    const sim = require('../../src/simulation');
    const S = sim.createSimulator(new Uint8Array(fs.readFileSync(process.argv[4])));
    const t = Date.now();
    const r = S.room(parseInt(process.argv[3], 16));
    console.log(JSON.stringify({ ms: Date.now() - t, scenarios: r.scenarios.length, capped: r.capped,
        triggers: r.triggers.length, triggersCapped: r.triggers.filter((x) => x.analysis.capped).length }));
    process.exit(0);
}

let total = 0, clean = 0, failed = 0;
for (let id = 0; id < 0x7f; id++) {
    const hex = id.toString(16).padStart(2, '0');
    const res = spawnSync(process.execPath, ['--max-old-space-size=3000', __filename, '--room', hex, ROM], { timeout: LIMIT, encoding: 'utf8' });
    const line = (res.stdout || '').trim().split('\n').pop();
    let r = null;
    try { r = JSON.parse(line); } catch { /* crashed or timed out */ }
    if (!r) { failed++; console.log(`${hex}  FAILED (${res.signal ? 'timeout' : 'crash'})`); continue; }
    total += r.ms;
    if (!r.capped && !r.triggersCapped) clean++;
    console.log(`${hex}  ${String(r.ms).padStart(6)} ms  ${String(r.scenarios).padStart(4)} scenarios  ` +
        `${r.capped ? 'enter capped  ' : '              '}${r.triggersCapped ? `${r.triggersCapped}/${r.triggers} triggers capped` : ''}`);
}
console.log(`\n${clean} rooms fully explored, ${0x7f - clean - failed} with a cap, ${failed} failed; ${(total / 1000).toFixed(0)} s`);
