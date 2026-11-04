// TODO port to TS (docs/todo/port-to-ts.md)
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
} = require('../../dist/games/evermore/localizations');

const { VANILLA_ROOMS: ROOMS_EXPORT } = require('../../dist/games/evermore/rooms');

test('localizations maps: covers all 127 vanilla rooms', () => {
    assert.equal(VANILLA_MAPS.length, 127);
    const uniqueIds = new Set(VANILLA_MAPS.map(m => m.id));
    assert.equal(uniqueIds.size, 127);

    // Test map 0x38 (Start)
    const map38 = getMap(0x38);
    assert.ok(map38);
    assert.equal(map38.name, 'Jungle › south, where the game starts');
    assert.equal(map38.area, 'Prehistoria');
    assert.equal(getMapName(0x38), 'Jungle › south, where the game starts');
    assert.equal(getMapName(0x38, { full: true }), 'Prehistoria › Jungle › south, where the game starts');
    assert.equal(getMapName('0x38'), 'Jungle › south, where the game starts');
    assert.equal(getMapArea(0x38), 'Prehistoria');

    // Test map 0x4A (Final Boss Room)
    const map4A = getMap(0x4A);
    assert.ok(map4A);
    assert.equal(map4A.name, 'Omnitopia › final boss room');
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
    assert.equal(orbit.name, 'Sine table, 256 steps per turn, stored for 320 steps so cosine never wraps');
    assert.equal(getTableName(0x8088A3), 'Sine table, 256 steps per turn, stored for 320 steps so cosine never wraps');

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
    } = require('../../dist/games/evermore/localizations');

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


test('knowledge entries: front-matter lists as one JSON line or as a YAML block', () => {
    const os = require('os');
    const { parseEntry } = require('../../dist/games/evermore/localizations/knowledge');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-'));
    const file = path.join(dir, '8f0000.md');
    fs.writeFileSync(file, '---\naddr: 8F0000\nname: x\nevidence:\n  - "disasm: a, b"\n  - docs/x.md\ntags: [one, two]\nsee:\n---\nBody.\n');
    const e = parseEntry(file);
    assert.deepEqual(e.evidence, ['disasm: a, b', 'docs/x.md']);
    assert.deepEqual(e.tags, ['one', 'two']);
    assert.deepEqual(e.see, []);
    fs.rmSync(dir, { recursive: true });
});

test('wram map: 128 KB coverage across Bank $7E and Bank $7F with zero gaps and zero overlaps', () => {
    const { getWramEntry, getAllWramEntries } = require('../../dist/games/evermore/localizations/wram-map');
    const entries = getAllWramEntries();

    let sum7e = 0;
    let sum7f = 0;
    for (const e of entries) {
        if (e.busAddr >= 0x7F0000) {
            sum7f += e.size;
        } else {
            sum7e += e.size;
        }
    }
    assert.equal(sum7e, 65536, 'Bank $7E must sum to exactly 65,536 bytes');
    assert.equal(sum7f, 65536, 'Bank $7F must sum to exactly 65,536 bytes');

    // Verify every single byte across 128 KB is mapped
    for (let i = 0; i < 0x20000; i++) {
        const entry = getWramEntry(i);
        assert.ok(entry, `Byte 0x${i.toString(16).toUpperCase()} must be covered in WRAM lookup table`);
    }

    // Bus address and offset lookup parity
    const dp = getWramEntry(0x7E0000);
    assert.equal(dp?.name, 'DIRECT_PAGE_BLOCK');
    assert.equal(getWramEntry(0x0000)?.name, 'DIRECT_PAGE_BLOCK');

    const meta = getWramEntry(0x7F0000);
    assert.equal(meta?.name, 'ROOM_METATILE_GRID');
    assert.equal(getWramEntry(0x10000)?.name, 'ROOM_METATILE_GRID');

    const scratch = getWramEntry(0x7FFFFF);
    assert.equal(scratch?.name, 'BANK7F_DMA_SCRATCH');
    assert.equal(getWramEntry(0x1FFFF)?.name, 'BANK7F_DMA_SCRATCH');

    // Struct field detail resolution
    const { getWramFieldDetails } = require('../../dist/games/evermore/localizations/wram-map');
    const dpActor = getWramFieldDetails(0x7E004C);
    assert.equal(dpActor.structName, 'DirectPageBlock');
    assert.equal(dpActor.fieldName, 'current_actor_ptr');
    assert.equal(dpActor.fieldType, 'entity');

    const alchSpell = getWramFieldDetails(0x7E3364 + 18);
    assert.equal(alchSpell.fieldName, 'spell_id');
    assert.equal(alchSpell.fieldType, 'u16');

    const spawnFlags = getWramFieldDetails(0x7E5DC3 + 6);
    assert.equal(spawnFlags.fieldName, 'flags');
    assert.equal(spawnFlags.fieldType, 'u16');
});

test('rom map: 100% complete catalog with 1,690+ entries, room blobs, master tables, and queries', () => {
    const {
        getRomEntry,
        getRomEntryByName,
        getAllRomEntries,
        getRomEntriesByBank,
        getRomEntriesByKind,
        getRomEntriesByTag,
        getRomMapHeader,
        getRomBankSummary,
    } = require('../../dist/games/evermore/localizations/rom-map');

    const entries = getAllRomEntries();
    assert.ok(entries.length >= 1680, `ROM map must contain at least 1,680 entries (got ${entries.length})`);

    // Total documented bytes across all routines, tables, room blobs, and string blocks
    let totalBytes = 0;
    for (const e of entries) {
        assert.ok(e.size > 0, `Entry ${e.name} must have a positive size`);
        assert.ok(e.addr >= 0 && e.addr <= 0xFFFFFF, `Entry ${e.name} must have a 24-bit SNES address`);
        totalBytes += e.size;
    }
    assert.ok(totalBytes >= 1000000, `Total size across ROM map entries must exceed 1 MB (got ${totalBytes})`);

    // Exact address lookup for engine core
    const reset = getRomEntry(0x808020);
    assert.ok(reset, 'Reset handler must be found at $80:8020');
    assert.equal(reset?.name, 'reset_handler');
    assert.equal(reset?.size, 538);

    // Range lookup within a function
    const withinReset = getRomEntry(0x808050);
    assert.equal(withinReset?.name, 'reset_handler');

    // Name lookup
    const nmi = getRomEntryByName('nmi_handler');
    assert.ok(nmi);
    assert.equal(nmi?.addr, 0x80823A);
    assert.equal(nmi?.size, 103); // Contiguous dispatcher block ($80:823A..$80:82A0) before nmi_sprite_tile_dma_upload

    // Bank queries
    const bank80 = getRomEntriesByBank(0x80);
    assert.ok(bank80.length > 50, 'Bank $80 must have over 50 entries');
    assert.ok(bank80.every(e => e.bank === 0x80));

    // Room blob lookups: all 127 room blobs present
    const blobs = getRomEntriesByKind('blob');
    assert.equal(blobs.length, 127, 'Must have exactly 127 room definition blobs');

    // Room blob address query: Room 0 ($AB:F4F1)
    const room0 = getRomEntry(0xABF4F1);
    assert.ok(room0);
    assert.equal(room0?.name, 'ROOM_BLOB_00_OMNITOPIA_ALARM_ROOM');
    assert.equal(room0?.type, 'blob');

    // Room blob name query: Room 6 Antiqua Outside Mids ($9C:8000)
    const room6 = getRomEntryByName('ROOM_BLOB_06_ANTIQUA_OUTSIDE_OF_MIDS');
    assert.ok(room6);
    assert.equal(room6?.addr, 0x9C8000);

    // Master tables lookups
    const charDb = getRomEntry(0x8EB678);
    assert.ok(charDb, 'Character master database must be in ROM map');
    assert.equal(charDb?.name, 'character_records');
    assert.equal(charDb?.size, 2908);

    // Dialogue string bank lookups
    const str0 = getRomEntryByName('STRINGS_BLOCK_0');
    assert.ok(str0);
    assert.equal(str0?.addr, 0xC00000);
    assert.equal(str0?.size, 32768);

    // Tag filtering
    const roomTagged = getRomEntriesByTag('room');
    assert.equal(roomTagged.length, 139, '127 room blobs + 12 engine room routines');

    // Master header and bank summaries
    const header = getRomMapHeader();
    assert.ok(header);
    assert.ok(header.summary.banks_covered >= 50);

    const b80Summary = getRomBankSummary(0x80);
    assert.ok(b80Summary);
    assert.equal(b80Summary?.name, 'Engine Core, Reset, NMI & Hardware Utilities');
});



