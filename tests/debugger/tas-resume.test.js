// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

/**
 * Continuing a session from the ROM picker (tas/resume.ts, tas/host.ts): the page's snapshot is kept
 * next to the recording with the movie's length at that moment, the picker lists it by ROM, resume()
 * sends the state plus the frames recorded after it, and a continue appends to the same file so the
 * movie still replays from power-on. Whether a state reproduces the run is tas-states.test.js.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');

const movie = require('../../dist/platform/tas/movie');
const { listResumable, readResume } = require('../../dist/core/emulator/tas/resume');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (e) {
        console.error(`  [FAIL] ${name}`);
        console.error(`    ${e.stack || e.message}`);
        failed++;
    }
}

function loadHost() {
    const origLoad = Module._load;
    Module._load = function (req, ...rest) {
        if (req === 'vscode') {
            return {
                workspace: { getConfiguration: () => ({ get: (k, d) => d }) },
                window: { showWarningMessage: async () => 'Delete', showErrorMessage: () => {} },
                commands: { executeCommand: () => {} },
                Uri: { file: p => ({ fsPath: p }) },
            };
        }
        return origLoad.call(this, req, ...rest);
    };
    try {
        delete require.cache[require.resolve('../../dist/core/emulator/tas/host')];
        return require('../../dist/core/emulator/tas/host');
    } finally {
        Module._load = origLoad;
    }
}

/** n frame lines with pad word `pad` (text the page sends in tasRecFrames). */
const frames = (n, pad) => Array.from({ length: n }, () => movie.frameLine(pad)).join('\n') + '\n';

console.log('TAS resume Tests:');

test('snapshot, list by ROM, resume with the tail, continue appends to the same recording', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-resume-'));
    try {
        const { TasHost } = loadHost();
        const posted = [];
        const host = new TasHost(tmp, m => posted.push(m), () => {});
        const rom = Buffer.alloc(1024, 7);
        const sha = crypto.createHash('sha256').update(rom).digest('hex');
        host.romStarted(rom);
        const dir = path.join(tmp, 'tas-recordings');

        host.handle({ command: 'tasRecStart', name: 'Game.smc' });
        host.handle({ command: 'tasRecFrames', text: frames(700, 0x8000), frames: 700, live: true });
        const state = Buffer.from(Array.from({ length: 4096 }, (_, i) => i & 255));
        // A snapshot that is not at the recording's end (frames still unsent) is refused.
        host.handle({ command: 'tasSnapshot', frame: 650, state: state.toString('base64'), thumb: 'data:image/png;base64,AA' });
        const file = fs.readdirSync(dir).find(n => n.endsWith('.evsmv'));
        assert.strictEqual(readResume(path.join(dir, file)), null);
        host.handle({ command: 'tasSnapshot', frame: 700, state: state.toString('base64'), thumb: 'data:image/png;base64,AA' });
        const meta = readResume(path.join(dir, file));
        assert.strictEqual(meta.frame, 700);
        assert.strictEqual(meta.offset, fs.statSync(path.join(dir, file)).size);
        assert.strictEqual(meta.romSha256, sha);

        // Played on after the snapshot, then the panel closed: those frames are the tail.
        host.handle({ command: 'tasRecFrames', text: 'S|0000ABCD\n' + frames(50, 0x0080), frames: 50, live: true });
        host.handle({ command: 'tasRecEnd' });

        const byRom = listResumable(dir);
        assert.deepStrictEqual([...byRom.keys()], [sha]);
        const session = byRom.get(sha)[0];
        assert.strictEqual(session.id, 'file:' + file);
        assert.strictEqual(session.frame, 700);
        assert.strictEqual(session.thumb, 'data:image/png;base64,AA');

        host.resume(session.id);
        const r = posted.find(m => m.command === 'tasResume');
        assert.ok(r, 'tasResume sent: ' + JSON.stringify(posted.filter(m => m.command === 'tasStatus')));
        assert.strictEqual(r.frame, 700);
        assert.strictEqual(r.count, 750);
        assert.ok(Buffer.from(r.state, 'base64').equals(state), 'the state comes back unchanged');
        const pads = new Uint16Array(new Uint8Array(Buffer.from(r.pads, 'base64')).buffer);
        assert.strictEqual(pads.length, 50);
        assert.ok(pads.every(p => p === 0x0080), 'the tail is the frames after the snapshot');
        assert.deepStrictEqual(r.events.map(e => [e.frame, e.kind]), [[700, 'S']], 'tail events at absolute frames');

        // The page loaded the state and caught up: the recording goes on in the same file.
        host.handle({ command: 'tasRecContinue', id: session.id });
        host.handle({ command: 'tasRecFrames', text: frames(10, 0x4000), frames: 10, live: true });
        host.handle({ command: 'tasRecEnd' });
        assert.strictEqual(fs.readdirSync(dir).filter(n => n.endsWith('.evsmv')).length, 1, 'no second recording');
        const text = fs.readFileSync(path.join(dir, file), 'utf8');
        const m = movie.parseMovie(text, file);
        assert.strictEqual(m.count, 760);
        assert.strictEqual(m.pads[759], 0x4000);
        assert.ok(/# continued: \S+ at frame 750/.test(text));
        assert.ok(text.trimEnd().endsWith('# cheats: no'), 'a trailer closes the continued part too');

        // Another ROM does not continue it.
        host.romStarted(Buffer.alloc(1024, 8));
        posted.length = 0;
        host.resume(session.id);
        assert.ok(!posted.some(x => x.command === 'tasResume'));
        assert.ok(posted.some(x => x.command === 'tasStatus' && /another ROM/.test(x.text)));

        // Deleting the recording deletes its snapshot.
        host.handle({ command: 'tasDelete', id: session.id, confirmed: true });
        assert.deepStrictEqual(fs.readdirSync(dir).filter(n => !n.endsWith('.json') || n.includes('resume')), []);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('no snapshot before frame 600 or of an idle session', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-resume-'));
    try {
        const { TasHost } = loadHost();
        const host = new TasHost(tmp, () => {}, () => {});
        host.romStarted(Buffer.alloc(1024, 7));
        host.handle({ command: 'tasRecStart', name: 'Game.smc' });
        host.handle({ command: 'tasRecFrames', text: frames(300, 0x8000), frames: 300, live: true });
        host.handle({ command: 'tasSnapshot', frame: 300, state: 'AAAA', thumb: '' });
        host.handle({ command: 'tasRecEnd' });
        assert.strictEqual(listResumable(path.join(tmp, 'tas-recordings')).size, 0);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});

test('a sync mark above the last continue no longer counts', () => {
    const head = movie.evsmvHeader({ rom: 'G', romSha256: 'ab', started: 'x' }) + frames(2, 0);
    assert.ok(movie.parseMovie(head + '# synced: 2026-10-20\n', 'a').meta.synced);
    const cont = head + '# synced: 2026-10-20\n# continued: 2026-10-21 at frame 2\n' + frames(1, 0);
    assert.strictEqual(movie.parseMovie(cont, 'a').meta.synced, '');
    assert.ok(movie.parseMovie(cont + '# synced: 2026-10-22\n', 'a').meta.synced, 'a later full replay marks it again');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
