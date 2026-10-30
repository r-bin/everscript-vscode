// The snes9x backend: one child process per run of our fork's debugger core (one core per process: it is an
// Emscripten module with one global Module). The parent sends a Job, the child streams checkpoints or answers once.
// Everything stays in memory; snapshots travel over IPC (advanced serialization), never through files.
import { readFileSync } from 'node:fs';
import { fork, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { crc32 } from 'node:zlib';
import { boot, stripHeader, AUDIO_RATE, type Core } from '../c-to-rom/emu.mts';
import { FRAME_COUNTER, RNG, SYNC_AT, CROSS_NOISE, nmiKey } from './game.mts';
import type { Region, Crcs, Write } from './diff.mts';

const require = createRequire(import.meta.url);

export interface Job {
    cmd: 'hash' | 'dump' | 'watch' | 'rng';
    rom: string;
    replay: string | null;
    /** Frames (align frame) or the counter value to run to (align nmi). */
    frames: number;
    align: 'frame' | 'nmi';
    regions: Region[];
    /** hash: emit at keys divisible by this. */
    stride?: number;
    /** Zero the cross-backend noise bytes before hashing WRAM. */
    mask?: boolean;
    /** dump: the key to snapshot at. */
    key?: number;
    /** watch: log CPU writes to these WRAM offsets from key `from` to key `to`. */
    from?: number;
    to?: number;
    offsets?: number[];
}

export type Msg =
    | { t: 'cp'; key: number; crcs: Crcs }
    | { t: 'done'; frames: number; key: number }
    | { t: 'dump'; key: number; bytes: Uint8Array[] }
    | { t: 'writes'; writes: Write[] }
    | { t: 'rng'; bytes: Uint8Array; frame: number }
    | { t: 'error'; message: string };

const SPACE: Partial<Record<Region, number>> = { vram: 0, cgram: 1, oam: 2, aram: 4 };

/** Start a job in a child process; `onMsg` gets every message, the promise resolves when the child exits. */
export function runSnes9x(job: Job, onMsg: (m: Msg) => void): { done: Promise<void>; kill(): void } {
    const child: ChildProcess = fork(new URL(import.meta.url).pathname, ['--worker'], { serialization: 'advanced', stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    child.on('message', m => onMsg(m as Msg));
    child.send(job);
    const done = new Promise<void>(resolve => child.on('exit', () => resolve()));
    return { done, kill: () => { if (child.exitCode === null) child.kill(); } };
}

/** Run one job and collect its single answer (dump, writes, rng). */
export function askSnes9x<T extends Msg['t']>(job: Job, want: T): Promise<Extract<Msg, { t: T }>> {
    return new Promise((resolve, reject) => {
        let got: Msg | null = null;
        const r = runSnes9x(job, m => { if (m.t === want || m.t === 'error') got = m; });
        r.done.then(() => {
            if (got && got.t === want) resolve(got as Extract<Msg, { t: T }>);
            else reject(new Error(got && got.t === 'error' ? got.message : `snes9x ${job.cmd} ended without an answer`));
        });
    });
}

function read(c: Core, r: Region): Uint8Array {
    if (r === 'wram') return c.wram();
    const view: Uint8Array | null = c.M.readSpace(SPACE[r]);
    return view ? view.slice() : new Uint8Array(0);
}

function crcs(c: Core, regions: Region[], mask: boolean): Crcs {
    return regions.map(r => {
        const b = read(c, r);
        if (r === 'wram' && mask) for (const o of CROSS_NOISE) b[o] = 0;
        return crc32(b);
    });
}

async function work(job: Job): Promise<void> {
    const T = require('../../dist/platform/tas/movie');
    const movie = job.replay ? T.parseMovie(readFileSync(job.replay, 'utf8'), job.replay) : null;
    const c = await boot(stripHeader(new Uint8Array(readFileSync(job.rom))), movie ? movie.meta.audio : AUDIO_RATE);
    const M = c.M, heap = () => (globalThis as any).HEAPU8 as Uint8Array;
    if (movie?.meta.sram && M._getSaveSram) heap().set(Buffer.from(movie.meta.sram, 'base64'), M._getSaveSram());
    const events: Map<number, any[]> = movie ? T.groupEvents(movie.events) : new Map();
    const pads: Uint16Array | null = movie ? movie.pads : null;
    const counter = () => { const w = M.readMemoryRange(0x7E0000 + FRAME_COUNTER, 2); return w[0] | (w[1] << 8); };
    // Resolves once the message is written: exiting earlier drops a large one.
    const send = (m: Msg) => new Promise<void>(resolve => process.send!(m, undefined, {}, () => resolve()));

    const writes: Write[] = [];
    let watchStart = -1;
    const nmi = job.align === 'nmi' || job.cmd === 'rng';
    const target = job.cmd === 'rng' ? SYNC_AT : job.cmd === 'dump' ? job.key! : job.cmd === 'watch' ? job.to! : job.frames;
    const limit = nmi ? job.frames * 2 + 1000 : job.frames;
    let lastKey = -1, f = 0;
    const toKey = nmiKey();
    for (; f < limit; f++) {
        for (const ev of events.get(f) || []) {
            if (ev.kind === 'W') ev.bytes.forEach((b: number, i: number) => M.writeMemory(ev.addr + i, b));
            else if (ev.kind === 'R') M._softReset();
            else if (ev.kind === 'L') throw new Error(`the replay rewinds (L event at frame ${f}): not supported yet`);
        }
        c.frame(pads ? pads[f] ?? 0 : 0);
        // nmi: power-on WRAM is not cleared ($5555 in snes9x); the key counts from the 0 the reset code writes.
        const key = nmi ? toKey(counter()) : f + 1;
        if (key < 0 || key <= lastKey) continue;    // nmi: the counter did not advance this frame
        lastKey = key;
        if (job.cmd === 'hash' && (key % job.stride! === 0 || key >= target)) send({ t: 'cp', key, crcs: crcs(c, job.regions, !!job.mask) });
        if (job.cmd === 'watch' && watchStart < 0 && key >= job.from!) {
            watchStart = f + 1;
            M.onBreakpointHit = (e: { address: number; value: number; pc: number }) => {
                writes.push({ frame: f - watchStart, offset: e.address, pc: e.pc, value: e.value });
                return false;
            };
            for (const o of job.offsets!) M.addWriteBreakpoint(o);
        }
        if (key >= target) break;
    }
    if (job.cmd === 'dump') await send({ t: 'dump', key: lastKey, bytes: job.regions.map(r => read(c, r)) });
    if (job.cmd === 'watch') await send({ t: 'writes', writes });
    if (job.cmd === 'rng') await send({ t: 'rng', bytes: c.wram().slice(RNG[0], RNG[1]), frame: f });
    await send({ t: 'done', frames: f, key: lastKey });
}

if (process.argv.includes('--worker')) {
    process.once('message', job => {
        work(job as Job).then(
            () => process.exit(0),
            e => { process.send!({ t: 'error', message: (e as Error).message }); process.exit(1); });
    });
}
