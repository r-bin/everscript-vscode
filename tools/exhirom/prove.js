#!/usr/bin/env node
// Build the ExHiROM images and prove they behave like the HiROM original (docs/exhirom/port.md §6).
//   node tools/exhirom/prove.js --rom <clean HiROM rom> [--movies <dir|file>...] [--boot-frames 6000] [--out dir]
//                               [--jobs N] [--no-mesen]
// Images: release     what we ship: 0x300000-0x3FFFFF = the cartridge's own mirror, $FF fill above 4 MB
//         core-mirror the same, but 0x300000-0x3FFFFF = what the bundled snes9x2005 core mirrors there (offset % size)
//         trap        every byte we did not write on purpose is STP ($DB)
// 1. static   the original is unchanged except the header fields; everything else is what convert.js says
// 2. mapping  both emulators map the image as ExHiROM (bus reads that HiROM mirrors now read the new half)
// 3. snes9x   the original and each image run the same input (power-on with no input, then every movie recorded on
//             this ROM) in the extension's core; WRAM every frame, VRAM/screen/SRAM/CPU every 60 frames.
//             core-mirror must match everywhere. release/trap may only differ on inputs whose CDL shows a read of
//             0x300000-0x3FFFFF, because this core mirrors that area differently from the cartridge.
// 4. CDL      on the trap image: what the game executed or read above the original; above 4 MB only the bytes
//             convert.js wrote may appear
// 5. Mesen2   (cycle-accurate, its own detection) the original vs the release image on the same inputs; runs that
//             reach $80:D113 may differ, because Mesen mirrors 0x300000+ differently again
// Writes <out>/REPORT.md. Exit code 0 = proven, 1 = a check failed, 2 = usage.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawn } = require('child_process');
const { convert, secondHalfUsed, UPPER_MODES, HALF } = require('./convert');
const { mesenPath, runMesen } = require('./mesen');
const { parseMovie } = require('../../src/emulator/tas/movie');

const RUN = path.join(__dirname, 'run.js');
const REPO = path.resolve(__dirname, '..', '..');
const HEADER_FIELDS = new Set([0xFFD5, 0xFFD7, 0xFFDC, 0xFFDD, 0xFFDE, 0xFFDF]);
const IMAGES = { release: { fill: 0xFF, upper: 'hardware' }, 'core-mirror': { fill: 0xFF, upper: 'snes9x2005' }, trap: { fill: 0xDB, upper: 'fill' } };
const hex = (v, n = 6) => '0x' + v.toString(16).toUpperCase().padStart(n, '0');

function parseArgs(argv) {
    const o = { movies: [], bootFrames: 6000, out: path.join(REPO, 'out', 'exhirom'), jobs: Math.max(1, os.cpus().length - 1), mesen: true };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i].replace(/^--/, '');
        if (k === 'movies') while (argv[i + 1] && !argv[i + 1].startsWith('--')) o.movies.push(argv[++i]);
        else if (k === 'no-mesen') o.mesen = false;
        else if (k === 'boot-frames') o.bootFrames = Number(argv[++i]);
        else if (k === 'jobs') o.jobs = Number(argv[++i]);
        else o[k] = argv[++i];
    }
    o.rom = o.rom || process.env.SOE_ROM || process.env.EVERSCRIPT_ROM;
    if (!o.rom || !fs.existsSync(o.rom)) { console.error('usage: prove.js --rom <clean HiROM rom> [--movies <dir|file>...]'); process.exit(2); }
    return o;
}

/** Movies recorded on exactly this ROM (rom.sha256 header), longest first. */
function findMovies(specs, sha) {
    const files = specs.flatMap(s => fs.statSync(s).isDirectory()
        ? fs.readdirSync(s).filter(f => f.endsWith('.evsmv')).map(f => path.join(s, f)) : [s]);
    return files
        .map(f => ({ file: f, movie: parseMovie(fs.readFileSync(f, 'utf8'), path.basename(f)) }))
        .filter(m => m.movie.meta.romSha256 === sha && m.movie.count > 0)
        .sort((a, b) => b.movie.count - a.movie.count);
}

