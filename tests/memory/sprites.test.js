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

    test('renderAnimation renders Magmar enter through the $C43C92 id table (opcode 0x78)', () => {
        const magmar = readCharacter(rom, 140);
        const ext = magmar.anims.find(a => a.key === 'MAGMAR_ENTER');
        assert(ext);
        // Record $4DD2 sits among Magmar's own records ($4DCA..$4DE6). The old
        // $910000 lookup read font graphics and landed on an unrelated record.
        assert.strictEqual(ext.animRec, 0x4dd2);
        const anim = renderAnimation(rom, 140, ext, 8);
        assert(anim, 'Magmar enter animation failed to decode');
        assert.strictEqual(anim.frames.length, 15, 'Magmar enter should decode 15 frames');
        assert.strictEqual(anim.complete, true);
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

    test('readCharacter Boy has 15 weapons with full animation sets', () => {
        const boy = readCharacter(rom, 0);
        assert(Array.isArray(boy.weapons), 'Boy should have weapons array');
        assert.strictEqual(boy.weapons.length, 15);
        assert.strictEqual(boy.weapons[0].name, 'Bone Crusher');
        assert.strictEqual(boy.weapons[1].name, 'Gladiator Sword');
        assert.strictEqual(boy.weapons[12].name, 'Bazooka');

        // Bone Crusher animations
        const boneAnims = boy.weapons[0].anims;
        assert(boneAnims.length >= 8);
        const atk0 = boneAnims.find(a => a.key === 'w_atk0');
        assert(atk0, 'Bone Crusher should have w_atk0');

        // Render Bone Crusher atk0 with opcode 0x48 support and strikeBox extraction
        const rendered = renderAnimation(rom, 0, atk0, 0);
        assert(rendered, 'Bone Crusher atk0 should decode successfully');
        // The strike runs before the hold, so the game tests it on one tick only:
        // the pose is a 1-tick striking frame followed by 6 ticks without.
        assert.strictEqual(rendered.frames.length, 5);
        assert.strictEqual(rendered.frames[0].strikeBox, null);
        assert(rendered.frames[1].strikeBox, 'Frame 1 should declare active strike box');
        assert.strictEqual(rendered.frames[1].ticks, 1);
        assert.strictEqual(rendered.frames[2].strikeBox, null);
        assert.strictEqual(rendered.frames[2].spriteAddr, rendered.frames[1].spriteAddr);
        assert.strictEqual(rendered.frames[1].strikeBox.dx, -2);
        assert.strictEqual(rendered.frames[1].strikeBox.dy, -9);
        assert.strictEqual(rendered.frames[1].strikeBox.width, 26);
        assert.strictEqual(rendered.frames[1].strikeBox.height, 11);
    });

    test('global animation ids resolve through $C43C92, not the font bank', () => {
        // Dog ACT3_FALL_2 (0x66) read font bitplanes through $910000; the real
        // id table gives it record $449E, a two-frame animation.
        const dog = readCharacter(rom, 1);
        const fall = dog.anims.find(a => a.key === 'ACT3_FALL_2');
        assert(fall, 'Dog ACT3_FALL_2 should resolve to a real record');
        assert.strictEqual(fall.animRec, 0x449e);

        const magmar = readCharacter(rom, 140);
        const magmarEnter = magmar.anims.find(a => a.key === 'MAGMAR_ENTER');
        assert(magmarEnter, 'Magmar should retain valid MAGMAR_ENTER external animation');
    });
}

if (rom) {
    const { runAnimation, animationGroups, animationIdRecord, ANIMATION_ID_COUNT } = require('../../src/maps/dist/animation-vm');
    const { disassembleScript } = require('../../src/maps/dist/animation-opcodes');
    const { walkAnimationScript } = require('../../src/maps/dist/character-animation');
    const { animationScript } = require('../../src/maps/dist/character-record');
    const { buildAnimationCatalog } = require('../../src/sprites');

    test('record table splits into 783 animations over 1752 records', () => {
        const groups = animationGroups(rom);
        assert.strictEqual(groups.length, 783);
        assert.strictEqual(groups.reduce((n, g) => n + g.scripts.length, 0), 1752);
        assert.strictEqual(groups.filter(g => g.facings.length === 4).length, 274);
        assert.strictEqual(groups.filter(g => g.facings.length === 8).length, 21);
    });

    test('every character field and global id points at a group head', () => {
        const heads = new Set(animationGroups(rom).map(g => g.record));
        for (let c = 0; c < CHARACTER_COUNT; c++) {
            for (const a of readCharacter(rom, c).anims) {
                if (a.category === 'standard') assert(heads.has(a.animRec), `char ${c} ${a.key}`);
            }
        }
        assert.strictEqual(ANIMATION_ID_COUNT, 212);
        let onHead = 0;
        for (let id = 0; id < ANIMATION_ID_COUNT * 2; id += 2) if (heads.has(animationIdRecord(rom, id))) onHead++;
        assert(onHead >= 210, `only ${onHead} ids land on a head`);
    });

    test('the interpreter agrees with the linear walk on idles without strikes', () => {
        let agree = 0;
        for (let c = 0; c < CHARACTER_COUNT; c++) {
            const s = animationScript(rom, c, 8, 0x32);
            if (!s) continue;
            const walk = walkAnimationScript(rom, s).frames.map(f => f.sprite + ':' + f.ticks).join(' ');
            const run = runAnimation(rom, s).frames.filter(f => f.sprite !== null).map(f => f.sprite + ':' + f.ticks).join(' ');
            if (walk === run) agree++;
        }
        assert(agree >= 137, `only ${agree} idles agree`);
    });

    test('a counted loop repeats: Flowering Death attack strikes twice per loop', () => {
        const run = runAnimation(rom, 0xc701dc);
        assert.strictEqual(run.complete, true);
        const deep = run.frames.filter(f => f.strikeBox && f.strikeBox.dy === 34);
        assert.strictEqual(deep.length, 2, 'the dec_jnz body should run twice');
    });

    test('a hold is a checkpoint: Mosquito steps on every tick of its hold', () => {
        const run = runAnimation(rom, 0xc80d24);
        assert.strictEqual(run.frames[0].sprite, 0xcc5b38);
        assert.strictEqual(run.frames[0].step, 4);   // hold 2, step 2 each tick
    });

    test('the invisible helper script runs but draws nothing', () => {
        const run = runAnimation(rom, 0xc70080);
        assert.strictEqual(run.complete, true);
        assert(run.frames.every(f => f.sprite === null));
    });

    test('disassembler lists the Flowering Death loop in the doc notation', () => {
        const text = disassembleScript(rom, 0xc701dc).map(l => l.text);
        assert(text.includes('set var[$7e], 2'));
        assert(text.includes('dec_jnz var[$7e], $c701f5'));
        assert(text.includes('end_check!'));
        assert.strictEqual(text[text.length - 1], 'loop');
    });

    test('animation catalogue covers every record with owners and a palette', () => {
        const cat = buildAnimationCatalog(rom, readAllCharacters(rom));
        assert.strictEqual(cat.length, 783);
        const magmar = cat.find(a => a.record === 0x4dd2);
        assert(magmar.owners.some(o => o.kind === 'id' && o.names.includes('MAGMAR_ENTER')));
        assert.strictEqual(readCharacter(rom, magmar.paletteCharacter).name, 'Magmar');  // 87 and 140 are both Magmar
        const stand = cat.find(a => a.record === readCharacter(rom, 140).anims.find(x => x.key === 'stand').animRec);
        assert(stand.owners.some(o => o.kind === 'character' && o.id === 140));
    });

    test('projectile records: 24 bytes at $900000 + id, +0x00 an animation head', () => {
        const { projectileRecord, projectileVelocity } = require('../../src/maps/dist/projectiles');
        const heads = new Set(animationGroups(rom).map(g => g.record));
        const p = projectileRecord(rom, 0xd9d6);
        assert.strictEqual(p.animRecord, 0x5772);
        assert(heads.has(p.animRecord));
        assert.strictEqual(p.routine, 4);
        assert.strictEqual(p.palette, 0);                 // keeps the thrower's palette
        // $90DD88: facing 4 is +x, facing 8 is +y; speed is in 1/16 px.
        assert.deepStrictEqual(projectileVelocity(p, 4), { vx: 5, vy: 0 });
        assert.deepStrictEqual(projectileVelocity(p, 8), { vx: 0, vy: 5 });
        assert.strictEqual(projectileVelocity({ ...p, routine: 6 }, 4), null);
    });

    test('Horn Spear attack 2 throws $D9D6 on tick 16, 29 px ahead, flying', () => {
        const boy = readCharacter(rom, 0);
        const atk2 = boy.weapons[8].anims.find(a => a.key === 'w_atk2');
        assert.strictEqual(atk2.animRec, 0x411e);
        const anim = renderAnimation(rom, 0, atk2, 4);
        assert.strictEqual(anim.projectiles.spawns.length, 1);
        const sp = anim.projectiles.spawns[0];
        assert.strictEqual(sp.idHex, '$d9d6');
        assert.strictEqual(sp.tick, 16);
        assert.deepStrictEqual([sp.dx, sp.dy, sp.dz], [29, 0, 19]);
        assert.strictEqual(sp.flying, true);
        const a = anim.projectiles.anims['$d9d6'];
        assert.deepStrictEqual([a.width, a.height], [40, 8]);
        assert(anim.frames.some(f => f.spawns.length), 'the throwing frame lists the spawn');
    });

    test('weapon palette (+0x04) fills the Boy palette slots left green', () => {
        const { paletteAt, characterPalette } = require('../../src/maps/dist/character-record');
        const boy = readCharacter(rom, 0);
        const spear = boy.weapons[8];
        assert.strictEqual(spear.paletteAddr, 0xad8b);
        assert(spear.anims.every(a => a.paletteAddr === 0xad8b));
        const own = characterPalette(rom, 0);
        const held = paletteAt(rom, spear.paletteAddr);
        assert.deepStrictEqual(own[12], [8, 248, 8]);
        assert.notDeepStrictEqual(held[12], [8, 248, 8]);
        for (const i of [1, 2, 4, 5, 15]) assert.deepStrictEqual(held[i], own[i], `skin/outline slot ${i}`);
    });

    test('catalogue names projectile animations by what throws them', () => {
        const cat = buildAnimationCatalog(rom, readAllCharacters(rom));
        const wave = cat.find(a => a.record === 0x5772);
        assert(wave.owners.some(o => o.kind === 'projectile' && o.idHex === '$d9d6'));
        assert.strictEqual(wave.paletteAddr, 0xad8b, 'drawn in the throwing weapon\'s palette');
    });

    test('renderAnimation returns a script listing with frame line addresses', () => {
        const anim = renderAnimation(rom, 140, { category: 'external', animRec: 0x4dd2 }, 0);
        assert(anim.script.length > 10);
        const addrs = new Set(anim.script.map(l => l.address));
        assert(anim.frames.every(f => f.lines.every(a => addrs.has(a))));
    });
}

if (failed > 0) {
    console.error(`\nFailed ${failed} test(s).`);
    process.exit(1);
} else {
    console.log(`\nAll ${passed} test(s) passed.`);
}
