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

test('mode prints its bits by name, unread bits as hex (docs/entities/animation_script.md § mode)', () => {
    const text = (v) => disassembleAt(new Uint8Array([0x4d, v & 0xff, v >> 8, 0x2d]), 0).text;
    assert.strictEqual(text(0x4004), 'mode(walk | contact)');
    assert.strictEqual(text(0x0810), 'mode(attack | $0800)');
    assert.strictEqual(text(0x0120), 'mode(invulnerable | cast)');
    assert.strictEqual(text(0), 'mode(0)');
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

test('buildSpritesTabHtml includes palette filter group (Default/All) and rich tooltip', () => {
    const html = buildSpritesTabHtml();
    assert(html.includes('id="sp-pal-filter-group"'), 'Contains palette filter group');
    assert(html.includes('id="sp-btn-pal-default"'), 'Contains default palette filter button');
    assert(html.includes('id="sp-btn-pal-all"'), 'Contains all palette filter button');
    assert(html.includes('id="sp-rich-tooltip"'), 'Contains rich tooltip element');
});

test('roughColorName classifies colors accurately', () => {
    const { roughColorName } = require('../../dist/games/evermore/resources/palette-files');
    assert.strictEqual(roughColorName('#000000', 0), 'Transparent');
    assert.strictEqual(roughColorName('#000000', 1), 'Black');
    assert.strictEqual(roughColorName('#ffffff', 1), 'White');
    assert.strictEqual(roughColorName('#808080', 1), 'Gray');
    assert.strictEqual(roughColorName('#ff0000', 1), 'Red');
    assert.strictEqual(roughColorName('#00ff00', 1), 'Green');
    assert.strictEqual(roughColorName('#0000ff', 1), 'Blue');
    assert.strictEqual(roughColorName('#8b4513', 1), 'Brown');
});

test('resolvePalettes uses pseudo indices as folder names and formats tables', () => {
    const { resolvePalettes } = require('../../dist/games/evermore/resources/palette-files');
    const { assetRelations } = require('../../dist/games/evermore/sprites/asset-relations');
    const mockRom = new Uint8Array(0x300000);
    // Seed at least one palette in relations
    const relations = assetRelations(mockRom);
    relations.palettes.set(0xa84b, {
        address: 0xa84b,
        addrHex: '$a84b',
        index: 0,
        colors: ['#000000', '#ffffff', '#8b4513'],
        characters: [{ id: 0, name: 'Boy', role: 'primary' }],
        animations: [{ record: 0x10, label: 'Boy Idle', scriptHex: '$901234', uri: 'soe://rom/assets/characters/0/animations/idle/' }],
        sprites: [{ address: 0x120000, addrHex: '$120000', index: 5 }],
        tags: ['BOY'],
    });

    const rootNode = resolvePalettes([], mockRom);
    assert(rootNode && rootNode.kind === 'dir', 'Root node is dir');
    assert(rootNode.entries.every(([name]) => /^\d+$/.test(name)), 'All entries are pseudo index numbers');
    assert.strictEqual(rootNode.entries[0][0], '0');

    // Check root index.md table format
    const rootMd = rootNode.index();
    assert(rootMd.includes('| Index | Address | Characters |'), 'Root markdown has table headers');
    assert(rootMd.includes('|:---|:---|:---|'), 'Root markdown has table alignment');
    assert(rootMd.includes('[#0](soe://rom/assets/palettes/0/)'), 'Links to pseudo index VFS path');
    assert(rootMd.includes('[Boy](soe://rom/assets/characters/0/)'), 'Links to character');

    // Check palette dir uses index and has no redundant info.md
    const pal0 = resolvePalettes(['0'], mockRom);
    assert(pal0 && pal0.kind === 'dir', 'Palette 0 resolved');
    assert(!pal0.entries.some(([name]) => name === 'info.md'), 'info.md is not in entries');
    assert(pal0.entries.some(([name]) => name === 'palette.json'), 'palette.json is present');

    // Check palette 0 markdown has Colors table
    const pal0Md = pal0.index();
    assert(pal0Md.includes('# Palette #0 ($a84b)'), 'Header has pseudo index');
    assert(pal0Md.includes('| Index | Hex | Color Name |'), 'Palette markdown has Colors table');
    assert(pal0Md.includes('| 0 | `#000000` | Transparent |'), 'Index 0 is Transparent');
    assert(pal0Md.includes('[Boy Idle](soe://rom/assets/characters/0/animations/idle/)'), 'Animations have markdown links');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

