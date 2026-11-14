// Ownership: one Terranigma room rewritten in Evermore's terms, cell by cell — the three words of an
// Evermore stamp (layer 1, layer 2, collision), 16x16 graphics, up to seven families, exits as step-on
// boxes, chests as B-trigger boxes, map changes as objects. Pure: Terranigma ROM bytes in, data out.
//
// What maps onto what (docs/terra/evermore-rooms.md):
//   the layer on BG1               -> layer 1 (canopy, BG1)
//   the layer on BG2               -> layer 2 (terrain, BG2); a smaller one repeated over the map
//   a sub-screen-only effect layer -> left out, as the room picture leaves it out (render.ts)
//   metatile (4 chars)             -> one 16x16 graphic in one palette, one priority (graphics.ts)
//   background palettes 0-7        -> the seven most drawn as families t<n>; the eighth recoloured
//   layer 0's cell types           -> collision words (collision.ts)
//   exits                          -> step-on bit 14 + a box per exit
//   chests                         -> a wall with bit 15 + a B-trigger box
//   map changes ($99:D4E7)         -> objects: state 0 the room as loaded, state 1 the change applied
//   a tile mixing char priorities  -> split: its high part on layer 1 at priority 1 where layer 1 is empty
//   palette helpers' rotations     -> palette cycles (animation.ts)
// Only SNES facts are shared: both games use Mode 1 tilemap words with the same bits.

import * as terra from '../../../terra/decoder';
import type { TerraLayer } from '../../../terra/decoder';
import { EMPTY_GRAPHIC, encodeGraphic, slotChr, graphicTable, fitGraphics } from '../common/graphics';
import { triggerBoxes } from '../common/boxes';
import { collisionWords, SOLID, PLANE_2 } from './collision';
import { rawTile, priorityPart, keptPalettes, withBackdrop, convertTile, fillBackdrop, backdropColour } from './graphics';
import type { Chars, Raw, Stats } from './graphics';
import { paletteAnimation } from './animation';
import { paletteCycles } from '../common/cycles';

const STEP_ON = 0x4000, INTERACT = 0x8000;
/** Evermore's BG3, on in every vanilla room's TM (header byte 4 is `$17` in all of them): its HUD and text. */
const EVERMORE_BG3 = 0x04;
/** CGADSUB's BG3 / BG4 bits: those layers are not converted. */
const UNCONVERTED_MATH = 0x0C;
/** CGWSEL as every vanilla room writes it (header byte 7): colour math with the sub screen. */
const CGWSEL_SUB = 0x02;

type Role = 1 | 2;
/** Metatile numbers of split tiles (a layer-2 metatile + SPLIT): past the 512 a layer table holds. */
const SPLIT = 0x200;
type Tile = { px: Uint8Array; palette: number; priority: number; empty: boolean };

/**
 * Convert room `id`. Null for an unused slot, a room without a map of its own, or a ROM other than the
 * base one. `familyId(colours)` names a family by its 16 colours (rooms.ts keeps them unique).
 */
