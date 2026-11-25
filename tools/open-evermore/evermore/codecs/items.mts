// The items kinds (docs/open-evermore/resources.md §items, docs/todo/growable-items.md): consumables (the items ring)
// and named items (charms and key items, the sub-menu of the Pouch). Vanilla's entries are records read in place
// (records.mts, wrapped here); a file past them is a new one. With vanilla's count every byte stays vanilla's; with more,
// implode generates one item per kind and rewrites the code that reads the tables.
//
// Facts used (disassembly 2026-11-23; every reader a static operand scan of the ROM finds, checked by explode):
//   consumables  id = the ring item's index (+6): 0-7 counted at `$2315 + id` (a byte), 8 the Pouch (no count; `$231D`
//                is armour's). Using one (`item_use_on_target`, $8E:8CA7, X = 2·id) reads three tables in
//                bank $C4: $C4:5A84 the target cursor flags ($8E:8CC0), $C4:5A92 the block, 2·k into $91:80A6 ($8E:8CF9;
//                Wings = 16, Escape's), $C4:5AA0 the power, stored at the effect +$2A ($8E:8CE8: Petals 40, Honey 300);
//                then counts one down ($8E:8CDC/8CE1, `lda.l`/`sta.l $7E2315,x` with 16-bit A). The ring build
//                (`ring_items_build`, $8E:9B6F) loops `lda #$0008` ids, reads each count ($8E:9B96) and the ring item
//                at $C4:5AAE ($8E:9BA3); the ring shows the count ($8E:A817) and dispatches `tax : jsr ($A873,x)`
//                ($8E:A866, item_actions). The ring buffer holds 16 items, the Pouch one of them. Shops ($8E:8E98,
//                $8E:914D, $8E:9C77, $8E:A9F2, $8E:AB71, $C4:5AAE at $8E:9C09/9C83) only see shop catalogs: left vanilla
//   named items  entry k = 2·k: $8C:BBB0 the WRAM word of its flag, $8C:BBD8 the mask (readers $8C:C0F0/C0F6 list,
//                C33F/C345 icons, C395/C39B description, C403/C40B count, $8F:9215/921A give, $8F:9245/924A take, by
//                $243D / $243F), $8C:BC1A the name and $8C:C3D0 the description (16 bits, bank from `lda #$00C4` at
//                $8C:C124 and $8C:C3C1), $C4:5A12 the icon (3 bytes, $8C:C359/C35F). Loops: `cmp #$0026` $8C:C148,
//                `cpx #$0028` $8C:C385 and $8C:C3AF, `ldx #$0026` $8C:C400. The screen has 20 places (10 rows of 2,
//                positions $8C:C2E9 / $8C:C30D)
import type { Codec, ImplodeContext, Span, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, readText } from '../../tree.mts';
import { link, unlink } from '../../links.mts';
import { BLOCKS } from './alchemy.mts';
import { DISPATCH, HOOKS_LENGTH, hooks, LDA, POUCH, STA, USE_HANDLER, VANILLA_CONSUMABLES } from './consumable-hooks.mts';
import { heldAt } from './ingredients.mts';
import { ITEM_ACTIONS, RING_ITEMS } from './menus.mts';
import { hexText, parseHex } from './readers.mts';
import { recordsCodec, wramLink } from './records.mts';
import { addTargetSource, TARGETS, targetLink, targetValue } from './targets.mts';
import { TEXTS, textContent } from './texts.mts';

const GROUP = 'items';
export const CONSUMABLES = 'consumables', NAMED_ITEMS = 'named_items';
const C4 = 0x040000, MIB4 = 0x400000, TEMP = 0x2834, TEMP_SIZE = 200;
const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u24 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const le16 = (v: number) => [v & 0xFF, (v >> 8) & 0xFF];
const le24 = (v: number) => [v & 0xFF, (v >> 8) & 0xFF, v >> 16];
const jsl = (target: number) => [0x22, ...le24(target)];
const same = (rom: Uint8Array, at: number, bytes: number[]) => bytes.every((x, k) => rom[at + k] === x);
const fileOf = (bus: number) => bus & 0x3FFFFF;
const textOf = (rom: Uint8Array, at: number) => { let s = ''; for (let i = at; rom[i]; i++) s += String.fromCharCode(rom[i]); return s; };
const readFile = (ctx: ImplodeContext, path: string): any => { try { return JSON.parse(readText(ctx.tree.get(path)!)); } catch { return null; } };
const bad = (ctx: ImplodeContext, path: string, pointer: string, why: string) => { ctx.findings.error('invalid-value', path, pointer, why); return null; };
/** Only the vanilla ids, for the wrapped records codec. */
const vanillaIds = (ctx: ImplodeContext, kind: string, count: number) => {
    const ids = ctx.ids.get(kind) ?? new Map<string, number>();
    return { ctx: { ...ctx, ids: new Map(ctx.ids).set(kind, new Map([...ids].filter(([, id]) => id < count))) }, keep: (n: string) => (ids.get(n) ?? 0) < count };
};

