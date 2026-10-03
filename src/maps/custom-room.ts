// Ownership: turning a custom map — a grid of resolved stamps drawn with a
// donor room's graphics — into a room blob the engine can load. Pure.
//
// The editor never writes ids; it hands over each cell's three words
// (Layer 1, Layer 2, collision). This file builds the dictionary from them,
// numbers it the one way the Markov encoder accepts, and borrows everything
// else from the donor exactly as the editor's renderer did, so the room the
// game loads is the room the editor drew.
//
// See docs/map-format/map_encoding.md and rom-export.md.

import { decodeRoom } from './room';
import { RoomModel, TriggerRecord, buildBlob, encodeBlock1, encodeBlock2, encodeBlock3, modelFromRom } from './encode';
import { MAX_WRAM } from './budget';
import { MIN_WIDTH, MIN_HEIGHT, MAX_TILES } from './blank-room';
import { AnimationIndex } from './vanilla-animation';
import { ChannelSpec, CustomAnimationPlan, planCustomAnimation, remapWord } from './custom-animation';

export interface CustomObjectInput {
    x: number;
    y: number;
    w: number;
    h: number;
    states?: number;
    frames: Array<Record<string, { layer1: number; layer2: number; collision: number }>>;
    /**
     * Ticks each state is held while the object steps through it, by state
     * (byte 0 of descriptor s, read at `$90A46B`/`$90A48E`). State 0 and the
     * last state are never held; a missing entry is vanilla's usual 1.
     */
    holds?: number[];
}

/** Descriptor `s`'s byte 0: the ticks state `s` is held, 0..255. */
export const DEFAULT_OBJECT_HOLD = 1;
function objectHold(obj: CustomObjectInput, s: number): number {
    const v = obj.holds && obj.holds[s];
    if (typeof v !== 'number' || !Number.isFinite(v)) return s === 0 ? 0 : DEFAULT_OBJECT_HOLD;
    return Math.max(0, Math.min(255, Math.round(v)));
}

export interface CustomRoomInput {
    /** The room whose graphics and families the map was drawn with. */
    borrowFrom: number;
    widthTiles: number;
    heightTiles: number;
    /** Row-major, three words per cell: `[l1, l2, cw, l1, l2, cw, ...]`. */
    cells: number[];
    /** Graphics the draft adopted, slotted after the donor's whole tile list. */
    graphics?: number[];
    /** The draft's tile families by palette slot (`null` = empty); none means the donor's. */
    families?: Array<number | null>;
    /**
     * The cuttable layer: `[x, y, l1, l2, cw]` per cuttable cell. That cell
     * shows these words until it is cut, and then the `cells` words beneath.
     */
    cut?: number[][];
    /**
     * Vanilla's animations (the vanilla index's `animations`). With it, a
     * placed graphic vanilla animates gets a Section 2 channel and plays in
     * the game (custom-animation.ts); without it every graphic is still.
     */
    animations?: AnimationIndex;
    /**
     * The channels the editor's Animation tab defines (custom-animation.ts
     * ChannelSpec). When given, only these animate; `animations` is ignored.
     */
    channels?: ChannelSpec[];
    /** Placed objects with state transition frames. */
    objects?: CustomObjectInput[];
    /** Step-on triggers: walk into the rectangle. */
    stepOn?: TriggerRecord[];
    /** B-triggers: press B inside the rectangle. */
    bTrigger?: TriggerRecord[];
    /**
     * Header bytes the map sets itself rather than taking the donor's: the
     * PPU layer designations and colour math, the effect variant and its
     * 16-bit parameter. Origin and size always come from the map.
     */
    header?: HeaderOverrides;
}

export interface HeaderOverrides {
    displayTm?: number;
    subscreenTs?: number;
    colorMath?: number;
    colorWindow?: number;
    effectVariant?: number;
    /** Header bytes 9..10, stored at `$0F84`. */
    param?: number;
}

/** Header byte offsets of the overridable fields (docs/map-format/map_decompression_trace_analysis.md). */
const HEADER_BYTES: Array<[keyof HeaderOverrides, number]> = [
    ['displayTm', 4], ['subscreenTs', 5], ['colorMath', 6], ['colorWindow', 7], ['effectVariant', 8],
];

/** Write the overrides into a 13-byte header copy. */
export function applyHeaderOverrides(header: Uint8Array, o: HeaderOverrides | undefined): void {
    if (!o) return;
    for (const [k, at] of HEADER_BYTES) {
        const v = o[k];
        if (typeof v === 'number' && Number.isFinite(v)) header[at] = v & 0xff;
    }
    if (typeof o.param === 'number' && Number.isFinite(o.param)) {
        header[9] = o.param & 0xff;
        header[10] = (o.param >> 8) & 0xff;
    }
}

