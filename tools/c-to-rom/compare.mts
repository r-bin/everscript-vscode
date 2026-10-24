// Run a built image over the reference (power-on, no input, 8414 frames) and compare its WRAM with the vanilla
// reference after every frame (.wram-crc next to intro-2m20.evsmv). Prints the first differing frame, how many
// frames differ, and at the first one which bytes (vanilla is replayed to that frame for the bytes).
// A C routine that passes G1 but takes other cycles than the asm still drifts here: the engine time-slices the
// main thread across NMIs (c-to-rom.md §7a). The first frame tells how far the image plays exactly like vanilla.
//   node tools/c-to-rom/compare.mts [--image out/c-to-rom/soe-c.sfc] [--rom <clean rom>]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { boot, stripHeader, hex, REFERENCE, REFERENCE_FRAMES, WRAM_SIZE } from './emu.mts';
import { IMAGE } from './build.mts';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const T = require('../../dist/platform/tas/movie');

const a = process.argv.slice(2), opt = (n: string) => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1]; };

if (opt('dump')) {
    // child mode: WRAM after frame N
    const c = await boot(stripHeader(new Uint8Array(readFileSync(opt('image')!))));
    for (let f = 0; f <= Number(opt('dump')); f++) c.frame(0);
    process.stdout.write(c.wram());
    process.exit(0);
}

const image = opt('image') || IMAGE;
const ref = readFileSync(REFERENCE.replace(/\.evsmv$/, '.wram-crc'), 'utf8').trim().split('\n');
if (ref.length !== REFERENCE_FRAMES) throw new Error(`reference has ${ref.length} frames, expected ${REFERENCE_FRAMES}`);
const c = await boot(stripHeader(new Uint8Array(readFileSync(image))));
let first = -1, differ = 0;
for (let k = 0; k < ref.length; k++) {
    c.frame(0);
    const crc = T.crcText(T.crc32(c.wram()));
    if (crc !== ref[k]) { differ++; if (first < 0) first = k; }
}
if (first < 0) {
    console.log(`${image}: WRAM equals vanilla after every one of ${ref.length} frames`);
    process.exit(0);
}
const romPath: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
const dump = (img: string) => execFileSync(process.execPath, [process.argv[1], '--dump', String(first), '--image', img], { maxBuffer: WRAM_SIZE * 2 });
const x = dump(romPath), y = dump(image);
const bytes: string[] = [];
for (let i = 0; i < WRAM_SIZE && bytes.length < 24; i++) if (x[i] !== y[i]) bytes.push(`${hex(0x7E0000 + i)} ${x[i].toString(16)}→${y[i].toString(16)}`);
console.log(`${image}: WRAM first differs after frame ${first} (${(first / 60.0988).toFixed(1)} s); ${differ} of ${ref.length} frames differ`);
console.log(`  at frame ${first}: ${bytes.join(', ')}`);
process.exit(1);
