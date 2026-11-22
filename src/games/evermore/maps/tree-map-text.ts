// Ownership: the text forms of an exploded room's words (docs/open-evermore/resources.md §maps): a metatile's two
// layer words and its collision word, its objects (Section 3 + the object area) and its cuttable grass (Section 4),
// each to readable text and back. Pure; tree-map.ts puts them into files.
//
// Cells are metatile *indices* in hex, as grid.txt writes them; the blob holds ids (base + 8·index).

import { wordSlot } from './custom-animation';
import { tileSlotChr } from './metatiles';

export const hexN = (v: number, n: number) => v.toString(16).padStart(n, '0');

// ── Layer and collision words (room-reference.md §3, §9) ──────────────────────────────────────────────────────
// Layer word: "<graphic> p<palette>[ pr][ h][ v]", the graphic being a name of the room's graphics list ("#2" for
// its second occurrence), "anim<n>" for animation channel n's slot, or "chr<3 hex>" for a character no slot names
// (82 vanilla words use $3F0-$3FF). Collision word: "g<geometry>" then the set flags, in this order:
// "z<plane>" (bits 5-4), "see" (6), "bit7", "gate<n>" (11-8), "front" (12), "walk" (13), "step" (14), "b" (15).

/** The name each graphics slot answers to: a repeated graphic gets `#2`, `#3`, … */
export function slotNames(tiles: string[]): string[] {
    const seen = new Map<string, number>();
    return tiles.map(t => { const k = (seen.get(t) ?? 0) + 1; seen.set(t, k); return k === 1 ? t : `${t}#${k}`; });
}

export function layerText(w: number, slots: string[], channelCount: number): string {
    const chr = w & 0x3FF, slot = wordSlot(w);
    let ref = `chr${hexN(chr, 3)}`;
    if (chr < 0x3F0 && tileSlotChr(slot) === chr) {
        if (slot < slots.length) ref = slots[slot];
        else if (slot - slots.length < channelCount) ref = `anim${slot - slots.length}`;
    }
    return [ref, `p${(w >> 10) & 7}`, ...(w & 0x2000 ? ['pr'] : []), ...(w & 0x4000 ? ['h'] : []), ...(w & 0x8000 ? ['v'] : [])].join(' ');
}

/** A layer word, or why the text is not one. */
export function parseLayer(s: unknown, slots: string[], channelCount: number): number | string {
    if (typeof s !== 'string') return 'a string: "<graphic> p<palette> [pr] [h] [v]"';
    const [ref, ...flags] = s.trim().split(/\s+/);
    let chr: number;
    const anim = /^anim(\d+)$/.exec(ref), raw = /^chr([0-9a-f]{3})$/.exec(ref);
    if (raw) chr = parseInt(raw[1], 16) & 0x3FF;
    else if (anim) {
        if (+anim[1] >= channelCount) return `"${ref}": the room has ${channelCount} animation channels`;
        chr = tileSlotChr(slots.length + +anim[1]);
    } else {
        const slot = slots.indexOf(ref);
        if (slot < 0) return `"${ref}" is not in the room's graphics list`;
        chr = tileSlotChr(slot);
    }
    let w = chr, pal = -1;
    for (const f of flags) {
        const p = /^p([0-7])$/.exec(f);
        if (p) pal = +p[1];
        else if (f === 'pr') w |= 0x2000;
        else if (f === 'h') w |= 0x4000;
        else if (f === 'v') w |= 0x8000;
        else return `"${f}": p0-p7, pr, h, v`;
    }
    if (pal < 0) return 'no palette (p0-p7)';
    return w | (pal << 10);
}

const FLAGS: [string, number][] = [['see', 0x40], ['bit7', 0x80], ['front', 0x1000], ['walk', 0x2000], ['step', 0x4000], ['b', 0x8000]];

export function collisionText(c: number): string {
    const out = [`g${(c & 15).toString(16)}`];
    if (c & 0x30) out.push(`z${(c >> 4) & 3}`);
    if (c & 0x40) out.push('see');
    if (c & 0x80) out.push('bit7');
    if (c & 0xF00) out.push(`gate${((c >> 8) & 15).toString(16)}`);
    for (const [name, bit] of FLAGS.slice(2)) if (c & bit) out.push(name);
    return out.join(' ');
}

/** A collision word, or why the text is not one. */
export function parseCollision(s: unknown): number | string {
    if (typeof s !== 'string') return 'a string: "g<geometry> [z<plane>] [see] [gate<n>] [front] [walk] [step] [b]"';
    let c = 0, geometry = false;
    for (const f of s.trim().split(/\s+/)) {
        const g = /^g([0-9a-f])$/.exec(f), z = /^z([0-3])$/.exec(f), gate = /^gate([0-9a-f])$/.exec(f), flag = FLAGS.find(x => x[0] === f);
        if (g) { c |= parseInt(g[1], 16); geometry = true; }
        else if (z) c |= +z[1] << 4;
        else if (gate) c |= parseInt(gate[1], 16) << 8;
        else if (flag) c |= flag[1];
        else return `"${f}": g0-gf, z0-z3, see, bit7, gate0-gatef, front, walk, step, b`;
    }
    return geometry ? c : 'no geometry (g0-gf)';
}

