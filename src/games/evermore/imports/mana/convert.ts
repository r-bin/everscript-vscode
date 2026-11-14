// Ownership: one Secret of Mana map rewritten in Evermore's terms, cell by cell — the
// three words of an Evermore stamp (layer 1, layer 2, collision), 16x16 graphics,
// seven tile families and step-on trigger boxes. Pure: Mana ROM bytes in, data out.
//
// What maps onto what (docs/mana/evermore-rooms.md):
//   Mana layer A (BG1)          -> layer 1 (canopy, BG1)
//   Mana layer B (BG2)          -> layer 2 (terrain, BG2), repeated over the map
//   Mana metatile (4 chars)     -> one 16x16 graphic; one palette and one priority
//                                  per cell, so a metatile that mixes them is redrawn
//                                  in its main palette (nearest colours) — counted
//   Mana BG palette 1..7        -> family m<set*8 + palette-1>; only the palettes the map
//                                  draws with, in slots 1..k
//   Mana collision (c0-c2)      -> collision.ts; step events -> bit 14 + a box
//   metatile pixels, palettes   -> graphics.ts
//   weapon-cut cells (c2 $Cn)   -> the cuttable layer; event-flag pieces -> objects
//   colour rotations, moving chars -> palette cycles, Section 2 channels (animation.ts)
// Only SNES facts are shared: both games use Mode 1 tilemap words with the same bits.

import * as mana from '../../../mana/decoder';
import { FAMILY_BASE } from './ids';
import { flagObjects } from './pieces';
import { paletteCycles, animatedMetatiles, animateTiles } from './animation';
import { collisionWord, shapeStairs } from './collision';
import { EMPTY_GRAPHIC, metatilePixels, encodeGraphic, slotChr, graphicTable, hiddenUnder, withBackdrop, backdropOpen, opaqueOver, backdropTile } from './graphics';
import type { Stats, Trace, Layer, Tile, PixelOptions } from './graphics';
import type { Rom as ManaRom } from '../../../mana/decoder';

type Box = { x1: number; y1: number; x2: number; y2: number; scriptId: number };


/** Event cells as trigger boxes: runs along a row, merged with the identical run above. */
function triggerBoxes(steps: { x: number; y: number; event: number }[]): Box[] {
    const runs: Box[] = [];
    const sorted = steps.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    for (const s of sorted) {
        const last = runs[runs.length - 1];
        if (last && last.y1 === s.y && last.x2 === s.x && last.scriptId === s.event) last.x2++;
        else runs.push({ x1: s.x, y1: s.y, x2: s.x + 1, y2: s.y + 1, scriptId: s.event });
    }
    const boxes: Box[] = [];
    for (const r of runs) {
        const above = boxes.find((b) => b.y2 === r.y1 && b.x1 === r.x1 && b.x2 === r.x2 && b.scriptId === r.scriptId);
        if (above) above.y2 = r.y2;
        else boxes.push(r);
    }
    return boxes;
}

/**
 * Convert map `id`. Returns null for an id without pieces.
 * `cells` holds three words per cell, row by row; `graphics` 128-byte Evermore graphics
 * by Block 1 slot; `families` the palettes the map draws with, by slot.
 */
