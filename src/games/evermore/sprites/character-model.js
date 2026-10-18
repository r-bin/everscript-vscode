'use strict';
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

const indexJson = require('../language/data/index.json');
const { CHARACTER_TABLE, CHARACTER_STRIDE, ANIMATION_TABLE, characterPalette, characterHitbox, read16At } = require('../../../../dist/games/evermore/maps/character-record');
const { animationIdRecord, recordScript } = require('../../../../dist/games/evermore/maps/animation-table');
const { readSpriteInfo, scriptSprites } = require('../../../../dist/games/evermore/maps/sprites');
const { readDogForms } = require('../../../../dist/games/evermore/sprites/dog-forms');

/** Records the ENEMY table reaches (the last ROM entry is record 141). */
const CHARACTER_COUNT = 142;

const u8 = (rom, bus) => rom[bus & 0x3fffff];
const u24 = (rom, bus) => (read16At(rom, bus) | (u8(rom, bus + 2) << 16)) >>> 0;
const hex = (v) => '$' + (v >>> 0).toString(16);

/** What the game does with each stat field, with the code that does it. */
const STAT_MEANINGS = {
    hp: "HP (+0x0F). Copied into the entity's HP (+0x2A) when it spawns ($8FB15B).",
    attack: 'Attack (+0x19). Used by the damage routine $8FC067.',
    defense: 'Defence (+0x1B). Subtracted in the damage routine $8FC067.',
    magic_defense: 'Magic defence (+0x1D). Alchemy damage scales by ($40 − m.def) / $40 ($919CB3).',
    evade: 'Evade (+0x1F). Indexes the to-hit table at $8FBAAF when this character is the target ($8FBA27).',
    hit_rate: "Hit rate (+0x21). The attacker's side of the to-hit roll ($8FBA53); −30 when flags2 bit 1 is set.",
    aggro_range: 'Aggro range (+0x13): engages when the target is within this many pixels in x AND in y — a square, not a circle ($8FD72D) — then turns to face it.',
    aggro_chance: 'Aggro chance (+0x15): once stamina (entity +0x2E) is full, engages when rand(0..255) < this ($8FD69B); the check covers both party members.',
    exp: "EXP (+0x23, 32-bit). Added to both the Boy's ($0A49) and the Dog's ($0A93) totals ($8F8292).",
    money: 'Talons (+0x27).',
    prize_chance: 'Prize chance (+0x29, byte). On death a drop happens when rand & $7F < this: value / 128 ($908567). With a drop the death animation is +0x44 (spoils), otherwise +0x42.',
    radius: 'Collision radius (+0x0D). Body box 2r × r ($8FB4AB); the hit test\'s hurt region is half-size r around the feet ($8FB651). 0 = walk-through.',
    flags: 'Spawn flags (+0x05), OR\'d into entity +0x10 at spawn ($8FB0C3). Bit 1: touching it runs no contact handler ($8FB564); bit 5: left out of targeting ($8FD8D2); $0400 phasing. The hit test compares the side bits $5006 ($8FB606), and $4000 on the target blocks damage ($8FC0D9).',
    palette: 'Palette (+0x09), a 16-colour address in bank $90; the palette-slot allocator $90CD80 reuses a slot for an equal value.',
    charge_limit: 'Charge limit (+0x2C): the cap on the charge meter (entity +0x2E, $91AEDE). 1024 ($400) is a full charge.',
    charge_speed: 'Charge speed (+0x2E): added to the charge meter (entity +0x2E) every tick until it reaches $400 ($8FCC5D).',
    attack_proc: 'Attack proc (+0x30): what a hit by this character does, dispatched at $8FB6A5 through $8FB6AE (0 = to-hit roll and damage).',
    ai_script: "Behaviour (+0x03): selects the entity's AI script ($8FCD1A).",
    flags2: 'Flags (+0x07). Bit 0: registered in the list at $58AF ($8FC4BA). Bit 1: −30 hit rate ($8FBA46). Bits 2–3: tested by the script engine ($8C86A6, $8C86DA). Bit 4: immune to projectiles — an automatic miss ($8FB9FB).',
    palette2: 'Second palette (+0x0B): when non-zero, loaded into palette slot 2 ($90CD01, $90CF3A).',
    unknown11: '+0x11: copied into entity +0x2C at spawn ($8FB162). Meaning open.',
    unknown17: '+0x17: copied into entity +0x40 at spawn unless $23DD overrides it ($8FB169). Meaning open.',
    unknown2a: 'Level (+0x2A): the compiler\'s ATTRIBUTE_GENERAL.LEVEL. No code reads it directly from the record.',
};

