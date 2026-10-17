// Check a Secret of Mana map picture against the running game (docs/mana/verifying.md).
//   node tools/mana/check-map.js <map id, decimal> [outdir]   (the Mana ROM of the ROM library)
// Plays the opening headless on the extension's emulator core up to the fall from
// the log bridge, makes the map loader at $00:C481 read the
// given id from $DC instead, runs 200 frames, then finds the game's screen inside
// src/games/mana/decoder's render of that map and prints how many pixels agree. Sprites,
// animated characters and palette cycling account for the rest.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const mana = require('../../src/games/mana/decoder');
const { encodePng } = require('../../dist/platform');

const romPath = require('../rom').romOrExit('mana');
const id = Number(process.argv[2]);
const outDir = process.argv[3] || '.';
if (!romPath || !Number.isInteger(id)) {
    console.error('usage: node tools/mana/check-map.js <map id> [outdir]');
    process.exit(2);
}
const CORE = path.join(__dirname, '../../src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
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
    let forced = false;
    M.onBreakpointHit = () => {
        if (!forced) { M.writeMemory(0x7E00DC, id & 0xFF); M.writeMemory(0x7E00DD, id >> 8); forced = true; }
        return false;
    };
    // Title, new game, default name, the intro, then the log-bridge dialogue. The
    // next map load (the fall to the waterfall) is the one that reads the swapped id.
    wait(300);
    for (let i = 0; i < 8; i++) { press(START); wait(30); press(A); wait(30); }
    for (let i = 0; i < 68; i++) { press(START); wait(40); press(B); wait(40); }
    M.addExecBreakpoint(0x00C481); M.addExecBreakpoint(0xC0C481);
    wait(200);
    if (!forced) { console.error('the map loader never ran'); process.exit(1); }

    const sb = M._getScreenBuffer();     // 512x448, the 256x224 picture doubled
    const shot = new Uint8Array(256 * 224 * 4);
    for (let y = 0; y < 224; y++) for (let x = 0; x < 256; x++) {
        for (let k = 0; k < 3; k++) shot[(y * 256 + x) * 4 + k] = HEAPU8[sb + ((y * 2) * 512 + x * 2) * 4 + k];
        shot[(y * 256 + x) * 4 + 3] = 255;
    }
    const map = mana.loadMap(new Uint8Array(rom), id);
    if (!map) { console.error(`map ${id} has no pieces`); process.exit(1); }
    const img = mana.renderMap(map);
    const q = (d, i) => (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3);
    let best = [-1, 0, 0];
    for (let oy = 0; oy + 224 <= img.height; oy++) for (let ox = 0; ox + 256 <= img.width; ox++) {
        let s = 0;
        for (let k = 0; k < 300; k++) {
            const x = (k * 37) % 256, y = (k * 53) % 224;
            if (q(img.rgba, ((oy + y) * img.width + ox + x) * 4) === q(shot, (y * 256 + x) * 4)) s++;
        }
        if (s > best[0]) best = [s, ox, oy];
    }
    const [, ox, oy] = best;
    let same = 0;
    for (let y = 0; y < 224; y++) for (let x = 0; x < 256; x++) {
        if (q(img.rgba, ((oy + y) * img.width + ox + x) * 4) === q(shot, (y * 256 + x) * 4)) same++;
    }
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `game-${id}.png`), encodePng(256, 224, shot));
    fs.writeFileSync(path.join(outDir, `render-${id}.png`), encodePng(img.width, img.height, img.rgba));
    console.log(`map ${id}: screen found at ${ox},${oy} in the render; ${(100 * same / (256 * 224)).toFixed(1)}% of pixels agree`);
    process.exit(0);
}
