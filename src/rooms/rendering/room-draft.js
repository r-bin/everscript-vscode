'use strict';
// Ownership: rooms that are not in the ROM — a blank draft to build on, and
// the per-family tile sheets the family picker shows.
//
// Both answer the same need: the editor has to render art the current room
// does not contain. A blank room borrows a real room's graphics list so its
// words resolve (rule 7.1); a family sheet synthesises a room whose only
// family is the one being previewed, so palette 1 is it.
//
// See docs/map-format/building-a-room-from-a-picture.md §5.

const maps = require('../../maps');
const { romFingerprint } = require('./rom-fingerprint');
const { vanillaIndex, budgetSummary } = require('./vanilla-index');
const { VANILLA_ROOMS } = require('../data/vanilla-data');

/** Tiles per sheet row, matching the metatile atlas. */
const COLUMNS = 16;

/** A family sheet is a browsing aid; past this it is a scrolling hazard. */
const MAX_FAMILY_TILES = 128;

const SHEETS = new Map();
const SHEETS_MAX = 24;

/**
 * A room that does not exist yet, rendered and packaged like a real one.
 *
 * Returns the same shape the Rooms tab already knows how to draw, plus the
 * problems `roomProblems` found, so a draft that could not be encoded says
 * so before the user invests in it.
 */
function buildBlankRoom(rom, opts) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const room = maps.blankRoom(buf, {
        widthTiles: Number(opts.widthTiles) || 16,
        heightTiles: Number(opts.heightTiles) || 12,
        borrowFrom: Number(opts.borrowFrom) || 0x76,
    });
    const image = maps.renderRoomComposite(buf, room);
    return {
        borrowedFrom: Number(opts.borrowFrom) || 0x76,
        widthTiles: room.header.widthTiles,
        heightTiles: room.header.heightTiles,
        imageUri: maps.encodePngDataUri(image),
        imageWidth: image.width,
        imageHeight: image.height,
        tileFamilies: room.tileFamilies,
        baseMetatile: room.baseMetatile,
        floor: {
            layer1: room.metatileSlices.layer1[0],
            layer2: room.metatileSlices.layer2[0],
            collision: room.metatileSlices.collision[0],
        },
        // budgetSummary, not roomBudget: the meter shows `attested` too, and
        // a budget without it renders "attested undefined".
        budget: budgetSummary(buf, room),
        problems: maps.roomProblems(room),
    };
}

/**
 * Every graphic vanilla has drawn in this family, as one sheet.
 *
 * The synthetic room lists the family first, so a word with palette 1 draws
 * in it. `borrowFrom` supplies the display registers and nothing else —
 * a single-layer render needs no compositing decisions, but the renderer
 * still reads a header.
 */
function buildFamilySheet(rom, familyId, borrowFrom) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const family = Number(familyId);
    const borrow = Number(borrowFrom) || 0x76;
    const key = `${romFingerprint(buf)}:${family}:${borrow}`;
    const hit = SHEETS.get(key);
    if (hit) return hit;

    const index = vanillaIndex(buf);
    const attested = (index.graphics.get(family) || []).slice(0, MAX_FAMILY_TILES);
    const base = maps.decodeRoom(buf, borrow);
    const ids = attested.map((a) => a.value);

    const out = {
        family,
        count: ids.length,
        // How many rooms list this family at all — the picker shows it so a
        // one-room family reads as the specialist it is.
        roomCount: (index.rooms.get(family) || []).length,
        total: (index.graphics.get(family) || []).length,
        columns: COLUMNS,
        cell: 16,
        // [slot, chr, graphicId, placements, canopyUses, terrainUses] — the
        // last two let the editor put a tile on the layer vanilla uses it on.
        slots: ids.map((id, i) => {
            const seen = index.layers.get(id) || { canopy: 0, terrain: 0 };
            return [i, maps.tileSlotChr(i), id, attested[i].uses, seen.canopy, seen.terrain];
        }),
        imageUri: null,
        imageWidth: 0,
        imageHeight: 0,
    };

    if (ids.length) {
        const sheetRoom = { ...base, tileFamilies: [family], tilePalette: ids, animatedTiles: [] };
        const atlas = maps.renderTileListAtlas(buf, sheetRoom, { columns: COLUMNS, palette: 1 });
        out.imageUri = maps.encodePngDataUri(atlas.image);
        out.imageWidth = atlas.image.width;
        out.imageHeight = atlas.image.height;
        out.rows = atlas.rows;
    }

    SHEETS.set(key, out);
    if (SHEETS.size > SHEETS_MAX) SHEETS.delete(SHEETS.keys().next().value);
    return out;
}

/**
 * The room's own graphics, grouped by which rooms draw them together.
 *
 * A flat list of 92 tiles says nothing about which belong together; the
 * index's room signature does, because graphics that appear in exactly the
 * same rooms were put there for the same scene. Slots are given as indices
 * into the room's tile list so the caller can reuse the sheet it already
 * has.
 */
