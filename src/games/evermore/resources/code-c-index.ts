// Ownership: the reconstructed C (`reconstructed-c/<bank>/*.c`) as functions, and which knowledge
// entry each one implements. Read by code-catalog.ts (`soe://rom/code/<name>/<name>.c`) and
// decomp-view.ts. A C file may hold many routines; one belongs to an entry when the comment block
// right above it names the entry's address (`$8C:D220` or `$8CD220`), when the file header says
// `Routine: $<addr> (<c name>)`, or when its name is the entry's `name`.

import * as fs from 'fs';
import * as path from 'path';
import { hiromFileOffset } from '../../../platform/snes/hirom';

// dist/ mirrors src/ at the same depth, so four folders up is the repo root from either.
const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const C_DIR = path.join(REPO, 'reconstructed-c');

/** One C function definition: its name, file (repo-relative), lines [from, to] (0-based), text. */
interface CFunction { name: string; file: string; from: number; to: number; text: string; addr: number | null; isStatic: boolean }

const DEFINITION = /^(?:static\s+|_Noreturn\s+|inline\s+)*[A-Za-z_][\w\s*]*?\b([A-Za-z_]\w*)\s*\(([^;]*)\)\s*\{?\s*$/;
const KEYWORD = /^(if|for|while|switch|return|else|do|sizeof)\b/;
const ADDRESS = /\$([0-9A-Fa-f]{2}):?([0-9A-Fa-f]{4})\b/g;
const HEADER = /Routine:\s*\$([0-9A-Fa-f]{2}):?([0-9A-Fa-f]{4})\s*\((\w+)\)/;

/** The first bus address named in `text` (comments name the routine before what it calls), or null. */
function firstAddress(text: string): number | null {
    const m = [...text.matchAll(ADDRESS)][0];
    return m ? parseInt(m[1] + m[2], 16) : null;
}

/** The line index of the brace closing the body that opens at or after line `at`, or -1. */
function bodyEnd(lines: string[], at: number): number {
    let depth = 0, opened = false;
    for (let i = at; i < lines.length; i++) {
        const code = lines[i].replace(/\/\/.*$/, '').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
        for (const ch of code) {
            if (ch === '{') { depth++; opened = true; } else if (ch === '}') depth--;
        }
        if (opened && depth <= 0) return i;
        if (!opened && i > at + 1) return -1;
    }
    return -1;
}

/** The comment block directly above line `at` (blank lines between it and the definition allowed). */
function commentAbove(lines: string[], at: number): { from: number; text: string } {
    let i = at - 1;
    while (i >= 0 && lines[i].trim() === '') i--;
    const last = i;
    while (i >= 0 && /^\s*(\/\/|\/\*|\*|\*\/)/.test(lines[i])) i--;
    return { from: i + 1, text: lines.slice(i + 1, last + 1).join('\n') };
}

function parseFile(rel: string): CFunction[] {
    const text = fs.readFileSync(path.join(REPO, rel), 'utf8');
    const lines = text.split('\n');
    const header = HEADER.exec(lines.slice(0, 12).join('\n'));
    const out: CFunction[] = [];
    for (let i = 0; i < lines.length; i++) {
        const m = DEFINITION.exec(lines[i]);
        if (!m || KEYWORD.test(lines[i]) || /^\s/.test(lines[i]) || /^(typedef|extern|#)/.test(lines[i])) continue;
        const end = bodyEnd(lines, i);
        if (end < 0) continue;
        const above = commentAbove(lines, i);
        const from = above.text && above.from > 0 ? above.from : i;
        let addr = firstAddress(above.from > 0 ? above.text : '');
        if (addr === null && header && header[3] === m[1]) addr = parseInt(header[1] + header[2], 16);
        out.push({
            name: m[1], file: rel, from, to: end, text: lines.slice(from, end + 1).join('\n'),
            addr, isStatic: /^static\b/.test(lines[i]),
        });
        i = end;
    }
    // The file is named by a routine (`8CD220_sleep_wait.c`): if no function claimed that address,
    // it is the file's first public function without one.
    const named = /^([0-9A-Fa-f]{6})_/.exec(path.basename(rel));
    const fileAddr = named ? parseInt(named[1], 16) : null;
    if (fileAddr !== null && !out.some(f => f.addr === fileAddr)) {
        const first = out.find(f => f.addr === null && !f.isStatic);
        if (first) first.addr = fileAddr;
    }
    return out;
}

let cache: CFunction[] | null = null;

/** Every C function under reconstructed-c/, in file order. Empty when the folder is not there. */
function cFunctions(): CFunction[] {
    if (cache) return cache;
    cache = [];
    if (!fs.existsSync(C_DIR)) return cache;
    for (const bank of fs.readdirSync(C_DIR).sort()) {
        const dir = path.join(C_DIR, bank);
        if (!fs.statSync(dir).isDirectory()) continue;
        for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.c')).sort()) {
            try { cache.push(...parseFile(path.join('reconstructed-c', bank, f))); } catch { /* unreadable file: skip */ }
        }
    }
    return cache;
}

/** The C function implementing the routine at bus address `addr` named `name`, or null. */
function cFunctionFor(addr: number, name: string | null): CFunction | null {
    const all = cFunctions();
    const off = hiromFileOffset(addr);
    return all.find(f => f.addr !== null && hiromFileOffset(f.addr) === off)
        || (name ? all.find(f => f.name === name) : undefined)
        || null;
}

/** Raw numbers in a C body that a name would explain: hex literals of 3+ digits outside comments. */
function magicNumbers(c: CFunction): string[] {
    const code = c.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    return [...new Set(code.match(/\b0x[0-9A-Fa-f]{3,}\b/g) || [])];
}

/** Drop the cache (tests, after editing reconstructed-c/). */
function invalidateCIndex(): void { cache = null; }

export type { CFunction };
export { cFunctions, cFunctionFor, magicNumbers, invalidateCIndex, REPO };
