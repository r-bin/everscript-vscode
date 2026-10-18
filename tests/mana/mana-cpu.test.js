'use strict';
// The 65816 interpreter and SNES bus the Secret of Mana library uses to run the
// game's own animation code (src/games/mana/decoder/cpu65816.ts, snes-bus.ts). Small programs on
// a synthetic ROM image; no ROM needed. Run: node tests/mana/mana-cpu.test.js

const assert = require('assert');
const { Cpu65816 } = require('../../dist/games/mana/decoder/cpu65816');
const { SnesBus } = require('../../dist/games/mana/decoder/snes-bus');
const mana = require('../../dist/games/mana/decoder');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message)); failed++; }
}

/** A bus whose ROM holds `code` at $C0:8000 (file offset $8000). */
function machine(code) {
    const rom = new Uint8Array(0x400000);
    rom.set(code, 0x8000);
    const bus = new SnesBus(rom);
    return { bus, cpu: new Cpu65816(bus), rom };
}

console.log('\n65816 interpreter + SNES bus:');

test('8/16-bit loads, ADC with carry, stores to WRAM, RTL ends the call', () => {
    const { bus, cpu } = machine([
        0xC2, 0x30,             // REP #$30
        0xA9, 0xFF, 0x7F,       // LDA #$7FFF
        0x18, 0x69, 0x01, 0x00, // CLC; ADC #$0001
        0x8F, 0x00, 0x20, 0x7E, // STA $7E2000
        0xE2, 0x20,             // SEP #$20
        0xA9, 0x12,             // LDA #$12
        0xEA, 0xEA, 0xEA,       // NOP x3
        0x85, 0x10,             // STA $10
        0x6B,                   // RTL
    ]);
    cpu.call(0xC08000);
    assert.strictEqual(bus.wram[0x2000] | (bus.wram[0x2001] << 8), 0x8000);
    assert.strictEqual(bus.wram[0x10], 0x12);
    assert.ok(cpu.p & 0x40, 'overflow set by $7FFF + 1');
});

test('JSR/RTS, indexed long reads, branches and loops', () => {
    const { bus, cpu, rom } = machine([
        0xE2, 0x30,             // SEP #$30
        0xA2, 0x00,             // LDX #0
        0xBF, 0x00, 0x90, 0xC0, // loop: LDA $C09000,X
        0x20, 0x20, 0x80,       // JSR $8020 (store)
        0xE8, 0xE0, 0x04,       // INX; CPX #4
        0xD0, 0xF4,             // BNE loop
        0x6B,                   // RTL
    ].concat(new Array(0x20 - 17).fill(0xEA), [
        0x9D, 0x00, 0x03,       // $8020: STA $0300,X
        0x60,                   // RTS
    ]));
    rom.set([9, 8, 7, 6], 0x9000);
    cpu.call(0xC08000);
    assert.deepStrictEqual([...bus.wram.subarray(0x300, 0x304)], [9, 8, 7, 6]);
});

test('MVN copies a block and leaves A = $FFFF', () => {
    const { bus, cpu } = machine([
        0xC2, 0x30, 0xA2, 0x00, 0x10, 0xA0, 0x00, 0x11, 0xA9, 0x03, 0x00,  // X=$1000 Y=$1100 A=3
        0x54, 0x7E, 0x7E,       // MVN $7E,$7E
        0x6B,
    ]);
    bus.wram.set([1, 2, 3, 4, 5], 0x1000);
    cpu.call(0xC08000);
    assert.deepStrictEqual([...bus.wram.subarray(0x1100, 0x1105)], [1, 2, 3, 4, 0]);
    assert.strictEqual(cpu.a, 0xFFFF);
});

test('VRAM writes and reads through the ports, multiply unit, DMA ROM -> VRAM', () => {
    const { bus, cpu, rom } = machine([
        0xE2, 0x20, 0xC2, 0x10,
        0xA9, 0x80, 0x8D, 0x15, 0x21,             // VMAIN: step after high byte
        0xA2, 0x00, 0x10, 0x8E, 0x16, 0x21,       // VMADD = $1000
        0xA9, 0x01, 0x8D, 0x70, 0x43,             // DMA7: mode 1 to $2118
        0xA9, 0x18, 0x8D, 0x71, 0x43,
        0xA2, 0x00, 0xA0, 0x8E, 0x72, 0x43, 0xA9, 0xC0, 0x8D, 0x74, 0x43,  // from $C0:A000
        0xA2, 0x04, 0x00, 0x8E, 0x75, 0x43,       // 4 bytes
        0xA9, 0x80, 0x8D, 0x0B, 0x42,             // go
        0xA9, 0x07, 0x8D, 0x02, 0x42, 0xA9, 0x06, 0x8D, 0x03, 0x42,  // 7 * 6
        0xAD, 0x16, 0x42, 0x85, 0x20,
        0x6B,
    ]);
    rom.set([0xAA, 0xBB, 0xCC, 0xDD], 0xA000);
    cpu.call(0xC08000);
    assert.deepStrictEqual([...bus.vram.subarray(0x2000, 0x2004)], [0xAA, 0xBB, 0xCC, 0xDD]);
    assert.strictEqual(bus.wram[0x20], 42);
    assert.deepStrictEqual(bus.takeDirtyChars(), [0x100]);
});

console.log('\nSecret of Mana — collision bytes ($01:BE15):');

test('floor classes, diagonals, level switch, specials', () => {
    assert.deepStrictEqual([0x10, 0x11, 0x12, 0x13, 0x15, 0x73].map(mana.floorOf), [0, 1, 2, 3, 0, 3]);
    assert.deepStrictEqual([0x14, 0x17, 0x21, 0x13, 0x00].map(mana.diagonalOf), [4, 7, 0, 0, 0]);
    assert.strictEqual(mana.switchesLevel(0x18), true);
    assert.strictEqual(mana.switchesLevel(0x10), false);
    assert.deepStrictEqual([0x80, 0x87, 0x06].map(mana.specialOf), [0x80, 0x87, 0]);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
