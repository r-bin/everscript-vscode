// Ownership: the text forms of an exploded room's words (docs/open-evermore/resources.md §maps): a metatile's two
// layer words and its collision word, its objects (Section 3 + the object area) and its cuttable grass (Section 4),
// each to readable text and back. Pure; tree-map.ts puts them into files.
//
// Cells are metatile *indices* in hex, as grid.txt writes them; the blob holds ids (base + 8·index).

import { wordSlot } from './custom-animation';
import { tileSlotChr } from './metatiles';

export const hexN = (v: number, n: number) => v.toString(16).padStart(n, '0');

// ── Layer and collision words (room-reference.md §3, §9) ──────────────────────────────────────────────────────
// Layer word: "<graphic> <palette>[ pr][ h][ v]", the graphic being a name of the room's graphics list ("#2" for
// its second occurrence), "anim<n>" for animation channel n's slot, or "chr<3 hex>" for a character no slot names
// (82 vanilla words use $3F0-$3FF); the palette a name of the room's palette list, its first set (BG palette n is
// list entry n-1; a room with more than 7 swaps sets through MAP_PALETTE), or "p<n>" for one the list does not
// name (p0, the HUD's).

/** The name each graphics slot answers to: a repeated graphic gets `#2`, `#3`, … */
export function slotNames(tiles: string[]): string[] {
    const seen = new Map<string, number>();
    return tiles.map(t => { const k = (seen.get(t) ?? 0) + 1; seen.set(t, k); return k === 1 ? t : `${t}#${k}`; });
}

/** BG palettes 1-7 load the first 7 of a room's palettes ($90:D020). */
export const PALETTE_SET = 7;
/** The names BG palettes 1-7 answer to: the room's first set of palettes, a repeated one as `#2`. */
export const paletteSlots = (palettes: string[]): string[] => slotNames(palettes.slice(0, PALETTE_SET));

export function layerText(w: number, slots: string[], channelCount: number, palettes: string[] = []): string {
    const chr = w & 0x3FF, slot = wordSlot(w), pal = (w >> 10) & 7;
    let ref = `chr${hexN(chr, 3)}`;
    if (chr < 0x3F0 && tileSlotChr(slot) === chr) {
        if (slot < slots.length) ref = slots[slot];
        else if (slot - slots.length < channelCount) ref = `anim${slot - slots.length}`;
    }
    const palette = pal >= 1 && pal <= palettes.length ? palettes[pal - 1] : `p${pal}`;
    return [ref, palette, ...(w & 0x2000 ? ['pr'] : []), ...(w & 0x4000 ? ['h'] : []), ...(w & 0x8000 ? ['v'] : [])].join(' ');
}

/** A layer word, or why the text is not one. */
export function parseLayer(s: unknown, slots: string[], channelCount: number, palettes: string[] = []): number | string {
    if (typeof s !== 'string') return 'a string: "<graphic> <palette> [pr] [h] [v]"';
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
        const p = /^p([0-7])$/.exec(f), named = palettes.indexOf(f);
        if (f === 'pr') w |= 0x2000;
        else if (f === 'h') w |= 0x4000;
        else if (f === 'v') w |= 0x8000;
        else if (p) pal = +p[1];
        else if (named >= 0) pal = named + 1;
        else return `"${f}": a palette of the room's first ${PALETTE_SET} (${palettes.join(', ') || 'none'}) or p0-p7; pr, h, v`;
    }
    if (pal < 0) return 'no palette';
    return w | (pal << 10);
}

// Collision word: words joined by "_", in this order: the geometry, "plane<n>" (bits 5-4), then the set flags
// "see_through" (6), "bit7", the gate (11-8), "in_front" (12), "step_on" (14), "b_trigger" (15). The geometry
// names bits 3-0 and 13 together: without bit 13 the solid part of the cell (`half_s`: its south half is solid;
// `corner_sw`: the triangle in its south-west; `_2` for the second code with the same shape, which the engine tells
// apart in ways not known yet); with it the cell is always walkable and bits 3-0 the drift (`drift_n`), the
// diagonal stairs' push (`stairs_ne`: walking east goes north) or nothing (`walk`, `walk_3`-`walk_7`).

