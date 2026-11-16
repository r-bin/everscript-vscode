const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveAssets } = require('../../dist/games/evermore/resources/rom-assets');
const { resolveTiles } = require('../../dist/games/evermore/resources/tile-files');
const { resolveAudio } = require('../../dist/games/evermore/resources/audio-files');
const { resolvePalettes } = require('../../dist/games/evermore/resources/palette-files');
const { resolveSprites } = require('../../dist/games/evermore/resources/sprite-files');
const { resolveTables } = require('../../dist/games/evermore/resources/table-files');
const { readCharacter } = require('../../dist/games/evermore/sprites/character-model');
const { SOUNDS } = require('../../dist/games/evermore/localizations/sounds');

test.describe('Assets Documentation & VFS Parity', () => {
    const dummyRom = new Uint8Array(0x400000);

    test.it('icons VFS exposes index.json and index.md with complete catalog', async () => {
        const rootNode = resolveAssets(['icons'], dummyRom);
        assert.ok(rootNode && rootNode.kind === 'dir', 'icons root must be a directory');
        assert.ok(rootNode.entries.some(([n]) => n === 'index.json'), 'index.json must be listed');

        const indexJsonNode = resolveAssets(['icons', 'index.json'], dummyRom);
        assert.ok(indexJsonNode && indexJsonNode.kind === 'file', 'index.json must be a file');
        const jsonBuf = await indexJsonNode.read();
        const jsonArr = JSON.parse(jsonBuf.toString());
        assert.ok(Array.isArray(jsonArr), 'index.json must return array of icon models');

        const indexMdNode = resolveAssets(['icons', 'index.md'], dummyRom);
        assert.ok(indexMdNode && indexMdNode.kind === 'file', 'index.md must be a file');
        const mdText = (await indexMdNode.read()).toString();
        assert.ok(mdText.startsWith('# soe://rom/assets/icons/'), 'index.md starts with header');
    });

    test.it('sound effects VFS enriches metadata with triggering animation lists', async () => {
        assert.ok(SOUNDS.length >= 50, 'SOUNDS catalog must contain at least 50 mapped sound effects');
        const sfx08 = SOUNDS.find((s) => s.id === 0x08);
        assert.ok(sfx08, 'SFX 0x08 must exist in SOUNDS');

        const soundNode = resolveAudio(['sounds', '08', 'info.md'], dummyRom);
        assert.ok(soundNode && soundNode.kind === 'file', 'SFX 08 info.md must be a file');
        const text = (await soundNode.read()).toString();
        assert.ok(text.includes('# SFX 0x08: Gore Flower'), 'Must contain SFX title');
        assert.ok(text.includes('Animations triggering this SFX'), 'Must document triggering animations');

        const soundJsonNode = resolveAudio(['sounds', '08', 'info.json'], dummyRom);
        assert.ok(soundJsonNode && soundJsonNode.kind === 'file', 'SFX 08 info.json must be a file');
        const data = JSON.parse((await soundJsonNode.read()).toString());
        assert.strictEqual(data.id, 0x08);
        assert.ok(Array.isArray(data.animations), 'info.json must carry animations array');
    });

    test.it('unnamed characters in ROM resolve proper fallback and descriptive names', () => {
        const char25 = readCharacter(dummyRom, 25);
        assert.strictEqual(char25.name, 'Placeholder', 'Character 25 must resolve to Placeholder');

        const char75 = readCharacter(dummyRom, 75);
        assert.strictEqual(char75.name, 'Spark', 'Character 75 must resolve to Spark');

        const char26 = readCharacter(dummyRom, 26);
        assert.strictEqual(char26.name, 'Dummy Entity (#26)', 'Character 26 must resolve to Dummy Entity');

        const boy = readCharacter(dummyRom, 0);
        assert.strictEqual(boy.disposition.label, 'Player', 'Boy disposition must be Player');
        assert.strictEqual(boy.disposition.hostile, false, 'Boy must not be hostile');

        const dog = readCharacter(dummyRom, 1);
        assert.strictEqual(dog.disposition.label, 'Companion', 'Dog disposition must be Companion');
        assert.strictEqual(dog.disposition.hostile, false, 'Dog must not be hostile');
    });

    test.it('alchemy and items VFS expose info.md, index.json, and rich metadata', async () => {
        const alchRoot = resolveAssets(['alchemy'], dummyRom);
        assert.ok(alchRoot && alchRoot.kind === 'dir', 'alchemy root must be a dir');
        assert.ok(alchRoot.entries.some(([n]) => n === 'index.json'), 'alchemy must list index.json');
        assert.ok(alchRoot.entries.some(([n]) => n === 'index.md'), 'alchemy must list index.md');

        const acidRainMd = resolveAssets(['alchemy', 'acid_rain', 'info.md'], dummyRom);
        assert.ok(acidRainMd && acidRainMd.kind === 'file', 'acid_rain info.md must be a file');
        const acidText = (await acidRainMd.read()).toString();
        assert.ok(acidText.includes('# Alchemy Formula: Acid Rain'), 'Must document formula name');
        assert.ok(acidText.includes('Animation Records'), 'Must document animation records');

        const acidJson = resolveAssets(['alchemy', 'acid_rain.json'], dummyRom);
        assert.ok(acidJson && acidJson.kind === 'file', 'acid_rain.json shortcut must exist');
        const acidData = JSON.parse((await acidJson.read()).toString());
        assert.strictEqual(acidData.name, 'Acid Rain');
        assert.strictEqual(acidData.category, 'alchemy');

        const ingRoot = resolveAssets(['ingredients', 'index.json'], dummyRom);
        assert.ok(ingRoot && ingRoot.kind === 'file', 'ingredients index.json must be a file');
        const ingData = JSON.parse((await ingRoot.read()).toString());
        assert.ok(Array.isArray(ingData) && ingData.length > 0, 'ingredients index.json must be non-empty array');

        const waxMd = resolveAssets(['ingredients', 'wax', 'info.md'], dummyRom);
        assert.ok(waxMd && waxMd.kind === 'file', 'wax info.md must exist');
        const waxText = (await waxMd.read()).toString();
        assert.ok(waxText.includes('# WAX (ingredients)'), 'Wax info.md must document item');
    });

    test.it('palettes and sprites VFS expose index.json and info.md endpoints', async () => {
        const palRoot = resolvePalettes([], dummyRom);
        assert.ok(palRoot && palRoot.kind === 'dir', 'palettes root must be a dir');
        assert.ok(Array.isArray(palRoot.entries), 'palettes must return entries array');

        const palJson = resolvePalettes(['index.json'], dummyRom);
        assert.ok(palJson && palJson.kind === 'file', 'palettes index.json must be a file');
        const palData = JSON.parse((await palJson.read()).toString());
        assert.ok(Array.isArray(palData), 'palettes index.json must return array');

        const sprRoot = resolveSprites([], dummyRom);
        assert.ok(sprRoot && sprRoot.kind === 'dir', 'sprites root must be a dir');
        assert.ok(sprRoot.entries.some(([n]) => n === 'index.json'), 'sprites must list index.json');

        const sprJson = resolveSprites(['index.json'], dummyRom);
        assert.ok(sprJson && sprJson.kind === 'file', 'sprites index.json must be a file');
        const sprData = JSON.parse((await sprJson.read()).toString());
        assert.ok(Array.isArray(sprData), 'sprites index.json must return array');
    });

    test.it('tile VFS supports info.md and .md documentation nodes', async () => {
        const tileMd = resolveTiles(['0000.md'], dummyRom);
        assert.ok(tileMd && tileMd.kind === 'file', '0000.md must be a file node');
        const mdText = (await tileMd.read()).toString();
        assert.ok(mdText.includes('Master map 16×16 CHR tile graphic'), 'Must document tile master table');
        assert.ok(mdText.includes('![Tile 0x0000](0000.png)'), 'Must include tile preview link');
    });

    test.it('asm-comments.json documents confirmed routines with instruction line comments', () => {
        const jsonPath = path.resolve(__dirname, '../../src/games/evermore/localizations/data/asm-comments.json');
        const comments = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        assert.ok(comments.rom, 'asm-comments must contain rom dictionary');
        assert.ok(comments.rom['0F9DBD'], 'entity_cardinal_facing_direction_resolve entry must have line comments');
        assert.ok(comments.rom['008F85'], 'vram_oam_buffer_dma_commit_on_nmi entry must have line comments');
        assert.ok(comments.rom['00C5C6'], 'sub_80C5C6 flight abort check must have line comments');
        assert.ok(comments.rom['00C5CE'], 'sub_80C5CE boost throttle check must have line comments');
        assert.ok(comments.rom['00C5DB'], 'sub_80C5DB cruise speed & HUD toggle must have line comments');
        assert.ok(comments.rom['00C600'], 'camera_velocity_accelerate_and_clamp must have line comments');
        assert.ok(comments.rom['00C61C'], 'camera_velocity_decelerate_and_clamp_neg must have line comments');
        assert.ok(comments.rom['00C638'], 'camera_scroll_velocity_decelerate_and_clamp must have line comments');
        assert.ok(comments.rom['00C659'], 'camera_pan_velocity_accel_step_a must have line comments');
        assert.ok(comments.rom['00C672'], 'scene_transition_step_or_commit_at_9f must have line comments');
        assert.ok(comments.rom['00C681'], 'scene_transition_timer_decrement_or_loop must have line comments');
        assert.ok(comments.rom['00C95B'], 'sub_80C95B entry stub must have line comments');
        assert.ok(comments.rom['00C95D'], 'sub_80C95D VBlank & DMA must have line comments');
        assert.ok(comments.rom['00C985'], 'sub_80C985 frame coordinator must have line comments');
    });

    test.it('tables VFS links domain assets and documents dog form pointers', async () => {
        const tableNode = resolveTables(['character_table', 'info.md'], dummyRom);
        assert.ok(tableNode && tableNode.kind === 'file', 'character_table info.md must be a file');
        const text = (await tableNode.read()).toString();
        assert.ok(text.includes('## Decoded Domain Asset'), 'Must contain Decoded Domain Asset section');
        assert.ok(text.includes('soe://rom/assets/characters/'), 'Must link to characters domain');

        const sfxTableNode = resolveTables(['sfx_translation_table', 'info.md'], dummyRom);
        assert.ok(sfxTableNode && sfxTableNode.kind === 'file', 'sfx_translation_table info.md must be a file');
        const sfxText = (await sfxTableNode.read()).toString();
        assert.ok(sfxText.includes('soe://rom/assets/audio/sounds/'), 'Must link to audio sounds domain');

        const musicTableNode = resolveTables(['music_translation_table', 'info.md'], dummyRom);
        assert.ok(musicTableNode && musicTableNode.kind === 'file', 'music_translation_table info.md must be a file');
        const musicText = (await musicTableNode.read()).toString();
        assert.ok(musicText.includes('soe://rom/assets/audio/music/'), 'Must link to audio music domain');

        const armorTableNode = resolveTables(['tbl_armor_records', 'info.md'], dummyRom);
        assert.ok(armorTableNode && armorTableNode.kind === 'file', 'tbl_armor_records info.md must be a file');
        const armorText = (await armorTableNode.read()).toString();
        assert.ok(armorText.includes('soe://rom/assets/armor/'), 'Must link to armor domain');

        const dogPointersNode = resolveTables(['dog_form_pointers', 'info.md'], dummyRom);
        assert.ok(dogPointersNode && dogPointersNode.kind === 'file', 'dog_form_pointers info.md must be a file');
        const dogText = (await dogPointersNode.read()).toString();
        assert.ok(dogText.includes('Companion dog breed form attribute pointer table'), 'Must document breed table');
        assert.ok(dogText.includes('soe://rom/assets/characters/01/'), 'Must link to Dog character');
    });
});
