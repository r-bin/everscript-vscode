'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
    VANILLA_MAPS,
    VANILLA_ROOMS,
    getMap,
    getMapName,
    getMapArea,
    MUSIC,
    SOUNDS,
    EXTRAS,
    getMusic,
    getMusicName,
    getSound,
    getSoundName,
    TABLES,
    getTable,
    getTableName,
    FUNCTIONS,
    getFunction,
    getFunctionName,
    decodeRomString,
    resolveLocalizedName,
} = require('../../src/localizations');

const { VANILLA_ROOMS: ROOMS_EXPORT } = require('../../src/rooms');

test('localizations maps: covers all 127 vanilla rooms', () => {
    assert.equal(VANILLA_MAPS.length, 127);
    const uniqueIds = new Set(VANILLA_MAPS.map(m => m.id));
    assert.equal(uniqueIds.size, 127);

    // Test map 0x38 (Start)
    const map38 = getMap(0x38);
    assert.ok(map38);
    assert.equal(map38.name, 'South jungle / Start');
    assert.equal(map38.area, 'Prehistoria');
    assert.equal(getMapName(0x38), 'South jungle / Start');
    assert.equal(getMapName(0x38, { full: true }), 'Prehistoria - South jungle / Start');
    assert.equal(getMapName('0x38'), 'South jungle / Start');
    assert.equal(getMapArea(0x38), 'Prehistoria');

    // Test map 0x4A (Final Boss Room)
    const map4A = getMap(0x4A);
    assert.ok(map4A);
    assert.equal(map4A.name, 'Final Boss Room');
    assert.equal(map4A.area, 'Omnitopia');
});

test('localizations maps: VANILLA_ROOMS matches rooms domain export', () => {
    assert.deepEqual(VANILLA_ROOMS, ROOMS_EXPORT);
    const totalRooms = VANILLA_ROOMS.reduce((sum, g) => sum + g.rooms.length, 0);
    assert.equal(totalRooms, 127);
});

test('localizations sounds: music matches EMU tracks', () => {
    assert.equal(MUSIC.length, 70);

    // Track 0x00 -> Main Title
    const m0 = getMusic(0x00);
    assert.ok(m0);
    assert.equal(m0.name, 'Main Title');
    assert.equal(m0.spc, '01 Main Title.spc');
    assert.equal(getMusicName(0x00), 'Main Title');

    // Track 0x01 -> Battle with Thraxx
    assert.equal(getMusicName(0x01), 'Battle with Thraxx');
    assert.equal(getMusic(0x01).spc, '19 Battle with Thraxx.spc');

    // Track 0x45 -> Intruder Alarm
    assert.equal(getMusicName(0x45), 'Intruder Alarm');
    assert.equal(getMusic(0x45).spc, '99 Intruder Alarm.spc');

    // Extras
    assert.equal(EXTRAS.length, 4);
    assert.ok(EXTRAS.find(e => e.name === 'Takeoff!'));
    assert.ok(EXTRAS.find(e => e.name === 'Explosion'));
    assert.ok(EXTRAS.find(e => e.name === 'Applause'));
    assert.ok(EXTRAS.find(e => e.name === 'Windy Cave'));
});

test('localizations sounds: sound effects lookup', () => {
    assert.ok(SOUNDS.length > 30);
    assert.equal(getSoundName(0xBC), 'Takeoff!');
    assert.equal(getSoundName(0x64), 'Explosion');
    assert.equal(getSoundName(0x6E), 'Arena Cheer');
    assert.equal(getSoundName(0x24), 'Dog Bark');
    assert.equal(getSoundName(0x6A), 'Dragon Roar');
});

test('localizations tables: address lookups', () => {
    assert.ok(TABLES.length >= 25);

    // Engine table
    const orbit = getTable(0x8088A3);
    assert.ok(orbit);
    assert.equal(orbit.name, 'Orbit table (y)');
    assert.equal(getTableName(0x8088A3), 'Orbit table (y)');

    // Alchemy table
    const target = getTable(0x045BF5);
    assert.ok(target);
    assert.equal(target.name, 'ALCHEMY_TARGET');
});

