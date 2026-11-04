// Ownership: the knowledge entries (knowledge/{ram,rom}/<addr>.md, `game-knowledge` skill) as data.
// The one source of what the plugin knows about an address: functions.ts and tables.js are views of
// these entries, and the ROM tab, soe://, the asm view and the exports read them through those.

import * as fs from 'fs';
import * as path from 'path';
import { sourceDir } from '../../../platform/source-dir';
import { getAllWramEntries } from './wram-map';

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

/** Flat front matter: `key: value`, `key: [a, b]` (JSON-ish lists) or `key:` followed by `  - item` lines. */
function parseFrontMatter(head: string): FrontMatter {
    const out: FrontMatter = {};
    let block: string | null = null;
    for (const line of head.split('\n')) {
        const item = line.match(/^\s+-\s+(.*)$/);
        if (item && block) {
            const v = item[1].trim();
            (out[block] as string[]).push(v.startsWith('"') ? JSON.parse(v) : v);
            continue;
        }
        block = null;
        const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
        if (!m) continue;
        if (m[2].trim() === '') { block = m[1]; out[block] = []; continue; }
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
        if (space === 'ram') {
            const wram = getAllWramEntries();
            const ramEntries: KnowledgeEntry[] = wram.map(e => {
                const isRegion = e.tags.includes('compiler-region') || e.addr === 0x2200 || e.addr === 0x2834;
                const tags = [...e.tags];
                if (isRegion && !tags.includes('compiler-region')) tags.push('compiler-region');
                const lifetime = e.lifecycle === 'temp' ? 'room' : e.lifecycle === 'session' ? 'save' : e.lifecycle;
                const isBank7F = e.busAddr >= 0x7F0000;
                return {
                    addr: e.busAddr,
                    end: e.busAddr + e.size - 1,
                    size: e.size,
                    kind: isRegion ? 'region' : 'ram',
                    name: e.name,
                    title: e.name,
                    category: 'ram',
                    confidence: 'confirmed',
                    tags,
                    evidence: ['cdl', 'disasm'],
                    see: [],
                    lifetime,
                    purpose: e.summary,
                    body: e.summary,
                    file: isBank7F ? 'src/games/evermore/localizations/data/wram-map-7f.md' : 'src/games/evermore/localizations/data/wram-map.md',
                    meta: {
                        addr: '0x' + (isBank7F ? e.busAddr.toString(16).toUpperCase() : e.addr.toString(16).padStart(4, '0')),
                        size: String(e.size),
                        name: e.name,
                        tags,
                        lifetime,
                    },
                };
            });

            // Compiler regions: persistent save session ($7E:2200..$7E:27FF) and room temporary scratch ($7E:2834..$7E:28FB)
            const compilerRegions: KnowledgeEntry[] = [
                {
                    addr: 0x7E2200, end: 0x7E27FF, size: 0x600, kind: 'region', name: 'REGION_SESSION',
                    title: 'Compiler persistent session / save state memory region ($7E:2200..$7E:27FF)',
                    category: 'ram', confidence: 'confirmed', tags: ['compiler-region', 'save'],
                    evidence: ['compiler', 'disasm'], see: [], lifetime: 'save',
                    purpose: 'Compiler persistent session / save state memory region ($7E:2200..$7E:27FF)',
                    body: 'Compiler persistent session / save state memory region ($7E:2200..$7E:27FF)',
                    file: 'src/games/evermore/localizations/data/wram-map.md',
                    meta: { addr: '0x2200', end: '0x27FF', kind: 'region', tags: ['compiler-region'], lifetime: 'save' },
                },
                {
                    addr: 0x7E2834, end: 0x7E28FB, size: 0xC8, kind: 'region', name: 'REGION_ROOM_SCRATCH',
                    title: 'Compiler room-temporary scratch memory region ($7E:2834..$7E:28FB)',
                    category: 'ram', confidence: 'confirmed', tags: ['compiler-region', 'room'],
                    evidence: ['compiler', 'disasm'], see: [], lifetime: 'room',
                    purpose: 'Compiler room-temporary scratch memory region ($7E:2834..$7E:28FB)',
                    body: 'Compiler room-temporary scratch memory region ($7E:2834..$7E:28FB)',
                    file: 'src/games/evermore/localizations/data/wram-map.md',
                    meta: { addr: '0x2834', end: '0x28FB', kind: 'region', tags: ['compiler-region'], lifetime: 'room' },
                },
            ];

            cache[space] = [...ramEntries, ...compilerRegions].sort((a, b) => a.addr - b.addr);
        } else {
            const dir = path.join(DIR, space);
            cache[space] = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md'))
                .map(f => parseEntry(path.join(dir, f))).filter((e): e is KnowledgeEntry => e !== null).sort((a, b) => a.addr - b.addr) : [];
        }
    }
    return cache[space];
}

/** Files of one space that are not entries (no front matter, e.g. an empty file), repo-relative. */
function brokenEntries(space: string): string[] {
    if (space === 'ram') return [];
    const dir = path.join(DIR, space);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.md') && !parseEntry(path.join(dir, f)))
        .map(f => path.relative(path.join(HERE, '..', '..', '..', '..'), path.join(dir, f)));
}

export type { KnowledgeEntry };
export { entries, parseEntry, brokenEntries };
