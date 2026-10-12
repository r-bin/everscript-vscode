#!/usr/bin/env node
'use strict';

// Lockstep check: run the ROM in our snes9x core and in a snesrecomp build without input, align
// both on the NMI frame counter ($7E0100), and compare WRAM at the same counter values.
// The recomp's RNG state ($0133-$013A) is set to snes9x's value first, because the reset handler
// seeds it from the PPU H/V counters, which differ between any two emulators.
//   node tools/recomp/lockstep.js --rom <clean rom> [--exe <recomp executable, default: the one npm run recomp built>] [--from 295 --to 479 --step 10]

const fs = require('fs');
const os = require('os');
const vm = require('vm');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const CORE = path.join(REPO, 'src/emulator/core/snes9x2005-wasm-vanilla/snes9x_2005.js');
const STATE_WRAM = 0x10c14;          // WRAM offset inside this core's save state
const SYNC_AT = 115;                 // counter at which the RNG is copied into the recomp
const RNG = [0x133, 0x13B];
// Bytes that differ for timing reasons only: DP scratch, scroll shadows mid-update, stack slots.
const NOISE = new Set([...range(0x02, 0x0F), ...range(0x10E, 0x115), 0x1FEE, 0x1FF4]);

function range(a, b) { const r = []; for (let i = a; i < b; i++) r.push(i); return r; }

function args(argv) {
    const o = { from: 295, to: 479, step: 10 };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i].replace(/^--/, ''), v = argv[++i];
        o[k] = ['from', 'to', 'step'].includes(k) ? Number(v) : v;
    }
    o.rom = o.rom || process.env.SOE_ROM;
    const { platformTag } = require('./host');
    o.exe = o.exe || process.env.SOE_RECOMP_EXE
        || path.join(REPO, 'out', 'recomp', 'SecretOfEvermore-' + platformTag(), 'SecretOfEvermore' + (process.platform === 'win32' ? '.exe' : ''));
    if (!o.rom || !fs.existsSync(o.rom) || !fs.existsSync(o.exe)) {
        console.error('usage: lockstep.js --rom <clean rom> --exe <recomp executable> [--from N --to N --step N]');
        process.exit(2);
    }
    return o;
}

/** snes9x: WRAM at each wanted counter value. */
function referenceRun(rom, wanted) {
    return new Promise(resolve => {
        const out = new Map();
        global.require = require; global.__dirname = path.dirname(CORE); global.__filename = CORE;
        global.Module = {
            locateFile: f => path.join(path.dirname(CORE), f),
            onRuntimeInitialized() {
                const M = global.Module;
                const p = M._my_malloc(rom.length);
                global.HEAPU8.set(rom, p);
                M._startWithRom(p, rom.length, 32040);
                const last = Math.max(...wanted);
                for (let f = 0; f < last * 3 && out.size < wanted.length; f++) {
                    M._setJoypadInput(0);
                    M._mainLoop();
                    const st = M._saveState();
                    const w = Buffer.from(global.HEAPU8.subarray(st + STATE_WRAM, st + STATE_WRAM + 0x20000));
                    if (M._free) M._free(st);
                    const c = w.readUInt16LE(0x100);
                    if (wanted.includes(c) && !out.has(c)) out.set(c, w);
                }
                resolve(out);
            },
        };
        vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });
    });
}

/** snesrecomp: same counters via its input script (until16 / poke / dump / quit). */
function recompRun(exe, romPath, wanted, rng, dir) {
    const hex = n => n.toString(16).toUpperCase();
    const lines = ['turbo on', `until16 100 == ${hex(SYNC_AT)}`, `poke ${hex(RNG[0])} ${rng.toString('hex')}`];
    for (const c of wanted) {
        if (c <= SYNC_AT) continue;   // up to the RNG sync (the poke takes a frame): not comparable
        lines.push(`until16 100 == ${hex(c)}`, `dump c${c}`);
    }
    lines.push('quit');
    const script = path.join(dir, 'lockstep.txt');
    fs.writeFileSync(script, lines.join('\n') + '\n');
    const r = spawnSync(exe, ['--no-launcher', '--script', script, romPath], {
        encoding: 'utf8', timeout: 180000, env: { ...process.env, SNESRECOMP_DUMP_DIR: dir },
    });
    fs.writeFileSync(path.join(dir, 'recomp.log'), (r.stdout || '') + (r.stderr || ''));
    const out = new Map();
    for (const c of wanted) {
        const f = path.join(dir, `c${c}.wram.bin`);
        if (fs.existsSync(f)) out.set(c, fs.readFileSync(f));
    }
    return out;
}

async function main() {
    const o = args(process.argv.slice(2));
    const rom = fs.readFileSync(o.rom);
    const wanted = [];
    for (let c = o.from; c <= o.to; c += o.step) wanted.push(c);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soe-lockstep-'));
    const ref = await referenceRun(rom, [SYNC_AT, ...wanted]);
    if (!ref.has(SYNC_AT)) { console.error('snes9x never reached counter ' + SYNC_AT); process.exit(1); }
    const rec = recompRun(o.exe, o.rom, wanted, ref.get(SYNC_AT).subarray(...RNG), dir);
    console.log('counter  differing WRAM bytes (timing noise excluded)  first addresses');
    let first = null, compared = 0;
    for (const c of wanted) {
        const a = rec.get(c), b = ref.get(c);
        if (c <= SYNC_AT) { console.log(String(c).padStart(7) + '  skipped (RNG sync at ' + SYNC_AT + ')'); continue; }
        if (!a || !b) { console.log(String(c).padStart(7) + '  missing (' + (!a ? 'recomp' : 'snes9x') + ')'); continue; }
        compared++;
        const diff = [];
        for (let i = 0; i < 0x20000; i++) if (a[i] !== b[i] && !NOISE.has(i)) diff.push(i);
        if (diff.length && first === null) first = c;
        console.log(String(c).padStart(7) + '  ' + String(diff.length).padStart(6) + '  ' + diff.slice(0, 10).map(i => '$' + i.toString(16).toUpperCase().padStart(4, '0')).join(' '));
    }
    if (!compared) { console.log(`\nNothing compared: see ${dir}/recomp.log`); process.exit(1); }
    console.log(first === null ? `\nIdentical at all ${compared} checked counters.` : `\nFirst divergence at counter ${first}. Dumps: ${dir}`);
}

main();
