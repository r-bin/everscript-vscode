// Ownership: the pages of `soe://rom/code/`: the routine list (index.md, filtered by query), one
// routine's info.md / .asm / .c, the decompilation worklist (todo.md), and the WRAM and bank views
// built from the same listings. Pure over a catalog (code-catalog.ts).

import { lineText } from './asm-view';
import { analyse, callers } from './code-catalog';
import type { Catalog, CodeFunction, Where } from './code-catalog';
import { TODO_KINDS, todos, select, ramEntry, hex6 } from './code-search';
import { brokenEntries } from '../localizations/knowledge';

const BASE = 'soe://rom/code/';
const page = (fn: CodeFunction, file = 'info.md'): string => `${BASE}${fn.name}/${file === 'info.md' ? file : fn.name + file}`;
const ref = (fn: CodeFunction): string => `[${fn.name}](${page(fn)})`;
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function whereText(at: Where, vanilla: number): string {
    if (at.how === 'same') return hex6(vanilla);
    if (at.how === 'moved') return `**${hex6(at.addr as number)}**${at.ambiguous ? ' (ambiguous)' : ''}`;
    if (at.how === 'missing') return '—';
    return `${hex6(vanilla)}?`;
}

const USAGE = `Routines by name. A routine's folder stays the same in every ROM; its address is looked up in
the ROM being read (US addresses are the reference; a PAL or rebuilt ROM is matched by the
routine's bytes).

| Path | Content |
|---|---|
| \`<name>/info.md\` | the knowledge entry, where it is, what it calls and who calls it, the WRAM it uses, open work |
| \`<name>/<name>.asm\` | the whole routine, the comments of \`localizations/data/asm-comments.json\` infused |
| \`<name>/<name>.c\` | its reconstructed C (\`?file=1\`: the whole C file) |
| \`index.md?q=<word or address>\` | search: name, knowledge text, C, WRAM it touches (\`?q=7E2834\`, \`?q=boy\`), what it calls |
| \`index.md?status=<kind>\` | filter: \`todo\`, \`c\`, \`moved\`, ${Object.keys(TODO_KINDS).map(k => `\`${k}\``).join(', ')}; also \`bank=8c\`, \`category=🧠\`, \`confidence=guess\` |
| [todo.md](${BASE}todo.md) | the decompilation worklist |
| [wram.md](${BASE}wram.md) | WRAM read and written by known routines, and by whom |
| [banks.md](${BASE}banks.md) | routines per ROM bank |
| \`<address>\` | the old address path: a link to the routine's page (\`?asm=1&c=0\`: its .asm, \`?c=1&asm=0\`: its .c) |
`;

function indexPage(cat: Catalog, params: URLSearchParams): string {
    const rows = select(cat, params);
    const q = params.get('q') || params.get('query');
    const filters = [...params.entries()].filter(([k]) => k !== 'rom').map(([k, v]) => `\`${k}=${v}\``);
    const lines = ['# soe://rom/code/', '', filters.length ? `[All routines and how to search](${BASE}index.md).\n` : USAGE];
    if (!cat.ref) lines.push('> No US ROM to compare with: addresses are the US ones, unchecked (`?`).', '');
    lines.push(`${rows.length} of ${cat.list.length} routines${filters.length ? ' for ' + filters.join(' ') : ''}.`, '');
    lines.push(`| Routine | US | This ROM | C | | Confidence | Title${q ? ' | Match' : ''} |`, `|---|---|---|---|---|---|---${q ? '|---' : ''}|`);
    for (const { fn, why } of rows) {
        lines.push(`| ${ref(fn)} | ${hex6(fn.vanilla)} | ${whereText(fn.at, fn.vanilla)} | ${fn.c ? `[C](${page(fn, '.c')})` : '—'} | ${fn.entry.category || ''} | ${fn.entry.confidence || ''} | ${cell(fn.entry.title)}${q ? ' | ' + cell(why.join('; ')) : ''} |`);
    }
    return lines.join('\n') + '\n';
}

