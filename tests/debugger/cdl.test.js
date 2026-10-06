'use strict';

/**
 * CDL recorder host side: opcode table, mergeable library, Asar export,
 * WRAM report, lookup, host message decoding and the webview tab.
 * The Asar round trip runs when a local asar binary is found (ASAR env var or
 * ../asar/asar/bin/asar next to this repo); otherwise that check is skipped.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = path.resolve(__dirname, '../..');
const { OPCODES, instructionLength, flowKind, FLOW } = require('../../src/emulator/cdl/opcodes');
const { CdlLibrary, romHash } = require('../../src/emulator/cdl/library');
const { decodeAt, formatInstruction } = require('../../src/emulator/cdl/disasm');
const { exportAsar } = require('../../src/emulator/cdl/asar-export');
const { exportWram } = require('../../src/emulator/cdl/wram-export');
const { parseQuery, lookup } = require('../../src/emulator/cdl/lookup');
const { createRomMap } = require('../../src/emulator/cdl/rom-map');
const { buildIndex, SPACE } = require('../../src/emulator/cdl/xref-index');
const gen = require('../../tools/gen-cdl-optable');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (e) {
        console.error(`  [FAIL] ${name}`);
        console.error(`    ${e.stack || e.message}`);
        failed++;
    }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-cdl-'));

// A 128 KB HiROM image with a tiny program at C0:8000.
//   8000 C2 30       rep #$30
//   8002 A9 34 12    lda.w #$1234
//   8005 20 10 80    jsr.w $8010
//   8008 80 FE       bra $8008
//   8010 8D 57 4E    sta.w $4E57
//   8013 60          rts
//   9000 4-byte table read by 8010
function makeRom() {
    const rom = new Uint8Array(0x20000);
    rom.set([0xC2, 0x30, 0xA9, 0x34, 0x12, 0x20, 0x10, 0x80, 0x80, 0xFE], 0x8000);
    rom.set([0x8D, 0x57, 0x4E, 0x60], 0x8010);
    rom.set([1, 2, 3, 4], 0x9000);
    // HiROM header: title, map mode $21, checksum/complement pair
    rom.set(Buffer.from('CDL TEST'.padEnd(21, ' ')), 0xFFC0);
    rom[0xFFD5] = 0x21;
    rom.set([0xFF, 0xFF, 0x00, 0x00], 0xFFDC);
    return rom;
}

function recordProgram(lib) {
    const C = 0x01, D = 0x02, SUB = 0x08, HEAD = 0x04, M16 = 0x08, X16 = 0x10;
    const head = (off, len, extra, mx) => {
        lib.cdl[off] |= C | (extra || 0) | (mx === 8 ? 0x30 : 0);
        lib.ext[off] |= HEAD | (mx === 8 ? 0 : M16 | X16);
        for (let i = 1; i < len; i++) lib.cdl[off + i] |= C;
    };
    head(0x8000, 2, SUB, 8);
    head(0x8002, 3, 0, 16);
    head(0x8005, 3, 0, 16);
    head(0x8008, 2, 0, 16);
    head(0x8010, 3, SUB, 16);
    head(0x8013, 1, 0, 16);
    for (let i = 0; i < 4; i++) lib.cdl[0x9000 + i] |= D;
    lib.mergeLists(
        Uint32Array.from([0x808010, (SPACE.WRAM << 24) | 0x4E57, 0x02 | 0x08, 0x808010, (SPACE.ROM << 24) | 0x9000, 0x01 | 0x04]),
        Uint32Array.from([0x808005, 0x808010, FLOW.CALL]),
        null,
    );
}

console.log('CDL recorder tests:');

test('opcode matrix has 256 entries with M/X dependent lengths', () => {
    assert.strictEqual(OPCODES.length, 256);
    assert.strictEqual(instructionLength(0xA9, true, true), 2);
    assert.strictEqual(instructionLength(0xA9, false, true), 3);
    assert.strictEqual(instructionLength(0xA2, true, false), 3);
    assert.strictEqual(instructionLength(0x22, true, true), 4);
    assert.strictEqual(instructionLength(0x54, true, true), 3);
    assert.strictEqual(flowKind(0x20), FLOW.CALL);
    assert.strictEqual(flowKind(0xFC), FLOW.CALL | FLOW.INDIRECT);
    assert.strictEqual(flowKind(0xD0), FLOW.BRANCH);
    assert.strictEqual(flowKind(0x60), 0);
});

test('cdl-optable.h in the core matches opcodes.js', () => {
    assert.strictEqual(fs.readFileSync(gen.OUT, 'utf8'), gen.render(), 'run node tools/gen-cdl-optable.js');
});

test('library merges are idempotent and order independent', () => {
    const rom = makeRom();
    const a = new CdlLibrary(path.join(tmp, 'a'), rom);
    const b = new CdlLibrary(path.join(tmp, 'b'), rom);
    const d1 = { chunks: [{ index: 1, cdl: Uint8Array.from([1, 0, 2]), ext: Uint8Array.from([4, 0, 0]) }],
        xrefs: Uint32Array.from([0x808010, 0x4E57, 2]), edges: Uint32Array.from([0x808005, 0x808010, 1]),
        stats: Uint32Array.from([0x808010, 3, 0x4E57, 0x4E60, 2]) };
    const d2 = { xrefs: Uint32Array.from([0x808010, 0x4E57, 8]), stats: Uint32Array.from([0x808010, 5, 0x4E00, 0x4E58, 1]) };
    a.applyDelta(d1); a.applyDelta(d2); a.applyDelta(d1);
    b.applyDelta(d2); b.applyDelta(d1);
    assert.deepStrictEqual([...a.xrefs], [...b.xrefs]);
    assert.strictEqual(a.xrefs.get(0x808010 * 0x4000000 + 0x4E57), 10);
    assert.deepStrictEqual(a.stats.get(0x808010), { count: 5, lo: 0x4E00, hi: 0x4E60, flags: 3 });
    assert.strictEqual(a.cdl[0x10000], 1);
    assert.strictEqual(a.cdl[0x10002], 2);
    assert.strictEqual(a.applyDelta(d1), false, 're-applying a delta changes nothing');
});

test('library flushes atomically and reloads the same data, keyed by ROM hash', () => {
    const rom = makeRom();
    const root = path.join(tmp, 'lib');
    const lib = new CdlLibrary(root, rom, { title: 'T' });
    recordProgram(lib);
    lib.dirty.add('rom.cdl'); lib.dirty.add('rom.ext');
    const written = lib.flush();
    assert.ok(written.includes('rom.cdl') && written.includes('xrefs.bin') && written.includes('edges.bin'));
    assert.strictEqual(path.basename(lib.dir), romHash(rom));
    assert.ok(!fs.readdirSync(lib.dir).some(f => f.endsWith('.tmp')));
    const again = new CdlLibrary(root, rom);
    assert.deepStrictEqual([...again.xrefs], [...lib.xrefs]);
    assert.deepStrictEqual([...again.edges], [...lib.edges]);
    assert.strictEqual(again.cdl[0x8000], lib.cdl[0x8000]);
    const header = new Uint8Array(rom.length + 512);
    header.set(rom, 512);
    assert.strictEqual(romHash(header), romHash(rom), 'copier header does not change the hash');
});

test('disassembler formats operands with explicit sizes Asar accepts', () => {
    const fmt = (bytes, cdl, ext) => {
        const rom = Uint8Array.from(bytes);
        return formatInstruction(decodeAt(rom, 0, cdl, ext), 0xC08000, () => null);
    };
    assert.strictEqual(fmt([0xA9, 0x12], 0x20, 0), 'lda.b #$12');
    assert.strictEqual(fmt([0xA9, 0x34, 0x12], 0, 0x08), 'lda.w #$1234');
    assert.strictEqual(fmt([0x54, 0x7E, 0x7F], 0, 0), 'mvn $7E,$7F');
    assert.strictEqual(fmt([0xDC, 0x34, 0x12], 0, 0), 'jml [$1234]');
    assert.strictEqual(fmt([0xBF, 0x56, 0x34, 0x12], 0, 0), 'lda.l $123456,x');
    assert.strictEqual(fmt([0xB3, 0x12], 0, 0), 'lda.b ($12,s),y');
    assert.strictEqual(fmt([0x0A], 0, 0), 'asl a');
    assert.strictEqual(fmt([0xD0, 0x02], 0, 0), null, 'a branch without a resolvable target is not emitted as text');
    const conflict = decodeAt(Uint8Array.from([0xA9, 1, 2]), 0, 0x20, 0x08);
    assert.strictEqual(conflict.conflict, true);
});

test('Asar export names functions, callers and accesses; reassembles byte-exact', () => {
    const rom = makeRom();
    const lib = new CdlLibrary(path.join(tmp, 'exp'), rom);
    recordProgram(lib);
    const out = path.join(tmp, 'asar');
    const r = exportAsar(lib, rom, out);
    const bank = fs.readFileSync(path.join(out, 'banks', 'bank_C0.asm'), 'utf8');
    assert.ok(bank.includes('func_C08010:'), 'callee label');
    assert.ok(/jsr\.w func_C08010/.test(bank), 'call uses the label');
    assert.ok(bank.includes('; called by: func_C08000+$05 (80:8005)'), 'caller listed');
    assert.ok(bank.includes('[$7E4E57, data_C09000]'), 'runtime accesses listed');
    assert.ok(bank.includes('bra seg_C00000+$8008'), 'unlabelled branch target via segment label');
    assert.ok(bank.includes('data_C09000:') && bank.includes('; read by: func_C08010 (80:8010)'));
    assert.strictEqual(r.functions, 2);
    const asar = process.env.ASAR || path.resolve(ROOT, '..', 'asar', 'asar', 'bin', 'asar');
    if (!fs.existsSync(asar)) { console.log('    (asar not found, round trip skipped)'); return; }
    execFileSync(asar, ['--fix-checksum=off', 'main.asm', 'out.sfc'], { cwd: out, stdio: 'pipe' });
    assert.ok(Buffer.from(rom).equals(fs.readFileSync(path.join(out, 'out.sfc'))), 'reassembled ROM differs');
});

test('WRAM report lists accessors, widths and values', () => {
    const rom = makeRom();
    const lib = new CdlLibrary(path.join(tmp, 'wram'), rom);
    recordProgram(lib);
    lib.mergeWvals(0x4E57 >> 8, (() => {
        const d = new Uint8Array(256 * 32);
        const base = (0x4E57 & 0xFF) * 32;
        d[base] = 0b111;  // values 0, 1, 2
        return d;
    })());
    const r = exportWram(lib, rom, path.join(tmp, 'wram-out'));
    const text = fs.readFileSync(r.file, 'utf8');
    assert.ok(text.includes('!wram_7E4E57 = $7E4E57'), text);
    assert.ok(text.includes('word  W  values {$00,$01,$02}  enum candidate'), text);
    assert.ok(text.includes('W  16     func_C08010 (80:8010)'), text);
});

test('lookup parses addresses and answers who calls / who touches', () => {
    assert.deepStrictEqual(parseQuery('7E4E57'), { space: SPACE.WRAM, addr: 0x4E57 });
    assert.deepStrictEqual(parseQuery('$7F:0010'), { space: SPACE.WRAM, addr: 0x10010 });
    assert.deepStrictEqual(parseQuery('0123'), { space: SPACE.WRAM, addr: 0x123 });
    assert.deepStrictEqual(parseQuery('2118'), { space: SPACE.IO, addr: 0x2118 });
    assert.deepStrictEqual(parseQuery('C0:8000'), { space: SPACE.ROM, bus: 0xC08000 });
    assert.strictEqual(parseQuery('zz'), null);
    const rom = makeRom();
    const lib = new CdlLibrary(path.join(tmp, 'look'), rom);
    recordProgram(lib);
    const map = createRomMap(rom);
    const index = buildIndex(lib, map);
    const wram = lookup(lib, index, map, '7E4E57').join('\n');
    assert.ok(wram.includes('func_C08010 (80:8010)'), wram);
    const code = lookup(lib, index, map, 'C0:8011').join('\n');
    assert.ok(code.includes('in function: func_C08010') && code.includes('func_C08000+$05 (80:8005)'), code);
});

test('host decodes webview deltas (base64 words) into the library', () => {
    const origLoad = Module._load;
    Module._load = function (req, ...rest) {
        if (req === 'vscode') return { workspace: { getConfiguration: () => ({ get: (k, d) => d }) } };
        return origLoad.call(this, req, ...rest);
    };
    try {
        const { CdlHost } = require('../../src/emulator/cdl/host');
        const posted = [];
        const host = new CdlHost(path.join(tmp, 'host'), m => posted.push(m), () => {});
        host.romStarted(makeRom());
        assert.strictEqual(posted[0].command, 'cdlConfig');
        assert.strictEqual(posted[0].autoEnable, false, 'recording is off by default');
        host.handle({ command: 'cdlEnable' });
        const seed = posted.find(m => m.command === 'cdlSeed');
        assert.ok(seed && seed.labels[0] === 'C0' && seed.labels[1] === 'C1');
        const words = Buffer.from(Uint32Array.from([0x808010, 0x4E57, 2]).buffer).toString('base64');
        host.handle({ command: 'cdlDelta', delta: { xrefs: words, chunks: [] } });
        assert.strictEqual(host.lib.xrefs.get(0x808010 * 0x4000000 + 0x4E57), 2);
        const xfile = path.join(host.lib.dir, 'xrefs.bin');
        assert.ok(!fs.existsSync(xfile), 'a delta alone does not touch the disk');
        host.handle({ command: 'cdlPause' });
        assert.ok(fs.existsSync(xfile), 'pausing writes what changed');
        const stamp = fs.statSync(path.join(host.lib.dir, 'manifest.json')).mtimeMs;
        host.handle({ command: 'cdlDelta', delta: { xrefs: words, chunks: [] } });
        host.handle({ command: 'cdlPause' });
        assert.strictEqual(fs.statSync(path.join(host.lib.dir, 'manifest.json')).mtimeMs, stamp, 'nothing new, nothing written');
        host.handle({ command: 'cdlLookup', query: '7E4E57' });
        assert.ok(posted.some(m => m.command === 'cdlLookupResult'));
        host.dispose();
    } finally {
        Module._load = origLoad;
    }
});

test('libraries written before wram.flags / script-xrefs still load and gain them', () => {
    const rom = makeRom();
    const root = path.join(tmp, 'compat');
    const lib = new CdlLibrary(root, rom);
    recordProgram(lib);
    lib.dirty.add('rom.cdl');
    lib.flush();
    fs.rmSync(path.join(lib.dir, 'wram.flags'), { force: true });
    fs.rmSync(path.join(lib.dir, 'script-xrefs.bin'), { force: true });
    const old = new CdlLibrary(root, rom);
    assert.strictEqual(old.xrefs.size, lib.xrefs.size, 'old data kept');
    assert.strictEqual(old.wflags[0x4E57] & 0x0A, 0x0A, 'WRAM map derived from xrefs (written, 16-bit)');
    assert.strictEqual(old.wflags[0x4E58] & 0x02, 0x02, 'high byte of the word too');
    old.applyDelta({ scriptXrefs: Uint32Array.from([0x92A3D2, 0x4E57, 2]), wflags: [{ index: 4, data: new Uint8Array(4096).fill(1) }] });
    assert.deepStrictEqual(old.flush().sort(), ['script-xrefs.bin', 'wram.flags']);
    const again = new CdlLibrary(root, rom);
    assert.strictEqual(again.scriptXrefs.get(0x92A3D2 * 0x20000 + 0x4E57), 2);
    assert.strictEqual(again.wflags[0x4000] & 1, 1);
});

test('script accessors show up in ram.asm and lookup; interpreter found by pattern', () => {
    const rom = makeRom();
    const lib = new CdlLibrary(path.join(tmp, 'scripts'), rom);
    recordProgram(lib);
    lib.mergeScriptXrefs(Uint32Array.from([0x92A3D2, 0x4E57, 2 | 8]));
    const named = s => '$' + s.toString(16).toUpperCase() + ' (Room 0x15 Enter Script)';
    const text = fs.readFileSync(exportWram(lib, rom, path.join(tmp, 'scripts-out'), { describeScript: named }).file, 'utf8');
    assert.ok(text.includes('script W  16     $92A3D2 (Room 0x15 Enter Script)'), text);
    const map = createRomMap(rom);
    const out = lookup(lib, buildIndex(lib, map), map, '7E4E57', { describeScript: named }).join('\n');
    assert.ok(out.includes('script instructions:') && out.includes('$92A3D2'), out);
    const origLoad = Module._load;
    Module._load = function (req, ...rest) { return req === 'vscode' ? {} : origLoad.call(this, req, ...rest); };
    try {
        const { findScriptContext, parseRanges } = require('../../src/emulator/cdl/host');
        const withVm = makeRom();
        withVm.set([0xA7, 0x82, 0xE6, 0x82, 0x29, 0xFF, 0x00, 0x0A, 0xAA, 0xFC, 0xBD, 0xE8], 0xD0A6);
        assert.deepStrictEqual(findScriptContext(withVm), { fetchRomOff: 0xD0A6, ptr: 0x82 });
        assert.strictEqual(findScriptContext(rom), null);
        assert.deepStrictEqual(parseRanges(['0000-01FF', '$7E2834-$7E2FFF', 'junk']), [[0, 0x1FF], [0x2834, 0x2FFF]]);
    } finally {
        Module._load = origLoad;
    }
});

test('webview exposes the CDL tab and its script parses', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src', 'emulator', 'cdl-view.js'), 'utf8');
    assert.ok(!/[^\x09\x0A\x0D\x20-\x7E]/.test(src), 'cdl-view.js must be ASCII');
    const { buildHtml } = require('../../src/emulator/panel-webview');
    const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core');
    assert.ok(html.includes('id="ss-tab-cdl"') && html.includes('id="ss-view-cdl"'));
    assert.ok(html.includes("'cdl', 'debug'"), 'selectTab knows the cdl tab');
    assert.ok(html.includes('id="cdl-float-layer"'), 'floating coverage text layer');
    assert.ok(html.includes('cdlOnPauseChanged(paused)'), 'frame loop reports pause changes');
    for (const f of ['cdl-float.js', 'cdl-strips.js']) {
        const text = fs.readFileSync(path.join(ROOT, 'src', 'emulator', f), 'utf8');
        assert.ok(!/[^\x09\x0A\x0D\x20-\x7E]/.test(text), f + ' must be ASCII');
    }
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Function(m[1]);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
