// Build the SA-1 images and prove in MesenCE that they play like the HiROM original (docs/sa1/port.md §5).
//   npm run sa1:prove -- [--rom <clean rom>] [--movies <dir|file>...] [--boot-frames 6000] [--max-frames 20000]
//                        [--max-movies 8] [--jobs N] [--out out/sa1]
// Images: release  what we ship: the 4th MB answers like the original cartridge (2 MB + 1 MB chips)
//         mesen    the same, but the 4th MB answers like MesenCE's HiROM mapping; must match the original everywhere
//         trap     every byte not written on purpose is STP ($DB): a stray jump halts, a stray read changes state
// 1. static   every view of the image holds what HiROM showed there; MesenCE's header scoring picks the SA-1 header
// 2. mapping  MesenCE maps it as SA-1: bus reads after frame 60
// 3. play     original vs each image on the same input (power-on with no input, then movies recorded on this ROM
//             that replay as plain input); "mesen" must be identical, the others only where $80:D113 ran
// 4. trap     ROM bytes read or executed in block 0-1 and the 4th MB: only what convert.mts wrote may appear
// Writes <out>/REPORT.md (not committed: it quotes ROM bytes). Exit 0 = proven, 1 = a check failed.
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus, homedir } from 'node:os';
import { createRequire } from 'node:module';
import { convert, usedRanges, REPO, type Upper } from './convert.mts';
import { MB, LINEAR, busToFile, loRomFile } from './layout.mts';
import { mesenPath, runMesen } from './mesen.mts';

const require = createRequire(import.meta.url);
const { parseMovie } = require('../../dist/platform/tas/movie');
const IMAGES: Record<string, { fill: number; upper: Upper }> = { release: { fill: 0xFF, upper: 'hardware' }, mesen: { fill: 0xFF, upper: 'mesen' }, trap: { fill: 0xDB, upper: 'fill' } };
// Bus probes: header and reset vector (bank $00 LoROM view), the same code through $C0 and $80, the read past 3 MB,
// BW-RAM at $40:0000 (HiROM: a slow ROM mirror), I-RAM at $00:3000 (HiROM: open bus).
const PROBES = [0x00FFD5, 0x00FFD6, 0x00FFFC, 0x00FFFD, 0xC08020, 0x808020, 0xC08034, 0x808034, 0xA08000, 0xE08000, 0xB0E653, 0xF0E653, 0x400000, 0x003000];
// Block 0 except bank $00's first 32 KB view, block 1, and both copies of the HiROM 4th MB.
const WATCH: [number, number][] = [[0x000000, 0x1FFFFF], [0x380000, 0x3FFFFF], [LINEAR + 0x300000, LINEAR + 0x3FFFFF]];
const REPLAY_CHANGING = new Set(['W', 'R', 'L']);   // memory writes, soft resets, rewinds; S/T/K only check or mark
const hex = (v: number, n = 6) => '0x' + v.toString(16).toUpperCase().padStart(n, '0');

const argv = process.argv.slice(2);
const opt = (k: string, d: string | null = null) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const list = (k: string) => { const i = argv.indexOf('--' + k), o: string[] = []; if (i >= 0) for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) o.push(argv[j]); return o; };
const romPath: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
const out = opt('out', join(REPO, 'out', 'sa1'))!;
const bootFrames = Number(opt('boot-frames', '6000')), maxFrames = Number(opt('max-frames', '20000')), maxMovies = Number(opt('max-movies', '8'));
const jobs = Number(opt('jobs', String(Math.max(1, Math.min(6, cpus().length - 2)))));
const DEFAULT_MOVIES = join(homedir(), 'Library/Application Support/Code/User/globalStorage/rbin.everscript/tas-recordings');
const movieSpecs = list('movies').length ? list('movies') : existsSync(DEFAULT_MOVIES) ? [DEFAULT_MOVIES] : [];

interface Input { name: string; pads: Uint16Array; frames: number }

/** Movies recorded on this ROM that replay as plain pad input, longest first, cut to maxFrames. */
function movies(sha: string): Input[] {
    const files = movieSpecs.flatMap(s => statSync(s).isDirectory() ? readdirSync(s).filter(f => f.endsWith('.evsmv')).map(f => join(s, f)) : [s]);
    return files.map(f => ({ f, m: parseMovie(readFileSync(f, 'utf8'), basename(f)) }))
        .filter(({ m }) => m.meta.romSha256 === sha && m.count > 600 && !m.events.some((e: { kind: string; frame: number }) => REPLAY_CHANGING.has(e.kind) && e.frame < maxFrames))
        .sort((a, b) => b.m.count - a.m.count).slice(0, maxMovies)
        .map(({ f, m }) => ({ name: basename(f), pads: m.pads, frames: Math.min(m.count, maxFrames) }));
}

