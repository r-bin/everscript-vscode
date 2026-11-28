// Unit tests for Open Evermore demo manifests, overlay transforms, and headless MesenCE output parsing.
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { applyDemo, listDemos, loadDemo, validateDemoManifest } from '../../tools/open-evermore/demos.mts';
import { parseMesenStdout, parsePngRgbStats } from '../../tools/open-evermore/mesen.mts';
import { json, readText, text } from '../../tools/open-evermore/tree.mts';
import type { Tree } from '../../tools/open-evermore/tree.mts';

const require = createRequire(import.meta.url);
const { encodePng } = require('../../dist/platform/png');

console.log('\nOpen Evermore demos unit checks:');

// 1. All demo manifests under tools/open-evermore/demos/ are valid and include verify.lua.
const demos = listDemos({ includeBlocked: true });
const names = demos.map((d) => d.name).sort();
assert.deepStrictEqual(names, ['brians_room_blue', 'cheat_menu', 'heal_999', 'purple_raptor', 'turd_ball']);
for (const d of demos) {
    assert.deepStrictEqual(validateDemoManifest(d.manifest, d.name), [], `${d.name} manifest invalid`);
    assert.ok(d.verifyLua && d.verifyLua.includes('OE_DONE'), `${d.name} must have verify.lua emitting OE_DONE`);
}
console.log(`  ✓ ${demos.length} demo manifests valid (${names.join(', ')})`);

// 2. Transform engine works deterministically without touching the source tree (cloneDir, shiftPalette, patchJson, appendEnum, writeText, --no-scene).
const synth: Tree = new Map([
    ['maps/rooms/podunk_test_room_brians_room/map.json', json({ palettes: ['palette_015'] })],
    ['maps/rooms/podunk_test_room_brians_room/scripts.json', json({ enter: null })],
    ['maps/rooms/podunk_test_room_brians_room/preview.png', new Uint8Array([1, 2, 3])],
    ['maps/rooms/_enum.json', json({ kind: 'maps', limit: 256, names: ['room_0'] })],
    ['palettes/backgrounds/_enum.json', json({ kind: 'palettes', limit: 1024, names: ['palette_015'] })],
    ['palettes/backgrounds/palette_015.json', json({
        format: 'open-evermore/palette',
        version: 1,
        colours: Array.from({ length: 16 }, (_, i) => i === 0 ? '#00f800' : '#f88040'),
        maps: ['podunk_test_room_brians_room'],
    })],
    ['scripts/rooms/podunk_opening_over_the_machine/enter.txt', text('original\n')],
]);

const blueDemo = loadDemo('brians_room_blue');
const modOnly = applyDemo(synth, blueDemo, { noScene: true });
assert.strictEqual(readText(synth.get('scripts/rooms/podunk_opening_over_the_machine/enter.txt')!), 'original\n', 'source tree unchanged');
assert.strictEqual(readText(modOnly.get('scripts/rooms/podunk_opening_over_the_machine/enter.txt')!), 'original\n', '--no-scene keeps intro');
assert.ok(modOnly.has('maps/rooms/brians_room_blue/map.json') && !modOnly.has('maps/rooms/brians_room_blue/preview.png'), 'cloneDir respects exclude');
const palDoc = JSON.parse(readText(modOnly.get('palettes/backgrounds/brians_room_blue.json')!));
assert.strictEqual(palDoc.colours[0], '#00f800', 'index 0 preserved');
assert.strictEqual(palDoc.maps, undefined, 'derived maps array cleared on clone');
for (const c of palDoc.colours.slice(1) as string[]) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    assert.strictEqual(r % 8, 0);
    assert.strictEqual(g % 8, 0);
    assert.strictEqual(b % 8, 0);
    assert.ok(b > r && b > g, `expected blue-shifted palette color, got ${c}`);
}
const withScene = applyDemo(synth, blueDemo, { noScene: false });
assert.ok(readText(withScene.get('scripts/rooms/podunk_opening_over_the_machine/enter.txt')!).includes('brians_room_blue'));
console.log('  ✓ transform engine (cloneDir, cloneFile, shiftPalette BGR555, patchJson, appendEnum, --no-scene)');

// 2b. replaceText edits a routine by one line, so no demo has to carry the rest of it; a wrong match count is an error.
const hookDemo = loadDemo('cheat_menu');
const routine = 'code/room_enter_pre_roll_wait_and_entity_spawn.asm';
const hooked = applyDemo(new Map([...synth, [routine, text('a:\n    jsl per_frame_field_tick\n    rtl\n')]]), hookDemo, { noScene: true });
assert.strictEqual(readText(hooked.get(routine)!), 'a:\n    jsl cheat_menu_hook\n    rtl\n');
assert.ok(hooked.has('code/cheat_menu.asm'));
assert.throws(() => applyDemo(new Map([[routine, text('    rtl\n')]]), hookDemo, { noScene: true }), /0 times, expected 1/);
console.log('  ✓ replaceText (one match, else an error) and the cheat menu overlay');

// 3. Mesen stdout parser tolerates noise + parses OE_PASS, OE_FAIL, OE_DONE, OE_PNGHEX.
const rgba = new Uint8Array(4 * 4 * 4);
for (let i = 0; i < rgba.length; i += 4) { rgba[i] = 16; rgba[i + 1] = 48; rgba[i + 2] = 200; rgba[i + 3] = 255; }
const samplePng = new Uint8Array(encodePng(4, 4, rgba));
const parsed = parseMesenStdout([
    'Mesen noisy header',
    'OE_PASS {"name":"room_0x7f","detail":"ok"}',
    'OE_FAIL {"name":"blue_cgram","detail":"bad"}',
    `OE_PNGHEX test_shot ${Buffer.from(samplePng).toString('hex')}`,
    'OE_DONE {"frame":400}',
].join('\n'));
assert.strictEqual(parsed.done, true);
assert.deepStrictEqual(parsed.checks, [
    { name: 'room_0x7f', ok: true, detail: 'ok' },
    { name: 'blue_cgram', ok: false, detail: 'bad' },
]);
const stats = parsePngRgbStats(parsed.screenshots.get('test_shot')!);
assert.strictEqual(stats.nonBlackPixels, 16);
assert.ok(stats.meanB > stats.meanR && stats.meanB > stats.meanG);
console.log('  ✓ MesenCE stdout parser and PNG RGB stats');
