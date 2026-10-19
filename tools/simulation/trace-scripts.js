#!/usr/bin/env node
// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Record what the real game's script scheduler does, tick by tick, so the
// simulation can be checked against it (tests/simulation/scheduler.test.js).
//
// Boots the ROM headless in the debugger core and hooks three addresses:
//   $8E:E446  the field tick incrementing the 32-bit timer $0B19 (one tick)
//   $8C:D0A6  the dispatcher fetching one script instruction
//   $8C:D0B2  the dispatcher after the handler: carry clear = the thread's turn is over
//   $80:859B  the random number generator: counted per instruction, and outside scripts per tick
// Output (JSON): { ticks: [{ timer, engineRng, rng: [4 words at tick start], ops: [[slot, pc, opcode, continued, rngCalls], ...] }], snapshots }
//
//   node tools/simulation/trace-scripts.js <rom> <frames> <out.json> [--wram-at=<tick>]
//
// Needs the built debugger core (src/core/emulator/core/snes9x2005-wasm). Writes only <out.json>.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CORE_DIR = path.join(__dirname, '..', '..', 'src', 'core', 'emulator', 'core', 'snes9x2005-wasm');
const TICK = 0x8ee446, FETCH = 0x8cd0a6, AFTER = 0x8cd0b2, RNG = 0x80859b;

function bootCore() {
    return new Promise((resolve) => {
        const file = path.join(CORE_DIR, 'snes9x_2005.js');
        global.require = require;
        global.__dirname = CORE_DIR;
        global.__filename = file;
        global.Module = { locateFile: (f) => path.join(CORE_DIR, f), onRuntimeInitialized() { resolve(global.Module); } };
        vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
    });
}

/**
 * Run `frames` frames of `romPath` and return the trace. `wramAtTicks` lists
 * tick indices at whose start a full WRAM copy and the run list are kept.
 */
async function traceScripts(romPath, frames, wramAtTicks = []) {
    const m = await bootCore();
    const rom = fs.readFileSync(romPath);
    const ptr = m._my_malloc(rom.length);
    global.HEAPU8.set(rom, ptr);
    m._startWithRom(ptr, rom.length, 32040);
    const word = (a) => m.readMemory(a) | (m.readMemory(a + 1) << 8);
    const ticks = [];
    const snapshots = {};
    let cur = null;
    let inOp = false;
    m.onBreakpointHit = (ev) => {
        if (ev.address === TICK) {
            cur = { timer: (word(0x7e0b19) + 1) & 0xffff, engineRng: 0, rng: [0, 2, 4, 6].map((o) => word(0x7e0133 + o)), ops: [] };
            ticks.push(cur);
            if (wramAtTicks.includes(ticks.length - 1)) {
                const list = [];
                for (let x = 0; ; x += 2) { const s = word(0x7e2f28 + x); if (!s) break; list.push(s); }
                const slots = {};
                for (const s of list) slots[s] = Array.from(m.readMemoryRange(0x7e0000 + s, 0x10));
                snapshots[ticks.length - 1] = { list, slots, wram: Buffer.from(readWram(m)).toString('base64') };
            }
        } else if (cur && ev.address === FETCH) {
            const pc = word(0x7e0082) | (m.readMemory(0x7e0084) << 16);
            cur.ops.push([word(0x7e007e), pc, m.readMemory(pc), 1, 0]);
            inOp = true;
        } else if (cur && ev.address === AFTER && cur.ops.length) {
            cur.ops[cur.ops.length - 1][3] = m.getCPUState().p & 1;
            inOp = false;
        } else if (cur && ev.address === RNG) {
            if (inOp && cur.ops.length) cur.ops[cur.ops.length - 1][4]++; else cur.engineRng++;
        }
        return false;
    };
    for (const a of [TICK, FETCH, AFTER, RNG]) m.addExecBreakpoint(a);
    for (let f = 0; f < frames; f++) { m._setJoypadInput(0); m._mainLoop(); }
    return { ticks, snapshots };
}

function readWram(m) {
    const out = new Uint8Array(0x20000);
    for (let a = 0; a < 0x20000; a += 4096) out.set(m.readMemoryRange(0x7e0000 + a, 4096), a);
    return out;
}

module.exports = { traceScripts };

if (require.main === module) {
    const [romPath, frames, out, ...rest] = process.argv.slice(2);
    const at = rest.filter((x) => x.startsWith('--wram-at=')).map((x) => +x.slice(10));
    traceScripts(romPath, +frames, at).then((t) => {
        fs.writeFileSync(out, JSON.stringify(t));
        console.log(`${t.ticks.length} ticks, ${t.ticks.reduce((n, k) => n + k.ops.length, 0)} script instructions -> ${out}`);
    });
}
