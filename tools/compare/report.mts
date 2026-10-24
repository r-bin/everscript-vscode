// The Markdown report of one compare run, with WRAM bytes and writer PCs named from the knowledge entries.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { hex, REPO } from '../c-to-rom/emu.mts';
import { runs, type ByteDiff, type Region, type TargetResult, type Write, type WriteSplit } from './diff.mts';

const require = createRequire(import.meta.url);
const FPS = 60.0988;

let ramEntries: { addr: number; end: number; name: string | null; title: string }[] | null = null;
let routines: { off: number; name: string }[] | null = null;
let cSymbols: [number, string][] | null = null;

/** The C function a PC in the C-built image's code banks is in, from the last c-to-rom build's symbols. */
function cSymbolAt(pc: number): string {
    if (!cSymbols) {
        const f = join(REPO, 'out', 'c-to-rom', 'build.json');
        cSymbols = existsSync(f)
            ? Object.entries(JSON.parse(readFileSync(f, 'utf8')).symbols as Record<string, number>).map(([n, a]) => [a, n] as [number, string]).sort((x, y) => x[0] - y[0])
            : [];
    }
    let best: [number, string] | null = null;
    for (const s of cSymbols) { if (s[0] > pc) break; best = s; }
    return best && (best[0] >> 16) === (pc >> 16) ? best[1] + (pc > best[0] ? '+$' + (pc - best[0]).toString(16).toUpperCase() : '') + ' (C)' : '';
}

/** The knowledge entry a WRAM offset falls in, as `NAME` or `NAME+3`; '' when none is known. */
export function ramName(offset: number): string {
    ramEntries ??= require('../../dist/games/evermore/localizations/knowledge').entries('ram');
    const bus = 0x7E0000 + offset;
    const e = ramEntries!.find(x => x.addr <= bus && bus <= x.end);
    return e ? (e.name || e.title) + (bus > e.addr ? '+' + (bus - e.addr) : '') : '';
}

/** The known routine a PC is in: the nearest one starting at or below it in the same bank, within 8 KB. */
export function routineAt(pc: number): string {
    if ((pc >> 16) >= 0xF0) return cSymbolAt(pc);    // the 4th MB: the C-built image's code (c-to-rom build.mts)
    const { hiromFileOffset } = require('../../dist/platform/snes/hirom');
    routines ??= require('../../dist/games/evermore/localizations/functions').FUNCTIONS
        .map((f: { address: number; id: string; name: string }) => ({ off: hiromFileOffset(f.address), name: f.id || f.name }))
        .sort((a: { off: number }, b: { off: number }) => a.off - b.off);
    const off = hiromFileOffset(pc);
    let best: { off: number; name: string } | null = null;
    for (const r of routines!) { if (r.off > off) break; best = r; }
    if (!best || (best.off >> 16) !== (off >> 16) || off - best.off > 0x2000) return '';
    return best.name + (off > best.off ? '+$' + (off - best.off).toString(16).toUpperCase() : '');
}

const pcText = (pc: number) => `$${(pc >> 16).toString(16).toUpperCase().padStart(2, '0')}:${(pc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`;
const b2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');

export interface SetupInfo { label: string; backend: string; rom: string }

export interface Detail {
    region: Region;
    total: number;
    diffs: ByteDiff[];
}

export interface TargetReport {
    setup: SetupInfo;
    result: TargetResult;
    ended: number;
    details: Detail[];
    writes: { splits: WriteSplit[] | null; oneSide: { side: string; writes: Write[] } | null; watched: number } | null;
    error?: string;
}

export interface RunInfo {
    reference: SetupInfo;
    replay: string | null;
    frames: number;
    align: 'frame' | 'nmi';
    regions: Region[];
    stride: number;
    ignored: number[];
    skipThrough: number;
    keepGoing: boolean;
    quality: string | null;
}

const keyText = (align: string, k: number) => align === 'frame' ? `frame ${k} (${(k / FPS).toFixed(1)} s)` : `counter $0100 = ${k} (≈${(k / FPS).toFixed(1)} s)`;

function writeText(w: Write | null): string {
    if (!w) return 'no write';
    const r = routineAt(w.pc);
    return `+${w.frame} ${pcText(w.pc)}${r ? ' `' + r + '`' : ''} ← ${b2(w.value)}`;
}

