// Ownership: where the Boy starts by default in a converted room (Play in emulator; the editor's
// start marker moves it). Reads only Evermore collision words. Pure; game-neutral.

/**
 * Where the Boy starts by default: the cell nearest the middle that is plain floor with plain
 * floor around it (geometry 0 and no stair or current, on the cell and its eight neighbours).
 */
function defaultStart(room: { widthTiles: number; heightTiles: number; cells: number[] }): { x: number; y: number } {
    const w = room.widthTiles, h = room.heightTiles;
    // Plain floor: geometry 0 and not always-walkable (bit 13: a stair or a current, whose low nibble is a direction).
    const open = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !(room.cells[(y * w + x) * 3 + 2] & 0x200F);
    const roomy = (x: number, y: number) => [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => open(x + dx, y + dy)));
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    let best: { x: number; y: number } | null = null, bestD = Infinity;
    for (const pass of [roomy, open]) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const d = (x - cx) ** 2 + (y - cy) ** 2;
            if (d < bestD && pass(x, y)) { bestD = d; best = { x, y }; }
        }
        if (best) return best;
    }
    return { x: Math.floor(w / 2), y: Math.floor(h / 2) };
}

export { defaultStart };
