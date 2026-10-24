// The snesrecomp backend: the packaged game run headless from a script, hashing through our glue
// (tools/recomp/host/src/game_rtl.c, SOE_COMPARE_*), which writes to fd 3. Keys are always the NMI counter $0100.
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { REPO } from '../c-to-rom/emu.mts';
import { FRAME_COUNTER, RNG, SYNC_AT, CROSS_NOISE } from './game.mts';
import { runs, REGION_SIZE, type Region, type Crcs } from './diff.mts';

const require = createRequire(import.meta.url);
export const RECOMP_REGIONS: Region[] = ['wram', 'vram', 'cgram', 'oam'];

/** The executable `npm run recomp` packaged. */
export function defaultExe(): string {
    const { platformTag } = require('../recomp/host');
    return join(REPO, 'out', 'recomp', 'SecretOfEvermore-' + platformTag(), 'SecretOfEvermore' + (process.platform === 'win32' ? '.exe' : ''));
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
}

const h = (n: number) => n.toString(16).toUpperCase();

/** Run the recomp; `onCp` gets each checkpoint. Resolves with the dump when dumpAt was set. */
export function runRecomp(job: RecompJob, onCp: (key: number, crcs: Crcs) => void): { done: Promise<Uint8Array[] | null>; kill(): void } {
    const bad = job.regions.filter(r => !RECOMP_REGIONS.includes(r));
    if (bad.length) throw new Error(`the recomp backend cannot hash ${bad.join(', ')}`);
    if (!existsSync(job.exe)) throw new Error(`no recomp executable at ${job.exe} (npm run recomp builds it)`);
    const dir = mkdtempSync(join(tmpdir(), 'soe-compare-'));
    const lines = ['turbo on'];
    if (job.rng) lines.push(`until16 ${h(FRAME_COUNTER)} == ${h(SYNC_AT)}`, `poke ${h(RNG[0])} ${Buffer.from(job.rng).toString('hex')}`);
    lines.push(`until16 ${h(FRAME_COUNTER)} == ${h(job.to)} ${job.to * 2 + 1000}`, 'quit');
    writeFileSync(join(dir, 'compare.txt'), lines.join('\n') + '\n');
    const env: NodeJS.ProcessEnv = { ...process.env, SOE_COMPARE_REGIONS: job.regions.join(',') };
    if (job.stride) env.SOE_COMPARE_STRIDE = String(job.stride);
    if (job.dumpAt !== undefined) env.SOE_COMPARE_DUMP = String(job.dumpAt);
    if (job.mask) env.SOE_COMPARE_MASK = runs([...CROSS_NOISE]).map(([a, b]) => a === b ? h(a) : `${h(a)}-${h(b)}`).join(',');
    const child = spawn(job.exe, ['--no-launcher', '--script', join(dir, 'compare.txt'), job.rom], { env, stdio: ['ignore', 'ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stderr!.on('data', d => { log = (log + d).slice(-4000); });
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
        }
    });
    const done = new Promise<Uint8Array[] | null>((resolve, reject) => child.on('exit', code => {
        rmSync(dir, { recursive: true, force: true });
        if (code && code !== 0 && child.signalCode === null) reject(new Error(`recomp exited with ${code}: ${log.trim().split('\n').slice(-3).join(' | ')}`));
        else resolve(dump);
    }));
    return { done, kill: () => { if (child.exitCode === null) child.kill(); } };
}