/** The new entries' files in id order (from `vanilla`), or null when there are none or a gap (findings say which). */
function newFiles(ctx: ImplodeContext, kind: string, vanilla: number): { name: string; id: number; path: string; v: any }[] | null {
    const ids = ctx.ids.get(kind);
    if (!ids) return null;
    const byId = new Map([...ids].map(([n, id]) => [id, n])), count = Math.max(vanilla, ...[...ids.values()].map(id => id + 1));
    if (count === vanilla) return null;
    const out = [];
    for (let id = vanilla; id < count; id++) {
        const n = byId.get(id);
        if (n === undefined) { ctx.findings.error('missing-file', `${kind}/${ENUM}`, `/names/${id}`, `${kind} ids are a list the code counts: no gap (id ${id} is missing)`); return null; }
        const path = `${kind}/${n}.json`, v = readFile(ctx, path);
        if (v === null) { ctx.findings.error('parse-error', path, '', 'not JSON'); return null; }
        out.push({ name: n, id, path, v });
    }
    return out;
}

// ── consumables ──

/** Ids the ring can show: its buffer holds 16 items, the Pouch one of them. */
const CONSUMABLE_LIMIT = 16;
const CONSUMABLE_NAMES = ['petals', 'nectar', 'honey', 'dog_biscuit', 'wings', 'essence', 'pixie_dust', 'call_bead', 'pouch'];
const USED = 7;   // ids 0-6 have a target, a block and a power; Call Bead and the Pouch have actions of their own
const TARGET = 0x045A84, BLOCK = 0x045A92, POWER = 0x045AA0, RING = 0x045AAE;
const TABLE_SITES = { target: 0x0E8CC0, power: 0x0E8CE8, block: 0x0E8CF9, ring: 0x0E9BA3 } as const;
const GET16 = [0x0E8CDC, 0x0E9B96, 0x0EA817], PUT16 = [0x0E8CE1], BOUND = 0x0E9B70, DISPATCH_AT = 0x0EA866;
const GROWN_CONSUMABLES = `${CONSUMABLES}/_grown`;

function consumableSites(): Map<number, number[]> {
    const m = new Map<number, number[]>();
    for (const [k, at] of Object.entries(TABLE_SITES)) m.set(at + 1, le24(0xC00000 | { target: TARGET, power: POWER, block: BLOCK, ring: RING }[k as keyof typeof TABLE_SITES]));
    GET16.forEach(s => m.set(s, LDA)); PUT16.forEach(s => m.set(s, STA));
    m.set(BOUND, [POUCH, 0]);
    m.set(DISPATCH_AT, DISPATCH);
    return m;
}
const CONSUMABLE_SITES = consumableSites();

interface NewConsumable { name: string; id: number; held: number; ring: number; target: number; block: number; power: number }

export const consumablesCodec = growConsumables(recordsCodec({
    kind: CONSUMABLES, group: GROUP, count: VANILLA_CONSUMABLES, names: () => CONSUMABLE_NAMES,
    why: 'consumable = the ring item\'s index: ids 0-7 counted at $2315 + id, 8 the Pouch; using one reads its target, block and power from three tables in bank $C4',
    fields: [
        { path: 'ring_item', at: RING, stride: 2, form: { type: 'ref', kind: RING_ITEMS, scale: 2 }, ids: id => id < POUCH },
        { path: 'target', at: TARGET, stride: 2, form: { type: 'target' }, ids: id => id < USED },
        { path: 'block', at: BLOCK, stride: 2, form: { type: 'ref', names: BLOCKS, scale: 2 }, ids: id => id < USED },
        { path: 'power', at: POWER, stride: 2, form: { type: 'number' }, ids: id => id < USED },
    ],
    notes: id => id < POUCH ? { held: wramLink(0x2315 + id) } : undefined,
}));

