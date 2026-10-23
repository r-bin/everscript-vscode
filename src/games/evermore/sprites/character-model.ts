// Ownership: one character as the Sprites tab shows it — its record's fields with what the game
// does with each, its animations (own, held weapon or Dog form, and the compiler's named ones),
// palette, boxes and disposition. Pure.
//
// Read from the game's own code (knowledge rom/8eb678.md has the field map and the evidence):
//   record      bank $8E, 74 bytes, addressed by the ENEMY table $8E:B55A (whose ROM entries
//               reach record 141: 142 records from $8E:B678)
//   +$00        24-bit pointer to the name, shown in a text window; the Boy's and the Dog's point
//               at their WRAM name buffers
//   weapons     $8F:81C9 copies the held weapon's entry into the Boy's WRAM record ($0A26): the
//               entry from $C4:3874[index] (the Bazooka by its ammo $2349 from $C4:388E), 36 bytes
//   Dog forms   $8F:9471 copies a form's entry into the Dog's ($0A70) (./dog-forms)

import indexJson from '../language/data/index.json';
import { CHARACTER_TABLE, CHARACTER_STRIDE, ANIMATION_TABLE, characterPalette, characterHitbox, paletteAddresses, paletteAt, read16At } from '../maps/character-record';
import { animationIdRecord, recordScript } from '../maps/animation-table';
import { readSpriteInfo, scriptSprites } from '../maps/sprites';
import { readDogForms } from './dog-forms';
import { hiromFileOffset } from '../../../platform/snes/hirom';

type Rom = Uint8Array;
/** An animation as the Sprites tab lists it. `category` says where it comes from. */
interface Anim {
    key: string; label: string; purpose: string | null; animRec: number; scriptAddr: number; flags: number; category: string;
    offset?: number; paletteAddr?: number; valueHex?: string; num?: number; comment?: string; field?: number;
}
/** The Boy's held weapons and the Dog's forms share this shape. */
interface Form { id: number; name: string; paletteAddr: number; entryHex: string; anims: { animRec: number; paletteAddr?: number }[] }
type AnimField = { key: string; label: string; offset: number; purpose: string; field?: number };

/** Records the ENEMY table reaches (the last ROM entry is record 141). */
const CHARACTER_COUNT = 142;

const u8 = (rom: Rom, bus: number): number => rom[hiromFileOffset(bus)];
const u24 = (rom: Rom, bus: number): number => (read16At(rom, bus) | (u8(rom, bus + 2) << 16)) >>> 0;
const hex = (v: number): string => '$' + (v >>> 0).toString(16);

