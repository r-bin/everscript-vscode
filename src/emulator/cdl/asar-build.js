'use strict';

/**
 * emulator/cdl/asar-build.js
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

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hex } = require('./rom-map');

const BUILD_SH = `#!/bin/sh
# Rebuild the ROM and its CDL from this folder:  ASAR=/path/to/asar ./build.sh
# Output: build/out.sfc, build/out.sym (WLA labels), build/out.cdl
set -e
cd "$(dirname "$0")"
ASAR="\${ASAR:-asar}"
mkdir -p build
rm -f build/out.sfc
"$ASAR" --fix-checksum=off --no-title-check --symbols=wla --symbols-path=build/out.sym main.asm build/out.sfc
node build-cdl.js build/out.sym build/out.sfc build/out.cdl
`;

const BUILD_CDL_JS = `#!/usr/bin/env node
'use strict';
// build-cdl.js <out.sym> <out.sfc> <out.cdl>
// Every label in export.json owns the bytes up to the next label. Its flags in
// rom.cdl are copied to the label's new address from the WLA symbol file, so
// code and data that moved keep their CDL. A grown region gets no flags for the
// new bytes; a label missing from the build is reported.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [symPath, romPath, outPath] = process.argv.slice(2);
const exp = JSON.parse(fs.readFileSync(path.join(__dirname, 'export.json'), 'utf8'));
const src = fs.readFileSync(path.join(__dirname, 'rom.cdl'));
const rom = fs.readFileSync(romPath);

function busToRom(bus) {
    const bank = (bus >>> 16) & 0xFF, a = bus & 0xFFFF;
    if (exp.layout === 'LoROM') return a < 0x8000 ? -1 : ((bank & 0x7F) << 15) | (a & 0x7FFF);
    const off = ((bank & 0x3F) << 16) | a;
    return exp.layout === 'ExHiROM' && !(bank & 0x80) ? off + 0x400000 : off;
}

const now = new Map();
let inLabels = false;
for (const line of fs.readFileSync(symPath, 'utf8').split(/\\r?\\n/)) {
    if (/^\\[/.test(line)) { inLabels = line.trim() === '[labels]'; continue; }
    const m = inLabels && /^([0-9A-Fa-f]{2}):([0-9A-Fa-f]{4}) (\\S+)/.exec(line);
    if (m) now.set(m[3], busToRom((parseInt(m[1], 16) << 16) | parseInt(m[2], 16)));
}

const old = exp.labels;                       // [[name, offset]] sorted by offset
const placed = old.filter(([n]) => now.has(n)).map(([n]) => now.get(n)).sort((a, b) => a - b);
const nextNew = o => { let lo = 0, hi = placed.length; while (lo < hi) { const m = (lo + hi) >> 1; if (placed[m] <= o) lo = m + 1; else hi = m; } return lo < placed.length ? placed[lo] : rom.length; };
const cdl = Buffer.alloc(rom.length);
const missing = [];
for (let i = 0; i < old.length; i++) {
    const [name, from] = old[i];
    const oldLen = (i + 1 < old.length ? old[i + 1][1] : src.length) - from;
    if (!now.has(name)) { missing.push(name); continue; }
    const to = now.get(name);
    const n = Math.min(oldLen, nextNew(to) - to, rom.length - to);
    if (to >= 0 && n > 0) src.copy(cdl, to, from, from + n);
}
fs.writeFileSync(outPath, cdl);

const sha1 = crypto.createHash('sha1').update(rom).digest('hex');
console.log(sha1 === exp.sha1 ? 'ROM: byte-identical to the source ROM' : 'ROM: differs from the source ROM (expected after edits)');
console.log('CDL: ' + outPath + (src.equals(cdl) ? ' (identical to rom.cdl)' : ' (remapped by label)'));
if (missing.length) console.log('Labels not in the build (their flags dropped): ' + missing.slice(0, 20).join(', ') + (missing.length > 20 ? ' +' + (missing.length - 20) + ' more' : ''));
`;

function coverage(lib, known) {
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

function writeBuildFiles({ lib, rom, map, outDir, known, labels, banks, functions }) {
    const blobs = known.regions.filter(r => r.kind === 'blob');
    for (const r of blobs) {
        fs.mkdirSync(path.dirname(path.join(outDir, r.file)), { recursive: true });
        fs.writeFileSync(path.join(outDir, r.file), rom.subarray(r.start, r.end));
    }
    const cdlPath = path.join(outDir, 'rom.cdl');
    fs.writeFileSync(cdlPath, lib.cdl);

    const sha1 = crypto.createHash('sha1').update(rom).digest('hex');
    const all = new Map(labels.map(([n, o]) => [o, n]));
    for (let seg = 0; seg < rom.length; seg += map.segment) if (!all.has(seg)) all.set(seg, 'seg_' + hex(map.canonical(seg), 6));
    const sorted = [...all].sort((a, b) => a[0] - b[0]).map(([o, n]) => [n, o]);
    fs.writeFileSync(path.join(outDir, 'export.json'), JSON.stringify({
        title: map.header ? map.header.title : '', layout: map.type, size: rom.length, sha1, labels: sorted,
    }));
    fs.writeFileSync(path.join(outDir, 'build.sh'), BUILD_SH, { mode: 0o755 });
    fs.writeFileSync(path.join(outDir, 'build-cdl.js'), BUILD_CDL_JS);

    const c = coverage(lib, known);
    const pct = n => (n * 100 / rom.length).toFixed(1) + '%';
    const stepsPath = path.join(outDir, 'STEPS.md');
    const entry = [
        `## Export ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`,
        '',
        `ROM: ${map.header ? map.header.title : '?'}, ${map.type}, ${rom.length} bytes, sha1 \`${sha1}\``,
        '',
        '1. Seeded from the ROM before CDL data, then derived from it:',
        ...known.steps.map(s => '   - ' + s),
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

module.exports = { writeBuildFiles };
