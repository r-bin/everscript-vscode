// The C-built image against vanilla on the 2:20 reference (power-on, no input), on our snes9x core: WRAM and VRAM hashed
// every 60 frames (--verbose: every frame), first differing frame and bytes. snes9x is a lead here, not a verdict.
//   node tools/c-to-rom/compare-image.mts [--rom <clean rom>] [--image out/c-to-rom/soe-c.sfc] [--frames N] [--verbose]
// The core is one global Module, so each ROM runs in a child of this script (--run <rom>).
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { boot, stripHeader, hex, REFERENCE_FRAMES, REPO } from './emu.mts';
import { writeQuality } from './quality.mts';

const require = createRequire(import.meta.url);
const { crc32 } = require('../../dist/platform/index');
const a = process.argv.slice(2), opt = (n: string) => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1]; };
const frames = Number(opt('frames') || REFERENCE_FRAMES), stride = a.includes('--verbose') ? 1 : 60;

/** One line per checkpoint, "frame wramCrc vramCrc"; with --dump <frame>, the frame's WRAM in hex instead. */
async function run(rom: string): Promise<void> {
    const c = await boot(stripHeader(new Uint8Array(readFileSync(rom)))), dumpAt = Number(opt('dump') ?? -1);
    const out: string[] = [];
    for (let k = 1; k <= frames; k++) {
        c.frame(0);
        if (k === dumpAt) { process.stdout.write(Buffer.from(c.wram()).toString('hex')); return; }
        if (k % stride === 0) out.push(`${k} ${crc32(c.wram())} ${crc32(c.vram())}`);
    }
    process.stdout.write(out.join('\n'));
}

async function child(rom: string, ...extra: string[]): Promise<string> {
    const args = [new URL(import.meta.url).pathname, '--run', rom, '--frames', String(frames), ...(stride === 1 ? ['--verbose'] : []), ...extra];
    return (await promisify(execFile)(process.execPath, args, { maxBuffer: 64 << 20 })).stdout;
}

if (opt('run')) await run(opt('run')!);
else {
    const vanilla: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
    const image = opt('image') || join(REPO, 'out/c-to-rom/soe-c.sfc');
    const [x, y] = (await Promise.all([child(vanilla), child(image)])).map(s => s.split('\n'));
    const at = x.findIndex((line, i) => line !== y[i]);
    console.log(`bytes per routine: ${writeQuality(vanilla)}`);
    if (at < 0) console.log(`in sync through frame ${frames}, ${x.length} checkpoints`);
    else {
        const frame = x[at].split(' ')[0], last = at ? x[at - 1].split(' ')[0] : '0';
        const [p, q] = await Promise.all([child(vanilla, '--dump', frame), child(image, '--dump', frame)]);
        const bytes: string[] = [];
        for (let o = 0; o < p.length && bytes.length < 32; o += 2) if (p.slice(o, o + 2) !== q.slice(o, o + 2)) bytes.push(`${hex(0x7E0000 + o / 2)}: ${p.slice(o, o + 2)} ${q.slice(o, o + 2)}`);
        console.log(`in sync through frame ${last}; differs at ${frame}${x[at].split(' ')[1] === y[at].split(' ')[1] ? ' (VRAM only)' : ''}`);
        console.log(bytes.join('\n'));
        process.exitCode = 1;
    }
}