const GEOMETRY = ['open', 'corner_se', 'corner_sw', 'half_s', 'half_s_2', 'corner_se_2', 'corner_sw_2', 'half_w',
    'half_e', 'corner_ne', 'corner_nw', 'half_n', 'half_n_2', 'corner_ne_2', 'corner_nw_2', 'solid'];
const WALK = ['walk', 'stairs_ne', 'stairs_se', 'walk_3', 'walk_4', 'walk_5', 'walk_6', 'walk_7',
    'drift_n', 'drift_ne', 'drift_e', 'drift_se', 'drift_nw', 'drift_w', 'drift_sw', 'drift_s'];
/** Gate nibbles with a known effect (collision.ts entityGate, spriteHiddenOn); others are `gate_<hex>`. */
const GATES: Record<number, string> = { 3: 'blocks_others', 5: 'blocks_dog', 7: 'blocks_boy_dog', 8: 'hides_sprite' };
const FLAGS: [string, number, keyof CollisionFields][] = [
    ['see_through', 0x40, 'seeThrough'], ['bit7', 0x80, 'bit7'], ['in_front', 0x1000, 'inFront'], ['step_on', 0x4000, 'stepOn'], ['b_trigger', 0x8000, 'bTrigger'],
];
const gateName = (n: number) => GATES[n] ?? `gate_${n.toString(16)}`;
/** Every word a collision name is made of, longest first (a name is split by longest match). */
const VOCABULARY = [...GEOMETRY, ...WALK, ...[0, 1, 2, 3].map(p => `plane${p}`), ...FLAGS.map(f => f[0]),
    ...Array.from({ length: 16 }, (_, n) => gateName(n)), ...Array.from({ length: 16 }, (_, n) => `gate_${n.toString(16)}`)]
    .sort((a, b) => b.split('_').length - a.split('_').length);

/** A collision word as its fields: what a collision file (maps/collisions/) holds. */
export interface CollisionFields {
    geometry: string; plane: number; seeThrough: boolean; gate: string | null; inFront: boolean; stepOn: boolean; bTrigger: boolean; bit7?: boolean;
}

export function collisionFields(c: number): CollisionFields {
    const gate = (c >> 8) & 15;
    return {
        geometry: (c & 0x2000 ? WALK : GEOMETRY)[c & 15], plane: (c >> 4) & 3, seeThrough: !!(c & 0x40), gate: gate ? gateName(gate) : null,
        inFront: !!(c & 0x1000), stepOn: !!(c & 0x4000), bTrigger: !!(c & 0x8000), ...(c & 0x80 ? { bit7: true } : {}),
    };
}

/** A collision file's fields as a word, or why they are not one (with the field). */
export function collisionOfFields(v: any): number | { field: string; message: string } {
    const bad = (field: string, message: string) => ({ field, message });
    if (!v || typeof v !== 'object') return bad('', 'an object: { geometry, plane, seeThrough, gate, inFront, stepOn, bTrigger }');
    const g = GEOMETRY.indexOf(v.geometry), walk = WALK.indexOf(v.geometry);
    if (g < 0 && walk < 0) return bad('geometry', `"${v.geometry}": ${GEOMETRY.join(', ')}; always walkable: ${WALK.join(', ')}`);
    if (!Number.isInteger(v.plane) || v.plane < 0 || v.plane > 3) return bad('plane', '0-3');
    let c = (g >= 0 ? g : walk | 0x2000) | (v.plane << 4);
    if (v.gate !== null && v.gate !== undefined) {
        const n = Array.from({ length: 16 }, (_, k) => k).find(k => gateName(k) === v.gate || `gate_${k.toString(16)}` === v.gate);
        if (n === undefined) return bad('gate', `"${v.gate}": null, ${Object.values(GATES).join(', ')} or gate_<hex>`);
        c |= n << 8;
    }
    for (const [, bit, key] of FLAGS) {
        if (v[key] === undefined && key === 'bit7') continue;
        if (typeof v[key] !== 'boolean') return bad(key, 'true or false');
        if (v[key]) c |= bit;
    }
    return c;
}

