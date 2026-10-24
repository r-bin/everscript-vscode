// Run several setups (an emulator or the recomp, each with a ROM) side by side, hash their memory every 60 frames
// (every frame with --verbose) and report how long each stays in sync with the first setup and what differs at the
// first checkpoint that does not match: the bytes, named, and for snes9x setups the CPU write where they part.
// One setup is compared with vanilla. Runs that mix backends align on the NMI counter $0100 and copy the RNG in.
//   node tools/compare/compare.mts [backend[:exe]=]<rom> ... [--replay x.evsmv] [--frames N] [--verbose]
//       [--keep-going] [--aram] [--regions wram,vram,cgram,oam] [--align frame|nmi] [--no-cache] [--out file.md]
//   backend: snes9x (our fork's debugger core, the default) | recomp (exe: the packaged game by default); no ROM after
//   '=' means the clean ROM (--rom or the ROM library)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { REPO, REFERENCE_FRAMES, coreId } from '../c-to-rom/emu.mts';
import { Tracker, byteDiff, firstDifferingWrites, type Crcs, type Region, type Write } from './diff.mts';
import { runSnes9x, askSnes9x, type Job } from './snes9x.mts';
import { runRecomp, defaultExe } from './recomp.mts';
import { cacheKey, fileHash, loadCache, saveCache } from './cache.mts';
import { report, summaryLine, type Detail, type TargetReport, type RunInfo } from './report.mts';
import { SYNC_AT, CROSS_NOISE } from './game.mts';

const require = createRequire(import.meta.url);
const WATCH_BATCH = 64;          // the debugger core's write watchpoint limit
const WATCH_MAX = 4 * WATCH_BATCH;

interface Setup { label: string; backend: 'snes9x' | 'recomp'; exe: string | null; rom: string }

const argv = process.argv.slice(2);
const VALUED = new Set(['replay', 'frames', 'regions', 'align', 'out', 'rom']);
const opts: Record<string, string | true> = {}, positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) { positional.push(argv[i]); continue; }
    const k = argv[i].slice(2);
    opts[k] = VALUED.has(k) ? argv[++i] : true;
}
const opt = (k: string) => typeof opts[k] === 'string' ? opts[k] as string : null;

function parseSetup(s: string): Setup {
    const eq = s.indexOf('=');
    const left = eq < 0 ? 'snes9x' : s.slice(0, eq), rom = resolve(eq < 0 ? s : s.slice(eq + 1) || vanilla);   // recomp= : the clean ROM
    const colon = left.indexOf(':');
    const backend = (colon < 0 ? left : left.slice(0, colon)) as Setup['backend'];
    if (backend !== 'snes9x' && backend !== 'recomp') throw new Error(`unknown backend '${backend}' (snes9x, recomp)`);
    if (!existsSync(rom)) throw new Error(`no ROM at ${rom}`);
    const exe = backend === 'recomp' ? resolve(colon < 0 ? defaultExe() : left.slice(colon + 1)) : null;
    return { label: basename(rom) + (backend === 'recomp' ? ' (recomp)' : ''), backend, exe, rom };
}

if (!positional.length) {
    console.error('usage: compare.mts [backend[:exe]=]<rom> ... (one setup is compared with vanilla; see the header)');
    process.exit(2);
}
const vanilla: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
const setups = positional.map(parseSetup);
if (setups.length === 1) setups.unshift({ label: 'vanilla', backend: 'snes9x', exe: null, rom: resolve(vanilla) });
setups.forEach((s, i) => { if (setups.findIndex(x => x.label === s.label) !== i) s.label += ` #${i + 1}`; });

