// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// A converted Secret of Mana map played in the Evermore engine (rooms/rendering/rom-export-own.ts):
// the ROM Play in emulator builds for Potos Falls 1, booted in the bundled snes9x core. The game
// must be in room 0x15 and draw every cell nothing animates exactly as the editor's renderer does
// (5-bit colours; the Boy, the dog and the HUD are masked); and the collision translation works in
// the engine: the bridge is crossed on plane 1 from its stairs, the river's current carries the
// Boy (docs/mana/evermore-rooms.md). Emulator tier: ~5 s.
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
const romAt = (x, y) => { const b = own.buildOwnRoomExportRom(soe, parts.room, { x, y }); own.verifyOwnRoomExport(b.rom, parts.shown); return b.rom; };
const rom = romAt(28, 39);
const PAD = { right: 0x100, none: 0 };
const BOY = 0x4e89;                         // entity: +$1A x, +$1C y, +$18 plane (bits 4-5)

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

    // Boot `r` (power-on), hold `pad` for `frames`, and list the Boy's cell and plane every 8 frames.
    const walk = (r, pad, frames) => {
        const q = Module._my_malloc(r.length);
        HEAPU8.set(r, q);
        Module._startWithRom(q, r.length, 32040);
        for (let f = 0; f < 1100; f++) { Module._setJoypadInput(0); Module._mainLoop(); }
        const out = [];
        for (let f = 0; f < frames; f++) {
            Module._setJoypadInput(pad); Module._mainLoop();
            if (f % 8) continue;
            const s = Module._saveState(), b = s + WRAM_IN_STATE + BOY;
            out.push({ x: (HEAPU8[b + 0x1a] | (HEAPU8[b + 0x1b] << 8)) >> 4, y: (HEAPU8[b + 0x1c] | (HEAPU8[b + 0x1d] << 8)) >> 4, plane: (HEAPU8[b + 0x18] >> 4) & 3 });
        }
        return out;
    };
    const cross = walk(romAt(26, 68), PAD.right, 200);
    const deck = cross.filter((p) => p.x >= 30 && p.x <= 33);
    const end = cross[cross.length - 1];
    check('up the bridge stairs and across the deck on plane 1, down onto plane 2 beyond', deck.length > 2 && deck.every((p) => p.plane === 1)
        && end.x >= 38 && end.plane === 2, JSON.stringify(cross.map((p) => [p.x, p.y, p.plane])));
    const drift = walk(romAt(28, 33), PAD.none, 8);
    check('the river\'s current carries the Boy downstream with no input', drift[0].y >= 38, JSON.stringify(drift[0]));
    done();
}