function staticChecks(rom: Uint8Array, img: Uint8Array, upper: (off: number) => number, used: [number, number][], fill: number, patched: [number, number][]): string[] {
    const fails: string[] = [];
    const hirom = (off: number) => off < rom.length ? rom[off] : upper(off);
    for (let off = 0; off < 4 * MB; off++) {
        if (off !== 0xFFDC && off !== 0xFFDD && off !== 0xFFDE && off !== 0xFFDF && img[LINEAR + off] !== hirom(off)) { fails.push(`linear $${(0xC0 + (off >> 16)).toString(16)}:${(off & 0xFFFF).toString(16)} differs`); break; }
    }
    for (let n = 0; n < 0x40; n++) for (let o = 0; o < 0x8000; o++) {
        const at = loRomFile((0x80 + n) << 16 | 0x8000) + o;
        if (!patched.some(([a, b]) => at >= a && at < b) && img[at] !== hirom(n * 0x10000 + 0x8000 + o)) { fails.push(`LoROM $${(0x80 + n).toString(16)}:${(0x8000 + o).toString(16)} differs`); n = 0x40; break; }
    }
    for (let i = 0; i < 2 * MB - 64; i++) if (img[i] !== fill && !used.some(([a, b]) => i >= a && i < b)) { fails.push(`block 0-1 byte ${hex(i)} is not fill`); break; }
    return fails;
}

const firstDifference = (a: string, b: string) => {
    const la = a.split('\n').filter(l => l && !l.startsWith('probe')), lb = b.split('\n').filter(l => l && !l.startsWith('probe'));
    for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) return { line: i + 1, a: la[i] ?? '(end)', b: lb[i] ?? '(end)' };
    return null;
};

async function pool(tasks: (() => Promise<void>)[], n: number) {
    let next = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (next < tasks.length) await tasks[next++](); }));
}

const exe = mesenPath();
if (!exe) { console.error('MesenCE not found: set MESEN'); process.exit(2); }
mkdirSync(out, { recursive: true });
const source = new Uint8Array(readFileSync(romPath));
const rom = source.length % 1024 === 512 ? source.subarray(512) : source;
const sha = createHash('sha256').update(source).digest('hex');
const lines = ['# SA-1 proof (MesenCE)', '', `Original: \`${basename(romPath)}\` (sha256 \`${sha.slice(0, 16)}…\`). Generated by \`tools/sa1/prove.mts\`.`, ''];
const fails: string[] = [];
const log = (...ss: string[]) => ss.forEach(s => { console.log(s); lines.push(s); });

log('## 1. Static checks');
const builds: Record<string, { file: string; image: Uint8Array; used: [number, number][] }> = {};
for (const [name, o] of Object.entries(IMAGES)) {
    const { image, report } = convert(source, o);
    const file = join(out, `soe-sa1${name === 'release' ? '' : '-' + name}.sfc`);
    writeFileSync(file, image);
    const used = usedRanges(report);
    const f = staticChecks(rom, image, off => image[LINEAR + off], used, o.fill, report.patched);
    builds[name] = { file, image, used };
    log(`- ${name} (4th MB: ${o.upper}, fill $${o.fill.toString(16).toUpperCase()}): ${f.length ? 'FAIL ' + f.join('; ') : 'ok'}; MesenCE header scores ${JSON.stringify(report.scores)}`);
    fails.push(...f);
}

const inputs: Input[] = [{ name: 'power-on, no input', pads: new Uint16Array(bootFrames), frames: bootFrames }, ...movies(sha)];
const roms: Record<string, string> = { original: romPath, ...Object.fromEntries(Object.entries(builds).map(([k, b]) => [k, b.file])) };
const traces: Record<string, string> = {};
const tasks: (() => Promise<void>)[] = [];
inputs.forEach((inp, i) => {
    for (const name of Object.keys(roms)) {
        tasks.push(async () => { traces[`${i}.${name}`] = await runMesen(exe, { rom: roms[name], pads: inp.pads, frames: inp.frames, dir: out, tag: `run${i}.${name}`, probes: i === 0 ? PROBES : [], watch: name === 'trap' ? WATCH : [] }); });
    }
});
tasks.push(async () => { traces['0.again'] = await runMesen(exe, { rom: romPath, pads: inputs[0].pads, frames: inputs[0].frames, dir: out, tag: 'run0.original-again' }); });
const total = inputs.reduce((s, x) => s + x.frames, 0);
console.log(`${tasks.length} MesenCE runs, ${total} frames per ROM, ${jobs} at a time…`);
const t0 = Date.now();
await pool(tasks, jobs);

