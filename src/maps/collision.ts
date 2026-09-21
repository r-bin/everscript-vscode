// Ownership: the collision word bitfield — geometry, elevation planes, drift,
// entity gates. Pure.
//
// Ported from everscript/tools/collision.py ($909DE8 / $8FA914 / $8FAD9F).
// See docs/map-format/map_collision_mechanics.md.
//
// Never interpret a collision word by hand: the bitfield is not obvious and an
// earlier hand-reading of it was wrong for years. Use these accessors.

export const GEOMETRY_MASK = 0x000f;
export const PLANE_MASK = 0x0030;
export const PLANE_TRANSPARENT = 0x0040;
export const ENTITY_GATE_ACTIVE = 0x0100;
export const ENTITY_GATE_MASK = 0x0f00;
export const ALWAYS_WALKABLE = 0x2000;
/** Bit 12: a character standing here is drawn in front of the foreground. */
export const SPRITE_IN_FRONT = 0x1000;

/** Fully solid geometry code. */
export const SOLID = 0x0f;
/** Fully open geometry code. */
export const OPEN = 0x00;

/** Which entity the passability evaluator is being asked about. */
export type Entity = 'boy' | 'dog' | 'other';

/** Elevation plane 0..3 (bits 5..4). */
export function tilePlane(cw: number): number {
    return (cw & PLANE_MASK) >> 4;
}

/** Bit 6: walkable from any plane other than the tile's own. */
export function isPlaneTransparent(cw: number): boolean {
    return (cw & PLANE_TRANSPARENT) !== 0;
}

/** Bit 13: geometry forced to 0 via the all-zero table at $909E73. */
export function isAlwaysWalkable(cw: number): boolean {
    return (cw & ALWAYS_WALKABLE) !== 0;
}

/**
 * Whether a character on this tile is drawn over the foreground.
 *
 * `$8FC773` builds an entity's OAM attribute from the collision word of the
 * tile it stands on. Bit 12 set, or a plane below the tile's own, gives
 * priority **3** — in front of every background pixel. Otherwise it is
 * priority **2**, which in Mode 1 sits behind `BG1.1` and `BG2.1`:
 *
 *     8FC7AA  BIT #$1000
 *     8FC7AD  BNE $8FC7C1      ; -> LDA #$CC30, priority 3
 *     8FC7B7  LDA #$CC20       ; otherwise priority 2
 *
 * A spawn's own plane comes from the tile it is placed on, so for a resting
 * enemy this bit is the whole answer.
 */
export function spriteDrawsInFront(cw: number): boolean {
    return (cw & SPRITE_IN_FRONT) !== 0;
}

/** True if standing here leaves the entity's plane unchanged ($8FA914). */
export function holdsPlane(cw: number): boolean {
    return (cw & (ALWAYS_WALKABLE | PLANE_TRANSPARENT)) !== 0;
}

/** The per-frame velocity delta a drift tile adds. */
export interface DriftVector {
    dx: number;
    dy: number;
    /** Compass name, `SHEAR+`/`SHEAR-` for the motion-dependent handlers, `''` for none. */
    name: string;
}

// $8FAD9F tests bit 13 and, when set, uses the low nibble as an index into the
// jump table at $8FAF28 instead of as collision geometry.
const DRIFT_VECTORS: Record<number, DriftVector> = {
    0x8: { dx: 0, dy: -2, name: 'N' },
    0x9: { dx: 1, dy: -1, name: 'NE' },
    0xa: { dx: 2, dy: 0, name: 'E' },
    0xb: { dx: 1, dy: 1, name: 'SE' },
    0xc: { dx: -1, dy: -1, name: 'NW' },
    0xd: { dx: -2, dy: 0, name: 'W' },
    0xe: { dx: -1, dy: 1, name: 'SW' },
    0xf: { dx: 0, dy: 2, name: 'S' },
};

// Low nibbles 1 and 2 under bit 13: vertical shear whose sign flips with the
// entity's horizontal motion, so the direction is not a property of the map.
const DRIFT_SHEAR: Record<number, number> = { 0x1: 1, 0x2: -1 };

const NO_DRIFT: DriftVector = { dx: 0, dy: 0, name: '' };

