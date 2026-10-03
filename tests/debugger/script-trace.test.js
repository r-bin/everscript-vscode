'use strict';

/**
 * tests/debugger/script-trace.test.js
 *
 * Verifies Everscript bytecode execution logging and disassembly.
 * Tests interwoven script execution tracking, raw bytes extraction,
 * and human-readable disassembly matching map editor script snippets.
 */

const assert = require('assert');
const path   = require('path');
const fs     = require('fs');

const {
  decodeScriptSnippet,
  processScriptTraceBatch,
  loadFallbackRom,
  isValidScriptAddr,
} = require('../../src/emulator/script-trace');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log('Script Trace Subsystem Tests:');

// Test 1: decodeScriptSnippet with synthetic buffer
test('decodeScriptSnippet decodes synthetic instruction bytes into summary', () => {
  const addr = 0x938740;
  const offset = (addr & ~0xc00000) >>> 0;
  const rom = new Uint8Array(offset + 32);

  // Opcode 0x29 (CALL ABS)
  rom[offset + 0] = 0x29;
  rom[offset + 1] = 0x1E;
  rom[offset + 2] = 0x80;
  rom[offset + 3] = 0x92;

  const snippet = decodeScriptSnippet(rom, addr, 1);
  assert.ok(snippet, 'Snippet should not be null');
  assert.strictEqual(snippet.length, 1);
  assert.strictEqual(snippet[0].addrHex, '0x938740');
  assert.ok(snippet[0].bytesHex.length > 0, 'Bytes hex should be populated');
  assert.ok(snippet[0].summary.includes('CALL'), 'Summary should decode CALL');
});

// Test 2: Real ROM decoding if ROM file exists
test('decodeScriptSnippet decodes real ROM scripts when available', () => {
  const wsRoot = path.join(__dirname, '..', '..');
  const rom = loadFallbackRom(wsRoot);
  if (!rom) {
    console.log('    (Skipping ROM-dependent check: ROM not found in workspace)');
    return;
  }

  // Known instruction at 0x93874D: IF $2834&0x01 THEN SKIP 11 (to 0x93875e)
  const snippet = decodeScriptSnippet(rom, 0x93874D, 2);
  assert.ok(snippet && snippet.length >= 1, 'Snippet should decode at 0x93874D');
  assert.strictEqual(snippet[0].addrHex, '0x93874D');
  assert.strictEqual(snippet[0].bytesHex, '08 8A 00 00 0B 00');
  assert.ok(snippet[0].summary.includes('IF $2834&0x01 THEN SKIP 11'), `Unexpected summary: ${snippet[0].summary}`);
  if (snippet.length > 1) {
    assert.strictEqual(snippet[1].addrHex, '0x938753');
  }
});

// Test 3: Interwoven batch execution
test('processScriptTraceBatch handles interwoven slots and state transitions', () => {
  const wsRoot = path.join(__dirname, '..', '..');
  const rom = loadFallbackRom(wsRoot);

  const batch = [
    { slot: 0, entity: 0x0000, event: 'start', loc: 0x93874D, bytes: [0x08, 0x8A, 0x00, 0x00, 0x0B, 0x00] },
    { slot: 2, entity: 0x0014, event: 'start', loc: 0x928000, bytes: [0x94, 0x02, 0x31, 0x00, 0x1C] },
    { slot: 0, entity: 0x0000, event: 'resume', loc: 0x938753, bytes: [0x29, 0x2B, 0x4C, 0x00] },
    { slot: 2, entity: 0x0014, event: 'end', loc: 0x928010, bytes: [0x00] },
  ];

  const results = processScriptTraceBatch(batch, rom, wsRoot);
  assert.strictEqual(results.length, 4, 'Should process all 4 interwoven events');

  assert.strictEqual(results[0].slot, 0);
  assert.strictEqual(results[0].event, 'start');
  assert.strictEqual(results[0].locHex, '0x93874D');
  assert.ok(results[0].line.includes('[Slot 0 | Ent 0000 | start]'), `Line missing slot tag: ${results[0].line}`);

  assert.strictEqual(results[1].slot, 2);
  assert.strictEqual(results[1].event, 'start');
  assert.strictEqual(results[1].locHex, '0x928000');

  assert.strictEqual(results[2].slot, 0);
  assert.strictEqual(results[2].event, 'resume');
  assert.strictEqual(results[2].locHex, '0x938753');

  assert.strictEqual(results[3].slot, 2);
  assert.strictEqual(results[3].event, 'end');
});

