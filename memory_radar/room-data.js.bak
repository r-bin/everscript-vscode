'use strict';
// Room data layer for Memory Radar — extracted from extension.js
// Handles WRAM map enums, Lua watcher POI, ROM script triggers, and vanilla room catalogue.

const path = require('path');
const fs   = require('fs');
const { readRomMapHeader } = require('./rom-readers');
const { parseEvsEnumValues } = require('./radar-utils');
const { readRoomScriptModel } = require('../debugger/emulator/room-script-model');

// Module-level caches (private to this module)
let _radarMapEnumCache        = null;
let _luaWatcherCache          = null;
let _radarVanillaRoomsCache   = null;
let _radarVanillaRoomsCacheKey = '';

function invalidateRoomDataCaches() {
    _radarMapEnumCache         = null;
    _luaWatcherCache           = null;
    _radarVanillaRoomsCache    = null;
    _radarVanillaRoomsCacheKey = '';
}

const VANILLA_ROOMS = [
    { area: 'Prehistoria', rooms: [
        { id: '0x38', name: 'South jungle / Start' },
        { id: '0x33', name: "Strong Heart's Exterior" },
        { id: '0x34', name: "Strong Heart's Hut" },
        { id: '0x5c', name: 'Raptors' },
        { id: '0x25', name: "Fire Eyes' Village" },
        { id: '0x51', name: "Village Huts and Blimp's Hut" },
        { id: '0x26', name: 'West area with Defend' },
        { id: '0x5b', name: 'East jungle' },
        { id: '0x59', name: 'Quick sand desert' },
        { id: '0x67', name: 'Bugmuck exterior' },
        { id: '0x16', name: 'BBM' },
        { id: '0x17', name: 'Bug room 2' },
        { id: '0x18', name: "Thraxx' room" },
        { id: '0x5a', name: 'Acid rain guy' },
        { id: '0x41', name: 'North jungle' },
        { id: '0x27', name: 'Mammoth Graveyard' },
        { id: '0x69', name: 'Volcano path' },
        { id: '0x52', name: 'Top of Volcano' },
        { id: '0x50', name: 'Sky above Volcano' },
        { id: '0x66', name: 'West of swamp' },
        { id: '0x65', name: 'Swamp (main area)' },
        { id: '0x01', name: "Exterior of Blimp's Hut" },
        { id: '0x3c', name: 'Volcano Room 1' },
        { id: '0x3b', name: 'Volcano Room 2' },
        { id: '0x3d', name: 'Pipe maze' },
        { id: '0x3e', name: 'Side rooms of pipe maze' },
        { id: '0x3f', name: 'Volcano Boss Room' },
        { id: '0x36', name: 'Both fire pits (one room)' },
    ]},
    { area: 'Antiqua', rooms: [
        { id: '0x53', name: 'Act 2 Start Cutscene' },
        { id: '0x6a', name: 'Act 2 Start Cutscene - waterfall' },
        { id: '0x0a', name: 'Nobilia, Market' },
        { id: '0x08', name: 'Nobilia, Square' },
        { id: '0x09', name: 'Nobilia, Square during Aegis fight' },
        { id: '0x1e', name: 'Nobilia, Arena Holding Room' },
        { id: '0x1d', name: 'Nobilia, Arena (Vigor Fight)' },
        { id: '0x4c', name: 'Nobilia, Fountain and snake statues' },
        { id: '0x0b', name: 'Nobilia, Palace grounds' },
        { id: '0x4d', name: 'Nobilia, Inside palace (Horace cutscene)' },
        { id: '0x3a', name: 'Nobilia, Fire pit' },
        { id: '0x0c', name: 'Nobilia, Inn' },
        { id: '0x1c', name: 'Nobilia, North of Market' },
        { id: '0x1b', name: 'Desert of Doom' },
        { id: '0x6b', name: 'Waterfall' },
        { id: '0x05', name: "Between 'mids and halls" },
        { id: '0x07', name: 'West of Crustacia' },
        { id: '0x4f', name: 'East of Crustacia' },
        { id: '0x2e', name: "Blimp's Cave" },
        { id: '0x68', name: 'Crustacia exterior' },
        { id: '0x30', name: 'Crustacia inside pirate ship' },
        { id: '0x04', name: 'Crustacia fire pit' },
        { id: '0x2f', name: "Horace's camp" },
        { id: '0x06', name: "Outside of 'mids" },
        { id: '0x64', name: "Cave entrance under 'mids" },
        { id: '0x55', name: "'mids bottom level (Dog start)" },
        { id: '0x56', name: "'mids top level (Boy start)" },
        { id: '0x57', name: "'mids basement level (Tiny)" },
        { id: '0x58', name: "'mids boss room (Rimsala)" },
        { id: '0x2b', name: 'Outside of halls' },
        { id: '0x29', name: 'Halls main room' },
        { id: '0x23', name: 'Halls SW' },
        { id: '0x24', name: 'Halls NW' },
        { id: '0x2c', name: 'Halls SE' },
        { id: '0x2d', name: 'Halls NE' },
        { id: '0x28', name: 'Halls Collapsing Bridge' },
        { id: '0x2a', name: 'Halls Boss Room' },
        { id: '0x4b', name: 'Oglin cave' },
        { id: '0x6d', name: 'Aquagoth Room' },
        { id: '0x35', name: 'Quicksand/Bugmuck/Volcano caves + West Alchemy Cave' },
    ]},
    { area: 'Gothica', rooms: [
        { id: '0x12', name: 'Ebon Keep sewers' },
        { id: '0x13', name: 'Between Ebon Keep sewers, Dark Forest and Swamp' },
        { id: '0x40', name: "Swamp south of Gomi's Tower" },
        { id: '0x37', name: "Gomi's Tower" },
        { id: '0x20', name: 'Timberdrake room in forest' },
        { id: '0x1f', name: 'Doubles room in forest' },
        { id: '0x22', name: 'Dark Forest' },
        { id: '0x21', name: 'Dark Forest entrance (save point)' },
        { id: '0x6c', name: 'SE of Ivor Tower (Well)' },
        { id: '0x76', name: 'South of Ivor Tower (Gate)' },
        { id: '0x7b', name: 'Ebon Keep and Ivor Tower Exterior Bottom Half' },
        { id: '0x7c', name: 'Ebon Keep and Ivor Tower Exterior Top Half' },
        { id: '0x7d', name: 'Ebon Keep and Ivor Tower Interior' },
        { id: '0x4e', name: 'Ivor Tower, west alley (market)' },
        { id: '0x62', name: 'Ivor Tower, west square (trailers)' },
        { id: '0x63', name: 'Ivor Tower, inside trailers' },
        { id: '0x19', name: 'Chessboard' },
        { id: '0x1a', name: 'Below chessboard' },
        { id: '0x74', name: 'Ebon Keep and Ivor Tower dungeon + pipe room' },
        { id: '0x0d', name: 'Ebon Keep Hall (Stairs, behind Verm)' },
        { id: '0x0f', name: 'Ebon Keep West Room (Naris)' },
        { id: '0x11', name: "Ebon Keep Queen's Room" },
        { id: '0x10', name: 'Ebon Keep Stained Glass Hallway' },
        { id: '0x14', name: "Ebon Keep Tinker's Room" },
        { id: '0x39', name: 'Ebon Keep Fire pit' },
        { id: '0x0e', name: 'Ebon Keep Dining Room' },
        { id: '0x5d', name: 'Ebon Keep Courtyard (South of Verm)' },
        { id: '0x5e', name: 'Ebon Keep Front Room (Verm)' },
        { id: '0x5f', name: 'Ebon Keep Verm side rooms' },
        { id: '0x60', name: 'Ebon Keep Storage Room' },
        { id: '0x6e', name: 'Ivor Tower Hall' },
        { id: '0x6f', name: 'Ivor Tower Dining Room' },
        { id: '0x70', name: 'Ivor Tower Exterior Bridges and Balconies' },
        { id: '0x71', name: 'Ivor Tower East Room + Kitchen' },
        { id: '0x72', name: 'Ivor Tower East Upper Floor' },
        { id: '0x73', name: 'Ivor Tower Dog Maze Underground' },
        { id: '0x75', name: 'Ivor Tower Stairwell to dungeon' },
        { id: '0x79', name: 'Ivor Tower Sewers' },
        { id: '0x7a', name: 'Ivor Tower Sewers Exterior (landing spot)' },
        { id: '0x78', name: "Ivor Tower Queen's Room" },
        { id: '0x77', name: 'Ivor Tower Puppet Show / Mungola' },
    ]},
    { area: 'Omnitopia', rooms: [
        { id: '0x46', name: "Professor's lab and ship area" },
        { id: '0x48', name: 'Metroplex tunnels (rimsalas, spheres)' },
        { id: '0x44', name: 'Greenhouse' },
        { id: '0x00', name: 'Alarm room' },
        { id: '0x43', name: 'Control room' },
        { id: '0x45', name: 'Secret boss room' },
        { id: '0x47', name: 'Storage room' },
        { id: '0x42', name: 'Reactor room and Reactor control' },
        { id: '0x54', name: 'Shops' },
        { id: '0x7e', name: 'Jail' },
        { id: '0x49', name: 'Junkyard (Landing spot)' },
        { id: '0x4a', name: 'Final Boss Room' },
    ]},
    { area: 'Intro / Misc', rooms: [
        { id: '0x61', name: 'Opening - Scrolling over Machine' },
        { id: '0x31', name: 'Intro - Podunk 1965' },
        { id: '0x02', name: 'Intro - Mansion Exterior 1965' },
        { id: '0x32', name: 'Intro - Podunk 1995' },
        { id: '0x03', name: 'Intro - Mansion Exterior 1995' },
    ]},
];