const replay = opt('replay') ? resolve(opt('replay')!) : null;
const hasRecomp = setups.some(s => s.backend === 'recomp');
const mixed = new Set(setups.map(s => s.backend)).size > 1;
if (replay && hasRecomp) { console.error('--replay works with snes9x setups only (v1)'); process.exit(2); }
const align = (opt('align') || (hasRecomp ? 'nmi' : 'frame')) as 'frame' | 'nmi';
if (align === 'frame' && hasRecomp) { console.error('the recomp aligns on the NMI counter only (--align nmi)'); process.exit(2); }
const regions = (opt('regions') ? opt('regions')!.split(',') : ['wram', 'vram', ...(opts.aram ? ['aram'] : [])]) as Region[];
const movieCount = replay ? require('../../dist/platform/tas/movie').parseMovie(readFileSync(replay, 'utf8')).count as number : 0;
const frames = Number(opt('frames') || (replay ? movieCount : REFERENCE_FRAMES));
const stride = opts.verbose ? 1 : 60;
const skipThrough = mixed ? SYNC_AT : -1;
const ignore: ReadonlySet<number> = mixed ? CROSS_NOISE : new Set();

// The RNG bytes a recomp gets: from the first snes9x setup, at counter SYNC_AT.
const rngFrom = setups.find(s => s.backend === 'snes9x');
const rng = mixed && rngFrom ? (await askSnes9x({ cmd: 'rng', rom: rngFrom.rom, replay: null, frames: SYNC_AT, align: 'nmi', regions }, 'rng')).bytes : null;

const job = (s: Setup, extra: Partial<Job>): Job => ({ cmd: 'hash', rom: s.rom, replay, frames, align, regions, mask: mixed, ...extra });

// --- hash all setups at once, the reference from the cache when it can be -------------------------------------------
const ref = setups[0], targets = setups.slice(1);
const tracker = new Tracker(targets.length, skipThrough);
const ended = new Array(targets.length).fill(0);
const errors: (string | undefined)[] = new Array(targets.length);
const key = ref.backend === 'snes9x' && !opts['no-cache']
    ? cacheKey({ v: 1, core: coreId(), rom: fileHash(ref.rom), replay: replay ? fileHash(replay) : '', frames, align, regions, mask: mixed })
    : null;
const cached = key ? loadCache(key) : null;
const building = key && !cached ? new Map<number, Crcs>() : null;

const kills: (() => void)[] = [];
let refKill = () => {}, open = targets.length;
const targetDone = (i: number) => { if (--open === 0 && !building) refKill(); };
const onTarget = (i: number) => (k: number, c: Crcs) => {
    if (tracker.addTarget(i, k, c) && !opts['keep-going']) kills[i]();
};
const onRef = (k: number, c: Crcs) => {
    building?.set(k, c);
    for (const i of tracker.addRef(k, c)) if (!opts['keep-going']) kills[i]();
};

const runs: Promise<unknown>[] = [];
function start(s: Setup, extra: Partial<Job>, onCp: (k: number, c: Crcs) => void, onEnd: (k: number) => void, onErr: (m: string) => void) {
    if (s.backend === 'snes9x') {
        const r = runSnes9x(job(s, extra), m => {
            if (m.t === 'cp') onCp(m.key, m.crcs);
            else if (m.t === 'done') onEnd(m.key);
            else if (m.t === 'error') onErr(m.message);
        });
        runs.push(r.done);
        return r.kill;
    }
    const r = runRecomp({ exe: s.exe!, rom: s.rom, to: frames, regions, stride: extra.stride, mask: mixed, rng }, onCp);
    runs.push(r.done.catch(e => onErr((e as Error).message)));
    return r.kill;
}

const t0 = Date.now();
targets.forEach((s, i) => {
    let finished = false;
    const fin = () => { if (!finished) { finished = true; targetDone(i); } };
    kills[i] = start(s, { stride }, onTarget(i), k => { ended[i] = k; fin(); }, m => { errors[i] = m; fin(); });
    const kill = kills[i];
    kills[i] = () => { kill(); fin(); };
});
if (cached) for (const [k, c] of cached) onRef(k, c);
else refKill = start(ref, { stride: building ? 1 : stride }, onRef, () => {}, m => { console.error(`reference: ${m}`); targets.forEach((_, i) => kills[i]()); });
await Promise.all(runs);
if (building && Math.max(0, ...building.keys()) >= frames) saveCache(key!, building);   // only a run that got to the end

