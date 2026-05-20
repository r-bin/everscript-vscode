#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');

const {
    snesToRomOffset,
    parseTrustedMapBlob,
    resolveRenderMacro,
    inferRenderCommandFromTraceFile,
    TRUSTED_MAPS,
} = require('../map-blob-evidence-model');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('  \u2713', name);
        passed++;
    } catch (error) {
        console.error('  \u2717', name, '\n   ', error.message);
        failed++;
    }
}

const ROM_CANDIDATES = [
    '/Users/v/Documents/GitHub/SoETilesViewer/SoEScriptDumper/Secret of Evermore (U) [!].smc',
    '/Users/v/Documents/GitHub/everscript/Secret of Evermore (U) [!].smc',
    process.env.ROM,
].filter(Boolean);

function getRomBufOrSkip() {
    for (const p of ROM_CANDIDATES) {
        try {
            if (fs.existsSync(p)) return fs.readFileSync(p);
        } catch {}
    }
    return null;
}

console.log('\nMap blob evidence model checks');

const romBuf = getRomBufOrSkip();
if (!romBuf) {
    console.log('  - ROM not found locally; skipping map-blob-evidence-model tests');
    process.exit(0);
}

const trusted33 = TRUSTED_MAPS[0x33];

test('Strong Heart exterior trusted blob constants match ROM layout', () => {
    const parsed = parseTrustedMapBlob(romBuf, {
        dataSnes: trusted33.dataSnes,
        blobSize: trusted33.blobSize,
    });

    assert.strictEqual(parsed.mapId, 0x33);
    assert.strictEqual(parsed.dataRom, 0x2db50c);
    assert.strictEqual(parsed.blobSize, 0x455);
    assert.strictEqual(parsed.payloadStartSnes, 0xadb529);

    assert.strictEqual(parsed.header.triggerOffsetX, 0x1e);
    assert.strictEqual(parsed.header.triggerOffsetY, 0x04);
    assert.strictEqual(parsed.header.mapWidthTiles, 0x14);
    assert.strictEqual(parsed.header.mapHeightTiles, 0x10);
    assert.deepStrictEqual(parsed.header.configBytes, [0x17, 0x00, 0x00, 0x02, 0x00]);
    assert.strictEqual(parsed.header.unknownWord0x09, 0x0000);
    assert.strictEqual(parsed.header.unknownWord0x0B, 0x0000);
});

test('Strong Heart exterior step-on and B-trigger tables match trusted values', () => {
    const parsed = parseTrustedMapBlob(romBuf, {
        dataSnes: trusted33.dataSnes,
        blobSize: trusted33.blobSize,
    });

    assert.strictEqual(parsed.stepOn.lengthBytes, 0x000c);
    assert.strictEqual(parsed.stepOn.count, 2);
    assert.deepStrictEqual(
        parsed.stepOn.entries.map((entry) => ({
            y1: entry.y1,
            x1: entry.x1,
            y2: entry.y2,
            x2: entry.x2,
            scriptId: entry.scriptId,
        })),
        [
            { y1: 0x0f, x1: 0x27, y2: 0x10, x2: 0x28, scriptId: 0x0735 },
            { y1: 0x0c, x1: 0x2f, y2: 0x0e, x2: 0x32, scriptId: 0x0738 },
        ]
    );

    assert.strictEqual(parsed.bTriggers.lengthBytes, 0x0000);
    assert.strictEqual(parsed.bTriggers.count, 0);
    assert.strictEqual(parsed.trusted.enterSourceSnes, 0x92811a);
    assert.strictEqual(parsed.trusted.enterScriptSnes, 0x94e5fb);
});

