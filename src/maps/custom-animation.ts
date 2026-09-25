// Ownership: Section 2 for a custom map — which of its graphics animate, the
// slot order that makes them animate, and the channel bytes. Pure.
//
// The engine appends each channel's frame 0 to the Block 1 tile list at load
// (docs/map-format/map_animated_tiles.md §4), so a graphic animates exactly
// when its slot is past Block 1 and a channel drives it. The editor numbers
// slots over one flat list (the donor's Block 1, its animated tiles, then the
// graphics the map adopted), with animated graphics anywhere in it. So:
//
//   - every graphic a placed word names that vanilla animates gets a channel;
//   - Block 1 is every other graphic, in the editor's order;
//   - the animated ones follow, one slot per channel, in channel order;
//   - every word is renumbered to its graphic's new slot (`remapWord`).
//
// Each channel plays the animation's vanilla cycle
// (maps/vanilla-animation.ts), starting at the placed graphic, so frame 0 is
// the graphic the word already showed (the invariant vanilla keeps in
// 1020/1020 channels). Vanilla runs one cycle at several phases in places;
// a custom map doesn't: one channel per placed graphic, at its own phase.
// Initial countdown 0, as in 917 of vanilla's 1020 channels.

import { AnimationIndex } from './vanilla-animation';
import { tileSlotChr } from './metatiles';

/** The most channels one vanilla room runs (room census); more is unattested V-Blank DMA load. */
export const MAX_CHANNELS = 42;

export interface CustomAnimationPlan {
    /** Block 1's graphics, in slot order. */
    block1: number[];
    /** Per channel, frame 0 first: `{frames, delays}`. */
    channels: Array<{ graphic: number; frames: number[]; delays: number[] }>;
    section2Count: number;
    /** The descriptor table, its 0xFF, then the frame data (Section 2 minus its 3-byte header). */
    section2Data: Uint8Array;
    /** Old slot -> new slot, for every slot. */
    slotMap: number[];
    /** Animated graphics left still because the channel limit was reached. */
    skipped: number;
}

/** Block 1 slot a tilemap word draws. */
export function wordSlot(word: number): number {
    const chr = word & 0x3ff;
    return (chr >> 5) * 8 + ((chr & 0x1f) >> 1);
}

/** `{frames, delays}` of the cycle `graphic` is part of, turned to start at it; null when it doesn't animate. */
export function cycleFrom(index: AnimationIndex, graphic: number): { frames: number[]; delays: number[] } | null {
    let first = graphic;
    let at = 0;
    if (!index.byFirst.has(graphic)) {
        const f = index.frameOf.get(graphic);
        if (!f) return null;
        first = f.first;
        at = f.index;
    }
    const a = index.byFirst.get(first);
    if (!a || a.frames.length < 2) return null;
    const turn = <T>(xs: T[]): T[] => xs.slice(at).concat(xs.slice(0, at));
    return { frames: turn(a.frames), delays: turn(a.delays) };
}

/**
 * Plan Section 2.
 *
 * @param graphics the editor's flat slot list
 * @param words    every tilemap word the room will hold (both layers, all entries)
 */
export function planCustomAnimation(
    graphics: number[], words: number[], index: AnimationIndex | undefined, max = MAX_CHANNELS,
): CustomAnimationPlan {
    const used = new Set<number>();
    for (const w of words) {
        const s = wordSlot(w);
        if (s < graphics.length) used.add(s);
    }
    const animated: number[] = [];
    const channels: CustomAnimationPlan['channels'] = [];
    let skipped = 0;
    if (index) {
        for (const s of [...used].sort((a, b) => a - b)) {
            const c = cycleFrom(index, graphics[s]);
            if (!c) continue;
            if (channels.length >= max) { skipped += 1; continue; }
            animated.push(s);
            channels.push({ graphic: graphics[s], frames: c.frames, delays: c.delays });
        }
    }
    const moved = new Set(animated);
    const order = graphics.map((_, s) => s).filter((s) => !moved.has(s)).concat(animated);
    const slotMap = new Array<number>(graphics.length);
    order.forEach((old, i) => { slotMap[old] = i; });

    return {
        block1: order.slice(0, order.length - animated.length).map((s) => graphics[s]),
        channels,
        section2Count: channels.length,
        section2Data: section2Bytes(channels),
        slotMap,
        skipped,
    };
}

/** A word naming the same graphic in the planned slot order; words past the list are left alone. */
export function remapWord(plan: CustomAnimationPlan, word: number): number {
    const chr = word & 0x3ff;
    const s = wordSlot(word);
    const to = plan.slotMap[s];
    if (to === undefined || to === s) return word;
    const off = chr - tileSlotChr(s);
    const next = tileSlotChr(to) + off >= 0 ? tileSlotChr(to) + off : tileSlotChr(to);
    return (word & ~0x3ff & 0xffff) | (next & 0x3ff);
}

/** Descriptors (delay, frame count, offset from the table), 0xFF, then `[delay, tileId]` per frame. */
function section2Bytes(channels: CustomAnimationPlan['channels']): Uint8Array {
    const out: number[] = [];
    let offset = channels.length * 4 + 1;
    for (const c of channels) {
        out.push(0, c.frames.length, offset & 0xff, offset >> 8);
        offset += c.frames.length * 3;
    }
    out.push(0xff);
    for (const c of channels) {
        c.frames.forEach((g, i) => out.push(Math.max(1, Math.min(255, c.delays[i] || 1)), g & 0xff, (g >> 8) & 0xff));
    }
    return Uint8Array.from(out);
}
