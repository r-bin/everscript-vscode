// The snesrecomp backend: the recomp repository's game run headless from a script, hashing through its
// glue (src/game_rtl.c there, SOE_COMPARE_*), which writes to fd 3. Keys are always the NMI counter $0100.
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { FRAME_COUNTER, RNG, SYNC_AT, CROSS_NOISE } from './game.mts';
import { runs, REGION_SIZE, type Region, type Crcs } from './diff.mts';
import { gameExe } from '../recomp/repo.mts';

const require = createRequire(import.meta.url);

export const RECOMP_REGIONS: Region[] = ['wram', 'vram', 'cgram', 'oam'];

/** The game built in the recomp repository (`npm run recomp`, or its own CMake build). */
export function defaultExe(): string {
    return gameExe();
}

export interface RecompJob {
    exe: string;
    rom: string;
    /** The counter value to run to. */
    to: number;
    regions: Region[];
    stride?: number;
    dumpAt?: number;
    mask: boolean;
    /** snes9x's RNG bytes at counter SYNC_AT, copied in before anything is compared. */
    rng: Uint8Array | null;
    replay?: string | null;
    rngFrame?: number;
    /** Sample as each NMI is taken (SOE_COMPARE_AT=nmi); the key is the NMI's number since power-on. */
    atNmi?: boolean;
    /** With atNmi: each NMI's number, master clock and the address it interrupted (SOE_COMPARE_NMI_LOG). */
    onNmi?: (nmi: number, clock: number, pc: number) => void;
    /** WRAM offsets reported after every emulated frame through `onPeek` (a probe; SOE_COMPARE_PEEK in the glue). */
    peek?: number[];
    onPeek?: (frame: number, key: number, clock: number, bytes: number[]) => void;
    /** The recomp's stderr as it arrives (a probe: the framework's SNESRECOMP_* traces go there). */
    onStderr?: (chunk: Buffer) => void;
}

const BUTTON_BITS: [number, string][] = [
    [0x8000, 'b'],
    [0x4000, 'y'],
    [0x2000, 'select'],
    [0x1000, 'start'],
    [0x0800, 'up'],
    [0x0400, 'down'],
    [0x0200, 'left'],
    [0x0100, 'right'],
    [0x0080, 'a'],
    [0x0040, 'x'],
    [0x0020, 'l'],
    [0x0010, 'r'],
];

/** Convert a 16-bit joypad word into recomp script button names joined with '+' (e.g. 'start', 'b+y'). */
export function padToButtonString(pad: number): string {
    const pressed: string[] = [];
    for (const [bit, name] of BUTTON_BITS) {
        if (pad & bit) pressed.push(name);
    }
    return pressed.join('+');
}

const h = (n: number) => n.toString(16).toUpperCase();

