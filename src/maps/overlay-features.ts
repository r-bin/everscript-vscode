// Ownership: classify a decoded room into the feature sets the overlay draws,
// and describe them in words (legend + summary line).
//
// Pure and tile-level — no pixels. Split from collision-overlay.ts so "what is
// in this room" has one owner and "how it is painted" has another: the Rooms
// tab needs the classification for its HTML legend and summary without paying
// for a render.
//
// Every classification is a documented collision bitfield. Nothing keys off a
// room id or a hand-built word list. See docs/map-format/map_collision_mechanics.md.

import { RoomData } from './room';
import {
    passability,
    planesUsed,
    planeTransitionTiles,
    isAlwaysWalkable,
    isPlaneTransparent,
    entityGate,
    SOLID,
} from './collision';

/** One contour colour per elevation plane, matching render_map.py. */
export const PLANE_COLORS: Record<number, [number, number, number]> = {
    0: [0, 170, 255],
    1: [235, 25, 25],
    2: [0, 255, 170],
    3: [190, 90, 255],
};

/**
 * Entity gates that actually block something.
 *
 * 3 = solid for everything except the boy and the dog, 5 = solid for the dog,
 * 7 = solid for both. Other nibble values are not gates.
 */
export const GATE_BLOCKS: Record<number, boolean> = { 3: true, 5: true, 7: true };

/** A metatile coordinate pair. */
export type TileXY = [number, number];

/** An object state's footprint, in metatile units. */
export interface ObjectRect {
    tx: number;
    ty: number;
    w: number;
    h: number;
    /** Section 3 object index — matches SoEScriptDumper's `script_all` "OBJ n". */
    index: number;
}

export interface RoomFeatures {
    /** Elevation planes present, ascending. */
    planes: number[];
    /** Walkable tile count per plane, which is what picks the dominant one. */
    planeWalkable: Map<number, number>;
    /** The plane with the most walkable tiles — drawn solid, the rest dashed. */
    mainPlane: number;
    /** Collision bit 13: sewer pipes, volcano slides, desert drift. */
    forcedWalk: TileXY[];
    /** Collision bit 6: bridge tiles you pass through while on another plane. */
    transparent: TileXY[];
    /** Collision bit 8 gates, as [x, y, gate]. */
    gated: Array<[number, number, number]>;
    /** Tiles where crossing swaps your elevation plane. */
    transitions: TileXY[];
    /** Cuttable grass, a temporary barrier rather than map geometry. */
    grassTiles: TileXY[];
    /** Every state of every Section 3 object. */
    objectRects: ObjectRect[];
}

/** Classify a room's collision grid and objects. Cheap: no pixel buffers. */
export function classifyRoom(room: RoomData): RoomFeatures {
    const cw = room.collisionWords;
    const wTiles = room.header.widthTiles;
    const hTiles = room.header.heightTiles;

    const planes = planesUsed(cw);
    const planeWalkable = new Map<number, number>();
    for (const p of planes) {
        let walkable = 0;
        for (let r = 0; r < hTiles; r++) {
            for (let c = 0; c < wTiles; c++) if (passability(cw[r][c], p) !== SOLID) walkable += 1;
        }
        planeWalkable.set(p, walkable);
    }
    // Ties keep the lowest plane, matching Python's max() over an ascending list.
    const mainPlane = planes.reduce(
        (a, b) => ((planeWalkable.get(b) || 0) > (planeWalkable.get(a) || 0) ? b : a),
        planes.length ? planes[0] : 0,
    );

    const forcedWalk: TileXY[] = [];
    const transparent: TileXY[] = [];
    const gated: Array<[number, number, number]> = [];
    for (let r = 0; r < hTiles; r++) {
        for (let c = 0; c < wTiles; c++) {
            const word = cw[r][c];
            if (isAlwaysWalkable(word)) forcedWalk.push([c, r]);
            if (isPlaneTransparent(word)) transparent.push([c, r]);
            const gate = entityGate(word);
            if (GATE_BLOCKS[gate]) gated.push([c, r, gate]);
        }
    }

    const objectRects: ObjectRect[] = [];
    for (const obj of room.objects) {
        for (const st of obj.states) {
            objectRects.push({
                tx: st.tileX,
                ty: st.tileY,
                w: Math.max(st.targetWidth, 1),
                h: Math.max(st.targetHeight, 1),
                index: obj.objectIndex,
            });
        }
    }

    return {
        planes,
        planeWalkable,
        mainPlane,
        forcedWalk,
        transparent,
        gated,
        transitions: planeTransitionTiles(cw),
        grassTiles: room.cuttableGrass.tiles,
        objectRects,
    };
}

