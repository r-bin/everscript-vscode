'use strict';
// Ownership: the frames of animated stamps, for the editor's map canvas.
//
// A stamp's words name Block 1 *slots*; in the game a Section 2 channel
// swaps the graphic in a slot on a timer (docs/map-format/map_animated_tiles.md).
// A torch painted in the editor names the torch's frame-0 graphic, so it is
// drawn as that one still picture unless the other frames are rendered too.
// This renders them the way the game shows them: the same stamps, with each
// animated slot holding the frame it would hold at step k.
//
// Which *slots* animate is said, never guessed from the graphic: a draft
// sends its channels (the Animation tab, map-editor-animations.js), and a
// ROM room's are its own Section 2 channels. A graphic vanilla animates
// elsewhere but placed here as a still frame stays still — that was the
// "frame 2/3 still plays" bug. One stamp is timed by its first animated
// word; a second animated word on the same stamp steps along with it.
//
// Pure apart from the vanilla index cache. Consumes src/maps.

const maps = require('../../maps');
const { vanillaIndex } = require('./vanilla-index'); // animationFor, for callers that still ask by graphic

/** A guard against a runaway cycle; vanilla's longest (room 0x25) has 24 frames. */
const MAX_STEPS = 32;

/** Block 1 slot a tilemap word draws. */
function wordSlot(word) {
    const chr = word & 0x3ff;
    return (chr >> 5) * 8 + ((chr & 0x1f) >> 1);
}

/** `{frames, delays, at}` of the animation a graphic is part of, or null. */
function animationFor(index, graphic) {
    const a = index.animations.byFirst.get(graphic);
    if (a) return { frames: a.frames, delays: a.delays, at: 0 };
    const f = index.animations.frameOf.get(graphic);
    const b = f && index.animations.byFirst.get(f.first);
    return b ? { frames: b.frames, delays: b.delays, at: f.index } : null;
}

/**
 * The later frames of every animated stamp in `entries`.
 *
 * Returns null when none animates. Otherwise `{sheets, columns, cell,
 * entries}`: `sheets[k-1]` is an atlas of the animated stamps at step k, and
 * each row of `entries` is `[stampIndex, delays]` — the stamp is cell
 * `row` of every sheet, frame 0 is its own swatch, and `delays` (60 Hz ticks)
 * has one per frame, so its length is the frame count.
 *
 * @param {Uint8Array} rom
 * @param {object} room  the room the stamps are rendered against
 * @param {Array<{layer1:number,layer2:number,collision:number}>} entries
 * @param {{columns:number, layer:string}} opts
 */
function buildStampAnimations(rom, room, entries, opts) {
    const bySlot = new Map();
    const given = new Map();
    if (Array.isArray(opts.channels)) {
        for (const c of opts.channels) {
            if (c && Array.isArray(c.frames) && c.frames.length > 1) {
                given.set(Number(c.slot), { frames: c.frames.map(Number), delays: (c.delays || []).map(Number), at: 0 });
            }
        }
    } else {
        const base = room.tilePalette.length;
        (room.animation || []).forEach((ch, i) => {
            if (ch.frames.length > 1) {
                given.set(base + i, { frames: ch.frames.map((f) => f.tileId), delays: ch.frames.map((f) => f.delay), at: 0 });
            }
        });
    }
    const slotAnim = (slot) => {
        if (!bySlot.has(slot)) bySlot.set(slot, given.get(slot) || null);
        return bySlot.get(slot);
    };

    const animated = [];
    entries.forEach((e, i) => {
        const slots = [wordSlot(e.layer1), wordSlot(e.layer2)].filter((s) => slotAnim(s));
        if (!slots.length) return;
        const lead = slotAnim(slots[0]);
        const n = Math.min(MAX_STEPS, lead.frames.length);
        const delays = [];
        for (let k = 0; k < n; k++) delays.push(lead.delays[(lead.at + k) % lead.frames.length] || 1);
        animated.push({ i, e, n, delays });
    });
    if (!animated.length) return null;

    const steps = animated.reduce((m, a) => Math.max(m, a.n), 0);
    const list = animated.map((a) => a.e);
    const sheets = [];
    let atlas = null;
    for (let k = 1; k < steps; k++) {
        const tilePalette = room.tilePalette.slice();
        const animatedTiles = room.animatedTiles.slice();
        for (const [slot, a] of bySlot) {
            if (!a) continue;
            const g = a.frames[(a.at + k) % a.frames.length];
            if (slot < tilePalette.length) tilePalette[slot] = g;
            else animatedTiles[slot - tilePalette.length] = g;
        }
        const staged = maps.withMetatiles({ ...room, tilePalette, animatedTiles }, list);
        atlas = maps.renderMetatileAtlas(rom, staged, { columns: opts.columns, layer: opts.layer });
        sheets.push({
            imageUri: maps.encodePngDataUri(atlas.image),
            imageWidth: atlas.image.width,
            imageHeight: atlas.image.height,
        });
    }
    return {
        sheets,
        columns: atlas ? atlas.columns : opts.columns,
        cell: atlas ? atlas.cell : 16,
        entries: animated.map((a) => [a.i, a.delays]),
    };
}

module.exports = { buildStampAnimations, wordSlot, animationFor };
