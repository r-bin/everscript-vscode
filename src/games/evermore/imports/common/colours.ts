// Ownership: BGR555 colour distance and the nearest colour of a 16-colour palette, for redrawing a
// converted tile in one palette (imports/mana, imports/terra graphics.ts). Pure; SNES colours only.

const rgb = (c: number): number[] => [c & 31, (c >> 5) & 31, (c >> 10) & 31];

/** Squared distance between two BGR555 colours. */
function dist(a: number, b: number): number {
    const x = rgb(a), y = rgb(b);
    return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2;
}

/**
 * The colour of palette `to` (index 1..15) nearest to BGR555 `colour`, never one that rotates
 * (`rotating`, CGRAM indices): a redrawn pixel would blink with a cycle it is not part of.
 */
function nearest(cgram: Uint16Array, colour: number, to: number, rotating: ReadonlySet<number>): number {
    const want = rgb(colour);
    let best = 1, bestD = Infinity;
    for (let k = 1; k < 16; k++) {
        if (rotating.has(to * 16 + k)) continue;
        const have = rgb(cgram[to * 16 + k]);
        const d = (want[0] - have[0]) ** 2 + (want[1] - have[1]) ** 2 + (want[2] - have[2]) ** 2;
        if (d < bestD) { bestD = d; best = k; }
    }
    return best;
}

export { rgb, dist, nearest };
