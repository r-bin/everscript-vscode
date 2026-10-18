// Ownership: map / room IDs to room names, regions, and optional string indices.
// Source: data/rooms.json — names in our style with their evidence (docs/cleanup.md D4).

import { resolveLocalizedName } from './strings';
import type { NameOptions } from './strings';

import ROOMS from './data/rooms.json';


/**
 * All 127 vanilla rooms, named in our style (docs/cleanup.md D4): `region › place › part`, each part
 * with its source in data/rooms.json (`tools/rooms/write-room-names.js`). Each entry:
 *  - id, hex
 *  - area: the region (the act), from the Dog's form the room's enter script requests
 *  - name: `place › part`; fullName: `region › place › part`; path: `region/place/part`
 *  - evidence: where each part comes from
 */
/** In the order the Rooms tab lists them, act by act (the order of data/rooms.json). */
const VANILLA_MAPS = ROOMS.map((r) => {
    const id = r.id;
    return {
        id, hex: '0x' + id.toString(16).padStart(2, '0'), area: r.region,
        name: `${r.place} › ${r.part}`, fullName: `${r.region} › ${r.place} › ${r.part}`,
        path: r.path, evidence: r.evidence, stringIndex: null,
    };
});

type MapEntry = (typeof VANILLA_MAPS)[number];

const MAP_BY_ID = new Map<number | string, MapEntry>();
for (const m of VANILLA_MAPS) {
    MAP_BY_ID.set(m.id, m);
    MAP_BY_ID.set(m.hex.toLowerCase(), m);
}

/**
 * Catalogue grouped by area, identical to vanilla-data.js structure.
 */
const AREAS = ['Prehistoria', 'Antiqua', 'Gothica', 'Omnitopia', 'Podunk'];
const VANILLA_ROOMS = AREAS.map(area => ({
    area,
    rooms: VANILLA_MAPS.filter(m => m.area === area).map(m => ({ id: m.hex, name: m.name })),
}));

/**
 * Retrieve a map record by id (integer e.g. 0x38 or string '0x38' or 56).
 */
function getMap(id: number | string): MapEntry | null {
    if (typeof id === 'string') {
        const parsed = id.startsWith('0x') || id.startsWith('0X') ? parseInt(id, 16) : parseInt(id, 10);
        return MAP_BY_ID.get(id.toLowerCase()) || MAP_BY_ID.get(parsed) || null;
    }
    return MAP_BY_ID.get(id) || null;
}

/** Get map name with optional full name (area prefix) or in-game ROM string resolution. */
function getMapName(id: number | string, options: NameOptions = {}): string {
    const map = getMap(id);
    if (!map) {
        if (options.fallback !== undefined) return options.fallback;
        return typeof id === 'number' ? `Room 0x${id.toString(16).padStart(2, '0')}` : `Room ${id}`;
    }
    const prop = options.full ? 'fullName' : 'name';
    return resolveLocalizedName(map, options.rom, prop);
}

/**
 * Get the area name for a map ID.
 */
function getMapArea(id: number | string): string {
    const map = getMap(id);
    return map ? map.area : '';
}

export { VANILLA_MAPS, VANILLA_ROOMS, MAP_BY_ID, getMap, getMapName, getMapArea };
