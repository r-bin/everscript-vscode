// Ownership: the text forms of an exploded room's words (docs/open-evermore/resources.md §maps): a metatile's two
// layer words and its collision word, its objects (Section 3 + the object area) and its cuttable grass (Section 4),
// each to readable text and back. Pure; tree-map.ts puts them into files.
//
// Cells are metatile *indices* in hex, as grid.txt writes them; the blob holds ids (base + 8·index).

import { wordSlot } from './custom-animation';
import { tileSlotChr } from './metatiles';

export const hexN = (v: number, n: number) => v.toString(16).padStart(n, '0');

// ── Layer and collision words (room-reference.md §3, §9) ──────────────────────────────────────────────────────
// Layer word (front = BG1, back = BG2): { tile, palette?, over?, flipH?, flipV? }. `tile`: a name of the room's
// graphics list ("#2" for its second occurrence), "anim<n>" for animation channel n's slot, or "chr<3 hex>" for a
// character no slot names (82 vanilla words use $3F0-$3FF). `palette`: a name of the room's palette list, its first
// set (BG palette n is list entry n-1; a room with more than 7 swaps sets through MAP_PALETTE), or "p<n>" for one
// the list does not name (p0, the HUD's); left out, BG palette 1 (the list's first). `over` (bit 13, BG priority):
// drawn over the sprites. `flipH` (14), `flipV` (15). Each only when set.

/** The name each graphics slot answers to: a repeated graphic gets `#2`, `#3`, … */
export function slotNames(tiles: string[]): string[] {
    const seen = new Map<string, number>();
    return tiles.map(t => { const k = (seen.get(t) ?? 0) + 1; seen.set(t, k); return k === 1 ? t : `${t}#${k}`; });
}

/** BG palettes 1-7 load the first 7 of a room's palettes ($90:D020). */
export const PALETTE_SET = 7;
/** The names BG palettes 1-7 answer to: the room's first set of palettes, a repeated one as `#2`. */
export const paletteSlots = (palettes: string[]): string[] => slotNames(palettes.slice(0, PALETTE_SET));
/** The BG palette a layer without `palette` uses. */
const DEFAULT_PALETTE = 1;

/** A layer word's fields, in the order metatiles.json writes them. */
export interface LayerFields { tile: string; palette?: string; over?: true; flipH?: true; flipV?: true }
const LAYER_FLAGS: [keyof LayerFields, number][] = [['over', 0x2000], ['flipH', 0x4000], ['flipV', 0x8000]];
/** The keys a layer takes. */
const LAYER_KEYS = ['tile', 'palette', ...LAYER_FLAGS.map(f => f[0])];

export function layerFields(w: number, slots: string[], channelCount: number, palettes: string[] = []): LayerFields {
    const chr = w & 0x3FF, slot = wordSlot(w), pal = (w >> 10) & 7;
    let tile = `chr${hexN(chr, 3)}`;
    if (chr < 0x3F0 && tileSlotChr(slot) === chr) {
        if (slot < slots.length) tile = slots[slot];
        else if (slot - slots.length < channelCount) tile = `anim${slot - slots.length}`;
    }
    const f: LayerFields = { tile };
    if (pal !== DEFAULT_PALETTE) f.palette = pal >= 1 && pal <= palettes.length ? palettes[pal - 1] : `p${pal}`;
    for (const [key, bit] of LAYER_FLAGS) if (w & bit) (f as any)[key] = true;
    return f;
}

/** A layer word, or why the fields are not one. */
export function parseLayer(v: any, slots: string[], channelCount: number, palettes: string[] = []): number | string {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return 'an object: { tile, palette?, over?, flipH?, flipV? }';
    const unknown = Object.keys(v).find(k => !LAYER_KEYS.includes(k));
    if (unknown) return `"${unknown}": a layer takes ${LAYER_KEYS.join(', ')}`;
    const ref = v.tile;
    if (typeof ref !== 'string') return 'tile: a name of the room\'s graphics list, anim<n> or chr<3 hex>';
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
    let pal = DEFAULT_PALETTE;
    if (v.palette !== undefined) {
        const p = /^p([0-7])$/.exec(v.palette), named = palettes.indexOf(v.palette);
        if (p) pal = +p[1];
        else if (named >= 0) pal = named + 1;
        else return `palette "${v.palette}": one of the room's first ${PALETTE_SET} (${palettes.join(', ') || 'none'}) or p0-p7`;
    }
    let w = chr | (pal << 10);
    for (const [key, bit] of LAYER_FLAGS) {
        if (v[key] === undefined || v[key] === false) continue;
        if (v[key] !== true) return `${key}: true, or leave it out`;
        w |= bit;
    }
    return w;
}

// Collision word, as a metatile's fields (the Rooms editor's split: the Collision tab's form, the Level bar, the
// Special tab's flags). `collision`: the form, which part of the cell is solid (bits 3-0), by the editor's names: the
// diagonal twins "slide" or "stop" ($8FA3F8 / $8FA418: three open compass points and a slide entry, or one point and
// none; unconfirmed in game), 0x4 and 0xB are open in both tables and in no vanilla room. `alwaysWalkable` instead
// when bit 13 is set: bits 3-0 then say how the cell moves you (stairs, drift, nothing), and there is no form.
// `level` (bits 5-4), left out when 1 (91 % of vanilla metatiles). Then only what is set: `seeThrough` (6), `gate` (11-8), `inFront` (12), `stepOn` (14),
// `interact` (15), `bit7` (never in vanilla).