export interface CustomRoomBlob {
    blob: Uint8Array;
    /** Distinct cuttable (stamp, beneath) pairs — the Section 4 sources. */
    cuttable: number;
    model: RoomModel;
    metatileCount: number;
    wramBytes: number;
    /** The Section 2 plan: its channels, and how words were renumbered. */
    animation: CustomAnimationPlan;
    /** A draft word as written into the room: the same graphic, in its new slot. */
    remap: (word: number) => number;
}

/**
 * Header bytes 0 and 1 are the trigger origin, added to the player's tile
 * position during trigger checks (`$0F86`, map_decompression_trace_analysis
 * §1). A custom map writes no triggers, so its origin is 0 — the same as
 * Brian's own room.
 */
const HEADER_ORIGIN_X = 0;
const HEADER_ORIGIN_Y = 1;

/** Section 4 with `$0FC4 = 0` and no swap records, as in 0x15, 0x34 and 0x76. */
const EMPTY_SECTION4 = Uint8Array.from([0x00]);

/**
 * Build the blob.
 *
 * **Dictionary order.** Entries are numbered by first appearance, reading
 * the grid row by row. That is the one order that always encodes: every new
 * id is then exactly the Markov encoder's "next sequential metatile", the
 * only token that widens its literal field (encode.ts). Cell (0,0) becomes
 * entry 0, which rule 7.2 requires.
 *
 * **Graphics.** The editor numbers slots over the donor's *whole* tile list
 * — Block 1 then its animated tiles (`tiles.count`, metatile-palette.js) —
 * and appends adopted graphics after that. Block 1 here is that list, in
 * that order, minus the graphics that animate: those move past Block 1 with
 * a Section 2 channel each, and every word naming them is renumbered to the
 * new slot (custom-animation.ts). With no `animations` nothing moves, and
 * Section 2 is empty — `count 0` and a lone `ff`, byte-for-byte what rooms
 * 0x15, 0x34 and 0x76 carry. Either way every word names the same graphic in
 * the game that it named in the editor.
 */