/** Return cached MAP enum: Map<enumName, numericId>. Reads core.evs MAP enum. */
function getMapEnum(wsRoot) {
    if (_radarMapEnumCache) return _radarMapEnumCache;
    _radarMapEnumCache = new Map();
    if (!wsRoot) return _radarMapEnumCache;
    const coreDir = path.join(wsRoot, 'in', 'core');
    const scan = (dir) => {
        let entries; try { entries = fs.readdirSync(dir); } catch { return; }
        for (const f of entries) {
            const fp = path.join(dir, f);
            try {
                const st = fs.statSync(fp);
                if (st.isDirectory()) scan(fp);
                else if (f.endsWith('.evs')) {
                    const txt = fs.readFileSync(fp, 'utf8');
                    if (!/\benum\s+MAP\b/.test(txt)) continue;
                    for (const [k, v] of parseEvsEnumValues(txt, 'MAP')) _radarMapEnumCache.set(k, v);
                }
            } catch { /* skip */ }
        }
    };
    scan(coreDir);
    return _radarMapEnumCache;
}

/**
 * Parse gameDrawPoint/gameDrawBox calls from soestuff.lua per-room watcher blocks.
 * Returns Map<roomId_hex_string, [{x, y, label}]> where x/y are in 8-px tile units.
 * Searches sibling directories of wsRoot for the Lua file.
 */