/** Record fields: name, offset, width in bytes. */
const STATS = [
    ['hp', 0x0f, 2], ['attack', 0x19, 2], ['defense', 0x1b, 2], ['magic_defense', 0x1d, 2], ['evade', 0x1f, 2], ['hit_rate', 0x21, 2],
    ['aggro_range', 0x13, 2], ['aggro_chance', 0x15, 2], ['exp', 0x23, 4], ['money', 0x27, 2], ['prize_chance', 0x29, 1],
    ['radius', 0x0d, 2], ['flags', 0x05, 2], ['palette', 0x09, 2], ['charge_limit', 0x2c, 2], ['charge_speed', 0x2e, 2],
    ['attack_proc', 0x30, 2], ['ai_script', 0x03, 2], ['flags2', 0x07, 2], ['palette2', 0x0b, 2], ['unknown11', 0x11, 2],
    ['unknown17', 0x17, 2], ['unknown2a', 0x2a, 2],
];

/**
 * The record's animation ids ($90:8240-$90:8317 choose among them): stand when still, walk when
 * moving, run when running, attack by charge, knockback, death with or without a drop ($90:8567),
 * cast, and +0x48, the dodge the hit reaction plays ($8F:C1D6); weapons and Dog forms bring their own.
 */
const STANDARD_ANIM_FIELDS = [
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

/** A weapon entry's animation words ($8F:81C9) and the record field each one fills. */
const WEAPON_ANIMS = [
    { key: 'w_stand', label: 'Idle', purpose: 'idle', offset: 0x08 },
    { key: 'w_walk', label: 'Walk', purpose: 'walk', offset: 0x0a },
    { key: 'w_run', label: 'Run', purpose: 'run', offset: 0x0c },
    { key: 'w_atk0', label: 'Attack Lvl 0', purpose: 'attack_0', offset: 0x0e },
    { key: 'w_atk1', label: 'Attack Lvl 1', purpose: 'attack_1', offset: 0x10 },
    { key: 'w_atk2', label: 'Attack Lvl 2', purpose: 'attack_2', offset: 0x12 },
    { key: 'w_atk3', label: 'Attack Lvl 3', purpose: 'attack_3', offset: 0x14 },
    { key: 'w_charge', label: 'Dodge (invulnerable)', purpose: 'dodge', offset: 0x16 },
    { key: 'w_damage', label: 'Knockback', purpose: 'knockback', offset: 0x18 },
];

/** Weapon entries in $C4:3874 order (index 0 is no weapon), then the Bazooka's three by its ammo. */
const WEAPON_TABLE = 0xc43874, BAZOOKA_TABLE = 0xc4388e, WEAPON_BANK = 0xc40000;
const WEAPON_NAMES = ['Bone Crusher', 'Gladiator Sword', 'Crusader Sword', 'Neutron Blade', "Spider's Claw", 'Bronze Axe', 'Knight Basher',
    'Atom Smasher', 'Horn Spear', 'Bronze Spear', 'Lance', 'Laser Lance', 'Bazooka', 'Bazooka (Thunder Ball)', 'Bazooka (Particle Bomb)'];
const WEAPON_PALETTE = 0x04;

const BOY = 0, DOG = 1;
const NAME_BUFFERS = { 0x7e2210: '<Boy Name>', 0x7e2234: '<Dog Name>' };

function anim(rom, base, extra) {
    const animRec = base.animRec;
    return {
        ...extra, animRec, scriptAddr: animRec ? recordScript(rom, animRec) : 0,
        flags: animRec ? u8(rom, ANIMATION_TABLE + animRec + 3) : 0,
    };
}

/** The animations of each weapon the Boy can hold, by $8F:81C9's entries. */
function readWeaponAnimations(rom) {
    const entries = [];
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
function externalAnimations(rom, id, name, record, forms) {
    const enums = indexJson.enums || {};
    let list = [];
    if (id === BOY) list = enums.ANIMATION_BOY || [];
    else if (id === DOG) list = enums.ANIMATION_DOG || [];
    else if (name) {
        const prefix = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '_';
        list = (enums.ANIMATION_ENEMY || []).filter((e) => e.name.startsWith(prefix));
    }
    return list.map((e) => {
        const num = parseInt(e.value, 16);
        // Ids from $8000 name a field of the character's own record; below, the global id table.
        const animRec = num >= 0x8000 ? read16At(rom, record + (num & 0x7fff)) : animationIdRecord(rom, num);
        const purpose = /RUN/.test(e.name) ? 'run' : /WALK/.test(e.name) ? 'walk' : /ATTACK/.test(e.name) ? 'attack' : /STAND|IDLE/.test(e.name) ? 'idle' : /DAMAGE/.test(e.name) ? 'knockback' : 'external';
        const out = anim(rom, { animRec }, {
            key: e.name, label: e.name.replace(/_/g, ' '), purpose, valueHex: '0x' + num.toString(16), num, category: 'external', comment: e.comment || '',
        });
        const act = /^ACT(\d)_/.exec(e.name);
        const form = act && forms.find((f) => f.name.startsWith('Act ' + act[1]));
        if (form) out.paletteAddr = form.paletteAddr;
        return out;
    }).filter((a) => a.animRec);
}

/** Whether a script names a sprite that draws something. */
function showsSprite(rom, script) {
    return !!script && scriptSprites(rom, script).some((s) => readSpriteInfo(rom, s).chunks.length > 0);
}

function readName(rom, ptr) {
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

const hexColour = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

function readCharacter(rom, id) {
    const record = CHARACTER_TABLE + id * CHARACTER_STRIDE;
    const namePtr = u24(rom, record);
    const name = readName(rom, namePtr);
    const stats = {};
    for (const [key, off, width] of STATS) {
        stats[key] = width === 1 ? u8(rom, record + off) : width === 4 ? (read16At(rom, record + off) | (read16At(rom, record + off + 2) << 16)) >>> 0 : read16At(rom, record + off);
    }
    const hitbox = characterHitbox(rom, id);
    const own = STANDARD_ANIM_FIELDS.map((f) => anim(rom, { animRec: read16At(rom, record + f.offset) }, { ...f, category: 'standard' })).filter((a) => a.animRec);
    const weapons = id === BOY ? readWeaponAnimations(rom) : id === DOG ? readDogForms(rom) : null;
    const anims = [...(id === BOY ? weapons[0].anims : []), ...own, ...externalAnimations(rom, id, name, record, weapons || [])];
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
        paletteColors: characterPalette(rom, id).map(hexColour),
        weapons, anims, statMeanings: STAT_MEANINGS,
    };
}

function readAllCharacters(rom) {
    const out = [];
    for (let id = 0; id < CHARACTER_COUNT; id++) out.push(readCharacter(rom, id));
    return out;
}

module.exports = {
    CHARACTER_TABLE,
    CHARACTER_STRIDE,
    CHARACTER_COUNT,
    STAT_MEANINGS,
    STANDARD_ANIM_FIELDS,
    WEAPON_NAMES,
    readWeaponAnimations,
    readCharacter,
    readAllCharacters,
};
