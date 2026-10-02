'use strict';
// Ownership: character records, stat definitions, and animation mappings for the Sprites tab. Pure.
// Layout from SoETilesViewer's characterdata.h, verified field by field against ROM.
// Base address: $8EB678, stride: 74 bytes. 142 total character records.

const indexJson = require('../language/data/index.json');
const { snesToRom } = require('../maps/dist/rom');
const { paletteAt } = require('../maps/dist/character-record');
const { walkAnimationScript } = require('../maps/dist/character-animation');

const CHARACTER_TABLE = 0x8eb678;
const CHARACTER_STRIDE = 74;
const CHARACTER_COUNT = 142;

const BOY_NAME_PTR = 0x7e2210;
const DOG_NAME_PTR = 0x7e2234;

const EXTERNAL_ANIM_TABLE = 0x910000;
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
    { key: 'w_stand', label: 'Stand (Weapon)', offset: 0x08 },
    { key: 'w_walk', label: 'Walk (Weapon)', offset: 0x0a },
    { key: 'w_run', label: 'Run (Weapon)', offset: 0x0c },
    { key: 'w_atk0', label: 'Attack Lvl 0', offset: 0x0e },
    { key: 'w_atk1', label: 'Attack Lvl 1', offset: 0x10 },
    { key: 'w_atk2', label: 'Attack Lvl 2', offset: 0x12 },
    { key: 'w_atk3', label: 'Attack Lvl 3', offset: 0x14 },
    { key: 'w_charge', label: 'Charge Attack', offset: 0x16 },
    { key: 'w_damage', label: 'Damage', offset: 0x18 },
];

function isValidAnimationScript(rom, scriptAddr) {
    if (!scriptAddr) return false;
    const bank = (scriptAddr >> 16) & 0xff;
    if (bank < 0xc4 || bank > 0xce) return false;
    const o = snesToRom(scriptAddr);
    if (o < 0 || o >= rom.length) return false;
    const walk = walkAnimationScript(rom, scriptAddr);
    return Boolean(walk.frames && walk.frames.length > 0);
}

function readWeaponAnimations(rom, weaponIdx) {
    const o = snesToRom(WEAPONS_BASE + weaponIdx * WEAPON_STRIDE);
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
            });
        }
    }
    return anims;
}

/** Stat field descriptions explaining what each stat does in the Evermore engine. */
const STAT_MEANINGS = {
    hp: 'Maximum / base health points of the entity.',
    attack: 'Base physical attack strength (+0x19). Scaled with level and used in damage routine $8FC067.',
    defense: 'Physical defense rating (+0x1B). Directly mitigates physical damage received from weapon strikes.',
    magic_defense: 'Magic defense rating (+0x1D). Formula (0x40 - m.def) / 0x40 scales down incoming alchemy spell damage.',
    evade: 'Evasion rating (+0x1F). Opposed against attacker hit rate in $8FB75A to determine hit / miss probability.',
    hit_rate: 'Accuracy rating (+0x21). Checked against target evade rating in $8FB75A to decide if a physical attack connects.',
    aggro_range: 'Aggro detection range in pixels (+0x13). Distance within which enemy notices the player and initiates pursuit.',
    aggro_chance: 'Aggro check probability (+0x15). Probability value tested each tick to decide whether to attack or pursue.',
    exp: 'Experience points awarded to the party upon defeating this enemy (+0x23, 32-bit).',
    money: 'Talons / currency dropped upon defeat (+0x27, 16-bit).',
    prize_chance: 'Drop rate threshold (+0x29, 8-bit). Threshold used in RNG roll to drop an alchemy ingredient or gourd.',
    radius: 'Collision radius in pixels (+0x0D). Defines body bump box (2r × r) and hurt box (2r × 2r). 0 = non-solid / walk-through.',
    flags: 'Default entity spawn flags (+0x05). Bit 1 (0x0002) = Invincible (NPCs); Bit 5 (0x0020) = Inactive; Bit 10 (0x0400) = Phasing.',
    palette: 'CGRAM palette address in Bank $90 (+0x09). Reused across characters with identical palette to fit 4-palette room budget.',
    charge_limit: 'Weapon / attack charge limit (+0x2C, 16-bit). 1024 represents 100% full charge gauge.',
    charge_speed: 'Weapon charge build-up speed (+0x2E, 16-bit). Rate at which charge builds up per tick.',
    attack_proc: 'Secondary hit effect routine index (+0x30, 16-bit). Routine executed upon landing an attack ($8FB6A5).',
    ai_script: 'Combat AI behavior index (+0x03, 16-bit). Jump table index in $CBE0.',
};

/** Character animation field offsets in the 74-byte struct. */
const STANDARD_ANIM_FIELDS = [
    { key: 'stand', label: 'Stand (Idle)', offset: 0x32 },
    { key: 'walk', label: 'Walk', offset: 0x34 },
    { key: 'run', label: 'Run', offset: 0x36 },
    { key: 'atk0', label: 'Attack Lvl 0', offset: 0x38 },
    { key: 'atk1', label: 'Attack Lvl 1', offset: 0x3a },
    { key: 'atk2', label: 'Attack Lvl 2', offset: 0x3c },
    { key: 'atk3', label: 'Attack Lvl 3', offset: 0x3e },
    { key: 'damage', label: 'Damage (Hurt)', offset: 0x40 },
    { key: 'death', label: 'Death', offset: 0x42 },
    { key: 'spoils', label: 'Spoils', offset: 0x44 },
    { key: 'block', label: 'Block', offset: 0x46 },
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
                // External opcode table lookup at $910000 + num
                animRec = read16At(rom, EXTERNAL_ANIM_TABLE + num);
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
    if (id === 0) {
        weapons = WEAPON_NAMES.map((wName, idx) => ({
            id: idx,
            name: wName,
            anims: readWeaponAnimations(rom, idx),
        }));
        if (weapons[0]) {
            anims.unshift(...weapons[0].anims);
        }
    }

    return {
        id,
        name,
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
