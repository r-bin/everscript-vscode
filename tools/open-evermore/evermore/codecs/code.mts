// The code kind (docs/open-evermore/code.md, resources.md §code): every routine the vanilla game runs, one Asar file
// each, `code/<routine>.asm`, named as soe://rom/code/ names it. Step C0: a routine stays at its vanilla address and
// keeps its size, so nothing that reaches it by a fixed address breaks; its bytes are its file's. The census
// (evermore/map/<release>.code.json, code-census.mts) gives the instructions and widths, so explode needs no CDL
// library; implode assembles with platform/snes/asm65816.ts (no external tool), and the text stays Asar's.
//
// Bytes another kind owns inside a routine (a WRAM operand the wram kind rewrites, an instruction an item hook
// replaces, a table read in place) are holes of the routine's item: the file shows them (`skip`, or the instruction
// with "operand written by <kind>"), the other kind writes them. The round trip compares a file by the bytes it
// assembles to, not by its text, so an edited routine whose instructions changed length explodes back to the same
// bytes in other words.
import { createRequire } from 'node:module';
import type { Codec, Exploded, ImplodeContext, Item, Span } from '../../codec.mts';
import { sha1, text, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import * as map from '../map.mts';
import { readCensus } from '../../code-census.mts';
import { RUN, addressLabel, censusHeads, findRoutines, foreignAt, hex6, pieces, routineText, targets } from './code-text.mts';
import type { Foreign, Routine } from './code-text.mts';

const require = createRequire(import.meta.url);
const asm = require('../../../../dist/platform/snes/asm65816');

export const CODE = 'code';
const DIR = 'code', README = `${DIR}/README.md`;
/** Routine names are the knowledge base's (some in capitals) or an address name; Asar labels either way. */
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
(docs/open-evermore/code.md). Step C0: a routine stays at its vanilla address and keeps its size.

- Labels hold the address the CPU runs the code at ($80:xxxx, $8C-$91:xxxx). A routine's name is its first label;
  a jump or branch target is \`loc_<address>\`, a call target with no name \`func_<address>\`.
- Edit an instruction freely as long as the routine's size stays the same (pad with \`nop\`); implode assembles it.
- \`skip n\` marks bytes another kind owns; "operand written by <kind>" marks an operand another kind rewrites (a
  WRAM address the wram kind moves). Change those through their kind.
- A new routine, or a routine that grows, needs step C1 (docs/open-evermore/code.md §5).
`;

export const codeCodec: Codec = {
    kind: CODE,
    version: 1,
    path: DIR,
    nameRe: NAME,
    defaultName: id => `routine_${id}`,

    explode(rom, _name, _options, _count, _nameAt, others = []) {
        const foreign = foreignList(others.flatMap(o => [...o.out.pool, ...o.out.tables].map(s => ({ ...s, kind: o.kind }))));
        const isForeign = (off: number) => foreignAt(foreign, off) !== null;
        // A release with no census keeps its code in _base/. The knowledge base names US addresses only.
        const release = map.gameMap().release;
        if (!readCensus(release)) return { files: new Map(), pool: [], tables: [], homes: [] };
        const hd = censusHeads(rom, release);
        const routines = findRoutines(rom, hd, isForeign, release);
        // Labels: every routine's name at its start, an address name at every target a line starts at.
        const labelAt = new Map<number, string>(routines.map(r => [r.start, r.name]));
        const lineStart = new Set<number>();
        for (const r of routines) for (const p of pieces(rom, hd, r.start, r.end)) {
            if (p.ins) { if (!isForeign(p.at)) lineStart.add(p.at); }
            else for (let i = p.at; i < p.at + p.len; i++) if (!isForeign(i)) lineStart.add(i);
        }
        for (const t of targets(rom, hd, routines)) if (lineStart.has(t) && !labelAt.has(t)) labelAt.set(t, 'loc_' + hex6(RUN + t));
        // Other kinds' resources by place, for the comment on a long operand that points into one.
        const homes = others.flatMap(o => o.out.homes).sort((a, b) => a.at - b.at);
        const resourceAt = (off: number): string | null => {
            let lo = 0, hi = homes.length - 1, best = -1;
            while (lo <= hi) { const mid = (lo + hi) >> 1; if (homes[mid].at <= off) { best = mid; lo = mid + 1; } else hi = mid - 1; }
            if (best < 0 || off >= homes[best].at + homes[best].length) return null;
            const d = off - homes[best].at;
            return homes[best].key + (d ? `+$${d.toString(16).toUpperCase()}` : '');
        };
        const files: Tree = new Map(), pool: Span[] = [], homesOut: Exploded['homes'] = [];
        for (const r of routines) {
            files.set(`${DIR}/${r.name}.asm`, text(routineText({ rom, hd, labelAt, foreign, resourceAt }, r)));
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
        const errors: AsmError[] = [], files = filesOf(ctx), foreign = baseForeign(ctx);
        const measured = new Map<string, ReturnType<typeof asm.measure>>(), symbols = new Map<string, number>();
        for (const n of names) {
            const path = files.get(n)!, home = ctx.base.homes.get(`${CODE}/${n}`);
            if (!NAME.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": a label (letters, digits, _), at most 96 characters`); continue; }
            const m = asm.measure(path, readText(ctx.tree.get(path)!), errors);
            if (!home) { ctx.findings.error('code-new', path, '', 'a new routine needs a place, which step C1 brings (docs/open-evermore/code.md §5); C0 keeps every routine at its vanilla address'); continue; }
            if (m.length !== home.length) { ctx.findings.error('code-size', path, '', `assembles to ${m.length} bytes; the routine is ${home.length} at its vanilla address, and C0 keeps both (pad with nop, or move bytes to another routine)`); continue; }
            if (m.orgs.length) { ctx.findings.error('code-org', path, '', 'implode places each routine; a file has no org'); continue; }
            measured.set(n, m);
            for (const [label, off] of m.labels as Map<string, number>) {
                if (symbols.has(label)) ctx.findings.error('duplicate-label', path, '', `label ${label} is defined in another routine too`);
                symbols.set(label, RUN + home.at + off);
            }
        }
        const lookup = (s: string) => symbols.get(s) ?? addressLabel(s);
        const items: Item[] = [];
        for (const [n, m] of measured) {
            const path = files.get(n)!, home = ctx.base.homes.get(`${CODE}/${n}`)!;
            const holes = holesIn(foreign, home.at, home.at + home.length);
            for (const s of m.skips as { offset: number; length: number }[]) {
                const covered = holes.some(h => s.offset >= h.start && s.offset + s.length <= h.end);
                if (!covered) ctx.findings.error('code-skip', path, '', `skip ${s.length} at +$${s.offset.toString(16)}: no other kind owns those bytes; write them`);
            }
            const bytes = zero(asm.encode(m, RUN + home.at, lookup, errors), holes);
            items.push({ key: `${CODE}/${n}`, file: path, bytes, rule: { above: home.at, below: home.at + home.length }, holes });
        }
        for (const e of errors) ctx.findings.error('asm', e.file, `line ${e.line}`, e.message);
        return items;
    },

    tables: () => [],

    // A routine compares by its bytes (holes left out), so other words for the same bytes are the same file, and by its
    // name, wherever its folder (explode writes `code/<name>.asm`). The README is for the reader.
    canonical(path, bytes, ctx) {
        if (path === README) return null;
        if (!ctx || !path.endsWith('.asm')) return [path, bytes];
        const n = /([^/]+)\.asm$/.exec(path)![1], home = ctx.base.homes.get(`${CODE}/${n}`), flat = `${DIR}/${n}.asm`;
        if (!home) return [flat, bytes];
        const errors: AsmError[] = [], m = asm.measure(path, readText(bytes), errors);
        if (errors.length || m.length !== home.length) return [flat, bytes];
        // Labels: the file's own, then every label of the tree being built (a modder's label in another routine),
        // then a routine by its name, then an address name.
        const tree = treeSymbols(ctx);
        const lookup = (s: string) => {
            const own = (m.labels as Map<string, number>).get(s);
            if (own !== undefined) return RUN + home.at + own;
            const other = ctx.base.homes.get(`${CODE}/${s}`);
            return tree.get(s) ?? (other ? RUN + other.at : addressLabel(s));
        };
        const out = asm.encode(m, RUN + home.at, lookup, errors);
        if (errors.length) return [flat, bytes];
        return [flat, zero(out, holesIn(baseForeign(ctx), home.at, home.at + home.length))];
    },
};

/** `<name>` → its path in the tree (a routine may sit in a subfolder). */
const filesCache = new WeakMap<ImplodeContext['tree'], Map<string, string>>();
function filesOf(ctx: ImplodeContext): Map<string, string> {
    let m = filesCache.get(ctx.tree);
    if (!m) {
        m = new Map();
        for (const path of ctx.tree.keys()) { const x = path.startsWith(DIR + '/') ? /\/([^/]+)\.asm$/.exec(path) : null; if (x) m.set(x[1], path); }
        filesCache.set(ctx.tree, m);
    }
    return m;
}

/** Every label the tree's routines define, at their homes (what encode resolves), for `canonical`. */
const symbolsCache = new WeakMap<ImplodeContext['tree'], Map<string, number>>();
function treeSymbols(ctx: ImplodeContext): Map<string, number> {
    let s = symbolsCache.get(ctx.tree);
    if (!s) {
        s = new Map();
        for (const [n, path] of filesOf(ctx)) {
            const home = ctx.base.homes.get(`${CODE}/${n}`);
            if (!home) continue;
            const m = asm.measure(path, readText(ctx.tree.get(path)!), []);
            for (const [label, off] of m.labels as Map<string, number>) if (!s.has(label)) s.set(label, RUN + home.at + off);
        }
        symbolsCache.set(ctx.tree, s);
    }
    return s;
}

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
