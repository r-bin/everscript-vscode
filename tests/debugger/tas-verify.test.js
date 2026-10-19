// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

/**
 * The replay check (src/platform/tas/verify.ts): reading replay.js's result, and, with a local Secret of Evermore
 * ROM (from the ROM library), checking a real movie headless: OK, resumed from a state the
 * first check left, and a tampered write reported as a desync.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const movie = require('../../dist/platform/tas/movie');
const { verifyMovie, interpret, latestState } = require('../../dist/platform/tas/verify');

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); console.log(`  [PASS] ${name}`); passed++; }
    catch (e) { console.error(`  [FAIL] ${name}\n    ${e.stack || e.message}`); failed++; }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-tas-verify-'));

(async () => {
    console.log('TAS replay check tests:');

    await test('replay.js results are read: ok, desync with frame, anything else is an error', () => {
        assert.deepStrictEqual(interpret(0, 'replayed 100 frames, 3 checksums matched\n', ''), { ok: true, summary: 'replayed 100 frames, 3 checksums matched' });
        assert.deepStrictEqual(interpret(2, '', 'DESYNC at frame 600: expected vram AB, got CD\n'), { ok: false, desync: { frame: 600, detail: 'expected vram AB, got CD' } });
        assert.ok(interpret(1, '', 'the movie was recorded on core X\n').error.includes('core X'));
        assert.strictEqual(latestState(path.join(tmp, 'nothing')), null);
    });

    await test('a real movie checks OK, resumes from the state the first check left, and a tampered write desyncs', async () => {
        const rom = require('../../dist/games').romPath('evermore');
        if (!rom) { console.log('    (skipped: no local ROM)'); return; }
        const pads = Array.from({ length: 1500 }, (_, i) => (i % 50 < 3 ? 0x1000 : 0));
        // checksums from a collect run, put into the movie like a recording would
        const header = movie.evsmvHeader({ rom: 'x', romSha256: '', started: 't' });
        const bare = path.join(tmp, 'bare.evsmv');
        const body = (withChecks) => pads.map((p, i) => (i === 100 ? 'W|7E1F00|DEADBEEF\n' : '') + (withChecks[i] || '') + movie.frameLine(p)).join('\n') + '\n';
        fs.writeFileSync(bare, header + body({}));
        const { execFileSync } = require('child_process');
        const lines = execFileSync(process.execPath, [path.join(__dirname, '../../tools/cdl/replay.js'), bare, rom, '--collect', '300'], { encoding: 'utf8' }).trim().split('\n');
        const checks = {};
        for (const l of lines) { const [f, wram, spaces] = l.split(' '); checks[f] = 'S|' + wram + '\nT|' + spaces + '\n'; }
        const file = path.join(tmp, 'live.evsmv');
        fs.writeFileSync(file, header + body(checks));
        const first = await verifyMovie({ node: process.execPath, movie: file, rom });
        assert.strictEqual(first.ok, true, JSON.stringify(first));
        assert.strictEqual(first.fromState, null);
        assert.ok(latestState(file.replace(/\.evsmv$/, '') + '.states'), 'the check left a state');
        const second = await verifyMovie({ node: process.execPath, movie: file, rom });
        assert.strictEqual(second.ok, true, JSON.stringify(second));
        assert.ok(second.fromState, 'the second check resumed from a state');
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('DEADBEEF', 'DEADBEEE'));
        fs.rmSync(file.replace(/\.evsmv$/, '') + '.states', { recursive: true, force: true });
        const bad = await verifyMovie({ node: process.execPath, movie: file, rom });
        assert.strictEqual(bad.ok, false);
        assert.ok(bad.desync && bad.desync.frame === 300, JSON.stringify(bad));
    });

    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
