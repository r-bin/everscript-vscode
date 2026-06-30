#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');

const {
    DEFAULT_TRACE_PATH,
    loadTrace,
    loadRom,
    parseCommandFetches,
    dumpOpcode93Commands,
} = require('../../src/maps/render-script-model');

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

console.log('\nRender script model checks');

if (!fs.existsSync(DEFAULT_TRACE_PATH)) {
    console.log('  - render trace not found locally; skipping render-script-model tests');
    process.exit(0);
}

const traceText = loadTrace(DEFAULT_TRACE_PATH);
const romBuf = loadRom();

test('decode trace exposes expected command fetch anchors', () => {
    const fetches = parseCommandFetches(traceText);
    assert.ok(fetches.length > 10, 'expected many command fetches');
    assert.deepStrictEqual(fetches.slice(0, 3).map((fetch) => [fetch.lineNumber, fetch.streamAddr, fetch.opcode]), [
        [155, 0x80BBFD, 0x00],
        [386, 0x8FE5D4, 0x93],
        [2082, 0x96F6ED, 0x92],
    ]);
});

test('first opcode 0x93 command infers payload split, size, and adjacent next fetch', () => {
    const commands = dumpOpcode93Commands(traceText, romBuf);
    const first = commands[0];

    assert.ok(first, 'expected at least one opcode 0x93 command');
    assert.strictEqual(first.streamAddr, 0x8FE5D4);
    assert.strictEqual(first.lineStart, 386);
    assert.strictEqual(first.headerSpan, 0x13);
    assert.strictEqual(first.payloadStart, 0x8FE5E7);
    assert.strictEqual(first.lastReadEnd, 0x8FE646);
    assert.strictEqual(first.endAddrExclusive, 0x8FE647);
    assert.strictEqual(first.inferredSize, 0x73);
    assert.ok(first.logicalNextFetch, 'expected logical next fetch to corroborate size');
    assert.strictEqual(first.logicalNextFetch.streamAddr, 0x8FE646);
    assert.strictEqual(first.logicalNextFetch.opcode, 0x3F);
    assert.strictEqual(first.logicalEndExclusive, 0x8FE646);
    assert.strictEqual(first.logicalSize, 0x72);
    assert.strictEqual(first.firstHeaderByte.value, 0x61);
    assert.strictEqual(first.firstPayloadControl.value, 0x20);
    assert.deepStrictEqual(first.firstPayloadWords.slice(0, 2).map((entry) => [entry.address, entry.value]), [
        [0x8FE5E8, 0x805A],
        [0x8FE5EA, 0x9358],
    ]);
});

test('first opcode 0x93 command shows VRAM destination setup and initial writes', () => {
    const commands = dumpOpcode93Commands(traceText, romBuf);
    const first = commands[0];

    assert.deepStrictEqual(first.firstVramWrites.slice(0, 4).map((entry) => [entry.target, entry.value]), [
        ['VMADDL', 0x2020],
        ['VMDATAL', 0x805A],
        ['VMDATAL', 0x9358],
        ['VMDATAL', 0x9F00],
    ]);
    assert.ok(first.romBytes.length >= 0x72, 'expected full command bytes from ROM');
    assert.deepStrictEqual(first.romBytes.slice(0, 20), [
        0x93, 0x61, 0x44, 0x44, 0x44, 0x44, 0x44, 0x44, 0x44, 0x4D,
        0x44, 0x44, 0x44, 0x44, 0xE4, 0x91, 0x44, 0x91, 0x90, 0x20,
    ]);
});

// ── Counter-mechanics proof tests ────────────────────────────────────────────
// These tests verify the TRUE termination semantics: a hardcoded two-phase
// counter (LDX #$001F at 8CC9CD), NOT a size field read from the tile stream.

test('opcode 0x93 command 0 counter mechanics: hardcoded two-phase termination', () => {
    const commands = dumpOpcode93Commands(traceText, romBuf);
    const cm = commands[0].counterMechanics;
    assert.ok(cm, 'expected counterMechanics field on command 0');
    assert.strictEqual(cm.phaseCount,  2,  'expected exactly 2 phases (bit-8 VRAM address gate)');
    assert.strictEqual(cm.decPerPhase, 32, 'expected 32 DEC $04 events per phase (0x1F → 0xFF underflow)');
    assert.strictEqual(cm.totalDecs,   64, 'expected 64 total DEC $04 events = 64 VRAM words');
    const proof = cm.terminationProof;
    assert.strictEqual(proof.kind,                   'hardcoded_outer_counter');
    assert.strictEqual(proof.outerCounterInit,        0x1F);
    assert.strictEqual(proof.decCountPerPhase,        32);
    assert.strictEqual(proof.phasesPerCommand,        2);
    assert.strictEqual(proof.totalVramWordsPerCommand, 64);
    assert.strictEqual(proof.codeRef.counterInitPC,   0x8CC9CD, 'LDX #$001F at 8CC9CD');
});

test('opcode 0x93 phase transition writes VRAM address 0x2120 (bit 8 set)', () => {
    const commands = dumpOpcode93Commands(traceText, romBuf);
    const cm = commands[0].counterMechanics;
    assert.ok(cm.phaseTransitions.length >= 1, 'expected at least one phase-transition VMADDL write within command');
    assert.strictEqual(cm.phaseTransitions[0].pc,          0x8CCAF0, 'expected VMADDL write at phase-transition code 8CCAF0');
    assert.strictEqual(cm.phaseTransitions[0].newVramAddr, 0x2120,   'expected transition to set VRAM address bit 8 (0x2020 → 0x2120)');
});

test('opcode 0x93 last logically consumed byte is 0x8FE645, not overlapping 0x8FE646', () => {
    const commands = dumpOpcode93Commands(traceText, romBuf);
    const cm = commands[0].counterMechanics;
    // lastYAdvanceDec is the final DEC $04 event after which INY had advanced Y.
    // At that DEC, Y = 0xE646, meaning the preceding read consumed Y = 0xE645 then did INY.
    // 0x8FE646 is the NEXT opcode byte (0x3F = fetch confirmed by logicalNextFetch test);
    // it was accidentally touched by a 16-bit bus read but is NOT logically part of command 0.
    assert.ok(cm.lastYAdvanceDec, 'expected lastYAdvanceDec to be identified');
    assert.strictEqual(cm.lastYAdvanceDec.yReg, 0xE646,
        'expected Y = 0xE646 at the last payload-consuming DEC (payload advanced to E646 after reading E645)');
    const streamBank = (commands[0].streamAddr >>> 16) << 16;
    const lastConsumedAddr = streamBank | ((cm.lastYAdvanceDec.yReg - 1 + 0x10000) & 0xFFFF);
    assert.strictEqual(lastConsumedAddr, 0x8FE645,
        'last logically consumed byte = 0x8FE645; 0x8FE646 is next-opcode byte only touched by 16-bit bus overlap');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);