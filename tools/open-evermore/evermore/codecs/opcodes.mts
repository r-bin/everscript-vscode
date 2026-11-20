// The `opcodes` kind (docs/open-evermore/resources.md §opcodes): the event-script VM's opcodes by name, the names
// the scripts kind writes each command with (`text 75 03` for `51 75 03`). One file per opcode, opcodes/<name>.json:
// its handler; opcodes/_enum.json gives each name its byte. Implode writes the dispatch table from them.
//
// Facts used (docs/scripts/vm.md, src/games/evermore/script-vm/spec.ts):
//   table      $8C:E8BD, one 16-bit handler address per opcode, read by `JSR ($E8BD,x)` in the dispatcher
//              ($8C:D0A6) with X = opcode·2: handlers live in bank $8C. Opcodes $C3 and up index past the table
//              into code, so 195 is the limit while the table stays where it is (bank $8C has no free space)
//   unused     the opcodes spec.ts does not list point at STP instructions ($8C:E8B5-$E8BC): `unused_<xx>`
//   names      spec.ts's (the script viewer's); a name two opcodes share gets the byte as a suffix
// operands and flow in each file come from spec.ts and are for the reader: implode encodes only the handler.
import { createRequire } from 'node:module';
import type { Codec, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const { OPCODES } = require('../../../../dist/games/evermore/script-vm/spec');

export const KIND = 'opcodes';
const DIR = KIND, TABLE = 0x0CE8BD, COUNT = 0xC3, BANK = 0x8C;
const hex = (v: number, n: number) => v.toString(16).padStart(n, '0');
const HANDLER_RE = /^\$8C:([0-9A-Fa-f]{4})$/;

/** Each opcode's default name: spec.ts's, unique (a shared name takes the byte), else unused_<xx>. */
const DEFAULT: string[] = (() => {
    const out: string[] = [], seen = new Set<string>();
    for (let op = 0; op < COUNT; op++) {
        const spec = OPCODES.get(op);
        let n = spec?.name && NAME_RE.test(spec.name) ? spec.name : `unused_${hex(op, 2)}`;
        if (seen.has(n)) n = `${n}_${hex(op, 2)}`;
        seen.add(n); out.push(n);
    }
    return out;
})();

export const opcodesCodec: Codec = {
    kind: KIND, version: 1, path: DIR,

    defaultName: id => DEFAULT[id] ?? `opcode_${hex(id, 2)}`,

    // operands and flow are spec.ts's, written for the reader; only the handler is the opcode.
    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        const v = JSON.parse(readText(bytes));
        return [path, json({ handler: v.handler })];
    },

    explode(rom, name) {
        const files: Tree = new Map(), names: string[] = [];
        for (let op = 0; op < COUNT; op++) {
            const n = name(KIND, op), handler = rom[TABLE + 2 * op] | (rom[TABLE + 2 * op + 1] << 8), spec = OPCODES.get(op);
            names.push(n);
            files.set(`${DIR}/${n}.json`, json({
                handler: `$8C:${hex(handler, 4).toUpperCase()}`,
                ...(spec ? { operands: spec.operands.join(' '), flow: spec.flow } : { why: 'no handler: STP, the CPU stops' }),
            }));
        }
        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: KIND, limit: COUNT, names,
            why: 'the dispatch table at $8C:E8BD (JSR ($E8BD,x), handlers in bank $8C) holds 195 entries; opcodes $C3 and up index past it into code',
        }));
        return { files, pool: [], tables: [{ start: TABLE, end: TABLE + 2 * COUNT }], homes: [] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^opcodes\/([^/]+)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'an opcode is one <name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        for (const n of names) {
            const path = `${DIR}/${n}.json`;
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
            try {
                const v = JSON.parse(readText(ctx.tree.get(path)!));
                if (typeof v.handler !== 'string' || !HANDLER_RE.test(v.handler)) ctx.findings.error('invalid-value', path, '/handler', `"$8C:xxxx": handlers live in bank $${BANK.toString(16).toUpperCase()} (JSR ($E8BD,x))`);
            } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); }
        }
        return [];
    },

    tables(ctx) {
        const ids = ctx.ids.get(KIND);
        if (!ids) return [];
        const table = new Uint8Array(2 * COUNT), byId = new Map([...ids].map(([n, id]) => [id, n]));
        for (let op = 0; op < COUNT; op++) {
            const n = byId.get(op);
            if (n === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${op}`, `no opcode has byte $${hex(op, 2)}; the dispatch table has no gaps`); continue; }
            const m = HANDLER_RE.exec(JSON.parse(readText(ctx.tree.get(`${DIR}/${n}.json`)!)).handler ?? '');
            if (!m) continue;
            const h = parseInt(m[1], 16);
            table.set([h & 0xFF, h >> 8], op * 2);
        }
        return [{ at: TABLE, bytes: table, file: `${DIR}/${ENUM}` }] satisfies Write[];
    },
};

/** An opcode's byte by its default name (explode's, before any rename), for comparing script lines. */
export const DEFAULT_OPCODE = new Map(DEFAULT.map((n, op) => [n, op]));
