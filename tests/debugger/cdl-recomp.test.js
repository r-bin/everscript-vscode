'use strict';

/**
 * CDL recomp / decomp data: library streams (rets, regs, bases, WRAM code, ARAM),
 * snesrecomp directives, tables as assets, structs, enums, functions.json.
 * One synthetic HiROM program exercises all of them; the Asar round trip runs
 * when a local asar binary is found (ASAR env var or ../asar/asar/bin/asar).
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const { CdlLibrary } = require('../../dist/platform/cdl/library');
const { exportAsar } = require('../../src/games/evermore/cdl/tools');
const { createRomMap } = require('../../dist/platform/cdl/rom-map');
const { buildIndex, SPACE } = require('../../dist/platform/cdl/xref-index');
const { inferStructs } = require('../../dist/platform/cdl/structs');
const { buildEnums } = require('../../dist/platform/cdl/enums');
const { buildFunctions } = require('../../dist/platform/cdl/functions');
const { lookup } = require('../../dist/platform/cdl/lookup');

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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-cdl-recomp-'));
const R = 0x01, W = 0x02, BYTE = 0x04, WORD = 0x08;
const CALL = 1, JUMP = 2, INDIRECT = 8, RETURN = 0x20;

// 128 KB HiROM, program at C0:8000 (runs as 80:xxxx)
//   8000 C2 30      rep #$30
//   8002 20 10 80   jsr $8010            ; returns with A 8-bit
//   8005 FC 00 A0   jsr ($A000,x)        ; dispatch through the table at $A000
//   8008 D4 10      pei ($10)
//   800A 60         rts                  ; PEI;RTS dispatch -> $8070
//   8010 8D 00 21   sta $2100            ; PPU register
//   8013 E2 20      sep #$20
//   8015 60         rts
//   8020 60 / 8030 60                    ; handlers
//   8040 AD 50 00   lda $0050 / 8043 0A asl / 8044 AA tax / 8045 FC 00 A0 jsr ($A000,x)
//   8048 6C 00 01   jmp ($0100)          ; pointer jump -> $8060
//   8050 BD 10 00   lda $0010,x / 8053 BD 12 00 lda $0012,x / 8056 60 rts
//   8058 BF 00 B0 C0 lda.l $C0B000,x / 805C 8D 20 00 sta $0020 / 805F 60 rts
//   8060 22 00 02 7E jsl $7E0200 / 8064 60 rts
//   8070 60
//   A000 dw $8020, $8030                 ; dispatch table
//   B000 dw 10, 20, 35, 50, 80, 120, 200, 300   ; level curve
function makeRom() {
    const rom = new Uint8Array(0x20000);
    const put = (off, bytes) => rom.set(bytes, off);
    put(0x8000, [0xC2, 0x30, 0x20, 0x10, 0x80, 0xFC, 0x00, 0xA0, 0xD4, 0x10, 0x60]);
    put(0x8010, [0x8D, 0x00, 0x21, 0xE2, 0x20, 0x60]);
    put(0x8020, [0x60]);
    put(0x8030, [0x60]);
    put(0x8040, [0xAD, 0x50, 0x00, 0x0A, 0xAA, 0xFC, 0x00, 0xA0, 0x6C, 0x00, 0x01]);
    put(0x8050, [0xBD, 0x10, 0x00, 0xBD, 0x12, 0x00, 0x60, 0x00, 0xBF, 0x00, 0xB0, 0xC0, 0x8D, 0x20, 0x00, 0x60]);
    put(0x8060, [0x22, 0x00, 0x02, 0x7E, 0x60]);
    put(0x8070, [0x60]);
    put(0xA000, [0x20, 0x80, 0x30, 0x80]);
    [10, 20, 35, 50, 80, 120, 200, 300].forEach((v, i) => put(0xB000 + i * 2, [v & 0xFF, v >> 8]));
    rom.set(Buffer.from('CDL RECOMP TEST'.padEnd(21, ' ')), 0xFFC0);
    rom[0xFFD5] = 0x21;
    rom.set([0xFF, 0xFF, 0x00, 0x00], 0xFFDC);
    return rom;
}

function record(lib) {
    const ins = (off, len, opts = {}) => {
        lib.cdl[off] |= 0x01 | (opts.sub ? 0x08 : 0) | (opts.m8 ? 0x20 : 0);
        lib.ext[off] |= 0x04 | (opts.m8 ? 0 : 0x08) | 0x10;
        for (let i = 1; i < len; i++) lib.cdl[off + i] |= 0x01;
    };
    ins(0x8000, 2, { sub: true }); ins(0x8002, 3); ins(0x8005, 3); ins(0x8008, 2); ins(0x800A, 1);
    ins(0x8010, 3, { sub: true }); ins(0x8013, 2); ins(0x8015, 1, { m8: true });
    ins(0x8020, 1, { sub: true }); ins(0x8030, 1, { sub: true });
    ins(0x8040, 3, { sub: true }); ins(0x8043, 1); ins(0x8044, 1); ins(0x8045, 3); ins(0x8048, 3);
    ins(0x8050, 3, { sub: true }); ins(0x8053, 3); ins(0x8056, 1);
    ins(0x8058, 4, { sub: true }); ins(0x805C, 3); ins(0x805F, 1);
    ins(0x8060, 4); ins(0x8064, 1); ins(0x8070, 1);
    for (let i = 0; i < 4; i++) lib.cdl[0xA000 + i] |= 0x02;
    for (let i = 0; i < 16; i++) lib.cdl[0xB000 + i] |= 0x02;
    const wram = a => (SPACE.WRAM << 24) | a, romA = o => (SPACE.ROM << 24) | o, io = a => (SPACE.IO << 24) | a;
    lib.applyDelta({
        edges: Uint32Array.from([
            0x808002, 0x808010, CALL,
            0x808005, 0x808020, CALL | INDIRECT, 0x808005, 0x808030, CALL | INDIRECT,
            0x808045, 0x808030, CALL | INDIRECT,
            0x80800A, 0x808070, RETURN,
            0x808048, 0x808060, JUMP | INDIRECT,
            0x808060, 0x7E0200, CALL,
            0x808000, 0x808040, CALL, 0x808000, 0x808050, CALL, 0x808000, 0x808058, CALL,
        ]),
        xrefs: Uint32Array.from([
            0x808010, io(0x2100), W | WORD,
            0x808040, wram(0x50), R | WORD,
            0x808050, wram(0x3010), R | WORD, 0x808050, wram(0x3090), R | WORD, 0x808050, wram(0x3110), R | WORD,
            0x808053, wram(0x3012), R | BYTE, 0x808053, wram(0x3092), R | BYTE, 0x808053, wram(0x3112), R | BYTE,
            0x808058, romA(0xB000), R | WORD, 0x808058, romA(0xB002), R | WORD, 0x808058, romA(0xB006), R | WORD, 0x808058, romA(0xB00E), R | WORD,
            0x80805C, wram(0x20), W | WORD,
        ]),
        // entry 808010 entered M16X16, left M8X16; 7E0200 entered M8X8
        rets: Uint32Array.from([0x808010, 0x808015, (0x4 << 8) | 1, 0x7E0200, 0x7E0202, (0x3 << 8) | 1]),
        regs: Uint32Array.from([0x808050, (0 << 16) | 0x7E, 0x808053, (0 << 16) | 0x7E, 0x808050, (1 << 16) | 0]),
        wcode: [{ index: 0, code: (() => { const c = new Uint8Array(4096); c.set([0xA9, 0x01, 0x6B], 0x200); return c; })(),
            state: (() => { const s = new Uint8Array(4096); s.fill(1, 0x200, 0x203); return s; })() }],
        aram: [{ index: 0, data: (() => { const a = new Uint8Array(4096); a[0x200] = 1; a[0x201] = 2; a[0x300] = 8; return a; })() }],
    });
    // values written to the state variable $0050
    lib.mergeWvals(0, (() => { const v = new Uint8Array(256 * 32); v[0x50 * 32] = 0b11; return v; })());
}

console.log('CDL recomp / decomp tests:');

test('new library streams merge order-independently and survive a flush', () => {
    const rom = makeRom();
    const a = new CdlLibrary(path.join(tmp, 'a'), rom), b = new CdlLibrary(path.join(tmp, 'b'), rom);
    const d1 = { rets: Uint32Array.from([0x808010, 0x808015, 0x401]), regs: Uint32Array.from([0x808050, 0x7E]),
        bases: Uint32Array.from([0x808050, 0x7E3000, 1]) };
    const d2 = { rets: Uint32Array.from([0x808010, 0x808015, 0x402]), bases: Uint32Array.from([0x808050, 0x7E3000, 2]),
        aram: [{ index: 1, data: Uint8Array.from([4, 8]) }] };
    a.applyDelta(d1); a.applyDelta(d2); b.applyDelta(d2); b.applyDelta(d1); b.applyDelta(d1);
    assert.deepStrictEqual([...a.rets], [...b.rets]);
    assert.deepStrictEqual([...a.bases], [...b.bases]);
    assert.strictEqual([...a.rets.values()][0], 3, 'flags OR-merge');
    assert.strictEqual(a.aram[2], 4);
    a.flush();
    const again = new CdlLibrary(path.join(tmp, 'a'), rom);
    assert.deepStrictEqual([...again.rets], [...a.rets]);
    assert.deepStrictEqual([...again.regs], [...a.regs]);
    assert.deepStrictEqual([...again.bases], [...a.bases]);
    assert.strictEqual(again.aram[3], 8);
});

test('WRAM code keeps the first bytes and flags a change', () => {
    const lib = new CdlLibrary(path.join(tmp, 'wcode'), makeRom());
    const chunk = (b) => [{ index: 0, code: Uint8Array.from([b]), state: Uint8Array.from([1]) }];
    lib.applyDelta({ wcode: chunk(0xA9) });
    lib.applyDelta({ wcode: chunk(0xA9) });
    assert.strictEqual(lib.wcodeState[0], 1);
    lib.applyDelta({ wcode: chunk(0xEA) });
    assert.strictEqual(lib.wcode[0], 0xA9);
    assert.strictEqual(lib.wcodeState[0], 3, 'seen + changed');
});

const rom = makeRom();
const lib = new CdlLibrary(path.join(tmp, 'prog'), rom);
record(lib);
const out = path.join(tmp, 'export');
exportAsar(lib, rom, out);
const cfg = fs.readFileSync(path.join(out, 'recomp', 'cfg', 'bank80.cfg'), 'utf8');
const cfg0 = fs.readFileSync(path.join(out, 'recomp', 'cfg', 'bank00.cfg'), 'utf8');

test('snesrecomp: exit widths, jump table, PEI;RTS, pointer jump, WRAM routine', () => {
    assert.ok(/^func func_C08010 8010 entry_mx:0,0 exit_mx:1,0/m.test(cfg), 'exit_mx from the recorded return\n' + cfg);
    assert.ok(/^indirect_dispatch 8005 2 idx:X/m.test(cfg), 'table entries up to the highest observed target');
    assert.ok(/^indirect_dispatch 8045 2 idx:X/m.test(cfg), 'second site on the same table');
    assert.ok(/^indirect_dispatch 8008 1 rtsstack targets:808070/m.test(cfg), 'site is the PEI');
    assert.ok(/^indirect_dispatch 8048 1 ptrtail targets:8060/m.test(cfg), 'jmp (abs) with 16-bit targets');
    assert.ok(/^ram_routine 7e0200 M1X1 A9016B$/m.test(cfg0), 'WRAM routine with its bytes\n' + cfg0);
});

test('lookup tables become assets; the build stays byte-exact', () => {
    const asset = fs.readFileSync(path.join(out, 'tables', 'tbl_C0B000.asm'), 'utf8');
    assert.ok(asset.includes('dw $012C    ; 7'), 'one entry per line');
    assert.ok(asset.includes('; index:  ') || asset.includes('; result: sta $7E0020'));
    const bank = fs.readFileSync(path.join(out, 'banks', 'bank_C0.asm'), 'utf8');
    assert.ok(bank.includes('incsrc "tables/tbl_C0B000.asm"'));
    assert.ok(bank.includes('lda.l tbl_C0B000,x'), 'the reader names the table');
    const json = JSON.parse(fs.readFileSync(path.join(out, 'tables', 'tables.json'), 'utf8'));
    assert.deepStrictEqual(json.find(t => t.name === 'tbl_C0B000').values.map(v => v[0]), [10, 20, 35, 50, 80, 120, 200, 300]);
    assert.ok(fs.readFileSync(path.join(out, 'tables', 'tables.h'), 'utf8').includes('static const uint16_t tbl_C0B000[8]'));
    assert.ok(fs.readFileSync(path.join(out, 'main.asm'), 'utf8').includes('incsrc "enums.asm"'));
    const asar = process.env.ASAR || path.resolve(ROOT, '..', 'asar', 'asar', 'bin', 'asar');
    if (!fs.existsSync(asar)) { console.log('    (asar not found, round trip skipped)'); return; }
    execFileSync(asar, ['--fix-checksum=off', 'main.asm', 'out.sfc'], { cwd: out, stdio: 'pipe' });
    assert.ok(Buffer.from(rom).equals(fs.readFileSync(path.join(out, 'out.sfc'))), 'reassembled ROM differs');
    // editing a value in the asset changes exactly that value
    fs.writeFileSync(path.join(out, 'tables', 'tbl_C0B000.asm'), asset.replace('dw $012C    ; 7', 'dw $03E7    ; 7'));
    execFileSync(asar, ['--fix-checksum=off', 'main.asm', 'edit.sfc'], { cwd: out, stdio: 'pipe' });
    const edited = fs.readFileSync(path.join(out, 'edit.sfc'));
    assert.strictEqual(edited[0xB00E] | (edited[0xB00F] << 8), 999);
    edited[0xB00E] = rom[0xB00E]; edited[0xB00F] = rom[0xB00F];
    assert.ok(Buffer.from(rom).equals(edited), 'nothing else moved');
});

const map = createRomMap(rom);
const index = buildIndex(lib, map);

test('structs from indexed accesses: instances, stride, fields', () => {
    const s = inferStructs(lib, rom, map, index).find(x => x.name === 'struct_7E3000');
    assert.ok(s, 'struct found');
    assert.deepStrictEqual(s.instances, [0x3000, 0x3080, 0x3100]);
    assert.strictEqual(s.stride, 0x80);
    assert.deepStrictEqual(s.fields.map(f => [f.offset, f.width]), [[0x10, 2], [0x12, 1]]);
    assert.ok(fs.readFileSync(path.join(out, 'structs.h'), 'utf8').includes('} struct_7E3000_t;'));
});

test('enums: a state variable names the handler of each value', () => {
    const e = buildEnums(lib, rom).find(x => x.addr === 0x7E0050);
    assert.ok(e && e.kind === 'state', JSON.stringify(e));
    assert.deepStrictEqual(e.values.map(v => v.handler), ['func_C08020', 'func_C08030']);
    assert.ok(fs.readFileSync(path.join(out, 'enums.asm'), 'utf8').includes('!enum_7E0050_01 = $01'));
});

test('functions.json: widths, footprint and transitive SA-1 blockers', () => {
    const { list } = buildFunctions(lib, rom, map, index, []);
    const by = n => list.find(f => f.name === n);
    assert.deepStrictEqual(by('func_C08010').sa1.blockers, ['ppu']);
    assert.deepStrictEqual(by('func_C08010').widths, { M0X0: ['M1X0'] });
    assert.ok(by('func_C08000').sa1.transitiveBlockers.includes('ppu'), 'caller inherits the callee blocker');
    assert.deepStrictEqual(by('func_C08050').sa1.blockers, ['wram']);
    assert.ok(by('func_C08050').db.includes('$7E'));
    assert.ok(fs.existsSync(path.join(out, 'functions.json')));
    assert.ok(fs.existsSync(path.join(out, 'spc', 'aram.cdl')));
});

test('lookup shows registers, exit widths and table membership', () => {
    const lines = lookup(lib, index, map, '80:8050', {}).join('\n');
    assert.ok(lines.includes('DB $7E'), lines);
    const fnLines = lookup(lib, index, map, '80:8010', {}).join('\n');
    assert.ok(fnLines.includes('M0X0 -> M1X0'), fnLines);
});

test('curated names + Mesen2 files: labels, comments, CDLv2 header, still byte-identical', () => {
    const { crc32 } = require('../../dist/platform');
    const named = path.join(tmp, 'named');
    exportAsar(lib, rom, named, {
        names: new Map([[0x8010, { name: 'set_screen', note: 'Writes INIDISP' }]]),
        wramNames: new Map([[0x3000, { name: 'actor_table', note: 'records', size: 0x180 }]]),
        assets: [{ start: 0x9000, end: 0x9010, name: 'Test asset' }],
    });
    const bank = fs.readFileSync(path.join(named, 'banks', 'bank_C0.asm'), 'utf8');
    assert.ok(/^set_screen:$/m.test(bank) && bank.includes('; Writes INIDISP'), 'named label + description');
    assert.ok(/jsr(\.w)? set_screen/.test(bank), 'callers use the name');
    assert.ok(/^func set_screen 8010 /m.test(fs.readFileSync(path.join(named, 'recomp', 'cfg', 'bank80.cfg'), 'utf8')), 'snesrecomp seed uses the name');
    const mlb = fs.readFileSync(path.join(named, 'mesen', 'labels.mlb'), 'utf8');
    assert.ok(mlb.includes('SnesPrgRom:8010:set_screen:Writes INIDISP'), mlb);
    assert.ok(mlb.includes('SnesWorkRam:3000-317F:actor_table:records'), mlb);
    assert.ok(mlb.includes('SnesPrgRom:9000::asset: Test asset (16 bytes)'), mlb);
    const cdl = fs.readFileSync(path.join(named, 'mesen', 'rom.cdl'));
    assert.strictEqual(cdl.toString('ascii', 0, 5), 'CDLv2');
    assert.strictEqual(cdl.readUInt32LE(5), crc32(rom));
    assert.strictEqual(cdl.length, 9 + rom.length);
    assert.strictEqual(cdl[9 + 0x9000] & 0x02, 0x02, 'asset bytes marked data');
    const asar = process.env.ASAR || path.resolve(ROOT, '..', 'asar', 'asar', 'bin', 'asar');
    if (fs.existsSync(asar)) {
        execFileSync(asar, ['--fix-checksum=off', 'main.asm', 'out.sfc'], { cwd: named, stdio: 'pipe' });
        assert.ok(Buffer.from(rom).equals(fs.readFileSync(path.join(named, 'out.sfc'))), 'named export still reassembles byte-identical');
    }
});

test('crc32 matches the standard check value', () => {
    const { crc32 } = require('../../dist/platform');
    assert.strictEqual(crc32(Buffer.from('123456789')), 0xCBF43926);
});

test('host seeds: bank cfgs replaced, bank00 keeps its block and gains one data-region block', () => {
    const { applySeeds } = require('../../tools/recomp/host');
    const proj = path.join(tmp, 'hostproj'), seeds = path.join(tmp, 'hostseeds');
    fs.mkdirSync(path.join(proj, 'recomp'), { recursive: true });
    fs.mkdirSync(seeds, { recursive: true });
    fs.writeFileSync(path.join(proj, 'recomp', 'bank00.cfg'), 'bank = 0\nauto_vectors\n');
    fs.writeFileSync(path.join(proj, 'recomp', 'bank8f.cfg'), 'stale\n');
    fs.writeFileSync(path.join(seeds, 'bank00.cfg'), 'bank = 00\nfunc x 8000\ndata_region c0 0000 08000\n');
    fs.writeFileSync(path.join(seeds, 'bank80.cfg'), 'bank = 80\nfunc random_number_generator 859b\n');
    applySeeds(seeds, proj);
    const r = applySeeds(seeds, proj);
    const b00 = fs.readFileSync(path.join(proj, 'recomp', 'bank00.cfg'), 'utf8');
    assert.deepStrictEqual(r, { banks: 1, regions: 1 });
    assert.ok(b00.startsWith('bank = 0\nauto_vectors\n'), 'project block kept');
    assert.strictEqual((b00.match(/^data_region/gm) || []).length, 1, 'idempotent');
    assert.ok(!/func x/.test(b00), 'our bank00 funcs are not copied');
    assert.ok(!fs.existsSync(path.join(proj, 'recomp', 'bank8f.cfg')), 'stale bank removed');
    assert.ok(fs.readFileSync(path.join(proj, 'recomp', 'bank80.cfg'), 'utf8').includes('random_number_generator'));
});

test('host main.c hook: after_config field + declaration, idempotent, refuses an unknown layout', () => {
    const { hookMain } = require('../../tools/recomp/host');
    const proj = path.join(tmp, 'hookproj');
    fs.mkdirSync(path.join(proj, 'src'), { recursive: true });
    const main = '#include "host_main.h"\n#include "game_rtl.h"\n\nstatic const SnesDesktopHostGame kGameHost = {\n    .display_name = "x",\n};\n';
    fs.writeFileSync(path.join(proj, 'src', 'main.c'), main);
    assert.deepStrictEqual(hookMain(proj), { ok: true, patched: true });
    assert.deepStrictEqual(hookMain(proj), { ok: true, patched: false });
    const out = fs.readFileSync(path.join(proj, 'src', 'main.c'), 'utf8');
    assert.strictEqual((out.match(/\.after_config\s*= SoeAfterConfig/g) || []).length, 1);
    assert.ok(out.includes('void SoeAfterConfig(void);'));
    fs.writeFileSync(path.join(proj, 'src', 'main.c'), 'int main(void) { return 0; }\n');
    assert.strictEqual(hookMain(proj).ok, false);
});

test('host package: rebuild replaces the game but keeps saves and settings', () => {
    const { packageGame, platformTag } = require('../../tools/recomp/host');
    const proj = path.join(tmp, 'pkgproj'), out = path.join(tmp, 'pkgout');
    const exe = 'SecretOfEvermoreSNESRecomp' + (process.platform === 'win32' ? '.exe' : '');
    fs.mkdirSync(path.join(proj, 'build', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(proj, 'build', exe), 'v1');
    fs.writeFileSync(path.join(proj, 'build', 'assets', 'font.bin'), 'f');
    const first = packageGame({ project: proj, out, romPath: '/roms/soe.smc' });
    assert.ok(first.ok && first.dir.endsWith('SecretOfEvermore-' + platformTag()));
    fs.mkdirSync(path.join(first.dir, 'saves'));
    fs.writeFileSync(path.join(first.dir, 'saves', 'save.srm'), 'progress');
    fs.writeFileSync(path.join(first.dir, 'config.ini'), 'mine');
    fs.writeFileSync(path.join(proj, 'build', exe), 'v2');
    packageGame({ project: proj, out, romPath: '/roms/soe.smc' });
    assert.strictEqual(fs.readFileSync(first.exe, 'utf8'), 'v2', 'game replaced');
    assert.strictEqual(fs.readFileSync(path.join(first.dir, 'saves', 'save.srm'), 'utf8'), 'progress', 'save kept');
    assert.strictEqual(fs.readFileSync(path.join(first.dir, 'config.ini'), 'utf8'), 'mine', 'settings kept');
    assert.ok(fs.readFileSync(first.script, 'utf8').includes('/roms/soe.smc'));
});

test('dispatch table size: static scan past the observed entries, stops at a data read, allows a sibling dispatcher', () => {
    const { staticTableCount } = require('../../dist/platform/cdl/recomp-analysis');
    // bank $8F mapped flat for the test: bus $8Fxxxx -> offset xxxx
    const map = { busToRom: b => ((b >>> 16) === 0x8F ? b & 0xFFFF : -1) };
    const rom = new Uint8Array(0x10000), cdl = new Uint8Array(0x10000);
    const put = (o, w) => { rom[o] = w & 0xFF; rom[o + 1] = w >> 8; };
    for (let k = 0; k < 16; k++) put(0xA3D8 + k * 2, 0x9E00 + k * 8);   // 16 code pointers
    put(0xA3F8, 0x0102);                                                   // next table: small values
    rom[0x9F46] = 0x7C; rom[0x9ECA] = 0x7C; rom[0x9F4B] = 0xBF;            // two dispatchers + one lda long,x
    const key = (pc, off) => pc * 0x4000000 + ((1 << 24) | off);
    const xrefs = new Map();
    for (let k = 0; k < 8; k++) xrefs.set(key(0x8F9F46, 0xA3D8 + k * 2), 1);
    for (let k = 8; k < 16; k++) xrefs.set(key(0x8F9ECA, 0xA3D8 + k * 2), 1);   // sibling dispatcher
    xrefs.set(key(0x8F9F4B, 0xA3F8), 1);                                       // data read: next table
    const readers = new Map();
    for (const k of xrefs.keys()) { const pc = Math.floor(k / 0x4000000), off = k % 0x4000000 & 0xFFFFFF; (readers.get(off) || readers.set(off, new Set()).get(off)).add(pc); }
    const lib = { cdl, xrefs };
    assert.strictEqual(staticTableCount({ lib, rom, map, bank: 0x8F, base: 0xA3D8, observed: 8, site: 0x8F9F46, readers }), 16);
    cdl[0xA3E8] = 0x01;   // an executed byte inside the table ends it
    assert.strictEqual(staticTableCount({ lib, rom, map, bank: 0x8F, base: 0xA3D8, observed: 8, site: 0x8F9F46, readers }), 8);
});

test('recomp names: every knowledge entry becomes one valid, unique identifier', () => {
    const { collectNames } = require('../../tools/recomp/names');
    const { names, wramNames, counts } = collectNames({ busToRom: (b) => b & 0x3FFFFF }, 0x400000);
    assert.ok(counts.functions > 100 && counts.tables > 20 && counts.wram > 50, JSON.stringify(counts));
    for (const group of [names, wramNames]) {
        const seen = new Set();
        for (const { name } of group.values()) {
            assert.ok(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name), 'not an identifier: ' + name);
            assert.ok(!seen.has(name), 'duplicate name: ' + name);
            seen.add(name);
        }
    }
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
