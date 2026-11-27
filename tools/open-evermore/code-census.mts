// The code census (docs/open-evermore/code.md §5 C0): every instruction the vanilla CDL library saw run, with the
// register widths it ran with, and every routine entry (a recorded call target). The code kind decodes the ROM
// through it, so explode needs no CDL library. A release without a census keeps its code in _base/.
//   node tools/open-evermore/code-census.mts           write evermore/map/<release>.code.json from the CDL library
//   node tools/open-evermore/code-census.mts --check   print what would change, write nothing
// The instruction heads are the Asar export's (platform/cdl/asar-export.ts pickBoundaries): a recorded opcode head
// whose instruction fits in its bank, overlaps no other head and never ran with both widths of an immediate it has.
// The file holds ROM offsets and widths only (facts about the game, no bytes of it), so it is checked in.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { LIBRARY } from './wram-census.mts';

const require = createRequire(import.meta.url);
const EXT_HEAD = 0x04, SEGMENT = 0x10000;
const CDL_ACC_8 = 0x20, CDL_IDX_8 = 0x10, EXT_SEEN_M16 = 0x08, EXT_SEEN_X16 = 0x10;

/** One run of instructions back to back: where it starts (file offset) and the width of each instruction in turn. */
export interface Census {
    format: 'open-evermore/code'; version: 1; release: string; source: string;
    /** Width digits: 0 = 16-bit A and X, 1 = 8-bit A, 2 = 8-bit X, 3 = both 8-bit. */
    what: string;
    /** [file offset as "$BBAAAA", widths] per run. */
    runs: [string, string][];
    /** File offsets of the recorded call targets ("$BBAAAA"). */
    entries: string[];
}

export const censusPath = (release: string) => join(dirname(new URL(import.meta.url).pathname), 'evermore', 'map', `${release}.code.json`);
const at = (o: number) => '$' + o.toString(16).toUpperCase().padStart(6, '0');

/** Widths as written in the file: a width and how many instructions in a row have it ("3x5 0x9 2" = 3,3,3,3,3,0,…,2). */
export const packWidths = (w: string): string => (w.match(/(.)\1*/g) ?? []).map(r => r.length > 1 ? `${r[0]}x${r.length}` : r).join(' ');
const unpack = (s: string): string => s.split(' ').filter(Boolean).map(t => { const [d, n] = t.split('x'); return d.repeat(n ? +n : 1); }).join('');

/** The census of `release` with one width digit per instruction, or null when there is none. */
export function readCensus(release: string): Census | null {
    let c: Census;
    try { c = JSON.parse(readFileSync(censusPath(release), 'utf8')) as Census; } catch { return null; }
    return { ...c, runs: c.runs.map(([at, w]) => [at, unpack(w)]) };
}

async function main(): Promise<void> {
    const check = process.argv.includes('--check');
    const { CdlLibrary } = require('../../dist/platform/cdl/library');
    const { baseRomPath } = require('../../dist/games');
    const { decodeAt } = require('../../dist/platform/cdl/disasm');
    const { createRomMap } = require('../../dist/platform/cdl/rom-map');
    const { buildIndex } = require('../../dist/platform/cdl/xref-index');
    const rom = new Uint8Array(readFileSync(baseRomPath('evermore')));
    const lib = new CdlLibrary(LIBRARY, Buffer.from(rom));
    if (!lib.xrefs.size) throw new Error(`no CDL library for this ROM under ${LIBRARY}`);
    // Pass 1 of the Asar export: the instruction boundaries.
    const len = new Uint8Array(rom.length);
    for (let seg = 0; seg < rom.length; seg += SEGMENT) {
        const end = Math.min(seg + SEGMENT, rom.length);
        for (let off = seg; off < end;) {
            if (!(lib.ext[off] & EXT_HEAD)) { off++; continue; }
            const ins = decodeAt(rom, off, lib.cdl[off], lib.ext[off]);
            let ok = !!ins && off + ins.len <= end && !ins.conflict;
            for (let i = 1; ok && i < ins.len; i++) if (lib.ext[off + i] & EXT_HEAD) ok = false;
            if (!ok) { off++; continue; }
            len[off] = ins.len;
            off += ins.len;
        }
    }
    const runs: [string, string][] = [];
    let count = 0;
    for (let off = 0; off < rom.length;) {
        if (!len[off]) { off++; continue; }
        const start = off;
        let w = '';
        while (off < rom.length && len[off] && (off === start || off % SEGMENT !== 0)) {
            // disasm.ts decodeAt: a width never seen 16-bit is 8-bit.
            const m8 = (lib.cdl[off] & CDL_ACC_8) || !(lib.ext[off] & EXT_SEEN_M16), x8 = (lib.cdl[off] & CDL_IDX_8) || !(lib.ext[off] & EXT_SEEN_X16);
            w += String((m8 ? 1 : 0) | (x8 ? 2 : 0));
            off += len[off];
            count++;
        }
        runs.push([at(start), packWidths(w)]);
    }
    const index = buildIndex(lib, createRomMap(rom), {});
    const entries = [...index.labels].filter(([o, k]) => k === 'func' && len[o]).map(([o]) => o as number).sort((a, b) => a - b).map(at);
    const census: Census = {
        format: 'open-evermore/code', version: 1, release: 'us',
        source: `the vanilla CDL library (${count} instructions in ${runs.length} runs, ${entries.length} entries), ${new Date().toISOString().slice(0, 10)}`,
        what: 'Instructions the vanilla game ran: each run starts at a file offset and gives the width of each instruction in turn (0 = 16-bit A and X, 1 = 8-bit A, 2 = 8-bit X, 3 = both), "3x5" for five in a row; entries are the recorded call targets. Decoded by tools/open-evermore/evermore/codecs/code.mts.',
        runs, entries,
    };
    const text = JSON.stringify(census, null, 1).replace(/\[\n\s+"(\$[0-9A-F]{6})",\n\s+"([0-9x ]*)"\n\s+\]/g, '["$1", "$2"]') + '\n';
    console.log(census.source);
    if (!check) { writeFileSync(censusPath('us'), text); console.log(`wrote ${censusPath('us')}`); }
}

if (process.argv[1] === new URL(import.meta.url).pathname) main().catch(e => { console.error(e.stack ?? e.message); process.exit(1); });
