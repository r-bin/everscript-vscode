/**
 * platform/cdl/asar-build.ts
 *
 * Everything in the export folder besides the .asm text:
 *   rooms/*.bin     known blob regions, one file each
 *   rom.cdl         the library's CDL, 1 byte per ROM byte (Mesen-S / BizHawk bit layout)
 *   export.json     ROM identity + every label's original offset (input of build-cdl.js)
 *   build.sh        asar -> build/out.sfc + build/out.sym, then build-cdl.js -> build/out.cdl
 *   build-cdl.js    standalone: moves each label's CDL flags to where the label landed
 *   STEPS.md        one appended entry per export: what was seeded, coverage, files
 * Nothing here runs per CDL flush; only on export.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { hex, createRomMap } from './rom-map';
import { sourceDir } from '../source-dir';
import type { KnownRegion } from './known-regions';

// build.sh and build-cdl.js are real files, copied into every export as they are.
const KIT = path.join(sourceDir(__dirname), 'asar-kit');

/** What this file reads of the CDL library: its CDL bytes and the extra flags (bit 0 DMA, bit 1 APU). */
interface CdlLib { cdl: Uint8Array; ext: Uint8Array }
interface Known { regions: KnownRegion[]; steps: string[] }
type RomMap = ReturnType<typeof createRomMap>;
interface BuildFilesInput {
    lib: CdlLib; rom: Uint8Array; map: RomMap; outDir: string; known: Known;
    labels: [string, number][]; banks: number; functions: number;
}

function coverage(lib: CdlLib, known: Known) {
    const c = { code: 0, data: 0, dma: 0, apu: 0, none: 0, known: 0 };
    for (let i = 0; i < lib.cdl.length; i++) {
        const x = lib.cdl[i], y = lib.ext[i];
        if (x & 1) c.code++;
        else if (y & 1) c.dma++;
        else if (y & 2) c.apu++;
        else if (x & 2) c.data++;
        else c.none++;
    }
    for (const r of known.regions) c.known += r.end - r.start;
    return c;
}

function writeBuildFiles({ lib, rom, map, outDir, known, labels, banks, functions }: BuildFilesInput) {
    const blobs = known.regions.filter((r): r is KnownRegion & { file: string } => r.kind === 'blob' && !!r.file);
    for (const r of blobs) {
        fs.mkdirSync(path.dirname(path.join(outDir, r.file)), { recursive: true });
        fs.writeFileSync(path.join(outDir, r.file), rom.subarray(r.start, r.end));
    }
    const cdlPath = path.join(outDir, 'rom.cdl');
    fs.writeFileSync(cdlPath, lib.cdl);

    const sha1 = crypto.createHash('sha1').update(rom).digest('hex');
    const all = new Map<number, string>(labels.map(([n, o]) => [o, n]));
    for (let seg = 0; seg < rom.length; seg += map.segment) if (!all.has(seg)) all.set(seg, 'seg_' + hex(map.canonical(seg), 6));
    const sorted = [...all].sort((a, b) => a[0] - b[0]).map(([o, n]) => [n, o]);
    fs.writeFileSync(path.join(outDir, 'export.json'), JSON.stringify({
        title: map.header ? map.header.title : '', layout: map.type, size: rom.length, sha1, labels: sorted,
    }));
    fs.writeFileSync(path.join(outDir, 'build.sh'), fs.readFileSync(path.join(KIT, 'build.sh')), { mode: 0o755 });
    fs.writeFileSync(path.join(outDir, 'build-cdl.js'), fs.readFileSync(path.join(KIT, 'build-cdl.js')));

    const c = coverage(lib, known);
    const pct = (n: number): string => (n * 100 / rom.length).toFixed(1) + '%';
    const stepsPath = path.join(outDir, 'STEPS.md');
    const entry = [
        `## Export ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
        '',
        `ROM: ${map.header ? map.header.title : '?'}, ${map.type}, ${rom.length} bytes, sha1 \`${sha1}\``,
        '',
        '1. Seeded from the ROM before CDL data, then derived from it:',
        ...known.steps.map((s) => '   - ' + s),
        `2. CDL coverage: code ${c.code} (${pct(c.code)}), data ${c.data} (${pct(c.data)}), DMA ${c.dma}, APU ${c.apu}, never touched ${c.none} (${pct(c.none)}). Known regions cover ${c.known} bytes (${pct(c.known)}) and override the CDL there.`,
        `3. Disassembled: ${banks} bank files, ${functions} functions; untouched runs and DMA graphics outside known regions stay \`incbin rom.bin:...\`.`,
        `4. Wrote: main.asm, banks/, ${blobs.length ? 'rooms/ (' + blobs.length + '), ' : ''}rom.bin, rom.cdl, export.json, build.sh, build-cdl.js, recomp/cfg/, recomp.sh.`,
        `5. Build: \`ASAR=/path/to/asar ./build.sh\` -> build/out.sfc (expect sha1 above while unedited) + build/out.cdl.`,
        '',
    ].join('\n');
    const head = fs.existsSync(stepsPath) ? '' : '# Export log\n\nOne entry per Asar export from the CDL tab. Not updated by CDL recording itself.\n\n';
    fs.appendFileSync(stepsPath, head + entry + '\n');
    return { cdlPath, stepsPath, coverage: c };
}

export { writeBuildFiles };
