// Ownership: routing of `soe://rom/code/` — routines by name (pages in code-markdown.ts, data in
// code-catalog.ts). The name is the folder, so a link holds in every ROM:
//
//   soe://rom/code/index.md[?q=…&status=…]   all routines with their addresses; search and filters
//   soe://rom/code/index.json[?…]            the same as data
//   soe://rom/code/search.md?q=…             link to index.md (same query)
//   soe://rom/code/todo.md                   the decompilation worklist
//   soe://rom/code/wram.md, banks.md         WRAM used by known routines; routines per bank
//   soe://rom/code/<name>/info.md            knowledge entry, place, calls, callers, WRAM, open work
//   soe://rom/code/<name>/<name>.asm         the whole routine, asm comments infused (?comments=0: raw)
//   soe://rom/code/<name>/<name>.c           its reconstructed C (?file=1: the whole file)
//   soe://rom/code/<address>                 old address path: a link to the routine's page

import * as fs from 'fs';
import * as path from 'path';
import { dir, text, json, link, type Entry } from './nodes';
import { asmListing, lineText } from './asm-view';
import { getDecompiledC } from './decomp-view';
import { catalog, findFunction, analyse } from './code-catalog';
import type { Catalog, CodeFunction } from './code-catalog';
import { select, todos, hex6 } from './code-search';
import { indexPage, infoPage, asmFile, cFile, todoPage, wramPage, banksPage } from './code-markdown';
import { REPO } from './code-c-index';
import { hiromFileOffset } from '../../../platform/snes/hirom';
import type { MapsDeps } from './map-files';

type CodeDeps = MapsDeps & { vanillaRom?(): Uint8Array | null };
const PAGES = ['index.md', 'index.json', 'search.md', 'todo.md', 'wram.md', 'banks.md'];

/** A bus address from an old `code/<address>` segment (6 hex digits, `$` and an extension allowed). */
function parseCodeAddress(raw: string): number | null {
    const m = /^\$?([0-9A-Fa-f]{6})(?:\.(?:md|c|asm))?$/.exec(raw);
    if (!m) return null;
    const v = parseInt(m[1], 16);
    return v < 0x400000 ? ((v & 0xFFFF) >= 0x8000 ? 0x800000 | v : 0xC00000 + v) : v;
}

function functionDir(cat: Catalog, fn: CodeFunction, params: URLSearchParams, rest: string[]) {
    const [leaf] = rest;
    if (leaf === undefined) {
        const entries: Entry[] = [['info.md', 'file'], [fn.name + '.asm', 'file'], [fn.name + '.c', 'file']];
        return dir(entries, () => infoPage(cat, fn));
    }
    if (rest.length > 1) return null;
    if (leaf === 'info.md' || leaf === 'index.md') return text(() => infoPage(cat, fn));
    if (leaf === fn.name + '.asm') {
        if (params.get('comments') !== '0') return text(() => asmFile(cat, fn));
        return text(() => (analyse(cat, fn)?.lines || []).map(l => lineText({ ...l, comment: undefined })).join('\n') + '\n');
    }
    if (leaf === fn.name + '.c') {
        const whole = params.get('file') === '1' && fn.c ? fs.readFileSync(path.join(REPO, fn.c.file), 'utf8') : null;
        return text(() => cFile(fn, whole));
    }
    return null;
}

/** The routine list as data (for panels and agents). */
function indexJson(cat: Catalog, params: URLSearchParams) {
    return select(cat, params).map(({ fn, why }) => ({
        name: fn.name, title: fn.entry.title, kind: fn.entry.kind, category: fn.entry.category, confidence: fn.entry.confidence,
        us: hex6(fn.vanilla), addr: fn.at.addr === null ? null : hex6(fn.at.addr), located: fn.at.how,
        c: fn.c ? `${fn.c.file}:${fn.c.from + 1}` : null, entry: fn.entry.file, todo: todos(cat, fn).map(t => t.kind),
        ...(why.length ? { match: why } : {}),
    }));
}

/** The old combined page for an address no routine entry starts at. */
function legacyPage(rom: Uint8Array, bus: number, params: URLSearchParams): string {
    const showC = params.get('c') !== '0' && !(params.has('asm') && !params.has('c'));
    const showAsm = params.get('asm') !== '0' && !(params.has('c') && !params.has('asm'));
    let md = `# Routine: ${hex6(bus)}\n\nNo routine entry starts here; [all routines](soe://rom/code/index.md).\n\n`;
    if (showC) {
        const decomp = getDecompiledC(bus);
        md += '## Reconstructed C\n\n```c\n' + (decomp ? `/* Source: ${decomp.source} (${decomp.path}) */\n${decomp.code}` : '// none') + '\n```\n\n';
    }
    if (showAsm) md += '## 65816 Disassembly\n\n```assembly\n' + asmListing(rom, bus, { comments: params.get('comments') !== '0' }) + '\n```\n';
    return md;
}

function resolveCode(segments: string[], rom: Uint8Array, deps?: CodeDeps) {
    const params = new URLSearchParams(deps?.query || '');
    const cat = catalog(rom, deps?.vanillaRom ? deps.vanillaRom() : null);
    const [head, ...rest] = segments;
    if (head === undefined) {
        return dir([...PAGES.map((p): Entry => [p, p === 'search.md' ? 'link' : 'file']), ...cat.list.map((f): Entry => [f.name, 'dir'])], () => indexPage(cat, params));
    }
    if (rest.length === 0) {
        if (head === 'index.md') return text(() => indexPage(cat, params));
        if (head === 'search.md') return link(text(() => indexPage(cat, params)), 'soe://rom/code/index.md');
        if (head === 'index.json') return json(() => indexJson(cat, params));
        if (head === 'todo.md') return text(() => todoPage(cat));
        if (head === 'wram.md') return text(() => wramPage(cat));
        if (head === 'banks.md') return text(() => banksPage(cat));
    }
    const fn = findFunction(cat, head);
    if (fn) return functionDir(cat, fn, params, rest);
    const bus = rest.length === 0 ? parseCodeAddress(head) : null;
    if (bus === null || hiromFileOffset(bus) >= rom.length) return null;
    const known = cat.list.find(f => f.vanilla === bus || hiromFileOffset(f.vanilla) === hiromFileOffset(bus));
    if (!known) return text(() => legacyPage(rom, bus, params));
    const leaf = params.get('asm') === '1' && params.get('c') !== '1' ? known.name + '.asm'
        : params.get('c') === '1' && params.get('asm') !== '1' ? known.name + '.c' : 'info.md';
    return link(functionDir(cat, known, params, [leaf]), `soe://rom/code/${known.name}/${leaf}`);
}

export { resolveCode, parseCodeAddress };
