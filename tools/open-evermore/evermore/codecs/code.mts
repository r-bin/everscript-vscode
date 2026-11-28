// The code kind (docs/open-evermore/code.md, resources.md §code): every routine the vanilla game runs, one Asar file
// each, `code/<routine>.asm`, named as soe://rom/code/ names it. WRAM operands and generated-table `lda.l` readers are
// written by symbol (`BOY_HP`, `tbl_maps_table`), new routines without `org` place in FastROM (C1), and pure `jsl`-only
// leaves relocate freely in FastROM (C3). Unsymbolized bytes owned by another kind stay as holes (`skip` / `operand written by`).
import { createRequire } from 'node:module';
import type { Codec, Exploded, ImplodeContext, Item, Span, Write } from '../../codec.mts';
import { resourceSymbol, enumDefines } from '../../asar-project.mts';
import { piecesOf } from '../../layout.mts';
import { sha1, text, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import * as map from '../map.mts';
import { readCensus } from '../../code-census.mts';
import { RUN, addressLabel, censusHeads, findRoutines, foreignAt, hex6, pieces, routineText, targets } from './code-text.mts';
import type { Routine } from './code-text.mts';
import { findMovableRoutines, ownedSiteSpans, subtractSpans, tableReaderAt, wramSiteAt } from './code-symbols.mts';
import type { Foreign } from './code-symbols.mts';
import { CODE_MOVED_MARK, CODE_MOVED_NAME, currentWram, setMovedCodeHomes, wramCodec, wramSymbolExpr } from './wram.mts';

const require = createRequire(import.meta.url);
const asm = require('../../../../dist/platform/snes/asm65816');

export const CODE = 'code';
const DIR = CODE, README = `${DIR}/README.md`;
const BUILT_MARK = 0x7FFFFFFD, BUILT_NAME = '__built__';
const FASTROM_LIMIT = 0x400000;
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,95}$/;
interface AsmError { file: string; line: number; message: string }

/** Other kinds' byte ranges, sorted and disjoint (the first kind keeps an overlap). */
function foreignList(spans: Foreign[]): Foreign[] {
    const sorted = spans.filter(s => s.end > s.start).sort((a, b) => a.start - b.start), out: Foreign[] = [];
    for (const s of sorted) {
        const last = out[out.length - 1];
        if (last && s.start < last.end) { if (s.end > last.end) out.push({ start: last.end, end: s.end, kind: s.kind }); }
        else out.push({ ...s });
    }
    return out;
}

/** The parts of [start, end) another kind owns, as offsets from `start`. */
function holesIn(foreign: Foreign[], start: number, end: number): Span[] {
    const out: Span[] = [];
    for (let i = Math.max(0, lowerBound(foreign, start)); i < foreign.length && foreign[i].start < end; i++) {
        const a = Math.max(start, foreign[i].start), b = Math.min(end, foreign[i].end);
        if (b > a) out.push({ start: a - start, end: b - start });
    }
    return out;
}
function lowerBound(list: Foreign[], off: number): number {
    let lo = 0, hi = list.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid].end <= off) lo = mid + 1; else hi = mid; }
    return lo;
}
const zero = (bytes: Uint8Array, holes: Span[]) => { for (const h of holes) bytes.fill(0, h.start, h.end); return bytes; };

const README_TEXT = `# code

Every routine the vanilla game was recorded running, one Asar file each, named like soe://rom/code/<routine>/
(docs/open-evermore/code.md).

- Labels hold the address the CPU runs the code at ($80:xxxx, $8C-$91:xxxx, or 4th MB FastROM). A routine's name is
  its first label; a jump or branch target is \`loc_<address>\`, a call target with no name \`func_<address>\`.
- WRAM operands and generated table readers use symbolic names (\`BOY_HP\`, \`tbl_maps_table\`).
- Pure \`jsl\`-only leaves and new routines (\`code/<name>.asm\` without \`org\`) relocate freely in FastROM.
- Pinned routines keep their vanilla size (pad with \`nop\`); \`skip n\` / \`operand written by <kind>\` marks remaining
  bytes owned by another kind.
`;