function detailLines(d: Detail): string[] {
    const out = [`### ${d.region.toUpperCase()}: ${d.total} byte(s) differ`, ''];
    const spans = runs(d.diffs.map(x => x.offset)).slice(0, 12).map(([a, b]) => a === b ? hex(a, 4) : `${hex(a, 4)}-${hex(b, 4)}`);
    out.push(`Where: ${spans.join(', ')}${d.diffs.length < d.total ? ' …' : ''}`, '');
    out.push('| offset | name | reference | target |', '|---|---|---|---|');
    for (const x of d.diffs.slice(0, 32))
        out.push(`| ${hex(d.region === 'wram' ? 0x7E0000 + x.offset : x.offset, d.region === 'wram' ? 6 : 4)} | ${d.region === 'wram' ? ramName(x.offset) : ''} | ${b2(x.a)} | ${b2(x.b)} |`);
    if (d.total > 32) out.push(`| … | ${d.total - 32} more | | |`);
    return [...out, ''];
}

export function summaryLine(run: RunInfo, t: TargetReport): string {
    if (t.error) return `${t.setup.label}: error: ${t.error}`;
    const r = t.result;
    if (!r.compared) return `${t.setup.label}: nothing compared (ran to key ${t.ended})`;
    if (!r.first) return `${t.setup.label}: in sync through ${keyText(run.align, r.lastCompared)}, ${r.compared} checkpoints`;
    const regions = r.first.regions.map(i => run.regions[i]).join('+');
    return `${t.setup.label}: in sync through ${keyText(run.align, r.first.lastGood)}; ${regions} differ at ${keyText(run.align, r.first.key)}`
        + (run.keepGoing ? `; ${r.differing} of ${r.compared} checkpoints differ` : '');
}

export function report(run: RunInfo, targets: TargetReport[]): string {
    const L = [`# compare: ${[run.reference, ...targets.map(t => t.setup)].map(s => s.label).join(' vs ')}`, ''];
    L.push(`- Reference: **${run.reference.label}** (${run.reference.backend}, \`${run.reference.rom}\`)`);
    L.push(`- Input: ${run.replay ? '`' + run.replay + '`' : 'none (power-on, no input)'}; run to ${keyText(run.align, run.frames)}`);
    L.push(`- Aligned on ${run.align === 'frame' ? 'emulated frames' : 'the NMI counter $0100'}; regions ${run.regions.join(', ')}; checked every ${run.stride} key(s)`);
    if (run.ignored.length) L.push(`- Ignored WRAM bytes (timing noise between backends): ${runs(run.ignored).map(([a, b]) => a === b ? hex(a, 4) : `${hex(a, 4)}-${hex(b, 4)}`).join(', ')}`);
    if (run.skipThrough >= 0) L.push(`- Not compared up to counter ${run.skipThrough} (the RNG is copied in there)`);
    if (run.quality) L.push(`- Compile quality per routine: [${run.quality}](${run.quality})`);
    L.push('');
    for (const t of targets) {
        L.push(`## ${t.setup.label} (${t.setup.backend}, \`${t.setup.rom}\`)`, '', summaryLine(run, t), '');
        const f = t.result.first;
        if (!f) continue;
        L.push(`First divergence between ${keyText(run.align, f.lastGood)} and ${keyText(run.align, f.key)}. Bytes at ${keyText(run.align, f.key)}:`, '');
        for (const d of t.details) L.push(...detailLines(d));
        const w = t.writes;
        if (!w) continue;
        L.push(`### First writes that differ (CPU writes to ${w.watched} watched WRAM byte(s) after the last matching key; +frames into that window; DMA is not watched)`, '');
        if (w.splits) {
            L.push('| offset | name | write # | reference | target |', '|---|---|---|---|---|');
            for (const s of w.splits.slice(0, 32)) L.push(`| ${hex(0x7E0000 + s.offset)} | ${ramName(s.offset)} | ${s.index + 1} | ${writeText(s.a)} | ${writeText(s.b)} |`);
            if (!w.splits.length) L.push('| — | every watched byte was written the same way by the CPU: look at DMA or the bytes not watched | | | |');
        } else if (w.oneSide) {
            L.push(`Only ${w.oneSide.side} runs on snes9x; its last write to each byte:`, '', '| offset | name | last write |', '|---|---|---|');
            const last = new Map<number, Write>();
            for (const x of w.oneSide.writes) last.set(x.offset, x);
            for (const [o, x] of [...last].slice(0, 32)) L.push(`| ${hex(0x7E0000 + o)} | ${ramName(o)} | ${writeText(x)} |`);
        }
        L.push('');
    }
    return L.join('\n');
}
