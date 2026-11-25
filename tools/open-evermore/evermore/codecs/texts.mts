// The texts kind (docs/open-evermore/resources.md §texts): the plain texts in bank $C4 that menus print, one file each,
// `strings/menu/<name>.txt` (dialogue is the strings kind, `strings/dialogue/`). A ring item's name, a weapon's,
// armour's, formula's and ingredient's name (the same text as its ring item's), a description, a named item's name: each
// reader holds a 16-bit pointer in bank $C4 and names the text by reference (`strings/menu/rare_item`), so texts are shared
// by name, as the ROM shares them by pointer.
//
// Facts used (menus.mts, records.mts, items.mts: every pointer to such a text is a source registered here):
//   a text is NUL-terminated printable ASCII; its readers print it with $8C:9E03 (bank #$C4) or copy it, never by length
//   a text stays where it was while it fits (records keep their readers' cycles; G0); a longer or new one goes anywhere in
//   bank $C4 that is free (vanilla has no free byte there: it fits only where another text was left out)
import type { Codec, Exploded, ImplodeContext, Item } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { link, unlink } from '../../links.mts';

export const TEXTS = 'texts';
const DIR = TEXTS, BANK = 0x040000, BANK_END = 0x050000, LIMIT = 4096;

/** File offsets (in bank $C4) of texts a reader points at; each reader of texts registers one. */
type Source = (rom: Uint8Array) => number[];
const SOURCES: Source[] = [];
export const addTextSource = (s: Source): void => { SOURCES.push(s); };

/** The item key of a text: its placement (`placed`, `homes`). */
export const textKey = (name: string): string => `${DIR}/${name}`;

function textAt(rom: Uint8Array, at: number): string {
    let s = '';
    for (let i = at; rom[i] !== 0; i++) {
        if (rom[i] < 0x20 || rom[i] > 0x7E) throw new Error(`texts: the text at $C4:${(at & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')} has byte $${rom[i].toString(16)}; explode would lose it`);
        s += String.fromCharCode(rom[i]);
    }
    return s;
}

/** A name from the text: its words, lower case, cut at a word end within 40 characters. */
function slug(text: string): string {
    let s = text.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!s) return 'empty';
    if (s.length > 40) s = s.slice(0, 41).replace(/_[^_]*$/, '');
    if (!/^[a-z]/.test(s)) s = `text_${s}`.replace(/_$/, '');
    return s;
}

interface Texts { at: number[]; text: string[]; names: string[]; id: Map<number, number> }
const CACHE = new WeakMap<Uint8Array, Texts>();
let LAST: Texts | null = null;

/** Every text the ROM's readers point at, in ROM order (its id), with the name explode gives it. */
export function textsOf(rom: Uint8Array): Texts {
    const known = CACHE.get(rom);
    if (known) return LAST = known;
    const at = [...new Set(SOURCES.flatMap(s => s(rom)))].sort((a, b) => a - b);
    for (const p of at) if (p < BANK || p >= BANK_END) throw new Error(`texts: a reader points at $${p.toString(16)}, outside bank $C4`);
    const text = at.map(p => textAt(rom, p));
    at.forEach((p, k) => { if (k + 1 < at.length && p + text[k].length + 1 > at[k + 1]) throw new Error(`texts: $C4:${(at[k + 1] & 0xFFFF).toString(16)} points inside the text at $C4:${(p & 0xFFFF).toString(16)}; explode would lose the sharing`); });
    const seen = new Set<string>();
    const names = text.map(t => { const b = slug(t); let n = b; for (let k = 2; seen.has(n); k++) n = `${b}_${k}`; seen.add(n); return n; });
    const out = { at, text, names, id: new Map(at.map((p, k) => [p, k])) };
    CACHE.set(rom, out);
    return LAST = out;
}

