#!/usr/bin/env node
// Prove the table hack (docs/table-hack.md §0): build one image per moved table, one with all of them and a base with
// none, then run the original and every image on the same inputs and compare. A table passes when its image never
// differs from the original: same WRAM every frame, same screen every 60 frames.
// Inputs: the stored sample playbacks (.agents/skills/sample-playbacks: the attract loop reaches every table's
// readers in 6224 frames). --movies replaces them; do not point it at a pile of random recordings.
//   node tools/table-hack/prove.js --rom <clean rom> [--movies <dir|file>...] [--out dir] [--jobs N]
// Writes <out>/REPORT.md. Exit code 0 = every image matches, 1 = a difference, 2 = usage.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawn } = require('child_process');
const { TABLES, build, hex } = require('./tables');
const { parseMovie } = require('../../src/emulator/tas/movie');

const RUN = path.join(__dirname, 'run.js');
const REPO = path.resolve(__dirname, '..', '..');
const DEFAULT_MOVIES = path.join(REPO, '.agents/skills/sample-playbacks/playbacks');

function parseArgs(argv) {
    const o = { movies: [], out: path.join(REPO, 'out', 'table-hack'), jobs: Math.max(1, os.cpus().length - 1) };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i].replace(/^--/, '');
        if (k === 'movies') while (argv[i + 1] && !argv[i + 1].startsWith('--')) o.movies.push(argv[++i]);
        else if (k === 'jobs') o.jobs = Number(argv[++i]);
        else o[k] = argv[++i];
    }
    o.rom = o.rom || process.env.SOE_ROM || process.env.EVERSCRIPT_ROM;
    if (!o.rom || !fs.existsSync(o.rom)) { console.error('usage: prove.js --rom <clean rom> [--movies <dir|file>...]'); process.exit(2); }
    if (!o.movies.length && fs.existsSync(DEFAULT_MOVIES)) o.movies.push(DEFAULT_MOVIES);
    return o;
}

/** Movies recorded on exactly this ROM (rom.sha256 header), longest first. */
function findMovies(specs, sha) {
    const files = specs.flatMap(s => fs.statSync(s).isDirectory()
        ? fs.readdirSync(s).filter(f => f.endsWith('.evsmv')).map(f => path.join(s, f)) : [s]);
    return files.map(f => ({ file: f, movie: parseMovie(fs.readFileSync(f, 'utf8'), path.basename(f)) }))
        .filter(m => m.movie.meta.romSha256 === sha && m.movie.count > 0)
        .sort((a, b) => b.movie.count - a.movie.count);
}

const runJob = args => new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [RUN, ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('exit', code => (code === 0 ? resolve() : reject(new Error(`run.js ${args.slice(0, 3).join(' ')}: exit ${code}\n${err}`))));
});

async function pool(jobs, n) {
    let next = 0;
    await Promise.all(Array.from({ length: n }, async () => { while (next < jobs.length) await jobs[next++](); }));
}

function firstDifference(a, b) {
    const la = fs.readFileSync(a, 'utf8').split('\n'), lb = fs.readFileSync(b, 'utf8').split('\n');
    for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) return { frame: Number((la[i] || lb[i] || '?').split(' ')[0]), original: la[i], image: lb[i] };
    return null;
}

