// Replay an Everscript movie (.evsmv) headless on the extension's snes9x core, optionally with the CDL recorder on.
//   node tools/cdl/replay.js <movie.evsmv> <rom> [--cdl <library root>] [--drain <frames>] [--until <frame>]
//                            [--collect <every>] [--quiet]
// Applies the movie's events (memory writes, soft resets) at the recorded frame boundaries and compares the WRAM
// checksums (S lines). Exit code: 0 ok, 2 desync (first mismatch is reported, replay stops), 1 error.
//   --cdl      record into the library under <root> (same layout as the extension's; flushed every --drain frames)
//   --drain    frames between CDL drains / flushes (default 3600)
//   --until    stop after this many frames
//   --force    replay although the movie names another emulator core build (# core:) than the one in use
//   --collect  print the WRAM checksum and the other spaces' every N frames as "frame wram vram=..|cgram=..|..." lines instead of comparing (movie without S lines)
// The movie is the source of truth and the CDL library is derived: rerun this whenever the recorder gains streams.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const crypto = require('crypto');
const { parseMovie, groupEvents, wramCrc, spaceCrcs, spacesLine, SPACES, crcText } = require('../../src/emulator/tas/movie');

const CORE = path.join(__dirname, '../../src/emulator/core/snes9x2005-wasm/snes9x_2005.js');
const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i < 0 ? dflt : process.argv[i + 1]; };
const flag = name => process.argv.includes('--' + name);

function bootCore(romBuf, onReady) {
    global.Module = { locateFile: f => path.join(path.dirname(CORE), f), onRuntimeInitialized: () => onReady(global.Module) };
    global.require = require; global.__dirname = path.dirname(CORE); global.__filename = CORE;
    vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });
}

/** Same id the extension writes into a movie: first 16 hex chars of the core's wasm SHA-256. */
function coreId() {
    return crypto.createHash('sha256').update(fs.readFileSync(CORE.replace(/\.js$/, '.wasm'))).digest('hex').slice(0, 16);
}

function run(moviePath, romPath, opts) {
    const movie = parseMovie(fs.readFileSync(moviePath, 'utf8'), path.basename(moviePath));
    if (movie.meta.core && movie.meta.core !== coreId() && !opts.force) {
        console.error('the movie was recorded on core ' + movie.meta.core + ', this is ' + coreId() + ' (--force to replay anyway)');
        process.exit(1);
    }
    const events = groupEvents(movie.events);
    const romBuf = fs.readFileSync(romPath);
    const frames = Math.min(movie.count, opts.until || Infinity);
    bootCore(romBuf, M => {
        const p = M._my_malloc(romBuf.length); HEAPU8.set(romBuf, p);
        M._startWithRom(p, romBuf.length, movie.meta.audio);   // the rate it was recorded at: it leaks into ARAM
        let lib = null;
        if (opts.cdl) {
            const { CdlLibrary, stripCopierHeader } = require('../../src/emulator/cdl/library');
            lib = new CdlLibrary(opts.cdl, new Uint8Array(stripCopierHeader(romBuf)));
            if (!M.cdlEnable()) { console.error('the core has no CDL recorder'); process.exit(1); }
        }
        const drain = () => { if (lib) { lib.applyDelta(M.cdlDrain()); lib.flush(); } };
        const read = (addr, n) => M.readMemoryRange(addr, n);
        let desync = null, checked = 0;
        const boundary = k => {
            for (const ev of events.get(k) || []) {
                if (ev.kind === 'W') for (let i = 0; i < ev.bytes.length; i++) M.writeMemory(ev.addr + i, ev.bytes[i]);
                else if (ev.kind === 'R') M._softReset();
                else if (ev.kind === 'S' && !opts.collect) {
                    const got = wramCrc(read);
                    checked++;
                    if (got !== ev.crc && !desync) desync = { frame: k, expected: crcText(ev.crc), got: crcText(got) };
                } else if (ev.kind === 'T' && !opts.collect) {
                    const got = spaceCrcs(id => M.readSpace(id));
                    checked++;
                    for (const [name] of SPACES) {
                        if (ev.crcs[name] !== undefined && ev.crcs[name] !== got[name] && !desync) {
                            desync = { frame: k, expected: name + ' ' + crcText(ev.crcs[name]), got: crcText(got[name]) };
                        }
                    }
                }
            }
            if (opts.collect && k > 0 && k % opts.collect === 0) console.log(k + ' ' + crcText(wramCrc(read)) + ' ' + spacesLine(spaceCrcs(id => M.readSpace(id))).slice(2));
        };
        for (let k = 0; k < frames && !desync; k++) {
            boundary(k);
            if (desync) break;
            M._setJoypadInput(movie.pads[k]);
            M._mainLoop();
            if (lib && (k + 1) % opts.drainEvery === 0) drain();
            if (!opts.quiet && !opts.collect && (k + 1) % 36000 === 0) console.log('frame ' + (k + 1) + ' / ' + frames);
        }
        if (!desync && frames === movie.count) boundary(frames);   // events after the last frame
        drain();
        if (desync) {
            console.error('DESYNC at frame ' + desync.frame + ': expected ' + desync.expected + ', got ' + desync.got);
            process.exit(2);
        }
        if (!opts.collect) console.log('replayed ' + frames + ' frames, ' + checked + ' checksums matched' + (lib ? ', CDL library flushed to ' + lib.dir : ''));
        process.exit(0);
    });
}

if (require.main === module) {
    const OPT_WITH_VALUE = new Set(['--cdl', '--drain', '--until', '--collect']);
    const positional = [];
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        if (OPT_WITH_VALUE.has(argv[i])) i++;
        else if (!argv[i].startsWith('--')) positional.push(argv[i]);
    }
    const [moviePath, romPath] = positional;
    if (!moviePath || !romPath) { console.error('usage: node tools/cdl/replay.js <movie.evsmv> <rom> [--cdl <root>] [--drain N] [--until N] [--collect N] [--quiet] [--force]'); process.exit(1); }
    try {
        run(moviePath, romPath, {
            cdl: arg('cdl'), drainEvery: parseInt(arg('drain', '3600'), 10), until: parseInt(arg('until', '0'), 10) || 0,
            collect: parseInt(arg('collect', '0'), 10) || 0, quiet: flag('quiet'), force: flag('force'),
        });
    } catch (e) { console.error(e.message); process.exit(1); }
}

module.exports = { run };