/** A target as a new consumable's file writes it: a target by reference, or (older files) the word "$xxxx". */
const targetOf = (ctx: ImplodeContext | undefined, v: unknown) => targetValue(ctx, v) ?? parseHex(v, 0xFFFF);

// A grown build's new consumables keep their targets in the moved table (vanilla's are records.mts' source).
addTargetSource(rom => {
    const count = rom[BOUND] === POUCH ? VANILLA_CONSUMABLES : rom[BOUND], table = fileOf(u24(rom, TABLE_SITES.target + 1));
    return Array.from({ length: Math.max(0, count - VANILLA_CONSUMABLES) }, (_, k) => u16(rom, table + 2 * (VANILLA_CONSUMABLES + k)));
});

function growConsumables(inner: Codec): Codec {
    const kind = inner.kind;

    function grown(ctx: ImplodeContext, report = false): NewConsumable[] | null {
        const files = newFiles(ctx, kind, VANILLA_CONSUMABLES);
        if (!files) return null;
        const rings = ctx.ids.get(RING_ITEMS), out: NewConsumable[] = [];
        let ok = true;
        for (const { name, id, path, v } of files) {
            const ringName = unlink(RING_ITEMS, v.ring_item), held = heldAt(v.held), ring = ringName === undefined ? undefined : rings?.get(ringName);
            const target = targetOf(ctx, v.target), block = typeof v.block === 'string' ? BLOCKS.indexOf(v.block) : -1;
            const check = () => {
                if (held === null) return bad(ctx, path, '/held', 'the WRAM word that counts it: "temp[n]" (n even, 0-198: wiped on every room load and not saved) or a WRAM variable, "wram/NAME"');
                if (ring === undefined) { ctx.findings.error('unknown-reference', path, '/ring_item', 'the ring item the items ring shows for it, by name: one no other ring shows (a debug_* one), its "index" this consumable\'s id'); return null; }
                const item = readFile(ctx, `${RING_ITEMS}/${ringName}.json`);
                if (item?.index !== id) return bad(ctx, path, '/ring_item', `ring item ${ringName} has "index": ${JSON.stringify(item?.index)}; the ring reads its index as the consumable: make it ${id}`);
                if (target === null) { ctx.findings.error('unknown-reference', path, '/target', `what the target cursor may pick, a target: "${link(TARGETS, '<name>')}" (Petals: "${targetLink(0x000A)}")`); return null; }
                if (block < 0) { ctx.findings.error('unknown-reference', path, '/block', `the effect it plays, a block by name (${BLOCKS.slice(0, 3).join(', ')} …: Wings play escape)`); return null; }
                if (!Number.isInteger(v.power) || v.power < 0 || v.power > 0xFFFF) return bad(ctx, path, '/power', 'a whole number 0-65535 (what the block does with it: Petals heal 40)');
                return true;
            };
            if (!check()) { ok = false; continue; }
            if (report && held! >= TEMP && held! < TEMP + TEMP_SIZE) ctx.findings.info('temp-cell', path, '/held', `${v.held} is wiped on every room load and not saved: the count lasts one room`);
            out.push({ name, id, held: held!, ring: ring!, target: target!, block, power: v.power });
        }
        const cells = new Map<number, string>();
        for (const x of out) { if (cells.has(x.held)) { bad(ctx, `${kind}/${x.name}.json`, '/held', `${cells.get(x.held)} counts in the same word`); ok = false; } cells.set(x.held, x.name); }
        return ok ? out : null;
    }

    /** The four tables for every id: vanilla's from their files, the new ones' own. */
    function tablesOf(ctx: ImplodeContext, extra: NewConsumable[]): number[][] {
        const n = VANILLA_CONSUMABLES + extra.length, t = [0, 1, 2, 3].map(() => new Array<number>(n).fill(0));
        const byId = new Map([...ctx.ids.get(kind)!].map(([m, id]) => [id, m]));
        for (let id = 0; id < VANILLA_CONSUMABLES; id++) {
            const v = readFile(ctx, `${kind}/${byId.get(id)}.json`) ?? {};
            if (id < USED) { t[0][id] = targetValue(ctx, v.target) ?? 0; t[1][id] = 2 * Math.max(0, BLOCKS.indexOf(v.block)); t[2][id] = Number.isInteger(v.power) ? v.power : 0; }
            if (id < POUCH) t[3][id] = 2 * (ctx.ids.get(RING_ITEMS)?.get(unlink(RING_ITEMS, v.ring_item) ?? '') ?? 0);
        }
        for (const x of extra) { t[0][x.id] = x.target; t[1][x.id] = 2 * x.block; t[2][x.id] = x.power; t[3][x.id] = 2 * x.ring; }
        return t;
    }

    return {
        ...inner,

        canonical(path, bytes, ctx) {
            if (path === `${kind}/${ENUM}`) return [path, bytes];
            // A vanilla file's held is a note; a new one's is what implode reads.
            const id = ctx?.ids.get(kind)?.get(path.slice(kind.length + 1, -'.json'.length));
            if (id === undefined || id < VANILLA_CONSUMABLES) return inner.canonical!(path, bytes, ctx);
            const v = JSON.parse(readText(bytes));
            return [path, json({ held: heldAt(v.held), ring_item: unlink(RING_ITEMS, v.ring_item) ?? v.ring_item, target: targetOf(ctx, v.target), block: v.block, power: v.power })];
        },

        explode(rom, name, options, countOf, nameAt) {
            for (const [at, b] of CONSUMABLE_SITES) {
                const grownForm = at === BOUND || rom[at] === 0x22 || (Object.values(TABLE_SITES) as number[]).includes(at - 1);
                if (!same(rom, at, b) && !grownForm) throw new Error(`consumables: $${hexText(0x800000 | at, 6)} is not the code this codec knows; another release?`);
            }
            if (Object.values(TABLE_SITES).some(s => rom[s] !== 0xBF) || u16(rom, 0x0EA873) !== USE_HANDLER || rom[0x0E8CA7] !== 0xDA)
                throw new Error('consumables: the use handler and the table reads are not the code this codec knows; another release?');
            const out = inner.explode(rom, name, options, countOf, nameAt);
            const count = rom[BOUND] === POUCH ? VANILLA_CONSUMABLES : rom[BOUND];
            const names = Array.from({ length: count }, (_, id) => name(kind, id));
            // What pressing a vanilla one does is item_actions' entry of its id (the ring dispatches by it): a link to read on.
            for (let id = 0; id < VANILLA_CONSUMABLES; id++) {
                const path = `${kind}/${names[id]}.json`, v = JSON.parse(readText(out.files.get(path)!));
                out.files.set(path, json({ ...v, action: link(ITEM_ACTIONS, name(ITEM_ACTIONS, id)) }));
            }
            if (count > VANILLA_CONSUMABLES) {
                const code = fileOf(u24(rom, GET16[0] + 1)), cells = code + HOOKS_LENGTH;
                const table = (k: keyof typeof TABLE_SITES) => fileOf(u24(rom, TABLE_SITES[k] + 1));
                for (let id = VANILLA_CONSUMABLES; id < count; id++) {
                    const at = (k: keyof typeof TABLE_SITES) => u16(rom, table(k) + 2 * id);
                    out.files.set(`${kind}/${names[id]}.json`, json({
                        held: heldText(u16(rom, cells + 2 * (id - VANILLA_CONSUMABLES))), ring_item: link(RING_ITEMS, name(RING_ITEMS, at('ring') / 2)),
                        target: targetLink(at('target')), block: BLOCKS[at('block') / 2] ?? `block_${at('block') / 2}`, power: at('power'),
                    }));
                }
            }
            out.files.set(`${kind}/${ENUM}`, enumFile({ kind, limit: CONSUMABLE_LIMIT, names, why: 'consumable = the ring item\'s index: ids 0-7 vanilla\'s (counted at $2315 + id), 8 the Pouch; a new one (from 9) has a WRAM word for its count, a ring item (a debug_* one, its index the id) and a target, block and power, and implode redirects the ring\'s build, count, dispatch and use (docs/todo/growable-items.md); the ring holds 16, the Pouch one of them' }));
            out.tables.push(...[...CONSUMABLE_SITES].map(([at, b]): Span => ({ start: at, end: at + b.length })));
            return out;
        },

        names(ctx) { return inner.names(ctx); },

        encode(ctx, names) {
            const v = vanillaIds(ctx, kind, VANILLA_CONSUMABLES);
            const items = inner.encode(v.ctx, new Set([...names].filter(v.keep)));
            const extra = grown(ctx, true);
            if (!extra) return items;
            const n = VANILLA_CONSUMABLES + extra.length;
            items.push({ key: GROWN_CONSUMABLES, file: `${kind}/${ENUM}`, bytes: new Uint8Array(HOOKS_LENGTH + 2 * extra.length + 8 * n), rule: { noCrossBank: true, below: MIB4 }, generated: true });
            return items;
        },

        tables(ctx, placed) {
            if (!ctx.ids.get(kind)) return [];
            const v = vanillaIds(ctx, kind, VANILLA_CONSUMABLES), writes = inner.tables(v.ctx, placed), file = `${kind}/${ENUM}`;
            const put = (at: number, bytes: number[]) => writes.push({ at, bytes: Uint8Array.from(bytes), file });
            const extra = grown(ctx), code = placed.get(GROWN_CONSUMABLES);
            if (!extra || code === undefined) { for (const [at, b] of CONSUMABLE_SITES) put(at, b); return writes; }
            const n = VANILLA_CONSUMABLES + extra.length, bus = (at: number) => ctx.pointer(at);
            const cells = code + HOOKS_LENGTH, tables = cells + 2 * extra.length, h = hooks(bus(cells));
            put(code, [...h.code, ...extra.flatMap(x => le16(x.held)), ...tablesOf(ctx, extra).flatMap(t => t.flatMap(le16))]);
            (['target', 'block', 'power', 'ring'] as const).forEach((k, i) => put(TABLE_SITES[k] + 1, le24(bus(tables + 2 * n * i))));
            GET16.forEach(s => put(s, jsl(bus(code + h.entry.get16))));
            PUT16.forEach(s => put(s, jsl(bus(code + h.entry.put16))));
            put(DISPATCH_AT, jsl(bus(code + h.entry.dispatch)));
            put(BOUND, [n, 0]);
            return writes;
        },
    };
}

