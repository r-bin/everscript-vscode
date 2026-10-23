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
// Pure apart from the vanilla index cache. Consumes src/games/evermore/maps.

import * as maps from '../../maps';
import { vanillaIndex } from './vanilla-index'; // animationFor, for callers that still ask by graphic
import type { RoomData, MetatileDraft, MetatileLayer } from '../../maps';

type VanillaIndex = ReturnType<typeof vanillaIndex>;
interface Anim { frames: number[]; delays: number[]; at: number }
interface Channel { slot: number; frames: unknown[]; delays?: unknown[] }

/** A guard against a runaway cycle; vanilla's longest (room 0x25) has 24 frames. */
const MAX_STEPS = 32;

/** Block 1 slot a tilemap word draws. */
function wordSlot(word: number) {
    const chr = word & 0x3ff;
    return (chr >> 5) * 8 + ((chr & 0x1f) >> 1);
}

/** True when any pixel of cell `cellIndex` in `step` differs from `base`. */
function cellPixelsDiffer(base: maps.PixelBuffer, step: maps.PixelBuffer, cellIndex: number, columns: number, cell: number): boolean {
    const cx = (cellIndex % columns) * cell;
    const cy = Math.floor(cellIndex / columns) * cell;
    const w = base.width;
    for (let dy = 0; dy < cell; dy++) {
        const rowOff = ((cy + dy) * w + cx) * 4;
        for (let b = 0; b < cell * 4; b++) {
            if (base.data[rowOff + b] !== step.data[rowOff + b]) return true;
        }
    }
    return false;
}

/** `{frames, delays, at}` of the animation a graphic is part of, or null. */
function animationFor(index: VanillaIndex, graphic: number): Anim | null {
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
function buildStampAnimations(rom: Uint8Array, room: RoomData, entries: MetatileDraft[],
    opts: { columns?: number; layer?: MetatileLayer; channels?: Channel[] }) {
    const bySlot = new Map<number, Anim | null>();
    const given = new Map<number, Anim>();
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
    const slotAnim = (slot: number): Anim | null => {
        if (!bySlot.has(slot)) bySlot.set(slot, given.get(slot) || null);
        return bySlot.get(slot)!;
    };

    const palCycles = (room.paletteCycles || []).filter(
        (c) => c.paletteIndex >= 1 && c.paletteIndex <= 7 && c.span > 1 && c.rate !== 0,
    );
    const blankCanopy = maps.emptyStamp(room).layer1;
    const allGraphics = room.tilePalette.concat(room.animatedTiles);
    const matchWordCycle = (word: number, isLayer1: boolean) => {
        if (isLayer1 && word === blankCanopy) return null;
        const pal = (word >> 10) & 7;
        const graphic = allGraphics[wordSlot(word)];
        if (graphic === undefined) return null;
        const tMask = maps.tileColorMask(rom, graphic);
        return palCycles.find((c) => c.paletteIndex === pal && (tMask & maps.paletteCycleMask(c)) !== 0) || null;
    };

    const candidates: { i: number; e: MetatileDraft; n: number; delays: number[] }[] = [];
    entries.forEach((e, i) => {
        const slots = [wordSlot(e.layer1), wordSlot(e.layer2)].filter((s) => slotAnim(s));
        const matchedCycle = matchWordCycle(e.layer1, true) || matchWordCycle(e.layer2, false);
        if (!slots.length && !matchedCycle) return;

        let n = 0;
        const delays: number[] = [];
        if (slots.length) {
            const lead = slotAnim(slots[0])!;
            n = Math.min(MAX_STEPS, lead.frames.length);
            for (let k = 0; k < n; k++) delays.push(lead.delays[(lead.at + k) % lead.frames.length] || 1);
        } else if (matchedCycle) {
            n = Math.min(MAX_STEPS, matchedCycle.span);
            const d = Math.max(1, Math.abs(matchedCycle.rate)) * 3;
            for (let k = 0; k < n; k++) delays.push(d);
        }
        if (n > 1) candidates.push({ i, e, n, delays });
    });
    if (!candidates.length) return null;

    const renderStepAtlas = (stampList: MetatileDraft[], k: number) => {
        const tilePalette = room.tilePalette.slice();
        const animatedTiles = room.animatedTiles.slice();
        for (const [slot, a] of bySlot) {
            if (!a) continue;
            const g = a.frames[(a.at + k) % a.frames.length];
            if (slot < tilePalette.length) tilePalette[slot] = g;
            else animatedTiles[slot - tilePalette.length] = g;
        }

        const cgramPalettes = palCycles.length && k > 0
            ? maps.shiftCgramPalettes(rom, room.tileFamilies, palCycles, k)
            : undefined;

        const staged = maps.withMetatiles(
            { ...room, tilePalette, animatedTiles, ...(cgramPalettes ? { cgramPalettes } : {}) },
            stampList,
        );
        return maps.renderMetatileAtlas(rom, staged, { columns: opts.columns, layer: opts.layer });
    };

    const candidateSteps = candidates.reduce((m, a) => Math.max(m, a.n), 0);
    const candidateList = candidates.map((a) => a.e);
    const baseAtlas = renderStepAtlas(candidateList, 0);
    const rawStepAtlases: (typeof baseAtlas)[] = [];
    for (let k = 1; k < candidateSteps; k++) {
        rawStepAtlases.push(renderStepAtlas(candidateList, k));
    }

    // Drop any candidate whose composited pixels are identical across all frames
    // (e.g. a palette-cycling terrain tile completely covered by an opaque canopy wall,
    // or a tile whose visible pixels only use duplicate colours in the cycle).
    const animated = candidates.filter((a, cIdx) => {
        for (let k = 1; k < a.n; k++) {
            const stepAtlas = rawStepAtlases[k - 1];
            if (stepAtlas && cellPixelsDiffer(baseAtlas.image, stepAtlas.image, cIdx, baseAtlas.columns, baseAtlas.cell)) {
                return true;
            }
        }
        return false;
    });
    if (!animated.length) return null;

    const steps = animated.reduce((m, a) => Math.max(m, a.n), 0);
    const list = animated.map((a) => a.e);
    const sheets = [];
    let atlas = null;
    for (let k = 1; k < steps; k++) {
        atlas = animated.length === candidates.length ? rawStepAtlases[k - 1] : renderStepAtlas(list, k);
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

export { buildStampAnimations, wordSlot, animationFor };
