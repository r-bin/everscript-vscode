// Ownership: the knowledge entries (knowledge/{ram,rom}/<addr>.md, `game-knowledge` skill) as data.
// The one source of what the plugin knows about an address: functions.ts and tables.js are views of
// these entries, and the ROM tab, soe://, the asm view and the exports read them through those.

import * as fs from 'fs';
import * as path from 'path';
import { sourceDir } from '../../../platform/source-dir';

const HERE = sourceDir(__dirname);
const DIR = path.join(HERE, 'knowledge');

type FrontMatter = Record<string, string | string[] | undefined>;

/** One knowledge entry: what is known about the address (`addr`..`end`), and from which file. */
interface KnowledgeEntry {
    addr: number; end: number; size: number | null; kind: string | null; name: string | null; title: string;
    category: string | null; confidence: string | null; tags: string[]; evidence: string[]; see: string[];
    lifetime: string | null; purpose: string; body: string; file: string;
    /** Every front-matter key, for spaces with keys of their own (`opcodes`: `everscript`). */
    meta: FrontMatter;
}

const one = (v: string | string[] | undefined): string | null => (typeof v === 'string' && v ? v : null);
const list = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : []);

/** Flat front matter: `key: value` or `key: [a, b]` (JSON-ish lists). */
function parseFrontMatter(head: string): FrontMatter {
    const out: FrontMatter = {};
    for (const line of head.split('\n')) {
        const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
        if (!m) continue;
        let v: string | string[] = m[2].trim();
        if (v.startsWith('[')) {
            const text = v;
            try { v = JSON.parse(text); } catch { v = text.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean); }
        }
        out[m[1]] = v;
    }
    return out;
}

function parseEntry(file: string): KnowledgeEntry | null {
    const text = fs.readFileSync(file, 'utf8');
    const end = text.indexOf('\n---', 3);
    if (!text.startsWith('---') || end < 0) return null;
    const meta = parseFrontMatter(text.slice(3, end));
    const body = text.slice(end + 4).trim();
    const addr = parseInt(one(meta.addr) || path.basename(file, '.md'), 16);
    const size = one(meta.size) ? Number(meta.size) : null;
    const endHex = one(meta.end);
    const last = endHex ? parseInt(endHex, 16) : size ? addr + size - 1 : addr;
    return {
        addr, end: last, size, kind: one(meta.kind), name: one(meta.name), title: one(meta.title) || one(meta.name) || '',
        category: one(meta.category), confidence: one(meta.confidence), tags: list(meta.tags),
        evidence: list(meta.evidence), see: list(meta.see), lifetime: one(meta.lifetime),
        purpose: body.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim(), body,
        file: path.relative(path.join(HERE, '..', '..', '..', '..'), file), meta,
    };
}

const cache: Record<string, KnowledgeEntry[]> = {};

/** Every entry of one space (`ram`, `rom`, or `opcodes`: one per script opcode, `addr` = the opcode), sorted by address. */
function entries(space: string): KnowledgeEntry[] {
    if (!cache[space]) {
        const dir = path.join(DIR, space);
        cache[space] = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
            .map(f => parseEntry(path.join(dir, f))).filter((e): e is KnowledgeEntry => e !== null).sort((a, b) => a.addr - b.addr);
    }
    return cache[space];
}

/** Files of one space that are not entries (no front matter, e.g. an empty file), repo-relative. */
function brokenEntries(space: string): string[] {
    const dir = path.join(DIR, space);
    return fs.readdirSync(dir).filter(f => f.endsWith('.md') && !parseEntry(path.join(dir, f)))
        .map(f => path.relative(path.join(HERE, '..', '..', '..', '..'), path.join(dir, f)));
}

export type { KnowledgeEntry };
export { entries, parseEntry, brokenEntries };