async function main() {
    const o = parseArgs(process.argv.slice(2));
    fs.mkdirSync(o.out, { recursive: true });
    const source = new Uint8Array(fs.readFileSync(o.rom));
    const sha = crypto.createHash('sha256').update(source).digest('hex');
    const names = [...Object.keys(TABLES), 'sprite_palettes'];
    // `tables`: every table move, no hook: must match exactly. A set with the sprite palette hook adds CPU cycles,
    // which shifts the game's RNG (sample-playbacks skill), so it is reported, not failed.
    const sets = { base: [], ...Object.fromEntries(names.map(n => [n, [n]])), tables: Object.keys(TABLES), all: names };
    const timing = name => sets[name].includes('sprite_palettes');
    const images = {}, moves = {};
    for (const [name, list] of Object.entries(sets)) {
        const { image, moves: m } = build(source, list);
        images[name] = path.join(o.out, `soe-tables-${name}.sfc`);
        fs.writeFileSync(images[name], image);
        moves[name] = m;
    }
    const movies = findMovies(o.movies, sha);
    if (!movies.length) { console.error('no playback recorded on this ROM (rom.sha256) among the inputs'); process.exit(2); }
    const inputs = movies.map(m => ({ name: path.basename(m.file), movie: m.file, frames: 'all', count: m.movie.count }));
    const roms = { original: o.rom, ...images };
    const trace = (i, r) => path.join(o.out, `run${i}.${r}.trace`);
    const jobs = [];
    // bytes that only hold a moved table's address, left out of every run's WRAM checksum (original included)
    const scratch = [...new Set(Object.values(TABLES).flatMap(t => t.scratch || []))];
    const mask = scratch.length ? ['--mask', scratch.join(',')] : [];
    inputs.forEach((inp, i) => { for (const r of Object.keys(roms)) jobs.push(() => runJob([roms[r], inp.movie, inp.frames, trace(i, r), ...mask])); });
    jobs.push(() => runJob([roms.original, inputs[0].movie, 'all', trace(0, 'original-again'), ...mask]));
    console.log(`${inputs.length} inputs × ${Object.keys(roms).length} ROMs = ${jobs.length} headless runs on ${o.jobs} workers…`);
    await pool(jobs, o.jobs);

    const lines = ['# Table hack proof', '', `Original: \`${path.basename(o.rom)}\` (sha256 \`${sha.slice(0, 16)}…\`). Generated by \`tools/table-hack/prove.js\`.`, ''];
    const fail = [];
    const log = (...ss) => ss.forEach(s => { console.log(s); lines.push(s); });
    log('## 1. What moved', '', '| table | entries | bytes | from (file) | to (bus) | operands rewritten |', '|---|---|---|---|---|---|');
    for (const name of names) {
        const m = moves[name][0];
        log(`| ${name} | ${m.count}${m.limit ? ' / ' + m.limit : ''} | ${m.bytes} | ${m.wiped ? hex(m.from) + ' (wiped to ' + hex(m.wiped[1]) + ')' : 'new'} | ${hex(m.bus)} | ${m.rewritten.join('<br>')}${m.left.length ? '<br>not rewritten (data): ' + m.left.join(', ') : ''} |`);
    }
    log('', `WRAM left out of the checksum: ${scratch.map(x => hex(x)).join(', ') || 'nothing'} (it holds a moved table's address, see tables.js \`scratch\`).`);
    log('', 'Every image is 4 MB; `0x300000+` holds what the bundled core shows past a 3 MB ROM, so `base` (nothing moved) must equal the original.', '');
    const control = firstDifference(trace(0, 'original'), trace(0, 'original-again'));
    log(`- control, original vs original: ${control ? 'NOT deterministic' : 'identical'}`);
    if (control) fail.push('the original is not deterministic');
    const columns = Object.keys(images);
    log('', '## 2. Same input, same machine state (WRAM every frame, screen every 60)', '',
        `| input | frames | rooms | ${columns.join(' | ')} |`, `|---|---|---|${columns.map(() => '---').join('|')}|`);
    let total = 0;
    const allRooms = new Set();
    inputs.forEach((inp, i) => {
        total += inp.count;
        const tail = fs.readFileSync(trace(i, 'original'), 'utf8').trim().split('\n');
        const rooms = tail.pop().replace(/^rooms /, '').split(' ');
        const sync = tail.pop();
        if (sync !== 'sync ok') fail.push(`${inp.name}: the original lost sync with the playback (${sync})`);
        rooms.forEach(r => allRooms.add(r));
        const cells = columns.map(n => {
            const d = firstDifference(trace(i, 'original'), trace(i, n));
            if (!d) return 'same';
            if (timing(n)) return `timing differs @${d.frame} (hook)`;
            fail.push(`${n} on ${inp.name}: differs at frame ${d.frame} (${d.original} / ${d.image})`);
            return `**differs @${d.frame}**`;
        });
        log(`| ${inp.name} | ${inp.count} | ${rooms.length}${sync === 'sync ok' ? '' : ' (' + sync + ')'} | ${cells.join(' | ')} |`);
    });
    log('', `- ${total} frames per image (${(total / 3600).toFixed(1)} min of play), ${inputs.length} inputs, ${allRooms.size} distinct rooms: ${[...allRooms].sort().join(' ')}`);
    log('', fail.length ? `## Result: ${fail.length} difference(s)` : '## Result: every moved table plays exactly like the original');
    fail.slice(0, 40).forEach(f => log('- ' + f));
    fs.writeFileSync(path.join(o.out, 'REPORT.md'), lines.join('\n') + '\n');
    console.log(`\nreport: ${path.join(o.out, 'REPORT.md')}`);
    process.exit(fail.length ? 1 : 0);
}

main().catch(e => { console.error(e.stack || e); process.exit(1); });