function groupRoomGraphics(rom, room) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const index = vanillaIndex(buf);
    const ids = room.tilePalette.concat(room.animatedTiles);
    const slotOf = new Map();
    ids.forEach((id, i) => { if (!slotOf.has(id)) slotOf.set(id, i); });

    return maps.groupByRooms(index, ids).map((g) => ({
        rooms: g.rooms,
        slots: g.graphics.map((id) => slotOf.get(id)).filter((s) => s !== undefined),
    })).filter((g) => g.slots.length);
}

/** Room id -> `{ area, name }`, from the tab's own vanilla room list. */
let ROOM_NAMES = null;
function roomNames() {
    if (ROOM_NAMES) return ROOM_NAMES;
    ROOM_NAMES = new Map();
    for (const { area, rooms } of VANILLA_ROOMS) {
        for (const r of rooms) ROOM_NAMES.set(parseInt(r.id, 16), { area, name: r.name });
    }
    return ROOM_NAMES;
}

/**
 * Every tile family the ROM attests, with what it is *for*.
 *
 * A family id is a terrible name — "220" says nothing about whether it is
 * jungle, stone or ice. What makes it choosable is where the game uses it,
 * so each entry carries the acts and the room names too.
 *
 * `{ id, tiles, rooms, areas, names }`, biggest first. 329 families have at
 * least one graphic drawn in them (365 are listed by some room).
 */
function buildFamilyCatalogue(rom) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const index = vanillaIndex(buf);
    const names = roomNames();
    const out = [];
    for (const [family, list] of index.graphics) {
        const ids = index.rooms.get(family) || [];
        const areas = [];
        const roomLabels = [];
        for (const id of ids) {
            const info = names.get(id);
            if (!info) continue;
            if (areas.indexOf(info.area) < 0) areas.push(info.area);
            roomLabels.push(info.name);
        }
        out.push({
            id: family,
            tiles: list.length,
            rooms: ids.length,
            areas,
            // Enough to recognise the place; the full list is in the tooltip.
            names: roomLabels.slice(0, 6),
        });
    }
    out.sort((a, b) => b.tiles - a.tiles || a.id - b.id);
    return out;
}

/** Tiles shown per family in the picker's preview strip. */
const PREVIEW_TILES = 8;
/** Tiles on a family *chip* — just enough to recognise what it is. */
const CHIP_TILES = 2;

/**
 * A strip of each family's art, several families to one image.
 *
 * The picker has to show what a family *looks like* before it is chosen,
 * and one request per family would be dozens of round trips. Each family is
 * rendered on its own — seven CGRAM slots cannot hold twelve families at
 * once — and the single-row results are blitted into one sheet, one row per
 * family, in the order asked for.
 */
function buildFamilyPreviews(rom, familyIds, tilesPerFamily) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const index = vanillaIndex(buf);
    const columns = Math.max(1, Math.min(PREVIEW_TILES, Number(tilesPerFamily) || PREVIEW_TILES));
    // A chip is two tiles, so the whole 329-family catalogue fits one sheet;
    // a preview row is eight, and past 40 of those it is a scroll hazard.
    const cap = columns <= CHIP_TILES ? 400 : 40;
    const ids = (familyIds || []).map(Number).filter((n) => !isNaN(n)).slice(0, cap);
    const width = columns * 16;
    const height = Math.max(1, ids.length) * 16;
    const sheet = { width, height, data: new Uint8Array(width * height * 4) };
    const base = maps.decodeRoom(buf, 0x76);

    ids.forEach((family, row) => {
        const tiles = (index.graphics.get(family) || []).slice(0, columns).map((a) => a.value);
        if (!tiles.length) return;
        const strip = maps.renderTileListAtlas(
            buf,
            { ...base, tileFamilies: [family], tilePalette: tiles, animatedTiles: [] },
            { columns, palette: 1 },
        );
        blit(sheet, strip.image, 0, row * 16);
    });

    return {
        families: ids,
        columns,
        cell: 16,
        imageUri: maps.encodePngDataUri(sheet),
        imageWidth: width,
        imageHeight: height,
    };
}

/** Copy `src` into `dst` at (x, y). Both are RGBA PixelBuffers. */
function blit(dst, src, x, y) {
    const rows = Math.min(src.height, dst.height - y);
    const cols = Math.min(src.width, dst.width - x);
    for (let r = 0; r < rows; r++) {
        const from = r * src.width * 4;
        const to = ((y + r) * dst.width + x) * 4;
        dst.data.set(src.data.subarray(from, from + cols * 4), to);
    }
}

function invalidateRoomDrafts() { SHEETS.clear(); }

module.exports = {
    buildBlankRoom, buildFamilySheet, buildFamilyCatalogue, buildFamilyPreviews,
    groupRoomGraphics, invalidateRoomDrafts,
};
