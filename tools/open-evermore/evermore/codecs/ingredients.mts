// The ingredients kind grown past vanilla's 22 (docs/todo/growable-items.md, docs/open-evermore/resources.md §alchemy).
// Ids 0-21 are records read in place (records.mts, wrapped here); a file past them is a new ingredient:
//   { "text": "Salt", "held": "temp[198]", "icon": "crystal" }
// text its name, held the WRAM word that counts it (a `temp[]` cell: wiped on every room load and not saved, the
// owner's choice until WRAM can be allocated), icon the vanilla ingredient whose icon it shows. With 22 ingredients
// every byte below stays vanilla; with more, implode generates three items and rewrites the code that reads them.
//
// Facts used (disassembly 2026-11-23, every reader the CDL library and a static operand scan know):
//   counts  `$22FF + id`, a byte (consumables follow at $2315). Read and written at 11 sites, each replaced by a
//           `jsl` of the same length into the generated hooks: `lda.l $7E22FF,x` (16-bit A) at $8D:C1AD, $8D:C2CE
//           (alchemy screen), $8E:A923 (a ring's held count), $91:CDF1, $91:CE1E (cast: count − cost, as a word) and
//           `sta.l` at $91:CDF8, $91:CE25; 8-bit A at $91:CE4C, $91:CE70 (casts left); the shop's buy
//           `ldx $12 : sep #$20 : lda $22FF,x` ($8E:8DC5, 7 bytes) and `sta $22FF,x : rep #$20` ($8E:8DDF, 5 bytes).
//           X is 16 bits at every site; no site reads the flags the load set (each masks, adds or stores next)
//   names   the alchemy screen's list is the one reader of $C4:5FF3 (`lda.l $C45FF3,x` at $8D:C1F6), the bank from
//           `lda #$C460 : sta $23` ($8D:C1F1, the high byte): moved to a generated table + strings in one bank
//   icons   22 long pointers at $C4:5CC7 (3 bytes an id), read as `lda.l $C45CC7,x` / `$C45CC8,x` at five pairs of
//           sites (alchemy screen list, formula cards): moved to a generated table
//   bounds  the alchemy screen's two loops `ldx #$0015` ($8D:C1AA, $8D:C2CB) count down from the last id
import type { Codec, ImplodeContext, Item, Span, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, readText } from '../../tree.mts';
import { HOOKS_LENGTH, hooks, LDA, le24, STA, VANILLA_INGREDIENTS } from './ingredient-hooks.mts';
import { wramAt, wramText } from './records.mts';

/** Ids an ingredient may have: bytes in the formulas' cost, and `temp[]` has 100 words for the new ones. */
const LIMIT = 64;
const MIB4 = 0x400000, TEMP = 0x2834, TEMP_SIZE = 200;

const NAMES_KEY = 'ingredients/_names', ICONS_KEY = 'ingredients/_icons', HOOKS_KEY = 'ingredients/_hooks';
const NAME_BANK = 0x0DC1F3, NAME_TABLE = 0x0DC1F7, VANILLA_NAME_TABLE = 0xC45FF3;
const ICON_SITES = [0x0DBE5E, 0x0DBE99, 0x0DC307, 0x0DC8A6, 0x0DC8DC], VANILLA_ICONS = 0xC45CC7, ICON_TABLE = 0x045CC7;
const BOUNDS = [0x0DC1AB, 0x0DC2CC];
const GET16 = [0x0DC1AD, 0x0DC2CE, 0x0EA923, 0x11CDF1, 0x11CE1E], PUT16 = [0x11CDF8, 0x11CE25], GET8 = [0x11CE4C, 0x11CE70];
const SHOP_GET = 0x0E8DC5, SHOP_PUT = 0x0E8DDF;
const VANILLA_SHOP_GET = [0xA6, 0x12, 0xE2, 0x20, 0xBD, 0xFF, 0x22], VANILLA_SHOP_PUT = [0x9D, 0xFF, 0x22, 0xC2, 0x20];

const u24 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const jsl = (target: number) => [0x22, ...le24(target)];

