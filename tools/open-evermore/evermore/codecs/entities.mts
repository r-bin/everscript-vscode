// The `entities` kind (docs/open-evermore/resources.md §entities): the expression sub-ops that stand for an entity,
// one file per sub-op, entities/<name>.json: its handler and, for the reader, what it gives. A script writes an entity
// operand that is one such byte by its name (`damage dog b5` for `92 d1 b5`, script-lines.mts); entities/_enum.json
// gives each name its sub-op. Implode writes their words of the sub-op table from the handlers.
//
// Facts used (docs/scripts/vm.md §Expressions, knowledge routines/SCRIPT_EXPRESSION_SUBOP_TABLE.md):
//   table     $8C:F041, one word per sub-op $00-$6F, read by `JMP ($F041,x)` at $8C:EA5D: handlers live in bank $8C
//   entities  $2D the last entity ($0341), $2E the script's own (slot + $0D), $50 the Boy ($0F3E), $51 the Dog
//             ($0F40), $52 the character the player controls ($0F42), $53 the other one. Each ends in the evaluator's
//             next byte ($8C:EA49), so its value is the entity's address with high word 0
//   byte      an expression byte is the sub-op | $80 when it is the expression's last: a lone entity is that byte
// The other sub-ops (constants, reads, operators) are not entities and stay in _base/. Names: the script viewers'.
import * as map from '../map.mts';
import type { Codec, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText } from '../../tree.mts';
import type { Tree } from '../../tree.mts';
import { routines } from './readers.mts';

export const KIND = 'entities';
const DIR = KIND, TABLE = map.file('entities.handler_table'), LIMIT = 0x70, BANK = map.bank('entities.handler_table');
/** The entity sub-ops: [sub-op, name, what it gives]. */
const ENTITIES: [number, string, string][] = [
    [0x2D, 'last_entity', 'the entity at $0341: the one a command last made or named (its +$3E set to 1 when 0)'],
    [0x2E, 'script_owner', 'the entity the running script belongs to (its slot\'s +$0D)'],
    [0x50, 'boy', 'the Boy ($0F3E)'],
    [0x51, 'dog', 'the Dog ($0F40)'],
    [0x52, 'active', 'the character the player controls, the one the camera follows ($0F42)'],
    [0x53, 'inactive', 'the other character: $0F42 with the Boy and the Dog swapped, 0 when none'],
];
export const ENTITY_SUB_OPS = ENTITIES.map(e => e[0]);
const SUB_OPS = new Set(ENTITY_SUB_OPS);
const HANDLERS = routines(BANK);
const hex = (v: number) => v.toString(16).padStart(2, '0');

export const entitiesCodec: Codec = {
    kind: KIND, version: 1, path: DIR, folder: `scripts/${DIR}`,

    defaultName: id => ENTITIES.find(e => e[0] === id)?.[1] ?? `sub_op_${hex(id)}`,

    // Only the handler is the entity; `what` is for the reader.
    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        return [path, json({ handler: JSON.parse(readText(bytes)).handler })];
    },

    explode(rom, name) {
        const files: Tree = new Map(), names: (string | null)[] = Array(LIMIT).fill(null);
        for (const [op, , what] of ENTITIES) {
            const n = name(KIND, op), h = rom[TABLE + 2 * op] | (rom[TABLE + 2 * op + 1] << 8);
            names[op] = n;
            files.set(`${DIR}/${n}.json`, json({ handler: HANDLERS.name(h), what }));
        }
        // The enum ends at the last entity: its ids are sub-ops, null where a sub-op is not one.
        files.set(`${DIR}/${ENUM}`, enumFile({
            kind: KIND, limit: LIMIT, names: names.slice(0, Math.max(...SUB_OPS) + 1),
            why: 'an id is the expression sub-op ($8C:F041, 112 words): only $2D, $2E and $50-$53 are entities',
        }));
        return { files, pool: [], tables: ENTITIES.map(([op]) => ({ start: TABLE + 2 * op, end: TABLE + 2 * op + 2 })), homes: [] };
    },

    names({ tree, findings }) {
        const names = new Set<string>();
        for (const path of tree.keys()) {
            if (!path.startsWith(DIR + '/') || path === `${DIR}/${ENUM}`) continue;
            const m = /^entities\/([^/]+)\.json$/.exec(path);
            if (m) names.add(m[1]); else findings.warning('unknown-file', path, '', 'an entity is one <name>.json; ignored');
        }
        return names;
    },

    encode(ctx, names) {
        const ids = ctx.ids.get(KIND);
        for (const n of names) {
            const path = `${DIR}/${n}.json`;
            if (!NAME_RE.test(n)) { ctx.findings.error('bad-name', path, '', `"${n}": snake_case, at most 80 characters`); continue; }
            const id = ids?.get(n);
            if (id !== undefined && !SUB_OPS.has(id)) ctx.findings.error('invalid-value', `${DIR}/${ENUM}`, '/names', `"${n}" has id $${hex(id)}: an entity is one of the sub-ops $2D, $2E, $50-$53 (the others are constants, reads and operators)`);
            try {
                const v = JSON.parse(readText(ctx.tree.get(path)!));
                if (HANDLERS.at(v.handler) === null) ctx.findings.error('unknown-reference', path, '/handler', `"${v.handler}" is no routine of bank $8C (the evaluator jumps there: JMP ($F041,x)); a routine's name (soe://rom/code/) or "$8C:xxxx"`);
            } catch (e) { ctx.findings.error('parse-error', path, '', (e as Error).message); }
        }
        return [];
    },

    tables(ctx) {
        const ids = ctx.ids.get(KIND);
        if (!ids) return [];
        const byId = new Map([...ids].map(([n, id]) => [id, n])), out: Write[] = [];
        for (const [op] of ENTITIES) {
            const n = byId.get(op);
            if (n === undefined) { ctx.findings.error('id-gap', `${DIR}/${ENUM}`, `/names/${op}`, `no entity has sub-op $${hex(op)}; the evaluator still dispatches it`); continue; }
            const h = HANDLERS.at(JSON.parse(readText(ctx.tree.get(`${DIR}/${n}.json`)!)).handler);
            if (h !== null) out.push({ at: TABLE + 2 * op, bytes: Uint8Array.of(h & 0xFF, h >> 8), file: `${DIR}/${ENUM}` });
        }
        return out;
    },
};
