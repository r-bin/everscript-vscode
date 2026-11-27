// Proof of concept: one WRAM variable moved by name (docs/open-evermore/wram.md). Open Evermore names WRAM in its
// files (scripts, rings, formulas, weapons); for implode to place WRAM as it places ROM resources, every instruction
// that reaches a variable must be one implode can rewrite. This finds them for one knowledge entry and, when nothing
// blocks it, moves the variable and plays a stored playback on vanilla and on the moved build, comparing WRAM through
// the move (old place in vanilla = new place in the build).
//   node tools/open-evermore/wram-poc.mts <WRAM name> [--to <WRAM name | $7E:xxxx>] [--movie <file.evsmv>] [--frames n]
//   node tools/open-evermore/wram-poc.mts --scan      every WRAM entry the recorded play reached, ranked by blockers
// Superseded by implode itself (docs/open-evermore/wram.md §0.2): the census rules (references, what blocks) are
// wram-census.mts's, which this imports; kept as the one-variable experiment.
// An instruction is rewritable when its operand names the variable itself: absolute or long, plain or indexed, whose
// base lies inside it. Everything else blocks: direct page, indirect, a pointer, a base outside (an array that holds
// it), a loop over many addresses, DMA, a script. Moving an operand keeps the instruction, its length and its cycles
// (WRAM is one speed), so the build can stay in step.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { boot } from './play.mts';
import { LIBRARY, decode, hex, index, study } from './wram-census.mts';
import type { Report } from './wram-census.mts';
import { wramAt, wramText } from './evermore/codecs/records.mts';
import { vanillaWram } from './evermore/codecs/wram.mts';

const require = createRequire(import.meta.url);
const { CdlLibrary } = require('../../dist/platform/cdl/library');
const { parseMovie, groupEvents, WRAM_BASE, WRAM_SIZE } = require('../../dist/platform/tas/movie');
const { baseRomPath } = require('../../dist/games');

const DEFAULT_MOVIE = join(new URL('.', import.meta.url).pathname, '../../.agents/skills/sample-playbacks/playbacks/intro-2m20.evsmv');
const bus = (pc: number) => hex(0xC00000 | pc);

/** The build: every rewritable operand moved by `delta`. */
function moved(rom: Uint8Array, lib: any, r: Report, delta: number): Uint8Array {
    const out = rom.slice();
    for (const s of r.sites.filter(x => x.rewrite)) {
        const d = decode(rom, lib.cdl, s.pc)!, n = d.length - 1, v = d.operand + delta;
        for (let k = 0; k < n; k++) out[s.pc + 1 + k] = (v >> (8 * k)) & 0xFF;
    }
    return out;
}

async function play(a: Uint8Array, b: Uint8Array, from: number, to: number, size: number, moviePath: string, frames: number): Promise<string> {
    const machines = await Promise.all([boot(), boot()]);
    machines.forEach((c, i) => {
        const rom = i === 0 ? a : b, p = c.Module._my_malloc(rom.length);
        c.HEAPU8.set(rom, p);
        c.Module._startWithRom(p, rom.length, 32000);
    });
    const [A, B] = machines.map(c => c.Module);
    const movie = parseMovie(readFileSync(moviePath, 'utf8'), basename(moviePath)), events = groupEvents(movie.events);
    const n = Math.min(frames, movie.count);
    // Vanilla's bytes at `from` are the build's at `to`; vanilla's at `to` (never used) are the build's at `from`.
    const map = (i: number) => i >= from && i < from + size ? i - from + to : i >= to && i < to + size ? i - to + from : i;
    for (let k = 0; k < n; k++) {
        for (const ev of events.get(k) || []) for (const M of [A, B]) {
            if (ev.kind === 'W') for (let i = 0; i < ev.bytes.length; i++) M.writeMemory(ev.addr + i, ev.bytes[i]);
            else if (ev.kind === 'R') M._softReset();
        }
        for (const M of [A, B]) { M._setJoypadInput(movie.pads[k]); M._mainLoop(); }
        const wa = A.readMemoryRange(WRAM_BASE, WRAM_SIZE), wb = B.readMemoryRange(WRAM_BASE, WRAM_SIZE);
        for (let i = 0; i < WRAM_SIZE; i++) if (wa[i] !== wb[map(i)]) return `frame ${k}: vanilla ${hex(0x7E0000 + i)} = $${wa[i].toString(16)}, the build's ${hex(0x7E0000 + map(i))} = $${wb[map(i)].toString(16)}`;
        if (A.getCPUState().pc !== B.getCPUState().pc) return `frame ${k}: PC ${A.getCPUState().pc.toString(16)} / ${B.getCPUState().pc.toString(16)}`;
    }
    return `in step for ${n} frames (WRAM compared through the move and PC, every frame)`;
}