const heldText = (at: number) => at >= TEMP && at + 1 < TEMP + TEMP_SIZE ? `temp[${at - TEMP}]` : wramLink(at);

// ── named items ──

const VANILLA_NAMED = 20, NAMED_LIMIT = 40, SCREEN = 20;
const FLAGS = 0x0CBBB0, MASKS = 0x0CBBD8, NAMES_T = 0x0CBC1A, DESCRIPTIONS = 0x0CC3D0, ICONS = 0x045A12;
const NAMED_SITES = {
    flags: [0x0CC0F6, 0x0CC345, 0x0CC39B, 0x0CC403, 0x0F9215, 0x0F9245], masks: [0x0CC0F0, 0x0CC33F, 0x0CC395, 0x0CC40B, 0x0F921A, 0x0F924A],
    names: [0x0CC11E], descriptions: [0x0CC3BB], icons: [0x0CC359],
} as const;
const ICON_HIGH = 0x0CC35F, NAME_BANK = 0x0CC125, DESCRIPTION_BANK = 0x0CC3C2;
const LAST = [0x0CC149, 0x0CC401], END = [0x0CC386, 0x0CC3B0];
const GROWN_NAMED = `${NAMED_ITEMS}/_grown`;
/** The WRAM a save keeps (docs/todo/growable-items.md §The save file is six blocks). */
const SAVED: [number, number][] = [[0x0ABA, 0x0B1F], [0x2F52, 0x2FF4], [0x2258, 0x22EA], [0x22FF, 0x235B], [0x2361, 0x238D], [0x2513, 0x2533]];

