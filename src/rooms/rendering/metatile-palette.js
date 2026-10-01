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
const { headerSpec, withHeader } = require('./header-overrides');
const { annotateGraphics, budgetSummary, invalidateVanillaIndex } = require('./vanilla-index');
const { groupRoomGraphics } = require('./room-draft');
const { buildStampAnimations } = require('./stamp-animation');
const { editorObjects } = require('./object-previews');

/** Metatiles per atlas row. 16 keeps the sheet narrow enough to scroll. */
const COLUMNS = 16;

/** Which renders the tab offers, matching the map's own layer switch. */
const LAYERS = ['composite', 'layer1', 'layer2'];

/** Background palettes a tile can be drawn in: CGRAM 1..7 = tile families. */
const BG_PALETTES = 7;

const CACHE = new Map();
const CACHE_MAX = 6;

/**
 * Tile sheets are cached apart from the dictionary.
 *
 * Switching the family tab changes only which palette the sheet is drawn in,
 * and rebuilding a 2131-entry metatile atlas to answer that would be seven
 * full re-renders of a room nobody asked to re-render.
 */
const TILE_CACHE = new Map();
const TILE_CACHE_MAX = 14;

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
 * A ROM trigger as the editor's `[x1, y1, x2, y2, scriptId]`: inclusive cells
 * of the map grid. The record is neither — it counts from the header's origin
 * and its far edge is exclusive (collision-overlay.ts draws `(x - originX) * 16`
 * up to `x2`). Read raw, every box sat `originX, originY` cells off and one
 * cell too big: room 0x38's gourd triggers landed out in the canopy.
 */
function mapCellBox(room, t) {
    const ox = room.header.originX;
    const oy = room.header.originY;
    const x1 = Math.min(t.x1, t.x2) - ox;
    const y1 = Math.min(t.y1, t.y2) - oy;
    return [x1, y1, Math.max(x1, Math.max(t.x1, t.x2) - ox - 1), Math.max(y1, Math.max(t.y1, t.y2) - oy - 1), t.scriptId];
}

/**
 * Everything the tab needs to draw and describe the placement palette.
 *
 * @param {Uint8Array|Buffer} rom
 * @param {number} roomId
 * @param {string} [layer] 'composite' (default), 'layer1' or 'layer2'
 */
function buildRoomMetatilePalette(rom, roomId, layer, bgPalette, header) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const which = LAYERS.indexOf(layer) >= 0 ? layer : 'composite';
    const pal = Math.min(BG_PALETTES, Math.max(1, Number(bgPalette) || 1));
    const stem = romFingerprint(buf) + ':' + roomId;
    const key = stem + ':' + which + ':' + headerSpec(header);
    const hit = CACHE.get(key);
    if (hit) return Object.assign({}, hit, { tiles: tileSheet(buf, roomId, stem, pal) });


    const room = maps.decodeRoom(buf, roomId);
    // Header overrides change how each stamp's layers composite; `header` below stays the room's own.
    const atlas = maps.renderMetatileAtlas(buf, withHeader(room, header), { columns: COLUMNS, layer: which });
    const table = maps.metatileTable(room);
    const objects = editorObjects(buf, room);

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
        /** Animated stamps' later frames, for the editor's map canvas (stamp-animation.js). */
        anim: buildStampAnimations(buf, room, table, { columns: COLUMNS, layer: which }),
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
        /** Spend against the four ceilings, and the attested vocabulary. */
        budget: budgetSummary(buf, room),
        /** What vanilla says about each loaded graphic — see annotateGraphics. */
        vanilla: annotateGraphics(buf, room),
        /** The graphics grouped by which rooms draw them together. */
        graphicGroups: groupRoomGraphics(buf, room),
        // Where the room's triggers and objects sit, in metatile cells. A
        // construct saved out of a selection has to know that a gourd comes
        // with a B-trigger and an object while a hide comes with neither —
        // the difference is only visible here.
        attachments: {
            bTrigger: room.triggers.bTrigger.map((t) => mapCellBox(room, t)),
            stepOn: room.triggers.stepOn.map((t) => mapCellBox(room, t)),
            // The whole area an object can change, not its first delta's
            // footprint — that one is often a single cell of a bigger object.
            objects: objects.map((o) => [o.x, o.y, o.w, o.h, o.index]),
        },
        /** The same objects with their states as frames, for the Object tab. */
        roomObjects: objects,
        /**
         * The room header (13 bytes at the blob's start) for the Info tab:
         * the decoded fields, plus the 16-bit parameter at bytes 9..10
         * (stored at `$0F84`) that RoomHeader does not carry.
         */
        header: Object.assign({}, room.header, { param: maps.read16(buf, room.romPointerFile + 9) }),
        /**
         * Cells of the room's own cuttable grass (Section 4), `[x, y, cutIndex]`: the
         * Cuttable chip's marks, and the stamp the swap table puts there once cut
         * (-1 when it names no dictionary entry), which the map shows with the chip off.
         */
        cuttable: room.cuttableGrass.tiles.map((t) => {
            const to = room.cuttableGrass.table.swaps.get(room.layer1MetatileIds[t[1]][t[0]]);
            const i = to === undefined ? -1 : maps.metatileIndex(room, to);
            return [t[0], t[1], i == null || i < 0 ? -1 : i];
        }),
        /** The raw graphics Block 1 put in reach — see buildTileSheet. */
        tiles: null,
    };

    CACHE.set(key, out);
    if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
    TILE_CACHE.set(stem + ':' + pal, buildTileSheet(buf, room, pal));
    return Object.assign({}, out, { tiles: TILE_CACHE.get(stem + ':' + pal) });
}

