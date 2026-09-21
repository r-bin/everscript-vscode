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
const { vanillaIndex } = require('./vanilla-index');

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
        budget: maps.roomBudget(room),
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
        slots: ids.map((id, i) => [i, maps.tileSlotChr(i), id, attested[i].uses]),
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

function invalidateRoomDrafts() { SHEETS.clear(); }

module.exports = { buildBlankRoom, buildFamilySheet, groupRoomGraphics, invalidateRoomDrafts };