/** What the game does with each stat field, with the code that does it. */
const STAT_MEANINGS: Record<string, string> = {
    hp: "Max HP (+0x0F). The HP an entity spawns with ($8FB15B) and the cap of every heal ($8FC0AC); the entity's own HP is +0x2A.",
    attack: 'Attack (+0x19). Scaled by the charge: ÷4 below 50 %, ÷2 below 100 %, ×2 from 200 %, ×4 from 300 % ($8FC02B).',
    defense: 'Defence (+0x1B). A quarter of it is subtracted from the attack; the hit then deals 3/4 to 5/4 of that ($8FC067).',
    magic_defense: 'Magic defence (+0x1D). Subtracted from alchemy damage on the Boy or Dog; an enemy takes (64 − m.def) / 64 of it, as a signed byte, so 64 or more means 1 damage and $FFC1 (−63) about double ($919C90).',
    evade: 'Evade (+0x1F). Picks the row of the to-hit table, one per 4 points, when this character is the target ($8FBA27).',
    hit_rate: "Hit rate (+0x21). Picks the column of the to-hit table, one per 4 points up to 100, when this character attacks ($8FBA06).",
    aggro_range: 'Aggro range (+0x13): the attack reach — it attacks once the target is lined up on one axis within it ($8FD9D1); stationary behaviours also engage only within it on both axes ($8FD69B). The Boy\'s is his weapon\'s reach.',
    aggro_chance: 'Aggro chance (+0x15): stationary behaviours only (STATIONARY, STATIONARY_PLAYER, STATIONARY_DIAGONAL): at full charge they engage when rand(0..255) < this ($8FD69B). Chasers always have a target.',
    exp: "EXP (+0x23). 32-bit, added in full to the Boy's ($0A49) and, while it lives, the Dog's ($0A93) totals ($8F8292).",
    money: "Money (+0x27): added on death to the current era's currency ($8F8689).",
    prize_chance: 'Prize chance (+0x29). A byte: on death it drops something when rand & $7F < this, value / 128 ($908567); 128 always. With a drop the death animation is +0x44 (spoils), otherwise +0x42.',
    radius: 'Collision radius (+0x0D). Body box 2r × r ($8FB4AB); the hit test\'s hurt region is half-size r around the feet ($8FB651). 0 = walk-through.',
    flags: 'Spawn flags (+0x05). OR\'d into entity +0x10 at spawn ($8FB0C3): friendly, party side, never sleeps, through bodies, phasing, no gravity, takes no damage… (docs/entities/entities-reference.md).',
    palette: 'Palette (+0x09). A 16-colour address in bank $90; the palette-slot allocator $90CD80 reuses a slot for an equal value.',
    charge_limit: 'Charge limit (+0x2C): how far a held charge ($8FCD88) and the Speed status ($91AEDE) fill the meter; $400 is 100 %. The Boy\'s follows his weapon level, the Dog\'s its attack level.',
    charge_speed: 'Charge speed (+0x2E): added to the charge meter (entity +0x2E) every tick until it reaches $400 ($8FCC5D); a held charge past that adds speed − 3 ($8FCD88).',
    attack_proc: 'Attack proc (+0x30): what its strikes and its body contact do, through the table $8FB6AE (0 = to-hit roll and damage; others add a status, skill on a kill, or no knockback).',
    ai_script: "Behaviour (+0x03): the AI routine, read on every idle tick through the record ($8FCD1A), so changing TYPE changes it. Names and what each does: docs/entities/ai-behaviours.md.",
    flags2: 'Flags (+0x07). Bit 0: segmented body, a segment list at $58AF ($8FC4BA). Bit 1: −30 hit rate against the party member the player does not control ($8FBA46). Bits 2–3: ring-menu item targets ($8C8658). Bit 4: immune to projectiles ($8FB9FB). Bits 5–7: unused.',
    palette2: 'Second palette (+0x0B): when non-zero, this and the first palette take sprite palette slots 1 and 0 ($90CD01, $90CF3A).',
    unknown11: '+0x11: copied into entity +0x2C at spawn ($8FB162), which no code reads: unused.',
    unknown17: 'Leash (+0x17): how far (|dx| + |dy| px) it may stray from its spawn point before it walks back ($8FDAA7); 0 = no limit. A room can override it ($23DD).',
};

/** Record fields: name, offset, width in bytes. */
const STATS: [string, number, number][] = [
    ['hp', 0x0f, 2], ['attack', 0x19, 2], ['defense', 0x1b, 2], ['magic_defense', 0x1d, 2], ['evade', 0x1f, 2], ['hit_rate', 0x21, 2],
    ['aggro_range', 0x13, 2], ['aggro_chance', 0x15, 2], ['exp', 0x23, 4], ['money', 0x27, 2], ['prize_chance', 0x29, 1],
    ['radius', 0x0d, 2], ['flags', 0x05, 2], ['palette', 0x09, 2], ['charge_limit', 0x2c, 2], ['charge_speed', 0x2e, 2],
    ['attack_proc', 0x30, 2], ['ai_script', 0x03, 2], ['flags2', 0x07, 2], ['palette2', 0x0b, 2], ['unknown11', 0x11, 2],
    ['unknown17', 0x17, 2],   // not +0x2A: the Boy's and the Dog's level; enemy records hold one that nothing reads
];

/**
 * The record's animation ids ($90:8240-$90:8317 choose among them): stand when still, walk when
 * moving, run when running, attack by charge, knockback, death with or without a drop ($90:8567),
 * cast, and +0x48, the dodge the hit reaction plays ($8F:C1D6); weapons and Dog forms bring their own.
 */
