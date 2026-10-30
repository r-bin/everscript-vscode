// Ownership: the worker thread that writes one CDL tab export, Asar or WRAM (export-job.ts starts it). Its own
// entry point: bundled on its own as bundle/cdl-export-worker.js (tools/bundle.mts), run from dist/ when unbundled.

import { parentPort, workerData } from 'worker_threads';
import { CdlLibrary, stripCopierHeader } from '../../../platform/cdl/library';
import { exportAsar, scriptNamer } from './tools';
import { exportWram } from '../../../platform/cdl/wram-export';
import type { ExportJob } from './export-job';

const job = workerData as ExportJob;
try {
    const t0 = Date.now();
    // The host wrote the library to disk just before (flushNow): this reads the same data.
    const lib = new CdlLibrary(job.root, Buffer.from(job.rom), job.info);
    let file: string, text: string;
    if (job.kind === 'wram') {
        const r = exportWram(lib, job.rom, job.outDir, { describeScript: scriptNamer(stripCopierHeader(job.rom)) });
        file = r.file;
        text = `ram.asm: ${r.addresses} WRAM addresses, ${r.enums} enum candidates`;
    } else {
        const r = exportAsar(lib, job.rom, job.outDir);
        file = r.mainPath;
        text = `Asar export: ${r.banks} banks, ${r.functions} functions, ${r.codeLines} instructions, ${r.tables} lookup tables`;
    }
    parentPort!.postMessage({ file, text: text + ` (${Date.now() - t0} ms)` });
} catch (err) {
    parentPort!.postMessage({ error: err instanceof Error ? err.message : String(err) });
}