/** A legend entry: the colour as drawn, and what it means. */
export interface LegendItem {
    color: [number, number, number];
    label: string;
    /** Overlay flag this entry belongs to, so a UI can grey it out when off. */
    flag: string;
}

/**
 * The legend render_map.py prints under the map.
 *
 * Entries for features the room does not have are omitted, exactly as
 * upstream does — a legend listing things that are not on screen is noise.
 */
export function buildLegend(features: RoomFeatures): LegendItem[] {
    const items: LegendItem[] = [];
    for (const p of features.planes) {
        const suffix = p === features.mainPlane ? '' : ' (DOTTED)';
        items.push({ color: PLANE_COLORS[p] || PLANE_COLORS[1], label: `PLANE ${p} BOUNDARY${suffix}`, flag: 'c' });
    }
    if (features.forcedWalk.length) {
        items.push({ color: [0, 188, 212], label: 'DRIFT / FORCED WALKABLE (BIT 13, ARROW = DIRECTION)', flag: 'd' });
    }
    if (features.transparent.length) items.push({ color: [156, 39, 176], label: 'PLANE-TRANSPARENT (BIT 6)', flag: 'p' });
    if (features.transitions.length) items.push({ color: [255, 152, 0], label: 'ELEVATION CHANGE', flag: 'e' });
    if (features.gated.length) items.push({ color: [235, 235, 235], label: 'ENTITY GATE (BIT 8)', flag: 'n' });
    if (features.grassTiles.length) items.push({ color: [76, 175, 80], label: 'CUTTABLE GRASS', flag: 'g' });
    items.push({ color: [33, 150, 243], label: 'OBJECT STAMP (N BOTTOM-LEFT = SCRIPT_ALL OBJ N)', flag: 'o' });
    items.push({ color: [255, 255, 0], label: 'B-TRIGGER (HEX TOP-LEFT = SCRIPT_ALL ID)', flag: 't' });
    items.push({ color: [255, 0, 255], label: 'STEP-ON (HEX TOP-LEFT = SCRIPT_ALL ID)', flag: 't' });
    return items;
}

/**
 * The header banner segments render_map.py prints above the map, as
 * label/value pairs so a UI can style them rather than re-parse a string.
 */
export function buildSummary(room: RoomData, features: RoomFeatures): Array<[string, string]> {
    const segments: Array<[string, string]> = [
        ['ROOM', `0x${room.roomId.toString(16).toUpperCase().padStart(2, '0')}`],
        ['TILES', `${room.header.widthTiles}x${room.header.heightTiles}`],
        ['PLANES', `${features.planes.length} (${features.planes.join(',')})`],
        ['OBJECTS', String(room.objects.length)],
        ['B-TRIGGERS', String(room.triggers.bTrigger.length)],
        ['STEP-ON', String(room.triggers.stepOn.length)],
        ['CUTTABLE GRASS', String(features.grassTiles.length)],
    ];
    if (features.forcedWalk.length) segments.push(['FORCED WALKABLE', String(features.forcedWalk.length)]);
    if (features.transparent.length) segments.push(['PLANE-TRANSPARENT', String(features.transparent.length)]);
    if (features.transitions.length) segments.push(['ELEV CHANGE', String(features.transitions.length)]);
    if (features.gated.length) segments.push(['ENTITY GATES', String(features.gated.length)]);
    return segments;
}
