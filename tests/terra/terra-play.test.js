// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// A converted Terranigma room played in the Evermore engine (rooms/rendering/rom-export-own.ts): the ROM Play
// in emulator builds for Crysta (room $00A), booted in the bundled snes9x core from the default start (where
// the game's own exits arrive). The game must be in room 0x15 and draw what the editor's renderer draws
// (5-bit colours; the Boy, the dog and the HUD are masked), and the translation must hold in the engine: walking into a
// wall or a ledge stops the Boy at it, the river's palette cycle runs (docs/terra/evermore-rooms.md). Emulator tier: ~8 s.
// Run: node tests/terra/terra-play.test.js  (both ROMs from the ROM library: npm run roms)

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SOE = require('../../dist/games').romPath('evermore') || '', TERRA = require('../../dist/games').romPath('terra') || '';
const CORE = path.join(__dirname, '..', '..', 'src', 'core', 'emulator', 'core', 'snes9x2005-wasm-vanilla');
const WRAM_IN_STATE = 0x10c14;              // vanilla core save state (memory: headless boot)
const CURRENT_ROOM_ID = 0x0adb, BG2_SCROLL = 0x112;
const BOY = 0x4e89;                         // entity: +$1A x, +$1C y
const PAD = { right: 0x100, left: 0x200, down: 0x400, up: 0x800 };
let passed = 0, failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};
const done = () => { console.log(`\n${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0; };

console.log('\nTerranigma room played in Evermore:');
if (!SOE || !TERRA || !fs.existsSync(SOE) || !fs.existsSync(TERRA) || !fs.existsSync(path.join(CORE, 'snes9x_2005.js'))) {
    console.log('  skipped (needs both ROMs and the vanilla core)');
    done();
} else {
    const maps = require('../../dist/games/evermore/maps');
    const bridge = require('../../dist/games/evermore/imports/terra');
    const own = require('../../dist/games/evermore/rooms/rendering/rom-export-own');
    const soe = new Uint8Array(fs.readFileSync(SOE)), terraRom = new Uint8Array(fs.readFileSync(TERRA));
    const parts = bridge.createTerraRooms({ soeRom: () => soe, terraRom: () => terraRom }).playable(0x200a);
    const romAt = (at) => { const b = own.buildOwnRoomExportRom(soe, parts.room, at); own.verifyOwnRoomExport(b.rom, parts.shown); return b.rom; };

    const file = path.join(CORE, 'snes9x_2005.js');
    global.require = require; global.__dirname = CORE; global.__filename = file;
    global.Module = { locateFile: (p) => path.join(CORE, p), onRuntimeInitialized: run };
    vm.runInThisContext(fs.readFileSync(file, 'utf8'));

    function boot(rom, frames) {
        const p = Module._my_malloc(rom.length);
        HEAPU8.set(rom, p);
        Module._startWithRom(p, rom.length, 32040);
        for (let f = 0; f < frames; f++) { Module._setJoypadInput(0); Module._mainLoop(); }
    }
    const boyCell = () => {
        const b = Module._saveState() + WRAM_IN_STATE + BOY;
        return { x: (HEAPU8[b + 0x1a] | (HEAPU8[b + 0x1b] << 8)) >> 4, y: (HEAPU8[b + 0x1c] | (HEAPU8[b + 0x1d] << 8)) >> 4 };
    };

    function run() {
        const rom = romAt(parts.start);
        boot(rom, 1200);
        const st = Module._saveState(), W = st + WRAM_IN_STATE;
        const word = (a) => HEAPU8[W + a] | (HEAPU8[W + a + 1] << 8);
        check('the intro lands in room 0x15', HEAPU8[W + CURRENT_ROOM_ID] === 0x15, HEAPU8[W + CURRENT_ROOM_ID].toString(16));
        const sx = word(BG2_SCROLL), sy = word(BG2_SCROLL + 2) + 1;
        const sb = Module._getScreenBuffer();
        const pic = maps.renderRoomComposite(rom, maps.decodeRoom(rom, 0x15));
        let same = 0, n = 0;
        for (let y = 0; y < 176; y++) {
            for (let x = 0; x < 256; x++) {
                if (x >= 96 && x < 168 && y >= 24 && y < 136) continue;              // the Boy and the dog
                const g = sb + (y * 512 + x) * 4, e = ((sy + y) * pic.width + sx + x) * 4;
                n++;
                if ([0, 1, 2].every((c) => HEAPU8[g + c] >> 3 === pic.data[e + c] >> 3)) same++;
            }
        }
        check('the screen is drawn as the editor draws the room', n > 5000 && same / n >= 0.99, `${same}/${n} pixels`);

        // Walk up from the start until a wall: the Boy must stop on the last open cell below it.
        const w = parts.room.widthTiles, solid = (x, y) => (parts.room.cells[(y * w + x) * 3 + 2] & 0x0f) === 0x0f;
        let wallY = parts.start.y;
        while (wallY > 0 && !solid(parts.start.x, wallY - 1)) wallY--;
        boot(romAt(parts.start), 1100);
        for (let f = 0; f < 240; f++) { Module._setJoypadInput(PAD.up); Module._mainLoop(); }
        const end = boyCell();
        check(`walking up from (${parts.start.x},${parts.start.y}) stops at the wall above (${parts.start.x},${wallY - 1})`,
            end.y >= wallY && end.y < parts.start.y, JSON.stringify(end));

        // The ledge at (39,10) is crossed only in a jump in Terranigma: a wall here.
        boot(romAt({ x: 39, y: 8 }), 1100);
        for (let f = 0; f < 120; f++) { Module._setJoypadInput(PAD.down); Module._mainLoop(); }
        check('walking down onto the ledge stops above it', boyCell().y === 9, JSON.stringify(boyCell()));

        // The river (palette 7, colours 1-7, palette helper $06) turns every 6 frames with no input; the screen pointer
        // is read each time (the core swaps buffers).
        boot(romAt({ x: 38, y: 40 }), 1200);
        const grab = () => { const b = Module._getScreenBuffer(), a = []; for (let y = 0; y < 176; y++) for (let x = 0; x < 256; x++) { const g = b + (y * 512 + x) * 4; a.push(HEAPU8[g] << 16 | HEAPU8[g + 1] << 8 | HEAPU8[g + 2]); } return a; };
        const before = grab();
        for (let f = 0; f < 6; f++) { Module._setJoypadInput(0); Module._mainLoop(); }
        const after = grab(), cols = new Array(16).fill(0);
        before.forEach((v, i) => { if (v !== after[i]) cols[(i % 256) >> 4]++; });
        check('the river flows: its columns change with no input, the grass beside it does not', cols[11] > 1000 && cols[12] > 1000 && cols[2] === 0 && cols[4] === 0, cols.join(' '));
        done();
    }
}