test('localizations functions: address lookups', () => {
    assert.ok(FUNCTIONS.length >= 60);

    // Reset handler
    const reset = getFunction(0x808020);
    assert.ok(reset);
    assert.equal(reset.name, 'RESET handler');
    assert.equal(getFunctionName(0x808020), 'RESET handler');

    // Opcode 33 dispatcher
    assert.equal(getFunctionName(0x8CD709), 'Script opcode `0x33` (`music`)');
});

test('localizations strings: decode uncompressed ROM string', () => {
    // Construct minimal mock ROM buffer with uncompressed string at key 0
    const mockRom = Buffer.alloc(0x120000);
    const KEYS_ADDR = 0x11D000;
    const targetAddr = 0x008050; // offset in ROM: bank 0, $8050 -> bus $C08050
    // Key encoding: low 23 bits = (bank << 15) | (addr & $7FFF)
    // bank 0, addr $0050: val = $0050, bit 23 = 0 (uncompressed)
    mockRom[KEYS_ADDR] = 0x50;
    mockRom[KEYS_ADDR + 1] = 0x00;
    mockRom[KEYS_ADDR + 2] = 0x00;

    // Write ASCII "Test Room" at targetAddr 0x50
    mockRom.write('Test Room\0', 0x50, 'ascii');

    const decoded = decodeRomString(mockRom, 0);
    assert.equal(decoded, 'Test Room');

    // resolveLocalizedName uses ROM string when stringIndex is provided
    const entry = { name: 'Fallback Name', stringIndex: 0 };
    assert.equal(resolveLocalizedName(entry, mockRom), 'Test Room');

    // When rom is not provided, falls back to name
    assert.equal(resolveLocalizedName(entry, null), 'Fallback Name');

    // When stringIndex is null, uses name
    assert.equal(resolveLocalizedName({ name: 'Direct Name', stringIndex: null }, mockRom), 'Direct Name');
});

test('localizations scripts: NPC, ABS, and Global script lookups', () => {
    const {
        getNpcScript,
        getNpcScriptName,
        getAbsScript,
        getAbsScriptName,
        getGlobalScript,
        getGlobalScriptName,
        setScriptOverride,
    } = require('../../src/localizations');

    // NPC scripts from screenshot
    assert.equal(getNpcScriptName(0x17CD), 'Thraxx damage/kill');
    assert.equal(getNpcScriptName('0x17cd'), 'Thraxx damage/kill');
    assert.equal(getNpcScriptName(0x199E), 'Aegis kill');
    assert.equal(getNpcScriptName(0x1A79), 'Vigor damage');
    assert.equal(getNpcScriptName(0x1A70), 'Footknight kill');
    assert.equal(getNpcScriptName(0x1A82), 'Puppet damage/kill');
    assert.equal(getNpcScriptName(0x1A85), 'Mungola? damage/kill');
    assert.equal(getNpcScriptName(0x19B0), 'Aquagoth');
    assert.equal(getNpcScriptName(0x19B3), 'Fire Power Dude');

    // ABS scripts from screenshot
    assert.equal(getAbsScriptName(0x93CA9F), 'Thraxx maggot trigger part');
    assert.equal(getAbsScriptName('0x93ca9f'), 'Thraxx maggot trigger part');
    assert.equal(getAbsScriptName(0x93D036), 'Thraxx damage / kill part [1]');

    // Global scripts
    assert.equal(getGlobalScriptName(0x00), 'Fade-out / stop music');
    assert.equal(getGlobalScriptName('0x00'), 'Fade-out / stop music');

    // Fallbacks
    assert.equal(getNpcScriptName(0x9999), 'Unnamed Short script 0x9999');
    assert.equal(getAbsScriptName(0x999999), 'Unnamed ABS script 0x999999');
    assert.equal(getGlobalScriptName(0x99), 'Unnamed Global script 0x99');

    // Dynamic overrides
    setScriptOverride('npc', 0x17CD, 'Custom Thraxx Boss');
    assert.equal(getNpcScriptName(0x17CD), 'Custom Thraxx Boss');

    // Restore for other tests
    setScriptOverride('npc', 0x17CD, 'Thraxx damage/kill');
    assert.equal(getNpcScriptName(0x17CD), 'Thraxx damage/kill');
});

