// Times the boot block in MesenCE against the original: the master clock at which each ROM reaches the power-on
// entry $80:802D, the end of the replaced stretch $80:810F and the RNG seed read $80:81A1. All three must be equal,
// or the seed and everything after it change (boot.mts). Run it after any change to the boot block.
//   npm run sa1:measure -- [--rom <clean rom>] [--fit]
// --fit: also tries REFRESH_FIT values (-24..24, step 2) and names the one that lands on the original's clock.
// Takes about 3 s per run.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { convert, REPO } from './convert.mts';
import { REFRESH_FIT, COLD, RESUME } from './boot.mts';
import { mesenPath, runLua } from './mesen.mts';

const require = createRequire(import.meta.url);
const SEED_READ = 0x8081A1;
const POINTS = [COLD, RESUME, SEED_READ];

const argv = process.argv.slice(2);
const romArg = argv.includes('--rom') ? argv[argv.indexOf('--rom') + 1] : undefined;
const romPath: string = require('../rom').baseRomOrExit('evermore', romArg);
const exe = mesenPath();
if (!exe) { console.error('MesenCE not found: set MESEN'); process.exit(2); }

const LUA = `
local seen = {}
for _, a in ipairs({${POINTS.join(',')}}) do
  emu.addMemoryCallback(function()
    if not seen[a] then seen[a] = true; print(string.format("%06X %d", a, emu.getState()["masterClock"])) end
  end, emu.callbackType.exec, a, a)
end
local f = 0
emu.addEventCallback(function() f = f + 1; if f >= 8 then emu.stop(0) end end, emu.eventType.endFrame)
`;

const dir = join(REPO, 'out', 'sa1');
mkdirSync(dir, { recursive: true });
const work = mkdtempSync(join(dir, 'measure-'));

/** Master clock at each point, keyed by address. */
async function measure(rom: string, tag: string): Promise<Map<number, number>> {
    const { out } = await runLua(exe!, rom, LUA, work, tag);
    return new Map(out.split('\n').filter(l => /^[0-9A-F]{6} \d+$/.test(l)).map(l => [parseInt(l.slice(0, 6), 16), Number(l.slice(7))]));
}

const hex = (a: number) => `$${(a >> 16).toString(16).toUpperCase()}:${(a & 0xFFFF).toString(16).toUpperCase()}`;
const source = new Uint8Array(readFileSync(romPath));
const original = await measure(romPath, 'original');

async function tryFit(fit: number): Promise<boolean> {
    const file = join(work, `fit${fit}.sfc`);
    try {
        writeFileSync(file, convert(source, { upper: 'mesen', refreshFit: fit }).image);
    } catch (e) {
        console.log(`REFRESH_FIT ${String(fit).padStart(3)}: ${(e as Error).message}`);
        return false;
    }
    const image = await measure(file, `fit${fit}`);
    const cells = POINTS.map(p => `${hex(p)} ${image.get(p) ?? '-'}${image.get(p) === original.get(p) ? '' : ` (original ${original.get(p) ?? '-'})`}`);
    const same = POINTS.every(p => image.get(p) !== undefined && image.get(p) === original.get(p));
    console.log(`REFRESH_FIT ${String(fit).padStart(3)}: ${cells.join(', ')}${same ? '  ← same as the original' : ''}`);
    return same;
}

try {
    console.log(`original: ${POINTS.map(p => `${hex(p)} ${original.get(p) ?? '-'}`).join(', ')}`);
    let found: number | null = await tryFit(REFRESH_FIT) ? REFRESH_FIT : null;
    if (argv.includes('--fit') && found === null) {
        search: for (let d = 2; d <= 24; d += 2) {
            for (const fit of [REFRESH_FIT + d, REFRESH_FIT - d]) if (await tryFit(fit)) { found = fit; break search; }
        }
        console.log(found === null ? '\nno value fits: the cost model itself is off (tools/sa1/asm.mts)' : `\nset REFRESH_FIT = ${found} in tools/sa1/boot.mts`);
    }
    process.exitCode = found === REFRESH_FIT ? 0 : 1;
} finally {
    rmSync(work, { recursive: true, force: true });
}
