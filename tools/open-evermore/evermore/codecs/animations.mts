// The `animations` kind (docs/open-evermore/resources.md §characters): the animations event scripts play by id
// (`animate`, opcodes 0x78/0x79, operand = 2·id), one file per id, animations/<name>.json: the animation record it
// plays (a 16-bit offset in bank $C4) and, for the reader, its facings, frames and the sprite blocks each frame shows
// (animation-view.mts). Implode writes the id table wherever it lands and the one operand that reads it.
//
// Facts used (docs/open-evermore/animations.md §1, tools/table-hack/tables.js `animate_ids`, proven moved there):
//   table     212 words at $C4:3C92, read only by `lda.l $C43C92,x` at $8C:E13C; moving it frees $C4:3C92-$3E39
//             for new animation records (record ids are offsets into bank $C4, so they must stay there)
//   limit     2,048 ids (the table hack's reading: ids ≥ $8000 mean the character's own field, so X stays below)
//   records   stay in _base/ (61 code immediates name record groups: animations.md); a record is a number here
// Names: our compiler's (language/data/index.json ANIMATION_BOY / _DOG / _ENEMY / _ALL / _PLACEHOLDER, values 2·id).
import { createRequire } from 'node:module';
import type { Codec, Item } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText, sha1 } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { describeRecord } from './animation-view.mts';
import { hexText, parseHex, readerSpans, readerWrites, tableAt } from './readers.mts';
import type { Reader } from './readers.mts';

const require = createRequire(import.meta.url);
const ENUMS: Record<string, { name: string; value: string }[]> = require('../../../../src/games/evermore/language/data/index.json').enums;

export const KIND = 'animations';
const DIR = KIND, TABLE = `${DIR}/_table`, VANILLA = 212, LIMIT = 2048, RECORD_BANK = 0xC4;
const READERS: Reader[] = [{ at: 0x0CE13D, add: 0 }];

/** Our compiler's name for each id (its enums hold 2·id), first come first served, prefixed by whose it is. */
const NAMES = new Map<number, string>();
for (const [list, prefix] of [['ANIMATION_BOY', 'boy_'], ['ANIMATION_DOG', 'dog_'], ['ANIMATION_ENEMY', ''], ['ANIMATION_ALL', ''], ['ANIMATION_PLACEHOLDER', '']] as const) {
    for (const e of ENUMS[list] ?? []) {
        const v = parseInt(e.value, 16), n = (prefix + e.name).toLowerCase();
        if (v < 0x8000 && !(v & 1) && NAME_RE.test(n) && !NAMES.has(v / 2) && ![...NAMES.values()].includes(n)) NAMES.set(v / 2, n);
    }
}

export const animationsCodec: Codec = {
    kind: KIND, version: 2, path: DIR,

    defaultName: id => NAMES.get(id) ?? `animation_${id.toString(16).padStart(3, '0')}`,

    // Only the record is the animation; what it shows is derived for the reader.
    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        return [path, json({ record: JSON.parse(readText(bytes)).record })];
    },

    explode(rom, name, _options, countOf) {
        const at = tableAt(rom, READERS, KIND), count = countOf(KIND) ?? VANILLA;
        const files: Tree = new Map(), names: string[] = [];
        for (let id = 0; id < count; id++) {
            const n = name(KIND, id);
            names.push(n);
            const record = rom[at + 2 * id] | (rom[at + 2 * id + 1] << 8);
            files.set(`${DIR}/${n}.json`, json({ record: hexText(record, 4, RECORD_BANK), ...(describeRecord(rom, record, name) ?? {}) }));
        }
        files.set(`${DIR}/${ENUM}`, enumFile({ kind: KIND, limit: LIMIT, names, why: 'the id table read by `lda.l $C43C92,x` at $8C:E13C: 2,048 words (ids of $8000 and up mean the character\'s own field)' }));
        const span = { start: at, end: at + 2 * count };
        return { files, pool: [span], tables: readerSpans(READERS), homes: [{ key: TABLE, at, length: 2 * count, sha1: sha1(rom.subarray(span.start, span.end)) }] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^animations\/([^/]+)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'an animation is one <name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        for (const n of names) {
            const path = `${DIR}/${n}.json`;
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
            let v: { record?: unknown };
            try { v = JSON.parse(readText(ctx.tree.get(path)!)); } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); continue; }
            if (parseHex(v.record, 0xFFFF, RECORD_BANK) === null) ctx.findings.error('invalid-value', path, '/record', '"$C4:xxxx": an animation record in bank $C4 (record ids are offsets there)');
        }
        const count = Math.max(-1, ...(ctx.ids.get(KIND)?.values() ?? [])) + 1;
        // Long-indexed reads; kept inside one bank like vanilla's.
        return [{ key: TABLE, file: `${DIR}/${ENUM}`, bytes: new Uint8Array(2 * count), rule: { noCrossBank: true }, generated: true }] satisfies Item[];
    },

    tables(ctx, placed) {
        const ids = ctx.ids.get(KIND), at = placed.get(TABLE);
        if (!ids || at === undefined) return [];
        const count = Math.max(-1, ...ids.values()) + 1, bytes = new Uint8Array(2 * count), byId = new Map([...ids].map(([n, id]) => [id, n]));
        for (let id = 0; id < count; id++) {
            const n = byId.get(id);
            if (n === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${id}`, `no animation has id ${id}; the table cannot skip one yet`); continue; }
            const r = parseHex(JSON.parse(readText(ctx.tree.get(`${DIR}/${n}.json`)!)).record, 0xFFFF, RECORD_BANK) ?? 0;
            bytes.set([r & 0xFF, r >> 8], 2 * id);
        }
        return [{ at, bytes, file: `${DIR}/${ENUM}` }, ...readerWrites(ctx, READERS, at, `${DIR}/${ENUM}`)];
    },
};