/** Every patched byte with its vanilla value: explode checks them, a vanilla build writes them back. */
function vanillaSites(): Map<number, number[]> {
    const m = new Map<number, number[]>();
    m.set(NAME_BANK, [0xC4]);
    m.set(NAME_TABLE, le24(VANILLA_NAME_TABLE));
    ICON_SITES.forEach(s => { m.set(s + 1, le24(VANILLA_ICONS)); m.set(s + 7, le24(VANILLA_ICONS + 1)); });
    BOUNDS.forEach(b => m.set(b, [VANILLA_INGREDIENTS - 1, 0]));
    GET16.forEach(s => m.set(s, LDA)); GET8.forEach(s => m.set(s, LDA)); PUT16.forEach(s => m.set(s, STA));
    m.set(SHOP_GET, VANILLA_SHOP_GET); m.set(SHOP_PUT, VANILLA_SHOP_PUT);
    return m;
}
const SITES = vanillaSites();
const SPANS: Span[] = [...SITES].map(([at, b]) => ({ start: at, end: at + b.length }));
const same = (rom: Uint8Array, at: number, bytes: number[]) => bytes.every((x, k) => rom[at + k] === x);

/** `temp[n]` (the temp area's byte n, as scripts write it), a WRAM name, or "$7E:xxxx" → the address in bank $7E. */
export function heldAt(text: unknown): number | null {
    const m = typeof text === 'string' ? /^temp\[(\d+)\]$/.exec(text) : null;
    if (m) { const n = Number(m[1]); return n + 1 < TEMP_SIZE ? TEMP + n : null; }
    return wramAt(text);
}
const heldText = (at: number) => at >= TEMP && at + 1 < TEMP + TEMP_SIZE ? `temp[${at - TEMP}]` : wramText(at);

interface New { name: string; id: number; text: string; held: number; icon: number; file: string }

const textOf = (rom: Uint8Array, at: number) => { let s = ''; for (let i = at; rom[i]; i++) s += String.fromCharCode(rom[i]); return s; };

