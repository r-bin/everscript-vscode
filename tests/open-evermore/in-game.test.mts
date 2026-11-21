// Open Evermore edits in the running game (G2, docs/open-evermore/progress.md §2): what a tree edit does to the
// game, not only to the bytes. Each build is booted in the extension's snes9x core and compared with the vanilla
// engine shown the same room through a hand-patched table entry:
//   1. podunk_opening_over_the_machine (room 0x61, loaded at power-on for the intro and title) holds Brian's map
//      files: the game boots into Brian's map, drawn as vanilla draws Brian's room in slot 0x61;
//   2. a new map (a copy of Brian's) under a new name gets id 0x7F and an enter script of its own (a new script
//      file: fade_in), the map and enter-script tables grow and move, and a script enters it: the opening's enter
//      script (the intro's first code) rewritten to load_map(0x7F, …). The same script without the new map loads
//      something else. Every change is a file of the tree; the reference is the vanilla ROM patched by hand;
//   3. a new string (string #3003, past the vanilla key table, which grows and moves) shown by the opening's enter
//      script (`text`, opcode 0x51): the decoded text in WRAM is vanilla's for the string it copies; without the
//      new string it is not.
// Screenshots: out/open-evermore-tests/*.png (git-ignored, ROM-derived). Skips without the ROM.
// Run: node tests/open-evermore/in-game.test.mts   (npm run build:ts first; ~1 min)
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { GAME, KINDS } from '../../tools/open-evermore/evermore/kinds.mts';
import { explode } from '../../tools/open-evermore/explode.mts';
import { implode } from '../../tools/open-evermore/implode.mts';
import { boot } from '../../tools/open-evermore/play.mts';
import { sha1 } from '../../tools/open-evermore/tree.mts';
import type { Tree } from '../../tools/open-evermore/tree.mts';

const require = createRequire(import.meta.url);
const games = require('../../dist/games');
const { stripCopierHeader } = require('../../dist/platform/roms/header');
const { encodePng } = require('../../dist/platform/png');
const { AUDIO_RATE } = require('../../dist/platform/tas/movie');

const OPENING = 'podunk_opening_over_the_machine', BRIAN = 'podunk_test_room_brians_room', COPY = 'brians_room_copy';
const OPENING_ID = 0x61, BRIAN_ID = 0x15, NEW_ID = 0x7F;
/** Facts (docs/map-format/rom-export.md, knowledge CURRENT_ROOM_ID): the map table, the enter-script table, the
 *  intro's first script instruction, the room id in WRAM. */
const MAP_TABLE = 0x1FFDE7, INTRO = 0x12E0CA, ROOM_ID = 0x7E0ADB;
/** Brian's room has no enter script, so it stays black. The new map's enter script is `fade_in(); end` (call_id
 *  0x36, rom-export.md row 4); the reference gets the same bytes at $BF:F000, in the 4th MB, as a packed pointer:
 *  bank $92 + (p >> 15), $8000 | p. */
const FADE_IN = [0xA3, 0x36, 0x00], FADE_AT = 0x3FF000, FADE_PACKED = ((0xBF - 0x92) << 15) | (FADE_AT & 0x7FFF);
const FADE_FILE = 'call_global 36\nend\n', INTRO_SCRIPT = `maps/rooms/${OPENING}/scripts/enter.txt`;
const ENTER_TABLE = 0x12801B;
/** Brian's entrance in 8 px units (tools/table-hack/evs/string-3003.evs: entrance(0x17, 0d40)). */
const ENTRANCE = [0x17, 40];
/** Frames to run: the intro shows room 0x61 from about frame 400; a patched intro reaches its room well before. */
const FRAMES = 1000;
const OUT = join(import.meta.dirname, '../../out/open-evermore-tests');

/** The decoded text buffer the `text` opcode fills (docs/reverse-engineering/asm-to-c-port.md §11). */
const TEXT_BUFFER = 0x7FD81E, TEXT_BYTES = 128, COPIED_STRING = 0x375;