function namedSites(): Map<number, number[]> {
    const m = new Map<number, number[]>(), at = { flags: FLAGS, masks: MASKS, names: NAMES_T, descriptions: DESCRIPTIONS, icons: ICONS };
    for (const [k, sites] of Object.entries(NAMED_SITES)) for (const s of sites) m.set(s + 1, le24(0x800000 | at[k as keyof typeof at] | (k === 'icons' ? 0xC00000 : 0)));
    m.set(ICON_HIGH + 1, le24(0xC00000 | ICONS + 1));
    m.set(NAME_BANK, [0xC4]); m.set(DESCRIPTION_BANK, [0xC4]);
    LAST.forEach(s => m.set(s, [2 * VANILLA_NAMED - 2, 0])); END.forEach(s => m.set(s, [2 * VANILLA_NAMED, 0]));
    return m;
}
const NAMED_SITE_BYTES = namedSites();

let NAMED_NAMES: string[] = [];
function prepareNamed(rom: Uint8Array): void {
    if (NAMED_NAMES.length) return;
    const seen = new Set<string>();
    NAMED_NAMES = Array.from({ length: VANILLA_NAMED }, (_, k) => {
        let n = textOf(rom, C4 | u16(rom, NAMES_T + 2 * k)).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `named_item_${k}`;
        for (let i = 2; seen.has(n); i++) n = `${n.replace(/_\d+$/, '')}_${i}`;
        seen.add(n);
        return n;
    });
}

