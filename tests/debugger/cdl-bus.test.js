'use strict';

/**
 * CDL bus-form and cycle streams: library merge / reload, the report for ExHiROM and SA-1,
 * and (when a local Secret of Evermore ROM is found) the real core recording them.
 * ROM: the Evermore ROM of the ROM library (npm run roms). The ROM is only read, never copied.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const { CdlLibrary } = require('../../src/platform/cdl/library');
const { createRomMap } = require('../../src/platform/cdl/rom-map');
const { busSitesList, BUS } = require('../../src/platform/cdl/library-ext');
const { buildBusReport, busReportMd } = require('../../src/platform/cdl/bus-report');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  [PASS] ${name}`); passed++; }
    catch (e) { console.error(`  [FAIL] ${name}\n    ${e.stack || e.message}`); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-cdl-bus-'));

function makeRom() {
    const rom = new Uint8Array(0x20000);
    rom.set(Buffer.from('BUS TEST'.padEnd(21, ' ')), 0xFFC0);
    rom[0xFFD5] = 0x21;
    rom.set([0xFF, 0xFF, 0x00, 0x00], 0xFFDC);
    return rom;
}

const sitesDelta = (...rows) => Uint32Array.from(rows.flat());
const idx = bit => ({ 1: 0, 2: 1, 4: 2, 8: 3 })[bit];

console.log('CDL bus / cycles tests:');

test('bus forms OR together, sites take min/max, cycles sum', () => {
    const lib = new CdlLibrary(path.join(tmp, 'a'), makeRom());
    const chunk = new Uint8Array(0x10000);
    chunk[0x8000] = BUS.B8;                  // executed through $80-$BF
    chunk[0x9000] = BUS.B0 << 4;             // read through $00-$3F
    lib.applyDelta({ bus: [{ index: 0, data: chunk }] });
    const more = new Uint8Array(0x10000);
    more[0x8000] = BUS.C;                    // later also executed through $C0-$FF
    lib.applyDelta({ bus: [{ index: 0, data: more }] });
    assert.strictEqual(lib.bus[0x8000], BUS.B8 | BUS.C);
    assert.strictEqual(lib.bus[0x9000], BUS.B0 << 4);

    const k = (idx(BUS.B0) << 24) | 0x808585;
    lib.applyDelta({ busSites: sitesDelta([k, 1, 0x00FFEA, 0x00FFEB]) });
    lib.applyDelta({ busSites: sitesDelta([k, 0x20, 0x00FFE0, 0x00FFE8]) });
    const sites = busSitesList(lib);
    assert.strictEqual(sites.length, 1);
    assert.deepStrictEqual([sites[0].pc, sites[0].formBit, sites[0].flags, sites[0].lo, sites[0].hi], [0x808585, BUS.B0, 0x21, 0x00FFE0, 0x00FFEB]);

    lib.applyDelta({ romCycles: Uint32Array.from([0x8000, 10]) });
    lib.applyDelta({ romCycles: Uint32Array.from([0x8000, 5, 0x8004, 7]) });
    assert.strictEqual(lib.romCycles[0x8000], 15);
    assert.strictEqual(lib.romCycles[0x8004], 7);
});

test('the streams survive a flush and reload without double counting', () => {
    const root = path.join(tmp, 'b');
    const rom = makeRom();
    const lib = new CdlLibrary(root, rom);
    const chunk = new Uint8Array(0x10000);
    chunk[0x8010] = BUS.B4;
    lib.applyDelta({ bus: [{ index: 0, data: chunk }], busSites: sitesDelta([(3 << 24) | 0x808000, 0, 0x400000, 0x400010]), romCycles: Uint32Array.from([0x8010, 40]) });
    lib.flush();
    for (const f of ['bus.cdl', 'bus-sites.bin', 'rom-cycles.bin']) assert.ok(fs.existsSync(path.join(lib.dir, f)), f);
    const again = new CdlLibrary(root, rom);
    assert.strictEqual(again.bus[0x8010], BUS.B4);
    assert.strictEqual(again.romCycles[0x8010], 40, 'a reload assigns the stored total');
    assert.deepStrictEqual(busSitesList(again).map(s => [s.pc, s.formBit, s.lo, s.hi]), [[0x808000, BUS.B4, 0x400000, 0x400010]]);
    again.applyDelta({ romCycles: Uint32Array.from([0x8010, 2]) });
    assert.strictEqual(again.romCycles[0x8010], 42);
});

test('older libraries without the streams still load', () => {
    const root = path.join(tmp, 'c');
    const rom = makeRom();
    new CdlLibrary(root, rom).flush();
    const lib = new CdlLibrary(root, rom);
    assert.strictEqual(lib.bus.length, rom.length);
    assert.strictEqual(busSitesList(lib).length, 0);
});

test('the report separates ExHiROM breakers from SA-1 breakers', () => {
    const rom = makeRom();
    const lib = new CdlLibrary(path.join(tmp, 'd'), rom);
    const chunk = new Uint8Array(0x10000);
    chunk[0x8000] = BUS.B8;                  // 80-BF only: fine for ExHiROM, breaks SA-1
    chunk[0x8100] = BUS.B0;                  // 00-3F: breaks both
    lib.applyDelta({ bus: [{ index: 0, data: chunk }], busSites: sitesDelta([(idx(BUS.B8) << 24) | 0x808000, 1, 0x808000, 0x808010]) });
    lib.applyDelta({ busSites: sitesDelta([(idx(BUS.B0) << 24) | 0x808585, 1, 0x00FFEA, 0x00FFEA]) });
    lib.edges.set(0x808000 * 0x1000000 + 0x008000, 1);   // a call into $00:8000
    const fns = [{ name: 'f', bus: 0xC08000, cycles: 100, execCount: 4, sa1: { transitiveBlockers: ['wram'] } }];
    const r = buildBusReport(lib, createRomMap(rom), fns);
    assert.strictEqual(r.exhirom.executedBytes, 1);
    assert.strictEqual(r.sa1.executedBytes, 2);
    assert.deepStrictEqual(r.exhirom.readSites.map(s => s.pc), ['$808585']);
    assert.strictEqual(r.sa1.readSites.length, 2);
    assert.strictEqual(r.exhirom.edgesInto.length, 1);
    assert.strictEqual(r.cycles.functions[0].cyclesPerCall, 25);
    const md = busReportMd(r);
    assert.ok(/ExHiROM audit/.test(md) && /SA-1 audit/.test(md) && /\$808585/.test(md));
});

// ---- the real core ----------------------------------------------------------------------
function findRom() {
    const cands = [require('../../dist/games').romPath('evermore')].filter(Boolean);
    return cands.find(p => fs.existsSync(p));
}

test('the core records mirror forms, mirror read sites and per-frame cycles', function () {
    const romPath = findRom();
    const core = path.join(ROOT, 'src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
    if (!romPath || !fs.existsSync(core)) { console.log('    (skipped: no local ROM or built core)'); return; }
    // The core's Emscripten glue runs in this process; run it in a child so a failure cannot hang the suite.
    const script = `
        const fs=require('fs'),path=require('path'),vm=require('vm');
        const CORE=${JSON.stringify(core)};
        global.Module={locateFile:f=>path.join(path.dirname(CORE),f),onRuntimeInitialized:main};
        global.require=require;global.__dirname=path.dirname(CORE);global.__filename=CORE;
        vm.runInThisContext(fs.readFileSync(CORE,'utf8'),{filename:CORE});
        function main(){
            const M=Module;let rom=fs.readFileSync(${JSON.stringify(romPath)});
            if(rom.length%0x8000===0x200)rom=rom.subarray(0x200);
            const p=M._my_malloc(rom.length);HEAPU8.set(rom,p);M._startWithRom(p,rom.length,32040);
            if(!M.cdlEnable()){console.log(JSON.stringify({error:'enable'}));process.exit(0);}
            const frames=900;
            for(let i=0;i<frames;i++){M._setJoypadInput(i%60<5?0x1000:0);M._mainLoop();}
            const d=M.cdlDrain();
            let exec=0,exec8=0,read8=0;
            for(const c of d.bus)for(const v of c.data){if(v&15)exec++;if(v&2)exec8++;if(v&32)read8++;}
            let cyc=0;for(let i=1;i<d.romCycles.length;i+=2)cyc+=d.romCycles[i];
            console.log(JSON.stringify({exec,exec8,read8,sites:d.busSites.length/4,cyclesPerFrame:cyc/frames}));
            process.exit(0);
        }`;
    const scriptFile = path.join(tmp, 'headless.js');
    fs.writeFileSync(scriptFile, script);
    let out;
    try {
        out = require('child_process').execFileSync(process.execPath, [scriptFile], { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        throw new Error('headless run failed: ' + String(e.stderr || e.message).slice(-600));
    }
    const r = JSON.parse(out.trim().split('\n').pop());
    assert.ok(!r.error, 'cdlEnable failed');
    assert.ok(r.exec > 1000, 'executed bytes carry a bus form');
    assert.ok(r.exec8 > 0, 'SoE runs code through $80-$BF');
    assert.ok(r.read8 > 0, 'SoE reads data through $80-$BF');
    assert.ok(r.sites > 0, 'read sites are recorded');
    // one NTSC frame is 262 scanlines of 1364 master cycles = 357,368; instruction gaps must add up to about that
    assert.ok(r.cyclesPerFrame > 300000 && r.cyclesPerFrame < 420000, 'cycles per frame ' + r.cyclesPerFrame);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