/** Run the recomp; `onCp` gets each checkpoint. Resolves with the dump when dumpAt was set. */
export function runRecomp(job: RecompJob, onCp: (key: number, crcs: Crcs) => void): { done: Promise<Uint8Array[] | null>; kill(): void } {
    const bad = job.regions.filter(r => !RECOMP_REGIONS.includes(r));
    if (bad.length) throw new Error(`the recomp backend cannot hash ${bad.join(', ')}`);
    if (!existsSync(job.exe)) throw new Error(`no recomp executable at ${job.exe} (npm run recomp builds it)`);
    const dir = mkdtempSync(join(tmpdir(), 'soe-compare-'));
    const lines = ['turbo on'];

    if (job.replay) {
        const { parseMovie } = require('../../dist/platform/tas/movie');
        const movie = parseMovie(readFileSync(job.replay, 'utf8'), job.replay);
        const pads: Uint16Array = movie.pads;
        const rngAt = job.rngFrame ?? 115;
        const totalPadFrames = pads.length;   // the glue quits at the key (SOE_COMPARE_QUIT_AT)
        // The runner's script engine spends frames of its own: a poke takes its frame and one more ("hold done"), a
        // press of n frames n + 1. Those come off the next segment, so each pad value lands on the field MesenCE
        // gives it. The script's frame f is also MesenCE's frame f + 1 (the glue's peek and Mesen's endFrame count
        // differ by one at the same NMI key), so the run starts one pad frame in. Measured 2026-10-31 on
        // 02-newgame-boy-available: before, every press reached the game 3 fields late (WRAM parted at key 332).
        let i = 0, owed = 1;
        while (i < totalPadFrames) {
            if (job.rng && i === rngAt) {
                lines.push(`poke ${h(RNG[0])} ${Buffer.from(job.rng).toString('hex')}`);
                owed += 2;
            }
            const val = pads[i];
            let j = i + 1;
            while (j < totalPadFrames && pads[j] === val && (!job.rng || j !== rngAt)) j++;
            const take = Math.min(owed, j - i);   // a press right after a press loses its first frame(s) here
            owed -= take;
            const count = j - i - take;
            const btns = val === 0 ? '' : padToButtonString(val);
            if (count > 0) {
                if (btns) { lines.push(`press ${btns} ${count}`); owed += 1; }
                else lines.push(`wait ${count}`);
            }
            i = j;
        }
    } else {
        if (job.rng) lines.push(`until16 ${h(FRAME_COUNTER)} == ${h(SYNC_AT)}`, `poke ${h(RNG[0])} ${Buffer.from(job.rng).toString('hex')}`);
    }

    // The key is an NMI count, not the raw $0100 (the attract demo zeroes it), so the glue ends the run itself.
    lines.push(`wait ${job.to * 3 + 2000}`, 'quit');
    writeFileSync(join(dir, 'compare.txt'), lines.join('\n') + '\n');
    // SRAM from the run's own empty folder: cleared, as on MesenCE (mesen.mts isolatedRom), and the player's
    // saves/ stay untouched (the glue's SOE_COMPARE_SAVE_ROOT).
    const env: NodeJS.ProcessEnv = { ...process.env, SOE_COMPARE_REGIONS: job.regions.join(','), SOE_COMPARE_SAVE_ROOT: dir };
    env.SOE_COMPARE_QUIT_AT = String(job.dumpAt ?? job.to);
    if (job.atNmi) env.SOE_COMPARE_AT = 'nmi';
    if (job.onNmi) env.SOE_COMPARE_NMI_LOG = '1';
    if (job.stride) env.SOE_COMPARE_STRIDE = String(job.stride);
    if (job.dumpAt !== undefined) env.SOE_COMPARE_DUMP = String(job.dumpAt);
    if (job.peek?.length) env.SOE_COMPARE_PEEK = job.peek.map(h).join(',');
    if (job.mask) env.SOE_COMPARE_MASK = runs([...CROSS_NOISE]).map(([a, b]) => a === b ? h(a) : `${h(a)}-${h(b)}`).join(',');
    const child = spawn(job.exe, ['--no-launcher', '--script', join(dir, 'compare.txt'), job.rom], { env, stdio: ['ignore', 'ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stderr!.on('data', (d: Buffer) => { log = (log + d).slice(-4000); job.onStderr?.(d); });
    let buf = Buffer.alloc(0), dump: Uint8Array[] | null = null;
    const dumpSize = job.regions.reduce((s, r) => s + REGION_SIZE[r], 0);
    (child.stdio[3] as NodeJS.ReadableStream).on('data', (d: Buffer) => {
        buf = Buffer.concat([buf, d]);
        for (;;) {
            const nl = buf.indexOf(10);
            if (nl < 0) return;
            const head = buf.subarray(0, nl).toString();
            if (head.startsWith('D ')) {
                if (buf.length < nl + 1 + dumpSize) return;
                let o = nl + 1;
                dump = job.regions.map(r => { const b = new Uint8Array(buf.subarray(o, o + REGION_SIZE[r])); o += REGION_SIZE[r]; return b; });
                buf = buf.subarray(o);
                continue;
            }
            buf = buf.subarray(nl + 1);
            const p = head.split(' ');
            if (p[0] === 'H') onCp(Number(p[1]), p.slice(2).map(x => parseInt(x, 16)));
            else if (p[0] === 'N') job.onNmi?.(Number(p[1]), Number(p[2]), parseInt(p[3], 16));
            else if (p[0] === 'P') job.onPeek?.(Number(p[1]), Number(p[2]), Number(p[3]), p.slice(4).map(x => parseInt(x, 16)));
        }
    });
    const done = new Promise<Uint8Array[] | null>((resolve, reject) => child.on('close', code => {
        rmSync(dir, { recursive: true, force: true });
        if (code && code !== 0 && child.signalCode === null) reject(new Error(`recomp exited with ${code}: ${log.trim().split('\n').slice(-3).join(' | ')}`));
        else resolve(dump);
    }));
    return { done, kill: () => { if (child.exitCode === null) child.kill(); } };
}
