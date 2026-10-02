'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    readCharacter,
    readAllCharacters,
    CHARACTER_COUNT,
    CHARACTER_TABLE,
    renderAnimation,
    getRawSpriteIndex,
    renderRawSprite,
    buildSpritesTabHtml,
} = require('../../src/sprites');

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

console.log('Sprites Subsystem Tests:');

// Resolve test ROM
const romPath = path.join(__dirname, '..', '..', 'script_parser', 'dependencies', 'Secret of Evermore (U) [!].smc');
const hasRom = fs.existsSync(romPath);
const rom = hasRom ? fs.readFileSync(romPath) : null;

test('CHARACTER_COUNT and table constant are defined', () => {
    assert.strictEqual(CHARACTER_COUNT, 142);
    assert.strictEqual(CHARACTER_TABLE, 0x8eb678);
});

test('buildSpritesTabHtml produces expected DOM containers', () => {
    const html = buildSpritesTabHtml();
    assert(typeof html === 'string');
    assert(html.includes('data-tab="sprites"'));
    assert(html.includes('id="sp-canvas"'));
    assert(html.includes('id="sp-raw-canvas"'));
    assert(html.includes('id="sp-list"'));
    assert(html.includes('id="sp-stats-grid"'));
    assert(html.includes('id="sp-chunks-table"'));
    assert(html.includes('id="sp-anim-sel"'));
    assert(html.includes('id="sp-btn-play"'));
    assert(html.includes('id="sp-chk-body"'));
    assert(html.includes('id="sp-chk-hurt"'));
    assert(html.includes('id="sp-chk-strike"'));
});

if (!rom) {
    console.warn('  [SKIP] ROM-dependent tests skipped because test ROM not found at ' + romPath);
} else {
    test('readCharacter reads Boy (#0) and Dog (#1) with accurate stats and hitboxes', () => {
        const boy = readCharacter(rom, 0);
        assert.strictEqual(boy.id, 0);
        assert.strictEqual(boy.name, '<Boy Name>');
        assert.strictEqual(boy.stats.hp, 30);
        assert.strictEqual(boy.stats.attack, 0);
        assert.strictEqual(boy.stats.radius, 8);
        assert.strictEqual(boy.hitbox.width, 16);
        assert.strictEqual(boy.hitbox.height, 8);
        assert.strictEqual(boy.hurtbox.width, 16);
        assert.strictEqual(boy.hurtbox.height, 16);
        assert(boy.anims.length > 5);
        assert(boy.statMeanings.hp && boy.statMeanings.radius);

        const dog = readCharacter(rom, 1);
        assert.strictEqual(dog.id, 1);
        assert.strictEqual(dog.name, '<Dog Name>');
        assert.strictEqual(dog.stats.hp, 36);
        assert.strictEqual(dog.stats.radius, 16);
        assert.strictEqual(dog.hitbox.width, 32);
        assert.strictEqual(dog.hitbox.height, 16);
        assert.strictEqual(dog.hurtbox.width, 32);
        assert.strictEqual(dog.hurtbox.height, 32);
    });

    test('readAllCharacters reads all 142 characters including Magmar and Carltron Robot', () => {
        const all = readAllCharacters(rom);
        assert.strictEqual(all.length, 142);
        
        const magmar = all[140];
        assert.strictEqual(magmar.id, 140);
        assert.strictEqual(magmar.name, 'Magmar');
        assert(magmar.stats.hp > 0);
        const magmarEnter = magmar.anims.find(a => a.key === 'MAGMAR_ENTER');
        assert(magmarEnter, 'Magmar should have MAGMAR_ENTER external animation');
        assert.strictEqual(magmarEnter.category, 'external');
        assert.strictEqual(magmarEnter.num, 0x00ae);

        const robot = all[141];
        assert.strictEqual(robot.id, 141);
    });

    test('renderAnimation renders standard Boy stand animation', () => {
        const anim = renderAnimation(rom, 0, { key: 'stand', offset: 0x32 }, 8);
        assert(anim, 'Animation render returned null');
        assert(anim.frames.length >= 1);
        assert(anim.width > 0);
        assert(anim.height > 0);
        assert(anim.originX >= 0);
        assert(anim.originY >= 0);
        assert(anim.frames[0].png.startsWith('data:image/png;base64,'));
        assert(anim.frames[0].chunks.length > 0);
    });

    test('renderAnimation renders external Magmar enter animation (22 frames, opcode 0x78)', () => {
        const magmar = readCharacter(rom, 140);
        const ext = magmar.anims.find(a => a.key === 'MAGMAR_ENTER');
        assert(ext);
        const anim = renderAnimation(rom, 140, ext, 8);
        assert(anim, 'Magmar enter animation failed to decode');
        assert.strictEqual(anim.frames.length, 22, 'Magmar enter should decode 22 frames');
        assert(anim.width > 0);
        assert(anim.height > 0);
        assert(anim.frames[0].png.startsWith('data:image/png;base64,'));
    });

    test('getRawSpriteIndex indexes raw sprites starting at $CA0003', () => {
        const index = getRawSpriteIndex(rom);
        assert(Array.isArray(index));
        assert(index.length > 100);
        assert.strictEqual(index[0].address, 0xca0003);
        assert(index[0].width > 0);
        assert(index[0].height > 0);
        assert(index[0].chunkCount > 0);
    });

    test('renderRawSprite decodes individual raw sprite with custom palette', () => {
        const sprite = renderRawSprite(rom, 0xca0003, 0x90b00b);
        assert(sprite, 'Raw sprite rendering failed');
        assert.strictEqual(sprite.address, 0xca0003);
        assert(sprite.png.startsWith('data:image/png;base64,'));
        assert(sprite.chunks.length > 0);
        assert(sprite.width > 0);
        assert(sprite.height > 0);
    });
}

if (failed > 0) {
    console.error(`\nFailed ${failed} test(s).`);
    process.exit(1);
} else {
    console.log(`\nAll ${passed} test(s) passed.`);
}