function convertTerraRoom(rom: Uint8Array, id: number, familyId: (colours: number[]) => number) {
    const room = terra.loadRoom(rom, id);
    if (!room || !room.layers.length) return null;
    const { w, h } = terra.roomSize(room);
    const { main, sub, cgadsub, cgwsel } = room.ppu;
    const stats: Stats & Record<string, number> = { recolouredTiles: 0, recolouredPixels: 0, mixedPriority: 0, droppedGraphics: 0 };
    const bgBit = (l: TerraLayer) => 1 << (terra.layerBg(l) - 1);
    const onMain = (l: TerraLayer) => !main || !!(main & bgBit(l));
    // As the picture: a layer smaller than the map only on the sub screen is a screen effect (light, haze),
    // and a layer on neither screen as the room loads is not shown (`$060`'s BG2) — unless no layer is
    // (`$004`: a script turns it on later; a blank picture shows nothing to edit).
    const drawn = room.layers.filter((l) => onMain(l) || (l.w >= w && l.h >= h));
    const visible = drawn.filter((l) => onMain(l) || !!(sub & bgBit(l)));
    const shown = visible.length ? visible : drawn;
    stats.effectLayers = room.layers.length - drawn.length;
    stats.hiddenLayers = drawn.length - shown.length;
    const layer: Record<Role, TerraLayer | null> = { 1: shown.find((l) => terra.layerBg(l) === 1) ?? null, 2: shown.find((l) => terra.layerBg(l) === 2) ?? null };

    // Colour math with the fixed colour (CGWSEL bit 1 clear) mixes in a colour the room header cannot set. In the
    // base ROM it is always black: adding or subtracting it changes nothing, and halving the result halves the
    // colours — done to the families' colours instead (CGADSUB `$C3`: both layers halved, the backdrop not).
    let math = ((cgwsel >> 4) & 3) !== 3 ? cgadsub : 0;
    const fixedMath = !(cgwsel & CGWSEL_SUB) && !!(math & 0x33);
    const black = room.ppu.fixed.every((c) => c === 0);
    const halve = fixedMath && black && !!(math & 0x40) && (math & 0x03) === 0x03;
    stats.unconvertedColourMath = fixedMath && !(black && (!(math & 0x40) || halve)) ? 1 : 0;
    stats.halvedColours = halve ? 1 : 0;
    // What of the room's palette its helpers rotate (loadRoom has their first frames in `room.palette` already).
    const anim = paletteAnimation(rom, id);
    const palette = halve ? room.palette.map(half) : room.palette;
    const backdrop = halve && (math & 0x20) ? half(room.palette[0]) : room.palette[0];
    // A BG2 layer on the sub screen only, added to the backdrop without halving, is seen through it (`$13F`'s
    // cave): it goes on the main screen too, its tiles at priority 0 so BG1 stays in front as before (and still
    // mixes with it from the sub screen), and the backdrop leaves colour math. Exact when the backdrop is black;
    // else the backdrop's tint over the layer is lost (counted): an Evermore header has no backdrop colour, and
    // the editor's renderer no backdrop math. Not BG1: on the main screen it would cover BG2, which it is added
    // onto (`$04C`'s haze).
    const plain = (l: TerraLayer | null) => !!l && !onMain(l) && !!(sub & bgBit(l)) && !!(cgwsel & CGWSEL_SUB) && (math & 0xE0) === 0x20;
    const asMain = plain(layer[2]) ? [2 as Role] : [];
    if (asMain.length) math &= ~0x20;
    stats.subLayersOnMain = asMain.length;
    stats.lostBackdropTint = asMain.length && backdrop ? 1 : 0;
    const chars: Record<Role, Chars> = { 1: charsOf(room, layer[1]), 2: charsOf(room, layer[2]) };
    // A layer smaller than the map repeats (a background the game scrolls on its own; drawn fixed here).
    const cellOf = (role: Role, x: number, y: number) => {
        const l = layer[role];
        return l ? l.cells[(y % l.h) * l.w + (x % l.w)] : -1;
    };

    // The map changes: what each one writes, by cell, on Evermore's layers and in layer 0's cell types.
    const roleOf = (index: number): Role | null => (layer[1]?.index === index ? 1 : layer[2]?.index === index ? 2 : null);
    const changes = terra.roomChanges(rom, id).map((change) => {
        const cells = new Map<number, { 1?: number; 2?: number; type?: number }>();
        for (const [index, x, y, word] of terra.changeCells(room, change)) {
            if (x >= w || y >= h) continue;
            const c = cells.get(y * w + x) ?? {};
            const role = roleOf(index);
            if (role) c[role] = word;
            if (index === 0) c.type = (word >> 9) & 0x1F;
            cells.set(y * w + x, c);
        }
        return { bit: change.bit, cells };
    }).filter((c) => c.cells.size);

    // Collision: layer 0's cell types ($7E:A000, what movement reads); past its size a wall. A room without a
    // layer 0 (`$005`, a picture on layer 1 alone) has nothing to collide with: floor.
    const l0 = room.layers.find((l) => l.index === 0);
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
    const typeAt = (x: number, y: number) => (!inside(x, y) ? -1 : !l0 ? 0 : x < l0.w && y < l0.h ? (l0.cells[y * l0.w + x] >> 9) & 0x1F : -1);
    const collision = collisionWords(terra.cellTypeRules(rom), w, h, typeAt);

    // Terranigma gives each 8x8 character its own priority; an Evermore cell has one. A layer-2 metatile that
    // mixes them (a canopy's or a roof's lower edge, a signpost: the player walks behind its high half) is split
    // where layer 1 shows nothing in the cell: its high-priority pixels go to layer 1 at priority 1, the rest
    // stays on layer 2 at priority 0 — the same order in Mode 1 (BG1.1 and BG2.1 both in front of a priority-2
    // sprite, both behind nothing it is behind). Only while BG1 and BG2 take the same part in the sub screen and
    // colour math (`splitOk`), so moving a pixel from one to the other changes nothing else. Split metatiles are
    // numbered from SPLIT; elsewhere a tile keeps the priority of most of its pixels.
    const ts = sub & ((layer[1] ? 0x01 : 0) | (layer[2] ? 0x02 : 0) | 0x10);
    const outMath = !fixedMath && (ts & 0x03) ? math & ~UNCONVERTED_MATH : 0;
    const splitOk = !!layer[2] && onMain(layer[2]) && !asMain.includes(2) && !(ts & 0x03)
        && (outMath & 0x01) === ((outMath >> 1) & 0x01) && (!layer[1] || onMain(layer[1]));
    const raw: Record<Role, Map<number, Raw>> = { 1: new Map(), 2: new Map() };
    const rawOf = (role: Role, n: number): Raw => {
        let r = raw[role].get(n);
        if (!r) {
            r = n >= SPLIT ? priorityPart(rawOf(2, n - SPLIT), role === 1) : rawTile(chars[role], layer[role]!.metatiles, n);
            raw[role].set(n, r);
        }
        return r;
    };
    const mixed = (t: Raw) => t.high > 0 && t.high < t.opaque;
    /** The metatiles cell words `wa`, `wb` show on Evermore's layers 1 and 2 (-1: none), split ones from SPLIT. */
    const pairOf = (wa: number, wb: number): [number, number] => {
        const a = wa < 0 ? -1 : wa & 0x1FF, b = wb < 0 ? -1 : wb & 0x1FF;
        if (splitOk && b >= 0 && mixed(rawOf(2, b)) && (a < 0 || !rawOf(1, a).opaque)) return [b + SPLIT, b + SPLIT];
        return [a, b];
    };
    // A split costs graphics (Evermore has 256): only where the Boy can be behind the tile — he stands on the cell or
    // on the one below it (his sprite reaches a cell above his feet).
    const standable = (x: number, y: number) => inside(x, y) && (collision.words[y * w + x] & 0x0F) !== 0x0F;
    const cellPair = (x: number, y: number, c: { 1?: number; 2?: number } = {}): [number, number] => {
        const p = pairOf(c[1] ?? cellOf(1, x, y), c[2] ?? cellOf(2, x, y));
        return p[1] >= SPLIT && !standable(x, y) && !standable(x, y + 1) ? [-1, p[1] - SPLIT] : p;
    };

    // Every metatile a cell shows, with how often: as loaded, and as each change leaves it.
    const uses: Record<Role, Map<number, number>> = { 1: new Map(), 2: new Map() };
    const pairs = new Map<string, [number, number]>();
    const see = ([a, b]: [number, number]) => {
        if (a >= 0) uses[1].set(a, (uses[1].get(a) ?? 0) + 1);
        if (b >= 0) uses[2].set(b, (uses[2].get(b) ?? 0) + 1);
        pairs.set(a + ',' + b, [a, b]);
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) see(cellPair(x, y));
    for (const ch of changes) for (const [i, c] of ch.cells) see(cellPair(i % w, (i / w) | 0, c));
    stats.splitTiles = [...uses[2].keys()].filter((n) => n >= SPLIT).length;

    for (const role of [1, 2] as Role[]) for (const n of uses[role].keys()) rawOf(role, n);
    const allRaw = [...uses[1].keys()].map((n) => rawOf(1, n)).concat([...uses[2].keys()].map((n) => rawOf(2, n)));
    const kept = keptPalettes(allRaw);
    stats.droppedPalettes = new Set(allRaw.flatMap((t) => [...new Set(t.pal.filter((_, i) => t.px[i]))])).size - kept.length;

    // Terranigma shows its backdrop (colour 0, from colour 32: $8D:8C52) where both layers are transparent;
    // Evermore shows black. Layer 2's transparent pixels are filled with it — all of a priority-0 tile's, of
    // a priority-1 tile those no priority-0 layer-1 pixel lies over in any cell. When BG2 is on the sub screen
    // a filled pixel is also what BG1 blends with: then only pixels no layer-1 pixel covers anywhere, and
    // only when neither BG2 nor the backdrop takes part in colour math.
    const bottomMain = !layer[2] || onMain(layer[2]) || asMain.includes(2);
    const subB = !!layer[2] && !!(sub & 0x02);
    const fill = bottomMain && (!subB || !(math & 0x22));
    const cgram = fill ? withBackdrop(palette, kept, allRaw, backdrop, anim.rotating) : palette;
    const tiles: Record<Role, Map<number, Tile>> = { 1: new Map(), 2: new Map() };
    for (const role of [1, 2] as Role[]) {
        for (const n of uses[role].keys()) {
            const c = convertTile(cgram, rawOf(role, n), kept, stats, anim.rotating);
            tiles[role].set(n, asMain.includes(role) ? { ...c, priority: 0 } : c);
        }
    }
    if (fill) {
        const open = new Map<number, Uint8Array>();
        for (const [a, b] of pairs.values()) {
            if (b < 0) continue;
            let o = open.get(b);
            if (!o) { o = new Uint8Array(256).fill(1); open.set(b, o); }
            const top = a < 0 ? null : tiles[1].get(a)!;
            if (top && !top.empty && (!top.priority || subB)) for (let i = 0; i < 256; i++) if (top.px[i]) o[i] = 0;
        }
        for (const [n, t] of tiles[2]) {
            if (t.empty) continue;
            t.px = fillBackdrop(cgram, t.px, t.palette, backdrop, !t.priority && !subB ? null : open.get(n)!, anim.rotating);
        }
    }
    // An empty layer-2 cell (or no layer 2 at all) shows the backdrop: one solid graphic for it.
    const needSolid = fill && !subB && [...pairs.values()].some(([, b]) => b < 0 || tiles[2].get(b)!.empty);
    const solid = needSolid ? backdropColour(cgram, kept, backdrop, anim.rotating) : null;

    // Graphics: every one listed first; past Evermore's 256 those with a near twin are drawn as the twin (fitGraphics).
    const listed = graphicTable(stats, { max: Infinity });
    const first: Record<Role, Map<number, ReturnType<typeof listed.place>>> = { 1: new Map(), 2: new Map() };
    const solidFirst = solid ? listed.place(new Uint8Array(256).fill(solid.k)).slot : EMPTY_GRAPHIC;
    const weight: number[] = [], drawnIn: number[] = [];
    for (const role of [1, 2] as Role[]) {
        for (const [n, k] of uses[role]) {
            const t = tiles[role].get(n)!;
            const g = t.empty ? { slot: EMPTY_GRAPHIC, h: 0, v: 0 } : listed.place(t.px);
            first[role].set(n, g);
            if ((weight[g.slot] ?? 0) < k) drawnIn[g.slot] = t.palette;
            weight[g.slot] = (weight[g.slot] ?? 0) + k;
        }
    }
    if (solid) drawnIn[solidFirst] = solid.palette;
    const fit = fitGraphics(listed.slots, weight, (s, k) => cgram[(drawnIn[s] ?? kept[0]) * 16 + k], new Set([EMPTY_GRAPHIC, solidFirst]));
    stats.substitutedGraphics = fit.removed;
    const graphics = { slots: fit.slots };
    const moved = (g: { slot: number; h: number; v: number }) => { const m = fit.remap[g.slot]; return { slot: m.slot, h: g.h ^ m.h, v: g.v ^ m.v }; };
    const placed: Record<Role, Map<number, { slot: number; h: number; v: number }>> = { 1: new Map(), 2: new Map() };
    for (const role of [1, 2] as Role[]) for (const [n, g] of first[role]) placed[role].set(n, moved(g));
    const solidSlot = fit.remap[solidFirst].slot;
    const palettes = kept;
    const slotOf = (p: number) => palettes.indexOf(p) + 1;
    const wordFor = (role: Role, n: number): number => {
        const t = n < 0 ? null : tiles[role].get(n)!;
        if (role === 2 && (!t || t.empty) && solid) return (slotOf(solid.palette) << 10) | slotChr(solidSlot);
        if (!t || t.empty) return 1 << 10;     // the empty graphic, in slot 1
        const g = placed[role].get(n)!;
        return (g.v << 15) | (g.h << 14) | (t.priority << 13) | (slotOf(t.palette) << 10) | slotChr(g.slot);
    };

    const events = new Map<number, number>();         // cell -> STEP_ON / INTERACT bits
    const exits = terra.roomExits(rom, id), steps: { x: number; y: number; event: number }[] = [];
    exits.forEach((e, k) => {
        for (let y = e.y; y < Math.min(h, e.y + e.h); y++) for (let x = e.x; x < Math.min(w, e.x + e.w); x++) {
            steps.push({ x, y, event: k });
            events.set(y * w + x, (events.get(y * w + x) ?? 0) | STEP_ON);
        }
    });
    const chests = terra.roomChests(rom, id).filter((c) => c.x < w && c.y < h), checks: typeof steps = [];
    chests.forEach((c, k) => { checks.push({ x: c.x, y: c.y, event: k }); events.set(c.y * w + c.x, INTERACT); });
    const collisionAt = (i: number, type?: number) => {
        const e = events.get(i) ?? 0;
        if (e & INTERACT) return SOLID | PLANE_2 | INTERACT;
        return (type === undefined ? collision.words[i] : collision.word(i % w, (i / w) | 0, type)) | e;
    };

    const cells: number[] = new Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const [a, b] = cellPair(x, y);
        cells[i * 3] = wordFor(1, a); cells[i * 3 + 1] = wordFor(2, b); cells[i * 3 + 2] = collisionAt(i);
    }
    const objects = changes.map(({ bit, cells: changed }) => {
        const at = [...changed.keys()];
        const xs = at.map((i) => i % w), ys = at.map((i) => (i / w) | 0);
        const x0 = Math.min(...xs), y0 = Math.min(...ys);
        const frame: Record<string, { layer1: number; layer2: number; collision: number }> = {};
        for (const [i, c] of changed) {
            const x = i % w, y = (i / w) | 0;
            const [a, b] = cellPair(x, y, c);
            frame[(x - x0) + ',' + (y - y0)] = { layer1: wordFor(1, a), layer2: wordFor(2, b), collision: collisionAt(i, c.type) };
        }
        return { x: x0, y: y0, w: Math.max(...xs) - x0 + 1, h: Math.max(...ys) - y0 + 1, flag: bit, frames: [frame] };
    });

    const cycles = paletteCycles(anim.rotations, (p) => (palettes.includes(p) ? slotOf(p) : 0));
    const families = palettes.map((p) => {
        const colours = Array.from(cgram.subarray(p * 16, p * 16 + 16), (c) => c & 0x7FFF);
        const slots = new Set<number>();
        for (const role of [1, 2] as Role[]) for (const [n, t] of tiles[role]) if (!t.empty && t.palette === p) slots.add(placed[role].get(n)!.slot);
        return { id: familyId(colours), palette: p, colours, graphics: slots.size };
    });
    return {
        id, widthTiles: w, heightTiles: h,
        display: displayOf(room.ppu, layer, asMain, math, fixedMath, !!solid, stats, stats.splitTiles > 0),
        cells,
        graphics: graphics.slots.map(encodeGraphic),
        // Character animation (the tile helpers) is not converted: those tiles are still.
        frameGraphics: [] as Uint8Array[],
        animation: [] as { frames: number[]; delays: number[] }[],
        paletteCycles: cycles.records,
        families,
        stepOn: triggerBoxes(steps),
        bTrigger: triggerBoxes(checks),
        cut: [] as number[][],
        objects,
        exits, chests,
        /** The rooms loaded before this one for the parts it keeps from before (a guess: the UI says so). */
        context: room.context,
        stats: Object.assign(stats, {
            graphics: graphics.slots.length, metatiles: uses[1].size + uses[2].size, exits: exits.length, exitCells: steps.length,
            chests: chests.length, mapChanges: objects.length,
            paletteCycles: cycles.records.length, droppedCycles: cycles.dropped, stillPaletteAnimations: anim.still, tileAnimations: anim.tiles, helpersInSomeStates: anim.someStates,
        }),
    };
}

