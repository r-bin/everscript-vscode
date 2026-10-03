'use strict';
// Ownership: character records, stat definitions, and animation mappings for the Sprites tab. Pure.
// Layout from SoETilesViewer's characterdata.h, verified field by field against ROM.
// Base address: $8EB678, stride: 74 bytes. 142 total character records.

const indexJson = require('../language/data/index.json');
const { snesToRom } = require('../maps/dist/rom');
const { paletteAt } = require('../maps/dist/character-record');
const { runAnimation, animationIdRecord } = require('../maps/dist/animation-vm');
const { readDogForms } = require('./dog-forms');

const CHARACTER_TABLE = 0x8eb678;
const CHARACTER_STRIDE = 74;
const CHARACTER_COUNT = 142;

const BOY_NAME_PTR = 0x7e2210;
const DOG_NAME_PTR = 0x7e2234;

const ANIMATION_RECORD_TABLE = 0xc40000;

const WEAPONS_BASE = 0x0438e6;
const WEAPON_STRIDE = 36;
const WEAPON_COUNT = 15;

const WEAPON_NAMES = [
    'Bone Crusher',
    'Gladiator Sword',
    'Crusader Sword',
    'Neutron Blade',
    "Spider's Claw",
    'Bronze Axe',
    'Knight Basher',
    'Atom Smasher',
    'Horn Spear',
    'Bronze Spear',
    'Lance',
    'Laser Lance',
    'Bazooka',
    'Bazooka (Thunder Ball)',
    'Bazooka (Particle Bomb)',
];

const WEAPON_ANIM_OFFSETS = [
    { key: 'w_stand', label: 'Idle', offset: 0x08 },
    { key: 'w_walk', label: 'Walk', offset: 0x0a },
    { key: 'w_run', label: 'Run', offset: 0x0c },
    { key: 'w_atk0', label: 'Attack Lvl 0', offset: 0x0e },
    { key: 'w_atk1', label: 'Attack Lvl 1', offset: 0x10 },
    { key: 'w_atk2', label: 'Attack Lvl 2', offset: 0x12 },
    { key: 'w_atk3', label: 'Attack Lvl 3', offset: 0x14 },
    // Was 'Charge Attack': a held pose with mode $0020 (invulnerable) — the dodge.
    { key: 'w_charge', label: 'Dodge (invulnerable)', offset: 0x16 },
    { key: 'w_damage', label: 'Knockback', offset: 0x18 },
];

/** A script in the animation banks that draws at least one sprite when run. */
function isValidAnimationScript(rom, scriptAddr) {
    if (!scriptAddr) return false;
    const bank = (scriptAddr >> 16) & 0xff;
    if (bank < 0xc4 || bank > 0xce) return false;
    return runAnimation(rom, scriptAddr).frames.some((f) => f.sprite);
}

/**
 * Weapon record +0x04: the Boy's palette while holding this weapon. Read from the data,
 * not a traced reader: across all 15 weapons it keeps the Boy's skin and outline
 * (slots 1, 2, 4, 5, 15 equal his own +0x09 palette) and always replaces slots 12-13,
 * which his own palette leaves as placeholder green, with the weapon's colours (bone
 * for Bone Crusher, lavender for the spears, gold for Crusader Sword).
 */
const WEAPON_PALETTE = 0x04;

function weaponPalette(rom, weaponIdx) {
    const o = snesToRom(WEAPONS_BASE + weaponIdx * WEAPON_STRIDE + WEAPON_PALETTE);
    return rom[o] | (rom[o + 1] << 8);
}

function readWeaponAnimations(rom, weaponIdx) {
    const o = snesToRom(WEAPONS_BASE + weaponIdx * WEAPON_STRIDE);
    const paletteAddr = weaponPalette(rom, weaponIdx);
    const anims = [];
    for (const f of WEAPON_ANIM_OFFSETS) {
        const animRec = rom[o + f.offset] | (rom[o + f.offset + 1] << 8);
        if (animRec) {
            const scriptAddr = (read16At(rom, ANIMATION_RECORD_TABLE + animRec) |
                (rom[snesToRom(ANIMATION_RECORD_TABLE + animRec + 2)] << 16)) >>> 0;
            const animFlags = rom[snesToRom(ANIMATION_RECORD_TABLE + animRec + 3)];
            anims.push({
                key: f.key,
                label: f.label,
                offset: f.offset,
                animRec,
                scriptAddr,
                flags: animFlags,
                category: 'weapon',
                paletteAddr,
            });
        }
    }
    return anims;
}