log('', '## 2. Mapping in MesenCE (bus reads after frame 60)');
const bus = (name: string) => traces[`0.${name}`].split('\n').find(l => l.startsWith('probe bus'))!.slice(10);
for (const name of Object.keys(roms)) log(`- ${name}: \`${bus(name)}\``);
const val = (name: string, a: number) => bus(name).split(' ').find(s => s.startsWith(a.toString(16).toUpperCase().padStart(6, '0') + '='))?.slice(7);
for (const name of Object.keys(builds)) {
    if (val(name, 0x00FFD5) !== '23' || val(name, 0x00FFD6) !== '35') fails.push(`${name}: bank $00 does not show the SA-1 header`);
    for (const a of [0xC08020, 0x808020, 0xC08034, 0x808034, 0xA08000, 0xE08000]) if (val(name, a) !== val('original', a)) fails.push(`${name}: bus ${hex(a)} reads $${val(name, a)}, the original $${val('original', a)}`);
}

log('', '## 3. Same input, same machine state');
const control = firstDifference(traces['0.original'], traces['0.again']);
log(`- control, original vs original: ${control ? 'NOT deterministic' : 'identical'}`);
if (control) fails.push('MesenCE is not deterministic on the original');
log('', '| input | frames | rooms | release | mesen | trap | $80:D113 ran |', '|---|---|---|---|---|---|---|');
const rooms = new Set<string>();
inputs.forEach((inp, i) => {
    const t = traces[`${i}.original`];
    const r = new Set(t.split('\n').filter(l => l.includes(' state ')).map(l => l.match(/room=(\d+)/)![1]));
    r.forEach(x => rooms.add(x));
    const ran = t.split('\n').filter(l => l.startsWith('probe d113')).map(l => l.split(' ').pop());
    const cell = (name: string) => {
        const d = firstDifference(t, traces[`${i}.${name}`]);
        if (!d) return 'identical';
        const explained = ran.length > 0 && name !== 'mesen';
        if (!explained) fails.push(`${inp.name}: ${name} differs at trace line ${d.line}: ${d.a} / ${d.b}`);
        return `differs at frame ${d.a.split(' ')[0]}${explained ? ' (expected: 4th MB)' : ' FAIL'}`;
    };
    log(`| ${inp.name} | ${inp.frames} | ${r.size} | ${cell('release')} | ${cell('mesen')} | ${cell('trap')} | ${ran.length ? 'frame ' + ran.join(', ') : 'no'} |`);
});
log(`- ${total} frames per ROM (${(total / 3600).toFixed(1)} min of play), ${rooms.size} distinct rooms; ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);

log('', '## 4. Trap image: ROM bytes touched in block 0-1 and the 4th MB');
const touched = new Map<number, string>();
inputs.forEach((_, i) => {
    for (const l of traces[`${i}.trap`].split('\n')) {
        const m = l.match(/^probe (read|exec) ([0-9A-F]{6})/);
        if (m) touched.set(busToFile(parseInt(m[2], 16)), m[1]);
    }
});
const spans = (offs: number[]) => {
    const runs: [number, number][] = [];
    for (const o of [...offs].sort((a, b) => a - b)) { const l = runs[runs.length - 1]; if (l && o <= l[1] + 1) l[1] = o; else runs.push([o, o]); }
    return runs.map(([a, b]) => a === b ? hex(a) : `${hex(a)}–${hex(b)}`).join(', ') || 'nothing';
};
const offs = [...touched.keys()];
log(`- block 0-1: ${spans(offs.filter(o => o < 2 * MB))}`);
log(`- 4th MB (LoROM $B0-$BF / linear $F0-$FF): ${spans(offs.filter(o => o >= 2 * MB))}`);
const stray = offs.filter(o => o < 2 * MB && !builds.trap.used.some(([a, b]) => o >= a && o < b));
log(`- in block 0-1 but not written by convert.mts: ${stray.length ? 'FAIL ' + spans(stray) : 'none'}`);
if (stray.length) fails.push(`the game touched ${spans(stray)}`);

log('', fails.length ? `## Result: FAILED (${fails.length})` : '## Result: proven — no unexplained difference between the original and the SA-1 images in MesenCE');
fails.slice(0, 30).forEach(f => log('- ' + f));
writeFileSync(join(out, 'REPORT.md'), lines.join('\n') + '\n');
console.log(`\nreport: ${join(out, 'REPORT.md')}`);
process.exit(fails.length ? 1 : 0);