interface EncodedState {
    measured: Map<string, ReturnType<typeof asm.measure>>;
    files: Map<string, string>;
    holes: Map<string, Span[]>;
    items: Item[];
    movable: Set<string>;
    treeLabels: Map<string, number>;
    defs: Map<string, number>;
    wramLabels: Map<string, number>;
}
interface BuiltEntry { name: string; at: number; bus: number; length: number; homeAt?: number; holes: Span[] }
interface BuiltState { byName: Map<string, BuiltEntry>; entries: BuiltEntry[]; lookup: (s: string) => number | undefined }

let lastEncoded: EncodedState | null = null;
let lastBuilt: BuiltState | null = null;

/** Routine name → its path in the tree (a routine may sit in a subfolder). */
const filesCache = new WeakMap<ImplodeContext['tree'], Map<string, string>>();
export function codeFilesOf(tree: Tree): Map<string, string> {
    let m = filesCache.get(tree);
    if (!m) {
        m = new Map();
        for (const path of tree.keys()) { const x = path.startsWith(DIR + '/') ? /\/([^/]+)\.asm$/.exec(path) : null; if (x && path !== README) m.set(x[1], path); }
        filesCache.set(tree, m);
    }
    return m;
}

export const codeCodec: Codec = {
    kind: CODE,
    version: 2,
    path: DIR,
    nameRe: NAME,
    defaultName: id => `routine_${id}`,

    explode(rom, _name, _options, _count, nameAt, others = []) {
        const files: Tree = new Map();
        if (nameAt(CODE, BUILT_MARK) === BUILT_NAME && lastBuilt) {
            const emptyHd = new Map<number, number>();
            for (const e of lastBuilt.entries) {
                if (nameAt(CODE, e.at) !== e.name) continue;
                const rt: Routine = { name: e.name, start: e.at, end: e.at + e.length };
                const fList = e.holes.map(h => ({ start: e.at + h.start, end: e.at + h.end, kind: 'other' }));
                files.set(`${DIR}/${e.name}.asm`, text(routineText({ rom, hd: emptyHd, labelAt: new Map([[e.at, e.name]]), foreign: fList, resourceAt: () => null }, rt)));
            }
            files.set(README, text(README_TEXT));
            return { files, pool: [], tables: [], homes: [] };
        }

        const presentKinds = new Set(others.map(o => o.kind));
        const rawForeign = foreignList(others.flatMap(o => [...o.out.pool, ...o.out.tables].map(s => ({ ...s, kind: o.kind }))));
        const owned = ownedSiteSpans(presentKinds, rom);
        const foreign = subtractSpans(rawForeign, owned);
        const isForeign = (off: number) => foreignAt(foreign, off) !== null;
        const release = map.gameMap().release;
        if (!readCensus(release)) return { files: new Map(), pool: [], tables: [], homes: [] };
        const hd = censusHeads(rom, release);
        const tableReaders = tableReaderAt(presentKinds, rom);
        const wramSites = presentKinds.has('wram') ? wramSiteAt() : new Map();
        const wramByName = presentKinds.has('wram') ? new Map(currentWram().map(v => [v.name, v.at])) : new Map<string, number>();
        const wramLong = presentKinds.has('wram') ? ((addr: number): string | null => {
            const expr = wramSymbolExpr(addr, 3);
            if (!expr) return null;
            const val = asm.evaluate(expr, (s: string) => wramByName.get(s));
            return typeof val === 'number' && val === addr ? expr : null;
        }) : undefined;

        const routines = findRoutines(rom, hd, isForeign, release);
        const labelAt = new Map<number, string>(routines.map(r => [r.start, r.name]));
        const lineStart = new Set<number>();
        for (const r of routines) for (const p of pieces(rom, hd, r.start, r.end)) {
            if (p.ins) { if (!isForeign(p.at)) lineStart.add(p.at); }
            else for (let i = p.at; i < p.at + p.len; i++) if (!isForeign(i)) lineStart.add(i);
        }
        for (const t of targets(rom, hd, routines)) if (lineStart.has(t) && !labelAt.has(t)) labelAt.set(t, 'loc_' + hex6(RUN + t));
        const homes = others.flatMap(o => o.out.homes).sort((a, b) => a.at - b.at);
        const resourceAt = (off: number): string | null => {
            let lo = 0, hi = homes.length - 1, best = -1;
            while (lo <= hi) { const mid = (lo + hi) >> 1; if (homes[mid].at <= off) { best = mid; lo = mid + 1; } else hi = mid - 1; }
            if (best < 0 || off >= homes[best].at + homes[best].length) return null;
            const d = off - homes[best].at;
            return homes[best].key + (d ? `+$${d.toString(16).toUpperCase()}` : '');
        };
        const pool: Span[] = [], homesOut: Exploded['homes'] = [];
        for (const r of routines) {
            files.set(`${DIR}/${r.name}.asm`, text(routineText({ rom, hd, labelAt, foreign, resourceAt, tableReaders, wramSites, wramLong }, r)));
            const holes = holesIn(foreign, r.start, r.end);
            let from = r.start;
            for (const h of holes) { if (r.start + h.start > from) pool.push({ start: from, end: r.start + h.start }); from = r.start + h.end; }
            if (r.end > from) pool.push({ start: from, end: r.end });
            homesOut.push({ key: `${CODE}/${r.name}`, at: r.start, length: r.end - r.start, sha1: sha1(zero(rom.slice(r.start, r.end), holes)) });
        }
        files.set(README, text(README_TEXT));
        return { files, pool, tables: [], homes: homesOut };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === README) continue;
            const m = /\/([^/]+)\.asm$/.exec(path);
            if (!m) { findings.warning('unknown-file', path, '', 'a routine is <name>.asm; ignored'); continue; }
            if (names.has(m[1])) findings.error('duplicate-name', path, '', `another folder holds ${m[1]}.asm too`);
            names.add(m[1]);
        }
        return names;
    },

    resolveIds: () => null,

    encode(ctx, names) {
        setMovedCodeHomes(null);
        lastBuilt = null;
        const errors: AsmError[] = [], files = codeFilesOf(ctx.tree);
        const presentKinds = new Set(ctx.names.keys());
        const owned = ownedSiteSpans(presentKinds, ctx.base.image);
        let ownedSet = ctx.marks.get('code/owned-sites');
        if (!ownedSet) ctx.marks.set('code/owned-sites', ownedSet = new Set());
        for (const s of owned) ownedSet.add(s.start.toString(16));
        const foreign = subtractSpans(baseForeign(ctx), owned);

        const measured = new Map<string, ReturnType<typeof asm.measure>>(), treeLabels = new Map<string, number>();
        const holesMap = new Map<string, Span[]>();
        for (const n of names) {
            const path = files.get(n)!, home = ctx.base.homes.get(`${CODE}/${n}`);
            if (!NAME.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": a label (letters, digits, _), at most 96 characters`); continue; }
            const m = asm.measure(path, readText(ctx.tree.get(path)!), errors);
            if (m.orgs.length) { ctx.findings.error('code-org', path, '', 'implode places each routine; a file has no org'); continue; }
            measured.set(n, m);
            if (home) holesMap.set(n, holesIn(foreign, home.at, home.at + home.length));
            for (const [label, off] of m.labels as Map<string, number>) {
                if (treeLabels.has(label)) ctx.findings.error('duplicate-label', path, '', `label ${label} is defined in another routine too`);
                treeLabels.set(label, RUN + (home?.at ?? 0x08000) + off);
            }
        }

        const movable = findMovableRoutines(measured, ctx.base.homes, holesMap, ctx.base.image, ctx.tree);
        const defs = enumDefines(ctx.ids);
        const wramInfo = wramCodec.defines?.(ctx) ?? { labels: new Map<string, number>(), defines: new Map<string, number>() };
        for (const [k, v] of wramInfo.defines) if (!defs.has(k)) defs.set(k, v);

        // Known non-code asset/table symbol placeholders for Phase 1 error checking & home sha1 matching.
        const placeholders = new Map<string, number>();
        for (const [k, h] of ctx.base.homes) if (!k.startsWith(`${CODE}/`)) placeholders.set(resourceSymbol(k), ((h.at & 0xFFFF) >= 0x8000 ? 0x800000 : 0xC00000) | h.at);
        for (const [kind, set] of ctx.names) {
            if (kind === CODE || kind === 'wram') continue;
            for (const itemName of set) {
                const sym = resourceSymbol(`${kind}/${itemName}`);
                if (!placeholders.has(sym)) placeholders.set(sym, 0x808000);
            }
        }

        const preLookup = (s: string) => {
            if (s.startsWith('!')) return defs.get(s.slice(1));
            return treeLabels.get(s) ?? wramInfo.labels.get(s) ?? placeholders.get(s) ?? addressLabel(s);
        };

        const items: Item[] = [];
        for (const [n, m] of measured) {
            const path = files.get(n)!, home = ctx.base.homes.get(`${CODE}/${n}`);
            const holes = holesMap.get(n) ?? [];
            for (const s of m.skips as { offset: number; length: number }[]) {
                const covered = holes.some(h => s.offset >= h.start && s.offset + s.length <= h.end);
                if (!covered) ctx.findings.error('code-skip', path, '', `skip ${s.length} at +$${s.offset.toString(16)}: no other kind owns those bytes; write them`);
            }
            if (!home) {
                const bytes = asm.encode(m, 0x808000, preLookup, errors);
                items.push({ key: `${CODE}/${n}`, file: path, bytes, rule: { upperHalf: true, noCrossBank: true, below: FASTROM_LIMIT }, patched: true, holes: [] });
                continue;
            }
            const isMovable = movable.has(n);
            if (!isMovable && m.length !== home.length) {
                ctx.findings.error('code-size', path, '', `assembles to ${m.length} bytes; the routine is ${home.length} at its vanilla address, and pinned routines keep both (pad with nop, or move bytes to a new routine)`);
                continue;
            }
            const rule = isMovable ? { upperHalf: true, noCrossBank: true, below: FASTROM_LIMIT } : { above: home.at, below: home.at + home.length };
            const bytes = zero(asm.encode(m, RUN + home.at, preLookup, errors), holes);
            items.push({ key: `${CODE}/${n}`, file: path, bytes, rule, patched: true, holes });
        }
        for (const e of errors) ctx.findings.error('asm', e.file, `line ${e.line}`, e.message);
        lastEncoded = { measured, files, holes: holesMap, items, movable, treeLabels, defs, wramLabels: wramInfo.labels };
        return items;
    },

    symbols(ctx, placed) {
        const out = new Map<string, number>([[`${CODE}/${BUILT_NAME}`, BUILT_MARK]]);
        let moved = false;
        for (const [key, at] of placed) {
            if (!key.startsWith(`${CODE}/`)) continue;
            const home = ctx.base.homes.get(key);
            if (home && home.at !== at) moved = true;
        }
        if (moved) out.set(`${CODE}/${CODE_MOVED_NAME}`, CODE_MOVED_MARK);
        return out;
    },

    tables(ctx, placed) {
        if (!lastEncoded) return [];
        const { measured, files, holes, items, defs, wramLabels } = lastEncoded;
        const placedSymbols = new Map<string, number>();
        for (const [key, at] of placed) {
            if (key.startsWith(`${CODE}/`) || key.startsWith('wram/')) continue;
            const sym = resourceSymbol(key);
            if (!placedSymbols.has(sym)) placedSymbols.set(sym, ctx.pointer(at));
        }
        for (const [key, at] of ctx.symbols) {
            if (key.startsWith(`${CODE}/`) || key.startsWith('wram/') || key.includes('/__')) continue;
            const sym = resourceSymbol(key);
            if (!placedSymbols.has(sym)) placedSymbols.set(sym, ctx.pointer(at));
        }
        const finalLabels = new Map<string, number>();
        const movedHomes: Span[] = [];
        for (const [n, m] of measured) {
            const at = placed.get(`${CODE}/${n}`);
            if (at === undefined) continue;
            const bus = ctx.pointer(at), home = ctx.base.homes.get(`${CODE}/${n}`);
            if (home && home.at !== at) movedHomes.push({ start: home.at, end: home.at + home.length });
            for (const [label, off] of m.labels as Map<string, number>) finalLabels.set(label, bus + off);
        }
        setMovedCodeHomes(movedHomes);

        const lookup = (s: string) => {
            if (s.startsWith('!')) return defs.get(s.slice(1));
            return finalLabels.get(s) ?? wramLabels.get(s) ?? placedSymbols.get(s) ?? addressLabel(s);
        };

        const errors: AsmError[] = [], writes: Write[] = [], entries: BuiltEntry[] = [], byName = new Map<string, BuiltEntry>();
        for (const item of items) {
            const n = item.key.slice(CODE.length + 1), m = measured.get(n), at = placed.get(item.key);
            if (!m || at === undefined) continue;
            const bus = ctx.pointer(at), h = holes.get(n) ?? [];
            const full = zero(asm.encode(m, bus, lookup, errors), h);
            for (const p of piecesOf(item, at)) writes.push({ at: p.start, bytes: full.subarray(p.offset, p.offset + p.end - p.start), file: files.get(n)! });
            const entry: BuiltEntry = { name: n, at, bus, length: m.length, homeAt: ctx.base.homes.get(item.key)?.at, holes: h };
            entries.push(entry); byName.set(n, entry);
        }
        for (const e of errors) ctx.findings.error('asm', e.file, `line ${e.line}`, e.message);
        lastBuilt = { byName, entries, lookup };
        return writes;
    },

    canonical(path, bytes, ctx) {
        if (path === README) return null;
        if (!ctx || !path.endsWith('.asm')) return [path, bytes];
        const n = /([^/]+)\.asm$/.exec(path)![1], flat = `${DIR}/${n}.asm`;
        const built = lastBuilt?.byName.get(n), home = ctx.base.homes.get(`${CODE}/${n}`);
        const bus = built?.bus ?? (home ? RUN + home.at : undefined);
        const expectedLen = built?.length ?? home?.length;
        if (bus === undefined || expectedLen === undefined) return [flat, bytes];
        const errors: AsmError[] = [], m = asm.measure(path, readText(bytes), errors);
        if (errors.length || m.length !== expectedLen) return [flat, bytes];
        const lookup = (s: string) => {
            const own = (m.labels as Map<string, number>).get(s);
            if (own !== undefined) return bus + own;
            if (lastBuilt) return lastBuilt.lookup(s);
            const other = ctx.base.homes.get(`${CODE}/${s}`);
            return other ? RUN + other.at : addressLabel(s);
        };
        const out = asm.encode(m, bus, lookup, errors);
        if (errors.length) return [flat, bytes];
        const holes = built ? built.holes : holesIn(baseForeign(ctx), home!.at, home!.at + home!.length);
        return [flat, zero(out, holes)];
    },
};

/** Every other kind's bytes, from `_base/_base.json` (the same on both sides of the round trip). */
const foreignCache = new WeakMap<object, Foreign[]>();
function baseForeign(ctx: ImplodeContext): Foreign[] {
    let f = foreignCache.get(ctx.base);
    if (!f) {
        const tag = (s: Span) => (s as Span & { kind?: string }).kind ?? 'another kind';
        f = foreignList([...ctx.base.pool, ...ctx.base.tables].map(s => ({ start: s.start, end: s.end, kind: tag(s) })).filter(s => s.kind !== CODE));
        foreignCache.set(ctx.base, f);
    }
    return f;
}

export type { Routine };
