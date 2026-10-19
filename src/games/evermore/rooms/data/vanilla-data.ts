// Ownership: vanilla room catalogue + ROM-backed vanilla room content builders.
// Maintains a cache for the expensive buildVanillaRoomDetails call.
// Depends on: readRomMapHeader (rom-readers), readScriptAllTriggers (lua-watchers).

import { readRomMapHeader } from '../../rom-readers';
import type { RomMapHeader } from '../../rom-readers';
import { readScriptAllTriggers } from './lua-watchers';
import type { RoomContent } from '../parsing/content-parser';

/** A vanilla room's content: the parsed shape, empty, plus what the ROM gives. */
type VanillaContent = RoomContent & {
    triggers: ReturnType<typeof readScriptAllTriggers>; roomError: { message: string } | null; mapId: number | null;
    romHeader?: RomMapHeader; trigOffset?: { offX: number; offY: number };
};
type VanillaRoom = { name: string; vanillaId: string; romRoomId: number; relPath: string; startLine: number; endLine: number; content: VanillaContent; imageUri: null; imageDims: null };

let _radarVanillaRoomsCache: Record<string, VanillaRoom> | null = null;
let _radarVanillaRoomsCacheKey = '';

function invalidateVanillaDataCaches() {
    _radarVanillaRoomsCache    = null;
    _radarVanillaRoomsCacheKey = '';
}

// Full catalogue of vanilla rooms grouped by act, loaded from localizations.
import { VANILLA_ROOMS } from '../../localizations';


/**
 * Build a skeleton room content object backed by ROM data for a vanilla room.
 * @param {string|null} wsRoot         Workspace root.
 * @param {string}      roomId         Hex ID string e.g. '0x33'.
 * @param {string}      romPathOverride Optional ROM path override.
 */
function buildVanillaRoomContent(wsRoot: string | null, roomId: string, romPathOverride: string = ''): VanillaContent {
    const mapId = parseInt(roomId, 16);
    const content: VanillaContent = {
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
function buildVanillaRoomDetails(wsRoot: string | null, romPath?: string): Record<string, VanillaRoom> {
    const cacheKey = JSON.stringify([wsRoot || '', romPath || '']);
    if (_radarVanillaRoomsCache && _radarVanillaRoomsCacheKey === cacheKey) {
        return _radarVanillaRoomsCache;
    }
    const all: Record<string, VanillaRoom> = {};
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

export { VANILLA_ROOMS, buildVanillaRoomContent, buildVanillaRoomDetails, invalidateVanillaDataCaches };
