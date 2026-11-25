// The ring menu kinds (docs/open-evermore/resources.md §menus): what each ring item is, which items each ring shows,
// the rings a flow cycles through (Up/Down), and what pressing an item does. All of it sits in bank $8E between code and
// is read by fixed addresses or code immediates, so implode writes it in place; a name string stays at its home.
//
// Facts used (knowledge routines/RING_*.md, *_ACTIONS.md, ring_*_loop.md, v0.455.0):
//   ring items  $8E:8000 162 words (ring item id = 2·id) → the 8-byte entry in bank $8E ($8E:8144-$8653, not in id
//               order; the pointers stay in _base/): +0 the name, a text in bank $C4 (texts.mts, `strings/menu/`; every
//               ring loop prints it with $8C:9E03, bank #$C4; weapon records, formula and ingredient names point at the
//               same texts); +2 the icon, an animation in animations/
//               ($8E:AEBC); +4 its palette in palettes/sprites/; +6 the index, which the ring that shows the item reads:
//               an action table's entry (×2, consumables ×1: the loop doubles it) or a weapon, armour or ingredient number
//   rings       ring id = 2·id into three tables: $8E:9920 the WRAM buffer (+0 count, +2 cursor, +4 16 item ids; DP $95),
//               $8E:9944 the loop (JSR ($9944,x) at $8E:A20E), $8E:9968 flags copied to $05AB; 18 rings, code at $8E:998C
//               after the flows. The options rings and the Call Bead rings are filled by `lda #imm : sta` sites (ITEM_SITES)
//   flows       $8E:998C-$99C9: records of a count and that many ring ids; code ($8E:A34F, $8E:E515, …) and the shop tables
//               $CC:E37B / $CC:F037 hold their addresses, so each keeps its place and its length
//   actions     handler tables (handler-tables.mts), by the index of the item pressed: options $8E:A444 (ring_options_loop),
//               consumables $8E:A873 (ring_items_loop, X = 2·index), formulas $8E:A777 (ring_alchemy_loop), Call Bead callers
//               $8E:99CA (ring_call_bead_callers_loop), their spells $8E:AD43 (ring_call_bead_spells_loop)
// Names: a ring item is named from its own text in the ROM (no game text in this file), with its category as prefix.
import * as map from '../map.mts';
import { createRequire } from 'node:module';
import type { Codec, ImplodeContext, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { link, unlink } from '../../links.mts';
import { ANIMATIONS, animationInitialOffset, animationPlacedOffset, animationRef } from './animations.mts';
import { handlerTable } from './handler-tables.mts';
import { hexText, parseHex, routines } from './readers.mts';
import { SPRITE_PALETTES, spritePaletteAddr, spritePaletteName } from './sprite-palettes.mts';
import { addTextSource, TEXTS, textLink, textName, textPointer } from './texts.mts';
import { wramAddress, wramName } from './wram.mts';

const require = createRequire(import.meta.url);
const { encodePng } = require('../../../../dist/platform/png');
const { renderItemIcon } = require('../../../../dist/games/evermore/maps/item-icons');

const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const GROUP = 'menus';

// ── what pressing an item does ──
export const OPTION_ACTIONS = 'option_actions', ITEM_ACTIONS = 'item_actions', ALCHEMY_ACTIONS = 'alchemy_actions', CALLER_ACTIONS = 'caller_actions', SPELL_ACTIONS = 'spell_actions';

export const optionActionsCodec = handlerTable({
    kind: OPTION_ACTIONS, at: map.file('option_actions.table'), group: GROUP,
    why: 'ring_options_loop jumps by JSR ($A444,x) with X = the pressed item\'s index (2·id); 9 words, code from $8E:A456',
    entries: [
        ['status_boy', 'the Boy\'s full-screen status ($8D:A0E9, $8D:A6F6)'],
        ['status_dog', 'the Dog\'s full-screen status'],
        ['weapon_skill', 'the weapon skill screen ($8D:896C)'],
        ['action', 'the Action screen: how the companion fights ($8D:82F0, $8D:862A)'],
        ['control_prefs', 'the Control Prefs screen ($8D:9DB4, $8D:9FB6)'],
        ['window_edit', 'the Window Edit screen ($8D:9B2A, $8D:9CD1)'],
        ['equipment', 'the armour rings: switches to the flow `equipment`'],
        ['targeting', 'the target cursor ($8C:88CC); the chosen entity is kept in $144F'],
        ['alchemy', 'the alchemy screen ($8D:C321, $8D:C803)'],
    ],
});

export const itemActionsCodec = handlerTable({
    kind: ITEM_ACTIONS, at: map.file('item_actions.table'), group: GROUP,
    why: 'ring_items_loop jumps by JSR ($A873,x) with X = 2·the pressed item\'s index; 9 words, code from $8E:A885',
    entries: [
        ['petals', 'pick a target and use it'], ['nectar', 'pick a target and use it'], ['honey', 'pick a target and use it'],
        ['dog_biscuit', 'pick a target and use it'], ['wings', 'pick a target and use it'], ['essence', 'pick a target and use it'],
        ['pixie_dust', 'pick a target and use it'],
        ['call_bead', 'fills the ring `call_bead_callers` and switches to the flow `call_bead_callers`'],
        ['pouch', 'opens the pouch screen'],
    ],
});

/** The formulas in index order (2·formula is what an alchemy ring item holds and what the learned bits count). */
export const FORMULAS = ['acid_rain', 'atlas', 'barrier', 'call_up', 'corrosion', 'crush', 'cure', 'defend', 'double_drain', 'drain',
    'energize', 'escape', 'explosion', 'fireball', 'fire_power', 'flash', 'force_field', 'hard_ball', 'heal', 'lance', 'laser',
    'levitate', 'lightning_storm', 'miracle_cure', 'nitro', 'one_up', 'reflect', 'regrowth', 'revealer', 'revive', 'slow_burn',
    'speed', 'sting', 'stop', 'super_heal'];
export const alchemyActionsCodec = handlerTable({
    kind: ALCHEMY_ACTIONS, at: map.file('alchemy_actions.table'), group: GROUP,
    why: 'ring_alchemy_loop jumps by JSR ($A777,x) with X = the formula item\'s index (2·formula); 36 words, code from $8E:A7BF',
    entries: [...FORMULAS.map(n => [n, `casts ${n.replace(/_/g, ' ')}`] as [string, string]), ['unused_46', 'no formula has this index']],
});

export const callerActionsCodec = handlerTable({
    kind: CALLER_ACTIONS, at: map.file('caller_actions.table'), group: GROUP,
    why: 'ring_call_bead_callers_loop jumps by JSR ($99CA,x) ($8E:990E) with X = the caller item\'s index; 4 words, code from $8E:99D2',
    entries: [
        ['fire_eyes', 'fills the ring `call_bead_spells` with Fire Eyes\' spells (rings/call_bead_spells.json)'],
        ['horace', 'fills the ring `call_bead_spells` with Horace\'s spells'],
        ['camellia', 'fills the ring `call_bead_spells` with Camellia\'s spells'],
        ['professor', 'fills the ring `call_bead_spells` with the Professor\'s spells'],
    ],
});

export const spellActionsCodec = handlerTable({
    kind: SPELL_ACTIONS, at: map.file('spell_actions.table'), group: GROUP,
    why: 'ring_call_bead_spells_loop jumps by JSR ($AD43,x) with X = the spell item\'s index; 18 words, code from $8E:AD67',
    entries: ['life_spark', 'heat_wave', 'storm', 'flare', 'time_warp', 'first_aid', 'confound', 'regenerate', 'aura', 'shock_wave',
        'shield', 'plague', 'hypnotize', 'disrupt', 'restore', 'electra_bolt', 'unused_20', 'unused_22']
        .map(n => [n, n.startsWith('unused') ? 'no spell has this index' : `casts ${n.replace(/_/g, ' ')}`] as [string, string]),
});

// ── ring items ──
export const RING_ITEMS = 'ring_items';
const POINTERS = map.file('ring_items.pointers'), ENTRIES = map.file('ring_items.entries'), ITEM_COUNT = 162, ENTRY = 8, NAME_BANK = map.file('common.data_bank'), PALETTE_BANK = map.bank('sprite_palettes.table');

/**
 * What the ring that shows an item reads its index as, by the item's id range (the ranges the builders and loops use):
 * an action kind (the index is `scale`·its id there, written as `field`), or a plain number.
 */
interface Category { prefix: string; first: number; last: number; actions?: string; field?: string; scale?: number }
const CATEGORIES: Category[] = [
    { prefix: 'debug', first: 0x00, last: 0x14 },
    { prefix: 'option', first: 0x16, last: 0x26, actions: OPTION_ACTIONS, field: 'action', scale: 2 },
    { prefix: 'weapon', first: 0x28, last: 0x40 },
    { prefix: 'ammo', first: 0x42, last: 0x46 },
    { prefix: 'alchemy', first: 0x48, last: 0x8C, actions: ALCHEMY_ACTIONS, field: 'formula', scale: 2 },
    { prefix: 'item', first: 0x8E, last: 0x9E, actions: ITEM_ACTIONS, field: 'action', scale: 1 },
    { prefix: 'armour', first: 0xA0, last: 0xEE },
    { prefix: 'caller', first: 0xF0, last: 0xF6, actions: CALLER_ACTIONS, field: 'action', scale: 2 },
    { prefix: 'spell', first: 0xF8, last: 0x116, actions: SPELL_ACTIONS, field: 'action', scale: 2 },
    { prefix: 'ingredient', first: 0x118, last: 0x142 },
];
const categoryOf = (id: number) => CATEGORIES.find(c => 2 * id >= c.first && 2 * id <= c.last)!;
/** Two options share a text; their index says whose. */
const SAME_TEXT: Record<number, string> = { [0x16 / 2]: 'option_player_status_boy', [0x18 / 2]: 'option_player_status_dog' };

const entryAt = (rom: Uint8Array, id: number) => POINTERS & 0xFF0000 | word(rom, POINTERS + 2 * id);
function textAt(rom: Uint8Array, at: number): string {
    let s = '';
    for (let i = at; rom[i] !== 0; i++) {
        if (rom[i] < 0x20 || rom[i] > 0x7E) throw new Error(`ring_items: the name at $C4:${hexText(at & 0xFFFF, 4)} has byte $${rom[i].toString(16)}; explode would lose it`);
        s += String.fromCharCode(rom[i]);
    }
    return s;
}

/** The names explode gives ring items (from their own text); set by the first explode, read by defaultName. */
let NAMES: string[] = [];
export function nameRingItems(rom: Uint8Array): string[] {
    if (NAMES.length) return NAMES;
    const names: string[] = [], seen = new Set<string>();
    for (let id = 0; id < ITEM_COUNT; id++) {
        const c = categoryOf(id), text = textAt(rom, NAME_BANK | word(rom, entryAt(rom, id))).replace(/^Debug: /, '');
        let n = SAME_TEXT[id] ?? `${c.prefix}_${text.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`.slice(0, 80);
        for (let k = 2; seen.has(n); k++) n = `${n.replace(/_\d+$/, '')}_${k}`;
        seen.add(n); names.push(n);
    }
    return NAMES = names;
}

// Every ring item's name is a text (texts.mts names them from this source among others).
addTextSource(rom => Array.from({ length: ITEM_COUNT }, (_, id) => NAME_BANK | word(rom, entryAt(rom, id) & 0x3FFFFF)));

interface RingItem { text: string; icon: number; iconGroup?: string; palette: number; index: number }
interface ReadItemError { rule: 'invalid-value' | 'unknown-reference'; path: string; why: string }

/** A ring item file → its entry, or a validation error; `ctx` resolves icons, palettes and actions by name. */
function readItem(v: any, id: number, ctx?: ImplodeContext): RingItem | ReadItemError {
    // The name: a text by reference (with `ctx`, its name in the tree; without, the reference as written).
    const text = ctx ? textName(ctx, v?.name) : unlink(TEXTS, v?.name);
    if (text === undefined) return { rule: 'unknown-reference', path: '/name', why: `a text, "${link(TEXTS, '<name>')}" (one file there): the ring prints it` };

    let icon = 0, iconGroup: string | undefined;
    if (v.icon !== null) {
        const anims = ctx?.names.get(ANIMATIONS);
        const name = unlink(ANIMATIONS, v.icon);
        if (anims && name !== undefined && !name.startsWith('$')) {
            if (!anims.has(name)) return { rule: 'unknown-reference', path: '/icon', why: `"${v.icon}" is no animation in animations/` };
            iconGroup = name;
            icon = animationInitialOffset(ctx!, name) ?? 0;
        } else {
            const raw = parseHex(v.icon, 0xFFFF, 0xC4) ?? parseHex(v.icon, 0xFFFF);
            if (raw === null) return { rule: 'invalid-value', path: '/icon', why: anims ? 'an animation name in animations/, or null' : 'an animation record in bank $C4, "$xxxx"' };
            icon = raw;
        }
    }

    let pal = 0;
    if (v.palette !== null) {
        const pals = ctx?.ids.get(SPRITE_PALETTES);
        const name = unlink(SPRITE_PALETTES, v.palette);
        if (pals && name !== undefined && !name.startsWith('$')) {
            const pid = pals.get(name);
            if (pid === undefined) return { rule: 'unknown-reference', path: '/palette', why: `"${v.palette}" is no sprite palette in palettes/sprites/` };
            pal = spritePaletteAddr(pid);
        } else {
            const raw = parseHex(v.palette, 0xFFFF, PALETTE_BANK);
            if (raw === null) return { rule: 'invalid-value', path: '/palette', why: pals ? 'a sprite palette name in palettes/sprites/, or "$D0:xxxx"' : '16 colours in bank $D0, "$D0:xxxx"' };
            pal = raw;
        }
    }

    const c = categoryOf(id);
    let index: number | null = Number.isInteger(v.index) && v.index >= 0 && v.index <= 0xFFFF ? v.index : null;
    if (c.field && v[c.field] !== undefined) {
        const action = unlink(c.actions!, v[c.field]), k = action === undefined ? undefined : ctx?.ids.get(c.actions!)?.get(action);
        if (ctx && k === undefined) return { rule: 'invalid-value', path: `/${c.field}`, why: `"${v[c.field]}" is no entry of ${c.actions} ("${link(c.actions!, '<name>')}")` };
        index = k === undefined ? null : k * c.scale!;
        if (!ctx) return { text, icon, ...(iconGroup ? { iconGroup } : {}), palette: pal, index: -1 };
    }
    if (index === null) return { rule: 'invalid-value', path: c.field ? `/${c.field}` : '/index', why: c.field ? `an entry of ${c.actions} (or /index, a number)` : 'a number 0-65535' };
    return { text, icon, ...(iconGroup ? { iconGroup } : {}), palette: pal, index };
}

export const ringItemsCodec: Codec = {
    kind: RING_ITEMS, version: 2, path: RING_ITEMS, folder: `${GROUP}/${RING_ITEMS}`,
    defaultName: id => NAMES[id] ?? `${RING_ITEMS}_${(2 * id).toString(16).padStart(3, '0')}`,

    // The entry compares by its icon group (so moved/new groups match), palette and index (action by name or number equal).
    canonical(path, bytes, ctx) {
        if (path.endsWith('.png')) return null;
        if (path === `${RING_ITEMS}/${ENUM}`) return [path, bytes];
        const v = JSON.parse(readText(bytes)), id = ctx?.ids.get(RING_ITEMS)?.get(path.slice(RING_ITEMS.length + 1, -'.json'.length));
        const item = id === undefined ? null : readItem(v, id, ctx);
        if (!item || 'rule' in item) return [path, json(v)];
        return [path, json({ text: item.text, icon: item.iconGroup ?? item.icon, palette: item.palette, index: item.index })];
    },

    explode(rom, name, options, countOf, nameAt) {
        nameRingItems(rom);
        const files: Tree = new Map(), names: string[] = [];
        for (let id = 0; id < ITEM_COUNT; id++) {
            const n = name(RING_ITEMS, id), e = entryAt(rom, id) & 0x3FFFFF, c = categoryOf(id);
            names.push(n);
            const index = word(rom, e + 6);
            const icon16 = word(rom, e + 2), pal16 = word(rom, e + 4);
            let iconVal: unknown = null;
            if (icon16) {
                const ref = animationRef(rom, icon16, name, countOf, nameAt);
                if (ref?.facing) throw new Error(`${RING_ITEMS}: ${n}.icon points to interior facing $${icon16.toString(16)}`);
                iconVal = ref ? link(ANIMATIONS, ref.animation) : hexText(icon16, 4);
            }
            let palVal: unknown = null;
            if (pal16) {
                try { const p = spritePaletteName(rom, pal16, name, countOf, nameAt); palVal = p ? link(SPRITE_PALETTES, p) : hexText(pal16, 4, PALETTE_BANK); }
                catch { palVal = hexText(pal16, 4, PALETTE_BANK); }
            }
            const v: Record<string, unknown> = { name: textLink(rom, NAME_BANK | word(rom, e), name, nameAt), icon: iconVal, palette: palVal };
            const k = c.scale ? index / c.scale : -1;
            if (c.field && Number.isInteger(k) && k < (c.actions === ALCHEMY_ACTIONS ? 36 : 18)) v[c.field] = link(c.actions!, name(c.actions!, k));
            else v.index = index;
            files.set(`${RING_ITEMS}/${n}.json`, json(v));
            // The icon is its animation (`icon`); the drawing only with `explode --previews`.
            const img = options.previews ? renderItemIcon(rom, 2 * id) : null;
            if (img) files.set(`${RING_ITEMS}/${n}.png`, new Uint8Array(encodePng(img.width, img.height, img.data)));
        }
        files.set(`${RING_ITEMS}/${ENUM}`, enumFile({ kind: RING_ITEMS, limit: ITEM_COUNT, names, why: 'ring item id = 2·id into the 162 pointers at $8E:8000; code follows the entries ($8E:8654)' }));
        return { files, pool: [], tables: [{ start: ENTRIES, end: ENTRIES + ENTRY * ITEM_COUNT }], homes: [] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(RING_ITEMS + '/') || path === `${RING_ITEMS}/${ENUM}` || path.endsWith('.png')) continue;
            const m = new RegExp(`^${RING_ITEMS}/([^/]+)\\.json$`).exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a ring item is <name>.json (and a preview <name>.png); ignored');
        }
        return names;
    },

    // Checks the files; the names are the texts kind's items.
    encode(ctx, names) {
        const ids = ctx.ids.get(RING_ITEMS) ?? new Map<string, number>();
        for (const n of names) {
            const path = `${RING_ITEMS}/${n}.json`, id = ids.get(n);
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
            if (id === undefined || id >= ITEM_COUNT) { ctx.findings.error('id-over-limit', path, '', `the game has ${ITEM_COUNT} ring items (their pointers at $8E:8000 are followed by code)`); continue; }
            let item: RingItem | ReadItemError;
            try { item = readItem(JSON.parse(readText(ctx.tree.get(path)!)), id, ctx); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            if ('rule' in item) ctx.findings.error(item.rule, path, item.path, item.why);
        }
        return [];
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(RING_ITEMS);
        if (!ids) return [];
        const table = new Uint8Array(ENTRY * ITEM_COUNT);
        for (const [n, id] of ids) {
            if (id >= ITEM_COUNT) continue;
            const path = `${RING_ITEMS}/${n}.json`, item = readItem(JSON.parse(readText(ctx.tree.get(path)!)), id, ctx);
            if ('rule' in item) continue;
            const at = textPointer(ctx, placed, item.text);
            if (at === null) { ctx.findings.error('no-room', path, '/name', `the text ${link(TEXTS, item.text)} was not placed in bank $C4, where the ring reads it`); continue; }
            const slot = word(ctx.base.image, POINTERS + 2 * id) - (ENTRIES & 0xFFFF);
            const iconWord = item.iconGroup ? (animationPlacedOffset(ctx, placed, item.iconGroup) ?? item.icon) : item.icon;
            [at, iconWord, item.palette, item.index].forEach((w, k) => table.set([w & 0xFF, w >> 8], slot + 2 * k));
        }
        if (ids.size !== ITEM_COUNT) ctx.findings.error('missing-file', `${RING_ITEMS}/${ENUM}`, '', `all ${ITEM_COUNT} ring items: each has its entry`);
        return [{ at: ENTRIES, bytes: table, file: `${RING_ITEMS}/${ENUM}` }] satisfies Write[];
    },
};

// ── rings ──
export const RINGS = 'rings';
const BUFFERS = map.file('rings.buffers'), LOOPS = map.file('rings.loops'), FLAGS = map.file('rings.flags'), RING_COUNT = 18, LOOP_ROUTINES = routines(map.bank('rings.loops'));
const RING_NAMES = ['boy_options', 'boy_alchemy', 'boy_weapons', 'debug', 'boy_items', 'dog_options', 'shop_0c', 'shop_0e', 'shop_10',
    'shop_12', 'call_bead_spells', 'call_bead_callers', 'armour_body', 'armour_helm', 'armour_gloves', 'armour_collar', 'shop_20', 'bazooka_ammo'];
const wramText = (at: number) => wramName(0x7E0000 | at) || hexText(at, 4, 0x7E);
const wramAt = (text: unknown): number | null => {
    const named = typeof text === 'string' ? wramAddress(text) : undefined;
    const at = named !== undefined ? (named >> 16 === 0x7E ? named & 0xFFFF : null) : parseHex(text, 0xFFFF, 0x7E);
    return at !== null && at < 0x2000 ? at : null;
};

/** Where code fills a ring with fixed items: the `lda #imm` (opcode $A9) at each file offset, and when it is used. */
interface Site { at: number; when: string; caller?: string }
const ALWAYS = 'always';
/** The sites of `rings.<ring>_sites` (the mapping file), each with when it is used (ours), in the same order. */
function sitesOf(ring: string, whens: string[], caller?: string): Site[] {
    const at = map.files(`rings.${ring}_sites`);
    if (at.length !== whens.length) throw new Error(`rings: map/${map.gameMap().release}.json lists ${at.length} sites for ${ring}, this codec knows ${whens.length}`);
    return at.map((a, k) => ({ at: a, when: whens[k], ...(caller ? { caller } : {}) }));
}
const ITEM_SITES: Record<string, Site[]> = {
    boy_options: sitesOf('boy_options', [ALWAYS, ALWAYS, ALWAYS, ALWAYS, ALWAYS, 'a formula is known (ALCHEMY_KNOWN_FLAGS $2258-$225C)',
        'an armour is held ($231D-$233F)', ALWAYS]),
    dog_options: sitesOf('dog_options', [ALWAYS, ALWAYS, ALWAYS, ALWAYS, ALWAYS, 'a collar is held ($2341-$2343)']),
    boy_items: sitesOf('boy_items', ['the pouch holds something ($8C:C3F8, $8C:C41B); the consumables held follow ($C4:5AAE)']),
    call_bead_callers: sitesOf('call_bead_callers', [ALWAYS, '$225C bit 7', '$225D bit 0', '$225D bit 1']),
    call_bead_spells: [
        ...sitesOf('call_bead_spells_fire_eyes', [ALWAYS, ALWAYS, ALWAYS, ALWAYS], 'fire_eyes'),
        ...sitesOf('call_bead_spells_horace', [ALWAYS, ALWAYS, ALWAYS, '$22DB bit 7', '$22DB bit 6'], 'horace'),
        ...sitesOf('call_bead_spells_camellia', [ALWAYS, ALWAYS, ALWAYS, ALWAYS], 'camellia'),
        ...sitesOf('call_bead_spells_professor', [ALWAYS, ALWAYS, ALWAYS], 'professor'),
    ],
    bazooka_ammo: sitesOf('bazooka_ammo', [0, 1, 2].map(k => `ammo held ($${(0x2345 + k).toString(16).toUpperCase()})`)),
};
/** How the other rings are filled, for the reader. */
const FILLED: Record<string, string> = {
    boy_alchemy: 'the formulas put on the ring ($0AD2, 9 slots) through $C4:5BAF', boy_weapons: 'each weapon owned, its ring item from its weapon record (+$1E)',
    debug: 'nothing in this release (its count stays 0, so the flow `boy` skips it)', armour_body: 'each armour held through $C4:5ABE',
    armour_helm: 'each armour held through $C4:5ABE', armour_gloves: 'each armour held through $C4:5ABE', armour_collar: 'each collar held through $C4:5ABE',
    shop_0c: 'the shop\'s stock ($0B95)', shop_0e: 'the shop\'s stock ($0B95)', shop_10: 'the shop\'s stock ($0B95)', shop_12: 'the shop\'s stock ($0B95)', shop_20: 'the shop\'s stock ($0B95)',
};

function readRing(v: any): { buffer: number; loop: number; flags: number } | string {
    const buffer = wramAt(v?.buffer), loop = LOOP_ROUTINES.at(v?.loop), flags = parseHex(v?.flags, 0xFFFF);
    if (buffer === null) return '/buffer: a WRAM name (knowledge wram/) or "$7E:xxxx" below $2000 (the loops read it through a 16-bit pointer)';
    if (loop === null) return `/loop: a routine of bank $8E by name, or "$8E:xxxx"`;
    if (flags === null) return '/flags: "$xxxx"';
    return { buffer, loop, flags };
}

/** The item each site of a ring writes, in site order, as the file says (null when it does not say one per site). */
function siteItems(v: any, ring: string): unknown[] | null {
    const sites = ITEM_SITES[ring];
    if (!sites) return [];
    const list = ring === 'call_bead_spells'
        ? sites.map((s, k) => v?.items_by_caller?.[s.caller!]?.[sites.slice(0, k).filter(x => x.caller === s.caller).length]?.item)
        : sites.map((_, k) => v?.items?.[k]?.item);
    const count = ring === 'call_bead_spells' ? Object.values(v?.items_by_caller ?? {}).reduce((a: number, l: any) => a + (Array.isArray(l) ? l.length : 0), 0) : Array.isArray(v?.items) ? v.items.length : 0;
    return count === sites.length && list.every(x => typeof x === 'string') ? list : null;
}

export const ringsCodec: Codec = {
    kind: RINGS, version: 1, path: RINGS, folder: `${GROUP}/${RINGS}`,
    defaultName: id => RING_NAMES[id] ?? `ring_${(2 * id).toString(16).padStart(2, '0')}`,

    // What implode reads: the three table words and the fixed items; `what`, `when`, `filled_from` are for the reader.
    canonical(path, bytes) {
        if (path === `${RINGS}/${ENUM}`) return [path, bytes];
        const v = JSON.parse(readText(bytes)), n = path.slice(RINGS.length + 1, -'.json'.length), r = readRing(v);
        return [path, json({ ring: typeof r === 'string' ? v : r, items: siteItems(v, RING_NAMES.includes(n) ? n : '') })];
    },

    explode(rom, name) {
        nameRingItems(rom);
        const files: Tree = new Map(), names: string[] = [], tables = [];
        const itemName = (at: number) => {
            if (rom[at] !== 0xA9) throw new Error(`rings: $${(0xC00000 | at).toString(16).toUpperCase()} is not the lda #imm this codec knows; another release?`);
            const v = word(rom, at + 1);
            if (v & 1 || v >= 2 * ITEM_COUNT) throw new Error(`rings: $${(0xC00000 | at).toString(16).toUpperCase()} loads $${v.toString(16)}, no ring item id`);
            tables.push({ start: at + 1, end: at + 3 });
            return name(RING_ITEMS, v / 2);
        };
        for (let id = 0; id < RING_COUNT; id++) {
            const n = name(RINGS, id), ring = RING_NAMES[id];
            names.push(n);
            const v: Record<string, unknown> = { buffer: wramText(word(rom, BUFFERS + 2 * id)), loop: LOOP_ROUTINES.name(word(rom, LOOPS + 2 * id)), flags: hexText(word(rom, FLAGS + 2 * id), 4) };
            const sites = ITEM_SITES[ring];
            if (ring === 'call_bead_spells') {
                const by: Record<string, unknown[]> = {};
                for (const s of sites) (by[s.caller!] ??= []).push({ item: itemName(s.at), when: s.when });
                v.items_by_caller = by;
            } else if (sites) v.items = sites.map(s => ({ item: itemName(s.at), when: s.when }));
            if (FILLED[ring]) v.filled_from = FILLED[ring];
            files.set(`${RINGS}/${n}.json`, json(v));
        }
        for (const t of [BUFFERS, LOOPS, FLAGS]) tables.push({ start: t, end: t + 2 * RING_COUNT });
        files.set(`${RINGS}/${ENUM}`, enumFile({ kind: RINGS, limit: RING_COUNT, names, why: 'ring id = 2·id into $8E:9920 (buffer), $8E:9944 (loop) and $8E:9968 (flags), 18 words each; the flows follow ($8E:998C)' }));
        return { files, pool: [], tables, homes: [] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(RINGS + '/') || path === `${RINGS}/${ENUM}`) continue;
            const m = new RegExp(`^${RINGS}/([^/]+)\\.json$`).exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a ring is <name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const ids = ctx.ids.get(RINGS) ?? new Map<string, number>(), items = ctx.ids.get(RING_ITEMS);
        for (const n of names) {
            const path = `${RINGS}/${n}.json`, id = ids.get(n);
            if (id === undefined || id >= RING_COUNT) { ctx.findings.error('id-over-limit', path, '', `the game has ${RING_COUNT} rings (code follows their tables)`); continue; }
            let v: any;
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            const r = readRing(v);
            if (typeof r === 'string') { const [p, ...why] = r.split(': '); ctx.findings.error('invalid-value', path, p, why.join(': ')); }
            const ring = RING_NAMES[id], list = siteItems(v, ring);
            if (list === null) { ctx.findings.error('invalid-value', path, ring === 'call_bead_spells' ? '/items_by_caller' : '/items', `${ITEM_SITES[ring].length} items, each { "item": <ring item> }: code writes them one by one, so their number is fixed`); continue; }
            list.forEach((x, k) => { if (items && !items.has(x as string)) ctx.findings.error('unknown-reference', path, '/items', `"${x}" (item ${k + 1}) is no ring item`); });
        }
        return [];
    },

    tables(ctx) {
        const ids = ctx.ids.get(RINGS), items = ctx.ids.get(RING_ITEMS);
        if (!ids) return [];
        const writes: Write[] = [], words = [BUFFERS, LOOPS, FLAGS].map(() => new Uint8Array(2 * RING_COUNT));
        for (const [n, id] of ids) {
            if (id >= RING_COUNT) continue;
            const path = `${RINGS}/${n}.json`, v = JSON.parse(readText(ctx.tree.get(path)!)), r = readRing(v);
            if (typeof r !== 'string') [r.buffer, r.loop, r.flags].forEach((w, k) => words[k].set([w & 0xFF, w >> 8], 2 * id));
            const ring = RING_NAMES[id];
            (siteItems(v, ring) ?? []).forEach((x, k) => {
                const item = items?.get(x as string);
                if (item !== undefined) writes.push({ at: ITEM_SITES[ring][k].at + 1, bytes: Uint8Array.of((2 * item) & 0xFF, (2 * item) >> 8), file: path });
            });
        }
        if (ids.size !== RING_COUNT) ctx.findings.error('missing-file', `${RINGS}/${ENUM}`, '', `all ${RING_COUNT} rings: each has its table words`);
        [BUFFERS, LOOPS, FLAGS].forEach((at, k) => writes.push({ at, bytes: words[k], file: `${RINGS}/${ENUM}` }));
        return writes;
    },
};

// ── ring flows ──
export const RING_FLOWS = 'ring_flows';
const FLOWS = map.file('ring_flows.table'), FLOWS_END = map.file('ring_flows.end');
const FLOW_NAMES = ['boy', 'dog', 'shop_0c', 'shop_0e', 'shop_10', 'shop_12', 'shop_20', 'call_bead_callers', 'equipment', 'collar', 'call_bead_spells', 'bazooka_ammo'];
/** How many rings each flow lists: the records are packed and each is read by its address, so this is the layout. */
const FLOW_COUNTS = [5, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1, 1];
const FLOW_AT = FLOW_COUNTS.map((_, i) => FLOWS + FLOW_COUNTS.slice(0, i).reduce((a, c) => a + 2 + 2 * c, 0));

export const ringFlowsCodec: Codec = {
    kind: RING_FLOWS, version: 1, path: RING_FLOWS, folder: `${GROUP}/${RING_FLOWS}`,
    defaultName: id => FLOW_NAMES[id] ?? `flow_${id}`,

    canonical(path, bytes) {
        if (path === `${RING_FLOWS}/${ENUM}`) return [path, bytes];
        return [path, json({ rings: JSON.parse(readText(bytes)).rings })];
    },

    explode(rom, name) {
        if (FLOW_AT.some((at, i) => word(rom, at) !== FLOW_COUNTS[i])) throw new Error('ring_flows: the records at $8E:998C are not the ones this codec knows; another release?');
        const files: Tree = new Map(), names: string[] = [];
        FLOW_AT.forEach((at, id) => {
            const n = name(RING_FLOWS, id);
            names.push(n);
            files.set(`${RING_FLOWS}/${n}.json`, json({ rings: Array.from({ length: FLOW_COUNTS[id] }, (_, k) => name(RINGS, word(rom, at + 2 + 2 * k) / 2)), what: 'Up/Down cycles through these rings in this order; one whose count is 0 is skipped' }));
        });
        files.set(`${RING_FLOWS}/${ENUM}`, enumFile({ kind: RING_FLOWS, limit: FLOW_NAMES.length, names, why: 'the flows are packed at $8E:998C-$99C9 and code and bank $CC hold each one\'s address, so each keeps its place and its length' }));
        return { files, pool: [], tables: [{ start: FLOWS, end: FLOWS_END }], homes: [] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(RING_FLOWS + '/') || path === `${RING_FLOWS}/${ENUM}`) continue;
            const m = new RegExp(`^${RING_FLOWS}/([^/]+)\\.json$`).exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a flow is <name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const ids = ctx.ids.get(RING_FLOWS) ?? new Map<string, number>(), rings = ctx.ids.get(RINGS);
        for (const n of names) {
            const path = `${RING_FLOWS}/${n}.json`, id = ids.get(n);
            if (id === undefined || id >= FLOW_COUNTS.length) { ctx.findings.error('id-over-limit', path, '', `the game has ${FLOW_COUNTS.length} flows (packed, each read by its address)`); continue; }
            let v: any;
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            if (!Array.isArray(v.rings) || v.rings.length !== FLOW_COUNTS[id]) { ctx.findings.error('invalid-value', path, '/rings', `${FLOW_COUNTS[id]} ring${FLOW_COUNTS[id] === 1 ? "" : "s"}: the flows are packed and each is read by its address, so a flow keeps its length`); continue; }
            v.rings.forEach((r: unknown, k: number) => { if (rings && !rings.has(r as string)) ctx.findings.error('unknown-reference', path, `/rings/${k}`, `"${r}" is no ring`); });
        }
        return [];
    },

    tables(ctx) {
        const ids = ctx.ids.get(RING_FLOWS), rings = ctx.ids.get(RINGS);
        if (!ids) return [];
        const bytes = new Uint8Array(FLOWS_END - FLOWS);
        for (const [n, id] of ids) {
            if (id >= FLOW_COUNTS.length) continue;
            const list: unknown[] = JSON.parse(readText(ctx.tree.get(`${RING_FLOWS}/${n}.json`)!)).rings ?? [], at = FLOW_AT[id] - FLOWS;
            bytes.set([FLOW_COUNTS[id], 0], at);
            list.slice(0, FLOW_COUNTS[id]).forEach((x, k) => { const ring = rings?.get(x as string) ?? 0; bytes.set([(2 * ring) & 0xFF, (2 * ring) >> 8], at + 2 + 2 * k); });
        }
        if (ids.size !== FLOW_COUNTS.length) ctx.findings.error('missing-file', `${RING_FLOWS}/${ENUM}`, '', `all ${FLOW_COUNTS.length} flows: they are packed`);
        return [{ at: FLOWS, bytes, file: `${RING_FLOWS}/${ENUM}` }] satisfies Write[];
    },
};

export const MENU_KINDS = [ringItemsCodec, ringsCodec, ringFlowsCodec, optionActionsCodec, itemActionsCodec, alchemyActionsCodec, callerActionsCodec, spellActionsCodec];