export const namedItemsCodec = growNamed(recordsCodec({
    kind: NAMED_ITEMS, group: GROUP, count: VANILLA_NAMED, names: () => NAMED_NAMES, prepare: prepareNamed,
    why: 'named item = entry k (2·k) of four tables in bank $8C: its flag (WRAM word and mask), name and description (bank $C4); 0-13 charms, 14-19 key items',
    fields: [
        { path: 'name', at: NAMES_T, stride: 2, form: { type: 'text' } },
        { path: 'description', at: DESCRIPTIONS, stride: 2, form: { type: 'text' } },
        { path: 'flag/flags', at: FLAGS, stride: 2, form: { type: 'wram' } },
        { path: 'flag/bit', at: MASKS, stride: 2, form: { type: 'hex' } },
    ],
    notes: id => ({ what: id < 14 ? 'a charm: code reads its flag for what it does' : 'a key item: scripts set and test its flag' }),
}));

interface NewNamed { name: string; id: number; text: string; description: string; flags: number; bit: number; icon: number; path: string }

function growNamed(inner: Codec): Codec {
    const kind = inner.kind;

    /** An entry's text in a field: a text by reference (its file's), or (a new entry) the text itself. */
    function textIn(ctx: ImplodeContext, v: any, field: 'name' | 'description'): string | null {
        const x = v?.[field];
        if (typeof x === 'string' && x.startsWith(link(TEXTS, ''))) return textContent(ctx, x);
        return typeof x === 'string' ? x : null;
    }

    function grown(ctx: ImplodeContext, report = false): NewNamed[] | null {
        const files = newFiles(ctx, kind, VANILLA_NAMED);
        if (!files) return null;
        const ids = ctx.ids.get(kind)!, out: NewNamed[] = [];
        let ok = true;
        for (const { name, id, path, v } of files) {
            const text = textIn(ctx, v, 'name'), description = textIn(ctx, v, 'description');
            const flags = typeof v.flag?.flags === 'string' ? heldAt(v.flag.flags) : null, bit = parseHex(v.flag?.bit, 0xFFFF);
            const iconName = unlink(kind, v.icon), icon = iconName === undefined ? undefined : ids.get(iconName);
            const check = () => {
                if (text === null || !/^[\x20-\x7E]+$/.test(text)) return bad(ctx, path, '/name', `the name the list prints, printable ASCII, or a text, "${link(TEXTS, '<name>')}"`);
                if (description === null || !/^[\x20-\x7E]*$/.test(description)) return bad(ctx, path, '/description', `the line shown when it is picked, printable ASCII, or a text, "${link(TEXTS, '<name>')}" (the key items share ${link(TEXTS, 'rare_item')})`);
                if (flags === null) return bad(ctx, path, '/flag/flags', 'the WRAM word holding its flag: a WRAM variable, "wram/NAME", "wram/NAME+n" or "$7E:xxxx" (saved bits still free: $22DB bits $40, $80; $225C bits $08-$40)');
                if (bit === null || bit === 0) return bad(ctx, path, '/flag/bit', 'its mask in that word, "$xxxx"');
                if (icon === undefined || icon >= VANILLA_NAMED) { ctx.findings.error('unknown-reference', path, '/icon', 'a vanilla named item by name: this one shows its icon'); return null; }
                return true;
            };
            if (!check()) { ok = false; continue; }
            if (report && !SAVED.some(([a, b]) => flags! >= a && flags! + 1 < b)) ctx.findings.info('not-saved', path, '/flag/flags', `${v.flag.flags} is not in the save file: the item is lost on a reload`);
            out.push({ name, id, text: text!, description: description!, flags: flags!, bit: bit!, icon: icon!, path });
        }
        const flagsOf = new Map<string, string>();
        const vanilla = [...ids].filter(([, id]) => id < VANILLA_NAMED).map(([n]) => [n, readFile(ctx, `${kind}/${n}.json`)?.flag] as const);
        for (const [n, f] of vanilla) if (f) flagsOf.set(`${heldAt(f.flags)}/${parseHex(f.bit, 0xFFFF)}`, n);
        for (const x of out) {
            const k = `${x.flags}/${x.bit}`;
            if (flagsOf.has(k)) { bad(ctx, x.path, '/flag', `${flagsOf.get(k)} has the same flag`); ok = false; }
            flagsOf.set(k, x.name);
        }
        if (ok && report && VANILLA_NAMED + out.length > SCREEN) ctx.findings.info('screen', `${kind}/${ENUM}`, '/names', `the list has ${SCREEN} places (10 rows of 2): more than ${SCREEN} held at once overrun it (not tried in game)`);
        return ok ? out : null;
    }

    /** Every entry's fields for the generated tables: vanilla's from their files. */
    function entries(ctx: ImplodeContext, extra: NewNamed[]) {
        const byId = new Map([...ctx.ids.get(kind)!].map(([n, id]) => [id, n])), out = [];
        for (let id = 0; id < VANILLA_NAMED; id++) {
            const v = readFile(ctx, `${kind}/${byId.get(id)}.json`) ?? {};
            out.push({ text: textIn(ctx, v, 'name') ?? '', description: textIn(ctx, v, 'description') ?? '', flags: heldAt(v.flag?.flags) ?? 0, bit: parseHex(v.flag?.bit, 0xFFFF) ?? 0, icon: id });
        }
        return [...out, ...extra];
    }
    /** The block: flags, masks, name and description pointers (n words each), icons (3 bytes each), then the strings
     *  (each text once). `bus` turns a block offset into the address the game reads. */
    function block(ctx: ImplodeContext, extra: NewNamed[], bus: (offset: number) => number): number[] {
        const all = entries(ctx, extra), n = all.length, strings: number[] = [], at = new Map<string, number>();
        const ptr = (t: string) => {
            if (!at.has(t)) { at.set(t, 11 * n + strings.length); strings.push(...[...t].map(c => c.charCodeAt(0)), 0); }
            return bus(at.get(t)!) & 0xFFFF;
        };
        const names = all.map(e => ptr(e.text)), descriptions = all.map(e => ptr(e.description));
        const icon = (k: number) => [...ctx.base.image.subarray(ICONS + 3 * k, ICONS + 3 * k + 3)];
        return [...all.flatMap(e => le16(e.flags)), ...all.flatMap(e => le16(e.bit)), ...names.flatMap(le16), ...descriptions.flatMap(le16), ...all.flatMap(e => icon(e.icon)), ...strings];
    }

    return {
        ...inner,

        canonical(path, bytes, ctx) {
            if (path === `${kind}/${ENUM}`) return [path, bytes];
            const v = JSON.parse(readText(bytes));
            if (v?.icon === undefined) return inner.canonical!(path, bytes, ctx);
            const text = (f: 'name' | 'description') => ctx ? textIn(ctx, v, f) : v[f];
            return [path, json({ name: text('name'), description: text('description'), flags: heldAt(v.flag?.flags), bit: parseHex(v.flag?.bit, 0xFFFF), icon: unlink(kind, v.icon) ?? v.icon })];
        },

        explode(rom, name, options, countOf, nameAt) {
            for (const [at, b] of NAMED_SITE_BYTES) {
                const grownForm = LAST.includes(at) || END.includes(at) || at === NAME_BANK || at === DESCRIPTION_BANK || rom[at - 1] === 0xBF || rom[at - 1] === 0x3F;
                if (!same(rom, at, b) && !grownForm) throw new Error(`named_items: $${hexText(0x800000 | at, 6)} is not the code this codec knows; another release?`);
            }
            if ([...Object.values(NAMED_SITES).flat(), ICON_HIGH].some(s => rom[s] !== 0xBF && rom[s] !== 0x3F)) throw new Error('named_items: the table reads are not the code this codec knows; another release?');
            prepareNamed(rom);
            const out = inner.explode(rom, name, options, countOf, nameAt);
            const count = u16(rom, END[0]) / 2;
            const names = Array.from({ length: count }, (_, id) => name(kind, id));
            if (count > VANILLA_NAMED) {
                const table = (k: keyof typeof NAMED_SITES) => fileOf(u24(rom, NAMED_SITES[k][0] + 1)), icons = table('icons');
                const textBank = rom[NAME_BANK] << 16, iconOf = (k: number) => u24(rom, icons + 3 * k);
                for (let id = VANILLA_NAMED; id < count; id++) {
                    const w = (k: keyof typeof NAMED_SITES) => u16(rom, table(k) + 2 * id);
                    const icon = Array.from({ length: VANILLA_NAMED }, (_, k) => k).find(k => iconOf(k) === iconOf(id)) ?? 0;
                    out.files.set(`${kind}/${names[id]}.json`, json({
                        name: textOf(rom, fileOf(textBank | w('names'))), description: textOf(rom, fileOf(textBank | w('descriptions'))),
                        flag: { flags: wramLink(w('flags')), bit: hexText(w('masks'), 4) }, icon: link(kind, name(kind, icon)),
                    }));
                }
            }
            out.files.set(`${kind}/${ENUM}`, enumFile({ kind, limit: NAMED_LIMIT, names, why: 'named item = entry k (2·k): ids 0-19 vanilla\'s (0-13 charms, 14-19 key items); a new one (from 20) has a name, a description, a flag and a vanilla one\'s icon, and implode moves the four tables, the icons and the strings and counts every loop to the last entry (docs/todo/growable-items.md); the list shows 20 held at once' }));
            out.tables.push(...[...NAMED_SITE_BYTES].map(([at, b]): Span => ({ start: at, end: at + b.length })));
            return out;
        },

        encode(ctx, names) {
            const v = vanillaIds(ctx, kind, VANILLA_NAMED);
            const items = inner.encode(v.ctx, new Set([...names].filter(v.keep)));
            const extra = grown(ctx, true);
            if (!extra) return items;
            items.push({ key: GROWN_NAMED, file: `${kind}/${ENUM}`, bytes: new Uint8Array(block(ctx, extra, () => 0).length), rule: { noCrossBank: true, below: MIB4 }, generated: true });
            return items;
        },

        tables(ctx, placed) {
            if (!ctx.ids.get(kind)) return [];
            const v = vanillaIds(ctx, kind, VANILLA_NAMED), writes = inner.tables(v.ctx, placed), file = `${kind}/${ENUM}`;
            const put = (at: number, bytes: number[]) => writes.push({ at, bytes: Uint8Array.from(bytes), file });
            const extra = grown(ctx), at = placed.get(GROWN_NAMED);
            if (!extra || at === undefined) { for (const [s, b] of NAMED_SITE_BYTES) put(s, b); return writes; }
            const n = VANILLA_NAMED + extra.length, bus = (offset: number) => ctx.pointer(at + offset);
            put(at, block(ctx, extra, bus));
            const offsets = { flags: 0, masks: 2 * n, names: 4 * n, descriptions: 6 * n, icons: 8 * n };
            for (const [k, sites] of Object.entries(NAMED_SITES)) for (const s of sites) put(s + 1, le24(bus(offsets[k as keyof typeof offsets])));
            put(ICON_HIGH + 1, le24(bus(8 * n + 1)));
            put(NAME_BANK, [bus(0) >> 16]); put(DESCRIPTION_BANK, [bus(0) >> 16]);
            LAST.forEach(s => put(s, le16(2 * n - 2))); END.forEach(s => put(s, le16(2 * n)));
            return writes;
        },
    };
}

export const ITEM_KINDS = [consumablesCodec, namedItemsCodec];
