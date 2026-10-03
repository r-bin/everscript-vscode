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
        // The 6 that differ are all fliers or bouncers still airborne at `loop` (Skullclaw,
        // Bone Buzzard, Gargon, Dragoil, Tumble Weed), which the interpreter plays on through.
        assert(agree >= 136, `only ${agree} idles agree`);
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
        assert.strictEqual(sp.model, 'straight');
        // Behaviour 0x0E: from 19 px up, rising at 5 and falling 1/16 px per tick², it lands.
        assert.strictEqual(sp.ends, 'ground');
        assert.strictEqual(sp.path.length, 29);
        assert.strictEqual(sp.path[0][0], 34, '5 px per tick from 29 px ahead');
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

    test('walking moves the Boy: step 5 per tick is 1.25 px, 60 px east per cycle', () => {
        const run = runAnimation(rom, 0xc80efa, 4);           // Boy walk, facing east
        assert.strictEqual(run.moves, true);
        const end = run.frames[run.frames.length - 1].motion.slice(-1)[0];
        assert.deepStrictEqual(end, [60, 0, 0]);
        assert.strictEqual(run.totalTicks, 48);
        const south = runAnimation(rom, 0xc80efa, 8).frames.slice(-1)[0].motion.slice(-1)[0];
        assert.deepStrictEqual(south, [0, 60, 0], 'facing 8 walks +y ($8FAF18)');
    });

    test('Skelesnail attack jumps: hop 32 peaks at 31 px and wait_landed holds until it lands', () => {
        const run = runAnimation(rom, 0xc9113b, 8);
        assert.strictEqual(run.complete, true);
        const jump = run.frames[2];
        assert.strictEqual(jump.ticks, 64, 'the hop frame lasts exactly the airtime');
        const peak = Math.max(...jump.motion.map(m => m[2]));
        assert.strictEqual(peak, 496);                          // 1/16 px: 31 px
        assert.strictEqual(jump.motion.slice(-1)[0][2], 0, 'lands at the end of the frame');
        assert.deepStrictEqual(run.frames.slice(-1)[0].motion.slice(-1)[0], [0, 54, 0]);
    });

    test('a standing idle does not move, and still wraps its cycle', () => {
        const run = runAnimation(rom, 0xc70168, 8);             // Wimpy Flower
        assert.strictEqual(run.moves, false);
        assert.strictEqual(run.frames.length, 1);
    });

    test('renderAnimation sends motion and a ground shadow layer', () => {
        const anim = renderAnimation(rom, 98, { key: 'atk0', offset: 0x38 }, 8);
        assert.strictEqual(anim.moves, true);
        assert(anim.frames.every(f => f.motion.length === f.ticks));
        assert(anim.shadow, 'Skelesnail sets a second sprite slot');
        assert(anim.frames.some(f => f.shadowPng));
        const spear = renderAnimation(rom, 0, { category: 'external', animRec: 0x411e }, 4);
        const sp = spear.projectiles.spawns[0];
        assert.strictEqual(typeof sp.ex, 'number', 'spawns carry the thrower position');
    });

    test('the Dog has six forms, each an animation set and palette like a Boy weapon', () => {
        const dog = readCharacter(rom, 1);
        assert.strictEqual(dog.weapons.length, 6);
        assert.deepStrictEqual(dog.weapons.map(f => f.paletteAddr), [0xae0b, 0xae0b, 0xae2b, 0xae4b, 0xb54b, 0xae6b]);
        const own = dog.anims.find(a => a.key === 'stand').animRec;
        assert.strictEqual(dog.weapons[0].anims[0].animRec, own, 'act 1 is the record the Dog stands in');
        // The stick form's walk is the group ACT1_STICK_RUNNING (id 0x30) lands in.
        assert.strictEqual(dog.weapons[1].anims.find(a => a.key === 'd_slot1').animRec, 0x42ce);
        assert.strictEqual(dog.weapons[4].anims[0].animRec, animationIdRecord(rom, 0x6a), 'act 0 stand = ACT0_STAND');
    });

    test('the boomerang (Vigor attack 1, routine 6) laps an ellipse and comes back', () => {
        const { projectileRecord, projectileFlight } = require('../../src/maps/dist/projectiles');
        const f = projectileFlight(rom, projectileRecord(rom, 0xda4e), { x: 10, y: 0, z: 300 }, 4, null);
        assert.strictEqual(f.model, 'orbit');
        assert.strictEqual(f.path.length, 256);
        assert.deepStrictEqual(f.path[255].slice(0, 2), [10, 0], 'back where it was thrown');
        const xs = f.path.map(p => p[0]);
        const ys = f.path.map(p => p[1]);
        assert.strictEqual(Math.max(...xs) - Math.min(...xs), 256);   // 128 px radius across
        assert.strictEqual(Math.max(...ys) - Math.min(...ys), 127);   // half that down
    });

    test('aimed projectiles fly at the target: Vigor attack 0 hits a Boy 60 px south', () => {
        const vigor = readAllCharacters(rom).find(c => c.name === 'Vigor').id;
        const anim = renderAnimation(rom, vigor, { offset: 0x38, target: { on: true, character: 0, distance: 60 } }, 8);
        const sp = anim.projectiles.spawns[0];
        assert.strictEqual(sp.model, 'aimed');
        assert.strictEqual(anim.target.y, 60);
        assert(anim.target.hits.projectile.length > 0, 'the projectile reaches the target');
        assert.strictEqual(anim.target.hits.projectile[0].tick, 33);
    });

    test('hit test height rule: 30 px above an attack is out of reach', () => {
        const { strikeHits, heightsMeet, OUT_OF_REACH_ABOVE } = require('../../src/maps/dist/hit-test');
        assert.strictEqual(OUT_OF_REACH_ABOVE, 0x1e0);
        assert.strictEqual(heightsMeet(0, 0x1df), true);
        assert.strictEqual(heightsMeet(0, 0x1e0), false);
        assert.strictEqual(heightsMeet(0x280, 0), true, '40 px below still meets');
        assert.strictEqual(heightsMeet(0x281, 0), false);
        const box = { x: 0, y: 0, width: 16, height: 16, z: 0 };
        assert.strictEqual(strikeHits(box, { x: 15, y: 0, z: 0, radius: 8 }), true);   // |dx| < r + w/2
        assert.strictEqual(strikeHits(box, { x: 16, y: 0, z: 0, radius: 8 }), false);
    });

    test('the Skelesnail lunge strikes a Boy 40 px south, twice', () => {
        const anim = renderAnimation(rom, 98, { offset: 0x38, target: { on: true, character: 0, distance: 40 } }, 8);
        assert.deepStrictEqual(anim.target.hits.melee, [84, 128]);
        assert.strictEqual(anim.reach.above, 0x1e0);
    });

    test('a script that sets no sprite keeps the standing one (shared damage knock-back)', () => {
        const fk = readAllCharacters(rom).find(c => c.name === 'FootKnight').id;
        const anim = renderAnimation(rom, fk, { offset: 0x40 }, 4);
        assert.strictEqual(anim.frames.length, 1);
        assert.strictEqual(anim.frames[0].spriteHex, anim.initialSprite);
        assert.deepStrictEqual(anim.frames[0].motion.slice(-1)[0], [-80, 0, 0], 'knocked back 16+12+8+4 steps');
    });

    test('a flier still airborne at loop carries on until its motion repeats (Skullclaw)', () => {
        const run = runAnimation(rom, 0xc905f6, 4);
        assert.strictEqual(run.complete, true);
        assert(run.loopFrom > 0, 'loops back into the hover, not to the ground');
        const tail = run.frames.flatMap(f => f.motion).slice(run.loopFrom).map(m => m[2]);
        assert(Math.min(...tail) > 0, 'stays in the air once hovering');
    });

    test('segments (0x57) and segment (0x59): the Tar Skull is a snake of 8 placed orbs', () => {
        const { lengthAt, segmentsAt } = require('../../src/maps/dist/animation-opcodes');
        const sg = segmentsAt(rom, 0xc704e5);
        assert.strictEqual(sg.total, 8);
        assert.strictEqual(sg.length, 10);
        assert.strictEqual(lengthAt(rom, 0xc704ef), 7, '0x59 always consumes 6 operand bytes ($8FC8DE)');
        const anim = renderAnimation(rom, 105, { offset: 0x32 }, 4);
        assert.strictEqual(anim.complete, true);
        const seg = anim.frames[0].segments;
        assert.strictEqual(seg.sprites.length, 8);
        assert.strictEqual(seg.sprites[0], '$cc7aa2', 'segment 0 is the head');
        assert.strictEqual(seg.ticks.length, anim.frames[0].ticks, 'a position for every segment on every tick');
        // $8FC905 eases each segment toward its target: by tick 60 the head reaches (20, -46).
        assert.deepStrictEqual(seg.ticks[60][0], [20, -46]);
        assert(anim.loopFrom > 0, 'rises out of a pile once, then sways in a repeating cycle');
        assert.deepStrictEqual(Object.keys(anim.segmentSprites), ['$cc7aa2', '$cc7cb5']);
    });

    test('mode bit $20 marks invulnerable frames (the dodge)', () => {
        const boy = readCharacter(rom, 0);
        const dodge = boy.weapons[0].anims.find(a => a.key === 'w_charge');
        assert.strictEqual(dodge.label, 'Dodge (invulnerable)');
        const anim = renderAnimation(rom, 0, dodge, 4);
        assert(anim.frames.every(f => f.invulnerable));
    });

    test('consumed projectiles stop at their hit; piercing ones fly on', () => {
        const vigor = readAllCharacters(rom).find(c => c.name === 'Vigor').id;
        const a = renderAnimation(rom, vigor, { offset: 0x38, target: { on: true, character: 0, distance: 60 } }, 8);
        const sp = a.projectiles.spawns[0];
        assert.strictEqual(sp.onHit, 'consumed');           // proc 2
        assert.strictEqual(sp.ends, 'hit');
        assert.strictEqual(a.target.hits.projectile.length, 1, 'one hit, not one per overlapping tick');
        const { projectileRecord } = require('../../src/maps/dist/projectiles');
        assert.strictEqual(projectileRecord(rom, 0xd9ee).field14, 4, 'the level-3 spear wave uses proc 4, which pierces');
    });

    test('the same attacker re-hits only after a 21-tick cooldown (+0x36/+0x38)', () => {
        const target = require('../../src/sprites/target');
        const frames = [{ ticks: 60, strikeBox: { dx: 0, dy: 0, width: 40, height: 40 }, motion: Array.from({ length: 60 }, () => [0, 0, 0]) }];
        const hits = target.hitTicks(frames, [], { x: 0, y: 0, z: 0, radius: 8 });
        assert.deepStrictEqual(hits.melee, [0, 21, 42]);
    });

    test('field labels follow the code: +0x46 is casting, +0x07 bit 4 is projectile-proof', () => {
        const boy = readCharacter(rom, 0);
        assert.strictEqual(boy.anims.find(a => a.key === 'block').label, 'Cast (alchemy / item)');
        assert(/immune to projectiles/.test(boy.statMeanings.flags2));
    });

    test('a one-shot still airborne at loop lands instead of replaying (Widowmaker leap)', () => {
        const w = readAllCharacters(rom).find(c => c.name === 'Widowmaker');
        const anim = renderAnimation(rom, w.id, w.anims.find(a => a.key === 'atk0'), 4);
        assert.strictEqual(anim.loopFrom, 0);
        const last = anim.frames[anim.frames.length - 1];
        assert.deepStrictEqual(last.motion.slice(-1)[0], [41, 0, 0], 'lunged 41 px and back on the ground');
        assert.strictEqual(anim.totalTicks, 97);
        const idle = runAnimation(rom, 0xc905f6, 4);              // Skullclaw idle: not a one-shot
        assert(idle.loopFrom > 0, 'idles still carry on into the hover');
    });

    test('characters with no visuals: none of their own animations shows anything', () => {
        const names = readAllCharacters(rom).filter(c => c.noVisuals).map(c => c.name);
        for (const n of ['Statue', 'Bridge', 'Fan', 'Speaker', 'Aquagoth', 'Mungola']) assert(names.includes(n), n);
        assert(!names.includes('Tar Skull'), 'segments count as visuals');
        assert(!names.includes('Tentacle'), 'visible when it attacks');
        assert.strictEqual(names.length, 10);
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
