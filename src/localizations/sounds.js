'use strict';
// Ownership: music and sound IDs to subjective names.
// Source: Secret of Evermore (EMU) rips, everscript enum SOUND/MUSIC, and dump_spc.py.

const { resolveLocalizedName } = require('./strings');

/**
 * Master music catalogue (opcode 0x33, internal IDs 0x00..0x45).
 * Names match the verified reference rips in 'Secret of Evermore (EMU)'.
 */
const MUSIC = [
    { id: 0x00, hex: '0x00', name: 'Main Title', spc: '01 Main Title.spc', stringIndex: null },
    { id: 0x01, hex: '0x01', name: 'Battle with Thraxx', spc: '19 Battle with Thraxx.spc', stringIndex: null },
    { id: 0x02, hex: '0x02', name: 'In the Arena', spc: '33 In the Arena.spc', stringIndex: null },
    { id: 0x03, hex: '0x03', name: 'Escape from Evermore', spc: '63 Escape from Evermore.spc', stringIndex: null },
    { id: 0x04, hex: '0x04', name: 'Return to Podunk', spc: '64 Return to Podunk.spc', stringIndex: null },
    { id: 0x05, hex: '0x05', name: 'Village on the Plateau', spc: '12 Village on the Plateau.spc', stringIndex: null },
    { id: 0x06, hex: '0x06', name: 'Within the Volcano', spc: '24 Within the Volcano.spc', stringIndex: null },
    { id: 0x07, hex: '0x07', name: 'Swamplands', spc: '22 Swamplands.spc', stringIndex: null },
    { id: 0x08, hex: '0x08', name: 'Southern Jungle', spc: '10 Southern Jungle.spc', stringIndex: null },
    { id: 0x09, hex: '0x09', name: 'Bugmuck Tar Pits', spc: '17 Bugmuck Tar Pits.spc', stringIndex: null },
    { id: 0x0A, hex: '0x0a', name: 'Desert of Doom', spc: '29 Desert of Doom.spc', stringIndex: null },
    { id: 0x0B, hex: '0x0b', name: 'Queen Bluegarden', spc: '53 Queen Bluegarden.spc', stringIndex: null },
    { id: 0x0C, hex: '0x0c', name: 'High in the Sky', spc: '56 High in the Sky.spc', stringIndex: null },
    { id: 0x0D, hex: '0x0d', name: 'Control Room', spc: '59 Control Room.spc', stringIndex: null },
    { id: 0x0E, hex: '0x0e', name: 'Hall of Collosia', spc: '38 Hall of Collosia.spc', stringIndex: null },
    { id: 0x0F, hex: '0x0f', name: 'Horace Highwater', spc: '36 Horace Highwater.spc', stringIndex: null },
    { id: 0x10, hex: '0x10', name: 'Major Enemy', spc: '23 Major Enemy.spc', stringIndex: null },
    { id: 0x11, hex: '0x11', name: 'Merchant in the Cave', spc: '18 Merchant in the Cave.spc', stringIndex: null },
    { id: 0x12, hex: '0x12', name: 'Elephant Graveyard', spc: '21 Elephant Graveyard.spc', stringIndex: null },
    { id: 0x13, hex: '0x13', name: 'Pirates of Crustacia', spc: '28 Pirates of Crustacia.spc', stringIndex: null },
    { id: 0x14, hex: '0x14', name: 'Lively Nobilia Marketplace', spc: '30 Lively Nobilia Marketplace.spc', stringIndex: null },
    { id: 0x15, hex: '0x15', name: 'Menu', spc: '02 Menu.spc', stringIndex: null },
    { id: 0x16, hex: '0x16', name: 'Machinery', spc: '05 Machinery.spc', stringIndex: null },
    { id: 0x17, hex: '0x17', name: 'Game Over', spc: '99 Game Over.spc', stringIndex: null },
    { id: 0x18, hex: '0x18', name: 'Raptor Attack!', spc: '11 Raptor Attack!.spc', stringIndex: null },
    { id: 0x19, hex: '0x19', name: 'Victory Fanfare', spc: '08 Victory Fanfare.spc', stringIndex: null },
    { id: 0x1A, hex: '0x1a', name: 'Good Night', spc: '99 Good Night.spc', stringIndex: null },
    { id: 0x1B, hex: '0x1b', name: 'The Seashore', spc: '27 The Seashore.spc', stringIndex: null },
    { id: 0x1C, hex: '0x1c', name: 'Many Years Ago...', spc: '03 Many Years Ago....spc', stringIndex: null },
    { id: 0x1D, hex: '0x1d', name: "The Professor's Room", spc: "60 The Professor's Room.spc", stringIndex: null },
    { id: 0x1E, hex: '0x1e', name: 'Quiet Plaza', spc: '32 Quiet Plaza.spc', stringIndex: null },
    { id: 0x1F, hex: '0x1f', name: 'Omnitopia Surface', spc: '57 Omnitopia Surface.spc', stringIndex: null },
    { id: 0x20, hex: '0x20', name: 'Storekeepers', spc: '31 Storekeepers.spc', stringIndex: null },
    { id: 0x21, hex: '0x21', name: 'Great Pyramid', spc: '37 Great Pyramid.spc', stringIndex: null },
    { id: 0x22, hex: '0x22', name: 'Underground Path', spc: '41 Underground Path.spc', stringIndex: null },
    { id: 0x23, hex: '0x23', name: 'Hidden River', spc: '20 Hidden River.spc', stringIndex: null },
    { id: 0x24, hex: '0x24', name: 'Staff Roll', spc: '65 Staff Roll.spc', stringIndex: null },
    { id: 0x25, hex: '0x25', name: 'A Boy and His Dog', spc: '04 A Boy and His Dog.spc', stringIndex: null },
    { id: 0x26, hex: '0x26', name: 'Engine Rumble', spc: '99 Engine Rumble.spc', stringIndex: null },
    { id: 0x27, hex: '0x27', name: 'Empty / Unused', spc: null, stringIndex: null },
    { id: 0x28, hex: '0x28', name: 'Unused 0x28', spc: null, stringIndex: null },
    { id: 0x29, hex: '0x29', name: 'Palace Fountains', spc: '35 Palace Fountains.spc', stringIndex: null },
    { id: 0x2A, hex: '0x2a', name: 'Fire Eyes', spc: '13 Fire Eyes.spc', stringIndex: null },
    { id: 0x2B, hex: '0x2b', name: 'Puppet Show', spc: '48 Puppet Show.spc', stringIndex: null },
    { id: 0x2C, hex: '0x2c', name: 'Minor Minion', spc: '07 Minor Minion.spc', stringIndex: null },
    { id: 0x2D, hex: '0x2d', name: 'Distant Wind', spc: '09 Distant Wind.spc', stringIndex: null },
    { id: 0x2E, hex: '0x2e', name: 'Death of a Minotaur', spc: '40 Death of a Minotaur.spc', stringIndex: null },
    { id: 0x2F, hex: '0x2f', name: 'Fields of Gothica', spc: '42 Fields of Gothica.spc', stringIndex: null },
    { id: 0x30, hex: '0x30', name: 'City of Ebony', spc: '51 City of Ebony.spc', stringIndex: null },
    { id: 0x31, hex: '0x31', name: 'Over the Waterfall', spc: '26 Over the Waterfall.spc', stringIndex: null },
    { id: 0x32, hex: '0x32', name: 'Darkness of the Temple', spc: '39 Darkness of the Temple.spc', stringIndex: null },
    { id: 0x33, hex: '0x33', name: 'Dark Forest', spc: '50 Dark Forest.spc', stringIndex: null },
    { id: 0x34, hex: '0x34', name: 'City of Ivory', spc: '43 City of Ivory.spc', stringIndex: null },
    { id: 0x35, hex: '0x35', name: 'Omnitopia Hallways', spc: '58 Omnitopia Hallways.spc', stringIndex: null },
    { id: 0x36, hex: '0x36', name: 'Quicksand Fields', spc: '15 Quicksand Fields.spc', stringIndex: null },
    { id: 0x37, hex: '0x37', name: 'Tinker Tinderbox', spc: '54 Tinker Tinderbox.spc', stringIndex: null },
    { id: 0x38, hex: '0x38', name: 'Deserted Castle', spc: '52 Deserted Castle.spc', stringIndex: null },
    { id: 0x39, hex: '0x39', name: 'Dank Dungeon', spc: '49 Dank Dungeon.spc', stringIndex: null },
    { id: 0x3A, hex: '0x3a', name: 'Regal Castle', spc: '46 Regal Castle.spc', stringIndex: null },
    { id: 0x3B, hex: '0x3b', name: 'Freak Show!!!', spc: '44 Freak Show!!!.spc', stringIndex: null },
    { id: 0x3C, hex: '0x3c', name: 'Item Fanfare', spc: '06 Item Fanfare.spc', stringIndex: null },
    { id: 0x3D, hex: '0x3d', name: 'Northern Jungle', spc: '14 Northern Jungle.spc', stringIndex: null },
    { id: 0x3E, hex: '0x3e', name: 'Lonely Halls', spc: '47 Lonely Halls.spc', stringIndex: null },
    { id: 0x3F, hex: '0x3f', name: 'Dark Greenhouse', spc: '61 Dark Greenhouse.spc', stringIndex: null },
    { id: 0x40, hex: '0x40', name: 'Vigor the Indestructible!', spc: '34 Vigor the Indestructible!.spc', stringIndex: null },
    { id: 0x41, hex: '0x41', name: 'Racing Pigs!', spc: '45 Racing Pigs!.spc', stringIndex: null },
    { id: 0x42, hex: '0x42', name: 'Collapse of Ivor Tower', spc: '55 Collapse of Ivor Tower.spc', stringIndex: null },
    { id: 0x43, hex: '0x43', name: 'Volcano Pipes', spc: '25 Volcano Pipes.spc', stringIndex: null },
    { id: 0x44, hex: '0x44', name: 'Final Battle ~ Carltron', spc: '62 Final Battle ~ Carltron.spc', stringIndex: null },
    { id: 0x45, hex: '0x45', name: 'Intruder Alarm', spc: '99 Intruder Alarm.spc', stringIndex: null },
];