// --- the first divergence of each target, in detail -----------------------------------------------------------------
async function snapshot(s: Setup, at: number): Promise<Uint8Array[]> {
    if (s.backend === 'snes9x') return (await askSnes9x(job(s, { cmd: 'dump', key: at }), 'dump')).bytes;
    const dump = await runRecomp({ exe: s.exe!, rom: s.rom, to: at, regions, dumpAt: at, mask: false, rng }, () => {}).done;
    if (!dump) throw new Error(`the recomp did not reach counter ${at}`);
    return dump;
}

async function watch(s: Setup, from: number, to: number, offsets: number[]): Promise<Write[]> {
    const batches: number[][] = [];
    for (let i = 0; i < offsets.length; i += WATCH_BATCH) batches.push(offsets.slice(i, i + WATCH_BATCH));
    const got = await Promise.all(batches.map(b => askSnes9x(job(s, { cmd: 'watch', from, to, offsets: b }), 'writes')));
    return got.flatMap(g => g.writes).sort((a, b) => a.frame - b.frame);
}

const reports: TargetReport[] = await Promise.all(targets.map(async (s, i): Promise<TargetReport> => {
    const result = tracker.results[i];
    const base: TargetReport = { setup: s, result, ended: ended[i], details: [], writes: null, error: errors[i] };
    const f = result.first;
    if (!f) return base;
    try {
        const [a, b] = await Promise.all([snapshot(ref, f.key), snapshot(s, f.key)]);
        const details: Detail[] = f.regions.map(j => {
            const d = byteDiff(a[j], b[j], regions[j] === 'wram' ? ignore : new Set(), 4096);
            return { region: regions[j], total: d.total, diffs: d.diffs };
        });
        base.details = details;
        const wram = details.find(d => d.region === 'wram');
        if (wram && (ref.backend === 'snes9x' || s.backend === 'snes9x')) {
            const offsets = wram.diffs.slice(0, WATCH_MAX).map(d => d.offset);
            const [wa, wb] = await Promise.all([ref, s].map(x => x.backend === 'snes9x' ? watch(x, f.lastGood, f.key, offsets) : Promise.resolve(null)));
            base.writes = wa && wb
                ? { splits: firstDifferingWrites(wa, wb), oneSide: null, watched: offsets.length }
                : { splits: null, oneSide: { side: wa ? ref.label : s.label, writes: (wa || wb)! }, watched: offsets.length };
        }
    } catch (e) { base.error = (e as Error).message; }
    return base;
}));

// --- report ----------------------------------------------------------------------------------------------------------
let quality: string | null = null;
if (setups.some(s => s.rom.startsWith(join(REPO, 'out', 'c-to-rom')))) {
    try {
        const { writeQuality } = await import('../c-to-rom/quality.mts');
        quality = relative(REPO, writeQuality(vanilla));
    } catch (e) { console.error(`compile quality table not written: ${(e as Error).message}`); }
}
const shown = (s: Setup) => ({ ...s, rom: relative(REPO, s.rom) });
for (const t of reports) t.setup = shown(t.setup as Setup);
const run: RunInfo = { reference: shown(ref), replay: replay && relative(REPO, replay), frames, align, regions, stride, ignored: [...ignore], skipThrough, keepGoing: !!opts['keep-going'], quality };
const md = report(run, reports);
const out = opt('out') ? resolve(opt('out')!) : join(REPO, 'out', 'compare', setups.map(s => s.label.replace(/[^\w.-]+/g, '_')).join('--').slice(0, 120) + '.md');
mkdirSync(join(out, '..'), { recursive: true });
writeFileSync(out, md);
console.log(`reference ${ref.label}${cached ? ' (cached)' : building ? ' (cache written)' : ''}; ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const t of reports) console.log(summaryLine(run, t));
console.log(`report: ${relative(REPO, out)}`);
process.exit(reports.every(t => !t.error && !t.result.first && t.result.compared) ? 0 : 1);
