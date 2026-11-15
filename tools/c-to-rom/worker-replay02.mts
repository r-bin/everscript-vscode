import * as fs from 'node:fs';
import { stripHeader, boot } from './emu.mts';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const T = require('../../dist/platform/tas/movie');
const romPath = require('../rom').baseRomOrExit('evermore');
const rom = stripHeader(new Uint8Array(fs.readFileSync(romPath)));

const moviePath = process.env.REPLAY_PATH || '../SecretOfEvermoreRecomp/tools/compare/replays/local/02-newgame-boy-available.evsmv';
const movieText = fs.readFileSync(moviePath, 'utf8');
const movie = T.parseMovie(movieText);
const sramBytes = Buffer.from(movie.meta.sram, 'base64');

const addrs = process.argv.slice(2).map(a => parseInt(a, 16));

const c = await boot(rom);
const M = c.M;
const heap = (globalThis as any).HEAPU8;
const sramPtr = M._getSpacePtr(3);
if (sramPtr) heap.set(sramBytes, sramPtr);

const hitCounts = new Map<number, number>();
for (const addr of addrs) {
    hitCounts.set(addr, 0);
    M.addExecBreakpoint(addr);
}

M.onBreakpointHit = (e: { address: number }) => {
    if (hitCounts.has(e.address)) {
        hitCounts.set(e.address, (hitCounts.get(e.address) || 0) + 1);
    }
    return false; // MUST RETURN FALSE TO KEEP EMULATION RUNNING!
};

for (let i = 0; i < movie.count; i++) {
    c.frame(movie.pads[i]);
}

const hits: { addr: string; count: number }[] = [];
for (const [addr, count] of hitCounts.entries()) {
    if (count > 0) hits.push({ addr: addr.toString(16).toLowerCase(), count });
}
console.log(JSON.stringify(hits));
process.exit(0);
