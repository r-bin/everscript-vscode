'use strict';
// Ownership: vanilla room catalogue + ROM-backed vanilla room content builders.
// Maintains a cache for the expensive buildVanillaRoomDetails call.
// Depends on: readRomMapHeader (rom-readers), readScriptAllTriggers (lua-watchers).

const { readRomMapHeader } = require('../../shared/rom-readers');
const { readScriptAllTriggers } = require('./lua-watchers');

let _radarVanillaRoomsCache    = null;
let _radarVanillaRoomsCacheKey = '';

function invalidateVanillaDataCaches() {
    _radarVanillaRoomsCache    = null;
    _radarVanillaRoomsCacheKey = '';
}

// Full catalogue of vanilla rooms grouped by act, loaded from localizations.
const { VANILLA_ROOMS } = require('../../localizations');


/**
 * Build a skeleton room content object backed by ROM data for a vanilla room.
 * @param {string|null} wsRoot         Workspace root.
 * @param {string}      roomId         Hex ID string e.g. '0x33'.
 * @param {string}      romPathOverride Optional ROM path override.
 */
function buildVanillaRoomContent(wsRoot, roomId, romPathOverride = '') {
    const mapId = parseInt(roomId, 16);
    const content = {
        initMap:      null,
        entrances:    [],
        enemies:      [],
        objects:      [],
        transitions:  [],
        triggerNames: { stepOn: [], bTrigger: [] },
        triggers:     { enter: null, stepOn: [], bTrigger: [], meta: null },
        roomError:    null,
        mapId:        Number.isNaN(mapId) ? null : mapId,
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
    content.initMap    = { x1: 0, y1: 0, x2: header.mapW * 2, y2: header.mapH * 2 };
    content.romHeader  = header;
    content.trigOffset = { offX: header.offX, offY: header.offY };
    content.triggers   = readScriptAllTriggers(wsRoot, roomId, romPathOverride);
    return content;
}

/**
 * Build the full vanilla room details map (all rooms, ROM-backed).
 * Result is cached by [wsRoot, romPath] key.
 * @returns {Object} Map<vanillaId, roomDetailObject>
 */
function buildVanillaRoomDetails(wsRoot, romPath) {
    const cacheKey = JSON.stringify([wsRoot || '', romPath || '']);
    if (_radarVanillaRoomsCache && _radarVanillaRoomsCacheKey === cacheKey) {
        return _radarVanillaRoomsCache;
    }
    const all = {};
    for (const group of VANILLA_ROOMS) {
        for (const room of group.rooms) {
            all[room.id] = {
                name:       room.name,
                vanillaId:  room.id,
                // Numeric ROM room id. The vanilla catalog stores hex strings,
                // but live rooms carry a symbolic enum name in `vanillaId`, so
                // the ROM render path keys off this normalized field instead.
                romRoomId:  parseInt(room.id, 16),
                relPath:    'vanilla (rom)',
                startLine:  -1,
                endLine:    -1,
                content:    buildVanillaRoomContent(wsRoot, room.id, romPath || ''),
                imageUri:   null,
                imageDims:  null,
            };
        }
    }
    _radarVanillaRoomsCache    = all;
    _radarVanillaRoomsCacheKey = cacheKey;
    return all;
}

module.exports = {
    VANILLA_ROOMS,
    buildVanillaRoomContent,
    buildVanillaRoomDetails,
    invalidateVanillaDataCaches,
};
