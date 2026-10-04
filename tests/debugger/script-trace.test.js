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
  assert.ok(results[0].line.includes('[s0 | 0000 | start]'), `Line missing slot tag: ${results[0].line}`);

  assert.strictEqual(results[1].slot, 2);
  assert.strictEqual(results[1].event, 'start');
  assert.strictEqual(results[1].locHex, '0x928000');

  assert.strictEqual(results[2].slot, 0);
  assert.strictEqual(results[2].event, 'resume');
  assert.strictEqual(results[2].locHex, '0x938753');

  assert.strictEqual(results[3].slot, 2);
  assert.strictEqual(results[3].event, 'end');
});

// Test 4: ASCII-only invariant across emulator sources and grammar files
test('script-trace.js, panel.js, panel-webview.js, and grammar files are strictly ASCII-only', () => {
  const files = [
    path.join(__dirname, '..', '..', 'src', 'emulator', 'address-lookup.js'),
    path.join(__dirname, '..', '..', 'src', 'emulator', 'trace-formatter.js'),
    path.join(__dirname, '..', '..', 'src', 'emulator', 'script-trace.js'),
    path.join(__dirname, '..', '..', 'src', 'emulator', 'panel.js'),
    path.join(__dirname, '..', '..', 'src', 'emulator', 'panel-webview.js'),
    path.join(__dirname, '..', '..', 'src', 'language', 'syntaxes', 'everscript-trace.tmLanguage.json'),
    path.join(__dirname, '..', '..', 'src', 'language', 'trace-language-configuration.json'),
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

// Test 8: everscript-trace.tmLanguage.json structure and regex sanity
test('everscript-trace.tmLanguage.json parses and defines valid regex patterns', () => {
  const grammarPath = path.join(__dirname, '..', '..', 'src', 'language', 'syntaxes', 'everscript-trace.tmLanguage.json');
  const raw = fs.readFileSync(grammarPath, 'utf8');
  const grammar = JSON.parse(raw);
  assert.strictEqual(grammar.scopeName, 'source.evs-trace');
  assert.ok(grammar.repository, 'repository should be defined');
  assert.ok(grammar.repository.slot_tag, 'slot_tag repository pattern should be defined');
  assert.ok(grammar.repository.timestamp, 'timestamp repository pattern should be defined');
  assert.ok(grammar.repository.status_tags, 'status_tags repository pattern should be defined');

  // Verify all patterns compile as valid RegExp
  function checkPatterns(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (typeof obj.match === 'string') {
      assert.doesNotThrow(() => new RegExp(obj.match), `Invalid match regex: ${obj.match}`);
    }
    if (typeof obj.begin === 'string') {
      assert.doesNotThrow(() => new RegExp(obj.begin), `Invalid begin regex: ${obj.begin}`);
    }
    if (typeof obj.end === 'string') {
      assert.doesNotThrow(() => new RegExp(obj.end), `Invalid end regex: ${obj.end}`);
    }
    for (const v of Object.values(obj)) {
      if (typeof v === 'object') checkPatterns(v);
    }
  }
  checkPatterns(grammar);
});

// Test 9: RomAddressLookup resolves enter script, empty trigger, and draft triggers
test('RomAddressLookup resolves Room 0x15 enter script, empty trigger, and custom draft triggers', () => {
  const { RomAddressLookup } = require('../../src/emulator/address-lookup');
  const draft = {
    bTrigger: [
      { x1: 5, y1: 10, x2: 6, y2: 11, scriptId: 477 },
      { x1: 8, y1: 12, x2: 9, y2: 13, scriptId: 1854 },
    ],
    stepOn: [
      { x1: 2, y1: 3, x2: 2, y2: 3, scriptId: 477 },
    ],
  };

  const lookupTable = new RomAddressLookup(null, draft, 0x15);

  // 1. Enter script
  const enterLookup = lookupTable.lookup(0xBC8000);
  assert.ok(enterLookup, '0xBC8000 should be resolved');
  assert.strictEqual(enterLookup.room, 0x15);
  assert.strictEqual(enterLookup.kind, 'enter');
  assert.strictEqual(enterLookup.shortTag, '0x15.enter');

  // 2. Bare empty trigger (0x92A42F) attributed to room 0x15
  const emptyLookup = lookupTable.lookup(0x92A42F);
  assert.ok(emptyLookup, '0x92A42F should be resolved');
  assert.strictEqual(emptyLookup.room, 0x15);
  assert.strictEqual(emptyLookup.kind, 'bTrigger');
  assert.strictEqual(emptyLookup.shortTag, '0x15.b[0]');

  // 3. Fallback for unmapped address
  const unmapped = lookupTable.lookup(0x999999);
  assert.strictEqual(unmapped, null);
});

// Test 10: ScriptTraceFormatter formats text and html consistently with opcode at end
test('ScriptTraceFormatter generates consistent TextMate line and HTML row with opcode at end', () => {
  const { ScriptTraceFormatter } = require('../../src/emulator/trace-formatter');
  const formatter = new ScriptTraceFormatter();

  const item = {
    slot: 1,
    entity: 0x4E89,
    event: 'start',
    locHex: '0xBC8000',
    bytesHex: '14 E9 01 E8',
    summary: 'GAIN WEAPON 0x01e9 (Laser Lance)',
    timeStr: '+0.05s, f3',
  };

  const lookup = {
    room: 0x15,
    kind: 'enter',
    name: 'Room 0x15 Enter Script',
    shortTag: '0x15.enter',
  };

  const sub = {
    addrHex: '0xBC8004',
    summary: 'CALL "Fade In" (0x36)',
    bytesHex: 'A3 36',
    opcode: 0xa3,
    callKind: '8bit',
  };

  const text = formatter.formatText(item, lookup);
  assert.ok(text.includes('[+0.05s, f3]'), `Missing time in text: ${text}`);
  assert.ok(text.includes('[s1 | 4E89 | start]'), `Missing slot tag: ${text}`);
  assert.ok(text.includes('[0x15.enter]'), `Missing lookup tag: ${text}`);
  assert.ok(text.includes('0xBC8000: GAIN WEAPON 0x01e9 (Laser Lance) [14 E9 01 E8]'), `Opcode should be at end: ${text}`);

  const subText = formatter.formatSubText(sub);
  assert.strictEqual(subText, '  -> 0xBC8004: CALL "Fade In" (0x36) [A3 36]', `Unexpected subText: ${subText}`);

  const html = formatter.formatHtml(item, lookup, [sub]);
  assert.ok(html.includes('class="ss-trace-row start"'), `Missing row class: ${html}`);
  assert.ok(html.includes('class="ss-trace-lookup"'), `Missing lookup class: ${html}`);
  assert.ok(html.includes('[0x15.enter]'), `Missing lookup tag in html: ${html}`);
  assert.ok(html.includes('title="Room 0x15 Enter Script"'), `Missing lookup title: ${html}`);
  assert.ok(html.includes('<span class="ss-trace-bytes">[14 E9 01 E8]</span>'), `Missing main bytes at end in html: ${html}`);
  assert.ok(html.includes('class="ss-trace-sub start call-8bit"'), `Missing subline class in html: ${html}`);
  assert.ok(html.includes('<span class="ss-trace-arrow">  -&gt; </span>'), `Missing arrow in html: ${html}`);
  assert.ok(html.includes('<span class="ss-trace-bytes">[A3 36]</span>'), `Missing sub bytes at end in html: ${html}`);
});

// Test 11: processScriptTraceBatch with hideInactive option
test('processScriptTraceBatch handles hideInactive option and attaches lookup', () => {
  const draft = {
    bTrigger: [{ x1: 4, y1: 4, x2: 5, y2: 5, scriptId: 477 }],
  };

  const batch = [
    { slot: 0, entity: 0x0000, event: 'start', loc: 0xBC8000, bytes: [0x00] },
    { slot: 0, entity: 0x0000, event: 'end', loc: 0x92A42F, bytes: [0x00] },
  ];

  const results = processScriptTraceBatch(batch, null, null, draft, { hideInactive: true });
  assert.strictEqual(results.length, 2, 'Batch returns all processed items for webview');
  assert.ok(results[0].lookup, 'Results[0] should have lookup attached');
  assert.strictEqual(results[0].lookup.shortTag, '0x15.enter');
  assert.ok(results[0].html.includes('[0x15.enter]'), 'Results[0].html should contain lookup tag');
  assert.ok(results[1].lookup, 'Results[1] should have lookup attached');
  assert.strictEqual(results[1].lookup.shortTag, '0x15.b[0]');
});

// Test 12: 8-bit calls optional filtering
test('processScriptTraceBatch and formatter support optional 8-bit calls while preserving 16-bit and 24-bit calls', () => {
  const { ScriptTraceFormatter } = require('../../src/emulator/trace-formatter');
  const fmt = new ScriptTraceFormatter({ show8BitCalls: false });
  assert.strictEqual(fmt.is8BitCall(0xa3), true, '0xa3 is 8-bit call');
  assert.strictEqual(fmt.is8BitCall(0xa4), false, '0xa4 is 16-bit call');
  assert.strictEqual(fmt.is8BitCall(0x29), false, '0x29 is 24-bit call');

  const sub8 = { addrHex: '0xBC8004', summary: 'CALL 0x36', bytesHex: 'A3 36', opcode: 0xa3, callKind: '8bit' };
  const sub16 = { addrHex: '0x928100', summary: 'CALL 0x1234 -> 0x940000', bytesHex: 'A4 34 12', opcode: 0xa4, callKind: '16bit' };

  const subHtml8 = fmt.formatSubHtml(sub8);
  assert.ok(subHtml8.includes('call-8bit'), 'Should include call-8bit class for CSS toggle');

  const subHtml16 = fmt.formatSubHtml(sub16);
  assert.ok(!subHtml16.includes('call-8bit'), '16-bit call should not have call-8bit class');
  assert.ok(subHtml16.includes('call-16bit'), '16-bit call has call-16bit class');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

