'use strict';
// The script scheduler, checked against the real game.
//
// tools/simulation/trace-scripts.js runs the ROM headless in the debugger
// core and records every script instruction the game executes: which tick,
// which slot, which address. From several recorded moments (full WRAM + run
// list) the simulation is started and run forward; given the two things the
// engine decides and scripts cannot know — how long each 0x2e wait took, and
// the RNG state at the start of each tick (the engine draws from it too) — it
// must execute exactly the same instructions on exactly the same ticks in
// exactly the same slots. That covers run-list order, scripts started with
// 0x07 joining the same pass, calls and returns costing no tick, YIELD, SLEEP
// n → max(1, n-1), map changes ending every thread, and the RNG.
//
// Skips without the ROM or the built debugger core.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sim = require('../../src/simulation');

const ROM = process.env.EVERSCRIPT_ROM ||
    path.join(__dirname, '..', '..', '..', 'everscript', 'Secret of Evermore (U) [!].smc');
const CORE = path.join(__dirname, '..', '..', 'src', 'emulator', 'core', 'snes9x2005-wasm', 'snes9x_2005.wasm');
if (!fs.existsSync(ROM) || !fs.existsSync(CORE)) { console.log('SKIP simulation scheduler: needs the ROM and the debugger core'); process.exit(0); }
const { traceScripts } = require('../../tools/simulation/trace-scripts');

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

// Moments in the intro (no input): single-thread scenes, two-thread scenes
// with random draws, a script started mid-pass, scenes ending in a map change.
const MOMENTS = [1129, 2380, 4810, 6280, 7520];

(async () => {
    const rom = new Uint8Array(fs.readFileSync(ROM));
    const trace = await traceScripts(ROM, 10500, MOMENTS);
    const S = sim.createSimulator(rom);
    const nextRun = (slot, from) => { for (let j = from; j < trace.ticks.length; j++) if (trace.ticks[j].ops.some((o) => o[0] === slot)) return j; return undefined; };

    await test('the trace sees the scheduler: one timer step per tick, turns ended only by the known opcodes', () => {
        const enders = new Set();
        trace.ticks.forEach((k, i) => {
            if (i && ((k.timer - trace.ticks[i - 1].timer) & 0xffff) !== 1 && k.timer !== 1) throw new Error(`timer jump at tick ${i}`);
            for (const o of k.ops) if (!o[3]) enders.add(o[2]);
        });
        const known = new Set([0x00, 0x22, 0x29, 0x2e, 0x38, 0x39, 0x3a, 0x3b, 0xa3, 0xa5, 0xa6, 0xa7, 0xa8, 0xaf, 0xb0, 0xb1, 0xb2, 0xb3]);
        assert.deepStrictEqual([...enders].filter((x) => !known.has(x)).map((x) => x.toString(16)), []);
    });

    let total = 0;
    for (const T0 of MOMENTS) {
        await test(`from tick ${T0}: every simulated instruction is the game's, on the same tick, in the same slot`, () => {
            const wram = new Uint8Array(Buffer.from(trace.snapshots[T0].wram, 'base64'));
            const start = sim.pathFromMoment({ wram, resumeAt: (slot) => { const j = nextRun(slot, T0); return j === undefined ? undefined : j - T0; } });
            const r = S.run(0, {
                start, log: true, maxTicks: 3000, maxPaths: 4,
                rngAtTick: (k) => trace.ticks[T0 + k] && trace.ticks[T0 + k].rng,
                engineWait: (slot, pc, k) => { const j = nextRun(slot, T0 + k + 1); return j === undefined ? undefined : j - (T0 + k); },
            });
            assert.strictEqual(r.paths.length, 1, 'fully determined: one path');
            const real = [];
            for (let k = T0; k < trace.ticks.length; k++) for (const o of trace.ticks[k].ops) real.push([k - T0, o[0], o[1]]);
            const log = r.paths[0].log;
            const f = (x) => x ? `tick ${x[0]} slot ${x[1].toString(16)} $${x[2].toString(16)}` : '-';
            for (let n = 0; n < log.length; n++) {
                const a = real[n], b = log[n];
                if (!a || a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) throw new Error(`instruction ${n}: game ${f(a)}, simulation ${f(b)}`);
            }
            assert.ok(log.length >= 40, `only ${log.length} instructions compared`);
            total += log.length;
        });
    }
    console.log(`    ${total} instructions replayed exactly`);

    console.log(`\nsimulation scheduler: ${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
