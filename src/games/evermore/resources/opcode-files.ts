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
import { hiromFileOffset } from '../../../platform/snes/hirom';

type Rom = Uint8Array;

const TABLE = 0x8CE8BD;
const bus = (a: number): string => '$' + (a >>> 16).toString(16).toUpperCase().padStart(2, '0') + ':' + (a & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

/** The handler of `op`: the word in the opcode table (bank $8C). */
function handlerOf(rom: Rom, op: number): number {
    const off = (hiromFileOffset(TABLE)) + 2 * op;
    return (TABLE & 0xFF0000) | rom[off] | (rom[off + 1] << 8);
}

function entryOf(handler: number) {
    return entries('rom').find((e) => e.addr === handler) || null;
}

type Uses = Map<number, { count: number; examples: Instruction[] }>;
interface PairUse {
    count: number;
    examples: Array<{ before: Instruction; after: Instruction }>;
}
interface OpcodeAnalysis {
    byOp: Uses;
    byHandler: Map<number, number[]>;
    pairs: Map<number, Map<number, PairUse>>;
}
let usesCache: { rom: Rom; analysis: OpcodeAnalysis } | null = null;
/** Static reachability, handler aliases and adjacent reachable control-flow pairs for this ROM. */
function analyze(rom: Rom): OpcodeAnalysis {
    if (usesCache && usesCache.rom === rom) return usesCache.analysis;
    const sr = new V.ScriptRom(rom);
    const byOp: Uses = new Map();
    const byHandler = new Map<number, number[]>();
    for (const op of V.OPCODES.keys()) {
        const handler = handlerOf(rom, op);
        const group = byHandler.get(handler) || [];
        group.push(op);
        byHandler.set(handler, group);
    }
    const pairs = new Map<number, Map<number, PairUse>>();
    const walk = V.walk(sr, V.allEntries(sr));
    for (const ins of walk.instructions.values()) {
        let u = byOp.get(ins.opcode);
        if (!u) byOp.set(ins.opcode, u = { count: 0, examples: [] });
        u.count++;
        if (u.examples.length < 5) u.examples.push(ins);
        for (const nextAddress of V.successors(ins)) {
            const after = walk.instructions.get(nextAddress);
            if (!after) continue;
            let following = pairs.get(ins.opcode);
            if (!following) pairs.set(ins.opcode, following = new Map());
            let pair = following.get(after.opcode);
            if (!pair) following.set(after.opcode, pair = { count: 0, examples: [] });
            pair.count++;
            if (pair.examples.length < 3) pair.examples.push({ before: ins, after });
        }
    }
    const analysis = { byOp, byHandler, pairs };
    usesCache = { rom, analysis };
    return analysis;
}

function info(rom: Rom, op: number) {
    const spec = V.OPCODES.get(op);
    if (!spec) return null;
    const handler = handlerOf(rom, op);
    const e = entryOf(handler);
    const analysis = analyze(rom);
    const u = analysis.byOp.get(op);
    const neighbors = (rows: Array<[number, PairUse]>) => rows
        .map(([opcode, pair]) => ({
            opcode, count: pair.count,
            examples: pair.examples.map(({ before, after }) => ({
                before: { address: bus(before.address), text: V.text(before) },
                after: { address: bus(after.address), text: V.text(after) },
            })),
        }))
        .sort((a, b) => b.count - a.count || a.opcode - b.opcode)
        .slice(0, 5);
    const previous = [...analysis.pairs.entries()]
        .flatMap(([opcode, following]) => following.has(op) ? [[opcode, following.get(op)!] as [number, PairUse]] : []);
    const next = [...(analysis.pairs.get(op) || new Map<number, PairUse>()).entries()];
    const aliases = (analysis.byHandler.get(handler) || []).filter((other) => other !== op).sort((a, b) => a - b);
    return {
        opcode: op, name: spec.name || null, operands: spec.operands, flow: spec.flow,
        handler: bus(handler), title: e ? e.title : null, confidence: e ? e.confidence : null,
        description: e ? e.body.trim() : null, knowledge: `soe://localization/knowledge/rom/${handler.toString(16)}.md`,
        handlerAliases: aliases,
        behaviorEvidence: e ? e.confidence : 'undocumented',
        usage: {
            staticReachableInstructions: u ? u.count : 0,
            scope: 'static walk from configured script tables; not execution frequency',
            examples: u ? u.examples.map((i) => ({ address: bus(i.address), text: V.text(i) })) : [],
        },
        combinations: { previous: neighbors(previous), next: neighbors(next) },
    };
}

function opcodeMarkdown(rom: Rom, op: number): string {
    const i = info(rom, op)!;
    const lines = [`# Opcode 0x${hex2(op)}${i.name ? ` — ${i.name}` : ''}`, '',
        `Handler \`${i.handler}\` · operands ${i.operands.length ? '`' + i.operands.join(' ') + '`' : 'none'} · ${i.flow}`, '',
        `Static reachability: **${i.usage.staticReachableInstructions} instruction(s)** in the configured script-table walk. This is not an execution frequency; zero means no occurrence was found in that walk.`,
        `Handler assessment: ${i.behaviorEvidence}${i.handlerAliases.length ? `; shares its handler with ${i.handlerAliases.map((alias) => `[0x${hex2(alias)}](./${hex2(alias)}.md)`).join(', ')}` : '; no other listed opcode shares this handler'}. A mapped handler or a low count alone does not establish that code is garbage or runtime-tested.`, ''];
    lines.push(i.description || 'No knowledge entry for the handler yet.', '');
    if (i.usage.examples.length) lines.push('## Reachable examples', '', ...i.usage.examples.map((x) => `- \`${x.address}\` ${x.text}`), '');
    const pairLines = (direction: 'previous' | 'next') => {
        const pairs = i.combinations[direction];
        if (!pairs.length) return [];
        return [`### ${direction === 'previous' ? 'Often follows' : 'Often precedes'}`, '',
            ...pairs.flatMap((pair) => {
                const examples = pair.examples.map((example) => `  - \`${example.before.address}\` ${example.before.text} → \`${example.after.address}\` ${example.after.text}`);
                return [`- [0x${hex2(pair.opcode)}](./${hex2(pair.opcode)}.md) · ${pair.count} reachable control-flow edge(s)`, ...examples];
            }), ''];
    };
    lines.push('## Nearby commands', '', 'Counts below are static control-flow edges in the reachable script walk, not observed runtime frequencies.', '', ...pairLines('previous'), ...pairLines('next'));
    if (!i.usage.examples.length && !i.combinations.previous.length && !i.combinations.next.length) lines.push('No reachable instruction examples or neighboring commands were found.', '');
    lines.push(`Knowledge entry: [${i.knowledge}](${i.knowledge}) · operand tokens: docs/game-research/script-vm/README.md`);
    return lines.join('\n') + '\n';
}

function indexMarkdown(rom: Rom): string {
    const lines = ['# Script opcodes', '', 'Every opcode the game\'s interpreter has a handler for (dispatch `$8C:D0A6`, table `$8C:E8BD`).',
        'Reachable counts are unique instruction locations in the static walk from configured script tables, not runtime execution frequencies. Shared-handler opcodes are aliases; evidence confidence describes the handler knowledge entry and does not by itself prove runtime correctness or garbage code.',
        'Each page also shows reachable examples and common adjacent opcodes along decoded control-flow edges.', '',
        '| op | name | operands | flow | reachable | shared handler | evidence | title |', '|---|---|---|---|---:|---|---|---|'];
    for (const op of V.OPCODES.keys()) {
        const i = info(rom, op)!;
        lines.push(`| [0x${hex2(op)}](${hex2(op)}.md) | ${i.name ? '`' + i.name + '`' : ''} | ${i.operands.join(' ') || '—'} | ${i.flow} | ${i.usage.staticReachableInstructions} | ${i.handlerAliases.length ? i.handlerAliases.map((alias) => `0x${hex2(alias)}`).join(', ') : '—'} | ${i.behaviorEvidence} | ${i.title || ''} |`);
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