/** The reference a reader's field writes for the text at file offset `at` (bank $C4): the tree's name for it. */
export function textLink(rom: Uint8Array, at: number, name: (kind: string, id: number) => string, nameAt: (kind: string, at: number) => string | undefined): string {
    const id = textsOf(rom).id.get(at);
    if (id === undefined) throw new Error(`texts: $C4:${(at & 0xFFFF).toString(16)} is no text a registered reader points at`);
    return link(TEXTS, nameAt(TEXTS, at) ?? name(TEXTS, id));
}

/** The text a reference names (read from its file), or null. */
export function textContent(ctx: ImplodeContext, ref: unknown): string | null {
    const n = unlink(TEXTS, ref), bytes = n === undefined ? undefined : ctx.tree.get(`${DIR}/${n}.txt`);
    return bytes ? fromFile(bytes) : null;
}
/** The name a reference names when the tree has it, else undefined. */
export function textName(ctx: ImplodeContext, ref: unknown): string | undefined {
    const n = unlink(TEXTS, ref);
    return n !== undefined && ctx.ids.get(TEXTS)?.has(n) ? n : undefined;
}
/** Where the text `name` landed, as the 16-bit pointer its readers hold (bank $C4), or null when it did not. */
export function textPointer(ctx: ImplodeContext, placed: Map<string, number>, name: string): number | null {
    const at = placed.get(textKey(name));
    return at === undefined || at < BANK || at >= BANK_END ? null : at & 0xFFFF;
}

/** A file holds the text and one line end. */
const fromFile = (b: Uint8Array) => readText(b).replace(/\r?\n$/, '');
const toFile = (t: string) => new TextEncoder().encode(`${t}\n`);

export const textsCodec: Codec = {
    kind: TEXTS, version: 1, path: DIR, folder: 'strings/menu',
    defaultName: id => LAST?.names[id] ?? `text_${id.toString(16).padStart(3, '0')}`,

    explode(rom, name) {
        const t = textsOf(rom), files: Tree = new Map(), names = t.at.map((_, k) => name(TEXTS, k));
        const pool: Exploded["pool"] = [], homes: Exploded["homes"] = [];
        t.at.forEach((at, k) => {
            files.set(`${DIR}/${names[k]}.txt`, toFile(t.text[k]));
            const length = t.text[k].length + 1;
            pool.push({ start: at, end: at + length });
            homes.push({ key: textKey(names[k]), at, length, sha1: sha1(rom.slice(at, at + length)) });
        });
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: TEXTS, limit: LIMIT, names, why: 'a text has no id the game reads: readers hold 16-bit pointers in bank $C4; ids are ROM order' }));
        return { files, pool, tables: [], homes };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^texts\/([^/]+)\.txt$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'a text is one <name>.txt; ignored');
        }
        return names;
    },

    // Each text where it was while it fits; a longer or new one anywhere free in bank $C4.
    encode(ctx, names) {
        const items: Item[] = [], ids = ctx.ids.get(TEXTS) ?? new Map<string, number>();
        const homes = [...ctx.base.homes].filter(([k]) => k.startsWith(`${DIR}/`)).map(([, h]) => h);
        for (const n of names) {
            const file = `${DIR}/${n}.txt`;
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', file, '', `"${n}": snake_case, at most 80 characters`); continue; }
            const text = fromFile(ctx.tree.get(file)!);
            if (!/^[\x20-\x7E]*$/.test(text)) { ctx.findings.error('invalid-value', file, '', 'printable ASCII on one line: the menus print bytes $20-$7E'); continue; }
            const bytes = new Uint8Array(text.length + 1);
            for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
            // Renamed: the home of the same id (homes are in ROM order, so in id order).
            const home = ctx.base.homes.get(textKey(n)) ?? homes[ids.get(n) ?? -1];
            if (home && bytes.length <= home.length) {
                const padded = new Uint8Array(home.length); padded.set(bytes);
                items.push({ key: textKey(n), file, bytes: padded, rule: { above: home.at, below: home.at + home.length, bankOffset: home.at & 0xFFFF } });
            } else items.push({ key: textKey(n), file, bytes, rule: { above: BANK, below: BANK_END, noCrossBank: true } });
        }
        return items;
    },

    tables: () => [],
};