export function collisionText(c: number): string {
    const f = collisionFields(c);
    return [f.geometry, `plane${f.plane}`, ...(f.seeThrough ? ['see_through'] : []), ...(f.bit7 ? ['bit7'] : []), ...(f.gate ? [f.gate] : []),
        ...(f.inFront ? ['in_front'] : []), ...(f.stepOn ? ['step_on'] : []), ...(f.bTrigger ? ['b_trigger'] : [])].join('_');
}

/** A collision name (`solid_plane1_in_front`), or why it is not one. */
export function parseCollision(s: unknown): number | string {
    const usage = 'a collision name: the geometry, plane<n>, then see_through, the gate, in_front, step_on, b_trigger (solid_plane1_in_front)';
    if (typeof s !== 'string' || !s) return usage;
    const parts = s.split('_'), words: string[] = [];
    for (let i = 0; i < parts.length;) {
        const w = VOCABULARY.find(v => v.split('_').every((p, k) => parts[i + k] === p));
        if (!w) return `"${s}": no word at "${parts.slice(i).join('_')}"; ${usage}`;
        words.push(w);
        i += w.split('_').length;
    }
    const geometry = words.filter(w => GEOMETRY.includes(w) || WALK.includes(w)), planes = words.filter(w => /^plane\d$/.test(w));
    const gates = words.filter(w => Object.values(GATES).includes(w) || /^gate_[0-9a-f]$/.test(w));
    if (geometry.length !== 1) return `"${s}": one geometry (${GEOMETRY[0]}, ${GEOMETRY[15]}, half_s, corner_sw, walk, drift_n, …)`;
    if (planes.length > 1 || gates.length > 1 || new Set(words).size !== words.length) return `"${s}": each word once`;
    const v: Record<string, unknown> = { geometry: geometry[0], plane: planes.length ? +planes[0].slice(5) : 0, gate: gates[0] ?? null };
    for (const [name, , key] of FLAGS) v[key] = words.includes(name);
    const c = collisionOfFields(v);
    return typeof c === 'number' ? c : `"${s}": ${c.message}`;
}

/** What a collision word does, in a sentence (collision files, for the reader). */
export function collisionWhat(c: number): string {
    const f = collisionFields(c), out: string[] = [];
    const shape = (g: string) => {
        if (g === 'open' || g === 'solid') return g === 'open' ? 'Open' : 'Solid';
        const [form, dir, second] = g.split('_');
        return `The ${dir.toUpperCase()} ${form === 'half' ? 'half' : 'triangle'} is solid${second ? ' (the second code of that shape)' : ''}`;
    };
    if (c & 0x2000) out.push(f.geometry.startsWith('drift') ? `Always walkable; drifts ${f.geometry.slice(6).toUpperCase()}` : f.geometry.startsWith('stairs') ? `Always walkable; diagonal stairs, walking east goes ${f.geometry === 'stairs_ne' ? 'north' : 'south'}` : 'Always walkable');
    else out.push(shape(f.geometry));
    out.push(`on plane ${f.plane}` + (f.seeThrough ? ', open from the other planes (see-through)' : ''));
    const gate: Record<string, string> = { blocks_others: 'solid for everyone but the Boy and the Dog', blocks_dog: 'solid for the Dog', blocks_boy_dog: 'solid for the Boy and the Dog', hides_sprite: 'a character here is not drawn' };
    if (f.gate) out.push(gate[f.gate] ?? `gate nibble ${f.gate.slice(5)} (no known effect)`);
    out.push(f.inFront ? 'a character here is drawn in front of the canopy' : 'a character here is drawn behind the canopy');
    if (f.stepOn) out.push('a step-on trigger fires here');
    if (f.bTrigger) out.push('B here runs a B trigger');
    if (f.bit7) out.push('bit 7 set (never in vanilla)');
    return out.join('; ') + '.';
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