function infoPage(cat: Catalog, fn: CodeFunction): string {
    const e = fn.entry, a = analyse(cat, fn), by = callers(cat, fn), work = todos(cat, fn);
    const out = [`# ${e.title}`, '',
        `\`${fn.name}\` · US ${hex6(fn.vanilla)} · this ROM ${whereText(fn.at, fn.vanilla)} · ${e.kind}${e.category ? ' ' + e.category : ''} · ${e.confidence || 'no confidence'}`, '',
        `[${fn.name}.asm](${page(fn, '.asm')}) · ` + (fn.c ? `[${fn.name}.c](${page(fn, '.c')})` : 'no C yet') + ` · bytes: \`soe://bus/${fn.vanilla.toString(16)}\` · entry: \`${e.file}\``, '',
        e.body, ''];
    if (e.evidence.length) out.push('## Evidence', '', ...e.evidence.map(x => `- ${x}`), '');
    if (a) {
        out.push('## Calls', '');
        if (!a.calls.length) out.push('Nothing.', '');
        for (const t of a.calls) { const f = cat.byAddr.get(t) || cat.byAddr.get(t ^ 0x400000); out.push(`- ${hex6(t)} ${f ? ref(f) + ' — ' + cell(f.entry.title) : '(no entry)'}`); }
        out.push('', '## Called by', '', by.length ? by.map(f => `- ${ref(f)} — ${cell(f.entry.title)}`).join('\n') : 'No known routine calls it directly (tables and indirect jumps are not followed).', '');
        out.push('## WRAM', '');
        if (!a.wram.length) out.push('No absolute or long WRAM operands.', '');
        else {
            out.push('| Address | Entry | Access |', '|---|---|---|');
            for (const u of a.wram) { const r = ramEntry(u.addr); out.push(`| ${hex6(u.addr)}${u.viaDb ? ' (DB $7E)' : ''} | ${r ? `${r.name} — ${cell(r.title)}` : ''} | ${[...u.access].join(', ')} |`); }
            out.push('');
        }
        if (a.fields.length) out.push('Record fields (indexed by X/Y): ' + a.fields.map(v => '+$' + v.toString(16).toUpperCase().padStart(2, '0')).join(', '), '');
        if (a.io.length) out.push('Hardware registers: ' + a.io.map(v => '$' + v.toString(16).toUpperCase()).join(', '), '');
        out.push(`${a.lines.length} instructions, ${a.commented} with a comment.`, '');
    }
    out.push('## Open work', '', work.length ? work.map(t => `- **${TODO_KINDS[t.kind]}** — ${cell(t.detail)}`).join('\n') : 'None known.', '');
    if (e.see.length) out.push('## See', '', ...e.see.map(s => `- ${s}`), '');
    return out.join('\n');
}

function asmFile(cat: Catalog, fn: CodeFunction): string {
    const a = analyse(cat, fn);
    const head = `; ${fn.name} — ${fn.entry.title}\n; US ${hex6(fn.vanilla)}, this ROM ${fn.at.addr === null ? 'not found' : hex6(fn.at.addr)} (${fn.at.how})\n; 65816, 16-bit A/X assumed until a REP/SEP; comments: localizations/data/asm-comments.json\n\n`;
    return head + (a ? a.lines.map(lineText).join('\n') + '\n' : '; not in this ROM\n');
}

function cFile(fn: CodeFunction, whole: string | null): string {
    if (!fn.c) return `// ${fn.name} (${hex6(fn.vanilla)}): no reconstructed C yet.\n// Write it in reconstructed-c/${((fn.vanilla >> 16) & 0xFF).toString(16).toUpperCase()}/, with a comment naming ${hex6(fn.vanilla)} right above the function.\n`;
    if (whole !== null) return whole;
    return `// ${fn.name} — ${fn.entry.title}\n// From ${fn.c.file}, lines ${fn.c.from + 1}-${fn.c.to + 1} (?file=1: the whole file)\n\n${fn.c.text}\n`;
}