test('byte pseudo-code notes load for known offsets and preserve empty notes', () => {
    const parsed = parseTrustedMapBlob(romBuf, {
        dataSnes: trusted33.dataSnes,
        blobSize: trusted33.blobSize,
    });

    assert.ok((parsed.bytePseudoCode.get(0) || '').includes('WRAM[$0F86]'));
    assert.ok((parsed.bytePseudoCode.get(1) || '').includes('WRAM[$0F88]'));
    assert.ok((parsed.bytePseudoCode.get(13) || '').includes('WRAM[$1062]'));
    assert.strictEqual(parsed.bytePseudoCode.get(25) || '', '');
});

test('stage data keeps exact first-pass prefix evidence as structured bytes', () => {
    const parsed = parseTrustedMapBlob(romBuf, {
        dataSnes: trusted33.dataSnes,
        blobSize: trusted33.blobSize,
    });

    const stage = parsed.stages.find((entry) => entry.label === 'first pass exact prefix check');
    assert.ok(stage, 'expected structured first-pass prefix stage');
    assert.strictEqual(stage.prefixRows[0][0], 'source bytes');
    assert.strictEqual(stage.prefixRows[0][1], '+0x02E..+0x043');
    assert.strictEqual(stage.prefixRows[0][3], 'substream/control bytes consumed by the first helper iterations');
    assert.strictEqual(stage.prefixRows[1][0], 'vram1 exact prefix');
    assert.strictEqual(stage.prefixRows[1][1], '0x7FC300..0x7FC307');
    assert.strictEqual(stage.prefixRows[1][2], '00 00 82 02 45 01 01 00');
    assert.strictEqual(stage.prefixRows[1][3], 'exact trace-backed match');
});

test('render macro 0x0282 resolves exact ROM bytes and supports custom dump width', () => {
    const macro = resolveRenderMacro(romBuf, 0x0282);
    const wideMacro = resolveRenderMacro(romBuf, 0x0282, 50);
    assert.ok(macro, 'expected render macro resolution');
    assert.strictEqual(macro.tableSnes, 0xEE0786);
    assert.strictEqual(macro.targetSnes, 0x8FE5D4);
    assert.strictEqual(macro.streamBytes.length, 20, 'expected fixed 20-byte stream preview');
    assert.deepStrictEqual(macro.streamBytes, [0x93, 0x61, 0x44, 0x44, 0x44, 0x44, 0x44, 0x44, 0x44, 0x4D, 0x44, 0x44, 0x44, 0x44, 0xE4, 0x91, 0x44, 0x91, 0x90, 0x20]);
    assert.strictEqual(wideMacro.streamBytes.length, 50, 'expected configurable wider stream preview');
    assert.ok(macro.opcodes.length > 0, 'expected opcode preview');
});

test('trace inference proves the 0x0282 render command start and payload start boundary', () => {
    const trace = inferRenderCommandFromTraceFile(trusted33.tracePaths.read7fc300, 0x8FE5D4);

    assert.ok(trace, 'expected render trace inference');
    assert.strictEqual(trace.commandByte, 0x93);
    assert.strictEqual(trace.opcodeClass, 'high-bit command');
    assert.strictEqual(trace.relativeOffset, 0x13);
    assert.strictEqual(trace.lineDataStartSnes, 0x8FE5E7);
    assert.ok(trace.accessedReads.some((entry) => entry.address === 0x8FE5D4 && entry.value === 0x93 && entry.widthBytes === 1));
    assert.ok(trace.accessedReads.some((entry) => entry.address === 0x8FE5E7 && entry.value === 0x20 && entry.widthBytes === 1));
    assert.ok(trace.accessedReads.some((entry) => entry.address === 0x8FE5E8 && entry.value === 0x805A && entry.widthBytes === 2));
    assert.strictEqual(trace.inferredEndSnes, null);
});

test('snesToRomOffset keeps trusted map 0x33 pointer aligned with confirmed size', () => {
    assert.strictEqual(snesToRomOffset(0xadb50c), 0x2db50c);
    assert.strictEqual(snesToRomOffset(0xadb50c) + 0x455, 0x2db961);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