/** The room's graphics in one background palette, remembered per palette. */
function tileSheet(rom, roomId, stem, pal) {
    const key = stem + ':' + pal;
    const hit = TILE_CACHE.get(key);
    if (hit) return hit;
    const sheet = buildTileSheet(rom, maps.decodeRoom(rom, roomId), pal);
    TILE_CACHE.set(key, sheet);
    if (TILE_CACHE.size > TILE_CACHE_MAX) TILE_CACHE.delete(TILE_CACHE.keys().next().value);
    return sheet;
}

/**
 * The room's Block 1 graphics, drawn in one background palette.
 *
 * A different question from the metatile dictionary: that lists the
 * *combinations the room already defines*, this lists the **raw material** —
 * every 16x16 graphic a new metatile word is allowed to name. The room's
 * whole visual vocabulary is this list times the seven palettes.
 *
 * `slots` gives, per entry, the `chr` value a tilemap word needs in order to
 * draw it, so an editor can turn "that picture" into a word it can write.
 */
function buildTileSheet(rom, room, bgPalette) {
    const atlas = maps.renderTileListAtlas(rom, room, { columns: COLUMNS, palette: bgPalette });
    const ids = room.tilePalette.concat(room.animatedTiles);
    const slots = [];
    for (let i = 0; i < atlas.count; i++) {
        slots.push([i, maps.tileSlotChr(i), ids[i] === undefined ? 0 : ids[i], i >= room.tilePalette.length ? 1 : 0]);
    }
    return {
        imageUri: maps.encodePngDataUri(atlas.image),
        imageWidth: atlas.image.width,
        imageHeight: atlas.image.height,
        columns: atlas.columns,
        rows: atlas.rows,
        cell: atlas.cell,
        count: atlas.count,
        palette: bgPalette,
        paletteCount: BG_PALETTES,
        slots,
    };
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
function buildComposedPreview(rom, roomId, drafts, layer, extra) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const which = LAYERS.indexOf(layer) >= 0 ? layer : 'composite';
    const entries = (drafts || []).slice(0, MAX_DRAFTS).map((d) => ({
        layer1: Number(d.layer1) & 0xffff,
        layer2: Number(d.layer2) & 0xffff,
        collision: Number(d.collision) & 0xffff,
    }));
    if (!entries.length) return { roomId, layer: which, count: 0, imageUri: null };

    let room = maps.decodeRoom(buf, roomId);
    // The editor can pull in graphics Block 1 never loaded and families the
    // room never listed. A preview rendered against the room as it stands
    // would resolve those words to the wrong slot, so the draft's additions
    // are applied first — the same list the encoder would append.
    if (extra && (extra.graphics || extra.families)) {
        room = {
            ...room,
            tilePalette: room.tilePalette.concat(
                (extra.graphics || []).map(Number).filter((n) => !isNaN(n))),
            // Positional: a hole (null) stays a hole, as family 0, so the
            // families after it keep the slots their words name.
            tileFamilies: Array.isArray(extra.families) && extra.families.length
                ? extra.families.map((n) => (n === null || n === undefined || isNaN(Number(n)) ? 0 : Number(n)))
                : room.tileFamilies,
        };
    }
    const atlas = maps.renderMetatileAtlas(buf, maps.withMetatiles(withHeader(room, extra && extra.header), entries), {
        columns: COLUMNS, layer: which,
    });
    const anim = buildStampAnimations(buf, room, entries, { columns: COLUMNS, layer: which });
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
        anim,
    };
}

/** A draft list longer than this is a bug, not an edit. */
const MAX_DRAFTS = 4096;

/** Drop cached palettes (call when the ROM changes). */
function invalidateMetatilePalettes() {
    CACHE.clear();
    TILE_CACHE.clear();
    invalidateVanillaIndex();
}

module.exports = {
    buildRoomMetatilePalette, buildComposedPreview, invalidateMetatilePalettes, COLUMNS, LAYERS,
};
