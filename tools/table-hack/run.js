#!/usr/bin/env node
// TODO port to TS (docs/todo/port-to-ts.md)
// One headless run for prove.js: boot <rom> in the extension's snes9x core, feed it a movie (or no input) and write a
// trace two ROMs can be compared by.
//   node tools/table-hack/run.js <rom> <movie.evsmv | none> <frames | all> <trace out> [--mask a,b,..] [--dump <frame> <out>]
// Trace lines: "<frame> <WRAM crc>" every frame (masked bytes read as 0), "<frame> state vram= screen= pc=…" every 60
// frames, then "sync ok" or "sync lost at frame N" (the movie's own S checks) and a last "rooms <ids>" line.
// --mask   WRAM bus addresses left out of the CRC: scratch bytes that hold a moved table's address
// --dump   write the whole 128 KB WRAM after <frame> to <out>, to find which bytes differ
// --shots  <f1,f2,..> <dir>: save the screen after those frames as <dir>/<frame>.png
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { encodePng } = require('../../dist/platform');
const { parseMovie, groupEvents, wramCrc, crcText, WRAM_BASE, WRAM_SIZE, AUDIO_RATE } = require('../../dist/platform/tas/movie');

const CORE = process.env.TABLE_HACK_CORE || path.join(__dirname, '../../src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
const STATE_EVERY = 60;
const CURRENT_MAP_ID = 0x7E0ADB;     // knowledge/ram/7e0adb.md

const argv = process.argv.slice(2);
const opt = (name, n = 1) => { const i = argv.indexOf('--' + name); return i < 0 ? null : argv.splice(i, n + 1).slice(1); };
const mask = (opt('mask') || [''])[0].split(',').filter(Boolean).map(Number);
const dump = opt('dump', 2), shots = opt('shots', 2);
const [romPath, moviePath, framesArg, traceOut] = argv;

global.Module = { locateFile: f => path.join(path.dirname(CORE), f), onRuntimeInitialized: () => main(global.Module) };
global.require = require; global.__dirname = path.dirname(CORE); global.__filename = CORE;
vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });

function main(M) {
    const rom = fs.readFileSync(romPath);
    const p = M._my_malloc(rom.length); HEAPU8.set(rom, p);
    M._startWithRom(p, rom.length, AUDIO_RATE);     // the rate movies are recorded at (movie.js)
    const movie = moviePath === 'none' ? null : parseMovie(fs.readFileSync(moviePath, 'utf8'), path.basename(moviePath));
    const events = movie ? groupEvents(movie.events) : new Map();
    const frames = framesArg === 'all' ? (movie ? movie.count : 0) : Math.min(Number(framesArg), movie ? movie.count : Infinity);
    const read = (a, n) => {
        const b = Uint8Array.from(M.readMemoryRange(a, n));
        for (const m of mask) if (m >= a && m < a + n) b[m - a] = 0;
        return b;
    };
    const md5 = b => crypto.createHash('md5').update(b).digest('hex').slice(0, 16);
    const out = [], rooms = new Set();
    let desync = -1;
    for (let k = 0; k < frames; k++) {
        for (const ev of events.get(k) || []) {
            if (ev.kind === 'W') for (let i = 0; i < ev.bytes.length; i++) M.writeMemory(ev.addr + i, ev.bytes[i]);
            else if (ev.kind === 'R') M._softReset();
            // the movie's own WRAM check: on the ROM it was recorded on, a mismatch means the playback lost sync
            else if (ev.kind === 'S' && desync < 0 && wramCrc((ad, n) => M.readMemoryRange(ad, n)) !== ev.crc) desync = k;
        }
        M._setJoypadInput(movie ? movie.pads[k] : 0);
        M._mainLoop();
        out.push(k + ' ' + crcText(wramCrc(read)));
        rooms.add(M.readMemory(CURRENT_MAP_ID));
        if ((k + 1) % STATE_EVERY === 0 || k === frames - 1) {
            const screen = md5(new Uint8Array(HEAPU8.buffer, M._getScreenBuffer(), 512 * 448 * 4));
            const c = M.getCPUState();
            out.push(`${k} state screen=${screen} pc=${c.pc.toString(16)} db=${c.db}`);
        }
        if (shots && shots[0].split(',').map(Number).includes(k)) {
            const sb = M._getScreenBuffer(), rgba = new Uint8Array(256 * 224 * 4);   // 512x448, the picture doubled
            for (let y = 0; y < 224; y++) for (let x = 0; x < 256; x++) {
                for (let c = 0; c < 3; c++) rgba[(y * 256 + x) * 4 + c] = HEAPU8[sb + ((y * 2) * 512 + x * 2) * 4 + c];
                rgba[(y * 256 + x) * 4 + 3] = 255;
            }
            fs.mkdirSync(shots[1], { recursive: true });
            fs.writeFileSync(path.join(shots[1], k + '.png'), encodePng(256, 224, rgba));
        }
        if (dump && k === Number(dump[0])) {
            // readMemoryRange returns at most 4096 bytes per call (the core's buffer), so read WRAM in chunks
            const wram = Buffer.alloc(WRAM_SIZE);
            for (let o = 0; o < WRAM_SIZE; o += 4096) wram.set(M.readMemoryRange(WRAM_BASE + o, 4096), o);
            fs.writeFileSync(dump[1], wram);
        }
    }
    out.push('sync ' + (desync < 0 ? 'ok' : 'lost at frame ' + desync));
    out.push('rooms ' + [...rooms].sort((a, b) => a - b).map(r => r.toString(16).padStart(2, '0')).join(' '));
    fs.writeFileSync(traceOut, out.join('\n') + '\n');
    process.exit(0);
}
