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
const FOLDER: Record<string, string> = { maps: 'maps/rooms', scripts: 'scripts', characters: 'characters/records', music: 'music/packages', tiles: 'maps/tiles', palettes: 'palettes/backgrounds', sprite_palettes: 'palettes/sprites', collisions: 'maps/collisions', opcodes: 'scripts/opcodes', sounds: 'music/sounds', animations: 'animations', animation_modes: 'animations/modes', attack_procs: 'characters/attack_procs', behaviours: 'characters/behaviours', sprite_blocks_16: 'sprites/blocks_16', sprite_blocks_8: 'sprites/blocks_8', metasprites: 'sprites/metasprites', entities: 'scripts/entities', projectiles: 'characters/projectiles', experience: 'characters/experience', fonts: 'graphics/fonts', hud: 'graphics/hud', ring_items: 'menus/ring_items', strings: 'strings/dialogue', texts: 'strings/menu', rings: 'menus/rings', ring_flows: 'menus/ring_flows', option_actions: 'menus/option_actions', item_actions: 'menus/item_actions', alchemy_actions: 'menus/alchemy_actions', caller_actions: 'menus/caller_actions', spell_actions: 'menus/spell_actions', weapon_schools: 'equipment/weapon_schools', weapons: 'equipment/weapons', bazooka_ammo: 'equipment/bazooka_ammo', armour: 'equipment/armour', ingredients: 'alchemy/ingredients', formulas: 'alchemy/formulas', alchemy_levels: 'alchemy/alchemy_levels', consumables: 'items/consumables', named_items: 'items/named_items' };
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
    assert.deepStrictEqual(rules(t => editJson(t, 'palettes/backgrounds/palette_000.json', f => { f.colours[3] = '#123456'; })), ['invalid-value palettes/backgrounds/palette_000.json#/colours/3']);
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
    move('characters/projectiles/cutscene_trail.json', 'characters/projectiles/hit_marker.json');
    editJson(renamed, 'scripts/entities/_enum.json', e => { e.names[0x51] = 'the_dog'; });
    editJson(renamed, 'characters/projectiles/_enum.json', e => { e.names[13] = 'hit_marker'; });
    let hex = 0;
    for (const [p, b] of renamed) {
        if (!p.endsWith('.txt') || p.startsWith('strings/')) continue;
        // A whole operand `dog` alternates with its byte `[d1]`; inside an expression it is renamed.
        const was = text(b), now = was.replace(/(?<=[ ,])cutscene_trail(?=,|$)/gm, 'hit_marker')
            .replace(/^[^(\n]*$/gm, l => l.replace(/(?<=^\S+ |, )dog(?=,|$)/g, () => hex++ % 2 ? 'the_dog' : '[d1]')).replace(/(?<=[ (!)])dog(?=[ ,).]|$)/gm, 'the_dog');
        if (now !== was) renamed.set(p, bytes(now));
    }
    assert.ok(hex > 100, `only ${hex} lone dogs in the scripts`);
    const same = implode(renamed, GAME, KINDS, { strict: true });
    assert.deepStrictEqual(same.findings.list.filter(f => f.severity === 'error'), []);
    assert.strictEqual(same.sha1, sha1(rom));
    const line = [...tree.keys()].find(p => p.endsWith('.txt') && !p.startsWith('strings/') && / dog(,|$)/m.test(text(tree.get(p)!)))!;
    assert.deepStrictEqual(rules(t => { t.set(line, bytes(text(t.get(line)!).replace(/ dog(,|$)/m, ' cat$1'))); }).filter(r => r.startsWith('unknown-reference')), [`unknown-reference ${line}#/${text(tree.get(line)!).split('\n').findIndex(l => / dog(,|$)/.test(l)) + 1}`]);
    assert.deepStrictEqual(rules(t => { t.set('characters/projectiles/new_shot.json', t.get('characters/projectiles/tiny_juggle.json')!); }).sort(), ['no-room characters/projectiles/new_shot.json#']);
    assert.deepStrictEqual(rules(t => { t.set('characters/projectiles/new_shot.json', t.get('characters/projectiles/tiny_juggle.json')!); editJson(t, 'characters/projectiles/_enum.json', e => { e.names.push('new_shot'); }); }).sort(), ['id-over-limit characters/projectiles/_enum.json#/names', 'no-room characters/projectiles/new_shot.json#']);
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
    const setText = (t: typeof tree, name: string, s: string) => t.set(`strings/menu/${name}.txt`, new Uint8Array(Buffer.from(`${s}\n`)));
    setText(menus, 'equipment', 'Gear');
    editJson(menus, 'menus/ring_items/option_equipment.json', v => { v.action = 'menus/option_actions/alchemy'; });
    editJson(menus, 'menus/rings/boy_options.json', v => { v.items[4].item = 'option_equipment'; });
    editJson(menus, 'menus/ring_flows/boy.json', v => { v.rings = ['boy_items', 'boy_alchemy', 'boy_weapons', 'debug', 'boy_options']; });
    const mb = implode(menus, GAME, KINDS);
    assert.deepStrictEqual(mb.findings.list.filter(f => f.severity === 'error'), []);
    assert.deepStrictEqual([...mb.image!.subarray(0x0467CD, 0x0467D6)], [0x47, 0x65, 0x61, 0x72, 0, 0, 0, 0, 0], '"Gear" where "Equipment" was, the rest zero');
    assert.deepStrictEqual([mb.image![0x0E81D2], mb.image![0x0E9A9F], mb.image![0x0E998E], mb.image![0x0E9996]], [0x10, 0x20, 0x08, 0x00], 'the action index, the slot\'s immediate, the flow\'s first and last ring');
    assert.deepStrictEqual(rules(t => {
        editJson(t, 'menus/ring_items/option_equipment.json', v => { v.name = 'strings/menu/no_such_text'; });
        editJson(t, 'menus/ring_items/option_action.json', v => { v.action = 'no_such_action'; });
        editJson(t, 'menus/rings/dog_options.json', v => { v.items.pop(); });
        editJson(t, 'menus/ring_flows/dog.json', v => { v.rings.push('boy_items'); });
    }).sort(), ['invalid-value menus/ring_flows/dog.json#/rings', 'invalid-value menus/ring_items/option_action.json#/action', 'invalid-value menus/rings/dog_options.json#/items', 'unknown-reference menus/ring_items/option_equipment.json#/name']);
    // A text longer than its home goes anywhere free in bank $C4: vanilla has no free byte there.
    assert.deepStrictEqual(rules(t => setText(t, 'targeting', 'Targeting all')), ['no-space strings/menu/targeting.txt#']);
    console.log('  ✓ ring menus: a name in its own bytes, an action by name, an options-ring item and a flow land in place; a longer text, a text that is none, an unknown action, a slot less and a flow longer are errors');

    // Equipment and alchemy (records written in place): Laser given Lance's block and a power, a weapon's attack and
    // school, an armour's defence, a level's factor; a text too long, a shared text changed in one record, a power past
    // a byte and a block that is none are errors.
    const eq = new Map(tree);
    editJson(eq, 'alchemy/formulas/laser.json', v => { v.power = 60; v.block = 'lance'; });
    setText(eq, 'halves_targets_hp', 'Halves HP');
    editJson(eq, 'equipment/weapons/bone_crusher.json', v => { v.attack = 99; v.school = 'axe'; });
    editJson(eq, 'equipment/armour/grass_vest.json', v => { v.defense = 50; });
    editJson(eq, 'alchemy/alchemy_levels/level_0.json', v => { v.power_factor = 9; });
    const eb = implode(eq, GAME, KINDS);
    assert.deepStrictEqual(eb.findings.list.filter(f => f.severity === 'error'), []);
    const w16 = (at: number) => eb.image![at] | (eb.image![at + 1] << 8);
    assert.deepStrictEqual([w16(0x045E6B + 40), w16(0x045DDF + 40), w16(0x0438E6), w16(0x0459DC + 2), w16(0x043B02), eb.image![0x045BA5]], [60, 0x26, 99, 2, 50, 9], 'power, block, attack, school, defence, factor in place');
    assert.deepStrictEqual([...eb.image!.subarray(0x040000 + w16(0x045D51 + 40), 0x040000 + w16(0x045D51 + 40) + 10)], [...Buffer.from('Halves HP'), 0], 'the shorter description where it was');
    assert.deepStrictEqual(rules(t => {
        editJson(t, 'equipment/armour/shell_plate.json', v => { v.text_2 = 'x'; });
        editJson(t, 'alchemy/formulas/heal.json', v => { v.power = 300; v.block = 'no_block'; });
    }).sort(), ['invalid-value alchemy/formulas/heal.json#/power', 'unknown-reference alchemy/formulas/heal.json#/block', 'unknown-reference equipment/armour/shell_plate.json#/text_2']);
    console.log('  ✓ equipment and alchemy: a formula\'s block, power and description, a weapon\'s attack and school, an armour\'s defence and a level\'s factor land in place; a longer text, a power past a byte and an unknown block are errors');

    // Targets are shared and named by their rules: a hand-made target on Fireball and a formula's target on Petals store
    // their words; the round trip reads the hand-made name back as its rules' name. An unknown rule or target is an error.
    const tg = new Map(tree), bytesOf = (v: unknown) => new Uint8Array(Buffer.from(JSON.stringify(v)));
    tg.set('targets/boy_and_dog.json', bytesOf({ rules: ['boy', 'dog', 'or_all'] }));
    editJson(tg, 'alchemy/formulas/fireball.json', v => { v.target = 'targets/boy_and_dog'; });
    editJson(tg, 'items/consumables/petals.json', v => { v.target = 'targets/enemies_nearest_three'; });
    const tb = implode(tg, GAME, KINDS);
    assert.deepStrictEqual(tb.findings.list.filter(f => f.severity === 'error'), []);
    const fireball = JSON.parse(Buffer.from(tree.get('alchemy/formulas/_enum.json')!).toString()).names.indexOf('fireball');
    const t16 = (at: number) => tb.image![at] | (tb.image![at + 1] << 8);
    assert.deepStrictEqual([t16(0x045BF5 + 2 * fireball), t16(0x045A84)], [0x0C02, 0x2010], 'Fireball\'s and Petals\' target words');
    assert.deepStrictEqual(rules(t => {
        t.set('targets/boy_and_dog.json', bytesOf({ rules: ['boy', 'cat'] }));
        editJson(t, 'alchemy/formulas/heal.json', v => { v.target = 'targets/no_such_target'; });
    }).sort(), ['invalid-value targets/boy_and_dog.json#/rules', 'unknown-reference alchemy/formulas/heal.json#/target']);
    console.log('  ✓ targets: a hand-made target and a shared one land as their words and round-trip; an unknown rule and an unknown target are errors');

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

    // A 10th consumable and a 21st named item (docs/todo/growable-items.md C1, N2): the consumable on a debug ring item, its
    // count, dispatch and tables generated; the named item's four tables, icons and strings moved, every loop one longer
    // (in game by hand: the Salve heals by its power, the Lucky Coin shows in the Pouch).
    const it = new Map(tree), json = (v: unknown) => new Uint8Array(Buffer.from(JSON.stringify(v)));
    setText(it, 'debug_heel', 'Salve');
    editJson(it, 'menus/ring_items/debug_heel.json', v => { v.index = 9; });
    it.set('items/consumables/salve.json', json({ held: 'temp[196]', ring_item: 'debug_heel', target: '$000A', block: 'petals', power: 10 }));
    editJson(it, 'items/consumables/_enum.json', v => { v.names.push('salve'); });
    it.set('items/named_items/lucky_coin.json', json({ name: 'Lucky Coin', description: 'A coin.', flag: { flags: '$7E:22DB', bit: '$0040' }, icon: 'wizards_coin' }));
    editJson(it, 'items/named_items/_enum.json', v => { v.names.push('lucky_coin'); });
    const ib = implode(it, GAME, KINDS);
    assert.deepStrictEqual(ib.findings.list.filter(f => f.severity !== 'info'), []);
    const ii = ib.image!, i24 = (at: number) => ii[at] | (ii[at + 1] << 8) | (ii[at + 2] << 16), i16 = (at: number) => ii[at] | (ii[at + 1] << 8);
    for (const site of [0x0E8CDC, 0x0E8CE1, 0x0E9B96, 0x0EA817, 0x0EA866]) assert.strictEqual(ii[site], 0x22, `a jsl at ${site.toString(16)}`);
    assert.strictEqual(ii[0x0E9B70], 10, 'the ring build reads 10 ids');
    const power = i24(0x0E8CE9) & 0x3FFFFF, ring = i24(0x0E9BA4) & 0x3FFFFF;
    assert.deepStrictEqual([i16(power + 18), i16(ring + 18), i16(power)], [10, 2 * 1, 40], 'the Salve\'s power and ring item, Petals\' power copied');
    assert.strictEqual(i16((0x0E0000 | i16(0x0E8002)) + 6), 9, 'debug_heel holds index 9');
    assert.deepStrictEqual([i16(0x0CC149), i16(0x0CC386), i16(0x0CC3B0), i16(0x0CC401)], [0x28, 0x2A, 0x2A, 0x28], 'the named item loops one longer');
    const flags = i24(0x0CC0F7) & 0x3FFFFF, names = i24(0x0CC11F) & 0x3FFFFF, coin = ((ii[0x0CC125] << 16) | i16(names + 40)) & 0x3FFFFF;
    assert.deepStrictEqual([i16(flags + 40), i16(flags + 2 * 21 + 40)], [0x22DB, 0x0040], 'its flag word and mask');
    assert.strictEqual(Buffer.from(ii.subarray(coin, coin + 11)).toString('latin1'), 'Lucky Coin\0', 'its name in the moved strings');
    assert.strictEqual(i24((i24(0x0CC35A) & 0x3FFFFF) + 60), i24((i24(0x0CC35A) & 0x3FFFFF) + 39), 'the Wizard\'s Coin\'s icon');
    assert.deepStrictEqual(rules(t => {
        t.set('items/consumables/salve.json', json({ held: 'temp[196]', ring_item: 'debug_heel', target: '$000A', block: 'petals', power: 10 }));
        editJson(t, 'items/consumables/_enum.json', v => { v.names.push('salve'); });
        t.set('items/named_items/lucky_coin.json', json({ name: 'Lucky Coin', description: 'A coin.', flag: { flags: 'CHARM_FLAGS+1', bit: '$0002' }, icon: 'wizards_coin' }));
        editJson(t, 'items/named_items/_enum.json', v => { v.names.push('lucky_coin'); });
    }).sort(), ['invalid-value items/consumables/salve.json#/ring_item', 'invalid-value items/named_items/lucky_coin.json#/flag']);
    console.log('  ✓ a 10th consumable and a 21st named item: the ring\'s build, count, dispatch and use redirected, the named items\' tables, icons and strings moved; a ring item whose index is not the consumable and a flag another item has are errors');

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

    const other = explode(rom, { release: 'us', sha1: sha1(rom), explodedWith: 'test' }, GAME, KINDS, undefined, { palettes: { format: 'png' }, sprite_palettes: { format: 'png' }, tiles: { format: 'json' } });
    assert.ok(other.has('palettes/backgrounds/palette_000.png') && [...other.keys()].some(k => /^palettes\/sprites\/[^_].*\.png$/.test(k)) && other.has('maps/tiles/tile_0000.json'));
    const p = implode(other, GAME, KINDS, { strict: true });
    assert.deepStrictEqual(p.findings.list.filter(f => f.severity !== 'info'), []);
    assert.strictEqual(p.sha1, sha1(rom));
    assert.deepStrictEqual(rules(t => { t.delete('maps/tiles/tile_0000.png'); t.set('maps/tiles/tile_0000.json', other.get('maps/tiles/tile_0000.json')!); }), []);
    console.log('  ✓ palettes as PNG stripes and tiles as JSON rows: the same ROM; one tile as JSON among PNGs too');

    // Strings: an unknown tag is an error; an edited string is encoded anew (our encoder) and explodes back.
    assert.deepStrictEqual(rules(t => { t.set('strings/dialogue/string_0000.txt', new TextEncoder().encode('Hello [WAVE]\n')); }), ['invalid-value strings/dialogue/string_0000.txt#']);
    const said = new Map(tree);
    said.set('strings/dialogue/string_0375.txt', new TextEncoder().encode('[SLOW]Whoa![PAUSE:3d] Now I know how a moved string feels.[B]\n'));
    const sr = implode(said, GAME, KINDS);
    assert.deepStrictEqual(sr.findings.list.filter(f => f.severity === 'error'), []);
    assert.ok(sr.findings.list.some(f => f.rule === 'reencoded' && f.file === 'strings/dialogue/string_0375.txt'));
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
    grow('strings/dialogue', 'string_0000', 'string_new', 'txt')(grown);
    grown.set('scripts/global/script_new.txt', grown.get('scripts/global/boot.txt')!);
    editJson(grown, 'scripts/_enum.json', e => { e.names.push('script_new'); });
    const g = implode(grown, GAME, KINDS);
    assert.deepStrictEqual(g.findings.list.filter(f => f.severity !== 'info' && f.rule !== 'unreferenced').map(f => `${f.rule} ${f.file}`), []);
    for (const key of ['tiles/_table', 'strings/_table', 'scripts/_table']) assert.ok(g.placed.some(p => p.key === key && p.at !== p.home), `${key} did not move`);
    for (const [kind, limit] of [['maps', 256], ['tiles', 21845], ['strings', 21845], ['scripts', 21625], ['sprite_palettes', 269], ['characters', 256], ['sprite_blocks_16', 21845], ['sprite_blocks_8', 21845], ['opcodes', 195], ['attack_procs', 15], ['behaviours', 15], ['music', 71], ['sounds', 112], ['entities', 0x70], ['projectiles', 16], ['fonts', 2], ['hud', 22], ['animation_modes', 6], ['ring_items', 162], ['rings', 18], ['ring_flows', 12], ['option_actions', 9], ['item_actions', 9], ['alchemy_actions', 36], ['caller_actions', 4], ['spell_actions', 18], ['ingredients', 64], ['consumables', 16], ['named_items', 40]] as const) assert.strictEqual(JSON.parse(Buffer.from(tree.get(`${FOLDER[kind] ?? kind}/_enum.json`)!).toString()).limit, limit, kind);
    console.log('  ✓ a new tile, string and table script: each table grows and moves, the round trip holds; limits at the engine\'s');

    // Unified animations (no animations/groups/ or animate_ids/, zero $ ROM pointers, inline symbolic scripts + animate.json):
    const spritePalEnum = JSON.parse(Buffer.from(tree.get('palettes/sprites/_enum.json')!).toString()).names as string[];
    assert.strictEqual(spritePalEnum.length, 269);
    assert.ok(![...tree.keys()].some(p => p.startsWith('animations/groups/') || p.startsWith('animations/animate_ids/')), 'split animations folders removed');
    const animFiles = [...tree.keys()].filter(p => /^animations\/.+/.test(p) && p !== 'animations/animate.json' && !p.startsWith('animations/modes/'));
    assert.strictEqual(animFiles.length, 783, '783 unified animation definitions');
    assert.ok(animFiles.every(p => !/\$[0-9a-f]{2,6}/i.test(Buffer.from(tree.get(p)!).toString())), 'zero $ ROM pointers in any animation JSON');
    const animateTable = JSON.parse(Buffer.from(tree.get('animations/animate.json')!).toString());
    assert.strictEqual(animateTable.format, 'open-evermore/animate-table');
    assert.strictEqual(animateTable.limit, 2048);
    assert.ok(!/\$[0-9a-f]{2,6}/i.test(JSON.stringify(animateTable.entries)), 'zero $ ROM pointers in animate.json entries');
    const animKeys = Object.keys(animateTable.entries);
    assert.strictEqual(animKeys.length, 212);
    for (const expected of ['boy/kneel', 'boy/dragged', 'dog/act2_leap', 'placeholder/bucket', 'placeholder/leaves_falling_2', 'shared/invisible']) {
        assert.ok(animKeys.includes(expected), `missing animate() key ${expected}`);
    }
    assert.ok(animKeys.filter(n => n.startsWith('placeholder/')).length >= 60, 'placeholder owns >= 60 animate keys');
    assert.ok(!animKeys.some(n => n.includes('boy_boy_')), 'no double-prefixed boy_boy_* names');
    assert.strictEqual(animKeys[5], 'placeholder/leaves_falling_2', 'id 0x05 is leaves_falling_2 (not enum-ref magmar_roll)');
    assert.strictEqual(animateTable.entries['boy/dragged'], 'boy/dragged');
    assert.strictEqual(animateTable.entries['dog/act1_stick_running'], 'dog/act1_stick_walk#west');
    assert.strictEqual(animateTable.entries['placeholder/explosion_3'], 'bomb/death');
    assert.strictEqual(animateTable.entries['shared/none'], null);

    const dragged = JSON.parse(Buffer.from(tree.get('animations/boy/dragged.json')!).toString());
    assert.strictEqual(dragged.facing_mode, 'any');
    assert.ok(dragged.facings.any.includes('reset') && dragged.facings.any.includes('hurtbox 14, -8') && dragged.facings.any.includes('sleep 12') && dragged.facings.any.includes('step 0!') && dragged.facings.any.includes('loop'));
    const boySpriteLine = dragged.facings.any.find((l: string) => /^sprite boy\/dragged_\d+$/.test(l));
    assert.ok(boySpriteLine, 'boy/dragged names its metasprite by what plays (boy/dragged_N)');
    const boyWalk = JSON.parse(Buffer.from(tree.get('animations/boy/walk.json')!).toString());
    assert.strictEqual(boyWalk.facing_mode, '4_way');
    assert.deepStrictEqual(Object.keys(boyWalk.facings), ['north', 'east', 'south', 'west']);
    assert.ok(Array.isArray(boyWalk.facings.north));
    assert.ok(Array.isArray(boyWalk.palettes) && boyWalk.palettes.length > 0 && !boyWalk.palettes[0].palette.startsWith('$'));

    assert.ok(!tree.has('characters/records/fire_eyes/animations.json'), 'redundant animations.json removed');
    const fire = JSON.parse(Buffer.from(tree.get('characters/records/fire_eyes.json')!).toString());
    assert.ok(!fire.palette.startsWith('$') && tree.has(`palettes/sprites/${fire.palette}.json`), `fire_eyes palette: ${fire.palette}`);
    assert.ok(tree.has(`animations/${fire.animations.stand}.json`), `fire_eyes stand: ${fire.animations.stand}`);
    assert.ok(tree.has(`characters/behaviours/${fire.behaviour}.json`) && tree.has(`characters/attack_procs/${fire.attack_proc}.json`), `${fire.behaviour}, ${fire.attack_proc}`);
    const crusher = JSON.parse(Buffer.from(tree.get('equipment/weapons/bone_crusher.json')!).toString());
    assert.ok(!crusher.palette.startsWith('$') && !crusher.animations.attack_0.startsWith('$'), 'weapon references named palette & animation');
    const ringOpt = JSON.parse(Buffer.from(tree.get('menus/ring_items/option_equipment.json')!).toString());
    assert.ok(!ringOpt.icon.startsWith('$') && !ringOpt.palette.startsWith('$'), 'ring item references named icon animation & sprite palette');
    assert.ok(tree.has('characters/projectiles/guard_bot_shot.json') && tree.has('characters/projectiles/vigor_boomerang.json'), 'all 21 bank-$90 projectiles exploded, named by what throws them');
    assert.strictEqual(crusher.animations.idle, 'animations/boy/bone_crusher_idle', 'weapon +$1A is the idle animation');
    const xp = (who: string) => JSON.parse(Buffer.from(tree.get(`characters/experience/${who}.json`)!).toString()).next_level_at as number[];
    assert.ok(xp('boy').length === 100 && xp('boy')[99] === 0xFFFFFF && xp('dog').length === 99 && xp('dog')[1] === 35, 'experience tables: Boy 100 levels, Dog 99');

    // Editing an inline animation script (growing past vanilla 25B) relocates it cleanly and round-trips.
    const dragEdited = new Map(tree);
    editJson(dragEdited, 'animations/boy/dragged.json', a => { a.facings.any.splice(a.facings.any.length - 1, 0, 'sleep 6', 'step 0!'); });
    const dr = implode(dragEdited, GAME, KINDS);
    assert.deepStrictEqual(dr.findings.list.filter(f => f.severity === 'error'), []);
    const movedDrag = dr.placed.find(p => p.key === 'animations.script/boy/dragged#any')!;
    assert.ok(movedDrag && movedDrag.at !== movedDrag.home, 'grown boy/dragged script relocated and round-trips');

    // Extending animations: new animation file + extended animate.json + event script animate() call + character record slot.
    const more = new Map(tree);
    more.set('animations/boy/custom_drag.json', json({
        format: 'open-evermore/animation',
        version: 1,
        facing_mode: 'any',
        facings: { any: ['reset', 'hurtbox 14, -8', boySpriteLine, 'sleep 10', 'step 0!', 'end_check!', 'loop'] },
    }));
    editJson(more, 'animations/animate.json', v => {
        v.entries['boy/custom_drag'] = 'boy/custom_drag';
        v.entries['fire_eyes/slash'] = 'fire_eyes/cast';
    });
    setLines(more, enter, l => ['animate boy, boy/custom_drag, once', ...l]);
    more.set('characters/records/fire_eyes_copy.json', more.get('characters/records/fire_eyes.json')!);
    editJson(more, 'characters/records/fire_eyes_copy.json', c => { c.animations.walk = 'boy/custom_drag'; });
    editJson(more, 'characters/records/_enum.json', e => { e.names.push('fire_eyes_copy'); });
    editJson(more, 'characters/records/_records.json', e => { e.names.push('fire_eyes_copy'); });
    const blockName = (dir: string, id: number): string => JSON.parse(Buffer.from(tree.get(`${dir}/_enum.json`)!).toString()).names[id];
    grow('sprites/blocks_16', blockName('sprites/blocks_16', 0), 'block_new', 'png')(more);
    grow('sprites/blocks_8', blockName('sprites/blocks_8', 0), 'block_new', 'png')(more);
    assert.ok(more.has(`sprites/blocks_8/${blockName('sprites/blocks_8', 6085)}.json`), 'the 8×8 alias (block 6085 reads blocks 0 and 407)');
    assert.ok(blockName('sprites/blocks_16', 0).includes('/') && tree.has(`sprites/blocks_16/${blockName('sprites/blocks_16', 0)}.png`), 'blocks sit in the folder of what draws them');
    assert.ok([...tree.keys()].some(k => k.startsWith('sprites/blocks_16/boy/')) && [...tree.keys()].some(k => k.startsWith('sprites/blocks_16/shared/')), 'boy and shared block folders');
    const m = implode(more, GAME, KINDS, { seed: 5 });
    assert.deepStrictEqual(m.findings.list.filter(f => f.severity !== 'info').map(f => `${f.rule} ${f.file}`), []);
    for (const key of ['animations/_table', 'characters/_enemy_index', 'sprite_blocks_16/_table', 'sprite_blocks_8/_table']) {
        const before = stable.placed.find(p => p.key === key)!, after = m.placed.find(p => p.key === key)!;
        assert.ok(after.length > before.length, `${key} did not grow (${before.length} → ${after.length})`);
    }
    const animTablePlaced = m.placed.find(p => p.key === 'animations/_table')!;
    const newAnimPlaced = m.placed.find(p => p.key === 'animations/boy/custom_drag')!;
    const newScriptPlaced = m.placed.find(p => p.key === 'animations.script/boy/custom_drag#any')!;
    assert.ok(animTablePlaced.at >= 0x050000, 'new animation vacates $C4:3C92 animate table');
    assert.ok(newAnimPlaced.at >= 0x040000 && newAnimPlaced.at < 0x050000, 'new animation lands in bank $C4');
    assert.ok(newScriptPlaced, 'new animation script placed and round-trips');
    assert.ok(m.placed.every(p => p.key !== 'characters/_records' || (p.at & 0xFFFF) === 0xB678), 'the records keep $B678');
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/_records.json', e => { e.names.push('nobody'); })), ['unknown-reference characters/records/_records.json#/names/142']);
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/fire_eyes.json', c => { c.hp = 70000; })), ['invalid-value characters/records/fire_eyes.json#/hp']);
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/fire_eyes.json', c => { c.animations.stand = 'no/such_anim'; })), ['unknown-reference characters/records/fire_eyes.json#/animations/stand']);
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/fire_eyes.json', c => { c.palette = 'no_such_palette'; })), ['unknown-reference characters/records/fire_eyes.json#/palette']);
    assert.deepStrictEqual(rules(t => editJson(t, 'animations/animate.json', v => { v.entries['boy/kneel'] = 'no/such_anim'; })), ['unknown-reference animations/animate.json#/entries/boy/kneel']);
    assert.deepStrictEqual(rules(t => editJson(t, 'animations/animate.json', v => { v.entries['boy/kneel'] = 'boy/kneel#diagonal'; })), ['invalid-value animations/animate.json#/entries/boy/kneel']);
    assert.deepStrictEqual(rules(t => editJson(t, 'animations/boy/dragged.json', a => { a.facings.any.splice(0, 0, 'sprite no/frame_999', 'palette no_such_pal', 'sound no_such_sound', 'projectile no_such_proj, 0, 0, 0', 'jump no_such_lbl'); })), [
        'unknown-reference animations/boy/dragged.json#/facings/any/0',
        'unknown-reference animations/boy/dragged.json#/facings/any/1',
        'unknown-reference animations/boy/dragged.json#/facings/any/2',
        'unknown-reference animations/boy/dragged.json#/facings/any/3',
        'unknown-reference animations/boy/dragged.json#/facings/any/4',
    ]);
    assert.deepStrictEqual(rules(t => editJson(t, 'animations/boy/walk.json', a => { a.facings.north = { same_as: 'east' }; a.facings.east = { same_as: 'north' }; })).filter(r => r.startsWith('invalid-value animations/boy/walk.json#/facings/')), [
        'invalid-value animations/boy/walk.json#/facings/north/same_as',
        'invalid-value animations/boy/walk.json#/facings/east/same_as',
    ]);
    assert.deepStrictEqual(rules(t => editJson(t, 'equipment/weapons/bone_crusher.json', w => { w.palette = 'no_such_palette'; })), ['unknown-reference equipment/weapons/bone_crusher.json#/palette']);
    assert.deepStrictEqual(rules(t => editJson(t, 'menus/ring_items/option_equipment.json', r => { r.icon = 'no/such_anim'; })), ['unknown-reference menus/ring_items/option_equipment.json#/icon']);
    const someMeta = [...tree.keys()].find(p => p.startsWith('sprites/metasprites/') && p.endsWith('.json') && !p.endsWith('_enum.json') && JSON.parse(Buffer.from(tree.get(p)!).toString()).chunks.length > 0)!;
    assert.deepStrictEqual(rules(t => editJson(t, someMeta, v => { v.chunks[0].block = 'no_such_block'; })), [`unknown-reference ${someMeta}#/chunks/0/block`]);
    assert.ok([...tree.keys()].some(p => /^characters\/records\/[^_].*\.json$/.test(p) && / \| /.test(JSON.parse(Buffer.from(tree.get(p)!).toString()).flags ?? '')), 'flags as names');
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/fire_eyes.json', c => { c.attack_proc = 'tickle'; })), ['unknown-reference characters/records/fire_eyes.json#/attack_proc']);
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/records/fire_eyes.json', c => { c.flags = 'invincible | shiny'; })), ['invalid-value characters/records/fire_eyes.json#/flags']);
    const poisoned = implode((() => { const t = new Map(tree); editJson(t, 'characters/records/fire_eyes.json', c => { c.attack_proc = 'melee_poison'; c.flags = 'never_sleeps | through_bodies'; }); return t; })(), GAME, KINDS);
    assert.deepStrictEqual(poisoned.findings.list.filter(f => f.severity === 'error'), []);
    // Handlers by routine name: opcodes, attack procs, behaviours.
    const animate = JSON.parse(Buffer.from(tree.get('scripts/opcodes/animate.json')!).toString());
    assert.ok(animate.handler === 'script_op_78_animate' && !('c' in animate), JSON.stringify(animate).slice(0, 80));
    assert.ok([...tree.keys()].filter(p => /^(scripts\/opcodes|characters\/attack_procs|characters\/behaviours)\/[^_]/.test(p)).every(p => !JSON.parse(Buffer.from(tree.get(p)!).toString()).handler.startsWith('$')), 'every handler has a name');
    assert.deepStrictEqual(rules(t => editJson(t, 'characters/attack_procs/melee.json', v => { v.handler = 'no_such_routine'; })), ['unknown-reference characters/attack_procs/melee.json#/handler']);
    console.log('  ✓ unified animations (inline symbolic scripts + animate.json), metasprites, equipment & ring icons: grown/new animations relocate cleanly and round-trip');
    console.log('  ✓ characters name their palettes, animations, behaviour and attack proc; handlers of opcodes, attack procs and behaviours by routine name');

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

    // Code (docs/open-evermore/code.md C0): every recorded routine is a file by name, at its vanilla address. A same-size
    // edit lands; an edit whose instructions change length round-trips (a routine compares by its bytes); a longer
    // routine, a new one and an unknown label are errors.
    const codeFiles = [...tree.keys()].filter(p => p.startsWith('code/') && p.endsWith('.asm'));
    assert.ok(codeFiles.length > 1400 && tree.has('code/reset_handler.asm') && tree.has('code/nmi_handler.asm'), `${codeFiles.length} routines`);
    const editText = (t: typeof tree, p: string, fn: (s: string) => string) => t.set(p, new Uint8Array(Buffer.from(fn(Buffer.from(t.get(p)!).toString()))));
    const reset = (s: string) => s.replace('    lda.b #$8F\n', '    lda.b #$80\n').replace('loc_808034:\n    lda.w #$0000\n', 'loc_808034:\n    nop\n    nop\n    nop\n');
    const ce = new Map(tree);
    editText(ce, 'code/reset_handler.asm', reset);
    const cb = implode(ce, GAME, KINDS, { strict: true });
    assert.deepStrictEqual(cb.findings.list.filter(f => f.severity !== 'info'), []);
    const diff = [...cb.image!.keys()].filter(i => cb.image![i] !== rom[i]);
    assert.deepStrictEqual(diff.filter(i => i < 0xFFDC || i > 0xFFDF), [0x8021, 0x8034, 0x8035, 0x8036], 'only the edited bytes (and the checksum)');
    assert.deepStrictEqual(rules(t => editText(t, 'code/reset_handler.asm', s => s + '    nop\n'), true), ['code-size code/reset_handler.asm#']);
    assert.deepStrictEqual(rules(t => t.set('code/my_new.asm', new Uint8Array(Buffer.from('my_new:\n    rtl\n'))), true), ['code-new code/my_new.asm#']);
    assert.deepStrictEqual(rules(t => editText(t, 'code/reset_handler.asm', s => s.replace('    sta.w $2100\n', '    sta.w no_such_label\n')), true), ['asm code/reset_handler.asm#line 5']);
    // Same bytes in other words: a routine in a subfolder, a label of the modder's own used from another routine, an
    // edited README: the vanilla ROM, and the round trip holds.
    const cw = new Map(tree);
    cw.set('code/system/reset_handler.asm', cw.get('code/reset_handler.asm')!);
    cw.delete('code/reset_handler.asm');
    editText(cw, 'code/system/reset_handler.asm', s => s.replace('loc_808034:', 'after_stack:'));
    editText(cw, 'code/fatal_reset_recovery_handler.asm', s => s.replaceAll('loc_808034', 'after_stack'));
    editText(cw, 'code/README.md', s => s + '\nMy notes.\n');
    const sw = implode(cw, GAME, KINDS, { strict: true });
    assert.deepStrictEqual(sw.findings.list.filter(f => f.severity !== 'info'), []);
    assert.strictEqual(sw.sha1, sha1(rom));
    console.log(`  ✓ code: ${codeFiles.length} routines as Asar files; a same-size edit lands, instructions of another length round-trip; a longer or new routine and an unknown label are errors`);

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
