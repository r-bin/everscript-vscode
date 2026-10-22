// Play an enemy killing the Boy in the real game, many times, headless: the check of the Routes tab's
// fight model (src/games/evermore/simulation/combat/, docs/entities/combat.md) against the game itself.
//   node tools/routes/fight-in-game.mts [--trials 80] [--room 0x38] [--enemy 109] [--gap 16] [--speed 2.5] [--json <file>]
// The ROM (from the ROM library) is patched in memory only: the intro's first code jumps to the room
// (docs/map-format/rom-export.md row 6), so the room comes up with a fresh game's party. Then, per trial:
// wait a different number of frames (a different random state), put the Boy `gap` px below the
// enemy, take the Dog out (HP 0), and after each knockback walk the Boy back at `speed` px a frame,
// the fastest a player could. Prints the time to death, hits taken and enemy attacks (engages at
// $8F:DC1D), and the gaps between attacks.
//
// Trap: booting this way skips the opening scene, which leaves the Boy untargetable (entity +$10
// bit 5, the strike sweep $8F:B615 skips him). The tool clears it.
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

const require = createRequire(import.meta.url);
const ROOT = path.join(import.meta.dirname, '..', '..');
const { romOrExit } = require(path.join(ROOT, 'tools/rom'));
const CORE = path.join(ROOT, 'src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
const arg = (name: string, d: string) => { const i = process.argv.indexOf('--' + name); return i < 0 ? d : process.argv[i + 1]; };

const TRIALS = Number(arg('trials', '80')), ROOM = Number(arg('room', '0x38')), ENEMY = Number(arg('enemy', '109'));
const GAP = Number(arg('gap', '16')), SPEED = Number(arg('speed', '2.5')), JSON_OUT = arg('json', '');
/** The enemy's record address as an entity keeps it at +$60 ($8E:B678 + 74 × character). */
const RECORD = (0xb678 + 74 * ENEMY) & 0xffff;
/** Boy entity $4E89: +$10 flags, +$16 mode (bit 2: knockback), +$1A/+$1C position, +$2A HP; Dog HP $4F61. */
const BOY = 0x7e4e89, DOG_HP = 0x7e4f61, ENTITY_LIST = 0x7e3ddf, INTRO_HOOK = 0x12e0ca, ENGAGE = 0x8fdc1d;
const UNTARGETED = 0x0020, KNOCKBACK_MODE = 0x0004, SETTLE = 1200, MAX_FRAMES = 9000;

/* eslint-disable @typescript-eslint/no-explicit-any */
const g = globalThis as any;
g.Module = { locateFile: (f: string) => path.join(path.dirname(CORE), f), onRuntimeInitialized: () => run(g.Module) };
g.require = require; g.__dirname = path.dirname(CORE); g.__filename = CORE;
vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });

function run(M: any): void {
    let rom = new Uint8Array(fs.readFileSync(romOrExit('evermore')));
    if (rom.length % 0x8000 === 0x200) rom = rom.subarray(0x200);
    rom = Uint8Array.from(rom);
    rom.set([0x22, 73, 124, ROOM, 0, 0], INTRO_HOOK);   // load_map(room, x, y); any spot, the room's own start wins
    const heap = () => g.HEAPU8 as Uint8Array;
    const load = (bytes: Uint8Array, fn: (p: number) => void) => { const p = M._my_malloc(bytes.length); heap().set(bytes, p); fn(p); M._my_free(p); };
    load(rom, (p) => M._startWithRom(p, rom.length, 44100));
    const r16 = (a: number) => M.readMemory(a) | (M.readMemory(a + 1) << 8);
    const w16 = (a: number, v: number) => { M.writeMemory(a, v & 0xff); M.writeMemory(a + 1, (v >> 8) & 0xff); };
    const step = () => { M._setJoypadInput(0); M._mainLoop(); };
    for (let f = 0; f < SETTLE; f++) step();
    let enemy = 0;
    for (let e = r16(ENTITY_LIST), n = 0; e && n < 64; e = r16(0x7e0000 + e + 0x5e), n++) if (r16(0x7e0000 + e + 0x60) === RECORD) { enemy = e; break; }
    if (!enemy) { console.error('no character ' + ENEMY + ' in room 0x' + ROOM.toString(16)); process.exit(1); }
    const ex = r16(0x7e0000 + enemy + 0x1a), spotY = r16(0x7e0000 + enemy + 0x1c) + GAP;
    const size = M._getStateSaveSize(), ptr = M._saveState(), state = heap().slice(ptr, ptr + size);
    let frame = 0, engages: number[] = [];
    M.onBreakpointHit = () => { if (M.getCPUState().y === enemy) engages.push(frame); return false; };
    M.addExecBreakpoint(ENGAGE);
    const trials: { frames: number; dead: boolean; hits: number[]; engages: number[] }[] = [];
    for (let k = 0; k < TRIALS; k++) {
        load(state, (p) => M._loadState(p, size));
        for (let i = 0; i < k * 7; i++) step();
        w16(BOY + 0x1a, ex); w16(BOY + 0x1c, spotY); w16(DOG_HP, 0);
        w16(BOY + 0x10, r16(BOY + 0x10) & ~UNTARGETED);
        engages = [];
        const hits: number[] = [];
        let hp = r16(BOY + 0x2a);
        for (frame = 0; frame < MAX_FRAMES && hp > 0; frame++) {
            step();
            const now = r16(BOY + 0x2a);
            if (now < hp) { hits.push(hp - now); hp = now; }
            if (hp === 0) break;
            if (!(r16(BOY + 0x16) & KNOCKBACK_MODE)) {
                const y = r16(BOY + 0x1c);
                if (y > spotY) w16(BOY + 0x1c, Math.max(spotY, Math.round(y - SPEED)));
                w16(BOY + 0x1a, ex);
            }
        }
        trials.push({ frames: frame, dead: hp === 0, hits, engages });
    }
    const t = trials.filter((x) => x.dead).map((x) => x.frames / 60).sort((a, b) => a - b);
    const q = (p: number) => t[Math.min(t.length - 1, Math.floor(p * t.length))];
    const gaps = trials.flatMap((x) => x.engages.slice(1).map((e, i) => e - x.engages[i]));
    const share = (key: (x: (typeof trials)[number]) => number) => {
        const m = new Map<number, number>();
        for (const x of trials) m.set(key(x), (m.get(key(x)) || 0) + 1);
        return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([v, c]) => v + ': ' + c).join(', ');
    };
    console.log('deaths ' + t.length + '/' + TRIALS + ' · seconds min ' + q(0).toFixed(2) + ' p10 ' + q(0.1).toFixed(2) + ' median ' + q(0.5).toFixed(2) +
        ' mean ' + (t.reduce((s, x) => s + x, 0) / t.length).toFixed(2) + ' p90 ' + q(0.9).toFixed(2) + ' max ' + q(1).toFixed(2));
    console.log('hits taken ' + share((x) => x.hits.length) + ' · attacks ' + share((x) => x.engages.length));
    console.log('gap between attacks: min ' + Math.min(...gaps) + ' mean ' + (gaps.reduce((s, x) => s + x, 0) / gaps.length).toFixed(1) + ' frames');
    if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(trials));
    process.exit(0);
}
