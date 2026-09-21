// Ownership: the room's metatile dictionary as a *palette* — the set of
// 16x16 stamps a map editor can actually place, and pictures of them. Pure.
//
// A room's grid does not store graphics. Every cell is a metatile id, and
// Block 3 turns that id into three parallel words: the Layer 1 (canopy)
// tilemap word, the Layer 2 (terrain) one, and the collision word. So the
// dictionary *is* the brush set: `metatileCount` entries, 2 to 2131 of them
// per room, and nothing outside it can be placed without extending it.
//
// See docs/map-format/map_editor_ui.md.

import { RoomData } from './room';
import { PixelBuffer, renderRoomComposite, renderVramLayer } from './render';

/** One entry of the room's metatile dictionary. */
export interface MetatileInfo {
    /** Position in the dictionary, 0..metatileCount-1. */
    index: number;
    /** The WRAM offset the grid stores: `baseMetatile + index * 8`. */
    id: number;
    /** Layer 1 (canopy / BG2) tilemap word. */
    layer1: number;
    /** Layer 2 (terrain / BG1) tilemap word. */
    layer2: number;
    /** Collision word — decode with `./collision`, never by hand. */
    collision: number;
    /** How many cells of this room's grid use it. 0 means a spare slot. */
    uses: number;
}

/** Which of a metatile's two layers to draw. */
export type MetatileLayer = 'composite' | 'layer1' | 'layer2';

/** The dictionary id a grid cell's index maps to, and back. */
export function metatileId(room: RoomData, index: number): number {
    return room.baseMetatile + index * 8;
}

export function metatileIndex(room: RoomData, id: number): number {
    return Math.floor((id - room.baseMetatile) / 8);
}

/**
 * The whole dictionary, with a usage count per entry.
 *
 * Unused entries matter to an editor: across the 127 vanilla rooms 7591 of
 * the 75203 defined metatiles are never placed, and each one is a slot a
 * new combination can go into without growing Block 3.
 */
export function metatileTable(room: RoomData): MetatileInfo[] {
    const uses = new Int32Array(room.metatileCount);
    for (const row of room.layer1MetatileIds) {
        for (const id of row) {
            const i = metatileIndex(room, id);
            if (i >= 0 && i < uses.length) uses[i] += 1;
        }
    }
    const { layer1, layer2, collision } = room.metatileSlices;
    const out: MetatileInfo[] = [];
    for (let i = 0; i < room.metatileCount; i++) {
        out.push({
            index: i,
            id: metatileId(room, i),
            layer1: layer1[i] ?? 0,
            layer2: layer2[i] ?? 0,
            collision: collision[i] ?? 0,
            uses: uses[i],
        });
    }
    return out;
}

/** An atlas of every metatile in the dictionary, plus how to index into it. */
export interface MetatileAtlas {
    image: PixelBuffer;
    /** Metatiles per row. */
    columns: number;
    rows: number;
    /** Side of one cell in pixels — always 16, the metatile size. */
    cell: number;
    /** How many cells are real; the tail of the last row is padding. */
    count: number;
}

const CELL = 16;
const DEFAULT_COLUMNS = 16;

/**
 * Lay the dictionary out as a grid and render it **through the room's own
 * renderer**.
 *
 * The atlas is built as a synthetic `RoomData` whose tilemaps are the
 * dictionary itself, so `renderRoomComposite` draws it with exactly the code
 * path — palettes, priority, colour math — that draws the room. A separate
 * "just draw one tile" routine would be a second implementation of Mode 1
 * compositing, and the whole point of this domain is not to have one.
 *
 * Padding cells at the end of the last row repeat entry 0; `count` says
 * where the real entries stop, and the caller is expected not to show past
 * it.
 */
export function renderMetatileAtlas(
    rom: Uint8Array,
    room: RoomData,
    opts: { columns?: number; layer?: MetatileLayer } = {},
): MetatileAtlas {
    const columns = Math.max(1, opts.columns || DEFAULT_COLUMNS);
    const count = room.metatileCount;
    const rows = Math.max(1, Math.ceil(count / columns));
    const sheet = atlasRoom(room, columns, rows, count);

    const layer = opts.layer || 'composite';
    const image = layer === 'composite'
        ? renderRoomComposite(rom, sheet)
        : renderVramLayer(rom, sheet, layer === 'layer1' ? sheet.layer1VramWords : sheet.layer2VramWords);

    return { image, columns, rows, cell: CELL, count };
}

/**
 * A room whose grid is the dictionary, `columns` wide.
 *
 * Everything the renderer reads is copied from the real room — the tile
 * families and palette decide what the words mean, and the display
 * registers decide how the two layers combine, so both have to be the
 * room's own or the swatches would not match the map.
 */
function atlasRoom(room: RoomData, columns: number, rows: number, count: number): RoomData {
    const { layer1, layer2 } = room.metatileSlices;
    const grid = (words: number[]): number[][] => {
        const out: number[][] = [];
        for (let r = 0; r < rows; r++) {
            const row: number[] = [];
            for (let c = 0; c < columns; c++) {
                const i = r * columns + c;
                row.push(words[i < count ? i : 0] ?? 0);
            }
            out.push(row);
        }
        return out;
    };

    return {
        ...room,
        header: {
            ...room.header,
            widthTiles: columns,
            heightTiles: rows,
            widthPixels: columns * CELL,
            heightPixels: rows * CELL,
        },
        layer1VramWords: grid(layer1),
        layer2VramWords: grid(layer2),
        // Not read by the renderer, but a half-filled grid of the room's own
        // ids here would be a lie waiting to be believed.
        layer1MetatileIds: [],
        collisionWords: [],
    };
}

/** Where one metatile sits inside an atlas, in pixels. */
export function metatileCellRect(atlas: MetatileAtlas, index: number): { x: number; y: number; size: number } {
    return {
        x: (index % atlas.columns) * atlas.cell,
        y: Math.floor(index / atlas.columns) * atlas.cell,
        size: atlas.cell,
    };
}