/** Stat field descriptions explaining what each stat does in the Evermore engine. */
const STAT_MEANINGS = {
    hp: 'HP (+0x0F). Copied into the entity\'s HP (+0x2A) when it spawns ($8FB15B).',
    attack: 'Attack (+0x19). Used by the damage routine $8FC067.',
    defense: 'Defence (+0x1B). Subtracted in the damage routine $8FC067.',
    magic_defense: 'Magic defence (+0x1D). Alchemy damage scales by ($40 − m.def) / $40 ($919CB3).',
    evade: 'Evade (+0x1F). Indexes the to-hit table at $8FBAAF when this character is the target ($8FBA27).',
    hit_rate: 'Hit rate (+0x21). The attacker\'s side of the to-hit roll ($8FBA53); −30 when flags2 bit 1 is set.',
    aggro_range: 'Aggro range (+0x13): engages when the target is within this many pixels in x AND in y — a square, not a circle ($8FD72D) — then turns to face it.',
    aggro_chance: 'Aggro chance (+0x15): once stamina (entity +0x2E) is full, engages when rand(0..255) < this ($8FD69B); the check covers both party members.',
    exp: 'EXP (+0x23, 32-bit). Added to both the Boy\'s ($0A49) and the Dog\'s ($0A93) totals ($8F8292).',
    money: 'Talons (+0x27).',
    prize_chance: 'Prize chance (+0x29, byte). On death a drop happens when rand & $7F < this: value / 128 ($908567). With a drop the death animation is +0x44 (spoils), otherwise +0x42.',
    radius: 'Collision radius (+0x0D). Body box 2r × r; the hit test\'s hurt region is half-size r around the feet ($8FB651). 0 = walk-through.',
    flags: 'Spawn flags (+0x05), OR\'d into entity +0x10 at spawn ($8FB0C3). Names from everscript FLAG_ENEMY: $0001 inactive+invisible, $0002 invincible (most NPCs), $0004 party/bombable, $0020 inactive, $0040 mosquito, $0400 phasing, $1000 invisible+invincible+inactive. The hit test compares the side bits $5006 ($8FB606), and $4000 on the target blocks damage ($8FC0D9).',
    palette: 'Palette (+0x09), a 16-colour address in bank $90; the palette-slot allocator $90CD80 reuses a slot for an equal value.',
    charge_limit: 'Charge limit (+0x2C): the cap on the charge meter (entity +0x2E, $91AEDE). 1024 ($400) is a full charge.',
    charge_speed: 'Charge speed (+0x2E): added to the stamina/charge meter (entity +0x2E, everscript STAMINA) every tick until it reaches $400 ($8FCC5D). everscript lists CHARGE_RATE at +0x2F; the code reads the word at +0x2E.',
    attack_proc: 'Attack proc (+0x30): what a hit by this character does, dispatched at $8FB6A5 through $8FB6AE (0 = to-hit roll and damage).',
    ai_script: 'Behaviour (+0x03): selects the entity\'s AI script ($8FCD1A).',
    flags2: 'Flags (+0x07). Bit 0: registered in the list at $58AF ($8FC4BA). Bit 1: −30 hit rate ($8FBA46). Bits 2–3: tested by the script engine ($8C86A6, $8C86DA). Bit 4: immune to projectiles — an automatic miss ($8FB9FB).',
    palette2: 'Second palette (+0x0B): when non-zero, loaded into palette slot 2 ($90CD01, $90CF3A).',
    unknown11: '+0x11: copied into entity +0x2C at spawn ($8FB162). Meaning open (0–100; 20 on 52 characters).',
    unknown17: '+0x17: copied into entity +0x40 at spawn unless $23DD overrides it ($8FB169). Meaning open (0–1000).',
    unknown2a: 'Level (+0x2A): everscript ATTRIBUTE_GENERAL.LEVEL. No code reads it directly from the record; 1 on 115 characters, 2–50 on the rest.',
};

