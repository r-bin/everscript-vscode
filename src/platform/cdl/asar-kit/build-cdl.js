#!/usr/bin/env node
// TODO port to TS (docs/todo/port-to-ts.md)
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
for (const line of fs.readFileSync(symPath, 'utf8').split(/\r?\n/)) {
    if (/^\[/.test(line)) { inLabels = line.trim() === '[labels]'; continue; }
    const m = inLabels && /^([0-9A-Fa-f]{2}):([0-9A-Fa-f]{4}) (\S+)/.exec(line);
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
