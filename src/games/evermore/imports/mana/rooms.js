'use strict';
// Ownership: Secret of Mana maps as rooms of Evermore's Rooms tab — the rail's list,
// a room's details when it is opened, and which ROM image (virtual-rom.js) answers the
// tab's requests for it. No `vscode`: both ROMs arrive as functions from the host.
//
// A converted room's id in the tab is IMPORTED_ROOM_BASE + Mana map id, never a ROM
// room (0..0x7E), so no Evermore draft, cache or request can mistake it for one.
// Families are named m<n> (n = palette set * 8 + palette - 1): the same Mana palette is
// the same family in every map that loads it.

const mana = require('../../../../../dist/games/mana/decoder');
const { readRomMapHeaderFrom } = require('../../rom-readers');
const { convertManaMap } = require('./convert');
const { buildVirtualRom } = require('./virtual-rom');
const ids = require('../../../../../dist/games/evermore/imports/mana/ids');

const VID_PREFIX = 'som-';
const CACHE_MAX = 4;

const hex4 = (n) => n.toString(16).toUpperCase().padStart(3, '0');

/** `{soeRom(), manaRom()}` return the current buffers (or null). */
function createManaRooms(deps) {
    const cache = new Map();          // mana id -> { soe, manaRom, room, image }
    const familyMap = new Map();      // family id -> mana id that last used it

    const roms = () => {
        const soe = deps.soeRom(), m = deps.manaRom();
        return soe && m && mana.isManaRom(m) && !mana.isManaRom(soe) ? { soe, m } : null;
    };

    function entry(manaId) {
        const r = roms();
        if (!r) return null;
        const hit = cache.get(manaId);
        if (hit && hit.soe === r.soe && hit.manaRom === r.m) return hit;
        const room = convertManaMap(r.m, manaId);
        if (!room) return null;
        const image = buildVirtualRom(r.soe, room, manaId + 1);
        const e = { soe: r.soe, manaRom: r.m, room, image };
        cache.set(manaId, e);
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
        room.families.forEach((f) => familyMap.set(f.id, manaId));
        return e;
    }

    /** The rail: one row per picture, grouped by area. [] without both ROMs. */
    function railGroups() {
        const r = roms();
        if (!r) return [];
        return mana.mapCatalog(r.m).areas.map((a) => ({
            area: a.name,
            rooms: a.pictures.map(([id, ...same], i) => ({
                id: VID_PREFIX + id.toString(16),
                name: a.pictures.length > 1 ? a.name + ' ' + (i + 1) : a.name,
                tag: 'som ' + id.toString(16),
                same: same.map((n) => n.toString(16)),
            })),
        })).filter((g) => g.rooms.length);
    }

    /** The Rooms tab's room object for `vid` (`som-80`), or null. */
    function detail(vid, name) {
        if (typeof vid !== 'string' || !vid.startsWith(VID_PREFIX)) return null;
        const manaId = parseInt(vid.slice(VID_PREFIX.length), 16);
        const e = Number.isInteger(manaId) ? entry(manaId) : null;
        if (!e) return null;
        const { room, image } = e;
        const label = (t) => 'Mana event ' + hex4(t.scriptId);
        // `scriptId` keeps the tab from looking the number up among Evermore's scripts;
        // `what` is what the row says the trigger does.
        const stepOn = room.stepOn.map((t) => ({ x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, scriptId: t.scriptId, label: label(t), what: label(t) }));
        return {
            name: name || ('Secret of Mana ' + manaId.toString(16)),
            vanillaId: 'som ' + manaId.toString(16),
            romRoomId: ids.IMPORTED_ROOM_BASE + manaId,
            imported: 'mana',
            relPath: 'Secret of Mana map ' + manaId.toString(16) + ', converted',
            startLine: -1, endLine: -1, imageUri: null, imageDims: null,
            families: room.families.map((f) => ({
                id: f.id, label: f.label, tiles: f.graphics, rooms: 1, areas: ['Secret of Mana'],
                names: ['palette set ' + f.paletteSet + ', palette ' + f.palette],
            })),
            conversion: Object.assign({
                onEnter: room.onEnter, blobBytes: image.blobBytes, stamps: image.metatileCount, wramBytes: image.wramBytes,
            }, room.stats),
            content: {
                initMap: { x1: 0, y1: 0, x2: room.widthTiles * 2, y2: room.heightTiles * 2 },
                entrances: [], objects: [], transitions: [],
                // Mana's map objects, as the tab's spawn markers (8-pixel units).
                enemies: room.spawns.map((o) => ({ x: o.x * 2, y: o.y * 2, type: 'Mana object ' + hex4(o.kind), dynamic: false })),
                triggerNames: { stepOn: stepOn.map((t) => t.label), bTrigger: [] },
                triggers: { enter: null, stepOn, bTrigger: [], meta: null },
                roomError: null,
                mapId: ids.IMPORTED_ROOM_BASE + manaId,
                romHeader: readRomMapHeaderFrom(image.rom, image.roomId),
                trigOffset: { offX: 0, offY: 0 },
            },
        };
    }

    /** `{rom, roomId}` to answer a request about tab room `roomId`, or null when it is not converted. */
    function resolveRoom(roomId) {
        const n = Number(roomId);
        if (!Number.isInteger(n) || n < ids.IMPORTED_ROOM_BASE || n >= ids.IMPORTED_ROOM_BASE + mana.MAP_COUNT) return null;
        const e = entry(n - ids.IMPORTED_ROOM_BASE);
        return e ? { rom: e.image.rom, roomId: e.image.roomId } : null;
    }

    /** The image that holds family `familyId`, when it is a converted one already seen. */
    function resolveFamily(familyId) {
        const n = Number(familyId);
        if (!ids.isImportedFamily(n) || !familyMap.has(n)) return null;
        const e = entry(familyMap.get(n));
        return e ? { rom: e.image.rom, roomId: e.image.roomId } : null;
    }

    return { railGroups, detail, resolveRoom, resolveFamily, clear: () => { cache.clear(); familyMap.clear(); } };
}

module.exports = { createManaRooms, VID_PREFIX, isImportedRoomId: (n) => Number(n) >= ids.IMPORTED_ROOM_BASE };
