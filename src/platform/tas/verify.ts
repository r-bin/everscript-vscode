/**
 * platform/tas/verify.ts
 *
 * The long-run safety net: replay a movie that is still being recorded on a headless copy of the core (a child
 * process running tools/cdl/replay.js) and report whether every checksum matches, so a hidden source of
 * non-determinism costs minutes of play instead of the whole run. It resumes from the newest save state an earlier
 * check left next to the movie (<movie>.states/, ROM-derived, never committed) and leaves new ones as it goes.
 *
 * Needs only node + fs + child_process; the host passes the executable (the extension host's own, with
 * ELECTRON_RUN_AS_NODE) and the ROM file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

// dist/ mirrors src/ at the same depth, so three folders up is the repo root from either.
const TOOL = path.join(__dirname, '..', '..', '..', 'tools', 'cdl', 'replay.js');

interface VerifyOptions { node: string; movie: string; rom: string; tool?: string; env?: NodeJS.ProcessEnv }
interface VerifyResult { ok: boolean; desync?: { frame: number; detail: string }; error?: string; summary?: string; note?: string }

/** The newest state in <statesDir>/index.json, or null. */
function latestState(statesDir: string): string | null {
    try {
        const index = JSON.parse(fs.readFileSync(path.join(statesDir, 'index.json'), 'utf8'));
        const last = index.states[index.states.length - 1];
        return last && fs.existsSync(path.join(statesDir, last.file)) ? path.join(statesDir, last.file) : null;
    } catch (_) { return null; }
}

/** Reads replay.js's result: exit code and stderr/stdout -> { ok, desync?: { frame, detail }, error? }. */
function interpret(code: number | null, stdout: string, stderr: string): VerifyResult {
    if (code === 0) return { ok: true, summary: (/replayed (\d+) frames, (\d+) checksums matched/.exec(stdout) || [])[0] || 'replayed' };
    const m = /DESYNC at frame (\d+): (.*)/.exec(stderr);
    if (code === 2 && m) return { ok: false, desync: { frame: parseInt(m[1], 10), detail: m[2] } };
    return { ok: false, error: (stderr || stdout || 'exit code ' + code).trim().split('\n').slice(-3).join(' | ') };
}

/** One replay of the movie, resumed from the newest state when there is one. */
function verifyMovie({ node, movie, rom, tool = TOOL, env = {} }: VerifyOptions): Promise<VerifyResult & { fromState: string | null }> {
    const statesDir = movie.replace(/\.evsmv$/i, '') + '.states';
    const fromState = latestState(statesDir);
    const args = [tool, movie, rom, '--quiet', '--states', statesDir];
    if (fromState) args.push('--from-state', fromState);
    return new Promise(resolve => {
        let out = '', err = '';
        const child = spawn(node, args, { env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }, env) });
        child.stdout.on('data', (d: Buffer) => { out += d; });
        child.stderr.on('data', (d: Buffer) => { err += d; });
        child.on('error', e => resolve({ ok: false, error: e.message, fromState }));
        child.on('close', code => resolve(Object.assign(interpret(code, out, err), { fromState })));
    });
}

/**
 * Checks a movie. A failure after resuming from a state could be the state's fault (not everything is saved),
 * so it is repeated from power-on; if that passes, the states are dropped and the check is OK.
 */
async function verifyMovieSafely(opts: VerifyOptions): Promise<VerifyResult & { fromState: string | null }> {
    const first = await verifyMovie(opts);
    if (first.ok || !first.fromState || !first.desync) return first;
    const statesDir = opts.movie.replace(/\.evsmv$/i, '') + '.states';
    fs.rmSync(statesDir, { recursive: true, force: true });
    const second = await verifyMovie(opts);
    if (second.ok) second.note = 'a save state did not reproduce the run and was dropped';
    return second;
}

export type { VerifyOptions, VerifyResult };
export { verifyMovieSafely, verifyMovie, latestState, interpret };
