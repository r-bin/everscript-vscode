#!/usr/bin/env node
// One headless run for prove.js: boot <rom> in the extension's snes9x core (the debugger build), feed it a movie
// (or no input), and write a trace that two ROMs can be compared by.
//   node tools/exhirom/run.js <rom> <movie.evsmv | none> <frames | all> <trace out> [--cdl <touched out>] [--probe <json out>]
// Trace lines: "<frame> <WRAM crc>" every frame, "<frame> state vram= screen= sram= <CPU regs>" every 60, and a last
// "rooms <ids>" line with every room id the run was in.
// --cdl     record with the CDL and write every file offset >= 0x300000 that was executed or read (JSON)
// --probe   before running, read a few bus addresses whose meaning differs between HiROM and ExHiROM (JSON)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { parseMovie, groupEvents, wramCrc, crcText } = require('../../dist/platform/tas/movie');

// EXHIROM_CORE: another copy of snes9x_2005.js (+ .wasm next to it), e.g. so a core rebuild cannot cut a long proof run.
const CORE = process.env.EXHIROM_CORE || path.join(__dirname, '../../src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
const STATE_EVERY = 60;
const CURRENT_MAP_ID = 0x7E0ADB;     // knowledge/ram/7e0adb.md: which rooms a run visited (coverage, last trace line)
// Bus addresses that HiROM and ExHiROM map to different file offsets (or the same, as a control).
const PROBES = [0xC00000, 0x808000, 0xFF0000, 0x008020, 0x00FFE0, 0x00FFC0, 0x400000, 0x418000, 0x7D0000, 0x018000, 0x3F8000];

const argv = process.argv.slice(2);
const opt = name => { const i = argv.indexOf('--' + name); return i < 0 ? null : argv.splice(i, 2)[1]; };
const cdlOut = opt('cdl'), probeOut = opt('probe');
const [romPath, moviePath, framesArg, traceOut] = argv;

global.Module = { locateFile: f => path.join(path.dirname(CORE), f), onRuntimeInitialized: () => main(global.Module) };
global.require = require; global.__dirname = path.dirname(CORE); global.__filename = CORE;
vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });

function main(M) {
    const rom = fs.readFileSync(romPath);
    const p = M._my_malloc(rom.length); HEAPU8.set(rom, p);
    M._startWithRom(p, rom.length, 32040);
    if (probeOut) {
        const probes = PROBES.map(a => ({ bus: a, bytes: [...M.readMemoryRange(a, 16)] }));
        fs.writeFileSync(probeOut, JSON.stringify({ probes }));
    }
    if (cdlOut && !M.cdlEnable()) { console.error('the core has no CDL recorder'); process.exit(1); }

    const movie = moviePath === 'none' ? null : parseMovie(fs.readFileSync(moviePath, 'utf8'), path.basename(moviePath));
    const events = movie ? groupEvents(movie.events) : new Map();
    const frames = framesArg === 'all' ? (movie ? movie.count : 0) : Math.min(Number(framesArg), movie ? movie.count : Infinity);
    const read = (a, n) => M.readMemoryRange(a, n);
    const out = [];
    let wramOff = -1;
    const md5 = b => crypto.createHash('md5').update(b).digest('hex').slice(0, 16);
    const touched = new Set(), rooms = new Set();
    const drain = () => {
        const d = M.cdlDrain();
        for (const c of d.chunks) for (let i = 0; i < c.cdl.length; i++) if (c.cdl[i] && c.index * 65536 + i >= 0x300000) touched.add(c.index * 65536 + i);
        for (const c of d.bus) for (let i = 0; i < c.data.length; i++) if (c.data[i] && c.index * 65536 + i >= 0x300000) touched.add(c.index * 65536 + i);
    };

    for (let k = 0; k < frames; k++) {
        for (const ev of events.get(k) || []) {
            if (ev.kind === 'W') for (let i = 0; i < ev.bytes.length; i++) M.writeMemory(ev.addr + i, ev.bytes[i]);
            else if (ev.kind === 'R') M._softReset();
        }
        M._setJoypadInput(movie ? movie.pads[k] : 0);
        M._mainLoop();
        out.push(k + ' ' + crcText(wramCrc(read)));
        rooms.add(M.readMemory(CURRENT_MAP_ID));
        if ((k + 1) % STATE_EVERY === 0 || k === frames - 1) {
            if (wramOff < 0) wramOff = findWram(M);
            const n = M._getStateSaveSize(), sp = M._saveState();
            const vram = md5(new Uint8Array(HEAPU8.buffer, sp + wramOff - 0x10000, 0x10000));
            M._my_free(sp);
            const screen = md5(new Uint8Array(HEAPU8.buffer, M._getScreenBuffer(), 512 * 448 * 4));
            const sram = [];
            for (let a = 0x306000; a < 0x308000; a += 0x1000) sram.push(...M.readMemoryRange(a, 0x1000));
            const c = M.getCPUState();
            out.push(`${k} state vram=${vram} screen=${screen} sram=${md5(Buffer.from(sram))} pc=${c.pc.toString(16)} a=${c.a} x=${c.x} y=${c.y} sp=${c.sp} p=${c.p} db=${c.db}`);
        }
        if (cdlOut && (k + 1) % 3600 === 0) drain();
    }
    out.push('rooms ' + [...rooms].sort((a, b) => a - b).map(r => r.toString(16).padStart(2, '0')).join(' '));
    fs.writeFileSync(traceOut, out.join('\n') + '\n');
    if (cdlOut) { drain(); fs.writeFileSync(cdlOut, JSON.stringify([...touched].sort((a, b) => a - b))); }
    process.exit(0);
}

// Where WRAM sits inside this core's save state (VRAM is the 64 KB before it): write a unique marker into WRAM,
// save, search, and put the original bytes back before the next frame runs, so the game never sees it.
function findWram(M) {
    const at = 0x7E2000, keep = M.readMemoryRange(at, 32);
    const marker = Array.from({ length: 32 }, (_, i) => (i * 73 + 0x5A) & 0xFF);
    marker.forEach((b, i) => M.writeMemory(at + i, b));
    const n = M._getStateSaveSize(), sp = M._saveState();
    const st = new Uint8Array(HEAPU8.buffer, sp, n);
    let found = -1;
    for (let o = 0x10000; o + 0x2000 + 32 <= n && found < 0; o++) {
        let i = 0;
        while (i < 32 && st[o + 0x2000 + i] === marker[i]) i++;
        if (i === 32) found = o;
    }
    M._my_free(sp);
    keep.forEach((b, i) => M.writeMemory(at + i, b));
    if (found < 0) throw new Error('WRAM not found in the save state');
    return found;
}
