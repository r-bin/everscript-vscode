'use strict';
// The ROM library (src/platform/roms/library.ts): which ROM each game's panels show. Synthetic
// headers only, in a temporary library; never the user's library or a real ROM.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { registerGames } = require('../../dist/games');
const lib = require('../../dist/platform/roms/library');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
    }
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-roms-'));
lib.setLibraryDir(dir);
registerGames();

/** A HiROM file whose header names `title`; `fill` makes two files of one game differ. */
function fakeRom(name, title, fill) {
    const rom = Buffer.alloc(0x20000, fill);
    const at = 0xffc0 % rom.length;
    rom.write(title.padEnd(21, ' '), at, 'ascii');
    rom[at + 0x15] = 0x31;
    rom[at + 0x17] = 0x07;
    rom[at + 0x1c] = 0x34; rom[at + 0x1d] = 0x12; rom[at + 0x1e] = 0xcb; rom[at + 0x1f] = 0xed;
    rom[at + 0x3c] = 0x00; rom[at + 0x3d] = 0x80;
    const file = path.join(dir, name);
    fs.writeFileSync(file, rom);
    return file;
}

console.log('rom library:');

const soeA = fakeRom('soe-a.sfc', 'SECRET OF EVERMORE', 1);
const soeB = fakeRom('soe-b.sfc', 'SECRET OF EVERMORE', 2);
const som = fakeRom('som.sfc', 'Secret of MANA', 3);

test('synthetic headers identify as their games', () => {
    assert.strictEqual(lib.addRom(soeA).game, 'evermore');
    assert.strictEqual(lib.addRom(som).game, 'mana');
});

test('a game follows the selection while its ROM is selected', () => {
    lib.selectRom(soeA);
    assert.strictEqual(lib.romFor('evermore').path, soeA);
    lib.selectRom(soeB);
    assert.strictEqual(lib.romFor('evermore').path, soeB);
});

test('selecting another game keeps this game on the ROM it had, not its base', () => {
    lib.selectRom(som);
    assert.strictEqual(lib.romFor('mana').path, som);
    assert.strictEqual(lib.romFor('evermore').path, soeB);
});

test('removing the kept ROM falls back to the base (none here)', () => {
    lib.removeRom(soeB);
    assert.strictEqual(lib.romFor('evermore'), null);
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
