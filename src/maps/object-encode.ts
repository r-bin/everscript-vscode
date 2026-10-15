// Ownership: Section 3, the room's objects — each placed object's record and the
// state descriptors the engine XORs into the grid one after another. Pure.
// Split out of custom-room.ts so every room builder (custom maps, own-room.ts)
// encodes objects one way. See docs/map-format/rom-export.md.

import type { CustomObjectInput } from './custom-room';

/** Descriptor `s`'s byte 0: the ticks state `s` is held, 0..255. */
export const DEFAULT_OBJECT_HOLD = 1;
function objectHold(obj: CustomObjectInput, s: number): number {
    const v = obj.holds && obj.holds[s];
    if (typeof v !== 'number' || !Number.isFinite(v)) return s === 0 ? 0 : DEFAULT_OBJECT_HOLD;
    return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * The object list and area for `objects` over `grid` (metatile ids, `base + idx * 8`);
 * `key` finds a frame's `{layer1, layer2, collision}` in the dictionary.
 */
export function encodeObjectArea(objects: CustomObjectInput[], grid: number[], key: Map<string, number>,
    base: number, w: number): { objectOffsets: number[]; objectArea: Uint8Array } {
    const objectOffsets: number[] = [];
    const objectAreaSink: number[] = [];
    const validObjects = objects.filter((o) => (o.frames || []).length > 0);

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
                const idx = key.get(kStr);
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

    return { objectOffsets, objectArea: Uint8Array.from(objectAreaSink) };
}
