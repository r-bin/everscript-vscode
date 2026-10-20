// Ownership: `soe://rom/assets/scripts/opcodes/` — one page per script opcode byte, all 256: what the
// opcode is (its entry, src/games/evermore/localizations/knowledge/opcodes/<xx>.md), what its handler
// does (knowledge/rom/<handler>.md), its operands and flow and our name (src/games/evermore/script-vm
// spec), the bytes sharing its handler, and where scripts use it. Groups are `soe://tags/opcode.*`.
// Pure apart from the ROM buffer it is handed.

import * as V from '../script-vm';
import { entries } from '../localizations/knowledge';
import { dir, json, text } from './nodes';
import { hexLower as hex2 } from '../../../platform';
import type { Entry } from './nodes';
import type { Instruction } from '../script-vm';
import type { KnowledgeEntry } from '../localizations/knowledge';
import { hiromFileOffset } from '../../../platform/snes/hirom';

type Rom = Uint8Array;

const TABLE = 0x8CE8BD;
const TRAPS = [0x8CE8B5, 0x8CE8BC];   // the STP bytes in front of the table
const ALL = Array.from({ length: 256 }, (_, i) => i);
const bus = (a: number): string => '$' + (a >>> 16).toString(16).toUpperCase().padStart(2, '0') + ':' + (a & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');

/** Where the dispatcher sends `op`: the word at `$8C:E8BD + 2 * op` (bank $8C). Past `0xC2` that word is code, not a table entry. */
function handlerOf(rom: Rom, op: number): number {
    const off = (hiromFileOffset(TABLE)) + 2 * op;
    return (TABLE & 0xFF0000) | rom[off] | (rom[off + 1] << 8);
}

type Status = 'handled' | 'trap' | 'garbage';
function statusOf(rom: Rom, op: number): Status {
    if (V.OPCODES.has(op)) return 'handled';
    const h = handlerOf(rom, op);
    return h >= TRAPS[0] && h <= TRAPS[1] ? 'trap' : 'garbage';
}

/** Where a garbage pointer lands in bank $8C. */
function region(addr: number): string {
    const a = addr & 0xFFFF;
    if (a < 0x2000) return 'low WRAM (runs RAM contents)';
    if (a < 0x8000) return 'hardware registers / open bus';
    return 'inside bank $8C code (not a routine start)';
}

const romEntry = (addr: number): KnowledgeEntry | null => entries('rom').find((e) => e.addr === addr) || null;
const opEntry = (op: number): KnowledgeEntry | null => entries('opcodes').find((e) => op >= e.addr && op <= e.end) || null;
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

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
    const spec = V.OPCODES.get(op) || null;
    const status = statusOf(rom, op);
    const handler = handlerOf(rom, op);
    const e = status === 'handled' ? romEntry(handler) : null;
    const oe = opEntry(op);
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
    const aliases = status === 'handled' ? (analysis.byHandler.get(handler) || []).filter((other) => other !== op).sort((a, b) => a - b) : [];
    const count = u ? u.count : 0;
    return {
        opcode: op, name: spec ? spec.name : null, status,
        operands: spec ? spec.operands : [], flow: spec ? spec.flow : null,
        title: oe ? oe.title : null, tags: oe ? oe.tags : [], everscript: oe ? list(oe.meta.everscript) : [],
        confidence: oe ? oe.confidence : null,
        description: oe ? oe.body.trim() : null,
        tableEntry: bus(TABLE + 2 * op), handler: bus(handler),
        handlerRegion: status === 'garbage' ? region(handler) : null,
        handlerTitle: e ? e.title : null, handlerDescription: e ? e.body.trim() : null,
        knowledge: `soe://localization/knowledge/rom/${handler.toString(16)}.md`,
        handlerAliases: aliases,
        behaviorEvidence: e ? e.confidence : 'undocumented',
        usage: {
            staticReachableInstructions: count, unused: count === 0,
            scope: 'static walk from configured script tables; not execution frequency',
            examples: u ? u.examples.map((i) => ({ address: bus(i.address), text: V.text(i) })) : [],
        },
        combinations: { previous: neighbors(previous), next: neighbors(next) },
    };
}

const tagLinks = (tags: string[]): string => tags.map((t) => `[${t}](soe://tags/${t}.md)`).join(', ');

