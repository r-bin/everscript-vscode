'use strict';
// Ownership: Secret of Mana vanilla room catalogue + details builder.
//
// Maintains a cache for the buildManaRoomDetails call.
// Depends on: loadManaRomBuffer (rom-readers), maps domain (src/maps).

const { loadManaRomBuffer } = require('../../shared/rom-readers');
const maps = require('../../maps');

let _radarManaRoomsCache = null;
let _radarManaRoomsCacheKey = '';

function invalidateManaDataCaches() {
    _radarManaRoomsCache = null;
    _radarManaRoomsCacheKey = '';
}

/**
 * Build the full Secret of Mana composite room catalogue.
 * @param {string|null} wsRoot
 * @param {string}      manaRomPath
 * @returns {Object} Map<manaId, manaRoomDetailObject>
 */
function buildManaRoomDetails(wsRoot, manaRomPath = '') {
    const cacheKey = JSON.stringify([wsRoot || '', manaRomPath || '']);
    if (_radarManaRoomsCache && _radarManaRoomsCacheKey === cacheKey) {
        return _radarManaRoomsCache;
    }

    const romBuf = loadManaRomBuffer(wsRoot, manaRomPath);
    if (!romBuf) {
        _radarManaRoomsCache = {};
        _radarManaRoomsCacheKey = cacheKey;
        return {};
    }

    const all = {};
    try {
        const roomList = maps.listManaRooms(romBuf);
        for (const r of roomList) {
            all[r.id] = {
                name: r.name,
                manaId: r.id,
                isMana: true,
                relPath: 'Secret of Mana',
                startLine: -1,
                endLine: -1,
                widthTiles: r.mapW,
                heightTiles: r.mapH,
                content: {
                    mapId: r.id,
                    initMap: { x1: 0, y1: 0, x2: r.mapW * 2, y2: r.mapH * 2 },
                    romHeader: {
                        mapW: r.mapW,
                        mapH: r.mapH,
                        mapWpx: r.mapW * 16,
                        mapHpx: r.mapH * 16,
                        offX: 0,
                        offY: 0,
                    },
                    triggers: { enter: null, stepOn: [], bTrigger: [], meta: null },
                    entrances: [],
                    enemies: [],
                    objects: [],
                    triggerNames: { stepOn: [], bTrigger: [] },
                    roomError: null,
                },
                imageUri: null,
                imageDims: { w: r.mapW * 16, h: r.mapH * 16 },
            };
        }
    } catch (_err) {
        // Fall back to empty map details if decoding fails
    }

    _radarManaRoomsCache = all;
    _radarManaRoomsCacheKey = cacheKey;
    return all;
}

module.exports = {
    buildManaRoomDetails,
    invalidateManaDataCaches,
};
