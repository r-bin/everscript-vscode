// TODO port to TS (docs/todo/port-to-ts.md)
// CDL deltas reach the disk exactly once (core/emulator/cdl/host.ts, rescue.ts, platform/cdl/library.ts `delivered`):
// the host acknowledges a delta only after the write that holds it, and a delta a page kept and hands over later
// (its host died) is merged unless the library already holds it. Hit counters are summed, so the test counts hits.
// No ROM, no browser. Run: node tests/debugger/cdl-rescue.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); failed++; }
}

const load = Module._load;
Module._load = function (req, ...rest) {
    if (req === 'vscode') return { workspace: { getConfiguration: () => ({ get: (k, d) => d }) }, window: { showInformationMessage: () => {}, showErrorMessage: () => {} } };
    return load.call(this, req, ...rest);
};
const { CdlHost } = require('../../dist/core/emulator/cdl/host');
const { CdlLibrary } = require('../../dist/platform/cdl/library');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-cdl-rescue-'));
const rom = new Uint8Array(0x20000);
rom.set(Buffer.from('RESCUE TEST'.padEnd(21, ' ')), 0xFFC0);
rom[0xFFD5] = 0x21;

/** A page delta that hits ROM offset 0x100 `n` times, numbered like the page does. */
const delta = (session, seq, n) => ({ session, seq, romHits: Buffer.from(Uint32Array.from([0x100, n]).buffer).toString('base64') });

function host(root) {
    const posted = [];
    const h = new CdlHost(root, m => posted.push(m), () => {}, { wanted: { get: () => true, set: () => {} } });
    h.romStarted(rom);
    h.handle({ command: 'cdlEnable' });
    return { h, posted };
}

test('a delta is acknowledged only after the write that holds it, and the write records its number', () => {
    const root = path.join(tmp, 'ack');
    const { h, posted } = host(root);
    const seed = posted.find(m => m.command === 'cdlSeed');
    assert.ok(seed.lib && seed.lib.hash && seed.lib.romSize === rom.length, 'the page learns which library it records into');
    h.handle({ command: 'cdlDelta', delta: delta('s1', 1, 5) });
    h.handle({ command: 'cdlPause' });
    assert.ok(!posted.some(m => m.command === 'cdlSaved'), 'merged in memory is not saved');
    h.flushNow();
    assert.deepStrictEqual(posted.filter(m => m.command === 'cdlSaved').pop(), { command: 'cdlSaved', session: 's1', seq: 1 });
    const manifest = JSON.parse(fs.readFileSync(path.join(h.lib.dir, 'manifest.json'), 'utf8'));
    assert.deepStrictEqual(manifest.delivered, { s1: 1 });
    h.dispose();
});

test('a failed write acknowledges nothing', () => {
    const root = path.join(tmp, 'fail');
    const { h, posted } = host(root);
    h.handle({ command: 'cdlDelta', delta: delta('s1', 1, 5) });
    const flush = h.lib.flush;
    h.lib.flush = () => { throw new Error('disk full'); };
    h.flushNow();
    assert.ok(!posted.some(m => m.command === 'cdlSaved'));
    assert.ok(posted.some(m => m.command === 'emuAlert' && /NOT SAVED/.test(m.text)));
    h.lib.flush = flush;
    h.flushNow();
    assert.ok(posted.some(m => m.command === 'cdlSaved' && m.seq === 1), 'the retry that works does');
    h.dispose();
});

test('the host dies after a write: the rescue merges only what that write did not hold (counters not doubled)', () => {
    const root = path.join(tmp, 'rescue');
    const a = host(root);
    a.h.handle({ command: 'cdlDelta', delta: delta('s1', 1, 5) });
    a.h.handle({ command: 'cdlDelta', delta: delta('s1', 2, 7) });
    a.h.flushNow();                                          // on disk: 12 hits, delivered s1 = 2
    a.h.handle({ command: 'cdlDelta', delta: delta('s1', 3, 100) });
    a.h.handle({ command: 'cdlDelta', delta: delta('s1', 4, 1000) });
    const lib = { hash: a.h.lib.hash, romSize: a.h.lib.romSize };
    // ...the host dies here (no write, no ack for 3 and 4). The page kept 2, 3, 4: the ack for 2 may not have arrived.
    clearTimeout(a.h.flushTimer);
    const b = host(root);
    b.h.handle({ command: 'cdlRescue', session: 's1', at: Date.now(), entries: [3, 2, 4].map(seq => ({ seq, lib, delta: delta('s1', seq, [0, 5, 7, 100, 1000][seq]) })) });
    assert.ok(b.posted.some(m => m.command === 'cdlRescued' && m.session === 's1'), 'the page may forget it');
    const disk = CdlLibrary.open(path.join(root, 'cdl-library'), lib.hash, lib.romSize);
    assert.strictEqual(disk.romHits[0x100], 1112, '5 + 7 + 100 + 1000: delta 2 was on disk, 3 and 4 are now');
    assert.strictEqual(disk.delivered.s1, 4);
    // Handed over twice (the page did not hear cdlRescued): nothing changes.
    b.h.handle({ command: 'cdlRescue', session: 's1', at: Date.now(), entries: [{ seq: 4, lib, delta: delta('s1', 4, 1000) }] });
    assert.strictEqual(CdlLibrary.open(path.join(root, 'cdl-library'), lib.hash, lib.romSize).romHits[0x100], 1112);
    b.h.dispose();
});

test('a rescue for another ROM\'s library goes there, not into the open one', () => {
    const root = path.join(tmp, 'other');
    const { h } = host(root);
    const other = { hash: 'f'.repeat(40), romSize: 0x40000 };
    h.handle({ command: 'cdlRescue', session: 's9', at: Date.now(), entries: [{ seq: 1, lib: other, delta: delta('s9', 1, 3) }] });
    assert.strictEqual(CdlLibrary.open(path.join(root, 'cdl-library'), other.hash, other.romSize).romHits[0x100], 3);
    assert.strictEqual(h.lib.romHits[0x100], 0);
    h.dispose();
});

Module._load = load;
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
