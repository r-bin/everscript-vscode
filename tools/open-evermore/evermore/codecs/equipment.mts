// The equipment kinds (docs/open-evermore/resources.md §equipment): the Boy's weapons, the Bazooka's ammo, the weapon
// schools and the armour. Records the game reads in place (records.mts): the weapon record pointers ($C4:3874) stay in
// _base/ and WRAM keeps an armour record's address ($0AC0-$0AC4), so every record keeps its place; their fields are
// written where they were.
//
// Facts used (knowledge routines/weapon_entries.md, boy_load_weapon.md, tbl_armor_records.md, v0.456.0):
//   weapon index  0 fist, 1-12 the weapons, 13 the Bazooka (2·index in $0ABA, $235F, the ring and the room hand-over $2441);
//                 tables by 2·index in bank $C4: $59A4 the owned flag's byte and $59C0 its bit, $59DC the school,
//                 $59F8 the description (1-12; the Bazooka's word is no text), $3874 the record pointer (1-12)
//   weapon record 36 bytes ($C4:38E6 + 36·(index-1)), as boy_load_weapon ($8F:81C9) copies them into the Boy's character
//                 record in WRAM ($0A26): +0 attack (and +¼ more for school 0, $8F:8491), +2 the name ($8E ring loop), +4 the
//                 palette (record +$09), +6 the range (+$13), +8-+$14 stand, walk, run, attack 0-3 (+$32-+$3E), +$16 dodge
//                 (+$48), +$18 knockback (+$40), +$1A/+$1C two more words ($1460, $1462; use not traced), +$1E the ring item;
//                 +$20-+$23 zero, read by nothing seen (stay in _base/)
//   ammo          the Bazooka's record is its ammo's: $C4:388E + 2·ammo ($2349) → $C4:3A96 + 36·ammo
//   schools       2·school: the weapon skill screen draws and runs one page per school (JMP ($93D8,x), JMP ($9404,x) in
//                 ring_option_weapon_skill, X = the equipped weapon's school); $2360 holds the equipped weapon's
//   armour        40 records of 10 bytes at $C4:3B02 (pointers $C4:3896): +0 the defence the stats add ($8F:84BD), +2 the
//                 defence the armour ring shows ($8E:A66B), +4 the name, +6 a second text (all 40: the same empty one),
//                 +8 the ring item
// Names: each weapon, ammo and armour from its ring item's text (menus.mts), so no game text is in this file.
import { nameRingItems } from './menus.mts';
import { recordsCodec, wramText } from './records.mts';
import type { Field, Form } from './records.mts';

const GROUP = 'equipment';
export const WEAPONS = 'weapons', AMMO = 'bazooka_ammo', SCHOOLS = 'weapon_schools', ARMOUR = 'armour';

const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const C4 = 0x040000, POINTERS = C4 + 0x3874, WEAPON_RECORDS = C4 + 0x38E6, AMMO_RECORDS = C4 + 0x3A96, ARMOUR_RECORDS = C4 + 0x3B02;
const RECORD = 36, WEAPON_COUNT = 14, AMMO_COUNT = 3, ARMOUR_COUNT = 40, ARMOUR_RECORD = 10;
const RING_ITEM: Form = { type: 'ref', kind: 'ring_items', scale: 2 };
const ANIMATION: Form = { type: 'hex', bank: 0xC4 };

/** The weapon record's fields, at `base` + 36·id + offset; `ids` the ids that have a record. */
function recordFields(base: number, ids?: (id: number) => boolean): Field[] {
    const f = (path: string, offset: number, form: Form): Field => ({ path, at: base + offset, stride: RECORD, form, ids });
    return [
        f('name', 0x02, { type: 'ring_text' }), f('ring_item', 0x1E, RING_ITEM), f('attack', 0x00, { type: 'number' }),
        f('range', 0x06, { type: 'number' }), f('palette', 0x04, { type: 'hex' }),
        ...['stand', 'walk', 'run', 'attack_0', 'attack_1', 'attack_2', 'attack_3', 'dodge', 'knockback'].map((n, k) => f(`animations/${n}`, 0x08 + 2 * k, ANIMATION)),
        f('unknown_1a', 0x1A, { type: 'hex' }), f('unknown_1c', 0x1C, { type: 'hex' }),
    ];
}

let WEAPON_NAMES: string[] = [], AMMO_NAMES: string[] = [], ARMOUR_NAMES: string[] = [];
/** Names from the ring item each record names (+$1E, +8), without the ring item's category prefix. */
function prepare(rom: Uint8Array): void {
    if (WEAPON_NAMES.length) return;
    const items = nameRingItems(rom), strip = (n: string, prefix: string) => n.replace(new RegExp(`^${prefix}_`), '');
    const item = (at: number, prefix: string) => strip(items[word(rom, at) / 2], prefix);
    // The Bazooka's ring item is the code's `#$40` (calc_equipped_armor_defense, X = $1A).
    WEAPON_NAMES = ['fist', ...Array.from({ length: 12 }, (_, k) => item(WEAPON_RECORDS + RECORD * k + 0x1E, 'weapon')), strip(items[0x40 / 2], 'weapon')];
    AMMO_NAMES = Array.from({ length: AMMO_COUNT }, (_, k) => item(AMMO_RECORDS + RECORD * k + 0x1E, 'ammo'));
    ARMOUR_NAMES = Array.from({ length: ARMOUR_COUNT }, (_, k) => item(ARMOUR_RECORDS + ARMOUR_RECORD * k + 8, 'armour'));
}