/** Character animation field offsets in the 74-byte struct. */
const STANDARD_ANIM_FIELDS = [
    { key: 'stand', label: 'Idle', offset: 0x32 },
    { key: 'walk', label: 'Walk', offset: 0x34 },
    { key: 'run', label: 'Run', offset: 0x36 },
    { key: 'atk0', label: 'Attack Lvl 0', offset: 0x38 },
    { key: 'atk1', label: 'Attack Lvl 1', offset: 0x3a },
    { key: 'atk2', label: 'Attack Lvl 2', offset: 0x3c },
    { key: 'atk3', label: 'Attack Lvl 3', offset: 0x3e },
    { key: 'damage', label: 'Knockback', offset: 0x40 },
    { key: 'death', label: 'Death', offset: 0x42 },
    { key: 'spoils', label: 'Death with spoils', offset: 0x44 },
    // Was 'Block': casting alchemy or using an item (Boy, Bad Boy, Verminator); mode $0120,
    // invulnerable while it plays. Started by its own routine at $90829B.
    { key: 'block', label: 'Cast (alchemy / item)', offset: 0x46 },
    // Only on the evil copies (Bad Dawg, Bad Boy, Dark Toaster): started at $8FC1D6 when
    // state +0x12 bit $40 is raised while alive.
    { key: 'x48', label: 'Field +0x48 (evil copies)', offset: 0x48 },
];

/** Read 16-bit value from ROM at SNES address. */
function read16At(rom, snes) {
    const o = snesToRom(snes);
    return rom[o] | (rom[o + 1] << 8);
}

/** Read 24-bit value from ROM at SNES address. */
function read24At(rom, snes) {
    const o = snesToRom(snes);
    return rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16);
}

/** Read 32-bit value from ROM at SNES address. */
function read32At(rom, snes) {
    const o = snesToRom(snes);
    return (rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16) | (rom[o + 3] << 24)) >>> 0;
}

/** Decode character name from name pointer in ROM. */
function decodeName(rom, namePtr, id) {
    if (namePtr === BOY_NAME_PTR || id === 0) return '<Boy Name>';
    if (namePtr === DOG_NAME_PTR || id === 1) return '<Dog Name>';
    const o = snesToRom(namePtr);
    if (o < 0 || o >= rom.length) return `$${namePtr.toString(16)}`;
    let name = '';
    for (let i = 0; i < 32 && o + i < rom.length; i++) {
        const b = rom[o + i];
        if (!b || b === 0xff || b < 32 || b > 126) break;
        name += String.fromCharCode(b);
    }
    return name || `#${id}`;
}