/**
 * Header bytes 4-7 (TM, TS, CGADSUB, CGWSEL) for the converted layers:
 * - only BGs that hold a converted layer keep their screen bits, and sprites theirs; Evermore's BG3 is on;
 * - a layer on neither screen as the room loads (`$004`: a script turns it on later) is put on the main
 *   screen: a blank picture shows nothing to edit;
 * - split tiles' high halves (layer 1) are on the main screen;
 * - the solid backdrop fill (no layer 2 of its own) is on the main screen only, as is a sub-screen layer seen
 *   as it is (`asMain`, by role: role 1 is BG1, role 2 BG2);
 * - colour math stays when it mixes with a converted layer on the sub screen; with nothing converted left
 *   there it would mix in Evermore's fixed colour instead, so it is dropped (Terranigma's own picture
 *   leaves those effect layers out too, render.ts).
 */
function displayOf(ppu: NonNullable<ReturnType<typeof terra.loadRoom>>['ppu'], layer: Record<Role, TerraLayer | null>, asMain: Role[],
    math: number, fixedMath: boolean, solid: boolean, stats: Record<string, number>, split: boolean) {
    const bgs = (layer[1] ? 0x01 : 0) | (layer[2] ? 0x02 : 0);
    const hidden = bgs & ~ppu.main & ~ppu.sub;
    stats.hiddenLayersShown = (hidden & 1) + ((hidden >> 1) & 1);
    const ts = ppu.sub & (bgs | 0x10);
    const mixes = !fixedMath && !!(ts & 0x03);
    return {
        tm: (ppu.main & (bgs | 0x10)) | hidden | asMain.reduce((m, r) => m | r, 0) | EVERMORE_BG3 | (solid ? 0x02 : 0) | (split ? 0x01 : 0), ts,
        colorMath: mixes ? math & ~UNCONVERTED_MATH : 0, colorWindow: CGWSEL_SUB,
    };
}

/** A BGR555 colour at half its strength, as the PPU's colour-math halving leaves it. */
const half = (c: number): number => ((c & 31) >> 1) | ((((c >> 5) & 31) >> 1) << 5) | ((((c >> 10) & 31) >> 1) << 10);

/** Where a layer's BG reads its characters (bytes into VRAM), with the room's VRAM and colours. */
function charsOf(room: NonNullable<ReturnType<typeof terra.loadRoom>>, l: TerraLayer | null): Chars {
    const base = l ? (room.ppu.bgs[terra.layerBg(l) - 1]?.chars ?? 0) * 2 : 0;
    return { vram: room.vram, base, palette: room.palette };
}

export type TerraConverted = NonNullable<ReturnType<typeof convertTerraRoom>>;
export { convertTerraRoom };