/** The pointer tables must point at the records where this codec reads them. */
function check(rom: Uint8Array): void {
    const at = (k: number) => C4 | word(rom, POINTERS + 2 * k);
    const ok = [...Array.from({ length: 12 }, (_, k) => at(k + 1) === WEAPON_RECORDS + RECORD * k),
        ...Array.from({ length: AMMO_COUNT }, (_, k) => at(13 + k) === AMMO_RECORDS + RECORD * k),
        ...Array.from({ length: ARMOUR_COUNT }, (_, k) => at(17 + k) === ARMOUR_RECORDS + ARMOUR_RECORD * k)];
    if (!ok.every(Boolean)) throw new Error('equipment: the record pointers at $C4:3874 are not the ones this codec knows; another release?');
}

const hasRecord = (id: number) => id >= 1 && id <= 12;
export const weaponsCodec = recordsCodec({
    kind: WEAPONS, group: GROUP, count: WEAPON_COUNT, names: () => WEAPON_NAMES, prepare, check,
    why: 'weapon index = id (2·id in $0ABA, $235F and $2441): the tables at $C4:59A4, $59C0, $59DC, $59F8 and the record pointers $C4:3874 hold 14 words each, and WRAM has one skill word per weapon ($0ADD + 2·id)',
    fields: [
        { path: 'school', at: C4 + 0x59DC, stride: 2, form: { type: 'ref', kind: SCHOOLS, scale: 2 } },
        { path: 'owned/flags', at: C4 + 0x59A4, stride: 2, form: { type: 'wram' }, ids: id => id > 0 },
        { path: 'owned/bit', at: C4 + 0x59C0, stride: 2, form: { type: 'hex' }, ids: id => id > 0 },
        { path: 'description', at: C4 + 0x59F8, stride: 2, form: { type: 'text' }, ids: hasRecord },
        ...recordFields(WEAPON_RECORDS - RECORD, hasRecord),
    ],
    notes: id => ({
        skill: wramText(0x0ADD + 2 * id),
        ...(id === 0 ? { what: 'no weapon: no record, owned flag or description' } : {}),
        ...(id === 13 ? { what: 'its record is the ammo\'s (equipment/bazooka_ammo/): $C4:3874 + 2·13 is the first ammo\'s, and boy_load_weapon takes $C4:388E + 2·ammo' } : {}),
    }),
});

export const ammoCodec = recordsCodec({
    kind: AMMO, group: GROUP, count: AMMO_COUNT, names: () => AMMO_NAMES, prepare,
    why: 'ammo id = $2349: the record pointer is $C4:388E + 2·id (words 13-15 of $C4:3874); three ammo items in the ring ($2345-$2347 held)',
    fields: recordFields(AMMO_RECORDS),
});

const SCHOOL_NAMES = ['sword', 'axe', 'spear', 'bazooka'];
export const schoolsCodec = recordsCodec({
    kind: SCHOOLS, group: GROUP, count: SCHOOL_NAMES.length, names: () => SCHOOL_NAMES,
    why: 'a weapon\'s school is 2·id ($C4:59DC, $2360); the weapon skill screen jumps by it through $8E:93D8 and $8E:9404, four words each with code right after',
    fields: [
        { path: 'skill_screen/draw', at: 0x0E93D8, stride: 2, form: { type: 'routine', bank: 0x8E } },
        { path: 'skill_screen/loop', at: 0x0E9404, stride: 2, form: { type: 'routine', bank: 0x8E } },
    ],
    notes: id => ({
        what: [
            'the weapons of school 0 add a quarter of their attack again ($8F:8491); the fist is in it',
            'axes', 'spears',
            'the Bazooka; the weapon skill screen shows the sword page for it (vanilla)',
        ][id],
    }),
});

export const armourCodec = recordsCodec({
    kind: ARMOUR, group: GROUP, count: ARMOUR_COUNT, names: () => ARMOUR_NAMES, prepare,
    why: 'armour id = the record pointer\'s place after $C4:3894 (a ring item\'s index); WRAM keeps the equipped record\'s address ($0AC0-$0AC4), so the 40 records stay where they are',
    fields: [
        { path: 'name', at: ARMOUR_RECORDS + 4, stride: ARMOUR_RECORD, form: { type: 'ring_text' } },
        { path: 'ring_item', at: ARMOUR_RECORDS + 8, stride: ARMOUR_RECORD, form: RING_ITEM },
        { path: 'defense', at: ARMOUR_RECORDS, stride: ARMOUR_RECORD, form: { type: 'number' } },
        { path: 'defense_shown', at: ARMOUR_RECORDS + 2, stride: ARMOUR_RECORD, form: { type: 'number' } },
        { path: 'text_2', at: ARMOUR_RECORDS + 6, stride: ARMOUR_RECORD, form: { type: 'text' } },
    ],
    notes: id => ({ slot: id < 12 ? 'body' : id < 24 ? 'helm' : id < 36 ? 'gloves' : 'collar (the Dog)' }),
});

export const EQUIPMENT_KINDS = [schoolsCodec, weaponsCodec, ammoCodec, armourCodec];