function todoPage(cat: Catalog): string {
    const by = new Map<string, CodeFunction[]>(Object.keys(TODO_KINDS).map(k => [k, []]));
    const unnamed = new Map<number, Set<string>>();
    for (const fn of cat.list) {
        for (const t of todos(cat, fn)) by.get(t.kind)?.push(fn);
        for (const t of analyse(cat, fn)?.calls || []) {
            if (cat.byAddr.has(t) || cat.byAddr.has(t ^ 0x400000)) continue;
            if (!unnamed.has(t)) unnamed.set(t, new Set());
            (unnamed.get(t) as Set<string>).add(fn.name);
        }
    }
    const out = ['# Decompilation worklist', '', 'What is missing per routine, from the knowledge entries, the reconstructed C and the listings.',
        'Each kind is also a filter: `soe://rom/code/index.md?status=<kind>`.', '', '| Kind | Routines |', '|---|---|'];
    for (const [k, list] of by) out.push(`| ${TODO_KINDS[k]} (\`${k}\`) | ${list.length} |`);
    out.push('', `## Routines without an entry, by callers (${unnamed.size})`, '', 'Called by known routines but not named yet: each wants a knowledge entry (`game-knowledge` skill).', '');
    for (const [t, from] of [...unnamed].sort((x, y) => y[1].size - x[1].size).slice(0, 60)) {
        out.push(`- ${hex6(t)} ← ${[...from].slice(0, 5).map(n => `[${n}](${BASE}${n}/info.md)`).join(', ')}${from.size > 5 ? ` and ${from.size - 5} more` : ''}`);
    }
    const broken = brokenEntries('rom');
    if (broken.length) out.push('', '## Knowledge files that do not parse', '', ...broken.map(f => `- \`${f}\``));
    for (const [k, list] of by) {
        if (!list.length) continue;
        out.push('', `## ${TODO_KINDS[k]} (${list.length})`, '', list.map(f => `[${f.name}](${page(f)})`).join(' · '));
    }
    return out.join('\n') + '\n';
}

function wramPage(cat: Catalog): string {
    const uses = new Map<number, { read: Set<string>; write: Set<string>; viaDb: boolean }>();
    for (const fn of cat.list) for (const u of analyse(cat, fn)?.wram || []) {
        const x = uses.get(u.addr) || { read: new Set<string>(), write: new Set<string>(), viaDb: u.viaDb };
        if (u.access.has('read') || u.access.has('modify')) x.read.add(fn.name);
        if (u.access.has('write') || u.access.has('modify')) x.write.add(fn.name);
        x.viaDb = x.viaDb && u.viaDb;
        uses.set(u.addr, x);
    }
    const names = (s: Set<string>) => [...s].map(n => `[${n}](${BASE}${n}/info.md)`).join(', ');
    const out = ['# WRAM used by known routines', '', 'Absolute and long operands of every routine in this folder. `(DB $7E)`: an absolute operand above $1FFF, WRAM only while the data bank is $7E.',
        'Per address: `index.md?q=<address>` (covers the whole RAM entry).', '', '| Address | Entry | Read by | Written by |', '|---|---|---|---|'];
    for (const [addr, x] of [...uses].sort((p, q) => p[0] - q[0])) {
        const r = ramEntry(addr);
        out.push(`| ${hex6(addr)}${x.viaDb ? ' (DB $7E)' : ''} | ${r ? r.name : ''} | ${names(x.read)} | ${names(x.write)} |`);
    }
    return out.join('\n') + '\n';
}

function banksPage(cat: Catalog): string {
    const banks = new Map<number, CodeFunction[]>();
    for (const fn of cat.list) { const b = (fn.vanilla >> 16) & 0xFF; banks.set(b, [...(banks.get(b) || []), fn]); }
    const out = ['# Routines per bank', '', '| Bank | Routines | With C | Commented | Moved in this ROM |', '|---|---|---|---|---|'];
    for (const [b, list] of [...banks].sort((x, y) => x[0] - y[0])) {
        const commented = list.filter(f => (analyse(cat, f)?.commented || 0) > 0).length;
        out.push(`| [$${b.toString(16).toUpperCase()}](soe://rom/code/index.md?bank=${b.toString(16)}) | ${list.length} | ${list.filter(f => f.c).length} | ${commented} | ${list.filter(f => f.at.how === 'moved').length} |`);
    }
    return out.join('\n') + '\n';
}

export { indexPage, infoPage, asmFile, cFile, todoPage, wramPage, banksPage };