const STANDARD_ANIM_FIELDS: AnimField[] = [
    { key: 'stand', label: 'Idle', offset: 0x32, purpose: 'idle' },
    { key: 'walk', label: 'Walk', offset: 0x34, purpose: 'walk' },
    { key: 'run', label: 'Run', offset: 0x36, purpose: 'run' },
    { key: 'atk0', label: 'Attack Lvl 0', offset: 0x38, purpose: 'attack_0' },
    { key: 'atk1', label: 'Attack Lvl 1', offset: 0x3a, purpose: 'attack_1' },
    { key: 'atk2', label: 'Attack Lvl 2', offset: 0x3c, purpose: 'attack_2' },
    { key: 'atk3', label: 'Attack Lvl 3', offset: 0x3e, purpose: 'attack_3' },
    { key: 'damage', label: 'Knockback', offset: 0x40, purpose: 'knockback' },
    { key: 'death', label: 'Death', offset: 0x42, purpose: 'death' },
    { key: 'spoils', label: 'Death with spoils', offset: 0x44, purpose: 'spoils' },
    { key: 'block', label: 'Cast (alchemy / item)', offset: 0x46, purpose: 'cast' },
    { key: 'x48', label: 'Dodge (+0x48)', offset: 0x48, purpose: 'special' },
];

/**
 * A weapon entry's animation words and the Boy's record field each one overwrites when the weapon
 * is equipped ($8F:81C9, knowledge rom/8f81c9.md): +$08-+$14 → +$32-+$3E, +$16 → +$48, +$18 → +$40.
 */
const WEAPON_ANIMS: AnimField[] = [
    { key: 'w_stand', label: 'Idle', purpose: 'idle', offset: 0x08, field: 0x32 },
    { key: 'w_walk', label: 'Walk', purpose: 'walk', offset: 0x0a, field: 0x34 },
    { key: 'w_run', label: 'Run', purpose: 'run', offset: 0x0c, field: 0x36 },
    { key: 'w_atk0', label: 'Attack Lvl 0', purpose: 'attack_0', offset: 0x0e, field: 0x38 },
    { key: 'w_atk1', label: 'Attack Lvl 1', purpose: 'attack_1', offset: 0x10, field: 0x3a },
    { key: 'w_atk2', label: 'Attack Lvl 2', purpose: 'attack_2', offset: 0x12, field: 0x3c },
    { key: 'w_atk3', label: 'Attack Lvl 3', purpose: 'attack_3', offset: 0x14, field: 0x3e },
    { key: 'w_charge', label: 'Dodge (invulnerable)', purpose: 'dodge', offset: 0x16, field: 0x48 },
    { key: 'w_damage', label: 'Knockback', purpose: 'knockback', offset: 0x18, field: 0x40 },
];

/**
 * Behaviour (+$03) values by the compiler's IDLE_BEHAVIOR names, with what uses each: the word
 * index into the AI jump table $8FCBE0 that $8FCD1A dispatches through (docs/entities/enemy_ai.md).
 */
function behaviourNames(): { value: number; name: string; note: string }[] {
    const enums = (indexJson.enums || {}) as unknown as Record<string, { name: string; value: string; comment?: string }[]>;
    return (enums.IDLE_BEHAVIOR || []).map((e) => ({ value: parseInt(e.value, 16), name: e.name, note: (e.comment || '').replace(/^used:\s*/, '') }))
        .sort((a, b) => a.value - b.value);
}

/** Weapon entries in $C4:3874 order (index 0 is no weapon), then the Bazooka's three by its ammo. */
const WEAPON_TABLE = 0xc43874, BAZOOKA_TABLE = 0xc4388e, WEAPON_BANK = 0xc40000;
const WEAPON_NAMES = ['Bone Crusher', 'Gladiator Sword', 'Crusader Sword', 'Neutron Blade', "Spider's Claw", 'Bronze Axe', 'Knight Basher',
    'Atom Smasher', 'Horn Spear', 'Bronze Spear', 'Lance', 'Laser Lance', 'Bazooka', 'Bazooka (Thunder Ball)', 'Bazooka (Particle Bomb)'];
const WEAPON_PALETTE = 0x04;

