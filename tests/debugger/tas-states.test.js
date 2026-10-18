'use strict';

/**
 * Save states taken during a headless replay (tools/cdl/replay-states.js): resuming from one gives the
 * checksums of the uninterrupted run in every memory space. Needs a local Secret of Evermore ROM
 * (from the ROM library); skipped without it. The ROM is only read.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const movie = require('../../dist/platform/tas/movie');
const { frameOfStateFile } = require('../../tools/cdl/replay-states');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  [PASS] ${name}`); passed++; }
    catch (e) { console.error(`  [FAIL] ${name}\n    ${e.stack || e.message}`); failed++; }
}

console.log('TAS state tests:');
const rom = require('../../dist/games').romPath('evermore');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-tas-states-'));
const tool = path.join(ROOT, 'tools/cdl/replay.js');
const run = args => execFileSync(process.execPath, [tool, ...args], { encoding: 'utf8', timeout: 240000 });

test('state file names carry the frame', () => {
    assert.strictEqual(frameOfStateFile('/x/f000001200-r0a.state.gz'), 1200);
    assert.throws(() => frameOfStateFile('state.gz'));
});

test('resuming from a state gives the checksums of the uninterrupted run, in every space', () => {
    if (!rom) { console.log('    (skipped: no local ROM)'); return; }
    const pads = [];
    for (let i = 0; i < 1800; i++) pads.push(i % 50 < 3 ? 0x1000 : (i % 97 < 5 ? 0x0100 : 0));
    const body = pads.map((p, i) => (i === 100 ? 'W|7E1F00|DEADBEEF\n' : i === 700 ? 'R|soft\n' : i === 1000 ? 'W|7E1F10|01\n' : '') + movie.frameLine(p)).join('\n') + '\n';
    const file = path.join(tmp, 'm.evsmv');
    fs.writeFileSync(file, movie.evsmvHeader({ rom: 'x', romSha256: '', started: 't' }) + body);
    const dir = path.join(tmp, 'm.states');
    const full = run([file, rom, '--collect', '300', '--states', dir, '--state-every', '600']).trim().split('\n');
    const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    assert.deepStrictEqual(index.states.map(s => s.frame), [600, 1200], 'no state while booting (before frame 600), then the first room, then every 600 frames');
    for (const st of index.states.filter(s => s.frame >= 600)) {
        const resumed = run([file, rom, '--collect', '300', '--from-state', path.join(dir, st.file)]).trim().split('\n').filter(l => /^\d+ /.test(l));
        const tail = full.filter(l => /^\d+ /.test(l) && parseInt(l, 10) >= st.frame);
        assert.deepStrictEqual(resumed, tail, 'from frame ' + st.frame + ' (a reset at 700 and a write at 1000 are replayed after it)');
    }
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