function staticChecks(rom, image, report) {
    const fails = [];
    for (const off of report.changedInSource) if (!HEADER_FIELDS.has(off)) fails.push(`original byte ${hex(off)} changed`);
    const upper = report.upper === 'fill' ? () => report.fill : off => UPPER_MODES[report.upper](rom, off);
    for (let i = rom.length; i < HALF; i++) if (image[i] !== upper(i)) { fails.push(`${hex(i)} is not ${report.upper}`); break; }
    const used = secondHalfUsed(report);
    const inUsed = off => used.some(([a, b]) => off >= a && off < b);
    for (let i = HALF; i < image.length; i++) if (!inUsed(i) && image[i] !== report.fill) { fails.push(`${hex(i)} is not fill`); break; }
    for (const [a, b] of used) for (let i = a; i < b; i++) {
        const want = HEADER_FIELDS.has(i - HALF) ? image[i - HALF] : rom[i - HALF];
        if (image[i] !== want) { fails.push(`${hex(i)} is not a copy of ${hex(i - HALF)}`); break; }
    }
    let sum = 0;
    for (let i = 0; i < image.length; i++) sum += image[i];
    for (const base of [0, HALF]) {
        const cs = image[base + 0xFFDE] | (image[base + 0xFFDF] << 8), cc = image[base + 0xFFDC] | (image[base + 0xFFDD] << 8);
        if (cs !== (sum & 0xFFFF) || (cs ^ cc) !== 0xFFFF) fails.push(`checksum at ${hex(base + 0xFFDC)} is wrong`);
        if (image[base + 0xFFD5] !== 0x35 || image[base + 0xFFD7] !== 0x0D) fails.push(`header at ${hex(base + 0xFFC0)} does not say ExHiROM 8 MB`);
    }
    return fails;
}

