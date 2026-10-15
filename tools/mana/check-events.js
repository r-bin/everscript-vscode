// Check which event the running game runs for each step-event cell of a map
// (docs/mana/README.md "Step events").
//   EVERSCRIPT_MANA_ROM=<rom> node tools/mana/check-events.js <map id, hex>
// Plays the opening headless like check-map.js, makes the map loader at $00:C481 load
// the given map, then for each cell src/mana's mapEvents lists: restores the state,
// puts that cell's value under the first character ($7E:E04B/E04C, as $00:D682 does),
// clears $D0 (non-zero after a forced load, which makes $00:B630 return), runs 3 frames
// and records what the event runner $01:E76D was called with.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const mana = require('../../src/mana');

const romPath = process.env.EVERSCRIPT_MANA_ROM;
const id = parseInt(process.argv[2], 16);
if (!romPath || !Number.isInteger(id)) {
    console.error('usage: EVERSCRIPT_MANA_ROM=<rom> node tools/mana/check-events.js <map id, hex>');
    process.exit(2);
}
const CORE = path.join(__dirname, '../../src/emulator/core/snes9x2005-wasm/snes9x_2005.js');
const START = 0x1000, A = 0x80, B = 0x8000;

global.Module = { locateFile: f => path.join(path.dirname(CORE), f), onRuntimeInitialized: main };
global.require = require; global.__dirname = path.dirname(CORE); global.__filename = CORE;
vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });

function main() {
    const M = Module;
    const rom = fs.readFileSync(romPath);
    const p = M._my_malloc(rom.length); HEAPU8.set(rom, p);
    M._startWithRom(p, rom.length, 32040);
    const step = pad => { M._setJoypadInput(pad); M._mainLoop(); };
    const press = pad => { step(pad); step(pad); step(0); };
    const wait = n => { for (let i = 0; i < n; i++) step(0); };
    let forced = false, events = [];
    M.onBreakpointHit = h => {
        if ((h.address & 0xFFFF) === 0xC481) {
            if (!forced) { M.writeMemory(0x7E00DC, id & 0xFF); M.writeMemory(0x7E00DD, id >> 8); forced = true; }
        } else events.push(M.getCPUState().a & 0x0FFF);
        return false;
    };
    wait(300);
    for (let i = 0; i < 8; i++) { press(START); wait(30); press(A); wait(30); }
    for (let i = 0; i < 68; i++) { press(START); wait(40); press(B); wait(40); }
    M.addExecBreakpoint(0x00C481); M.addExecBreakpoint(0xC0C481);
    wait(300);
    M.removeExecBreakpoint(0x00C481); M.removeExecBreakpoint(0xC0C481);
    if (!forced) { console.error('the map loader never ran'); process.exit(1); }

    const map = mana.loadMap(new Uint8Array(rom), id);
    const expected = mana.mapEvents(new Uint8Array(rom), map);
    const size = M._getStateSaveSize(), at = M._saveState(), snap = HEAPU8.slice(at, at + size);
    M.addExecBreakpoint(0x01E76D); M.addExecBreakpoint(0xC1E76D);
    let same = 0;
    for (const s of expected.steps) {
        const q = M._my_malloc(size); HEAPU8.set(snap, q); M._loadState(q, size); M._my_free(q);
        const value = M.readMemory(0x7F0000 + s.y * 128 + s.x);      // the cell as the game holds it
        events = [];
        M.writeMemory(0x7EE04B, value); M.writeMemory(0x7EE04C, value); M.writeMemory(0x7E00D0, 0);
        wait(3);
        const ok = events[0] === s.event;
        if (ok) same++;
        console.log(`${s.x},${s.y} cell ${value.toString(16)}: expected ${s.event.toString(16)}, game ran ${events.map(e => e.toString(16)).join(' ') || 'nothing'}${ok ? '' : '  <-- differs'}`);
    }
    console.log(`map ${id.toString(16)}: ${same} of ${expected.steps.length} step cells run the expected event`);
    process.exit(same === expected.steps.length ? 0 : 1);
}
