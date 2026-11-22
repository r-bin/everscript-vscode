// Open Evermore on the user's ROM (docs/open-evermore/README.md §5): explode the base ROM of the ROM library, then
// implode the tree in memory: stable gives the vanilla sha1 with no warning (G0), also with the palettes as PNGs;
// two random layouts (grown to 4 MiB) and an ExHiROM and SA-1 one place every room, the palette array and every tile, rewrite their tables and
// explode back to the same tree; an edited room, object and grass record are compressed anew; cross-kind references, colours and pixels are
// checked. Playing them is `open-evermore.mts prove` (on demand: never in a tier). Skips without the ROM.
// Run: node tests/open-evermore/g0.test.mts   (npm run build:ts first)
import assert from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { GAME, KINDS, PAST_END } from '../../tools/open-evermore/evermore/kinds.mts';
import { explode } from '../../tools/open-evermore/explode.mts';
import { HOOKS_LENGTH } from '../../tools/open-evermore/evermore/codecs/ingredient-hooks.mts';
import { implode } from '../../tools/open-evermore/implode.mts';
import { sha1 } from '../../tools/open-evermore/tree.mts';

const require = createRequire(import.meta.url);
const games = require('../../dist/games');
const { stripCopierHeader } = require('../../dist/platform/roms/header');
const { encodePng } = require('../../dist/platform/png');

