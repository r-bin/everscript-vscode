// Ownership: what the 126 vanilla rooms already answer about a graphic —
// which tile family it is drawn in, and what collision sits under it. Pure.
//
// The ROM is a labelled training set. Asking "which family does graphic 4191
// belong to" is not a guess: 126 rooms placed it 779698 times between them,
// and the answer is a count. This module does that one pass and caches it.
//
// See docs/map-format/building-a-room-from-a-picture.md §2.

import { RoomData, decodeRoom } from './room';
import { MAX_ROOMS } from './rom';
import { metatileTable } from './metatiles';

/** One observed pairing, with how many grid cells attest to it. */
export interface Attestation<T> {
    value: T;
    /** Placements — grid cells, not dictionary entries. */
    uses: number;
}

export interface VanillaIndex {
    /** Graphic id -> the families it is drawn in, most-placed first. */
    families: Map<number, Attestation<number>[]>;
    /** Family id -> the graphics drawn in it, most-placed first. */
    graphics: Map<number, Attestation<number>[]>;
    /** Family id -> the rooms that list it. */
    rooms: Map<number, number[]>;
    /** Graphic id -> the rooms that draw it, ascending. */
    graphicRooms: Map<number, number[]>;
    /**
     * Graphic id -> how often it is drawn on each layer.
     *
     * A graphic with transparent pixels is usually canopy art — it is
     * meant to have something show through it — but "usually" is a
     * measurement, not a rule, so this counts instead of guessing.
     */
    layers: Map<number, { canopy: number; terrain: number }>;
    /** Terrain graphic id -> the collision words used with it. */
    collisions: Map<number, Attestation<number>[]>;
    /** How many rooms went into the index. */
    roomCount: number;
    /** Total placements counted. */
    placements: number;
}

/**
 * Map a SNES character index to a Block 1 slot.
 *
 * Duplicated from render.ts rather than exported from it, because importing
 * the renderer here would drag CHR decompression into a module that only
 * counts numbers. Two lines, one comment, no pixel work.
 */
function charIndexToSlot(charIdx: number): number {
    return Math.floor(charIdx / 0x20) * 8 + Math.floor((charIdx % 0x20) / 2);
}

/** Bump `key`'s tally for `value` in a nested count map. */
function tally(into: Map<number, Map<number, number>>, key: number, value: number, n: number): void {
    let inner = into.get(key);
    if (!inner) {
        inner = new Map();
        into.set(key, inner);
    }
    inner.set(value, (inner.get(value) || 0) + n);
}

/** Nested counts -> attestation lists, most-placed first. */
function rank(counts: Map<number, Map<number, number>>): Map<number, Attestation<number>[]> {
    const out = new Map<number, Attestation<number>[]>();
    for (const [key, inner] of counts) {
        const list = [...inner].map(([value, uses]) => ({ value, uses }));
        list.sort((a, b) => b.uses - a.uses || a.value - b.value);
        out.set(key, list);
    }
    return out;
}

/**
 * Walk every vanilla room and count what it draws.
 *
 * Only metatiles with `uses > 0` are counted. A dictionary entry the room
 * defines but never places is not evidence of anything — 7591 of the 75203
 * vanilla metatiles are exactly that, and letting them vote would make the
 * index describe the ROM's leftovers rather than its rooms.
 */
export function buildVanillaIndex(rom: Uint8Array): VanillaIndex {
    const famCounts = new Map<number, Map<number, number>>();   // graphic -> family
    const gfxCounts = new Map<number, Map<number, number>>();   // family  -> graphic
    const collCounts = new Map<number, Map<number, number>>();  // graphic -> collision
    const rooms = new Map<number, number[]>();
    const graphicRooms = new Map<number, Set<number>>();
    const layers = new Map<number, { canopy: number; terrain: number }>();
    let roomCount = 0;
    let placements = 0;

    for (let id = 0; id < MAX_ROOMS; id++) {
        let room: RoomData;
        try {
            room = decodeRoom(rom, id);
        } catch {
            continue; // a room that will not decode cannot testify
        }
        roomCount += 1;
        const tileIds = room.tilePalette.concat(room.animatedTiles);
        const fams = room.tileFamilies;
        for (const fam of fams) {
            const list = rooms.get(fam);
            if (list) list.push(id);
            else rooms.set(fam, [id]);
        }

        for (const m of metatileTable(room)) {
            if (!m.uses) continue;
            for (const [which, word] of [[0, m.layer1], [1, m.layer2]] as const) {
                const graphic = tileIds[charIndexToSlot(word & 0x3ff)];
                const pal = (word >> 10) & 0x07;
                // Palette 0 is the HUD's; a background word never selects it,
                // and `tileFamilies[-1]` is not a family.
                if (graphic === undefined || pal < 1) continue;
                const fam = fams[pal - 1];
                if (fam === undefined) continue;
                tally(famCounts, graphic, fam, m.uses);
                tally(gfxCounts, fam, graphic, m.uses);
                let seen = layers.get(graphic);
                if (!seen) { seen = { canopy: 0, terrain: 0 }; layers.set(graphic, seen); }
                if (which === 0) seen.canopy += m.uses;
                else seen.terrain += m.uses;
                const seenIn = graphicRooms.get(graphic);
                if (seenIn) seenIn.add(id);
                else graphicRooms.set(graphic, new Set([id]));
                placements += m.uses;
            }
            // Collision belongs to the stamp, but it is the *terrain* the
            // player is standing on, so that is what it is attributed to.
            const terrain = tileIds[charIndexToSlot(m.layer2 & 0x3ff)];
            if (terrain !== undefined) tally(collCounts, terrain, m.collision, m.uses);
        }
    }

    const perGraphic = new Map<number, number[]>();
    for (const [graphic, set] of graphicRooms) perGraphic.set(graphic, [...set].sort((a, b) => a - b));

    return {
        families: rank(famCounts),
        graphics: rank(gfxCounts),
        rooms,
        graphicRooms: perGraphic,
        layers,
        collisions: rank(collCounts),
        roomCount,
        placements,
    };
}

