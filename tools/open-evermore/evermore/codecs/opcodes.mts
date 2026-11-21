// The `opcodes` kind (docs/open-evermore/resources.md §opcodes): the event-script VM's opcodes by name, the names
// the scripts kind writes each command with (`text 75 03` for `51 75 03`). One file per opcode, opcodes/<name>.json:
// its handler, and for the reader what it does as a C prototype with each parameter's type, encoding and unit
// (script-vm/parameters.json, knowledge/opcodes/<xx>.md); opcodes/_enum.json gives each name its byte. Implode
// writes the dispatch table from the handlers.
//
// Facts used (docs/scripts/vm.md, src/games/evermore/script-vm/spec.ts):
//   table      $8C:E8BD, one 16-bit handler address per opcode, read by `JSR ($E8BD,x)` in the dispatcher
//              ($8C:D0A6) with X = opcode·2: handlers live in bank $8C. Opcodes $C3 and up index past the table
//              into code, so 195 is the limit while the table stays where it is (bank $8C has no free space)
//   unused     the opcodes spec.ts does not list point at STP instructions ($8C:E8B5-$E8BC): `unused_<xx>`
//   names      spec.ts's (the script viewer's); a name two opcodes share gets the byte as a suffix
//   handlers   by the name of their knowledge entry (the routine names of soe://rom/code/): every one of the 195 has
//              one. Code is not a kind yet, so a name stands for its fixed address in bank $8C
// Everything but the handler is derived for the reader: implode encodes only the handler.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Codec, Write } from '../../codec.mts';
import { ENUM, enumFile } from '../../enum.mts';
import { json, NAME_RE, readText } from '../../tree.mts';
import { routines } from './readers.mts';
import type { Tree } from '../../tree.mts';

const require = createRequire(import.meta.url);
const { OPCODES } = require('../../../../dist/games/evermore/script-vm/spec');
const PARAMETERS: Record<string, { name: string; params?: { name: string; type: string; enum?: string; unit?: string }[] }> = require('../../../../src/games/evermore/script-vm/parameters.json');
const KNOWLEDGE = new URL('../../../../src/games/evermore/localizations/knowledge/opcodes/', import.meta.url);

/** C types for parameters.json's (types of its `types` table inherit from a base). */
const C_TYPE: Record<string, string> = {
    u8: 'uint8_t', u16: 'uint16_t', s16: 'int16_t', bool: 'bool', entity: 'entity_t', script: 'script_t', jump: 'label_t',
    list: 'entity_t[] /* 0-terminated */', args: 'args_t', flag: 'flag_t', percentage: 'uint8_t', object_index: 'uint8_t', skip: 'uint8_t',
};
/** How each operand token is encoded in the script (spec.ts). */
const ENCODING: Record<string, string> = {
    u8: 'byte', u16: 'word', u24: 'packed script pointer (3 bytes)', E: 'expression', A: 'argument count, then expressions',
    Z: 'expressions up to a 0', r16: 'signed word from the end of the operand', rb: 'byte back from the opcode',
    cb: 'byte back (relative call)', c16: 'word back (relative call)', skip: 'byte, skipped',
};
const FLOW: Record<string, string> = {
    next: 'the next command runs in the same frame', yield: 'the thread\'s turn ends', branch: 'the next command or the jump target',
    jump: 'only the jump target', call: 'runs the script, then the next command (yields)', start: 'starts the script as a thread and continues',
    end: 'the script ends', reset: 'the game resets',
};

/** The knowledge entry's title: what the opcode does. */
function summary(op: number): string | undefined {
    try { return /^title: (.*)$/m.exec(readFileSync(new URL(`${op.toString(16).toUpperCase().padStart(2, '0')}.md`, KNOWLEDGE), 'utf8'))?.[1]; } catch { return undefined; }
}

/** The reader's part of an opcode's file: each parameter, the flow. */
function described(op: number): Record<string, unknown> {
    const spec = OPCODES.get(op);
    if (!spec) return { what: 'no handler: STP, the CPU stops' };
    const params = PARAMETERS['0x' + hex(op, 2)]?.params ?? [];
    const typeOf = (t: string) => C_TYPE[t] ?? C_TYPE[(PARAMETERS as any).types?.[t]?.base] ?? t;
    const list = params.map((q, i) => ({
        name: q.name, type: typeOf(q.type), ...(q.enum ? { enum: q.enum } : {}),
        ...(params.length === spec.operands.length ? { encoding: ENCODING[spec.operands[i]] ?? spec.operands[i] } : {}),
        ...(q.unit ? { unit: q.unit } : {}),
    }));
    return {
        what: summary(op),
        params: list,
        flow: `${spec.flow}: ${FLOW[spec.flow] ?? ''}`,
    };
}

export const KIND = 'opcodes';
const DIR = KIND, TABLE = 0x0CE8BD, COUNT = 0xC3, BANK = 0x8C;
const hex = (v: number, n: number) => v.toString(16).padStart(n, '0');
/** Handlers by routine name (`$8C:xxxx` for code no entry names yet). */
const HANDLERS = routines(BANK);

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
    kind: KIND, version: 1, path: DIR, folder: `scripts/${DIR}`,

    defaultName: id => DEFAULT[id] ?? `opcode_${hex(id, 2)}`,

    // Only the handler is the opcode; the rest is written for the reader.
    canonical(path, bytes) {
        if (path === `${DIR}/${ENUM}`) return [path, bytes];
        const v = JSON.parse(readText(bytes));
        return [path, json({ handler: v.handler })];
    },

    explode(rom, name) {
        const files: Tree = new Map(), names: string[] = [];
        for (let op = 0; op < COUNT; op++) {
            const n = name(KIND, op), handler = rom[TABLE + 2 * op] | (rom[TABLE + 2 * op + 1] << 8);
            names.push(n);
            files.set(`${DIR}/${n}.json`, json({ handler: HANDLERS.name(handler), ...described(op) }));
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
                if (HANDLERS.at(v.handler) === null) ctx.findings.error('unknown-reference', path, '/handler', `"${v.handler}" is no routine of bank $${BANK.toString(16).toUpperCase()} (handlers live there: JSR ($E8BD,x)); a routine's name (soe://rom/code/) or "$8C:xxxx"`);
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
            const h = HANDLERS.at(JSON.parse(readText(ctx.tree.get(`${DIR}/${n}.json`)!)).handler);
            if (h === null) continue;
            table.set([h & 0xFF, h >> 8], op * 2);
        }
        return [{ at: TABLE, bytes: table, file: `${DIR}/${ENUM}` }] satisfies Write[];
    },
};

/** An opcode's byte by its default name (explode's, before any rename), for comparing script lines. */
export const DEFAULT_OPCODE = new Map(DEFAULT.map((n, op) => [n, op]));