export function buildCustomRoomBlob(rom: Uint8Array, input: CustomRoomInput): CustomRoomBlob {
    const w = input.widthTiles | 0;
    const h = input.heightTiles | 0;
    // One screen at least (blank-room.ts MIN_WIDTH): smaller encodes, but the game draws it scrambled.
    if (w < MIN_WIDTH || h < MIN_HEIGHT) {
        throw new Error(`a ${w}x${h} room is smaller than one screen (${MIN_WIDTH}x${MIN_HEIGHT}) — the game draws it scrambled`);
    }
    if (w > MAX_TILES || h > MAX_TILES) throw new Error(`a ${w}x${h} room is past ${MAX_TILES} tiles a side`);
    if (!Array.isArray(input.cells) || input.cells.length !== w * h * 3) {
        throw new Error(`expected ${w * h * 3} words for a ${w}x${h} grid, got ${input.cells && input.cells.length}`);
    }

    const donor = modelFromRom(rom, input.borrowFrom);
    const donorRoom = decodeRoom(rom, input.borrowFrom);

    const base = w * h * 2;
    const dict = buildDictionary(input, w, h, base);
    const { l1, l2, cw, grid } = dict;

    const wramBytes = base + l1.length * 8;
    if (wramBytes > MAX_WRAM) {
        throw new Error(`the grid and ${l1.length} stamps need ${wramBytes} bytes of the ${MAX_WRAM}-byte window`);
    }

    const header = Uint8Array.from(donor.header);
    header[HEADER_ORIGIN_X] = 0;
    header[HEADER_ORIGIN_Y] = 0;
    header[2] = w;
    header[3] = h;
    applyHeaderOverrides(header, input.header);

    const graphics = donorRoom.tilePalette
        .concat(donorRoom.animatedTiles)
        .concat((input.graphics || []).map(Number));
    // By slot: a word names a palette slot, so an empty slot stays in place
    // (as family 0) and only trailing empties are dropped.
    const slots = (input.families || []).map((f) => (f === null || f === undefined ? 0 : Number(f)));
    while (slots.length && slots[slots.length - 1] === 0) slots.pop();
    const families = slots.length ? slots : donor.tileFamilies;

    const animation = planCustomAnimation(graphics, l1.concat(l2), input.animations, undefined, input.channels);
    const remap = (word: number): number => remapWord(animation, word & 0xffff);

    const objectOffsets: number[] = [];
    const objectAreaSink: number[] = [];
    const validObjects = (input.objects || []).filter((o) => (o.frames || []).length > 0);

    for (const obj of validObjects) {
        const recOffset = objectAreaSink.length;
        objectOffsets.push(recOffset);
        const frames = obj.frames;
        const maxState = frames.length;
        const recLen = 1 + maxState * 5;
        const recBytes: number[] = [maxState];
        const tw = obj.w, th = obj.h, n = tw * th;

        // A frame is how the area looks in that state (the map, its tiles
        // over it), but the engine XORs each descriptor into whatever the
        // grid holds by then, one state after another (object-stamps.ts).
        // So descriptor s is state s+1's ids XOR state s's, not state 0's.
        const look = (state: number): number[] => {
            const frame = state > 0 ? frames[state - 1] || {} : {};
            const ids: number[] = [];
            for (let k = 0; k < n; k++) {
                const dx = k % tw, dy = Math.floor(k / tw);
                const f = frame[dx + ',' + dy];
                const at = grid[(obj.y + dy) * w + (obj.x + dx)] ?? 0;
                if (!f) { ids.push(at); continue; }
                const kStr = (f.layer1 & 0xffff) + ',' + (f.layer2 & 0xffff) + ',' + (f.collision & 0xffff);
                const idx = dict.key.get(kStr);
                ids.push(idx === undefined ? at : base + idx * 8);
            }
            return ids;
        };

        const stateStamps: number[][] = [];
        let prev = look(0);
        for (let s = 0; s < maxState; s++) {
            const next = look(s + 1);
            const stampBytes: number[] = [tw, th];
            let mask = 0, bit = 0;
            const deltaBytes: number[] = [];
            for (let k = 0; k < n; k++) {
                const delta = (next[k] ^ prev[k]) & 0xffff;
                if (delta) {
                    mask |= (1 << bit);
                    deltaBytes.push(delta & 0xff, (delta >> 8) & 0xff);
                }
                bit++;
                if (bit === 8 || k === n - 1) {
                    stampBytes.push(mask);
                    for (let b = 0; b < deltaBytes.length; b++) stampBytes.push(deltaBytes[b]);
                    mask = 0; bit = 0; deltaBytes.length = 0;
                }
            }
            stateStamps.push(stampBytes);
            prev = next;
        }

        let curStampOffset = recOffset + recLen;
        for (let s = 0; s < maxState; s++) {
            recBytes.push(objectHold(obj, s), obj.x, obj.y, curStampOffset & 0xff, (curStampOffset >> 8) & 0xff);
            curStampOffset += stateStamps[s].length;
        }
        for (let b = 0; b < recBytes.length; b++) objectAreaSink.push(recBytes[b]);
        for (let s = 0; s < maxState; s++) {
            for (let b = 0; b < stateStamps[s].length; b++) objectAreaSink.push(stateStamps[s][b]);
        }
    }

    const model: RoomModel = {
        header,
        stepOn: (input.stepOn || []).map((t) => ({
            y1: Math.min(t.y1, t.y2),
            x1: Math.min(t.x1, t.x2),
            y2: Math.max(t.y1, t.y2),
            x2: Math.max(t.x1, t.x2),
            scriptId: t.scriptId & 0xffff,
        })),
        bTrigger: (input.bTrigger || []).map((t) => ({
            y1: Math.min(t.y1, t.y2),
            x1: Math.min(t.x1, t.x2),
            y2: Math.max(t.y1, t.y2),
            x2: Math.max(t.x1, t.x2),
            scriptId: t.scriptId & 0xffff,
        })),
        tileFamilies: families,
        extras: donor.extras,
        block1: encodeBlock1(animation.block1, true),
        section2Count: animation.section2Count,
        section2Data: animation.section2Data,
        objectOffsets,
        block2: encodeBlock2(grid, w, h, base, dict.sources),
        section4: dict.section4,
        block3: encodeBlock3(l1.map(remap), l2.map(remap), cw, true),
        objectArea: Uint8Array.from(objectAreaSink),
    };
    return {
        blob: buildBlob(model), model, metatileCount: l1.length, wramBytes, cuttable: dict.sources, animation, remap,
    };
}

