// Knowledge coverage (docs/cleanup.md 6.1, D8, D11): every WRAM address and ROM routine we use has a
// knowledge entry (src/games/evermore/localizations/knowledge/{ram,rom}/<addr>.md, `game-knowledge` skill).
//
//   node tools/check-knowledge.mts             coverage report; fails on addresses in code that are
//                                              neither documented nor in the baseline
//   node tools/check-knowledge.mts --baseline  rewrite tools/check-knowledge.baseline.json (only shrinks)
//
// Coverage of the game itself comes from the CDL library (routines called, WRAM touched) when it is
// there; the code scan (src/, tools/) always runs. Evermore only, for now: other games get their own
// knowledge stores when they have entries.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';

const ROOT = join(import.meta.dirname, '..');
const KNOWLEDGE = join(ROOT, 'src/games/evermore/localizations/knowledge');
const BASELINE = join(ROOT, 'tools/check-knowledge.baseline.json');

type Range = { from: number; to: number; name: string };

/** Entries of one address space, as [from, to] bus ranges. */
function loadEntries(space: 'ram' | 'rom'): Range[] {
    const dir = join(KNOWLEDGE, space);
    const out: Range[] = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
        const head = readFileSync(join(dir, f), 'utf8').split('\n---')[0];
        const field = (k: string) => head.match(new RegExp(`^${k}:\\s*(\\S+)`, 'm'))?.[1];
        const from = parseInt(field('addr') ?? f.replace('.md', ''), 16);
        const end = field('end');
        const size = field('size');
        const to = end ? parseInt(end, 16) : size ? from + Number(size) - 1 : from;
        out.push({ from, to, name: field('name') ?? f });
    }
    return out;
}

const covered = (entries: Range[], a: number) => entries.some((e) => a >= e.from && a <= e.to);

/** WRAM as $7E/$7F bus addresses; ROM routines as $80-$FF bus addresses. */
const WRAM = /(?:\$|0x)(7[EF])[:_]?([0-9A-F]{4})\b/gi;
const ROM = /(?:\$|0x)([89A-F][0-9A-F])[:]?([0-9A-F]{4})\b/gi;

function scanCode(): Map<string, string> {
    const files = execFileSync('git', ['ls-files', 'src', 'tools'], { cwd: ROOT }).toString().split('\n')
        .filter((f) => /\.(js|ts|mts)$/.test(f) && !f.includes('/dist/') && !f.startsWith('src/emulator/core/'));
    const found = new Map<string, string>(); // "ram:7E2834" -> first file
    for (const f of files) {
        if (!existsSync(join(ROOT, f))) continue;
        const text = readFileSync(join(ROOT, f), 'utf8');
        for (const m of text.matchAll(WRAM)) {
            const k = `ram:${(m[1] + m[2]).toUpperCase()}`;
            if (!found.has(k)) found.set(k, f);
        }
        for (const m of text.matchAll(ROM)) {
            const k = `rom:${(m[1] + m[2]).toUpperCase()}`;
            if (!found.has(k)) found.set(k, f);
        }
    }
    return found;
}

/** Routines the game called and WRAM it touched, from the CDL library of the base ROM (if any). */
function fromCdl(): { routines: number[]; wram: number[] } | null {
    try {
        const require = createRequire(import.meta.url);
        const rom = require('../dist/games').baseRomPath('evermore');
        if (!rom) return null;
        const { CdlLibrary } = require('../src/emulator/cdl/library');
        const lib = new CdlLibrary(join(homedir(), 'Library/Application Support/Code/User/globalStorage/rbin.everscript/cdl-library'),
            readFileSync(rom));
        const bytes: Uint8Array = readFileSync(rom);
        const toFile: (b: number) => number = require('../dist/platform').hiromFileOffset;
        const routines = new Set<number>();
        for (const k of lib.edges.keys() as Iterable<number>) {
            const from = Math.floor(k / 0x1000000), to = k % 0x1000000;
            const op = bytes[toFile(from)];
            if (op === 0x20 || op === 0x22 || op === 0xfc) routines.add(to);   // JSR, JSL, JSR (abs,X)
        }
        const wram: number[] = [];
        for (let i = 0; i < lib.wramReads.length; i++) if (lib.wramReads[i] || lib.wramWrites[i]) wram.push(0x7e0000 + i);
        return { routines: [...routines], wram };
    } catch {
        return null;
    }
}

const pct = (a: number, b: number) => (b ? (100 * a / b).toFixed(1) : '—') + '%';

function main(): number {
    const ram = loadEntries('ram'), rom = loadEntries('rom');
    const code = scanCode();
    const missing = [...code.keys()].filter((k) => {
        const [space, hex] = k.split(':');
        return !covered(space === 'ram' ? ram : rom, parseInt(hex, 16));
    }).sort();

    if (process.argv.includes('--baseline')) {
        writeFileSync(BASELINE, JSON.stringify({
            '//': 'Addresses in code without a knowledge entry yet (docs/cleanup.md 6.1). Only ever shrinks: node tools/check-knowledge.mts --baseline',
            missing,
        }, null, 1) + '\n');
        console.log(`baseline: ${missing.length} addresses`);
        return 0;
    }

    const baseline = new Set<string>(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')).missing : []);
    const fresh = missing.filter((k) => !baseline.has(k));
    const codeRam = [...code.keys()].filter((k) => k.startsWith('ram:')).length;
    console.log(`knowledge entries: ${ram.length} ram, ${rom.length} rom`);
    console.log(`addresses in code: ${code.size} (${codeRam} WRAM), documented ${pct(code.size - missing.length, code.size)}; ${missing.length} not (${baseline.size} in the baseline)`);
    const cdl = fromCdl();
    if (cdl) {
        const r = cdl.routines.filter((a) => covered(rom, a)).length;
        const w = cdl.wram.filter((a) => covered(ram, a)).length;
        console.log(`CDL: routines documented ${r}/${cdl.routines.length} (${pct(r, cdl.routines.length)}), WRAM bytes documented ${w}/${cdl.wram.length} (${pct(w, cdl.wram.length)})`);
    } else {
        console.log('CDL: no library for the base ROM — game coverage not measured');
    }
    for (const k of fresh) console.log(`new undocumented address ${k} (${code.get(k)}) — write a knowledge entry (game-knowledge skill)`);
    return fresh.length ? 1 : 0;
}

process.exitCode = main();
