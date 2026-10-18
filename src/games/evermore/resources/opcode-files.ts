// Ownership: `soe://rom/assets/scripts/opcodes/` — one page per script opcode: what the game's handler
// does (its knowledge entry, src/games/evermore/localizations/knowledge/rom/<handler>.md), its operands
// and flow (src/games/evermore/script-vm spec), the addresses it uses, and where scripts use it.
// Pure apart from the ROM buffer it is handed.

import * as V from '../script-vm';
import { entries } from '../localizations/knowledge';
import { dir, json, text } from './nodes';
import { hexLower as hex2 } from '../../../platform';
import type { Entry } from './nodes';
import type { Instruction } from '../script-vm';

type Rom = Uint8Array;

const TABLE = 0x8CE8BD;
const bus = (a: number): string => '$' + (a >>> 16).toString(16).toUpperCase().padStart(2, '0') + ':' + (a & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

/** The handler of `op`: the word in the opcode table (bank $8C). */
function handlerOf(rom: Rom, op: number): number {
    const off = (TABLE & 0x3FFFFF) + 2 * op;
    return (TABLE & 0xFF0000) | rom[off] | (rom[off + 1] << 8);
}

function entryOf(handler: number) {
    return entries('rom').find((e) => e.addr === handler) || null;
}

type Uses = Map<number, { count: number; examples: Instruction[] }>;
let usesCache: { rom: Rom; byOp: Uses } | null = null;
/** Instructions per opcode in a walk over every script the tables name (the first few addresses). */
function uses(rom: Rom): Uses {
    if (usesCache && usesCache.rom === rom) return usesCache.byOp;
    const sr = new V.ScriptRom(rom);
    const byOp: Uses = new Map();
    for (const ins of V.walk(sr, V.allEntries(sr)).instructions.values()) {
        let u = byOp.get(ins.opcode);
        if (!u) byOp.set(ins.opcode, u = { count: 0, examples: [] });
        u.count++;
        if (u.examples.length < 5) u.examples.push(ins);
    }
    usesCache = { rom, byOp };
    return byOp;
}

function info(rom: Rom, op: number) {
    const spec = V.OPCODES.get(op);
    if (!spec) return null;
    const handler = handlerOf(rom, op);
    const e = entryOf(handler);
    const u = rom ? uses(rom).get(op) : null;
    return {
        opcode: op, name: spec.name || null, operands: spec.operands, flow: spec.flow,
        handler: bus(handler), title: e ? e.title : null, confidence: e ? e.confidence : null,
        description: e ? e.body.trim() : null, knowledge: `soe://localization/knowledge/rom/${handler.toString(16)}.md`,
        uses: u ? u.count : 0, examples: u ? u.examples.map((i) => ({ address: bus(i.address), text: V.text(i) })) : [],
    };
}

function opcodeMarkdown(rom: Rom, op: number): string {
    const i = info(rom, op)!;
    const lines = [`# Opcode 0x${hex2(op)}${i.name ? ` — ${i.name}` : ''}`, '',
        `Handler \`${i.handler}\` · operands ${i.operands.length ? '`' + i.operands.join(' ') + '`' : 'none'} · ${i.flow} · ${i.uses} uses in this ROM`, ''];
    lines.push(i.description || 'No knowledge entry for the handler yet.', '');
    if (i.examples.length) lines.push('## In scripts', '', ...i.examples.map((x) => `- \`${x.address}\` ${x.text}`), '');
    lines.push(`Knowledge entry: [${i.knowledge}](${i.knowledge}) · operand tokens: docs/game-research/script-vm/README.md`);
    return lines.join('\n') + '\n';
}

function indexMarkdown(rom: Rom): string {
    const lines = ['# Script opcodes', '', 'Every opcode the game\'s interpreter has a handler for (dispatch `$8C:D0A6`, table `$8C:E8BD`).',
        'Each page: what the handler does, its operands and flow, the addresses it uses, where scripts use it.', '',
        '| op | name | operands | flow | uses | title |', '|---|---|---|---|---|---|'];
    for (const op of V.OPCODES.keys()) {
        const i = info(rom, op)!;
        lines.push(`| [0x${hex2(op)}](${hex2(op)}.md) | ${i.name ? '`' + i.name + '`' : ''} | ${i.operands.join(' ') || '—'} | ${i.flow} | ${i.uses} | ${i.title || ''} |`);
    }
    return lines.join('\n') + '\n';
}

function resolveOpcodes(rest: string[], rom: Rom) {
    const ops = [...V.OPCODES.keys()];
    if (rest.length === 0) {
        return dir([['index.md', 'file'], ['index.json', 'file'], ...ops.flatMap((o): Entry[] => [[hex2(o) + '.md', 'file'], [hex2(o) + '.json', 'file']])], () => indexMarkdown(rom));
    }
    if (rest.length > 1) return null;
    const leaf = rest[0];
    if (leaf === 'index.md') return text(() => indexMarkdown(rom));
    if (leaf === 'index.json') return json(() => ops.map((o) => info(rom, o)));
    const m = /^([0-9a-f]{2})\.(md|json)$/i.exec(leaf);
    if (!m) return null;
    const op = parseInt(m[1], 16);
    if (!V.OPCODES.has(op)) return null;
    return m[2] === 'md' ? text(() => opcodeMarkdown(rom, op)) : json(() => info(rom, op));
}

export { resolveOpcodes, info as opcodeInfo };