function opcodeMarkdown(rom: Rom, op: number): string {
    const i = info(rom, op);
    const lines = [`# Opcode 0x${hex2(op)}${i.name ? ` — ${i.name}` : ''}`, ''];
    if (i.title) lines.push(`**${i.title}**${i.confidence ? ` (${i.confidence})` : ''}`, '');
    const shape = i.status === 'handled' ? `operands ${i.operands.length ? '`' + i.operands.join(' ') + '`' : 'none'} · ${i.flow}` : i.status === 'trap' ? 'invalid: STP' : `invalid: lands in ${i.handlerRegion}`;
    lines.push(`Table entry \`${i.tableEntry}\` → \`${i.handler}\` · ${shape}`, '');
    lines.push(`Groups: ${i.tags.length ? tagLinks(i.tags) : 'none'}${i.everscript.length ? ` · Everscript: ${i.everscript.map((x) => '`' + x + '`').join(', ')}` : ''}`, '');
    lines.push(`Static reachability: **${i.usage.staticReachableInstructions} instruction(s)**${i.usage.unused ? ' — unused by the original scripts' : ''} (static walk from the script tables, not an execution count).`);
    if (i.handlerAliases.length) lines.push(`Same handler as ${i.handlerAliases.map((alias) => `[0x${hex2(alias)}](./${hex2(alias)}.md)`).join(', ')}.`);
    lines.push('', i.description || 'No opcode entry yet.', '');
    if (i.handlerDescription) lines.push(`## Handler \`${i.handler}\`${i.handlerTitle ? ` — ${i.handlerTitle}` : ''}`, '', i.handlerDescription, '');
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
    if (i.combinations.previous.length || i.combinations.next.length) {
        lines.push('## Nearby commands', '', 'Counts below are static control-flow edges in the reachable script walk, not observed runtime frequencies.', '', ...pairLines('previous'), ...pairLines('next'));
    }
    lines.push(`Opcode entry: \`src/games/evermore/localizations/knowledge/opcodes/${hex2(op >= 0xC3 ? 0xC3 : op)}.md\`${i.status === 'handled' ? ` · handler entry: [${i.knowledge}](${i.knowledge})` : ''} · operand tokens: docs/game-research/script-vm/README.md`);
    return lines.join('\n') + '\n';
}

function indexMarkdown(rom: Rom): string {
    const rows = ALL.map((op) => info(rom, op));
    const handled = rows.filter((r) => r.status === 'handled');
    const lines = ['# Script opcodes', '',
        'All 256 opcode bytes. The interpreter (`$8C:D0A6`) doubles the byte and calls through the table at `$8C:E8BD`: '
        + `${handled.length} bytes reach a handler (${handled.filter((r) => r.usage.unused).length} of them unused by the original scripts), `
        + `${rows.filter((r) => r.status === 'trap').length} stop the CPU (STP), and ${rows.filter((r) => r.status === 'garbage').length} (\`0xC3\`-\`0xFF\`) read past the table into code.`,
        'Name = the script viewer\'s spelling. Reachable = instructions in a static walk from the script tables (not an execution count). Groups: `soe://tags/opcode.*`.', '',
        '| op | name | what | groups | operands | reachable | same handler | Everscript | confidence |', '|---|---|---|---|---|---:|---|---|---|'];
    for (const r of rows) {
        const what = r.title || (r.status === 'trap' ? 'Invalid (STP)' : 'Invalid (past the table)');
        lines.push(`| [0x${hex2(r.opcode)}](${hex2(r.opcode)}.md) | ${r.name ? '`' + r.name + '`' : '—'} | ${what} | ${r.tags.map((t) => t.replace(/^opcode\./, '')).join(', ')} | ${r.status === 'handled' ? (r.operands.join(' ') || '—') : '—'} | ${r.usage.staticReachableInstructions} | ${r.handlerAliases.map((a) => `0x${hex2(a)}`).join(', ') || '—'} | ${r.everscript.map((x) => '`' + x + '`').join(', ')} | ${r.confidence || ''} |`);
    }
    return lines.join('\n') + '\n';
}

function resolveOpcodes(rest: string[], rom: Rom) {
    if (rest.length === 0) {
        return dir([['index.md', 'file'], ['index.json', 'file'], ...ALL.flatMap((o): Entry[] => [[hex2(o) + '.md', 'file'], [hex2(o) + '.json', 'file']])], () => indexMarkdown(rom));
    }
    if (rest.length > 1) return null;
    const leaf = rest[0];
    if (leaf === 'index.md') return text(() => indexMarkdown(rom));
    if (leaf === 'index.json') return json(() => ALL.map((o) => info(rom, o)));
    const m = /^([0-9a-f]{2})\.(md|json)$/i.exec(leaf);
    if (!m) return null;
    const op = parseInt(m[1], 16);
    return m[2] === 'md' ? text(() => opcodeMarkdown(rom, op)) : json(() => info(rom, op));
}

export { resolveOpcodes, info as opcodeInfo };