interface Run { room: number; screen: string; vram: string; png: Uint8Array; text: string }

/** Boots `image`, runs FRAMES frames without input, returns the room id, screen and VRAM. */
async function play(image: Uint8Array): Promise<Run> {
    const c = await boot();
    const M = c.Module;
    const p = M._my_malloc(image.length);
    c.HEAPU8.set(image, p);
    M._startWithRom(p, image.length, AUDIO_RATE);
    for (let f = 0; f < FRAMES; f++) { M._setJoypadInput(0); M._mainLoop(); }
    const room = M.readMemoryRange(ROOM_ID, 1)[0];
    const text = Buffer.from(M.readMemoryRange(TEXT_BUFFER, TEXT_BYTES)).toString('hex');
    const buffer = new Uint8Array(c.HEAPU8.buffer, M._getScreenBuffer(), 512 * 448 * 4);
    const pixels = new Uint8Array(256 * 224 * 4);
    for (let y = 0; y < 224; y++) pixels.set(buffer.subarray(y * 2048, y * 2048 + 1024), y * 1024);
    const state = M._saveState();      // VRAM at save-state offset 0xC14, 64 KiB (play.mts)
    const vram = createHash('md5').update(new Uint8Array(c.HEAPU8.buffer, state + 0xC14, 0x10000)).digest('hex');
    return { text, room, screen: createHash('md5').update(pixels).digest('hex'), vram, png: new Uint8Array(encodePng(256, 224, pixels)) };
}

/** The reference: `load_map(id, x, y); end` over the intro's first instruction (opcode 0x22, 16-bit id;
 *  rom-export.md row 6), and the fade-in script at FADE_AT (a 3 MiB image grows to 4 MiB, $FF beyond). */
const enter = (image: Uint8Array, id: number): Uint8Array => {
    const out = new Uint8Array(0x400000).fill(0xFF);
    out.set(image);
    out.set([0x22, ENTRANCE[0], ENTRANCE[1], id & 0xFF, id >> 8, 0x00], INTRO);
    out.set(FADE_IN, FADE_AT);
    return out;
};

/** The tree's ROM; no errors, and no warnings but `allowed` (a replaced map leaves its tiles unused). */
function build(tree: Tree, what: string, allowed: string[] = []): Uint8Array {
    const r = implode(tree, GAME, KINDS);
    assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info' && !(f.severity === 'warning' && allowed.includes(f.rule))).map(f => `${f.rule} ${f.file} ${f.message}`), [], what);
    return r.image!;
}

/** The same as files: the opening's enter script (the intro's first code) becomes `load_map(id, x, y)`, which ends
 *  the script (a byte after it would never run: explode gives it back as `skip 1`). */
const enterByScript = (tree: Tree, id: number): Tree => {
    const t = new Map(tree);
    t.set(INTRO_SCRIPT, new TextEncoder().encode(`22 ${[ENTRANCE[0], ENTRANCE[1], id & 0xFF, id >> 8].map(b => b.toString(16).padStart(2, '0')).join(' ')}\n`));
    return t;
};

/** A map's drawing and triggers copied over another's (the four map files, not its scripts/); the target keeps its
 *  own enter script (map.json `enter`), none when it had none. Triggers naming the source's own scripts (local
 *  names) name them `<source>/<name>` in the copy. */
const copyMap = (tree: Tree, from: string, to: string) => {
    const kept = tree.has(`maps/rooms/${to}/map.json`) ? JSON.parse(Buffer.from(tree.get(`maps/rooms/${to}/map.json`)!).toString()).enter : undefined;
    for (const f of ['map.json', 'grid.txt', 'metatiles.json', 'objects.json']) tree.set(`maps/rooms/${to}/${f}`, tree.get(`maps/rooms/${from}/${f}`)!);
    const m = JSON.parse(Buffer.from(tree.get(`maps/rooms/${to}/map.json`)!).toString());
    if (kept === undefined) delete m.enter; else m.enter = kept;
    for (const t of [...m.stepOn, ...m.bTrigger]) if (typeof t.script === 'string' && tree.has(`maps/rooms/${from}/scripts/${t.script}.txt`)) t.script = `${from}/${t.script}`;
    tree.set(`maps/rooms/${to}/map.json`, new TextEncoder().encode(JSON.stringify(m)));
};

