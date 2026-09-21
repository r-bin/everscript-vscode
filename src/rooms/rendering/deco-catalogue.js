'use strict';
// Ownership: the deco library — every distinct object vanilla places, as
// something the editor can stamp.
//
// Section 3 objects *are* the game's deco widgets. Room 0x51 is 25 gourds
// and pots; room 0x25's 4x3 objects are fire pits, lit and unlit. So the
// library does not have to be invented — it is already in the ROM, and
// this reads it out.
//
// **There are no names in the ROM.** An object is a rectangle of metatiles
// with an id, and nothing says "gourd". So entries carry their picture,
// their size, the room and act they come from, and whether they have more
// than one state — enough to find one by looking, which is how a deco
// picker is used anyway. Nothing here invents a label.
//
// See docs/map-format/building-a-room-from-a-picture.md §9.

const maps = require('../../maps');
const { romFingerprint } = require('./rom-fingerprint');
const { VANILLA_ROOMS } = require('../data/vanilla-data');

/** Below this an "object" is a doorway marker or a single tile, not deco. */
const MIN_SIZE = 2;
/** Above this it is scenery built into the room, not something to stamp. */
const MAX_SIZE = 6;
/** Thumbnails per row in the preview sheet. */
const PREVIEW_COLUMNS = 6;
/** Thumbnail cell, in pixels — two metatiles, so a 2x2 fits at 1:1. */
const PREVIEW_CELL = 48;

let CATALOGUE = null;
let CATALOGUE_KEY = '';

function roomLabels() {
    const out = new Map();
    for (const { area, rooms } of VANILLA_ROOMS) {
        for (const r of rooms) out.set(parseInt(r.id, 16), { area, name: r.name });
    }
    return out;
}

/**
 * Every distinct object vanilla places, deduplicated by what it is made of.
 *
 * Two objects with the same metatile words are the same thing placed twice
 * — room 0x51 has 25 gourds between about four actual designs — so the
 * signature is the words, and `count` says how often the game uses it.
 *
 * Cells are stored as **words**, not indices, so an entry can be stamped
 * into a room with a different dictionary.
 */
function buildDecoCatalogue(rom) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const key = romFingerprint(buf);
    if (CATALOGUE && CATALOGUE_KEY === key) return CATALOGUE;

    const labels = roomLabels();
    const bySignature = new Map();

    for (let id = 0; id < maps.MAX_ROOMS; id += 1) {
        let room;
        try { room = maps.decodeRoom(buf, id); } catch { continue; }
        const label = labels.get(id);
        const grid = room.layer1MetatileIds;
        const { layer1, layer2, collision } = room.metatileSlices;

        for (const object of room.objects) {
            const state = object.states[0];
            if (!state) continue;
            const w = state.targetWidth;
            const h = state.targetHeight;
            if (w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) continue;

            const cells = [];
            let complete = true;
            for (let y = 0; y < h && complete; y += 1) {
                for (let x = 0; x < w; x += 1) {
                    const row = grid[state.tileY + y];
                    const cellId = row && row[state.tileX + x];
                    if (cellId === undefined) { complete = false; break; }
                    const i = maps.metatileIndex(room, cellId);
                    if (i < 0 || i >= room.metatileCount) { complete = false; break; }
                    cells.push({
                        dx: x, dy: y,
                        layer1: layer1[i] ?? 0,
                        layer2: layer2[i] ?? 0,
                        collision: collision[i] ?? 0,
                    });
                }
            }
            if (!complete || !cells.length) continue;

            const signature = `${w}x${h}:` + cells.map((c) => `${c.layer1},${c.layer2},${c.collision}`).join('|');
            const hit = bySignature.get(signature);
            if (hit) { hit.count += 1; continue; }

            bySignature.set(signature, {
                id: bySignature.size,
                room: id,
                area: label ? label.area : 'unknown',
                roomName: label ? label.name : `room 0x${id.toString(16)}`,
                // Where it sits in its own room, so a preview can crop it.
                x: state.tileX,
                y: state.tileY,
                w,
                h,
                /** More than one state means it opens, breaks or burns. */
                states: object.states.length,
                count: 1,
                cells,
            });
        }
    }

    CATALOGUE = [...bySignature.values()].sort((a, b) => b.count - a.count || a.id - b.id);
    CATALOGUE_KEY = key;
    return CATALOGUE;
}

/** The catalogue without the cell words — small enough to send whole. */
function decoIndex(rom) {
    return buildDecoCatalogue(rom).map((d) => ({
        id: d.id, area: d.area, roomName: d.roomName, room: d.room,
        w: d.w, h: d.h, states: d.states, count: d.count,
    }));
}

/** One entry's cells, for stamping. */
function decoCells(rom, id) {
    const hit = buildDecoCatalogue(rom).find((d) => d.id === Number(id));
    return hit ? { id: hit.id, w: hit.w, h: hit.h, states: hit.states, cells: hit.cells } : null;
}

/**
 * Thumbnails for a page of the catalogue, several to one image.
 *
 * Each entry is cropped out of a render of the room it lives in, so the
 * picture is exactly what the game draws — including the floor behind it,
 * which is the only way a gourd reads as a gourd rather than a silhouette.
 */
function buildDecoPreviews(rom, ids) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const catalogue = buildDecoCatalogue(buf);
    const want = (ids || []).map(Number).filter((n) => !isNaN(n)).slice(0, 48);

    const columns = PREVIEW_COLUMNS;
    const rows = Math.max(1, Math.ceil(want.length / columns));
    const width = columns * PREVIEW_CELL;
    const height = rows * PREVIEW_CELL;
    const sheet = { width, height, data: new Uint8Array(width * height * 4) };

    // One render per room, reused by every entry that came from it.
    const renders = new Map();
    want.forEach((id, i) => {
        const entry = catalogue.find((d) => d.id === id);
        if (!entry) return;
        let image = renders.get(entry.room);
        if (!image) {
            try { image = maps.renderRoomComposite(buf, maps.decodeRoom(buf, entry.room)); }
            catch { return; }
            renders.set(entry.room, image);
        }
        const ox = (i % columns) * PREVIEW_CELL;
        const oy = Math.floor(i / columns) * PREVIEW_CELL;
        const w = Math.min(entry.w * 16, PREVIEW_CELL);
        const h = Math.min(entry.h * 16, PREVIEW_CELL);
        for (let y = 0; y < h; y += 1) {
            for (let x = 0; x < w; x += 1) {
                const sx = entry.x * 16 + x;
                const sy = entry.y * 16 + y;
                if (sx >= image.width || sy >= image.height) continue;
                const si = (sy * image.width + sx) * 4;
                const di = ((oy + y) * width + ox + x) * 4;
                sheet.data[di] = image.data[si];
                sheet.data[di + 1] = image.data[si + 1];
                sheet.data[di + 2] = image.data[si + 2];
                sheet.data[di + 3] = 255;
            }
        }
    });

    return {
        ids: want,
        columns,
        cell: PREVIEW_CELL,
        imageUri: maps.encodePngDataUri(sheet),
        imageWidth: width,
        imageHeight: height,
    };
}

function invalidateDecoCatalogue() { CATALOGUE = null; CATALOGUE_KEY = ''; }

module.exports = { decoIndex, decoCells, buildDecoPreviews, invalidateDecoCatalogue };