// Test 4: ASCII-only invariant across emulator sources
test('script-trace.js, panel.js, and panel-webview.js are strictly ASCII-only', () => {
  const files = [
    path.join(__dirname, '..', '..', 'src', 'emulator', 'script-trace.js'),
    path.join(__dirname, '..', '..', 'src', 'emulator', 'panel.js'),
    path.join(__dirname, '..', '..', 'src', 'emulator', 'panel-webview.js'),
  ];
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const nonAscii = /[^\x09\x0A\x0D\x20-\x7E]/.test(content);
    assert.strictEqual(nonAscii, false, `${path.basename(f)} contains non-ASCII characters`);
  }
});

// Test 5: isValidScriptAddr rejects cold-RAM fill and invalid addresses
test('isValidScriptAddr rejects 0x555555 cold RAM fill and non-ROM addresses', () => {
  assert.strictEqual(isValidScriptAddr(0x555555), false, '0x555555 should be rejected');
  assert.strictEqual(isValidScriptAddr(0), false, '0 should be rejected');
  assert.strictEqual(isValidScriptAddr(0xFFFFFF), false, '0xFFFFFF should be rejected');
  assert.strictEqual(isValidScriptAddr(0x7E28FC), false, 'WRAM address 0x7E28FC should be rejected');
  assert.strictEqual(isValidScriptAddr(0x008000), false, 'Low bank 0x00 should be rejected');
  assert.strictEqual(isValidScriptAddr(0x928000), true, 'Valid ROM address 0x928000 should be accepted');
  assert.strictEqual(isValidScriptAddr(0xBC8000), true, 'Room enter script address 0xBC8000 should be accepted');
});

// Test 6: processScriptTraceBatch rejects cold-RAM 0x555555 garbage
test('processScriptTraceBatch filters out 0x555555 cold RAM boot events', () => {
  const batch = [
    { slot: 0, entity: 0x0000, event: 'end', loc: 0x555555 },
    { slot: 1, entity: 0x0000, event: 'end', loc: 0x555555 },
    { slot: 2, entity: 0x0000, event: 'start', loc: 0x928000, bytes: [0x00] },
  ];
  const results = processScriptTraceBatch(batch, null, null);
  assert.strictEqual(results.length, 1, 'Should filter out both 0x555555 events');
  assert.strictEqual(results[0].slot, 2);
  assert.strictEqual(results[0].locHex, '0x928000');
});

// Test 7: Enter script start normalization and timestamp preservation
test('processScriptTraceBatch preserves timestamps and decodes Room 0x15 enter script', () => {
  const snesAddr = 0xBC8000;
  const offset = (snesAddr & ~0xc00000) >>> 0;
  const syntheticRom = new Uint8Array(offset + 32);
  // Gain Spear 4 (14 E9 01 E8), Call Fade In (A3 36), End (00)
  syntheticRom.set([0x14, 0xe9, 0x01, 0xe8, 0xa3, 0x36, 0x00], offset);

  // Even if reported at 0xBC8006 due to single-frame execution:
  const batch = [
    {
      slot: 0,
      entity: 0x4E89,
      event: 'start',
      loc: 0xBC8006,
      timeStr: '+0.12s, f7',
      frame: 7,
    },
  ];

  const results = processScriptTraceBatch(batch, syntheticRom, null);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].locHex, '0xBC8000', 'Should normalize to enter script entry point 0xBC8000');
  assert.strictEqual(results[0].timeStr, '+0.12s, f7');
  assert.strictEqual(results[0].frame, 7);
  assert.ok(results[0].summary.includes('Laser Lance'), `Expected Laser Lance summary, got: ${results[0].summary}`);
  assert.ok(results[0].subLines.length >= 2, 'Should have subLines for Fade in and End');
  assert.ok(results[0].subLines[0].includes('CALL'), `Expected CALL in subLines[0]: ${results[0].subLines[0]}`);
  assert.ok(results[0].subLines[1].includes('END'), `Expected END in subLines[1]: ${results[0].subLines[1]}`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

