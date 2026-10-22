'use strict';

const assert = require('assert');
const { disassembleAt, disassembleScript, walkScriptCommands } = require('../../dist/games/evermore/maps/animation-opcodes');
const { buildSpritesTabHtml } = require('../../dist/games/evermore/sprites');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('  ✓ ' + name);
        passed++;
    } catch (e) {
        console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message));
        failed++;
    }
}

console.log('Animation Syntax & Relations Unit Tests:');

test('opcode 0x41 disassembles as step(0)', () => {
    // 0x41 is a single byte opcode with step distance 0
    const rom = new Uint8Array([0x41, 0x2d]); // 0x41 followed by loop (0x2d)
    const line = disassembleAt(rom, 0);
    assert.strictEqual(line.text, 'step(0)');
    assert.strictEqual(line.known, true);
    assert.strictEqual(line.endFrame, false);
});

test('opcode 0xC1 (0x41 with endFrame) disassembles as step(0)!', () => {
    const rom = new Uint8Array([0x41 | 0x80, 0x2d]);
    const line = disassembleAt(rom, 0);
    assert.strictEqual(line.text, 'step(0)!');
    assert.strictEqual(line.endFrame, true);
});

test('sprite commands format with virtual index #<idx> when resolver is provided', () => {
    // 0x22 is sprite command with 2-byte operand in bank $ca
    const rom = new Uint8Array([0x22, 0x03, 0x00, 0x2d]); // sprite $ca0003
    const options = {
        spriteIndex: (r, addr) => (addr === 0xca0003 ? 42 : -1),
    };
    const line = disassembleAt(rom, 0, options);
    assert.strictEqual(line.text, 'sprite(#42)');
});

test('sprite commands fallback to $hex when resolver returns -1', () => {
    const rom = new Uint8Array([0x22, 0x03, 0x00, 0x2d]);
    const options = {
        spriteIndex: () => -1,
    };
    const line = disassembleAt(rom, 0, options);
    assert.strictEqual(line.text, 'sprite($ca0003)');
});

test('palette command 0x4B formats with #<idx> when resolver is provided', () => {
    // 0x4b is palette command with 2-byte operand
    const rom = new Uint8Array([0x4b, 0x6b, 0xb8, 0x2d]); // palette $b86b
    const options = {
        paletteIndex: (r, addr) => (addr === 0xb86b ? 0 : -1),
    };
    const line = disassembleAt(rom, 0, options);
    assert.strictEqual(line.text, 'palette(#0)');
});

test('walkScriptCommands visits reachable opcodes without allocating lines', () => {
    const rom = new Uint8Array([0x41, 0x41 | 0x80, 0x2d]);
    const visited = [];
    walkScriptCommands(rom, 0, (addr, raw) => {
        visited.push({ addr, raw });
    });
    assert.strictEqual(visited.length, 3);
    assert.strictEqual(visited[0].raw, 0x41);
    assert.strictEqual(visited[1].raw, 0xc1);
    assert.strictEqual(visited[2].raw, 0x2d);
});

test('buildSpritesTabHtml includes candidate palettes container and rich tooltip', () => {
    const html = buildSpritesTabHtml();
    assert(html.includes('id="sp-candidate-list"'), 'Contains candidate palettes container');
    assert(html.includes('id="sp-rich-tooltip"'), 'Contains rich tooltip element');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