/** The 16 forms by code; the collisions kind (maps/collisions/) may rename them. */
export const COLLISION_FORMS = ['open', 'diagonal_se_slides', 'diagonal_sw_slides', 'bottom_half', 'bottom_half_unused', 'diagonal_se_stops',
    'diagonal_sw_stops', 'left_half', 'right_half', 'diagonal_ne_stops', 'diagonal_nw_stops', 'top_half_unused', 'top_half', 'diagonal_ne_slides',
    'diagonal_nw_slides', 'solid'];
/** Bit 13's nibble ($8FAD9F): the Special tab's Stairs & Drift; 3-7 share one handler (no push). */
const ALWAYS_WALKABLE = ['stairs_vertical', 'stairs_diagonal_r', 'stairs_diagonal_l', 'walkable_3', 'walkable', 'walkable_5', 'walkable_6', 'walkable_7',
    'drift_n', 'drift_ne', 'drift_e', 'drift_se', 'drift_nw', 'drift_w', 'drift_sw', 'drift_s'];
/** Gate nibbles by what they do (collision.ts entityGate, spriteHiddenOn; Deflect is the editor's unconfirmed reading). */
const GATES: Record<number, string> = { 1: 'deflect', 3: 'blocks_others', 5: 'blocks_dog', 7: 'blocks_boy_and_dog', 8: 'hides_character' };
const gateName = (n: number) => GATES[n] ?? `gate_${n.toString(16)}`;
/** The level a metatile without `level` stands on. */
export const DEFAULT_LEVEL = 1;
const FLAGS: [string, number][] = [['seeThrough', 0x40], ['inFront', 0x1000], ['stepOn', 0x4000], ['interact', 0x8000], ['bit7', 0x80]];

/** A metatile's collision fields, in the order metatiles.json writes them. */
export interface CollisionFields {
    collision?: string; alwaysWalkable?: string; level?: number; gate?: string;
    seeThrough?: true; inFront?: true; stepOn?: true; interact?: true; bit7?: true;
}
/** The keys a metatile's collision takes (the round trip and the parser know them). */
export const COLLISION_KEYS = ['collision', 'alwaysWalkable', 'level', 'gate', ...FLAGS.map(f => f[0])];

/** A collision word as a metatile's fields; `form`: a form's name by code (the tree's collisions kind). */
export function collisionFields(c: number, form: (code: number) => string = k => COLLISION_FORMS[k]): CollisionFields {
    const gate = (c >> 8) & 15, level = (c >> 4) & 3, out: CollisionFields = level === DEFAULT_LEVEL ? {} : { level };
    const f: CollisionFields = c & 0x2000 ? { alwaysWalkable: ALWAYS_WALKABLE[c & 15], ...out } : { collision: form(c & 15), ...out };
    if (gate) f.gate = gateName(gate);
    for (const [key, bit] of FLAGS) if (c & bit) (f as any)[key] = true;
    return f;
}

/** A metatile's collision fields as a word, or why they are not one (with the field); `form`: a form's code by name. */
export function collisionOfFields(v: any, form: (name: string) => number | undefined = n => { const k = COLLISION_FORMS.indexOf(n); return k < 0 ? undefined : k; }): number | { field: string; message: string } {
    const bad = (field: string, message: string) => ({ field, message });
    let c: number;
    if (v?.alwaysWalkable !== undefined) {
        if (v.collision !== undefined) return bad('collision', 'none on an always-walkable cell (its bits are alwaysWalkable\'s)');
        const k = ALWAYS_WALKABLE.indexOf(v.alwaysWalkable);
        if (k < 0) return bad('alwaysWalkable', `"${v.alwaysWalkable}": ${ALWAYS_WALKABLE.join(', ')}`);
        c = 0x2000 | k;
    } else {
        const k = typeof v?.collision === 'string' ? form(v.collision) : undefined;
        if (k === undefined) return bad('collision', `"${v?.collision}": a form (${COLLISION_FORMS.join(', ')}), or alwaysWalkable instead`);
        c = k;
    }
    const level = v.level ?? DEFAULT_LEVEL;
    if (!Number.isInteger(level) || level < 0 || level > 3) return bad('level', '0-3, or leave it out for 1');
    c |= level << 4;
    if (v.gate !== undefined) {
        const n = Array.from({ length: 16 }, (_, k) => k).find(k => k && (gateName(k) === v.gate || `gate_${k.toString(16)}` === v.gate));
        if (n === undefined) return bad('gate', `"${v.gate}": ${Object.values(GATES).join(', ')} or gate_<hex>`);
        c |= n << 8;
    }
    for (const [key, bit] of FLAGS) {
        if (v[key] === undefined || v[key] === false) continue;
        if (v[key] !== true) return bad(key, 'true, or leave it out');
        c |= bit;
    }
    return c;
}

/** What a form does, in a sentence (collision files, for the reader). */
export function collisionFormWhat(code: number): string {
    const name = COLLISION_FORMS[code];
    if (name === 'open') return 'Nothing in the cell is solid.';
    if (name === 'solid') return 'The whole cell is solid.';
    if (name.endsWith('_unused')) return `Solid like ${name.replace('_unused', '').replace('_', ' ')}, but open in both of the engine's tables ($8FA3F8, $8FA418); no vanilla room uses it.`;
    const [form, dir, how] = name.split('_');
    if (form === 'diagonal') return `The ${dir.toUpperCase()} triangle is solid; ${how === 'slides' ? 'you slide along it (three compass points open, a slide entry)' : 'it stops you (one compass point open, no slide entry)'} — unconfirmed in game.`;
    return `The ${form} half is solid.`;
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
