'use strict';

/**
 * Movie events (writes, soft resets, WRAM checksums): the format in movie.ts, the webview half
 * (tas-view.js) driven against a fake core, and, when a local Secret of Evermore ROM is found, the
 * headless replay tool (tools/cdl/replay.js) on the real core: checksums match across processes
 * and a changed input is reported as a desync.
 * ROM: the Evermore ROM of the ROM library (npm run roms). The ROM is only read.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const movie = require('../../dist/platform/tas/movie');
const { getTasClientScript } = require('../../src/core/emulator/tas-view');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  [PASS] ${name}`); passed++; }
    catch (e) { console.error(`  [FAIL] ${name}\n    ${e.stack || e.message}`); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-tas-events-'));
console.log('TAS events tests:');

// ---- movie.ts -----------------------------------------------------------------------------
test('CRC-32 matches the standard check value; WRAM CRC reads the 128 KB in core-sized chunks', () => {
    assert.strictEqual(movie.crc32(Buffer.from('123456789')), 0xCBF43926);
    const reads = [];
    movie.wramCrc((addr, n) => { reads.push([addr, n]); return new Uint8Array(n); });
    assert.strictEqual(reads.length, 32);
    assert.deepStrictEqual(reads[0], [0x7E0000, 4096]);
    assert.deepStrictEqual(reads[31], [0x7E0000 + 31 * 4096, 4096]);
});

test('frame lines run-length encode and expand; T lines round-trip', () => {
    const text = ['F|....', 'F|....', 'F|....', 'F|B...', 'W|7E0010|01', 'F|B...', 'F|B...'].join('\n') + '\n';
    assert.strictEqual(movie.rleFrames(text), 'F|....*3\nF|B...\nW|7E0010|01\nF|B...*2\n');
    const m = movie.parseMovie(movie.evsmvHeader({ rom: 'x', romSha256: '', started: 't', core: 'abc' }) + movie.rleFrames(text), 'a');
    assert.strictEqual(m.count, 6);
    assert.deepStrictEqual(Array.from(m.pads), [0, 0, 0, 0x8000, 0x8000, 0x8000]);
    assert.strictEqual(m.events[0].frame, 4, 'the event sits after the 4th emulated frame');
    assert.strictEqual(m.meta.core, 'abc');
    const crcs = movie.spaceCrcs(id => (id === 3 ? null : new Uint8Array([id])));
    const line = movie.spacesLine(crcs);
    assert.deepStrictEqual(movie.parseEvent(line), { kind: 'T', crcs });
    assert.strictEqual(crcs.sram, 0, 'a cartridge without SRAM checksums as 0');
});

test('event lines parse into the boundary they sit on; version 1 movies still load', () => {
    const text = movie.evsmvHeader({ rom: 'x', romSha256: '', started: 't' }) + [
        'W|7E4ECF|00FF', 'F|....', 'F|B...', 'W|7E0010|01', 'R|soft', 'S|0000ABCD', 'F|....',
    ].join('\n') + '\n';
    const m = movie.parseMovie(text, 'a.evsmv');
    assert.strictEqual(m.version, 3);
    assert.strictEqual(m.count, 3);
    assert.deepStrictEqual(m.events.map(e => [e.frame, e.kind]), [[0, 'W'], [2, 'W'], [2, 'R'], [2, 'S']]);
    assert.deepStrictEqual(m.events[0].bytes, [0, 255]);
    assert.strictEqual(m.events[0].addr, 0x7E4ECF);
    assert.strictEqual(m.events[3].crc, 0xABCD);
    assert.strictEqual(movie.groupEvents(m.events).get(2).length, 3);
    assert.strictEqual(movie.writeLine(0x7E4ECF, [0, 255]), 'W|7E4ECF|00FF');
    const v1 = movie.parseMovie('# Everscript movie 1\n# cheats: yes\nF|....\n', 'old');
    assert.strictEqual(v1.version, 1);
    assert.strictEqual(v1.events.length, 0);
    assert.ok(v1.warnings.length, 'version 1 cannot replay cheats');
    assert.ok(!m.warnings.length);
});

// ---- the webview half against a fake core -------------------------------------------------
function makeWebview() {
    const posted = [];
    const mem = new Uint8Array(0x20000);
    let resets = 0;
    const spaces = [0, 1, 2, 3, 4].map(i => new Uint8Array([i, i + 1, i + 2]));
    const m = {
        writes: [],
        writeMemory(addr, v) { this.writes.push([addr, v]); if (addr >= 0x7E0000 && addr < 0x800000) mem[addr - 0x7E0000] = v; },
        readMemory(addr) { return mem[addr - 0x7E0000]; },
        readMemoryRange(addr, n) { return mem.subarray(addr - 0x7E0000, addr - 0x7E0000 + n); },
        _setJoypadInput(p) { this.pad = p; },
        _softReset() { resets++; mem[0] = 0; mem.fill(0, 0, 16); },
        _takeInputPolled() { return 1; },
        readSpace(id) { return spaces[id]; },
        frames: 0,
        run() { this.frames++; mem[0x100]++; },    // a frame bumps a counter, like the NMI
    };
    const sandbox = {
        document: { getElementById: () => null, addEventListener() {} },
        vscodeApi: { postMessage: msg => posted.push(msg) },
        romLoaded: true, loadedRomData: new Uint8Array(4), loadedRomName: 'x',
        getModule: () => m, setControlEnabled() {}, console, atob: s => Buffer.from(s, 'base64').toString('binary'),
        bootRom() { vm.runInContext('tasOnBoot("x")', ctx); },
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(getTasClientScript(), ctx);
    return { ctx, m, mem, posted, resets: () => resets, call: code => vm.runInContext(code, ctx) };
}

function frameStep(w, pad) { w.call('tasApplyInput(getModule(), ' + pad + ')'); w.m.run(); }

test('the webview records frames, merged writes, resets and checksums in order, and drops no-op writes', () => {
    const w = makeWebview();
    w.call('tasOnBoot("x")');
    frameStep(w, 0x80);
    w.m.writeMemory(0x7E4ECF, 5); w.m.writeMemory(0x7E4ED0, 6);   // coalesce into one line
    w.m.writeMemory(0x7E4ECF, 5);                                   // no change: not an event
    w.m.writeMemory(0x7E0010, 0);                                   // memory is 0 already: not an event
    frameStep(w, 0);
    w.call('tasSoftReset()');
    frameStep(w, 0);
    for (let i = 0; i < 600; i++) frameStep(w, 0);
    w.call('tasFlush()');
    const text = w.posted.filter(p => p.command === 'tasRecFrames').map(p => p.text).join('');
    const lines = text.trim().split('\n');
    assert.strictEqual(lines[0], 'F|' + movie.padToText(0x80));
    assert.strictEqual(lines[1], 'W|7E4ECF|0506');
    assert.ok(lines[2].startsWith('F|'));
    assert.strictEqual(lines[3], 'R|soft');
    assert.ok(lines.some(l => /^S\|[0-9A-F]{8}$/.test(l)), 'a checksum line after 60 frames');
    assert.ok(lines.some(l => /^T\|vram=[0-9A-F]{8}\|cgram=[0-9A-F]{8}\|oam=[0-9A-F]{8}\|sram=[0-9A-F]{8}\|aram=[0-9A-F]{8}$/.test(l)), 'the other spaces after 600 frames');
    const sent = w.posted.filter(p => p.command === 'tasRecFrames').reduce((n, p) => n + p.frames, 0);
    assert.strictEqual(sent, 603, 'the host is told the frame count, not the line count');
    // the checksum in the file equals movie.ts over the same memory, i.e. the two CRC codes agree
    const s = lines.find(l => l[0] === 'S');
    assert.strictEqual(s.slice(2).length, 8);
});

test('a replay applies events at their boundary, presses reset, and reports the first checksum mismatch', () => {
    // record
    const rec = makeWebview();
    rec.call('tasOnBoot("x")');
    for (let i = 0; i < 3; i++) frameStep(rec, 0);
    rec.m.writeMemory(0x7E0200, 0x42);
    frameStep(rec, 0);
    rec.call('tasSoftReset()');
    for (let i = 0; i < 598; i++) frameStep(rec, 0);       // frame 602: checksum at 600 is in the file
    rec.call('tasFlush()');
    const text = movie.evsmvHeader({ rom: 'x', romSha256: '', started: 't' }) + rec.posted.filter(p => p.command === 'tasRecFrames').map(p => p.text).join('');
    const parsed = movie.parseMovie(text, 'm');
    assert.ok(parsed.events.some(e => e.kind === 'S' && e.frame === 60));
    assert.ok(parsed.events.some(e => e.kind === 'T' && e.frame === 600));
    const finalMem = Uint8Array.from(rec.mem);

    const play = (mutate) => {
        const w = makeWebview();
        const events = parsed.events.map(e => ({ ...e }));
        if (mutate) mutate(events);
        const pads = Buffer.from(parsed.pads.buffer, parsed.pads.byteOffset, parsed.pads.byteLength).toString('base64');
        w.call('tasHandleBoot = 0');
        w.call('handleTasMessage(' + JSON.stringify({ command: 'tasMovie', id: 'x', title: 't', count: parsed.count, pads, events }) + ')');
        for (let i = 0; i < parsed.count; i++) frameStep(w, 0);
        frameStep(w, 0);   // the call after the last frame applies the trailing events and hands control back
        return w;
    };
    const ok = play();
    assert.deepStrictEqual(Array.from(ok.mem.subarray(0, 0x300)), Array.from(finalMem.subarray(0, 0x300)).map((v, i) => (i === 0x100 ? v + 1 : v)), 'same memory (one extra frame was run)');
    assert.strictEqual(ok.resets(), 1, 'the reset was pressed once');
    assert.strictEqual(ok.call('tasDesync'), null);
    const bad = play(events => { const s = events.find(e => e.kind === 'S'); s.crc ^= 1; });
    assert.ok(bad.call('tasDesync'), 'a wrong checksum is a desync');
    assert.strictEqual(bad.call('tasDesync.frame'), 60);
    assert.ok(bad.posted.some(p => p.command === 'tasDesync' && p.frame === 60));
    // a wrong checksum of another space is a desync too, and names the space
    const badSpace = play(events => { const t = events.find(e => e.kind === 'T'); t.crcs.vram ^= 1; });
    assert.strictEqual(badSpace.call('tasDesync.frame'), 600);
    assert.ok(/^vram /.test(badSpace.call('tasDesync.expected')));
});

test('a cheat that rewrites memory every frame replays without a desync', () => {
    const rec = makeWebview();
    rec.call('tasOnBoot("x")');
    for (let i = 0; i < 700; i++) {
        rec.m.writeMemory(0x7E0100, 0x10 + (i % 3));    // like maintainCheats(): before the frame, every frame
        rec.m.writeMemory(0x7E4ECF, 0);                 // a value the game never touches: one event only
        frameStep(rec, i % 7 === 0 ? 0x80 : 0);
    }
    rec.call('tasFlush()');
    const text = movie.evsmvHeader({ rom: 'x', romSha256: '', started: 't' }) + movie.rleFrames(rec.posted.filter(p => p.command === 'tasRecFrames').map(p => p.text).join(''));
    const parsed = movie.parseMovie(text, 'm');
    assert.strictEqual(parsed.count, 700);
    assert.strictEqual(parsed.events.filter(e => e.kind === 'W' && e.addr === 0x7E4ECF).length, 0, 'a write that changes nothing is no event');
    assert.ok(parsed.events.filter(e => e.kind === 'W' && e.addr === 0x7E0100).length > 50, 'the cheat is recorded whenever the game had changed the value');
    assert.ok(parsed.events.some(e => e.kind === 'T'), 'the other spaces are checked too');
    const w = makeWebview();
    const pads = Buffer.from(parsed.pads.buffer, parsed.pads.byteOffset, parsed.pads.byteLength).toString('base64');
    w.call('handleTasMessage(' + JSON.stringify({ command: 'tasMovie', id: 'x', title: 't', count: parsed.count, pads, events: parsed.events }) + ')');
    for (let i = 0; i < parsed.count; i++) frameStep(w, 0);
    assert.strictEqual(w.call('tasDesync'), null);
    assert.strictEqual(w.mem[0x100], rec.mem[0x100], 'the replay reached the same memory');
});

test('while recording by hand the webview asks the host for a replay check every N minutes', () => {
    const w = makeWebview();
    w.call('handleTasMessage({ command: "tasConfig", autoRecord: true, verifyEveryMinutes: 0.06 })');
    w.call('tasOnBoot("x")');
    for (let i = 0; i < 300; i++) frameStep(w, i === 0 ? 0x80 : 0);
    const asks = w.posted.filter(p => p.command === 'tasVerify').length;
    assert.strictEqual(asks, 1, 'asked ' + asks + ' times in 300 frames at every 180');
    const flushedBefore = w.posted.findIndex(p => p.command === 'tasVerify') > w.posted.findIndex(p => p.command === 'tasRecFrames');
    assert.ok(flushedBefore, 'the frames are sent before the check is requested');
    const off = makeWebview();
    off.call('handleTasMessage({ command: "tasConfig", autoRecord: true, verifyEveryMinutes: 0 })');
    off.call('tasOnBoot("x")');
    for (let i = 0; i < 300; i++) frameStep(off, i === 0 ? 0x80 : 0);
    assert.strictEqual(off.posted.filter(p => p.command === 'tasVerify').length, 0, '0 turns it off');
});

test('the movie sample rate is the one the emulator panel boots with', () => {
    const panel = require('../../src/core/webview/page-file').pageFiles(path.join(ROOT, 'src/core/emulator/webview'))('page', new Proxy({}, { has: () => true, get: (_, k) => '//@@' + String(k) }));
    assert.ok(new RegExp('AUDIO_FREQ\\s*=\\s*' + movie.AUDIO_RATE + '\\b').test(panel));
});

test('the webview CRC code equals movie.js', () => {
    const w = makeWebview();
    const data = Uint8Array.from({ length: 1000 }, (_, i) => (i * 37 + 11) & 255);
    const got = w.call('(tasCrcUpdate(0xFFFFFFFF, new Uint8Array([' + Array.from(data).join(',') + '])) ^ 0xFFFFFFFF) >>> 0');
    assert.strictEqual(got, movie.crc32(data));
});

// ---- the headless tool on the real core -----------------------------------------------------
function findRom() {
    return require('../../dist/games').romPath('evermore');
}

test('headless replay: checksums match across processes, a changed event desyncs, CDL records', () => {
    const rom = findRom();
    const core = path.join(ROOT, 'src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
    if (!rom || !fs.existsSync(core)) { console.log('    (skipped: no local ROM or built core)'); return; }
    const tool = path.join(ROOT, 'tools/cdl/replay.js');
    const pads = [];
    for (let i = 0; i < 1500; i++) pads.push(i % 50 < 3 ? 0x1000 : 0);
    const body = pads.map((p, i) => {
        const ev = i === 100 ? 'W|7E1F00|DEADBEEF\n' : i === 700 ? 'R|soft\n' : '';
        return ev + movie.frameLine(p);
    }).join('\n') + '\n';
    const header = movie.evsmvHeader({ rom: 'x', romSha256: '', started: 't' });
    const bare = path.join(tmp, 'bare.evsmv');
    fs.writeFileSync(bare, header + body);
    const collect = () => execFileSync(process.execPath, [tool, bare, rom, '--collect', '300'], { encoding: 'utf8', timeout: 180000 }).trim().split('\n');
    const a = collect(), b = collect();
    assert.deepStrictEqual(a, b, 'two processes give the same checksums');
    // determinism contract: the recorder only observes, so the CDL on or off gives the same checksums in every space
    const withCdl = execFileSync(process.execPath, [tool, bare, rom, '--collect', '300', '--cdl', path.join(tmp, 'lib-det')], { encoding: 'utf8', timeout: 180000 }).trim().split('\n');
    assert.deepStrictEqual(withCdl, a, 'recording the CDL does not change emulation');
    assert.strictEqual(a.length, 5);
    assert.ok(/^300 [0-9A-F]{8} vram=[0-9A-F]{8}\|cgram=/.test(a[0]), a[0]);

    // the same movie with its checksums in it replays clean
    const withChecks = header + pads.map((p, i) => {
        const crc = a.find(l => l.startsWith(i + ' '));
        const ev = i === 100 ? 'W|7E1F00|DEADBEEF\n' : i === 700 ? 'R|soft\n' : '';
        return (crc ? 'S|' + crc.split(' ')[1] + '\nT|' + crc.split(' ')[2] + '\n' : '') + ev + movie.frameLine(p);
    }).join('\n') + '\n';
    // checksums are taken before the boundary's events; move the S line after them by construction above:
    // frames 300/600/900/1200 carry no events, so the order cannot matter here.
    const good = path.join(tmp, 'good.evsmv');
    fs.writeFileSync(good, withChecks);
    const libRoot = path.join(tmp, 'lib');
    const ok = spawnSync(process.execPath, [tool, good, rom, '--cdl', libRoot, '--drain', '600'], { encoding: 'utf8', timeout: 180000 });
    assert.strictEqual(ok.status, 0, ok.stdout + ok.stderr);
    assert.ok(/8 checksums matched/.test(ok.stdout), ok.stdout);
    const libs = fs.readdirSync(libRoot);
    assert.ok(libs.length === 1 && fs.existsSync(path.join(libRoot, libs[0], 'bus.cdl')), 'the CDL library was written');

    // change one recorded write: the first checkpoint after it differs
    const tampered = path.join(tmp, 'tampered.evsmv');
    fs.writeFileSync(tampered, withChecks.replace('W|7E1F00|DEADBEEF', 'W|7E1F00|DEADBEEE'));
    const bad = spawnSync(process.execPath, [tool, tampered, rom], { encoding: 'utf8', timeout: 180000 });
    assert.strictEqual(bad.status, 2, bad.stdout + bad.stderr);
    assert.ok(/DESYNC at frame 300/.test(bad.stderr), bad.stderr);

    // one wrong VRAM checksum: named in the report
    const badVram = path.join(tmp, 'badvram.evsmv');
    const vramCrc = /vram=([0-9A-F]{8})/.exec(a[1])[1];
    fs.writeFileSync(badVram, withChecks.replace('vram=' + vramCrc, 'vram=' + (parseInt(vramCrc, 16) ^ 1).toString(16).toUpperCase().padStart(8, '0')));
    const bv = spawnSync(process.execPath, [tool, badVram, rom], { encoding: 'utf8', timeout: 180000 });
    assert.strictEqual(bv.status, 2, bv.stdout + bv.stderr);
    assert.ok(/DESYNC at frame 600: expected vram /.test(bv.stderr), bv.stderr);

    // a movie from another core build is refused unless --force
    const other = path.join(tmp, 'other.evsmv');
    fs.writeFileSync(other, withChecks.replace('# start:', '# core: 0000000000000000\n# start:'));
    const refused = spawnSync(process.execPath, [tool, other, rom, '--until', '10'], { encoding: 'utf8', timeout: 60000 });
    assert.strictEqual(refused.status, 1, refused.stdout + refused.stderr);
    assert.ok(/another|recorded on core/.test(refused.stderr), refused.stderr);
    assert.strictEqual(spawnSync(process.execPath, [tool, other, rom, '--until', '10', '--force'], { encoding: 'utf8', timeout: 60000 }).status, 0);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