// ── Objects (room-reference.md §8, map_objects.md §4–§4c) ─────────────────────────────────────────────────────
// An object record is [count] count × [hold, x, y, stamp:2]; a stamp is [w, h] then, per 8 cells, a mask byte (LSB
// first) and a 16-bit XOR delta for each set bit. Descriptor s turns appearance s into s+1 ($90:A4E8). Vanilla
// stores every record first, in order, then every stamp in order (all 127 rooms), which is how they are rebuilt.
// As text, a state is how its cells look once reached: an object's own deltas, applied in order to grid.txt (other
// objects at state 0). "." leaves a cell alone; "^<4 hex>" is a delta written as is (a cell off the grid, or a
// value that is no metatile: never in vanilla).

/** Where the room's cells are: metatile indices row by row, and what ids they stand for. */
export interface Cells { width: number; height: number; cells: number[]; base: number; count: number }

export interface ObjectText { id: number; holds: number[]; states: { at: number[]; cells: string[] }[] }

export function objectsText(offsets: number[], area: Uint8Array, room: Cells, digits: number): ObjectText[] {
    const { width, height, base, count } = room;
    return offsets.map((o, id) => {
        const look = room.cells.map(c => base + 8 * c);
        const holds: number[] = [], states: ObjectText['states'] = [];
        for (let s = 0; s < area[o]; s++) {
            const d = o + 1 + s * 5, x = area[d + 1], y = area[d + 2];
            let p = area[d + 3] | (area[d + 4] << 8);
            const w = area[p], h = area[p + 1], rows: string[][] = Array.from({ length: h }, () => []);
            p += 2;
            let mask = 0;
            for (let k = 0; k < w * h; k++) {
                if (k % 8 === 0) mask = area[p++];
                let token = '.'.padStart(digits);
                if (mask >> (k % 8) & 1) {
                    const delta = area[p] | (area[p + 1] << 8), cx = x + k % w, cy = y + Math.floor(k / w), at = cy * width + cx;
                    p += 2;
                    const on = cx < width && cy < height, next = on ? look[at] ^ delta : -1;
                    if (on) look[at] = next;
                    token = next >= base && (next - base) % 8 === 0 && (next - base) / 8 < count ? hexN((next - base) / 8, digits) : '^' + hexN(delta, 4);
                }
                rows[Math.floor(k / w)].push(token);
            }
            holds.push(area[d]);
            states.push({ at: [x, y], cells: rows.map(r => r.join(' ')) });
        }
        return { id, holds, states };
    });
}