const path = games.baseRomPath('evermore');
/** Where a kind lives in the tree when not at the top (folders.mts). */
const FOLDER: Record<string, string> = { maps: 'maps/rooms', scripts: 'scripts', characters: 'characters/records', music: 'music/packages', tiles: 'maps/tiles', palettes: 'maps/palettes', collisions: 'maps/collisions', opcodes: 'scripts/opcodes', sounds: 'music/sounds', animations: 'characters/animations', attack_procs: 'characters/attack_procs', behaviours: 'characters/behaviours', sprite_blocks_16: 'characters/sprite_blocks_16', sprite_blocks_8: 'characters/sprite_blocks_8', entities: 'scripts/entities', projectiles: 'characters/projectiles', fonts: 'graphics/fonts', hud: 'graphics/hud', animation_modes: 'characters/animation_modes', ring_items: 'menus/ring_items', rings: 'menus/rings', ring_flows: 'menus/ring_flows', option_actions: 'menus/option_actions', item_actions: 'menus/item_actions', alchemy_actions: 'menus/alchemy_actions', caller_actions: 'menus/caller_actions', spell_actions: 'menus/spell_actions', weapon_schools: 'equipment/weapon_schools', weapons: 'equipment/weapons', bazooka_ammo: 'equipment/bazooka_ammo', armour: 'equipment/armour', ingredients: 'alchemy/ingredients', formulas: 'alchemy/formulas', alchemy_levels: 'alchemy/alchemy_levels' };
if (!path || !existsSync(path)) {
    console.log('\nOpen Evermore G0: skipped (no Evermore base ROM in the ROM library)');
} else {
    const rom: Uint8Array = stripCopierHeader(new Uint8Array(readFileSync(path)));
    const tree = explode(rom, { release: 'us', sha1: sha1(rom), explodedWith: 'test' }, GAME, KINDS);
    console.log('\nOpen Evermore on the base ROM:');

    const stable = implode(tree, GAME, KINDS, { strict: true });
    assert.deepStrictEqual(stable.findings.list.filter(f => f.severity !== 'info'), []);
    assert.strictEqual(stable.sha1, sha1(rom));
    console.log(`  ✓ stable --strict: ${tree.size} files → the same ROM (${stable.sha1}), no warnings`);
    // Without --strict every relative call between scripts is absolute: the same scripts, a few KB longer.
    const fast = implode(tree, GAME, KINDS);
    assert.deepStrictEqual(fast.findings.list.filter(f => f.severity !== 'info' && f.rule !== 'grown'), []);
    assert.ok(fast.sha1 !== sha1(rom) && !fast.findings.list.some(f => f.rule === 'changed'), 'fast forms, nothing changed');
    console.log(`  ✓ stable: every relative call absolute, round trip holds (${fast.layout})`);

    for (const seed of [1, 2026]) {
        const r = implode(tree, GAME, KINDS, { seed });
        assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info'), []);
        const moved = r.placed.filter(p => p.at !== p.home).length;
        assert.ok(moved > 100, `only ${moved} rooms moved`);
        const families = r.placed.find(p => p.key === 'palettes/array')!;
        assert.strictEqual(r.image!.length, 0x400000, 'a random layout grows the image to 4 MiB');
        const fourth = r.placed.filter(p => p.at >= 0x300000).length;
        console.log(`  ✓ random ${seed}: ${moved} of ${r.placed.length} resources moved, ${fourth} into the 4th MB (palettes ${families.at === families.home ? 'stayed' : 'moved'}), tables rewritten, round trip holds`);
    }

    const rules = (edit: (t: typeof tree) => void, strict = false) => {
        const t = new Map(tree);
        edit(t);
        return implode(t, GAME, KINDS, { strict }).findings.list.filter(f => f.severity !== 'info').map(f => `${f.rule} ${f.file}#${f.pointer}`);
    };
    const editJson = (t: typeof tree, path: string, fn: (v: any) => void) => {
        const v = JSON.parse(Buffer.from(t.get(path)!).toString()); fn(v); t.set(path, new Uint8Array(Buffer.from(JSON.stringify(v))));
    };
    const room = [...tree.keys()].find(p => p.startsWith('maps/') && p.endsWith('/map.json'))!;
    assert.deepStrictEqual(rules(t => editJson(t, room, m => { m.palettes[0] = 'no_such_palette'; })), [`unknown-reference ${room}#/palettes/0`]);
    assert.deepStrictEqual(rules(t => editJson(t, 'maps/palettes/palette_000.json', f => { f.colours[3] = '#123456'; })), ['invalid-value maps/palettes/palette_000.json#/colours/3']);
    assert.deepStrictEqual(rules(t => editJson(t, room, m => { m.graphics.tiles[0] = 'no_such_tile'; })), [`unknown-reference ${room}#/graphics/tiles/0`]);
    const rgb = new Uint8Array(encodePng(16, 16, new Uint8Array(16 * 16 * 4).fill(255)));
    assert.deepStrictEqual(rules(t => { t.set('maps/tiles/tile_0000.png', rgb); }), ['invalid-value maps/tiles/tile_0000.png#']);
    console.log('  ✓ a map naming a missing palette or tile, a colour the SNES cannot show and a tile PNG that is not indexed are errors');

    const meta = room.replace('map.json', 'metatiles.json'), grid = room.replace('map.json', 'grid.txt');
    assert.deepStrictEqual(rules(t => editJson(t, meta, m => { m.list[0].collision = 'sticky'; })), [`invalid-value ${meta}#/list/0/collision`]);
    assert.deepStrictEqual(rules(t => { t.set(grid, new TextEncoder().encode('000 001\n000\n')); }), [`invalid-value ${grid}#/1`]);
    assert.deepStrictEqual(rules(t => editJson(t, meta, m => { m.list[0].level = 7; })), [`invalid-value ${meta}#/list/0/level`]);
    console.log('  ✓ an unknown collision form, a level past 3 and a ragged grid.txt are errors');

    // Entities and projectiles by name in script lines (`damage dog ba`): renamed everywhere, or written as the hex
    // byte, the ROM is the same; a name for nothing is an error, and a new projectile has no record to go to.
    const text = (b: Uint8Array) => Buffer.from(b).toString(), bytes = (s: string) => new Uint8Array(Buffer.from(s));
    const renamed = new Map(tree);
    const move = (from: string, to: string) => { renamed.set(to, renamed.get(from)!); renamed.delete(from); };
    move('scripts/entities/dog.json', 'scripts/entities/the_dog.json');
    move('characters/projectiles/projectile_13.json', 'characters/projectiles/hit_marker.json');
    editJson(renamed, 'scripts/entities/_enum.json', e => { e.names[0x51] = 'the_dog'; });
    editJson(renamed, 'characters/projectiles/_enum.json', e => { e.names[13] = 'hit_marker'; });
    let hex = 0;
    for (const [p, b] of renamed) {
        if (!p.endsWith('.txt') || p.startsWith('strings/')) continue;
        // A whole operand `dog` alternates with its byte `[d1]`; inside an expression it is renamed.
        const was = text(b), now = was.replace(/(?<=[ ,])projectile_13(?=,|$)/gm, 'hit_marker')
            .replace(/^[^(\n]*$/gm, l => l.replace(/(?<=^\S+ |, )dog(?=,|$)/g, () => hex++ % 2 ? 'the_dog' : '[d1]')).replace(/(?<=[ (!)])dog(?=[ ,).]|$)/gm, 'the_dog');
        if (now !== was) renamed.set(p, bytes(now));
    }
    assert.ok(hex > 100, `only ${hex} lone dogs in the scripts`);
    const same = implode(renamed, GAME, KINDS, { strict: true });
    assert.deepStrictEqual(same.findings.list.filter(f => f.severity === 'error'), []);
    assert.strictEqual(same.sha1, sha1(rom));
    const line = [...tree.keys()].find(p => p.endsWith('.txt') && !p.startsWith('strings/') && / dog(,|$)/m.test(text(tree.get(p)!)))!;
    assert.deepStrictEqual(rules(t => { t.set(line, bytes(text(t.get(line)!).replace(/ dog(,|$)/m, ' cat$1'))); }).filter(r => r.startsWith('unknown-reference')), [`unknown-reference ${line}#/${text(tree.get(line)!).split('\n').findIndex(l => / dog(,|$)/.test(l)) + 1}`]);
    assert.deepStrictEqual(rules(t => { t.set('characters/projectiles/new_shot.json', t.get('characters/projectiles/projectile_00.json')!); }).sort(), ['id-over-limit characters/projectiles/_enum.json#/names', 'no-room characters/projectiles/new_shot.json#']);
    console.log(`  ✓ entities and projectiles by name: renamed (and ${Math.ceil(hex / 2)} dogs as d1) the same ROM; an unknown name and a new projectile are errors`);

    // Script lines name rooms, objects, own animations, flag enums, attach scripts, fonts and cell values; a font is
    // a folder whose width edit lands in its table and round-trips.
    const all = [...tree].filter(([p]) => p.endsWith('.txt') && !p.startsWith('strings/')).map(([, b]) => text(b)).join('\n');
    for (const want of [/^restore_object_state (sniff|loot|door|scene|unknown)_\d\d+(_\d+)?, /m, /^load_map \d+, \d+, [a-z]/m, /, own\.[a-z_]+, /m, /^spawn [a-z_0-9]+, [A-Z_]+ ?\|? ?/m, /^attach_script .*, @/m, /^font default$/m, /^write_word PRIZE, [A-Z]/m, /^animate .*, loop$/m])
        assert.ok(want.test(all), `no line like ${want}`);
    const widened = new Map(tree);
    editJson(widened, 'graphics/fonts/default/font.json', f => { f.glyphs[1].width = 9; });
    widened.set('graphics/fonts/default/glyphs/41.png', tree.get('graphics/fonts/default/glyphs/57.png')!);
    // The HUD: a box's column lands at every site that stores it; a tile is its own PNG (the digit 0 as the digit 1).
    editJson(widened, 'graphics/hud/hud.json', h => { h.boxes.dog.column = 18; });
    widened.set('graphics/hud/tiles/digit_0.png', tree.get('graphics/hud/tiles/digit_1.png')!);
    const w = implode(widened, GAME, KINDS);
    assert.deepStrictEqual(w.findings.list.filter(f => f.severity === 'error'), []);
    assert.strictEqual(w.image![0x040002 + 128 * 24 + 1], 9, 'the width of "!" in the default font');
    const glyph = (code: number) => [...w.image!.subarray(0x040002 + 24 * (code - 0x20), 0x040002 + 24 * (code - 0x21 + 2))];
    assert.deepStrictEqual(glyph(0x41), glyph(0x57), '"A" drawn as the 16-pixel "W", both byte columns');
    assert.deepStrictEqual([w.image![0x0F8765], w.image![0x0F89D3]], [18, 18], "the Dog box's column at both sites");
    assert.deepStrictEqual([...w.image!.subarray(0x043704 + 16 * 3, 0x043704 + 16 * 4)], [...w.image!.subarray(0x043704 + 16 * 4, 0x043704 + 16 * 5)], 'digit 0 drawn as digit 1');
    assert.deepStrictEqual(rules(t => editJson(t, 'graphics/hud/hud.json', h => { h.boxes.boy.column = 30; })), ['invalid-value graphics/hud/hud.json#/boxes/boy/column']);
    console.log('  ✓ script lines name rooms, objects, own animations, flags, attach scripts, fonts, animation modes and cell values; a font width, a glyph, a HUD column and a HUD tile edit land and round-trip; a column off screen is an error');

    // Ring menus (written in place): a name in its own bytes, an option's action, an options-ring slot, a flow.
    const menus = new Map(tree);
    editJson(menus, 'menus/ring_items/option_equipment.json', v => { v.name = 'Gear'; v.action = 'alchemy'; });
    editJson(menus, 'menus/rings/boy_options.json', v => { v.items[4].item = 'option_equipment'; });
    editJson(menus, 'menus/ring_flows/boy.json', v => { v.rings = ['boy_items', 'boy_alchemy', 'boy_weapons', 'debug', 'boy_options']; });
    const mb = implode(menus, GAME, KINDS);
    assert.deepStrictEqual(mb.findings.list.filter(f => f.severity === 'error'), []);
    assert.deepStrictEqual([...mb.image!.subarray(0x0467CD, 0x0467D6)], [0x47, 0x65, 0x61, 0x72, 0, 0, 0, 0, 0], '"Gear" where "Equipment" was, the rest zero');
    assert.deepStrictEqual([mb.image![0x0E81D2], mb.image![0x0E9A9F], mb.image![0x0E998E], mb.image![0x0E9996]], [0x10, 0x20, 0x08, 0x00], 'the action index, the slot\'s immediate, the flow\'s first and last ring');
    assert.deepStrictEqual(rules(t => {
        editJson(t, 'menus/ring_items/option_targeting.json', v => { v.name = 'Targeting all'; });
        editJson(t, 'menus/ring_items/option_action.json', v => { v.action = 'no_such_action'; });
        editJson(t, 'menus/rings/dog_options.json', v => { v.items.pop(); });
        editJson(t, 'menus/ring_flows/dog.json', v => { v.rings.push('boy_items'); });
    }).sort(), ['invalid-value menus/ring_flows/dog.json#/rings', 'invalid-value menus/ring_items/option_action.json#/action', 'invalid-value menus/rings/dog_options.json#/items', 'no-room menus/ring_items/option_targeting.json#/name']);
    console.log('  ✓ ring menus: a name in its own bytes, an action by name, an options-ring item and a flow land in place; a longer name, an unknown action, a slot less and a flow longer are errors');

    // Equipment and alchemy (records written in place): Laser given Lance's block and a power, a weapon's attack and
    // school, an armour's defence, a level's factor; a text too long, a shared text changed in one record, a power past
    // a byte and a block that is none are errors.
    const eq = new Map(tree);
    editJson(eq, 'alchemy/formulas/laser.json', v => { v.power = 60; v.block = 'lance'; v.description = 'Halves HP'; });
    editJson(eq, 'equipment/weapons/bone_crusher.json', v => { v.attack = 99; v.school = 'axe'; });
    editJson(eq, 'equipment/armour/grass_vest.json', v => { v.defense = 50; });
    editJson(eq, 'alchemy/alchemy_levels/level_0.json', v => { v.power_factor = 9; });
    const eb = implode(eq, GAME, KINDS);
    assert.deepStrictEqual(eb.findings.list.filter(f => f.severity === 'error'), []);
    const w16 = (at: number) => eb.image![at] | (eb.image![at + 1] << 8);
    assert.deepStrictEqual([w16(0x045E6B + 40), w16(0x045DDF + 40), w16(0x0438E6), w16(0x0459DC + 2), w16(0x043B02), eb.image![0x045BA5]], [60, 0x26, 99, 2, 50, 9], 'power, block, attack, school, defence, factor in place');
    assert.deepStrictEqual([...eb.image!.subarray(0x040000 + w16(0x045D51 + 40), 0x040000 + w16(0x045D51 + 40) + 10)], [...Buffer.from('Halves HP'), 0], 'the shorter description where it was');
    assert.deepStrictEqual(rules(t => {
        editJson(t, 'alchemy/formulas/laser.json', v => { v.description = 'Halves the target enemy HP!'; });
        editJson(t, 'equipment/armour/shell_plate.json', v => { v.text_2 = 'x'; });
        editJson(t, 'alchemy/formulas/heal.json', v => { v.power = 300; v.block = 'no_block'; });
    }).sort(), ['invalid-value alchemy/formulas/heal.json#/power', 'no-room alchemy/formulas/laser.json#/description', 'no-room equipment/armour/shell_plate.json#/text_2', 'unknown-reference alchemy/formulas/heal.json#/block']);
    console.log('  ✓ equipment and alchemy: a formula\'s block, power and description, a weapon\'s attack and school, an armour\'s defence and a level\'s factor land in place; a longer text, a power past a byte and an unknown block are errors');

    // A 23rd ingredient (docs/todo/growable-items.md): a cost of Cure, its name, icon and count cell generated, every
    // count reader a jsl into the hooks, the alchemy screen's loops one longer (in game by hand: docs/todo/growable-items.md I-steps).
    const ing = new Map(tree);
    ing.set('alchemy/ingredients/salt.json', new Uint8Array(Buffer.from(JSON.stringify({ text: 'Salt', held: 'temp[198]', icon: 'crystal' }))));
    editJson(ing, 'alchemy/ingredients/_enum.json', v => { v.names.push('salt'); });
    editJson(ing, 'alchemy/formulas/cure.json', v => { v.cost[1].ingredient = 'salt'; });
    const gb = implode(ing, GAME, KINDS);
    assert.deepStrictEqual(gb.findings.list.filter(f => f.severity !== 'info'), []);
    const gi = gb.image!, u24 = (at: number) => gi[at] | (gi[at + 1] << 8) | (gi[at + 2] << 16);
    for (const site of [0x0DC1AD, 0x0DC2CE, 0x0EA923, 0x11CDF1, 0x11CDF8, 0x11CE1E, 0x11CE25, 0x11CE4C, 0x11CE70, 0x0E8DC5, 0x0E8DDF]) assert.strictEqual(gi[site], 0x22, `a jsl at ${site.toString(16)}`);
    assert.deepStrictEqual([gi[0x0DC1AB], gi[0x0DC2CC]], [22, 22], 'the alchemy screen counts down from id 22');
    const table = u24(0x0DC1F7) & 0x3FFFFF, salt = ((gi[0x0DC1F3] << 16) | gi[table + 44] | (gi[table + 45] << 8)) & 0x3FFFFF;
    assert.strictEqual(Buffer.from(gi.subarray(salt, salt + 5)).toString('latin1'), 'Salt\0', 'the name in the moved table');
    const icons = u24(0x0DBE5F) & 0x3FFFFF;
    assert.strictEqual(u24(icons + 3 * 22), u24(icons + 3 * 15), 'Crystal\'s icon');
    assert.strictEqual(u24(0x0DBE65), u24(0x0DBE5F) + 1, 'both icon reads moved');
    const cells = (u24(0x0DC1AE) & 0x3FFFFF) + HOOKS_LENGTH;
    assert.strictEqual(gi[cells] | (gi[cells + 1] << 8), 0x28FA, 'temp[198] counts it');
    assert.strictEqual(gi[0x04601F + 4 * 6 + 1], 22, 'Cure costs it');
    assert.deepStrictEqual(rules(t => {
        t.set('alchemy/ingredients/salt.json', new Uint8Array(Buffer.from(JSON.stringify({ text: 'Salt', held: 'temp[200]', icon: 'salt' }))));
        editJson(t, 'alchemy/ingredients/_enum.json', v => { v.names.push('salt'); });
    }).sort(), ['invalid-value alchemy/ingredients/salt.json#/held']);
    assert.deepStrictEqual(rules(t => {
        t.set('alchemy/ingredients/salt.json', new Uint8Array(Buffer.from(JSON.stringify({ text: 'Salt', held: 'temp[198]', icon: 'salt' }))));
        editJson(t, 'alchemy/ingredients/_enum.json', v => { v.names.push('salt'); });
    }).sort(), ['unknown-reference alchemy/ingredients/salt.json#/icon']);
    console.log('  ✓ a 23rd ingredient: a formula\'s cost, its name, icon and count cell generated, 11 count readers and the alchemy screen redirected; a cell past temp[] and an icon of no vanilla ingredient are errors');

    // An edited metatile: the room is compressed anew, the ROM still builds and explodes back to the edit.
    const edited = new Map(tree);
    editJson(edited, meta, m => { if (m.list[0].inFront) delete m.list[0].inFront; else m.list[0].inFront = true; });
    const e = implode(edited, GAME, KINDS);
    assert.deepStrictEqual(e.findings.list.filter(f => f.severity === 'error'), []);
    assert.notStrictEqual(e.sha1, sha1(rom));
    // A collision form is a name of collisions/_enum.json: renamed there (and its file, and the metatiles), the same ROM.
    const wall = new Map(tree), formsEnum = 'maps/collisions/_enum.json';
    editJson(wall, formsEnum, e => { e.names[e.names.indexOf('solid')] = 'wall'; });
    wall.set('maps/collisions/wall.json', wall.get('maps/collisions/solid.json')!);
    wall.delete('maps/collisions/solid.json');
    for (const p of [...wall.keys()].filter(p => p.endsWith('/metatiles.json'))) editJson(wall, p, m => { for (const x of m.list) if (x.collision === 'solid') x.collision = 'wall'; });
    const walled = implode(wall, GAME, KINDS, { strict: true });
    assert.deepStrictEqual(walled.findings.list.filter(f => f.severity === 'error'), []);
    assert.strictEqual(walled.sha1, sha1(rom), 'a renamed form is the same ROM');
    console.log('  ✓ an edited metatile is compressed anew and round-trips; a form renamed in collisions/ builds the same ROM');

    // Objects and cuttable grass are text (objects.json, grass.json): an edited state and an edited grass record build
    // and explode back to the edit; a token that is no metatile is an error at its row.
    const grassRoom = [...tree.keys()].find(p => p.endsWith('/grass.json') && JSON.parse(Buffer.from(tree.get(p)!).toString()).list.length)!;
    const objects = grassRoom.replace('grass.json', 'objects.json');
    const changed = new Map(tree);
    editJson(changed, objects, o => { const st = o.list[0].states[0]; st.cells[0] = st.cells[0].replace(/^\s*[0-9a-f]+/, '000'); });
    editJson(changed, grassRoom, m => { m.list[0].into = [m.list[1].into[0]]; });
    const c = implode(changed, GAME, KINDS);
    assert.deepStrictEqual(c.findings.list.filter(f => f.severity === 'error'), []);
    assert.notStrictEqual(c.sha1, sha1(rom));
    assert.deepStrictEqual(rules(t => editJson(t, objects, o => { const st = o.list[0].states[0]; st.cells[0] = st.cells[0].replace(/^\s*\S+/, 'zzz'); })), [`invalid-value ${objects}#/list/0/states/0/cells/0`]);
    assert.deepStrictEqual(rules(t => editJson(t, grassRoom, m => { m.list[0].cut = 'fff'; })), [`invalid-value ${grassRoom}#/list/0`]);
    console.log('  ✓ an edited object state and grass record build and round-trip; a cell that is no metatile is an error');

    const other = explode(rom, { release: 'us', sha1: sha1(rom), explodedWith: 'test' }, GAME, KINDS, undefined, { palettes: { format: 'png' }, tiles: { format: 'json' } });
    assert.ok(other.has('maps/palettes/palette_000.png') && other.has('maps/tiles/tile_0000.json'));
    const p = implode(other, GAME, KINDS, { strict: true });
    assert.deepStrictEqual(p.findings.list.filter(f => f.severity !== 'info'), []);
    assert.strictEqual(p.sha1, sha1(rom));
    assert.deepStrictEqual(rules(t => { t.delete('maps/tiles/tile_0000.png'); t.set('maps/tiles/tile_0000.json', other.get('maps/tiles/tile_0000.json')!); }), []);
    console.log('  ✓ palettes as PNG stripes and tiles as JSON rows: the same ROM; one tile as JSON among PNGs too');

    // Strings: an unknown tag is an error; an edited string is encoded anew (our encoder) and explodes back.
    assert.deepStrictEqual(rules(t => { t.set('strings/string_0000.txt', new TextEncoder().encode('Hello [WAVE]\n')); }), ['invalid-value strings/string_0000.txt#']);
    const said = new Map(tree);
    said.set('strings/string_0375.txt', new TextEncoder().encode('[SLOW]Whoa![PAUSE:3d] Now I know how a moved string feels.[B]\n'));
    const sr = implode(said, GAME, KINDS);
    assert.deepStrictEqual(sr.findings.list.filter(f => f.severity === 'error'), []);
    assert.ok(sr.findings.list.some(f => f.rule === 'reencoded' && f.file === 'strings/string_0375.txt'));
    console.log('  ✓ strings: an unknown tag is an error; an edited string is encoded anew and round-trips');

    // Scripts: one file per script, a command per line (the opcode by name, its operands in hex), `@name` for another
    // script (calls by global or trigger id too), labels for jumps; a room's scripts in scripts/rooms/<map>/, named in
    // full by its scripts.json. An edited script round-trips (an opcode as hex too); a name that is no script, an
    // opcode that is none and operands that are no bytes are errors; a relative call out of reach takes the absolute
    // form, an error only with --strict.
    const enter = 'scripts/rooms/podunk_opening_over_the_machine/enter.txt';
    assert.ok(tree.has(enter) && tree.has('scripts/global/boot.txt') && tree.has('scripts/_scripts.json') && tree.has('scripts/_enum.json'));
    assert.ok(![...tree.keys()].some(p => /^maps\/rooms\/[^/]+\/scripts\//.test(p)), 'no script inside a map folder');
    const opening = JSON.parse(Buffer.from(tree.get('maps/rooms/podunk_opening_over_the_machine/scripts.json')!).toString());
    assert.strictEqual(opening.enter, 'podunk_opening_over_the_machine/enter');
    assert.strictEqual(opening.enterWord, 1);
    const isScript = (p: string) => /^scripts\/(global|rooms\/[^/]+)\/[^_/][^/]*\.txt$/.test(p);
    const scriptCount = [...tree.keys()].filter(isScript).length, inRooms = [...tree.keys()].filter(p => isScript(p) && p.startsWith('scripts/rooms/')).length;
    assert.ok(scriptCount > 3000 && inRooms > 2000, `${scriptCount} script files, ${inRooms} in rooms`);
    // Triggers and objects are named by what they do; a room script by the first trigger that runs it.
    const roomScripts = [...tree.keys()].filter(p => p.endsWith('/scripts.json')).map(p => JSON.parse(Buffer.from(tree.get(p)!).toString()));
    const triggers = roomScripts.flatMap(v => [...v.stepOn, ...v.bTrigger]);
    assert.ok(triggers.length > 2000 && triggers.every(t => /^(door|sniff|loot|scene|unknown)_\d\d+$/.test(t.name) && typeof t.script === 'string' && tree.has(`scripts/rooms/${t.script}.txt`)), 'triggers are named and name their scripts');
    for (const what of ['door', 'sniff', 'loot', 'scene']) assert.ok(triggers.some(t => t.name.startsWith(what + '_')), `no ${what} trigger`);
    const objectLists = [...tree.keys()].filter(p => p.endsWith('/objects.json')).map(p => JSON.parse(Buffer.from(tree.get(p)!).toString()).list);
    assert.ok(objectLists.flat().every((o: { name?: unknown; id?: unknown }) => typeof o.name === 'string' && o.id === undefined), 'every object has a name');
    assert.ok(objectLists.flat().some((o: { name: string }) => o.name.startsWith('sniff_')), 'sniff spots name their objects');
    const lines = (p: string) => Buffer.from(tree.get(p)!).toString().split('\n');
    const caller = [...tree.keys()].find(p => isScript(p) && lines(p).some(l => /^call @/.test(l)))!;
    const relative = [...tree.keys()].find(p => isScript(p) && lines(p).some(l => /^call_back @/.test(l)))!;
    const setLines = (t: typeof tree, p: string, edit: (l: string[]) => string[]) => t.set(p, new TextEncoder().encode(edit(lines(p)).join('\n')));
    // (the script it no longer names is left out: a warning)
    assert.deepStrictEqual(rules(t => setLines(t, caller, l => l.map(x => x.replace(/^call @\S+/, 'call @no_such_script')))).filter(r => !r.startsWith('left-out')), [`unknown-reference ${caller}#/${lines(caller).findIndex(l => /^call @/.test(l)) + 1}`]);
    assert.deepStrictEqual(rules(t => setLines(t, enter, l => ['no_such_opcode', ...l])), [`unknown-reference ${enter}#/1`]);
    assert.deepStrictEqual(rules(t => setLines(t, enter, l => ['end 1z', ...l])), [`invalid-value ${enter}#/1`]);
    const farCall = (t: typeof tree) => setLines(t, relative, l => l.map(x => x.replace(/^call_back @\S+/, 'call_back @boot')));
    assert.deepStrictEqual(rules(farCall).filter(r => !r.startsWith('left-out')), []);
    const r1 = rules(farCall, true).filter(r => !r.startsWith('left-out'));
    assert.ok(r1.length && r1.every(r => r.startsWith(`out-of-range ${relative}#`) || r.startsWith('left-out')), r1.join());
    const globalCall = [...tree.keys()].flatMap(p => isScript(p) && p.startsWith('scripts/global/') ? lines(p).filter(l => /^call_global @[a-z0-9_]+$/.test(l)) : [])[0];
    assert.ok(globalCall, 'global calls name their script');
    const sc = implode((() => { const t = new Map(tree); setLines(t, enter, l => ['a3 0x36', 'call_global 0x36', globalCall.replace('@', '@/'), ...l]); return t; })(), GAME, KINDS);
    assert.deepStrictEqual(sc.findings.list.filter(f => f.severity === 'error'), []);
    // A global call names a script with a global id.
    assert.deepStrictEqual(rules(t => setLines(t, enter, l => [`call_global @${enter.split('/')[2]}/enter`, ...l])).map(r => r.split(' ')[0]), ['unknown-reference']);
    // Jumps are labels: a line added before a jump moves its target, and the script still builds.
    const jumper = [...tree.keys()].find(p => isScript(p) && lines(p).some(l => /^goto label_\d+$/.test(l)) && lines(p).some(l => /^label_\d+:$/.test(l)))!;
    const longer = implode((() => { const t = new Map(tree); setLines(t, jumper, l => ['yield', ...l]); return t; })(), GAME, KINDS);
    assert.deepStrictEqual(longer.findings.list.filter(f => f.severity === 'error'), []);
    assert.deepStrictEqual(rules(t => setLines(t, jumper, l => l.filter(x => !/^label_\d+:$/.test(x)))).filter(r => !r.startsWith('left-out')).map(r => r.split(' ')[0]).filter((r, i, a) => a.indexOf(r) === i), ['unknown-reference']);
    // A random build places every script alone (relative calls become absolute); --strict keeps vanilla's groups.
    const groupKeys = (r: ReturnType<typeof implode>) => r.placed.filter(p => p.key.startsWith('scripts/') && p.segments.length > 1 && new Set(p.segments.map(g => g.key)).size > 1).length;
    const loose = implode(tree, GAME, KINDS, { seed: 7 }), tight = implode(tree, GAME, KINDS, { seed: 7, strict: true });
    assert.deepStrictEqual([...loose.findings.list, ...tight.findings.list].filter(f => f.severity !== 'info'), []);
    assert.ok(groupKeys(loose) === 0 && groupKeys(tight) > 100, `groups placed together: ${groupKeys(loose)} random, ${groupKeys(tight)} strict`);
    assert.ok(!loose.findings.list.some(f => f.rule === 'changed'), 'absolute calls are the same scripts');
    console.log(`  ✓ scripts: ${scriptCount} files (${inRooms} in scripts/rooms/, enter and named triggers in scripts.json, objects named); an edited script builds and round-trips; an unknown @name or opcode, operands that are no bytes and a jump to no label are errors; a relative call out of reach is promoted (an error with --strict); a random build places each script alone, --strict keeps the groups`);

    // Every table grows past vanilla and moves (the engine limits: 256 maps, 21,845 tiles and strings, 21,625 scripts).
    const grow = (dir: string, from: string, to: string, ext: string) => (t: typeof tree) => {
        t.set(`${dir}/${to}.${ext}`, t.get(`${dir}/${from}.${ext}`)!);
        editJson(t, `${dir}/_enum.json`, e => { e.names.push(to); });
    };
    const grown = new Map(tree);
    grow('maps/tiles', 'tile_0000', 'tile_new', 'png')(grown);
    grow('strings', 'string_0000', 'string_new', 'txt')(grown);
    grown.set('scripts/global/script_new.txt', grown.get('scripts/global/boot.txt')!);
    editJson(grown, 'scripts/_enum.json', e => { e.names.push('script_new'); });
    const g = implode(grown, GAME, KINDS);
    assert.deepStrictEqual(g.findings.list.filter(f => f.severity !== 'info' && f.rule !== 'unreferenced').map(f => `${f.rule} ${f.file}`), []);
    for (const key of ['tiles/_table', 'strings/_table', 'scripts/_table']) assert.ok(g.placed.some(p => p.key === key && p.at !== p.home), `${key} did not move`);
    for (const [kind, limit] of [['maps', 256], ['tiles', 21845], ['strings', 21845], ['scripts', 21625], ['animations', 2048], ['characters', 256], ['sprite_blocks_16', 21845], ['sprite_blocks_8', 21845], ['opcodes', 195], ['attack_procs', 15], ['behaviours', 15], ['music', 71], ['sounds', 112], ['entities', 0x70], ['projectiles', 16], ['fonts', 2], ['hud', 22], ['animation_modes', 6], ['ring_items', 162], ['rings', 18], ['ring_flows', 12], ['option_actions', 9], ['item_actions', 9], ['alchemy_actions', 36], ['caller_actions', 4], ['spell_actions', 18], ['ingredients', 64]] as const) assert.strictEqual(JSON.parse(Buffer.from(tree.get(`${FOLDER[kind] ?? kind}/_enum.json`)!).toString()).limit, limit, kind);
    console.log('  ✓ a new tile, string and table script: each table grows and moves, the round trip holds; limits at the engine\'s');

    // The table kinds of the table hack: a new animation, character (a record and an ENEMY id) and sprite blocks grow
    // their tables, which move; the records stay one block at $xx:B678; an alias keeps its run together.
    const more = new Map(tree);
    const firstAnimation = JSON.parse(Buffer.from(tree.get('characters/animations/_enum.json')!).toString()).names[0];
    grow('characters/animations', firstAnimation, 'animation_new', 'json')(more);
    for (const f of ['character.json', 'animations.json']) more.set(`characters/records/fire_eyes_copy/${f}`, more.get(`characters/records/fire_eyes/${f}`)!);
    editJson(more, 'characters/records/_enum.json', e => { e.names.push('fire_eyes_copy'); });
    editJson(more, 'characters/records/_records.json', e => { e.names.push('fire_eyes_copy'); });
    grow('characters/sprite_blocks_16', 'block_0000', 'block_new', 'png')(more);
    grow('characters/sprite_blocks_8', 'block_0000', 'block_new', 'png')(more);
    assert.ok(more.has('characters/sprite_blocks_8/block_17c5.json'), 'the 8×8 alias (block 6085 reads blocks 0 and 407)');
    const m = implode(more, GAME, KINDS, { seed: 5 });
    assert.deepStrictEqual(m.findings.list.filter(f => f.severity !== 'info').map(f => `${f.rule} ${f.file}`), []);
    // Each table grew past its vanilla footprint (it moves, or grows in place where the bytes after it are free).
    for (const key of ['animations/_table', 'characters/_enemy_index', 'sprite_blocks_16/_table', 'sprite_blocks_8/_table']) {
        const before = stable.placed.find(p => p.key === key)!, after = m.placed.find(p => p.key === key)!;
        assert.ok(after.length > before.length, `${key} did not grow (${before.length} → ${after.length})`);
    }
    assert.ok(m.placed.every(p => p.key !== 'characters/_records' || (p.at & 0xFFFF) === 0xB678), 'the records keep $B678');
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/_records.json', e => { e.names.push('nobody'); })), ['unknown-reference characters/records/_records.json#/names/142']);
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/fire_eyes/character.json', c => { c.hp = 70000; })), ['invalid-value characters/records/fire_eyes/character.json#/hp']);
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/fire_eyes/animations.json', a => { a.stand.record = 'x'; })), ['invalid-value characters/records/fire_eyes/animations.json#/stand/record']);
    // Fields by name: the behaviour and the attack proc name entries of their kinds, flags are their bits' names.
    const fire = JSON.parse(Buffer.from(tree.get('characters/records/fire_eyes/character.json')!).toString());
    assert.ok(tree.has(`characters/behaviours/${fire.behaviour}.json`) && tree.has(`characters/attack_procs/${fire.attack_proc}.json`), `${fire.behaviour}, ${fire.attack_proc}`);
    assert.ok([...tree.keys()].some(p => p.endsWith('/character.json') && / \| /.test(JSON.parse(Buffer.from(tree.get(p)!).toString()).flags ?? '')), 'flags as names');
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/fire_eyes/character.json', c => { c.attack_proc = 'tickle'; })), ['unknown-reference characters/records/fire_eyes/character.json#/attack_proc']);
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/fire_eyes/character.json', c => { c.flags = 'invincible | shiny'; })), ['invalid-value characters/records/fire_eyes/character.json#/flags']);
    const poisoned = implode((() => { const t = new Map(tree); editJson(t, 'characters/records/fire_eyes/character.json', c => { c.attack_proc = 'melee_poison'; c.flags = 'never_sleeps | through_bodies'; }); return t; })(), GAME, KINDS);
    assert.deepStrictEqual(poisoned.findings.list.filter(f => f.severity === 'error'), []);
    // Handlers by routine name: opcodes, attack procs, behaviours.
    const animate = JSON.parse(Buffer.from(tree.get('scripts/opcodes/animate.json')!).toString());
    assert.ok(animate.handler === 'script_op_78_animate' && !('c' in animate), JSON.stringify(animate).slice(0, 80));
    assert.ok([...tree.keys()].filter(p => /^(scripts\/opcodes|characters\/attack_procs|characters\/behaviours)\/[^_]/.test(p)).every(p => !JSON.parse(Buffer.from(tree.get(p)!).toString()).handler.startsWith('$')), 'every handler has a name');
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/attack_procs/melee.json', v => { v.handler = 'no_such_routine'; })), ['unknown-reference characters/attack_procs/melee.json#/handler']);
    console.log('  ✓ animations, characters (records + ENEMY ids), sprite blocks: new ones grow and move their tables (random), records stay at $B678; a bad record, field or animation is an error');
    console.log('  ✓ characters name their behaviour and attack proc, flags by bit names; handlers of opcodes, attack procs and behaviours by routine name');

    // Music: packages and their data move anywhere (random above); an edited package rebuilds; a package naming data
    // that does not exist, and a sound that is no number, are errors.
    const musicFiles = [...tree.keys()].filter(p => p.startsWith('music/'));
    assert.ok(musicFiles.filter(p => p.endsWith('/package.json')).length === 71 && musicFiles.filter(p => p.endsWith('.bin')).length > 2000, `${musicFiles.length} music files`);
    assert.deepStrictEqual(rules(t => editJson(t, 'music/packages/main_title/package.json', m => { m.transfers[0].data = 'nothing'; })).filter(r => !r.startsWith('left-out')), ['unknown-reference music/packages/main_title/package.json#/transfers/0/data']);
    const someSound = JSON.parse(Buffer.from(tree.get('music/sounds/_enum.json')!).toString()).names[1];
    assert.deepStrictEqual(rules(t => editJson(t, `music/sounds/${someSound}.json`, v => { v.sfx = 'loud'; })), [`invalid-value music/sounds/${someSound}.json#/sfx`]);
    const swapped = implode((() => { const t = new Map(tree); editJson(t, 'music/packages/main_title/package.json', m => { m.transfers.reverse(); }); return t; })(), GAME, KINDS);
    assert.deepStrictEqual(swapped.findings.list.filter(f => f.severity === 'error'), []);
    console.log('  ✓ music: 71 packages, their data as .bin; an edited package rebuilds; unknown data or a bad sound is an error');

    for (const layout of ['exhirom', 'sa1']) {
        const t = new Map(tree);
        editJson(t, 'manifest.json', m => { m.memoryMap.layout = layout; m.memoryMap.size = '8MiB'; });
        const r = implode(t, GAME, KINDS, { seed: 3, pastEnd: PAST_END });
        assert.deepStrictEqual(r.findings.list.filter(f => f.severity !== 'info'), [], layout);
        assert.strictEqual(r.image!.length, 0x800000);
        const second = r.placed.filter(p => p.at >= 0x400000).length;
        if (layout === 'exhirom') assert.ok(second > 100, `only ${second} resources in the second 4 MB`);
        console.log(`  ✓ ${layout}: an 8 MiB image, round trip holds${layout === 'exhirom' ? `, ${second} resources in $41-$7D` : ''}`);
    }
}