/**
 * Sound effects catalogue (opcode 0x30 / SFX table at $8C:8362).
 * Includes SFX present in the EMU reference rips and Everscript enums.
 */
const SOUNDS = [
    { id: 0x00, hex: '0x00', name: 'None', stringIndex: null },
    { id: 0x02, hex: '0x02', name: 'Menu Wheel Turn', stringIndex: null },
    { id: 0x04, hex: '0x04', name: 'Menu Wheel Open', stringIndex: null },
    { id: 0x06, hex: '0x06', name: 'Menu Wheel Close', stringIndex: null },
    { id: 0x08, hex: '0x08', name: 'Gore Flower', stringIndex: null },
    { id: 0x0A, hex: '0x0a', name: 'Heavy Impact', stringIndex: null },
    { id: 0x10, hex: '0x10', name: 'Axe Attack', stringIndex: null },
    { id: 0x1A, hex: '0x1a', name: 'Spider Attack', stringIndex: null },
    { id: 0x1C, hex: '0x1c', name: 'Flower Vore', stringIndex: null },
    { id: 0x20, hex: '0x20', name: 'Spear Attack', stringIndex: null },
    { id: 0x22, hex: '0x22', name: 'Thraxx Damage', stringIndex: null },
    { id: 0x24, hex: '0x24', name: 'Dog Bark', stringIndex: null },
    { id: 0x2A, hex: '0x2a', name: 'Sword Attack', stringIndex: null },
    { id: 0x2C, hex: '0x2c', name: 'Mechanical Movement', stringIndex: null },
    { id: 0x2E, hex: '0x2e', name: 'Heal Start', stringIndex: null },
    { id: 0x30, hex: '0x30', name: 'Heal End', stringIndex: null },
    { id: 0x32, hex: '0x32', name: 'Gore Explosion', stringIndex: null },
    { id: 0x34, hex: '0x34', name: 'Tesla', stringIndex: null },
    { id: 0x36, hex: '0x36', name: 'Teleporter', stringIndex: null },
    { id: 0x38, hex: '0x38', name: 'Click 1', stringIndex: null },
    { id: 0x3A, hex: '0x3a', name: 'Click 2', stringIndex: null },
    { id: 0x3B, hex: '0x3b', name: 'Takeoff!', spc: '99 Takeoff!.spc', stringIndex: null },
    { id: 0x3C, hex: '0x3c', name: 'Impact', stringIndex: null },
    { id: 0x3E, hex: '0x3e', name: 'Gore Mosquito', stringIndex: null },
    { id: 0x40, hex: '0x40', name: 'Purchase', stringIndex: null },
    { id: 0x42, hex: '0x42', name: 'Explosion', spc: '99 Explosion.spc', stringIndex: null },
    { id: 0x44, hex: '0x44', name: 'Loot / Click 3', stringIndex: null },
    { id: 0x46, hex: '0x46', name: 'Door', stringIndex: null },
    { id: 0x4C, hex: '0x4c', name: 'Alchemy Sound 1', stringIndex: null },
    { id: 0x4E, hex: '0x4e', name: 'Bird', stringIndex: null },
    { id: 0x50, hex: '0x50', name: 'Weird Sound', stringIndex: null },
    { id: 0x52, hex: '0x52', name: 'Piping Sound', stringIndex: null },
    { id: 0x54, hex: '0x54', name: 'Temple Bridge Collapsing', stringIndex: null },
    { id: 0x56, hex: '0x56', name: 'Applause', spc: '99 Applause.spc', stringIndex: null },
    { id: 0x58, hex: '0x58', name: 'Thraxx Bridge Collapsing', stringIndex: null },
    { id: 0x5A, hex: '0x5a', name: 'Magma Hardening', stringIndex: null },
    { id: 0x5C, hex: '0x5c', name: 'Dog Maze Hint', stringIndex: null },
    { id: 0x5E, hex: '0x5e', name: 'Sandpit Swallow', stringIndex: null },
    { id: 0x66, hex: '0x66', name: 'Mosquito Attack', stringIndex: null },
    { id: 0x68, hex: '0x68', name: 'Flower Attack', stringIndex: null },
    { id: 0x6A, hex: '0x6a', name: 'Dragon Roar', stringIndex: null },
    { id: 0x6C, hex: '0x6c', name: 'Squeak', stringIndex: null },
    { id: 0x6E, hex: '0x6e', name: 'Arena Cheer', stringIndex: null },
    { id: 0x72, hex: '0x72', name: 'Water Plop', stringIndex: null },
    { id: 0x74, hex: '0x74', name: 'Nitro Start', stringIndex: null },
    { id: 0x76, hex: '0x76', name: 'Elevator Door', stringIndex: null },
    { id: 0x7A, hex: '0x7a', name: 'Vigor Rolling', stringIndex: null },
    { id: 0x7E, hex: '0x7e', name: 'Alchemy Sound 2', stringIndex: null },
    { id: 0x86, hex: '0x86', name: 'Hover Sounds', stringIndex: null },
    { id: 0x8A, hex: '0x8a', name: 'Levitate', stringIndex: null },
    { id: 0x8E, hex: '0x8e', name: 'Projectile Shooting', stringIndex: null },
    { id: 0x9C, hex: '0x9c', name: 'Act 4 Switch', stringIndex: null },
    { id: 0xB0, hex: '0xb0', name: 'Act 4 Door Opening', stringIndex: null },
    { id: 0xB2, hex: '0xb2', name: 'Fan Activated', stringIndex: null },
    { id: 0xC6, hex: '0xc6', name: 'Clicking', stringIndex: null },
];