/** The words every cell shows when the room loads: the cuttable layer where there is one. */
export function draftTopCells(input: CustomRoomInput): number[] {
    const w = input.widthTiles | 0;
    const top = input.cells.slice();
    for (const c of input.cut || []) {
        const i = ((c[1] | 0) * w + (c[0] | 0)) * 3;
        if (i >= 0 && i + 2 < top.length) { top[i] = c[2]; top[i + 1] = c[3]; top[i + 2] = c[4]; }
    }
    return top;
}

/**
 * Number the dictionary and write the grass table.
 *
 * **Cuttable grass** (docs/map-format/cuttable_grass_mechanics.md): a cell
 * is cuttable iff its metatile id is a *source* in Section 4, and cutting
 * stamps the record's other id into the grid. Two rules the ROM attests in
 * all 7 rooms that use it: the sources are dictionary entries `0..N-1`, and
 * Section 4 opens with `N` — the same byte the Markov decoder takes as its
 * starting counter ($0FC4), so the grid can name a source without
 * introducing it. A source maps to exactly one cut target (duplicates are
 * unverified), so each distinct *(cuttable stamp, stamp beneath)* pair gets
 * its own entry — the same grass over two floors is two sources.
 *
 * Records are vanilla's own 7-byte shape: `01 <source> <cut> 00 00`.
 *
 * Every other entry follows in first-appearance order from `N`, the one
 * order the Markov encoder always accepts; a beneath stamp that is never
 * placed goes last, since the grid never names it.
 */
function buildDictionary(input: CustomRoomInput, w: number, h: number, base: number) {
    const l1: number[] = [];
    const l2: number[] = [];
    const cw: number[] = [];
    const add = (a: number, b: number, c: number): number => { l1.push(a & 0xffff); l2.push(b & 0xffff); cw.push(c & 0xffff); return l1.length - 1; };
    const words = (flat: number[], i: number): number[] => [flat[i * 3] & 0xffff, flat[i * 3 + 1] & 0xffff, flat[i * 3 + 2] & 0xffff];

    // 1. Sources, first. `cutAt` is cell -> source index.
    const cutAt = new Map<number, number>();
    const pairs = new Map<string, number>();
    const beneathOf: number[][] = [];
    const cuts = (input.cut || []).slice().sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
    for (const c of cuts) {
        const i = (c[1] | 0) * w + (c[0] | 0);
        if (c[0] < 0 || c[1] < 0 || c[0] >= w || c[1] >= h || cutAt.has(i)) continue;
        const top = [c[2] & 0xffff, c[3] & 0xffff, c[4] & 0xffff];
        const under = words(input.cells, i);
        const k = top.join(',') + '|' + under.join(',');
        let s = pairs.get(k);
        if (s === undefined) { s = add(top[0], top[1], top[2]); pairs.set(k, s); beneathOf.push(under); }
        cutAt.set(i, s);
    }
    const sources = l1.length;

    // 2. Everything the grid shows, in first-appearance order.
    const key = new Map<string, number>();
    const grid = new Array<number>(w * h);
    for (let i = 0; i < w * h; i++) {
        const s = cutAt.get(i);
        if (s !== undefined) { grid[i] = base + s * 8; continue; }
        const [a, b, c] = words(input.cells, i);
        const k = a + ',' + b + ',' + c;
        let idx = key.get(k);
        if (idx === undefined) { idx = add(a, b, c); key.set(k, idx); }
        grid[i] = base + idx * 8;
    }

    // 2b. Tiles introduced by object frames, in appearance order.
    for (const obj of input.objects || []) {
        for (const frame of obj.frames || []) {
            for (const fk of Object.keys(frame || {})) {
                const f = frame[fk];
                if (!f) continue;
                const [a, b, c] = [f.layer1 & 0xffff, f.layer2 & 0xffff, f.collision & 0xffff];
                const k = a + ',' + b + ',' + c;
                if (!key.has(k)) {
                    const idx = add(a, b, c);
                    key.set(k, idx);
                }
            }
        }
    }

    // 3. What each source is cut to, and the records.
    const section = [sources];
    for (let s = 0; s < sources; s++) {
        const [a, b, c] = beneathOf[s];
        const k = a + ',' + b + ',' + c;
        let dst = key.get(k);
        if (dst === undefined) { dst = add(a, b, c); key.set(k, dst); }
        const src = base + s * 8;
        const cut = base + dst * 8;
        section.push(0x01, src & 0xff, src >> 8, cut & 0xff, cut >> 8, 0x00, 0x00);
    }
    return { l1, l2, cw, grid, sources, section4: sources ? Uint8Array.from(section) : EMPTY_SECTION4, key };
}