export function driftVector(cw: number): DriftVector {
    if ((cw & ALWAYS_WALKABLE) === 0) return NO_DRIFT;
    const low = cw & GEOMETRY_MASK;
    if (low in DRIFT_VECTORS) return DRIFT_VECTORS[low];
    if (low in DRIFT_SHEAR) return { dx: 0, dy: 0, name: DRIFT_SHEAR[low] > 0 ? 'SHEAR+' : 'SHEAR-' };
    return NO_DRIFT;
}

/**
 * Entity-gate nibble (bits 11..8) when bit 8 is set, else -1.
 *   3 -> solid for every entity except the boy and the dog
 *   5 -> solid for the dog
 *   7 -> solid for the boy and the dog
 */
export function entityGate(cw: number): number {
    return (cw & ENTITY_GATE_ACTIVE) !== 0 ? (cw & ENTITY_GATE_MASK) >> 8 : -1;
}

const GATE_BLOCKS: Record<number, Entity[]> = {
    3: ['other'],
    5: ['dog'],
    7: ['boy', 'dog'],
};

/**
 * Port of $909DE8. Returns the 4-bit geometry code the engine would use:
 * 0x00 fully open, 0x0F fully solid, anything else a sub-tile slope/barrier.
 */
export function passability(cw: number, entityPlane: number, entity: Entity = 'boy'): number {
    const planeBits = (entityPlane & 0x03) << 4;

    const gate = entityGate(cw);
    const blocked = GATE_BLOCKS[gate];
    if (blocked && blocked.indexOf(entity) !== -1) return SOLID; // $909E64

    if (cw & PLANE_TRANSPARENT) {
        // $909E44
        if (((cw ^ planeBits) & PLANE_MASK) !== 0) return OPEN; // $909E51
        return cw & GEOMETRY_MASK;
    }

    const diff = (cw - planeBits) & 0xffff; // $909E27: SEC / SBC $44
    if ((diff & PLANE_MASK) === 0) {
        // same plane
        return cw & ALWAYS_WALKABLE ? OPEN : cw & GEOMETRY_MASK;
    }

    // $909E53: plane mismatch
    if ((diff & 0x0020) === 0) return cw & ALWAYS_WALKABLE ? OPEN : SOLID; // $909E68
    return SOLID; // $909E64, and $909E5D falls through here
}

/** 256-byte 16x16 mask, 1 = solid pixel, for a 4-bit geometry code. */
export function geometryMask(code: number): Uint8Array {
    const out = new Uint8Array(256);
    for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
            let s: boolean;
            if (code === 0x0f) s = true;
            else if (code === 0x00) s = false;
            else if (code === 0x02 || code === 0x06) s = py >= px;
            else if (code === 0x01 || code === 0x05) s = px + py >= 15;
            else if (code === 0x0a || code === 0x0e) s = px + py <= 15;
            else if (code === 0x09 || code === 0x0d) s = py <= px;
            else if (code === 0x03 || code === 0x04) s = py >= 8;
            else if (code === 0x0c || code === 0x0b) s = py < 8;
            else if (code === 0x08) s = px >= 8;
            else if (code === 0x07) s = px < 8;
            else s = false;
            out[py * 16 + px] = s ? 1 : 0;
        }
    }
    return out;
}

/** Sorted list of the elevation planes that occur in a room. */
export function planesUsed(collisionWords: number[][]): number[] {
    const seen = new Set<number>();
    for (const row of collisionWords) {
        for (const cw of row) seen.add(tilePlane(cw));
    }
    return Array.from(seen).sort((a, b) => a - b);
}

/**
 * Tiles that change the entity's elevation plane — a plane-setting tile
 * orthogonally adjacent to an enterable plane-setting tile on a different
 * plane. Ramps and stair runs show up as the join between two plane regions.
 */
export function planeTransitionTiles(collisionWords: number[][]): Array<[number, number]> {
    const h = collisionWords.length;
    const w = h ? collisionWords[0].length : 0;
    const out: Array<[number, number]> = [];
    const enterable = (cw: number): boolean => passability(cw, tilePlane(cw)) !== SOLID;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const cw = collisionWords[y][x];
            if (holdsPlane(cw) || !enterable(cw)) continue;
            const p = tilePlane(cw);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                const ncw = collisionWords[ny][nx];
                if (holdsPlane(ncw) || !enterable(ncw)) continue;
                if (tilePlane(ncw) !== p) {
                    out.push([x, y]);
                    break;
                }
            }
        }
    }
    return out;
}
