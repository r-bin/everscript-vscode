// Ownership: runs a CDL tab export (Asar or WRAM) in a worker thread (export-worker.ts).
//
// A worker because an export of a big library takes seconds and over 1 GB (2.5 s, 1.3 GB peak for a 35,000-
// instruction library, v0.384.14): on the extension host's own thread it stalled the emulator page, which then
// paused the game and warned that VS Code had stopped answering. The heap cap makes running out of memory end
// the worker with an error instead of taking the extension host down.

import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';

interface ExportJob {
    kind: 'asm' | 'wram';
    /** The library root (cdl-library/) and the ROM: the worker opens the same library the host has. */
    root: string;
    rom: Uint8Array;
    info: { title?: string; mapType?: string; sha256?: string };
    outDir: string;
}
interface ExportResult { file: string; text: string }

const HEAP_MB = 3072;

/**
 * The worker's file: next to this one when running from dist/, else the package's own bundle of it
 * (the package leaves out the dist/ modules the worker needs; tools/bundle.mts).
 */
function workerFile(): string {
    const here = path.join(__dirname, 'export-worker.js');
    if (fs.existsSync(path.join(__dirname, '..', '..', '..', 'platform', 'cdl', 'library.js'))) return here;
    return path.join(__dirname, '..', '..', '..', '..', 'bundle', 'cdl-export-worker.js');
}

/** Writes the export; rejects with the reason when it fails. */
function exportInBackground(job: ExportJob): Promise<ExportResult> {
    return new Promise<ExportResult>((resolve, reject) => {
        const w = new Worker(workerFile(), { workerData: job, resourceLimits: { maxOldGenerationSizeMb: HEAP_MB } });
        w.once('message', (m: { file?: string; text?: string; error?: string }) => {
            if (m.file) resolve({ file: m.file, text: m.text || '' }); else reject(new Error(m.error || 'no answer'));
        });
        w.once('error', reject);
        w.once('exit', (code) => { if (code) reject(new Error(`the export stopped (exit ${code})`)); });
    });
}

export type { ExportJob, ExportResult };
export { exportInBackground };
