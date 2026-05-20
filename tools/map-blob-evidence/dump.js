#!/usr/bin/env node
'use strict';

const fs = require('fs');
const {
    parseTrustedMapBlob,
    formatTrustedMapBlobReport,
} = require('../../map-blob-evidence-model');

const ROM_CANDIDATES = [
    process.env.ROM,
    '/Users/v/Documents/GitHub/SoETilesViewer/SoEScriptDumper/Secret of Evermore (U) [!].smc',
    '/Users/v/Documents/GitHub/everscript/Secret of Evermore (U) [!].smc',
].filter(Boolean);

function parseHexArg(value) {
    const text = String(value || '').trim();
    if (!text) return null;
    return parseInt(text.startsWith('0x') || text.startsWith('0X') ? text.slice(2) : text, 16);
}

function usage() {
    console.log('Usage:');
    console.log('  node tools/map-blob-evidence/dump.js <romPath> <blobSnesHex> <blobSizeHex> [--render-limit N] [--render-bytes N]');
    console.log('  ROM=/path/to/rom.smc node tools/map-blob-evidence/dump.js <blobSnesHex> <blobSizeHex> [--render-limit N] [--render-bytes N]');
    console.log('Example:');
    console.log("  node tools/map-blob-evidence/dump.js '/path/Secret of Evermore (U) [!].smc' 0xADB50C 0x455 --render-bytes 50");
}

const argv = process.argv.slice(2);
if (argv.length < 2) {
    usage();
    process.exit(1);
}

let renderDetailLimit = null;
let renderStreamBytes = null;
const positional = [];
for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--render-limit') {
        renderDetailLimit = parseInt(argv[index + 1], 10);
        index++;
        continue;
    }
    if (argv[index] === '--render-bytes') {
        renderStreamBytes = parseInt(argv[index + 1], 10);
        index++;
        continue;
    }
    positional.push(argv[index]);
}

let romPath = null;
let blobSnes = null;
let blobSize = null;

if (positional.length >= 3) {
    romPath = positional[0];
    blobSnes = parseHexArg(positional[1]);
    blobSize = parseHexArg(positional[2]);
} else {
    romPath = ROM_CANDIDATES.find((candidate) => {
        try { return candidate && fs.existsSync(candidate); } catch { return false; }
    }) || null;
    blobSnes = parseHexArg(positional[0]);
    blobSize = parseHexArg(positional[1]);
}

if (!romPath || !fs.existsSync(romPath)) {
    console.error('ROM not found. Pass it explicitly or set $ROM.');
    process.exit(1);
}
if (!Number.isFinite(blobSnes) || !Number.isFinite(blobSize)) {
    usage();
    process.exit(1);
}

const romBuf = fs.readFileSync(romPath);
const parsed = parseTrustedMapBlob(romBuf, {
    dataSnes: blobSnes,
    blobSize,
    renderStreamBytes: Number.isFinite(renderStreamBytes) && renderStreamBytes > 0 ? renderStreamBytes : undefined,
});
const report = formatTrustedMapBlobReport(parsed, {
    renderDetailLimit: Number.isFinite(renderDetailLimit) && renderDetailLimit > 0 ? renderDetailLimit : undefined,
});
process.stdout.write(report);
if (!report.endsWith('\n')) process.stdout.write('\n');