async function main(): Promise<void> {
    const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
    const rom = new Uint8Array(readFileSync(baseRomPath('evermore')));
    const lib = new CdlLibrary(LIBRARY, Buffer.from(rom));
    if (!lib.xrefs.size) throw new Error(`no CDL library for this ROM under ${LIBRARY}`);
    const entries = vanillaWram().filter(v => v.size && v.at >> 16 === 0x7E).map(v => ({ name: v.name, addr: v.at, end: v.at + v.size! - 1 }));
    const ix = index(rom, lib);
    if (args[0] === '--scan') {
        const rows = entries.map(e => study(rom, lib, ix, e.name, e.addr & 0xFFFF, e.end - e.addr + 1)).filter(r => r.sites.some(s => s.why === 'operand inside'));
        rows.sort((x, y) => x.blockers - y.blockers || y.sites.length - x.sites.length);
        console.log(`${rows.length} WRAM entries reached in recorded play; ${rows.filter(r => !r.blockers).length} have no blocker:`);
        for (const r of rows.slice(0, 40)) console.log(`  ${r.blockers.toString().padStart(3)} blockers  ${r.sites.filter(x => x.rewrite).length.toString().padStart(3)} to move  ${r.maybe.toString().padStart(3)} capped  ${r.name} (${hex(0x7E0000 + r.at)}, ${r.size} B)`);
        return;
    }
    const at = wramAt(args[0]), e = entries.find(x => x.name === args[0]);
    if (at === null || !e) throw new Error(`"${args[0]}" is no WRAM knowledge entry`);
    const r = study(rom, lib, ix, e.name, at, e.end - e.addr + 1);
    console.log(`${r.name} (${hex(0x7E0000 + r.at)}, ${r.size} B): ${r.sites.filter(x => x.rewrite).length} to move, ${r.blockers} blockers${r.scripts ? ` (${r.scripts} script accesses)` : ''}, ${r.maybe} unknown (capped PCs whose range covers it, and operands inside never seen touching it: not moved, the playback decides)`);
    for (const s of r.sites.filter(x => !x.maybe)) console.log(`  ${s.rewrite ? 'move ' : 'BLOCK'} ${bus(s.pc)}  ${s.how.padEnd(22)} ${s.why}`);
    const target = opt('--to');
    if (!target) return;
    const to = wramAt(target);
    if (to === null) throw new Error(`--to "${target}": a WRAM name or $7E:xxxx`);
    if (r.blockers) { console.log('Not moved: something above reaches it in a way implode cannot rewrite.'); return; }
    const build = moved(rom, lib, r, to - r.at);
    console.log(`Moved to ${hex(0x7E0000 + to)} (${wramText(to)}); playing ${basename(opt('--movie') ?? DEFAULT_MOVIE)} on vanilla and on the build…`);
    console.log(await play(rom, build, r.at, to, r.size, opt('--movie') ?? DEFAULT_MOVIE, Number(opt('--frames') ?? 1e9)));
    process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
