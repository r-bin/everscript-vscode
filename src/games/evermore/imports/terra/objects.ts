// Ownership: what a converted Terranigma room's objects and trigger boxes come from, in room cells — map changes,
// doors and pots as objects (state 0 the room as loaded, then each picture the game draws), exits as step-on cells,
// chests, closed doors and pots as B-trigger cells, and what each B-trigger is. Pure. convert.ts turns them into
// Evermore words (docs/terra/evermore-rooms.md).

import * as terra from '../../../terra/decoder';

type Room = NonNullable<ReturnType<typeof terra.loadRoom>>;
type Role = 1 | 2;
/** What a cell becomes: the words on Evermore's layers 1 / 2, layer 0's cell type. */
type CellEdit = { 1?: number; 2?: number; type?: number };
/** An object: its pictures after state 0, by room cell; a map change's bit (`flag`), -1 for a door or a pot. */
type Source = { kind: 'change' | 'door' | 'pot'; flag: number; frames: Map<number, CellEdit>[] };
/**
 * What a B-trigger is, by its `event` (convert.ts's `scriptId`). A door's `exit`: the exit behind it, or null; a door's
 * or pot's `object`: its index among the room's objects (after the map changes).
 */
type BWhat = { kind: 'chest'; chest: number } | { kind: 'exit'; exit: number }
    | { kind: 'door'; exit: number | null; object: number } | { kind: 'pot'; metatile: number; object: number };
type Area = { ox: number; oy: number; w: number; h: number };

const STEP_ON = 0x4000, INTERACT = 0x8000;

/**
 * The room's objects: the map changes of `$99:D4E7` (one picture: the change applied; a change's copied cells are read
 * before the cut, so it still shows them), then its doors and pots (games/terra/decoder props.ts: a door's half-open and
 * open pictures, a pot's lifted one). `roleOf(layer index)`: the Evermore layer a Terranigma layer went to, if any.
 */
function objectSources(rom: Uint8Array, id: number, room: Room, area: Area, roleOf: (index: number) => Role | null): Source[] {
    const { ox, oy, w, h } = area;
    const frameOf = (cells: [number, number, number, number][]) => {
        const out = new Map<number, CellEdit>();
        for (const [index, mx, my, word] of cells) {
            const x = mx - ox, y = my - oy;
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            const c = out.get(y * w + x) ?? {};
            const role = roleOf(index);
            if (role) c[role] = word;
            if (index === 0) c.type = (word >> 9) & 0x1F;
            out.set(y * w + x, c);
        }
        return out;
    };
    const changes: Source[] = terra.roomChanges(rom, id).map((change) => ({ kind: 'change' as const, flag: change.bit, frames: [frameOf(terra.changeCells(room, change))] }));
    // A prop counts where the cell the A check reads is in the room (as its B-trigger, triggerCells).
    const props: Source[] = terra.roomProps(room).filter((p) => p.x >= ox && p.y >= oy && p.x < ox + w && p.y < oy + h)
        .map((p) => ({ kind: p.kind, flag: -1, frames: p.frames.map(frameOf) }));
    return [...changes, ...props].filter((s) => s.frames.every((f) => f.size));
}

/**
 * The trigger cells. An exit is a step-on cell, unless every cell of it is a wall (a closed door, 234 exits): Evermore
 * never runs a step-on trigger the Boy cannot stand on. Behind one of the room's doors it stays a step-on cell, live
 * once the door object is open (`opens`: the step-on bit in its open pictures); else a B-trigger (`doorExits`), as for
 * Mana's doors. Chests, doors and pots are B-trigger cells (`what` says which). `standable(x, y)`: not a full wall; `firstProp`: the
 * first door's or pot's object index (objectSources lists them in the same order).
 */
function triggerCells(rom: Uint8Array, id: number, room: Room, area: Area, standable: (x: number, y: number) => boolean, firstProp: number) {
    const { ox, oy, w, h } = area;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
    const events = new Map<number, number>();         // cell -> STEP_ON / INTERACT bits
    const steps: { x: number; y: number; event: number }[] = [], checks: typeof steps = [];
    const what: BWhat[] = [], opens = new Set<number>();
    const check = (i: number, b: BWhat) => { checks.push({ x: i % w, y: (i / w) | 0, event: what.length }); what.push(b); events.set(i, INTERACT); };

    const exits = terra.roomExits(rom, id);
    const chests = terra.roomChests(rom, id).map((c) => ({ ...c, x: c.x - ox, y: c.y - oy })).filter((c) => inside(c.x, c.y));
    chests.forEach((c, k) => check(c.y * w + c.x, { kind: 'chest', chest: k }));
    const props = terra.roomProps(room).map((p) => ({ ...p, x: p.x - ox, y: p.y - oy })).filter((p) => inside(p.x, p.y));
    const doorAt = new Map(props.filter((p) => p.kind === 'door').map((p) => [p.y * w + p.x, p]));
    const doorExit = new Map<number, number>();
    let doorExits = 0;
    exits.forEach((e, k) => {
        const at: number[] = [];
        for (let y = e.y - oy; y < e.y - oy + e.h; y++) for (let x = e.x - ox; x < e.x - ox + e.w; x++) if (inside(x, y)) at.push(y * w + x);
        const walled = at.length > 0 && at.every((i) => !standable(i % w, (i / w) | 0));
        if (walled) doorExits++;
        const behindDoor = walled && at.every((i) => doorAt.has(i));
        for (const i of at) {
            if (walled && !behindDoor) { check(i, { kind: 'exit', exit: k }); continue; }
            steps.push({ x: i % w, y: (i / w) | 0, event: k });
            if (behindDoor) { opens.add(i); doorExit.set(i, k); } else events.set(i, (events.get(i) ?? 0) | STEP_ON);
        }
    });
    props.forEach((p, k) => {
        const i = p.y * w + p.x, object = firstProp + k;
        check(i, p.kind === 'door' ? { kind: 'door', exit: doorExit.get(i) ?? null, object } : { kind: 'pot', metatile: p.metatile, object });
    });
    return { exits, chests, events, steps, checks, what, opens, stats: { doorExits, doors: doorAt.size, pots: props.length - doorAt.size } };
}

export type { Source, CellEdit, BWhat };
export { objectSources, triggerCells, STEP_ON, INTERACT };