const BOY = 0, DOG = 1;
const NAME_BUFFERS: Record<number, string> = { 0x7e2210: '<Boy Name>', 0x7e2234: '<Dog Name>' };

function anim(rom: Rom, base: { animRec: number }, extra: Omit<Anim, 'animRec' | 'scriptAddr' | 'flags'>): Anim {
    const animRec = base.animRec;
    return {
        ...extra, animRec, scriptAddr: animRec ? recordScript(rom, animRec) : 0,
        flags: animRec ? u8(rom, ANIMATION_TABLE + animRec + 3) : 0,
    };
}

/** The animations of each weapon the Boy can hold, by $8F:81C9's entries. */
function readWeaponAnimations(rom: Rom): (Form & { anims: Anim[] })[] {
    const entries: number[] = [];
    for (let i = 1; i <= 12; i++) entries.push(read16At(rom, WEAPON_TABLE + 2 * i));
    for (let i = 0; i < 3; i++) entries.push(read16At(rom, BAZOOKA_TABLE + 2 * i));
    return entries.map((e, id) => {
        const at = WEAPON_BANK | e;
        const paletteAddr = read16At(rom, at + WEAPON_PALETTE);
        const anims = WEAPON_ANIMS.map((w) => anim(rom, { animRec: read16At(rom, at + w.offset) }, { ...w, category: 'weapon', paletteAddr }))
            .filter((a) => a.animRec);
        return { id, name: WEAPON_NAMES[id], paletteAddr, entryHex: hex(at), anims };
    });
}

/** The compiler's named animations for this character (ANIMATION_BOY, ANIMATION_DOG, its prefix in ANIMATION_ENEMY). */
function externalAnimations(rom: Rom, id: number, name: string, record: number): Anim[] {
    const enums = (indexJson.enums || {}) as unknown as Record<string, { name: string; value: string; comment?: string }[]>;
    let list: { name: string; value: string; comment?: string }[] = [];
    if (id === BOY) list = enums.ANIMATION_BOY || [];
    else if (id === DOG) list = enums.ANIMATION_DOG || [];
    else if (name) {
        const prefix = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_';
        list = (enums.ANIMATION_ENEMY || []).filter((e) => e.name.startsWith(prefix));
    }
    return list.map((e) => {
        const num = enumValue(enums, e.value);
        // $8C:E139: ids from $8000 read the character's ROM record at +0x32 + (id & $7FFF) (a long read in bank $8E,
        // so an equipped weapon or Dog form does not change them); below, the global id table $C4:3C92.
        const animRec = !isFinite(num) ? 0 : num >= 0x8000 ? read16At(rom, record + 0x32 + (num & 0x7fff)) : animationIdRecord(rom, num);
        const purpose = /RUN/.test(e.name) ? 'run' : /WALK/.test(e.name) ? 'walk' : /ATTACK/.test(e.name) ? 'attack' : /STAND|IDLE/.test(e.name) ? 'idle' : /DAMAGE/.test(e.name) ? 'knockback' : 'external';
        // animate() changes no palette: an ACTn_ id plays in whatever palette the character has.
        return anim(rom, { animRec }, {
            key: e.name, label: e.name.replace(/_/g, ' '), purpose, valueHex: '0x' + num.toString(16), num, category: 'external', comment: e.comment || '',
        });
    }).filter((a) => a.animRec);
}

/** An enum value: a hex literal, or another enum's member (`ANIMATION_ALL.SLASH_1`, as Vigor's ids are written). */
function enumValue(enums: Record<string, { name: string; value: string }[]>, value: string): number {
    const ref = /^([A-Z0-9_]+)\.([A-Z0-9_]+)$/.exec(value.trim());
    if (ref) {
        const hit = (enums[ref[1]] || []).find((m) => m.name === ref[2]);
        return hit ? enumValue(enums, hit.value) : NaN;
    }
    return parseInt(value, 16);
}

/** Attack proc (+$30) values by the compiler's ATTACK_PROC names (what a hit by the character does, $8FB6A5). */
function attackProcNames(): { value: number; name: string; note: string }[] {
    const enums = (indexJson.enums || {}) as unknown as Record<string, { name: string; value: string; comment?: string }[]>;
    return (enums.ATTACK_PROC || []).map((e) => ({ value: parseInt(e.value, 16), name: e.name, note: e.comment || '' }))
        .sort((a, b) => a.value - b.value);
}

