// Ownership: the worker thread that writes a recording bundle (bundle-commands.ts starts it). Its own entry point:
// bundled on its own as bundle/bundle-worker.js (tools/bundle.mts), run from dist/ when unbundled.
//
// A worker because a real bundle (a 96 MB library and 86 replays: a 35 MB zip) takes ~3 s and ~770 MB: on the
// extension host's thread the emulator page would get no answer meanwhile and pause the game.

import * as fs from 'fs';
import * as path from 'path';
import { parentPort, workerData } from 'worker_threads';
import { buildBundle } from '../../platform/cdl/bundle';
import { parseMovie } from '../../platform/tas/movie';

interface BundleJob { libDir: string; replayDir: string; sha256: string; installId: string; tool: { name: string; version: string }; target: string }

/** The recordings of the ROM with that SHA-256 (none without one). */
function replaysFor(replayDir: string, sha256: string) {
    if (!sha256 || !fs.existsSync(replayDir)) return [];
    const out: { name: string; data: Buffer }[] = [];
    for (const name of fs.readdirSync(replayDir).filter(n => /\.evsmv$/i.test(n))) {
        try {
            const data = fs.readFileSync(path.join(replayDir, name));
            if (parseMovie(data.toString('utf8'), name).meta.romSha256 === sha256) out.push({ name, data });
        } catch (_) { /* unreadable: skipped */ }
    }
    return out;
}

if (parentPort) {
    const job = workerData as BundleJob;
    try {
        const replays = replaysFor(job.replayDir, job.sha256);
        const { zip } = buildBundle({ libDir: job.libDir, replays, installId: job.installId, tool: job.tool });
        fs.writeFileSync(job.target, zip);
        parentPort.postMessage({ bytes: zip.length, replays: replays.length });
    } catch (err) {
        parentPort.postMessage({ error: err instanceof Error ? err.message : String(err) });
    }
}

export type { BundleJob };