/** Build list of external animations mapped to this character from index.json enums. */
function getExternalAnimations(rom, characterId, characterName) {
    const out = [];
    const enums = indexJson.enums || {};
    const nameUpper = characterName.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    // Groups to check: ANIMATION_ENEMY, ANIMATION_BOY (for boy), ANIMATION_DOG (for dog)
    const groups = [];
    if (characterId === 0) groups.push(enums.ANIMATION_BOY || []);
    if (characterId === 1) groups.push(enums.ANIMATION_DOG || []);
    groups.push(enums.ANIMATION_ENEMY || []);

    const seen = new Set();
    for (const group of groups) {
        for (const item of group) {
            if (!item.name || !item.value || seen.has(item.name)) continue;
            let val = item.value;
            // Check if item belongs to this character:
            // 1. By name prefix match (e.g. MAGMAR_ENTER matches MAGMAR)
            // 2. Or Boy/Dog special groups
            const isMatch = (characterId === 0 && group === enums.ANIMATION_BOY) ||
                (characterId === 1 && group === enums.ANIMATION_DOG) ||
                item.name.startsWith(nameUpper + '_') ||
                item.name === nameUpper;

            if (!isMatch) continue;

            // Resolve value
            let num = null;
            if (val.startsWith('0x')) {
                num = parseInt(val, 16);
            } else if (val.startsWith('ANIMATION_ALL.')) {
                const aliasKey = val.split('.')[1];
                const aliasItem = (enums.ANIMATION_ALL || []).find((x) => x.name === aliasKey);
                if (aliasItem && aliasItem.value.startsWith('0x')) num = parseInt(aliasItem.value, 16);
            }

            if (num === null) continue;

            seen.add(item.name);
            let scriptAddr = 0;
            let animRec = 0;
            let flags = 0;

            if (num >= 0x8000) {
                // Internal field offset
                const fieldOffset = 0x32 + (num & 0x7ffe);
                animRec = read16At(rom, CHARACTER_TABLE + characterId * CHARACTER_STRIDE + fieldOffset);
                if (animRec) {
                    scriptAddr = (read16At(rom, ANIMATION_RECORD_TABLE + animRec) |
                        (rom[snesToRom(ANIMATION_RECORD_TABLE + animRec + 2)] << 16)) >>> 0;
                    flags = rom[snesToRom(ANIMATION_RECORD_TABLE + animRec + 3)];
                }
            } else {
                // Global id: $8CE13C reads the record from $C43C92 + id
                animRec = animationIdRecord(rom, num);
                if (animRec) {
                    scriptAddr = (read16At(rom, ANIMATION_RECORD_TABLE + animRec) |
                        (rom[snesToRom(ANIMATION_RECORD_TABLE + animRec + 2)] << 16)) >>> 0;
                    flags = rom[snesToRom(ANIMATION_RECORD_TABLE + animRec + 3)];
                }
            }

            if (scriptAddr && isValidAnimationScript(rom, scriptAddr)) {
                out.push({
                    key: item.name,
                    label: item.name.replace(/_/g, ' '),
                    valueHex: '0x' + num.toString(16),
                    num,
                    category: 'external',
                    animRec,
                    scriptAddr,
                    flags,
                    comment: item.comment || '',
                });
            }
        }
    }
    return out;
}

/**
 * True when none of a character's own animations ever shows a sprite or a segment — the
 * invisible helpers (fans, speakers, statues, stand-ins) and bosses drawn as background.
 * Death and spoils are left out: they are the shared dust puff ($CB7343) for everyone.
 */
const SHARED_EFFECT_FIELDS = new Set([0x42, 0x44]);
function drawsNothing(rom, anims) {
    const own = anims.filter((a) => a.category === 'standard' && a.scriptAddr && !SHARED_EFFECT_FIELDS.has(a.offset));
    if (!own.length) return true;
    return own.every((a) => {
        const run = runAnimation(rom, a.scriptAddr);
        return !run.frames.some((f) => f.sprite || f.sprite2 || (f.segments && f.segments.sprites.length));
    });
}

