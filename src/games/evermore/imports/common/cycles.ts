// Ownership: colour rotations as Evermore palette-cycle descriptors `[slot<<4 | first, count, rate]` ($90D50F, ticked
// by $90D58C: rate = frames per shift, its sign the way), for every converted room (imports/mana, imports/terra). Pure.

/** A run of `count` colours from `first` of palette `palette` that shifts by one every `period` frames, `direction` ±1. */
interface Rotation { palette: number; first: number; count: number; period: number; direction: number }

/** Evermore runs two cycles per palette: state slots palette*2 and palette*2+1 ($90D50F). */
const CYCLES_PER_PALETTE = 2;
const MAX_RATE = 0x7F;

/**
 * Palette-cycle descriptors for `rotations`; `slotOf(p)` is the Evermore palette slot the other game's
 * palette `p` became (0 when the room draws nothing in it). Direction +1 (each colour takes the one
 * below's value) is Evermore's positive rate: CGRAM[start+j] = colour (j - shift) mod span.
 */
function paletteCycles(rotations: Rotation[], slotOf: (p: number) => number) {
    const records: number[][] = [], perSlot = new Map<number, number>();
    let dropped = 0;
    for (const r of rotations) {
        const slot = slotOf(r.palette);
        if (!slot) continue;
        const n = perSlot.get(slot) ?? 0;
        if (n >= CYCLES_PER_PALETTE || r.period > MAX_RATE) { dropped++; continue; }
        perSlot.set(slot, n + 1);
        records.push([(slot << 4) | r.first, r.count, (r.direction * r.period) & 0xFF]);
    }
    return { records, dropped };
}

export type { Rotation };
export { paletteCycles };