/** Whether a script names a sprite that draws something. */
function showsSprite(rom: Rom, script: number): boolean {
    return !!script && scriptSprites(rom, script).some((s) => readSpriteInfo(rom, s).chunks.length > 0);
}

function readName(rom: Rom, ptr: number): string {
    if (NAME_BUFFERS[ptr]) return NAME_BUFFERS[ptr];
    if ((ptr >>> 16) < 0x80) return '';
    let s = '';
    for (let a = ptr; s.length < 32; a++) {
        const c = u8(rom, a);
        if (!c) break;
        s += String.fromCharCode(c);
    }
    return s;
}

const hexColour = ([r, g, b]: [number, number, number]): string => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

function readCharacter(rom: Rom, id: number) {
    const record = CHARACTER_TABLE + id * CHARACTER_STRIDE;
    const namePtr = u24(rom, record);
    const name = readName(rom, namePtr);
    const stats: Record<string, number> = {};
    for (const [key, off, width] of STATS) {
        stats[key] = width === 1 ? u8(rom, record + off) : width === 4 ? (read16At(rom, record + off) | (read16At(rom, record + off + 2) << 16)) >>> 0 : read16At(rom, record + off);
    }
    const hitbox = characterHitbox(rom, id);
    const fields = STANDARD_ANIM_FIELDS.map((f) => anim(rom, { animRec: read16At(rom, record + f.offset) }, { ...f, category: 'standard' }));
    const own = fields.filter((a) => a.animRec);
    // Record fields that hold no animation: listed too, so every field of the record shows.
    const emptyFields = fields.filter((a) => !a.animRec).map((a) => ({ key: a.key, label: a.label, offset: a.offset }));
    const boyWeapons = id === BOY ? readWeaponAnimations(rom) : null;
    const weapons: Form[] | null = boyWeapons || (id === DOG ? readDogForms(rom) : null);
    // The Boy's own fields are his record as stored (no weapon); an equipped weapon overwrites them (`field`).
    const anims = [...own, ...externalAnimations(rom, id, name, record)];
    const drawn = own.filter((a) => a.purpose !== 'death' && a.purpose !== 'spoils');
    const noVisuals = !drawn.some((a) => showsSprite(rom, a.scriptAddr)) && !(id === BOY || id === DOG);
    const flags = stats.flags;
    const hostile = !(flags & 0x0002);
    return {
        id, name: name || '#' + id, noVisuals, snes: record, snesHex: hex(record), namePtr, namePtrHex: hex(namePtr),
        stats, hitbox,
        hurtbox: { radius: hitbox.radius, width: 2 * hitbox.radius, height: 2 * hitbox.radius },
        disposition: { hostile, inactive: (flags & 0x0020) !== 0, phasing: (flags & 0x0400) !== 0, label: hostile ? 'Enemy' : 'NPC / Friendly' },
        paletteAddrHex: '0x' + stats.palette.toString(16),
        paletteIndex: paletteAddresses(rom).indexOf(stats.palette & 0xffff),
        paletteColors: characterPalette(rom, id).map(hexColour),
        palette2Index: stats.palette2 ? paletteAddresses(rom).indexOf(stats.palette2 & 0xffff) : -1,
        palette2Colors: stats.palette2 ? paletteAt(rom, stats.palette2).map(hexColour) : null,
        weapons, anims, emptyFields, statMeanings: STAT_MEANINGS,
    };
}

function readAllCharacters(rom: Rom) {
    const out: ReturnType<typeof readCharacter>[] = [];
    for (let id = 0; id < CHARACTER_COUNT; id++) out.push(readCharacter(rom, id));
    return out;
}

export { behaviourNames, attackProcNames, CHARACTER_TABLE, CHARACTER_STRIDE, CHARACTER_COUNT, STAT_MEANINGS, STANDARD_ANIM_FIELDS, WEAPON_NAMES, readWeaponAnimations, readCharacter, readAllCharacters };