/** Read one full character record and format all fields with meanings. */
function readCharacter(rom, id) {
    const snes = CHARACTER_TABLE + id * CHARACTER_STRIDE;
    const namePtr = read24At(rom, snes);
    const name = decodeName(rom, namePtr, id);

    const unknown03 = read16At(rom, snes + 0x03);
    const flags = read16At(rom, snes + 0x05);
    const unknown07 = read16At(rom, snes + 0x07);
    const palette = read16At(rom, snes + 0x09);
    const unknown0b = read16At(rom, snes + 0x0b);
    const radius = read16At(rom, snes + 0x0d);
    const hp = read16At(rom, snes + 0x0f);
    const unknown11 = read16At(rom, snes + 0x11);
    const aggro_range = read16At(rom, snes + 0x13);
    const aggro_chance = read16At(rom, snes + 0x15);
    const unknown17 = read16At(rom, snes + 0x17);
    const attack = read16At(rom, snes + 0x19);
    const defense = read16At(rom, snes + 0x1b);
    const magic_defense = read16At(rom, snes + 0x1d);
    const evade = read16At(rom, snes + 0x1f);
    const hit_rate = read16At(rom, snes + 0x21);
    const exp = read32At(rom, snes + 0x23);
    const money = read16At(rom, snes + 0x27);
    const prize_chance = rom[snesToRom(snes + 0x29)];
    const unknown2a = read16At(rom, snes + 0x2a);
    const charge_limit = read16At(rom, snes + 0x2c);
    const charge_speed = read16At(rom, snes + 0x2e);
    const attack_proc = read16At(rom, snes + 0x30);

    const isHostile = (flags & 0x0002) === 0;
    const isInactive = (flags & 0x0020) !== 0;
    const isPhasing = (flags & 0x0400) !== 0;

    // Palette colours as hex strings
    const rawPalette = paletteAt(rom, palette);
    const paletteHex = rawPalette.map(([r, g, b]) =>
        '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
    );

    // Standard animations list
    const anims = [];
    for (const f of STANDARD_ANIM_FIELDS) {
        const animRec = read16At(rom, snes + f.offset);
        if (animRec) {
            const scriptAddr = (read16At(rom, ANIMATION_RECORD_TABLE + animRec) |
                (rom[snesToRom(ANIMATION_RECORD_TABLE + animRec + 2)] << 16)) >>> 0;
            const animFlags = rom[snesToRom(ANIMATION_RECORD_TABLE + animRec + 3)];
            anims.push({
                key: f.key,
                label: f.label,
                offset: f.offset,
                animRec,
                scriptAddr,
                flags: animFlags,
                category: 'standard',
            });
        }
    }

    // External animations from script triggers / enums
    const externalAnims = getExternalAnimations(rom, id, name);
    anims.push(...externalAnims);
    let weapons = null;
    if (id === 1) {
        // The Dog's forms play the part of the Boy's weapons: an animation set and palette each.
        weapons = readDogForms(rom);
        // ANIMATION_DOG ids name their act (ACT0_RUN, ACT2_SNIFF): draw each in that form's palette.
        for (const a of externalAnims) {
            const act = /^ACT(\d)_/.exec(a.key || '');
            const form = act && weapons.find((w) => w.name.startsWith('Act ' + act[1]));
            if (form && form.paletteAddr) a.paletteAddr = form.paletteAddr;
        }
    }
    if (id === 0) {
        weapons = WEAPON_NAMES.map((wName, idx) => ({
            id: idx,
            name: wName,
            paletteAddr: weaponPalette(rom, idx),
            anims: readWeaponAnimations(rom, idx),
        }));
        if (weapons[0]) {
            anims.unshift(...weapons[0].anims);
        }
    }

    return {
        id,
        name,
        noVisuals: drawsNothing(rom, anims),
        snes,
        snesHex: '$' + snes.toString(16),
        namePtr,
        namePtrHex: '$' + namePtr.toString(16),
        stats: {
            hp, attack, defense, magic_defense, evade, hit_rate,
            aggro_range, aggro_chance, exp, money, prize_chance,
            radius, flags, palette, charge_limit, charge_speed,
            attack_proc, ai_script: unknown03,
            unknown07, unknown0b, unknown11, unknown17, unknown2a,
        },
        hitbox: {
            radius,
            width: radius * 2,
            height: radius, // top-down 2:1 squash
            solid: radius > 0,
        },
        hurtbox: {
            radius,
            width: radius * 2,
            height: radius * 2,
        },
        disposition: {
            hostile: isHostile,
            inactive: isInactive,
            phasing: isPhasing,
            label: isHostile ? 'Enemy' : 'NPC / Friendly',
        },
        paletteAddrHex: '0x' + palette.toString(16),
        paletteColors: paletteHex,
        weapons,
        anims,
        statMeanings: STAT_MEANINGS,
    };
}

/** Read all 142 characters from ROM buffer. */
function readAllCharacters(rom) {
    const list = [];
    for (let i = 0; i < CHARACTER_COUNT; i++) {
        list.push(readCharacter(rom, i));
    }
    return list;
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
