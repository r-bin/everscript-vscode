'use strict';
// Ownership: the room's metatile dictionary, packaged for the Rooms tab —
// one atlas PNG plus a compact row per entry.
//
// Sent on demand, not with the room render: the worst room (0x37) has 2131
// metatiles, which is a 325 KB data URI and, as objects, 166 KB of JSON.
// Nobody pays that for a room whose tile palette they never open.
//
// Pure apart from the module-level cache. Consumes src/maps.

const maps = require('../../maps');
const { romFingerprint } = require('./rom-fingerprint');

/** Metatiles per atlas row. 16 keeps the sheet narrow enough to scroll. */
const COLUMNS = 16;

/** Which renders the tab offers, matching the map's own layer switch. */
const LAYERS = ['composite', 'layer1', 'layer2'];

const CACHE = new Map();
const CACHE_MAX = 6;

/**
 * One row per metatile, as an array rather than an object.
 *
 * `[index, layer1Word, layer2Word, collisionWord, uses]` — the id is
 * `baseMetatile + index * 8` and the webview can derive it, so sending it
 * would be 2131 redundant numbers. This is the difference between 64 KB and
 * 166 KB on the biggest room.
 */
function packEntries(table) {
    return table.map((m) => [m.index, m.layer1, m.layer2, m.collision, m.uses]);
}

/**
 * Everything the tab needs to draw and describe the placement palette.
 *
 * @param {Uint8Array|Buffer} rom
 * @param {number} roomId
 * @param {string} [layer] 'composite' (default), 'layer1' or 'layer2'
 */
function buildRoomMetatilePalette(rom, roomId, layer) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const which = LAYERS.indexOf(layer) >= 0 ? layer : 'composite';
    const key = romFingerprint(buf) + ':' + roomId + ':' + which;
    const hit = CACHE.get(key);
    if (hit) return hit;

    const room = maps.decodeRoom(buf, roomId);
    const atlas = maps.renderMetatileAtlas(buf, room, { columns: COLUMNS, layer: which });
    const table = maps.metatileTable(room);

    const out = {
        roomId,
        layer: which,
        columns: atlas.columns,
        rows: atlas.rows,
        cell: atlas.cell,
        count: atlas.count,
        baseMetatile: room.baseMetatile,
        imageUri: maps.encodePngDataUri(atlas.image),
        imageWidth: atlas.image.width,
        imageHeight: atlas.image.height,
        entries: packEntries(table),
        // The room's own grid, as dictionary indices rather than WRAM ids.
        // The editor needs it to pick a stamp off the map, to fill, and to
        // copy a region — 42 KB on the largest room (0x4b, 106x125), which
        // is cheap next to the atlas it travels with.
        grid: room.layer1MetatileIds.map(function (row) {
            return row.map(function (id) { return maps.metatileIndex(room, id); });
        }),
        widthTiles: room.header.widthTiles,
        heightTiles: room.header.heightTiles,
        // What the dictionary is made of, which is what limits it: the CHR
        // banks in VRAM and the tile ids Block 1 selected out of them.
        tileFamilies: room.tileFamilies,
        paletteCount: room.tilePalette.length,
        animatedCount: room.animatedTiles.length,
        /** Defined but never placed — a free slot for a new combination. */
        spare: table.reduce((n, m) => n + (m.uses ? 0 : 1), 0),
    };

    CACHE.set(key, out);
    if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
    return out;
}

/**
 * Swatches for metatiles an editor has composed but not written.
 *
 * Rendered against the room they are meant for, so the preview uses that
 * room's tile families, palette and display registers — a stamp previewed
 * any other way is a different picture from the one it would become.
 *
 * Not cached: a draft changes every time the user touches the composer,
 * and the atlas is a handful of cells.
 *
 * @param {Array<{layer1:number,layer2:number,collision:number}>} drafts
 */
function buildComposedPreview(rom, roomId, drafts, layer) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const which = LAYERS.indexOf(layer) >= 0 ? layer : 'composite';
    const entries = (drafts || []).slice(0, MAX_DRAFTS).map((d) => ({
        layer1: Number(d.layer1) & 0xffff,
        layer2: Number(d.layer2) & 0xffff,
        collision: Number(d.collision) & 0xffff,
    }));
    if (!entries.length) return { roomId, layer: which, count: 0, imageUri: null };

    const room = maps.decodeRoom(buf, roomId);
    const atlas = maps.renderMetatileAtlas(buf, maps.withMetatiles(room, entries), {
        columns: COLUMNS, layer: which,
    });
    return {
        roomId,
        layer: which,
        columns: atlas.columns,
        rows: atlas.rows,
        cell: atlas.cell,
        count: atlas.count,
        imageUri: maps.encodePngDataUri(atlas.image),
        imageWidth: atlas.image.width,
        imageHeight: atlas.image.height,
        entries: entries.map((e, i) => [i, e.layer1, e.layer2, e.collision, 0]),
    };
}

/** A draft list longer than this is a bug, not an edit. */
const MAX_DRAFTS = 4096;

/** Drop cached palettes (call when the ROM changes). */
function invalidateMetatilePalettes() { CACHE.clear(); }

module.exports = {
    buildRoomMetatilePalette, buildComposedPreview, invalidateMetatilePalettes, COLUMNS, LAYERS,
};