export function growIngredients(inner: Codec): Codec {
    const kind = inner.kind, DIR = inner.path;
    const readFile = (ctx: ImplodeContext, path: string): any => { try { return JSON.parse(readText(ctx.tree.get(path)!)); } catch { return null; } };

    /** The new ingredients (ids from 22), checked; null when there are none or one is wrong (findings say which). */
    function grown(ctx: ImplodeContext, report = false): New[] | null {
        const ids = ctx.ids.get(kind);
        if (!ids) return null;
        const byId = new Map([...ids].map(([n, id]) => [id, n])), out: New[] = [];
        const count = Math.max(VANILLA_INGREDIENTS, ...[...ids.values()].map(id => id + 1));
        if (count === VANILLA_INGREDIENTS) return null;
        let ok = true;
        for (let id = VANILLA_INGREDIENTS; id < count; id++) {
            const n = byId.get(id);
            if (n === undefined) { ctx.findings.error('missing-file', `${DIR}/${ENUM}`, `/names/${id}`, `ingredient ids are a list the code counts down: no gap (id ${id} is missing)`); ok = false; continue; }
            const path = `${DIR}/${n}.json`, v = readFile(ctx, path);
            if (v === null) { ctx.findings.error('parse-error', path, '', 'not JSON'); ok = false; continue; }
            const text = v.text, held = heldAt(v.held), icon = typeof v.icon === 'string' ? ids.get(v.icon) : undefined;
            const bad = (p: string, why: string) => { ctx.findings.error('invalid-value', path, p, why); ok = false; };
            if (typeof text !== 'string' || !/^[\x20-\x7E]+$/.test(text)) { bad('/text', 'the name the alchemy screen prints, printable ASCII'); continue; }
            if (held === null) { bad('/held', 'the WRAM word that counts it: "temp[n]" (n even, 0-198: wiped on every room load and not saved) or a WRAM name'); continue; }
            if (icon === undefined || icon >= VANILLA_INGREDIENTS) { ctx.findings.error('unknown-reference', path, '/icon', 'a vanilla ingredient by name: this one shows its icon'); ok = false; continue; }
            if (report && held >= TEMP && held < TEMP + TEMP_SIZE) ctx.findings.info('temp-cell', path, '/held', `${v.held} is wiped on every room load and not saved: the count lasts one room`);
            out.push({ name: n, id, text, held, icon, file: path });
        }
        const cells = new Map<number, string>();
        for (const x of out) { if (cells.has(x.held)) { ctx.findings.error('invalid-value', x.file, '/held', `${cells.get(x.held)} counts in the same word`); ok = false; } cells.set(x.held, x.name); }
        return ok ? out : null;
    }

    /** Each id's name text: a vanilla one's ring item text (menus owns it), a new one's own. */
    function nameTexts(ctx: ImplodeContext, extra: New[]): string[] {
        const byId = new Map([...ctx.ids.get(kind)!].map(([n, id]) => [id, n])), out: string[] = [];
        for (let id = 0; id < VANILLA_INGREDIENTS; id++) {
            const item = readFile(ctx, `${DIR}/${byId.get(id)}.json`)?.name, ring = readFile(ctx, `ring_items/${item}.json`);
            out.push(typeof ring?.name === 'string' ? ring.name : '');
        }
        return [...out, ...extra.map(x => x.text)];
    }

    return {
        ...inner,

        canonical(path, bytes, ctx) {
            if (path === `${DIR}/${ENUM}`) return [path, bytes];
            const v = JSON.parse(readText(bytes));
            if (typeof v?.text !== 'string') return inner.canonical!(path, bytes, ctx);
            return [path, json({ text: v.text, held: heldAt(v.held), icon: v.icon })];
        },

        explode(rom, name, options, countOf, nameAt) {
            for (const [at, b] of SITES) {
                const grownForm = at === NAME_BANK || at === NAME_TABLE || BOUNDS.includes(at) || ICON_SITES.some(s => at === s + 1 || at === s + 7) || rom[at] === 0x22;
                if (!same(rom, at, b) && !grownForm) throw new Error(`ingredients: $${(0xC00000 | at).toString(16).toUpperCase()} is not the code this codec knows; another release?`);
            }
            if (rom[NAME_TABLE - 1] !== 0xBF || ICON_SITES.some(x => rom[x] !== 0xBF || rom[x + 6] !== 0xBF)) throw new Error('ingredients: the alchemy screen\'s name and icon reads are not the code this codec knows; another release?');
            const out = inner.explode(rom, name, options, countOf, nameAt);
            const count = rom[BOUNDS[0]] + 1;
            const names: string[] = Array.from({ length: count }, (_, id) => name(kind, id));
            if (count > VANILLA_INGREDIENTS) {
                // A grown build (implode explodes its own): the new ingredients from the generated items.
                const cells = (u24(rom, GET16[0] + 1) & 0x3FFFFF) + HOOKS_LENGTH, table = u24(rom, NAME_TABLE) & 0x3FFFFF;
                const bank = rom[NAME_BANK] << 16, icons = u24(rom, ICON_SITES[0] + 1) & 0x3FFFFF;
                const iconOf = (id: number) => u24(rom, icons + 3 * id);
                for (let id = VANILLA_INGREDIENTS; id < count; id++) {
                    const icon = Array.from({ length: VANILLA_INGREDIENTS }, (_, k) => k).find(k => iconOf(k) === iconOf(id)) ?? 0;
                    const held = rom[cells + 2 * (id - VANILLA_INGREDIENTS)] | (rom[cells + 2 * (id - VANILLA_INGREDIENTS) + 1] << 8);
                    out.files.set(`${DIR}/${names[id]}.json`, json({ text: textOf(rom, ((bank | (rom[table + 2 * id] | (rom[table + 2 * id + 1] << 8))) & 0x3FFFFF)), held: heldText(held), icon: name(kind, icon) }));
                }
            }
            out.files.set(`${DIR}/${ENUM}`, enumFile({ kind, limit: LIMIT, names, why: `ingredient = id: ids 0-21 are vanilla's (name pointers $C4:5FF3, held count $22FF + id); a new one (from 22) has its own name, a WRAM word for its count and an icon, and implode moves the alchemy screen's names and icons and redirects every count reader (docs/todo/growable-items.md)` }));
            out.tables.push(...SPANS);
            return out;
        },

        encode(ctx, names) {
            const ids = ctx.ids.get(kind) ?? new Map<string, number>();
            const items = inner.encode({ ...ctx, ids: new Map(ctx.ids).set(kind, new Map([...ids].filter(([, id]) => id < VANILLA_INGREDIENTS))) },
                new Set([...names].filter(n => (ids.get(n) ?? 0) < VANILLA_INGREDIENTS)));
            const extra = grown(ctx, true);
            if (!extra) return items;
            const n = VANILLA_INGREDIENTS + extra.length, texts = nameTexts(ctx, extra);
            const rule = { noCrossBank: true, below: MIB4 };
            const file = `${DIR}/${ENUM}`;
            items.push(
                { key: NAMES_KEY, file, bytes: new Uint8Array(2 * n + texts.reduce((s, t) => s + t.length + 1, 0)), rule, generated: true },
                { key: ICONS_KEY, file, bytes: new Uint8Array(3 * n), rule, generated: true },
                { key: HOOKS_KEY, file, bytes: new Uint8Array(HOOKS_LENGTH + 2 * extra.length), rule, generated: true },
            );
            return items;
        },

        tables(ctx, placed) {
            const ids = ctx.ids.get(kind);
            if (!ids) return [];
            const writes = inner.tables({ ...ctx, ids: new Map(ctx.ids).set(kind, new Map([...ids].filter(([, id]) => id < VANILLA_INGREDIENTS))) }, placed);
            const file = `${DIR}/${ENUM}`, extra = grown(ctx);
            const put = (at: number, bytes: number[]) => writes.push({ at, bytes: Uint8Array.from(bytes), file });
            const names = placed.get(NAMES_KEY), icons = placed.get(ICONS_KEY), code = placed.get(HOOKS_KEY);
            if (!extra || names === undefined || icons === undefined || code === undefined) {
                for (const [at, b] of SITES) put(at, b);
                return writes;
            }
            const n = VANILLA_INGREDIENTS + extra.length, bus = (at: number) => ctx.pointer(at);
            // Names: the 16-bit pointers, then the strings, in one bank.
            const texts = nameTexts(ctx, extra), block: number[] = [];
            let at = names + 2 * n;
            const strings: number[] = [];
            for (const t of texts) { block.push(bus(at) & 0xFF, (bus(at) >> 8) & 0xFF); for (const c of t) strings.push(c.charCodeAt(0)); strings.push(0); at += t.length + 1; }
            put(names, [...block, ...strings]);
            put(NAME_BANK, [bus(names) >> 16]);
            put(NAME_TABLE, le24(bus(names)));
            // Icons: vanilla's 22 pointers (in _base/), then each new one's.
            const iconBytes: number[] = [];
            for (let id = 0; id < VANILLA_INGREDIENTS; id++) iconBytes.push(...ctx.base.image.subarray(ICON_TABLE + 3 * id, ICON_TABLE + 3 * id + 3));
            for (const x of extra) iconBytes.push(...ctx.base.image.subarray(ICON_TABLE + 3 * x.icon, ICON_TABLE + 3 * x.icon + 3));
            put(icons, iconBytes);
            ICON_SITES.forEach(s => { put(s + 1, le24(bus(icons))); put(s + 7, le24(bus(icons) + 1)); });
            // Hooks and the cell table; every count reader jumps into them.
            const cells = code + HOOKS_LENGTH, h = hooks(bus(cells));
            put(code, [...h.code, ...extra.flatMap(x => [x.held & 0xFF, x.held >> 8])]);
            const entry = (k: keyof typeof h.entry) => bus(code + h.entry[k]);
            GET16.forEach(s => put(s, jsl(entry('get16'))));
            PUT16.forEach(s => put(s, jsl(entry('put16'))));
            GET8.forEach(s => put(s, jsl(entry('get8'))));
            put(SHOP_GET, [...jsl(entry('shopGet')), 0xEA, 0xEA, 0xEA]);
            put(SHOP_PUT, [...jsl(entry('shopPut')), 0xEA]);
            BOUNDS.forEach(b => put(b, [n - 1, 0]));
            return writes;
        },
    };
}
