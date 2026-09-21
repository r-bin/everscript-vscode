'use strict';
// Ownership: what a deco entry looks like, with nothing behind it.
//
// The first version cropped the thumbnail out of a render of the room the
// object lives in, so every gourd came with a patch of that room's floor.
// That is the opposite of what a widget library is for: the picture has to
// be the thing, not the place.
//
// So an entry is rendered on its own. Its graphics and families are packed
// into a synthetic room exactly `w x h` metatiles in size, the cells the
// entry does not draw are given a graphic with no opaque pixels, and the
// composite is taken over a transparent backdrop. What comes out is the
// object with a hole where the floor used to be — which is also what the
// stamp does.
//
// See docs/map-format/building-a-room-from-a-picture.md §9.

const maps = require('../../maps');
const { buildDecoCatalogue } = require('./deco-catalogue');

/** Thumbnails per row in the preview sheet. */
const PREVIEW_COLUMNS = 6;
/** Thumbnail cell, in pixels — three metatiles at 1:1, six at half size. */
const PREVIEW_CELL = 48;
/** One page of the picker; past this a sheet is slower than it is useful. */
const MAX_PREVIEWS = 48;

/**
 * A graphic that draws nothing, used for the cells an entry leaves open.
 *
 * Room 0x04 slot 0 is one — 256 pixels, every one colour index 0 — and it
 * is the fallback when the entry's own room has none to borrow.
 */
const EMPTY_GRAPHIC = 489;

function emptyGraphicFor(rom, room) {
    for (const id of room.tilePalette) {
        try {
            if (!maps.decodeTilePixels(maps.decompressTile16x16(rom, id)).some((p) => p !== 0)) return id;
        } catch { /* a graphic that will not decode is not a blank one */ }
    }
    return EMPTY_GRAPHIC;
}

/**
 * Pack an entry into a room of its own size.
 *
 * Slot 0 is the blank, so an undrawn layer is `tileSlotChr(0)` with any
 * palette; the entry's graphics follow, and its families take palette slots
 * 1..n in order. The word is rebuilt here rather than copied, which is the
 * same rebuild the editor does when stamping — if the two ever disagree the
 * preview is lying.
 */
function entryRoom(rom, entry, base) {
    const blank = emptyGraphicFor(rom, base);
    const graphics = [blank].concat(entry.graphics);
    const slotOfGraphic = new Map(entry.graphics.map((g, i) => [g, i + 1]));
    const palOfFamily = new Map(entry.families.map((f, i) => [f, i + 1]));
    const blankWord = maps.tileSlotChr(0) | (1 << 10);

    const word = (part) => (part
        ? (maps.tileSlotChr(slotOfGraphic.get(part.graphic))
            | (palOfFamily.get(part.family) << 10) | part.flags) & 0xffff
        : blankWord);

    const l1 = [];
    const l2 = [];
    for (let y = 0; y < entry.h; y += 1) {
        l1.push(new Array(entry.w).fill(blankWord));
        l2.push(new Array(entry.w).fill(blankWord));
    }
    for (const c of entry.cells) {
        l1[c.dy][c.dx] = word(c.canopy);
        l2[c.dy][c.dx] = word(c.terrain);
    }

    return {
        ...base,
        header: { ...base.header, widthTiles: entry.w, heightTiles: entry.h },
        tileFamilies: entry.families.length ? entry.families : base.tileFamilies.slice(0, 1),
        tilePalette: graphics,
        animatedTiles: [],
        layer1VramWords: l1,
        layer2VramWords: l2,
    };
}

/** The largest power of two that fits `w x h` pixels inside one cell. */
function shrinkFactor(w, h) {
    let n = 1;
    while (w / n > PREVIEW_CELL || h / n > PREVIEW_CELL) n *= 2;
    return n;
}

/** Copy `src` into `sheet` at (ox, oy), taking every `n`th pixel. */
function blitScaled(sheet, src, ox, oy, n) {
    const w = Math.floor(src.width / n);
    const h = Math.floor(src.height / n);
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const si = ((y * n) * src.width + x * n) * 4;
            const di = ((oy + y) * sheet.width + ox + x) * 4;
            sheet.data[di] = src.data[si];
            sheet.data[di + 1] = src.data[si + 1];
            sheet.data[di + 2] = src.data[si + 2];
            sheet.data[di + 3] = src.data[si + 3];
        }
    }
}

/**
 * Thumbnails for a page of the catalogue, several to one image.
 *
 * Transparent where the entry draws nothing, so the picker's checkerboard
 * shows through and "what is this object" and "what will it cover" are the
 * same question.
 */
function buildDecoPreviews(rom, ids) {
    const buf = rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    const catalogue = buildDecoCatalogue(buf);
    const want = (ids || []).map(Number).filter((n) => !isNaN(n)).slice(0, MAX_PREVIEWS);

    const columns = PREVIEW_COLUMNS;
    const rows = Math.max(1, Math.ceil(want.length / columns));
    const width = columns * PREVIEW_CELL;
    const height = rows * PREVIEW_CELL;
    const sheet = { width, height, data: new Uint8Array(width * height * 4) };

    // One decode per source room, reused by every entry that came from it.
    const bases = new Map();
    want.forEach((id, i) => {
        const entry = catalogue.find((d) => d.id === id);
        if (!entry) return;
        let base = bases.get(entry.room);
        if (!base) {
            try { base = maps.decodeRoom(buf, entry.room); } catch { return; }
            bases.set(entry.room, base);
        }
        let image;
        try {
            image = maps.renderRoomComposite(buf, entryRoom(buf, entry, base), { backdrop: [0, 0, 0, 0] });
        } catch { return; }

        const n = shrinkFactor(image.width, image.height);
        const ox = (i % columns) * PREVIEW_CELL + Math.floor((PREVIEW_CELL - image.width / n) / 2);
        const oy = Math.floor(i / columns) * PREVIEW_CELL + Math.floor((PREVIEW_CELL - image.height / n) / 2);
        blitScaled(sheet, image, ox, oy, n);
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

module.exports = { buildDecoPreviews, entryRoom };
