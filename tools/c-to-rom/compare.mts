// Run a built image over the reference (power-on, no input, 8414 frames) and compare its WRAM and VRAM with the vanilla
// reference after every frame (.wram-crc and .vram-crc next to intro-2m20.evsmv). Prints the first differing frame,
// how many frames differ, and at the first one which bytes (vanilla is replayed to that frame for the bytes).
// A C routine that passes G1 but takes other cycles than the asm still drifts here: the engine time-slices the
// main thread across NMIs (c-to-rom.md §7a). The first frame tells how far the image plays exactly like vanilla.
//   node tools/c-to-rom/compare.mts [--image out/c-to-rom/soe-c.sfc] [--rom <clean rom>] [--space wram|vram|both]
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { boot, stripHeader, hex, REFERENCE, REFERENCE_FRAMES, WRAM_SIZE, VRAM_SIZE } from './emu.mts';
import { IMAGE } from './build.mts';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const T = require('../../dist/platform/tas/movie');

const a = process.argv.slice(2), opt = (n: string) => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1]; };
const spaceOpt = opt('space') || 'both';

if (opt('dump')) {
    // child mode: memory after frame N
    const c = await boot(stripHeader(new Uint8Array(readFileSync(opt('image')!))));
    for (let f = 0; f <= Number(opt('dump')); f++) c.frame(0);
    const target = opt('space') === 'vram' ? c.vram() : c.wram();
    process.stdout.write(target);
    process.exit(0);
}

const image = opt('image') || IMAGE;
const wref = readFileSync(REFERENCE.replace(/\.evsmv$/, '.wram-crc'), 'utf8').trim().split('\n');
if (wref.length !== REFERENCE_FRAMES) throw new Error(`reference has ${wref.length} frames, expected ${REFERENCE_FRAMES}`);

const vrefPath = REFERENCE.replace(/\.evsmv$/, '.vram-crc');
const vref = existsSync(vrefPath) ? readFileSync(vrefPath, 'utf8').trim().split('\n') : null;

const c = await boot(stripHeader(new Uint8Array(readFileSync(image))));
let firstW = -1, differW = 0;
let firstV = -1, differV = 0;

for (let k = 0; k < REFERENCE_FRAMES; k++) {
    c.frame(0);
    if (spaceOpt === 'wram' || spaceOpt === 'both') {
        const wcrc = T.crcText(T.crc32(c.wram()));
        if (wcrc !== wref[k]) { differW++; if (firstW < 0) firstW = k; }
    }
    if (vref && (spaceOpt === 'vram' || spaceOpt === 'both')) {
        const vcrc = T.crcText(T.crc32(c.vram()));
        if (vcrc !== vref[k]) { differV++; if (firstV < 0) firstV = k; }
    }
}

let ok = true;
if (spaceOpt === 'wram' || spaceOpt === 'both') {
    if (firstW < 0) {
        console.log(`${image}: WRAM equals vanilla after every one of ${wref.length} frames`);
    } else {
        ok = false;
        const romPath: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
        const dump = (img: string) => execFileSync(process.execPath, [process.argv[1], '--dump', String(firstW), '--space', 'wram', '--image', img], { maxBuffer: WRAM_SIZE * 2 });
        const x = dump(romPath), y = dump(image);
        const bytes: string[] = [];
        for (let i = 0; i < WRAM_SIZE && bytes.length < 24; i++) if (x[i] !== y[i]) bytes.push(`${hex(0x7E0000 + i)} ${x[i].toString(16)}→${y[i].toString(16)}`);
        console.log(`${image}: WRAM first differs after frame ${firstW} (${(firstW / 60.0988).toFixed(1)} s); ${differW} of ${wref.length} frames differ`);
        console.log(`  at frame ${firstW}: ${bytes.join(', ')}`);
    }
}

if (vref && (spaceOpt === 'vram' || spaceOpt === 'both')) {
    if (firstV < 0) {
        console.log(`${image}: VRAM equals vanilla after every one of ${vref.length} frames`);
    } else {
        ok = false;
        const romPath: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
        const dump = (img: string) => execFileSync(process.execPath, [process.argv[1], '--dump', String(firstV), '--space', 'vram', '--image', img], { maxBuffer: VRAM_SIZE * 2 });
        const x = dump(romPath), y = dump(image);
        const words: string[] = [];
        for (let i = 0; i < VRAM_SIZE && words.length < 24; i += 2) {
            const xw = x[i] | (x[i + 1] << 8), yw = y[i] | (y[i + 1] << 8);
            if (xw !== yw) words.push(`$${i.toString(16).toUpperCase().padStart(4, '0')} ${xw.toString(16)}→${yw.toString(16)}`);
        }
        console.log(`${image}: VRAM first differs after frame ${firstV} (${(firstV / 60.0988).toFixed(1)} s); ${differV} of ${vref.length} frames differ`);
        console.log(`  at frame ${firstV}: ${words.join(', ')}`);
    }
}

process.exit(ok ? 0 : 1);