const path = games.baseRomPath('evermore');
if (!path || !existsSync(path)) {
    console.log('\nOpen Evermore in game: skipped (no Evermore base ROM in the ROM library)');
} else {
    const rom: Uint8Array = stripCopierHeader(new Uint8Array(readFileSync(path)));
    const tree = explode(rom, { release: 'us', sha1: sha1(rom), explodedWith: 'test' }, GAME, KINDS);
    mkdirSync(OUT, { recursive: true });
    console.log('\nOpen Evermore edits in the running game:');

    // 1. Brian's files in the opening's folder: the game boots into Brian's map. The opening keeps its id and its
    //    enter script (the intro's), so the screen is the vanilla engine's Brian's room as room 0x61.
    const swapped = new Map(tree);
    copyMap(swapped, BRIAN, OPENING);
    const reference = rom.slice();
    reference.set(rom.subarray(MAP_TABLE + BRIAN_ID * 4, MAP_TABLE + BRIAN_ID * 4 + 4), MAP_TABLE + OPENING_ID * 4);
    const [vanilla, ref1, got1] = await Promise.all([play(rom), play(reference), play(build(swapped, 'swapped', ['unreferenced']))]);
    writeFileSync(join(OUT, 'vanilla-boot.png'), vanilla.png);
    writeFileSync(join(OUT, 'opening-is-brians-room.png'), got1.png);
    assert.strictEqual(got1.room, OPENING_ID, `room 0x${got1.room.toString(16)} at frame ${FRAMES}`);
    assert.notStrictEqual(got1.screen, vanilla.screen, 'the screen still shows the opening');
    assert.strictEqual(got1.vram, ref1.vram, 'VRAM is not Brian\'s room in slot 0x61');
    assert.strictEqual(got1.screen, ref1.screen, 'the screen is not Brian\'s room in slot 0x61');
    console.log(`  ✓ the opening's folder holding Brian's files boots into Brian's map (room 0x${OPENING_ID.toString(16)}, screen and VRAM as vanilla's Brian's room there)`);

    // 2. A new map: a copy of Brian's under a new name, listed last in the enum (id 0x7F, past vanilla's table).
    const added = new Map(tree);
    copyMap(added, BRIAN, COPY);
    const e = JSON.parse(Buffer.from(added.get('maps/rooms/_enum.json')!).toString());
    e.names.push(COPY);
    added.set('maps/rooms/_enum.json', new TextEncoder().encode(JSON.stringify(e)));
    added.set(`maps/rooms/${COPY}/scripts/enter.txt`, new TextEncoder().encode(FADE_FILE));
    const copied = JSON.parse(Buffer.from(added.get(`maps/rooms/${COPY}/map.json`)!).toString());
    copied.enter = { script: 'enter', word: '$0000' };
    added.set(`maps/rooms/${COPY}/map.json`, new TextEncoder().encode(JSON.stringify(copied)));
    const grown = implode(enterByScript(added, NEW_ID), GAME, KINDS);
    // The opening's enter script no longer calls its helper: implode leaves that one out, and says so.
    const leftOut = [`left-out maps/rooms/${OPENING}/scripts/enter_sub_1.txt`];
    assert.deepStrictEqual(grown.findings.list.filter(f => f.severity !== 'info').map(f => `${f.rule} ${f.file}`), leftOut);
    assert.strictEqual(grown.image!.length, 0x400000, 'the grown tables go to the 4th MB');
    const moved = grown.placed.filter(p => p.key.startsWith('maps/_') && p.at !== p.home).map(p => p.key);
    assert.deepStrictEqual(moved.sort(), ['maps/_enter_table', 'maps/_map_table']);
    // The reference: the same script entering vanilla's Brian's room (id 0x15), its enter-script record set to the same fade-in.
    const brian = rom.slice();
    brian.set([FADE_PACKED & 0xFF, (FADE_PACKED >> 8) & 0xFF, FADE_PACKED >> 16], ENTER_TABLE + BRIAN_ID * 5);
    const [ref2, got2, without] = await Promise.all([play(enter(brian, BRIAN_ID)), play(grown.image!), play(build(enterByScript(tree, NEW_ID), 'without the map', ['left-out']))]);
    writeFileSync(join(OUT, 'new-map-0x7f.png'), got2.png);
    writeFileSync(join(OUT, 'no-map-0x7f.png'), without.png);
    writeFileSync(join(OUT, 'vanilla-brians-room.png'), ref2.png);
    assert.strictEqual(ref2.room, BRIAN_ID);
    assert.strictEqual(got2.room, NEW_ID, `room 0x${got2.room.toString(16)} at frame ${FRAMES}`);
    assert.strictEqual(got2.vram, ref2.vram, 'VRAM is not Brian\'s room');
    assert.strictEqual(got2.screen, ref2.screen, 'the screen is not Brian\'s room');
    assert.notStrictEqual(without.vram, ref2.vram, 'id 0x7F shows Brian\'s room without the new map');
    console.log(`  ✓ a new map (copy of Brian's) gets id 0x${NEW_ID.toString(16)}, both tables move, load_map(0x${NEW_ID.toString(16)}) enters it (screen and VRAM as Brian's room); without the map it does not`);

    // 3. A new string, shown by a script: the key table grows past vanilla's 3,002 and moves.
    const said = new Map(tree);
    const copiedString = `string_${COPIED_STRING.toString(16).padStart(4, '0')}`;
    said.set('strings/test_new_string.txt', said.get(`strings/${copiedString}.txt`)!);
    const se = JSON.parse(Buffer.from(said.get('strings/_enum.json')!).toString());
    const key = se.names.length * 3;
    se.names.push('test_new_string');
    said.set('strings/_enum.json', new TextEncoder().encode(JSON.stringify(se)));
    const show = (t: Tree, k: number): Tree => { const o = new Map(t); o.set(INTRO_SCRIPT, new TextEncoder().encode(`51 ${(k & 0xFF).toString(16).padStart(2, '0')} ${(k >> 8).toString(16).padStart(2, '0')}\n00\n`)); return o; };
    const told = implode(show(said, key), GAME, KINDS);
    assert.deepStrictEqual(told.findings.list.filter(f => f.severity === 'error').map(f => `${f.rule} ${f.file}`), []);
    assert.ok(told.placed.some(p => p.key === 'strings/_table' && p.at !== p.home), 'the grown key table moves');
    const vanillaText = rom.slice();
    vanillaText.set([0x51, (COPIED_STRING * 3) & 0xFF, (COPIED_STRING * 3) >> 8, 0x00], INTRO);
    const [ref3, got3, noString] = await Promise.all([play(vanillaText), play(told.image!), play(build(show(tree, key), 'without the string', ['left-out']))]);
    assert.notStrictEqual(ref3.text, '00'.repeat(TEXT_BYTES), 'the reference shows no text');
    assert.strictEqual(got3.text, ref3.text, 'the new string does not decode as the one it copies');
    assert.notStrictEqual(noString.text, ref3.text, `key $${key.toString(16)} shows the text without the new string`);
    console.log(`  ✓ a new string (id ${key / 3}, key $${key.toString(16)}) grows and moves the key table; a script shows it (WRAM text as vanilla's ${copiedString}); without it the key shows something else`);
    console.log(`  screenshots: ${OUT}`);
}