function convertManaMap(manaRom: ManaRom, id: number) {
    const source = mana.loadMap(manaRom, id);
    if (!source) return null;
    const stats: Stats = { recolouredTiles: 0, recolouredPixels: 0, mixedPriority: 0, droppedGraphics: 0 };
    const graphics = graphicTable(stats);
    let trace: Trace | null = null;
    try { trace = mana.traceAnimation(manaRom, source.header); } catch { /* $01:B17E never returns on some maps ($1FF): shown still */ }
    const moving = trace ? animatedMetatiles(source, trace) : { A: new Set<number>(), B: new Set<number>() };
    const rotations = trace ? mana.paletteRotations(trace) : { rotations: [], others: [] };
    const rotating = new Set(rotations.rotations.flatMap((r) => Array.from({ length: r.count }, (_, k) => r.palette * 16 + r.first + k)));
    // The colours the room is drawn with: the animation's starting moment, Mana's backdrop in the
    // first index of each palette that no tile draws with (so filling with it is exact).
    const map = { ...source, cgram: withBackdrop(source, trace, rotating) };
    // First every metatile the map shows, so only the palettes it draws with become
    // families, packed into slots 1..k in palette order (a word names its slot).
    const tiles: Record<Layer, Map<number, Tile>> = { A: new Map(), B: new Map() };
    const hidden = hiddenUnder(map);
    // Mana's backdrop is filled into layer B's transparent pixels. When BG2 is on the sub screen a
    // filled pixel is also what BG1 blends with (map $10: TS $02, BG1 half-added), so there only
    // pixels no layer-A pixel lies over are filled, and only when neither BG2 nor the backdrop
    // takes part in colour math (then the main screen shows both unblended, the same colour).
    const subBG2 = !!(map.display.sub & 0x02);
    const fillBackdrop = !subBG2 || !(map.display.math & 0x22);
    let open = new Map<number, Uint8Array>();
    const pixelOpts = (layer: Layer, n: number): PixelOptions =>
        (layer === 'A' ? { hide: hidden.get(n) || null }
            : fillBackdrop ? { backdrop: map.display.backdrop, open: open.get(n), fillLow: !subBG2 } : {});
    const tileOf = (layer: Layer, n: number): Tile | null => {
        if (n < 0 || n >= 192) return null;
        let t = tiles[layer].get(n);
        if (!t) {
            const m = metatilePixels(map, layer === 'A' ? map.tableA : map.tableB, n, stats, rotating, pixelOpts(layer, n));
            t = { m, g: m.empty ? { slot: EMPTY_GRAPHIC, h: 0, v: 0 } : moving[layer].has(n) ? { slot: -1, h: 0, v: 0 } : graphics.place(m.px) };
            tiles[layer].set(n, t);
        }
        return t;
    };
    // What weapons change (cuttable.ts) and what event flags change (pieces.ts) are
    // tiles the map can show too.
    const cuts = mana.cuttableCells(manaRom, map);
    const flagged = flagObjects(manaRom, map);
    const pairs: Array<[number, number]> = [];                      // every (A, B) a cell can show
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) pairs.push([map.cell('A', x, y), map.cell('B', x, y)]);
    for (const c of cuts) pairs.push([c.layer === 'A' ? c.to : map.cell('A', c.x, c.y), c.layer === 'B' ? c.to : map.cell('B', c.x, c.y)]);
    for (const o of flagged) for (const f of o.frames) for (const v of Object.values(f)) pairs.push([v.A, v.B]);
    // Layer A first: where its low-priority pixels lie decides what a high-priority layer-B tile may fill.
    for (const [a] of pairs) tileOf('A', a);
    // What a layer-A tile covers: its low-priority pixels, a moving one's at any moment of the
    // trace (the fill must not cover them). When BG2 is on the sub screen: all its pixels, a moving
    // one's at every moment (a pixel the backdrop ever shows through is filled; while a grass blade
    // is over it the blade blends with that colour instead of Mana's fixed colour).
    const scratch: Stats = { recolouredTiles: 0, recolouredPixels: 0, mixedPriority: 0, droppedGraphics: 0 };
    const cover = (a: number): Uint8Array | null => {
        const t = tiles.A.get(a);
        if (!t || t.m.empty || (t.m.priority && !subBG2)) return null;
        if (t.g.slot >= 0 || !trace) return t.m.px;
        return opaqueOver(trace, a, map.tableA, subBG2, (vram) => metatilePixels(map, map.tableA, a, scratch, rotating, { ...pixelOpts('A', a), vram }).px);
    };
    const covers = new Map<number, Uint8Array | null>();
    if (fillBackdrop) open = backdropOpen(pairs, (a) => { if (!covers.has(a)) covers.set(a, cover(a)); return covers.get(a)!; });
    for (const [, b] of pairs) tileOf('B', b);
    // Where layer B shows nothing, Mana shows its backdrop: one solid graphic for it, placed
    // before the animation takes the slots after Block 1.
    const backdrop = fillBackdrop && !subBG2 ? backdropTile(map, tiles, rotating, graphics) : null;
    const anim = animateTiles(map, trace, tiles, graphics, (layer, n, vram, palette) =>
        metatilePixels(map, layer === 'A' ? map.tableA : map.tableB, n, scratch, rotating, { ...pixelOpts(layer, n), vram, main: palette }).px);
    const used = new Map<number, Set<number>>();                     // Mana palette -> graphic slots drawn in it
    for (const layer of ['A', 'B'] as Layer[]) for (const t of tiles[layer].values()) {
        if (t.m.empty) continue;
        if (!used.has(t.m.palette)) used.set(t.m.palette, new Set());
        used.get(t.m.palette)!.add(t.g.slot);
    }
    if (backdrop && !used.has(backdrop.palette)) used.set(backdrop.palette, new Set([backdrop.slot]));
    const palettes = [...used.keys()].sort((x, y) => x - y);
    if (!palettes.length) palettes.push(1);
    const slotOf = (p: number): number => palettes.indexOf(p) + 1;
    const wordFor = (layer: Layer, n: number): number => {
        const t = tileOf(layer, n);
        if (layer === 'B' && (!t || t.m.empty) && backdrop) return (slotOf(backdrop.palette) << 10) | slotChr(backdrop.slot);
        if (!t || t.m.empty) return 1 << 10;    // the empty graphic, in slot 1
        return (t.g.v << 15) | (t.g.h << 14) | (t.m.priority << 13) | (slotOf(t.m.palette) << 10) | slotChr(t.g.slot);
    };
    const events = mana.mapEvents(manaRom, map);
    const stepAt = new Set(events.steps.filter((s) => !s.bump).map((s) => s.y * map.w + s.x));
    const bumpAt = new Set(events.steps.filter((s) => s.bump).map((s) => s.y * map.w + s.x));
    // A cell's three words for layer-A metatile `a` and layer-B metatile `b`: the player
    // moves by layer A's collision, so that is the cell's collision word.
    const stamp = (x: number, y: number, a: number, b: number): number[] => {
        const c = mana.metatileCollision(manaRom, map, 'A', a);
        return [wordFor('A', a), wordFor('B', b), collisionWord(c[0], c[2], stepAt.has(y * map.w + x), c[1], bumpAt.has(y * map.w + x))];
    };
    const cells: number[] = new Array(map.w * map.h * 3);
    for (let y = 0; y < map.h; y++) {
        for (let x = 0; x < map.w; x++) {
            const i = y * map.w + x;
            const w = stamp(x, y, map.cell('A', x, y), map.cell('B', x, y));
            cells[i * 3] = w[0]; cells[i * 3 + 1] = w[1]; cells[i * 3 + 2] = w[2];
        }
    }
    shapeStairs(cells, map.w, map.h);
    // Evermore's cuttable layer: the cell shows its words until cut, then `cells`.
    const cut: number[][] = [];
    const cutSeen = new Set();
    for (const c of cuts) {
        const i = c.y * map.w + c.x;
        if (cutSeen.has(i)) continue;
        cutSeen.add(i);
        const top = [cells[i * 3], cells[i * 3 + 1], cells[i * 3 + 2]];
        const a = c.layer === 'A' ? c.to : map.cell('A', c.x, c.y), b = c.layer === 'B' ? c.to : map.cell('B', c.x, c.y);
        const under = stamp(c.x, c.y, a, b);
        cells[i * 3] = under[0]; cells[i * 3 + 1] = under[1]; cells[i * 3 + 2] = under[2];
        cut.push([c.x, c.y, ...top]);
    }
    const objects = flagged.map((o) => ({
        x: o.x, y: o.y, w: o.w, h: o.h, flag: o.flag, values: o.values,
        frames: o.frames.map((f) => {
            const out: Record<string, { layer1: number; layer2: number; collision: number }> = {};
            for (const [k, v] of Object.entries(f)) {
                const [dx, dy] = k.split(',').map(Number);
                const w = stamp(o.x + dx, o.y + dy, v.A, v.B);
                out[k] = { layer1: w[0], layer2: w[1], collision: w[2] };
            }
            return out;
        }),
    }));
    const set = map.header.paletteSet;
    const families = palettes.map((p) => {
        // The moment the channels start from (animation.ts), so tiles and colour cycles start together.
        const colours = Array.from(map.cgram.subarray(p * 16, p * 16 + 16), (c) => c & 0x7FFF);
        const n = set * 8 + p - 1;
        return { id: FAMILY_BASE + n, label: 'm' + n, paletteSet: set, palette: p, colours,
            graphics: used.has(p) ? used.get(p)!.size : 0 };
    });
    const cycles = paletteCycles(rotations.rotations, (p) => (used.has(p) ? slotOf(p) : 0));
    return {
        id, widthTiles: map.w, heightTiles: map.h,
        display: { tm: map.display.main, ts: map.display.sub, colorMath: map.display.math, colorWindow: 0x02 },
        cells,
        graphics: graphics.slots.map(encodeGraphic),
        frameGraphics: anim.frames.map(encodeGraphic),
        animation: anim.channels,
        paletteCycles: cycles.records,
        families,
        stepOn: triggerBoxes(events.steps.filter((s) => !s.bump)),
        bTrigger: triggerBoxes(events.steps.filter((s) => s.bump)),
        cut,
        objects,
        onEnter: events.onEnter,
        spawns: mana.mapObjects(manaRom, id).map((o) => ({ x: o.x, y: o.y, kind: o.kind })),
        stats: Object.assign(stats, { graphics: graphics.slots.length, stepCells: events.steps.length - bumpAt.size, bumpCells: bumpAt.size,
            cuttable: cut.length, objects: objects.length,
            channels: anim.channels.length, frameGraphics: anim.frames.length, aperiodicTiles: anim.aperiodic,
            stillTiles: anim.still, peakUploads: anim.peakUploads, paletteCycles: cycles.records.length, droppedCycles: cycles.dropped,
            unconvertedColours: rotations.others.length }),
    };
}

export { convertManaMap, collisionWord, encodeGraphic, triggerBoxes, slotChr };
