#!/usr/bin/env node
'use strict';
// Record what the game's script interpreter does, as goldens for the script VM decoder
// (src/games/evermore/script-vm, tests/script-vm/goldens.test.js).
//
// Replays movies headless on the debugger core and hooks the dispatcher twice:
//   $8C:D0A6  fetch: the script pointer (DP $82-$84) is the instruction's address
//   $8C:D0B2  after the handler: the pointer is where the game went on (the next instruction,
//             a jump target, or the same place when a call or a wait returns to it later)
// Output: [[address, [pointer after, ...]], ...] for instructions in ROM: addresses only, no ROM
// bytes (the test reads the opcodes from the user's ROM). Merged into <out> when it exists.
//
//   node tools/script-vm/record-goldens.js <rom> <out.json> <movie.evsmv>... [--frames <n>]
//   (no movie: <n> frames, default 20000, without input: the intro and the attract demo)

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseMovie, groupEvents } = require('../../dist/platform/tas/movie');

const CORE = path.join(__dirname, '../../src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
const FETCH = 0x8cd0a6, AFTER = 0x8cd0b2;
const MAX_AFTERS = 8;

function bootCore() {
    return new Promise((resolve) => {
        global.Module = { locateFile: (f) => path.join(path.dirname(CORE), f), onRuntimeInitialized: () => resolve(global.Module) };
        global.require = require; global.__dirname = path.dirname(CORE); global.__filename = CORE;
        vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });
    });
}

async function record(romPath, movies, frames, seen) {
    const M = await bootCore();
    const rom = fs.readFileSync(romPath);
    const word = (a) => M.readMemory(a) | (M.readMemory(a + 1) << 8);
    const pointer = () => word(0x7e0082) | (M.readMemory(0x7e0084) << 16);
    let at = null, count = 0;
    M.onBreakpointHit = (ev) => {
        if (ev.address === FETCH) at = pointer();
        else if (ev.address === AFTER && at !== null) {
            if ((at >> 16) >= 0x80 && (at & 0xffff) >= 0x8000) {
                let s = seen.get(at);
                if (!s) seen.set(at, s = new Set());
                if (s.size < MAX_AFTERS) s.add(pointer());
                count++;
            }
            at = null;
        }
        return false;
    };
    M.addExecBreakpoint(FETCH);
    M.addExecBreakpoint(AFTER);
    const runs = movies.length ? movies : [null];
    for (const file of runs) {
        const movie = file ? parseMovie(fs.readFileSync(file, 'utf8'), path.basename(file)) : null;
        const events = movie ? groupEvents(movie.events) : new Map();
        const p = M._my_malloc(rom.length);
        global.HEAPU8.set(rom, p);
        M._startWithRom(p, rom.length, movie ? movie.meta.audio : 32040);
        const n = movie ? movie.count : frames;
        for (let k = 0; k < n; k++) {
            for (const ev of events.get(k) || []) {
                if (ev.kind === 'W') for (let i = 0; i < ev.bytes.length; i++) M.writeMemory(ev.addr + i, ev.bytes[i]);
                else if (ev.kind === 'R') M._softReset();
            }
            M._setJoypadInput(movie ? movie.pads[k] : 0);
            M._mainLoop();
        }
        console.log(`${file ? path.basename(file) : 'no input'}: ${n} frames, ${seen.size} instructions so far`);
    }
    return count;
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const fi = args.indexOf('--frames');
    const frames = fi >= 0 ? parseInt(args.splice(fi, 2)[1], 10) : 20000;
    const [romPath, out, ...movies] = args;
    if (!romPath || !out) { console.error('usage: node tools/script-vm/record-goldens.js <rom> <out.json> <movie.evsmv>... [--frames n]'); process.exit(1); }
    const seen = new Map();
    if (fs.existsSync(out)) for (const [a, afters] of JSON.parse(fs.readFileSync(out, 'utf8'))) seen.set(a, new Set(afters));
    record(romPath, movies, frames, seen).then((count) => {
        const rows = [...seen].sort((a, b) => a[0] - b[0]).map(([a, s]) => [a, [...s].sort((x, y) => x - y)]);
        fs.writeFileSync(out, '[\n' + rows.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n');
        console.log(`${count} executions; ${rows.length} instructions in ${out}`);
        process.exit(0);
    });
}

module.exports = { record };