/**
 * Tracks in 'Secret of Evermore (EMU)' that represent special volume or SFX exports.
 */
const EXTRAS = [
    { name: 'Windy Cave', spc: '16 Windy Cave.spc', musicId: 0x2D, volume: 0x30, sfxId: null },
    { name: 'Explosion', spc: '99 Explosion.spc', musicId: null, volume: null, sfxId: 0x42 },
    { name: 'Applause', spc: '99 Applause.spc', musicId: null, volume: null, sfxId: 0x56 },
    { name: 'Takeoff!', spc: '99 Takeoff!.spc', musicId: null, volume: null, sfxId: 0x3B },
];

const MUSIC_BY_ID = new Map();
for (const m of MUSIC) {
    MUSIC_BY_ID.set(m.id, m);
    MUSIC_BY_ID.set(m.hex.toLowerCase(), m);
}

const SOUND_BY_ID = new Map();
for (const s of SOUNDS) {
    SOUND_BY_ID.set(s.id, s);
    SOUND_BY_ID.set(s.hex.toLowerCase(), s);
}

function getMusic(id) {
    if (typeof id === 'string') {
        const parsed = id.startsWith('0x') || id.startsWith('0X') ? parseInt(id, 16) : parseInt(id, 10);
        return MUSIC_BY_ID.get(id.toLowerCase()) || MUSIC_BY_ID.get(parsed) || null;
    }
    return MUSIC_BY_ID.get(id) || null;
}

function getMusicName(id, options = {}) {
    const entry = getMusic(id);
    if (!entry) return typeof id === 'number' ? `Song 0x${id.toString(16).padStart(2, '0')}` : `Song ${id}`;
    return resolveLocalizedName(entry, options.rom, 'name');
}

function getSound(id) {
    if (typeof id === 'string') {
        const parsed = id.startsWith('0x') || id.startsWith('0X') ? parseInt(id, 16) : parseInt(id, 10);
        return SOUND_BY_ID.get(id.toLowerCase()) || SOUND_BY_ID.get(parsed) || null;
    }
    return SOUND_BY_ID.get(id) || null;
}

function getSoundName(id, options = {}) {
    const entry = getSound(id);
    if (!entry) return typeof id === 'number' ? `SFX 0x${id.toString(16).padStart(2, '0')}` : `SFX ${id}`;
    return resolveLocalizedName(entry, options.rom, 'name');
}

module.exports = {
    MUSIC,
    SOUNDS,
    EXTRAS,
    getMusic,
    getMusicName,
    getSound,
    getSoundName,
};
