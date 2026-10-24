// Record the reference a C-built ROM is compared with: power-on, no input, 2:20 (8414 frames at 60.0988 Hz):
// Squaresoft logo, intro, logo again. Writes the playback (.evsmv: no input, the movie's own WRAM checks every 60
// frames) and next to it the WRAM CRC-32 after every frame (.wram-crc, one hex word per line), which
// compare.mts checks a built ROM against frame by frame.
//   node tools/c-to-rom/record-reference.mts [--rom <clean rom>] [--frames 8414] [--out <file.evsmv>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, relative } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { boot, coreId, stripHeader, REPO, REFERENCE, REFERENCE_FRAMES } from './emu.mts';

const require = createRequire(import.meta.url);
const T = require('../../dist/platform/tas/movie');
const CURRENT_MAP_ID = 0x0ADB;              // knowledge/ram/7e0adb.md

const a = process.argv.slice(2), opt = (n: string) => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1]; };
const romPath: string = require('../rom').baseRomOrExit('evermore', opt('rom'));
const frames = Number(opt('frames') || REFERENCE_FRAMES);
const out = opt('out') || REFERENCE;

const source = new Uint8Array(readFileSync(romPath));
const c = await boot(stripHeader(source));
const body: string[] = [], crcs: string[] = [], rooms: number[] = [];
for (let k = 0; k < frames; k++) {
    c.frame(0);
    body.push(T.frameLine(0));
    const w = c.wram();
    const crc = T.crcText(T.crc32(w));
    crcs.push(crc);
    if (!rooms.includes(w[CURRENT_MAP_ID])) rooms.push(w[CURRENT_MAP_ID]);
    if ((k + 1) % T.CHECK_EVERY === 0) body.push('S|' + crc);
    if ((k + 1) % T.SPACES_EVERY === 0) body.push(T.spacesLine(T.spaceCrcs((id: number) => c.M.readSpace(id))));
}
const sha = createHash('sha256').update(source).digest('hex');
const text = T.evsmvHeader({ rom: basename(romPath), romSha256: sha, started: new Date().toISOString(),
    source: 'tools/c-to-rom/record-reference.mts: power-on, no input, 2:20', core: coreId() })
    + T.rleFrames(body.join('\n') + '\n') + T.evsmvTrailer({ frames, cheats: false });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, text);
writeFileSync(out.replace(/\.evsmv$/, '.wram-crc'), crcs.join('\n') + '\n');
console.log(JSON.stringify({ file: relative(REPO, out), frames, rooms: rooms.map(r => r.toString(16).padStart(2, '0')) }));
process.exit(0);