/** Graphics that appear in exactly the same set of rooms. */
export interface GraphicGroup {
    /** The rooms every graphic in this group appears in. */
    rooms: number[];
    graphics: number[];
}

/**
 * Group graphics by the rooms that draw them.
 *
 * "Which tiles are used together" is not a property the ROM stores, but it
 * falls straight out of the index: graphics that appear in exactly the same
 * rooms were put there by the same artist for the same scene. Grouping by
 * that signature turns a flat list of 157 tiles into a handful of coherent
 * sets — the wall tiles, the floor tiles, the one-off decorations.
 *
 * Groups are returned largest first, and graphics the index has never seen
 * are collected into a final group with an empty room list.
 */
export function groupByRooms(index: VanillaIndex, graphics: number[]): GraphicGroup[] {
    const bySignature = new Map<string, GraphicGroup>();
    for (const graphic of graphics) {
        const rooms = index.graphicRooms.get(graphic) || [];
        const signature = rooms.join(',');
        const group = bySignature.get(signature);
        if (group) group.graphics.push(graphic);
        else bySignature.set(signature, { rooms, graphics: [graphic] });
    }
    return [...bySignature.values()].sort(
        (a, b) => b.graphics.length - a.graphics.length || (a.rooms[0] ?? 1e9) - (b.rooms[0] ?? 1e9),
    );
}

/** A suggestion, with the evidence that produced it. */
export interface Suggestion {
    value: number;
    /** Share of this graphic's placements, 0..1. */
    confidence: number;
    uses: number;
    /** Everything observed, most-placed first — the suggestion is `[0]`. */
    alternatives: Attestation<number>[];
}

function suggest(list: Attestation<number>[] | undefined): Suggestion | null {
    if (!list || !list.length) return null;
    const total = list.reduce((n, a) => n + a.uses, 0);
    return {
        value: list[0].value,
        confidence: total ? list[0].uses / total : 0,
        uses: list[0].uses,
        alternatives: list,
    };
}

/** Which family vanilla draws this graphic in. `null` if never seen. */
export function suggestFamily(index: VanillaIndex, graphic: number): Suggestion | null {
    return suggest(index.families.get(graphic));
}

/**
 * Which layer vanilla draws this graphic on.
 *
 * `'canopy'` is the part drawn over the character, `'terrain'` the ground
 * it walks on. Returns `null` for a graphic nothing has drawn.
 */
export function preferredLayer(
    index: VanillaIndex,
    graphic: number,
): { layer: 'canopy' | 'terrain'; confidence: number; canopy: number; terrain: number } | null {
    const seen = index.layers.get(graphic);
    if (!seen) return null;
    const total = seen.canopy + seen.terrain;
    if (!total) return null;
    const canopyWins = seen.canopy > seen.terrain;
    return {
        layer: canopyWins ? 'canopy' : 'terrain',
        confidence: (canopyWins ? seen.canopy : seen.terrain) / total,
        canopy: seen.canopy,
        terrain: seen.terrain,
    };
}

/** Which collision word vanilla puts under this terrain graphic. */
export function suggestCollision(index: VanillaIndex, graphic: number): Suggestion | null {
    return suggest(index.collisions.get(graphic));
}

/**
 * Every graphic attested in any of these families.
 *
 * This is what a family picker turns into a filtered tile list: choose the
 * seven, get the vocabulary. Room 0x34's set yields 157 graphics, against
 * ~264 loadable slots — the family choice, not the slot budget, is what
 * limits a room in practice.
 */
export function graphicsForFamilies(index: VanillaIndex, families: number[]): number[] {
    const seen = new Set<number>();
    for (const fam of families) {
        for (const a of index.graphics.get(fam) || []) seen.add(a.value);
    }
    return [...seen].sort((a, b) => a - b);
}

/**
 * The most-placed graphics of a family — a preview strip for a picker.
 *
 * Ordered by placements rather than id, because the point is "what does
 * this family look like in practice", and the first eight by id are as
 * likely to be corner pieces as anything recognisable.
 */
export function familyExamples(index: VanillaIndex, family: number, limit = 8): number[] {
    return (index.graphics.get(family) || []).slice(0, limit).map((a) => a.value);
}
