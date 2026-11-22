// Ownership: trigger cells as an Evermore room's trigger boxes (step-on, B-trigger), for every
// converted room (imports/mana, imports/terra). Pure; game-neutral.

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

export type { Box };
export { triggerBoxes };