function readLuaWatchers(wsRoot) {
    if (_luaWatcherCache !== null) return _luaWatcherCache;
    _luaWatcherCache = new Map();

    // Try common paths for soestuff.lua
    const candidates = [
        path.join(wsRoot, '..', 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
        path.join(wsRoot, '..', '..', 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
        path.join(path.dirname(wsRoot), 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
    ];
    let luaText = '';
    for (const c of candidates) {
        try { luaText = fs.readFileSync(c, 'utf8'); break; } catch { /* try next */ }
    }
    if (!luaText) return _luaWatcherCache;

    // Split on watcher map entry headers like `[0x5c] = {`
    const blockRe = /\[0x([0-9a-f]+)\]\s*=\s*\{/gi;
    let m, blocks = [];
    while ((m = blockRe.exec(luaText)) !== null) blocks.push({ id: m[1], start: m.index });

    for (let bi = 0; bi < blocks.length; bi++) {
        const { id, start } = blocks[bi];
        const end = bi + 1 < blocks.length ? blocks[bi + 1].start : luaText.length;
        const body = luaText.slice(start, end);

        // Extract gameDrawPoint(x_lit, y_lit, ...) calls — literal hex/decimal only
        const ptRe = /gameDrawPoint\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)/g;
        let pm, pts = [];
        while ((pm = ptRe.exec(body)) !== null) {
            const px = parseInt(pm[1], pm[1].startsWith('0x') ? 16 : 10);
            const py = parseInt(pm[2], pm[2].startsWith('0x') ? 16 : 10);
            // Coordinates are in SNES game pixels; divide by 8 for 8-px tile units
            pts.push({ x: px / 8, y: py / 8 });
        }
        if (pts.length) _luaWatcherCache.set(id.toLowerCase().replace(/^0+/, '') || '0', pts);
    }
    return _luaWatcherCache;
}

function readScriptAllTriggers(wsRoot, vanillaEnumName, romPathOverride = '') {
    const out = { enter: null, stepOn: [], bTrigger: [], meta: null };
    if (!wsRoot || !vanillaEnumName) return out;

    let roomId = NaN;
    if (/^0x/i.test(vanillaEnumName)) {
        roomId = parseInt(vanillaEnumName, 16);
    } else {
        const mapEnum = getMapEnum(wsRoot);
        roomId = mapEnum.get(vanillaEnumName) ?? NaN;
        if (isNaN(roomId)) roomId = parseInt(vanillaEnumName, 10);
    }
    if (isNaN(roomId)) return out;

    const model = readRoomScriptModel(wsRoot, roomId, romPathOverride);
    if (!model) return out;
    return model;
}

function buildVanillaRoomContent(wsRoot, roomId, romPathOverride = '') {
    const mapId = parseInt(roomId, 16);
    const content = {
        initMap: null,
        entrances: [],
        enemies: [],
        objects: [],
        transitions: [],
        triggerNames: { stepOn: [], bTrigger: [] },
        triggers: { enter: null, stepOn: [], bTrigger: [], meta: null },
        roomError: null,
        mapId: Number.isNaN(mapId) ? null : mapId,
    };
    if (!wsRoot || Number.isNaN(mapId)) {
        content.roomError = { message: 'No workspace root available for ROM-backed vanilla room data.' };
        return content;
    }
    const header = readRomMapHeader(wsRoot, mapId, romPathOverride);
    if (!header) {
        content.roomError = { message: romPathOverride
            ? 'Configured ROM could not be read for this vanilla room.'
            : 'No ROM configured. Set Everscript: Vanilla ROM or choose a repo path.' };
        return content;
    }
    content.initMap = { x1: 0, y1: 0, x2: header.mapW * 2, y2: header.mapH * 2 };
    content.romHeader = header;
    content.trigOffset = { offX: header.offX, offY: header.offY };
    content.triggers = readScriptAllTriggers(wsRoot, roomId, romPathOverride);
    return content;
}

function buildVanillaRoomDetails(wsRoot, romPath) {
    const cacheKey = JSON.stringify([wsRoot || '', romPath || '']);
    if (_radarVanillaRoomsCache && _radarVanillaRoomsCacheKey === cacheKey) return _radarVanillaRoomsCache;
    const all = {};
    for (const group of VANILLA_ROOMS) {
        for (const room of group.rooms) {
            all[room.id] = {
                name: room.name,
                vanillaId: room.id,
                relPath: 'vanilla (rom)',
                startLine: -1,
                endLine: -1,
                content: buildVanillaRoomContent(wsRoot, room.id, romPath || ''),
                imageUri: null,
                imageDims: null,
            };
        }
    }
    _radarVanillaRoomsCache = all;
    _radarVanillaRoomsCacheKey = cacheKey;
    return all;
}

module.exports = {
    VANILLA_ROOMS,
    getMapEnum,
    readLuaWatchers,
    readScriptAllTriggers,
    buildVanillaRoomContent,
    buildVanillaRoomDetails,
    invalidateRoomDataCaches,
};
