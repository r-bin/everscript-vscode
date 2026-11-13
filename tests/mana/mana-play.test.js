// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// A converted Secret of Mana map played in the Evermore engine (rooms/rendering/rom-export-own.ts):
// the ROM Play in emulator builds for Potos Falls 1, booted in the bundled snes9x core. The game
// must be in room 0x15 and draw every cell nothing animates exactly as the editor's renderer does
// (5-bit colours; the Boy, the dog and the HUD are masked). Emulator tier: ~20 s.
// Run: node tests/mana/mana-play.test.js  (both ROMs from the ROM library: npm run roms)

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOE = require('../../dist/games').romPath('evermore') || '', SOM = require('../../dist/games').romPath('mana') || '';
const CORE = path.join(__dirname, '..', '..', 'src', 'core', 'emulator', 'core', 'snes9x2005-wasm-vanilla');
const WRAM_IN_STATE = 0x10c14;              // vanilla core save state (memory: headless boot)
const CURRENT_ROOM_ID = 0x0adb, BG2_SCROLL = 0x112;
let passed = 0, failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};
const done = () => { console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0); };

console.log('\nSecret of Mana map played in Evermore:');
if (!SOE || !SOM || !fs.existsSync(SOE) || !fs.existsSync(SOM) || !fs.existsSync(path.join(CORE, 'snes9x_2005.js'))) {
    console.log('  skipped (needs both ROMs and the vanilla core)');
    done();
}

const maps = require('../../dist/games/evermore/maps');
const bridge = require('../../dist/games/evermore/imports/mana');
const own = require('../../dist/games/evermore/rooms/rendering/rom-export-own');
const soe = new Uint8Array(fs.readFileSync(SOE)), som = new Uint8Array(fs.readFileSync(SOM));
const parts = bridge.createManaRooms({ soeRom: () => soe, manaRom: () => som }).playable(0x1080);
const { rom } = own.buildOwnRoomExportRom(soe, parts.room, parts.start);
own.verifyOwnRoomExport(rom, parts.shown);

const file = path.join(CORE, 'snes9x_2005.js');
global.require = require; global.__dirname = CORE; global.__filename = file;
global.Module = { locateFile: (p) => path.join(CORE, p), onRuntimeInitialized: run };
vm.runInThisContext(fs.readFileSync(file, 'utf8'));

function run() {
    const p = Module._my_malloc(rom.length);
    HEAPU8.set(rom, p);
    Module._startWithRom(p, rom.length, 32040);
    for (let f = 0; f < 1200; f++) { Module._setJoypadInput(0); Module._mainLoop(); }
    const st = Module._saveState(), W = st + WRAM_IN_STATE;
    const word = (a) => HEAPU8[W + a] | (HEAPU8[W + a + 1] << 8);
    check('the intro lands in room 0x15', HEAPU8[W + CURRENT_ROOM_ID] === 0x15, HEAPU8[W + CURRENT_ROOM_ID].toString(16));
    const sx = word(BG2_SCROLL), sy = word(BG2_SCROLL + 2) + 1;
    const sb = Module._getScreenBuffer();
    const room = maps.decodeRoom(rom, 0x15), pic = maps.renderRoomComposite(rom, room);
    const moving = new Set();
    for (const g of maps.buildAnimationGroups(rom, room, {})) for (let y = g.y; y < g.y + g.h; y++) for (let x = g.x; x < g.x + g.w; x++) moving.add(x + ',' + y);
    let same = 0, n = 0;
    for (let y = 0; y < 176; y++) {
        for (let x = 0; x < 256; x++) {
            if (x >= 96 && x < 168 && y >= 24 && y < 136) continue;              // the Boy and the dog
            if (moving.has(((sx + x) >> 4) + ',' + ((sy + y) >> 4))) continue;
            const g = sb + (y * 512 + x) * 4, e = ((sy + y) * pic.width + sx + x) * 4;
            n++;
            if ([0, 1, 2].every((c) => HEAPU8[g + c] >> 3 === pic.data[e + c] >> 3)) same++;
        }
    }
    check('every still cell on screen is drawn as the editor draws it', n > 5000 && same === n, `${same}/${n} pixels`);
    done();
}