/** Section 3's offsets and the object area, or why the text is not objects (with its JSON pointer). */
export function parseObjects(list: unknown, room: Cells): { offsets: number[]; area: Uint8Array } | { pointer: string; message: string } {
    const { width, height, base, count } = room;
    const fail = (pointer: string, message: string) => ({ pointer, message });
    if (!Array.isArray(list) || list.length > 0xFF) return fail('/list', 'at most 255 objects: { holds, states: [{ at: [x, y], cells: [row, …] }, …] }');
    const records: number[][] = [], stamps: number[][] = [];
    for (let i = 0; i < list.length; i++) {
        const o = list[i], p = `/list/${i}`;
        if (o?.id !== undefined && o.id !== i) return fail(`${p}/id`, `${o.id} is object ${i}: ids are positions, in order (scripts use them)`);
        if (!o || !Array.isArray(o.states) || o.states.length > 0xFF) return fail(`${p}/states`, 'at most 255 states');
        if (!Array.isArray(o.holds) || o.holds.length !== o.states.length || !o.holds.every((h: unknown) => Number.isInteger(h) && (h as number) >= 0 && (h as number) <= 0xFF))
            return fail(`${p}/holds`, `${o.states.length} bytes: ticks each state is held on the way through (the first is never read)`);
        const look = room.cells.map(c => base + 8 * c), record = [o.states.length];
        for (let s = 0; s < o.states.length; s++) {
            const st = o.states[s], sp = `${p}/states/${s}`;
            if (!st || !Array.isArray(st.at) || st.at.length !== 2 || !st.at.every((v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 0xFF))
                return fail(`${sp}/at`, '[x, y]: bytes');
            if (!Array.isArray(st.cells) || !st.cells.length || st.cells.length > 0xFF || !st.cells.every((r: unknown) => typeof r === 'string'))
                return fail(`${sp}/cells`, '1-255 rows of cells: "." or a metatile id in hex');
            const rows = (st.cells as string[]).map(r => r.trim().split(/\s+/)), w = rows[0].length;
            if (w > 0xFF || rows.some(r => r.length !== w)) return fail(`${sp}/cells`, `rows of the same length, at most 255 (the first has ${w})`);
            const [x, y] = st.at, stamp = [w, rows.length];
            let mask = 0, maskAt = -1;
            for (let k = 0; k < w * rows.length; k++) {
                if (k % 8 === 0) { maskAt = stamp.length; stamp.push(0); mask = 0; }
                const t = rows[Math.floor(k / w)][k % w], cx = x + k % w, cy = y + Math.floor(k / w), at = cy * width + cx;
                const raw = /^\^([0-9a-f]{4})$/.exec(t);
                let delta: number;
                if (t === '.') continue;
                if (raw) delta = parseInt(raw[1], 16);
                else if (/^[0-9a-f]{1,4}$/.test(t) && parseInt(t, 16) < count) {
                    if (cx >= width || cy >= height) return fail(`${sp}/cells/${Math.floor(k / w)}`, `cell ${k % w} is off the grid: write "^<delta>"`);
                    const next = base + 8 * parseInt(t, 16);
                    delta = look[at] ^ next;
                    look[at] = next;
                } else return fail(`${sp}/cells/${Math.floor(k / w)}`, `"${t}": ".", a metatile id below ${hexN(count, 3)} or "^<4 hex>"`);
                if (raw && cx < width && cy < height) look[at] ^= delta;   // the same walk objectsText takes
                stamp[maskAt] = mask |= 1 << (k % 8);
                stamp.push(delta & 0xFF, delta >> 8);
            }
            record.push(o.holds[s], x, y, 0, 0);
            stamps.push(stamp);
        }
        records.push(record);
    }
    // Records first, then stamps, both in order (vanilla's layout); a descriptor's offset is its stamp's.
    const offsets: number[] = [], area: number[] = [];
    let at = records.reduce((n, r) => n + r.length, 0), si = 0;
    for (const r of records) {
        offsets.push(area.length);
        for (let s = 0; s < r[0]; s++) { r[4 + s * 5] = at & 0xFF; r[5 + s * 5] = at >> 8; at += stamps[si++].length; }
        area.push(...r);
    }
    for (const s of stamps) area.push(...s);
    if (area.length > 0xFFFF) return fail('/list', `${area.length} bytes of objects; offsets are 16-bit`);
    return { offsets, area: Uint8Array.from(area) };
}

// ── Cuttable grass (Section 4, cuttable_grass_mechanics.md) ───────────────────────────────────────────────────
// [sources] then records [steps] [word]… [0]: the first word is a metatile the Boy can cut, the rest what is stamped
// in its place. `sources` is how many distinct metatiles are cut; it is also the Markov grid's first counter
// ($0FC4), so it is written from the list (vanilla agrees in all 7 rooms) unless `grassSources` says otherwise.

export interface GrassText { cut: string; into: string[]; steps?: number }

export function grassText(section4: Uint8Array, base: number, count: number, digits: number): { list: GrassText[]; sources?: number } {
    const word = (v: number) => v >= base && (v - base) % 8 === 0 && (v - base) / 8 < count ? hexN((v - base) / 8, digits) : '#' + hexN(v, 4);
    const list: GrassText[] = [];
    for (let p = 1; p < section4.length;) {
        const steps = section4[p++], words: number[] = [];
        for (;;) { const v = section4[p] | (section4[p + 1] << 8); p += 2; if (!v) break; words.push(v); }
        list.push({ cut: word(words[0]), into: words.slice(1).map(word), ...(steps !== 1 ? { steps } : {}) });
    }
    const sources = section4.length ? section4[0] : 0;
    return { list, ...(sources !== new Set(list.map(g => g.cut)).size ? { sources } : {}) };
}

/** Section 4's bytes, or why the text is not grass. */
export function parseGrass(list: unknown, sources: unknown, base: number, count: number): Uint8Array | { pointer: string; message: string } {
    if (!Array.isArray(list)) return { pointer: '/list', message: 'a list of { cut, into: [metatile, …] }' };
    const out: number[] = [0];
    const word = (t: unknown): number | null => {
        if (typeof t !== 'string') return null;
        const raw = /^#([0-9a-f]{4})$/.exec(t);
        if (raw) return parseInt(raw[1], 16) || null;
        return /^[0-9a-f]{1,4}$/.test(t) && parseInt(t, 16) < count ? base + 8 * parseInt(t, 16) : null;
    };
    for (let i = 0; i < list.length; i++) {
        const g = list[i], steps = g?.steps ?? 1;
        const words = [g?.cut, ...(Array.isArray(g?.into) ? g.into : [null])].map(word);
        if (!Number.isInteger(steps) || steps < 0 || steps > 0xFF) return { pointer: `/list/${i}/steps`, message: 'a byte' };
        if (words.some(w => w === null)) return { pointer: `/list/${i}`, message: `cut and into: metatile ids below ${hexN(count, 3)} (or "#<4 hex>", not 0)` };
        out.push(steps);
        for (const w of words as number[]) out.push(w & 0xFF, w >> 8);
        out.push(0, 0);
    }
    const distinct = new Set(list.map((g: GrassText) => g.cut)).size;
    if (sources !== undefined && !(Number.isInteger(sources) && (sources as number) >= 0 && (sources as number) <= 0xFF))
        return { pointer: '/grassSources', message: 'a byte' };
    out[0] = sources === undefined ? distinct : sources as number;
    if (out.length > 0xFFFF) return { pointer: '/list', message: 'over 64 KiB' };
    return Uint8Array.from(out);
}