function runJob(args) {
    return new Promise((resolve, reject) => {
        const p = spawn(process.execPath, [RUN, ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        p.stderr.on('data', d => { err += d; });
        p.on('exit', code => (code === 0 ? resolve() : reject(new Error(`run.js ${args.slice(0, 3).join(' ')}: exit ${code}\n${err}`))));
    });
}

async function pool(jobs, n) {
    let next = 0;
    const worker = async () => { while (next < jobs.length) { const j = jobs[next++]; await j(); } };
    await Promise.all(Array.from({ length: n }, worker));
}

/** First line where two traces differ (lines starting with "probe" are skipped), or null. */
function firstDifference(a, b) {
    const read = f => fs.readFileSync(f, 'utf8').split('\n').filter(l => !l.startsWith('probe'));
    const la = read(a), lb = read(b);
    for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) return { line: i + 1, original: la[i], exhirom: lb[i] };
    return null;
}

const spans = offs => {
    const runs = [];
    for (const off of [...offs].sort((a, b) => a - b)) {
        const last = runs[runs.length - 1];
        if (last && off <= last[1] + 2) last[1] = off; else runs.push([off, off]);
    }
    return runs.map(([a, b]) => (a === b ? hex(a) : `${hex(a)}–${hex(b)}`)).join(', ') || 'nothing';
};

async function main() {
    const o = parseArgs(process.argv.slice(2));
    fs.mkdirSync(o.out, { recursive: true });
    const source = new Uint8Array(fs.readFileSync(o.rom));
    const rom = source.length % 1024 === 512 ? source.subarray(512) : source;
    const sha = crypto.createHash('sha256').update(source).digest('hex');
    const builds = {};
    for (const [name, opts] of Object.entries(IMAGES)) {
        const { image, report } = convert(source, opts);
        const file = path.join(o.out, `soe-exhirom${name === 'release' ? '' : '-' + name}.sfc`);
        fs.writeFileSync(file, image);
        builds[name] = { file, image, report, fails: staticChecks(rom, image, report) };
    }
    const lines = ['# ExHiROM proof', '', `Original: \`${path.basename(o.rom)}\` (sha256 \`${sha.slice(0, 16)}…\`, ${rom.length} bytes). Generated by \`tools/exhirom/prove.js\`.`, ''];
    const fail = [];
    const log = (...ss) => ss.forEach(s => { console.log(s); lines.push(s); });

    log('## 1. Static checks');
    for (const [name, b] of Object.entries(builds)) {
        log(`- ${name} (\`${path.basename(b.file)}\`, 0x${rom.length.toString(16).toUpperCase()}–0x3FFFFF = ${b.report.upper}, fill $${b.report.fill.toString(16).toUpperCase()}): ${b.fails.length ? 'FAIL ' + b.fails.join('; ') : 'ok'}`);
        fail.push(...b.fails);
    }
    const r = builds.release.report;
    log(`- changed inside the original: ${r.changedInSource.map(x => hex(x)).join(', ')} (map mode $31 → $35, size $0C → $0D, checksum pair)`);
    for (const e of r.entries) log(`- bank-$00 entry $00:${e.start.toString(16).toUpperCase()} (${e.vectors.join(', ')}): ${e.length} bytes at ${hex(e.file)}, then ${e.exit}`);

    const movies = findMovies(o.movies, sha);
    const inputs = [{ name: 'power-on, no input', movie: 'none', frames: String(o.bootFrames), count: o.bootFrames, pads: new Uint16Array(o.bootFrames), events: 0 },
        ...movies.map(m => ({ name: path.basename(m.file), movie: m.file, frames: 'all', count: m.movie.count, pads: m.movie.pads, events: m.movie.events.length }))];
    const roms = { original: o.rom, ...Object.fromEntries(Object.entries(builds).map(([k, b]) => [k, b.file])) };
    const trace = (i, rom) => path.join(o.out, `run${i}.${rom}.trace`);
    const jobs = [];
    inputs.forEach((inp, i) => {
        for (const name of Object.keys(roms)) {
            const extra = i === 0 ? ['--probe', trace(i, name) + '.probe.json'] : [];
            if (name === 'trap') extra.push('--cdl', trace(i, name) + '.cdl.json');
            jobs.push(() => runJob([roms[name], inp.movie, inp.frames, trace(i, name), ...extra]));
        }
    });
    jobs.push(() => runJob([roms.original, 'none', String(o.bootFrames), trace(0, 'original-again')]));
    console.log(`running ${jobs.length} headless snes9x runs on ${o.jobs} workers…`);
    await pool(jobs, o.jobs);

    log('', '## 2. Mapping in the extension\'s snes9x core (bus reads right after power-on)');
    const probe = name => JSON.parse(fs.readFileSync(trace(0, name) + '.probe.json', 'utf8')).probes;
    const pr = Object.fromEntries(Object.keys(roms).map(n => [n, probe(n)]));
    log('| bus | original (HiROM) | release | trap | ExHiROM file offset |', '|---|---|---|---|---|');
    pr.original.forEach(({ bus }, i) => {
        const b = x => x.slice(0, 4).map(v => v.toString(16).padStart(2, '0')).join(' ');
        const bank = bus >> 16, a = bus & 0xFFFF;
        const file = bank >= 0xC0 ? ((bank - 0xC0) << 16) | a : bank >= 0x80 ? ((bank - 0x80) << 16) | a
            : bank >= 0x40 ? HALF + ((bank - 0x40) << 16) + a : HALF + (bank << 16) + a;
        const ok = ['release', 'trap'].every(n => pr[n][i].bytes.every((v, j) => v === builds[n].image[file + j]));
        if (!ok) fail.push(`snes9x: bus $${bus.toString(16)} does not read file ${hex(file)}`);
        log(`| $${bus.toString(16).toUpperCase().padStart(6, '0')} | ${b(pr.original[i].bytes)} | ${b(pr.release[i].bytes)} | ${b(pr.trap[i].bytes)} | ${hex(file)} ${ok ? 'ok' : 'FAIL'} |`);
    });

    log('', '## 3. Same input, same machine state (extension\'s snes9x core)');
    const control = firstDifference(trace(0, 'original'), trace(0, 'original-again'));
    log(`- control, original vs original: ${control ? 'NOT deterministic, line ' + control.line : 'identical'}`);
    if (control) fail.push('the original is not deterministic; comparisons are meaningless');
    log('', '| input | frames | rooms | release | core-mirror | trap | reads 0x300000+ |', '|---|---|---|---|---|---|---|');
    let total = 0;
    const allRooms = new Set(), touched = new Set();
    inputs.forEach((inp, i) => {
        total += inp.count;
        const rooms = fs.readFileSync(trace(i, 'original'), 'utf8').trim().split('\n').pop().replace(/^rooms /, '').split(' ');
        rooms.forEach(x => allRooms.add(x));
        const cdl = JSON.parse(fs.readFileSync(trace(i, 'trap') + '.cdl.json', 'utf8'));
        cdl.forEach(x => touched.add(x));
        const readsUpper = cdl.some(off => off >= rom.length && off < HALF);
        inp.readsUpper = readsUpper;
        const cell = name => {
            const d = firstDifference(trace(i, 'original'), trace(i, name));
            if (!d) return 'identical';
            const explained = readsUpper && name !== 'core-mirror';
            if (!explained) fail.push(`${inp.name}: ${name} differs at trace line ${d.line}: ${d.original} / ${d.exhirom}`);
            return `differs at frame ${d.original ? d.original.split(' ')[0] : '?'}${explained ? ' (expected: this core mirrors 0x300000+ unlike the cartridge)' : ' FAIL'}`;
        };
        log(`| ${inp.name} | ${inp.count} | ${rooms.length} | ${cell('release')} | ${cell('core-mirror')} | ${cell('trap')} | ${readsUpper ? 'yes' : 'no'} |`);
    });
    log(`- ${total} frames per image (${(total / 3600).toFixed(1)} min of play), ${inputs.length} inputs, ${allRooms.size} distinct rooms ($7E0ADB): ${[...allRooms].sort().join(' ')}`);

    log('', '## 4. CDL on the trap image: bytes above the original that were executed or read');
    const upperHits = [...touched].filter(x => x < HALF), secondHalf = [...touched].filter(x => x >= HALF);
    const used = secondHalfUsed(builds.trap.report);
    const stray = secondHalf.filter(off => !used.some(([a, b]) => off >= a && off < b));
    log(`- between the original's end and 4 MB (HiROM mirror area): ${spans(upperHits)}`);
    log(`- above 4 MB (new ExHiROM half): ${spans(secondHalf)}`);
    log(`- above 4 MB but not written by convert.js: ${stray.length ? 'FAIL ' + spans(stray) : 'none'}`);
    fail.push(...stray.map(x => `the game touched ${hex(x)}`));

    if (o.mesen && mesenPath()) {
        const dir = path.join(o.out, 'mesen');
        fs.mkdirSync(dir, { recursive: true });
        const mjobs = [];
        const mtrace = {};
        inputs.forEach((inp, i) => {
            if (inp.events) return;                // soft resets / memory writes are not replayed in Mesen
            for (const name of ['original', 'release']) mjobs.push(async () => { await runMesen(mesenPath(), roms[name], inp.pads, inp.count, dir, `run${i}.${name}`); mtrace[`${i}.${name}`] = path.join(dir, `run${i}.${name}.trace`); });
        });
        mjobs.push(async () => { await runMesen(mesenPath(), roms.original, inputs[0].pads, inputs[0].count, dir, 'run0.original-again'); });
        console.log(`running ${mjobs.length} Mesen2 runs…`);
        await pool(mjobs, Math.max(1, Math.min(o.jobs, 6)));
        log('', '## 5. Mesen2 (cycle-accurate, independent ExHiROM detection), original vs release');
        const probeLine = name => fs.readFileSync(path.join(dir, `run0.${name}.trace`), 'utf8').split('\n').find(l => l.startsWith('probe')) || '';
        log(`- bus reads, original: \`${probeLine('original').slice(6)}\``, `- bus reads, release:  \`${probeLine('release').slice(6)}\``);
        const mcontrol = firstDifference(path.join(dir, 'run0.original.trace'), path.join(dir, 'run0.original-again.trace'));
        log(`- control, original vs original: ${mcontrol ? 'NOT deterministic' : 'identical'}`);
        if (mcontrol) fail.push('Mesen2 is not deterministic');
        log('', '| input | frames | release | $80:D113 ran |', '|---|---|---|---|');
        let mtotal = 0;
        inputs.forEach((inp, i) => {
            if (!mtrace[`${i}.original`]) return;
            mtotal += inp.count;
            const d = firstDifference(mtrace[`${i}.original`], mtrace[`${i}.release`]);
            const ran = fs.readFileSync(mtrace[`${i}.original`], 'utf8').split('\n').filter(l => l.startsWith('probe d113')).map(l => l.split(' ').pop());
            if (d && !ran.length) fail.push(`Mesen2 ${inp.name}: release differs at line ${d.line}: ${d.original} / ${d.exhirom}`);
            const cell = !d ? 'identical' : `differs at frame ${(d.original || '').split(' ')[0]}${ran.length ? ' (expected: Mesen mirrors 0x300000+ unlike the cartridge)' : ' FAIL'}`;
            log(`| ${inp.name} | ${inp.count} | ${cell} | ${ran.length ? 'frame ' + ran.join(', ') : 'no'} |`);
        });
        log(`- ${mtotal} frames compared in Mesen2`);
    } else {
        log('', '## 5. Mesen2: skipped (' + (o.mesen ? 'not found; set MESEN' : '--no-mesen') + ')');
    }

    log('', fail.length ? `## Result: FAILED (${fail.length})` : '## Result: proven — no unexplained difference between the original and the ExHiROM images');
    fail.slice(0, 30).forEach(f => log('- ' + f));
    fs.writeFileSync(path.join(o.out, 'REPORT.md'), lines.join('\n') + '\n');
    console.log(`\nreport: ${path.join(o.out, 'REPORT.md')}`);
    process.exit(fail.length ? 1 : 0);
}

main().catch(e => { console.error(e.stack || e); process.exit(1); });
