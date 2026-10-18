'use strict';
// Everscript round trip: decompile room scripts into structured Everscript and
// compile them back with the sibling everscript compiler. The bytes must equal
// the ROM's — the emitted code is functionally identical because it *is* the
// same program.
//
// The ROM-only checks (shape of the tree, the Thraxx gourd's text) run with
// just the ROM. The compile step also needs the everscript checkout and its
// .venv (EVERSCRIPT_REPO, default ../everscript); without it, it is skipped.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildRoomScriptModel } = require('../../src/games/evermore/script-model');
/** HiROM: the file offset of a bus address. */
const fileOf = (bus) => bus & 0x3fffff;
const sim = require('../../src/games/evermore/simulation');

const REPO = process.env.EVERSCRIPT_REPO || path.join(__dirname, '..', '..', '..', 'everscript');
const ROM = require('../../dist/games').romPath('evermore');
if (!fs.existsSync(ROM)) { console.log('SKIP simulation everscript: no ROM'); process.exit(0); }
const rom = new Uint8Array(fs.readFileSync(ROM));
const S = sim.createSimulator(rom);

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}
const romHex = (entry, n) => {
    const o = fileOf(entry);
    return Array.from(rom.slice(o, o + n), (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
};

test('the Thraxx gourd decompiles into nested if / else', () => {
    const e = S.emit(0x94e0ed, 'gourd');
    assert.ok(e.structured);
    const top = e.tree[0];
    assert.strictEqual(top.kind, 'if');
    assert.ok(top.negated, 'opcode 0x08 is if!');
    assert.strictEqual(top.cond, '<0x2266, 0x80>');
    const inner = top.then[0];
    assert.strictEqual(inner.cond, '<0x2260, 0x10>');
    assert.ok(/= CALL_BEADS;/.test(inner.then[0].summary) && /= BISCUIT;/.test(inner.else[0].summary), `${inner.then[0].summary} / ${inner.else[0].summary}`);
    assert.ok(e.everscript.includes('call_id(0x3a);'));
});

// Every enter script, step-on and B-trigger in the ROM.
const scripts = new Map();
for (let id = 0; id < 0x7f; id++) {
    const r = buildRoomScriptModel(rom, id);
    for (const t of [r.enter, ...r.stepOn, ...r.bTrigger]) scripts.set(t.scriptAddressSnes, null);
}
for (const entry of scripts.keys()) {
    try { scripts.set(entry, S.emit(entry, `s_${entry.toString(16)}`)); } catch { scripts.delete(entry); }
}
const emitted = [...scripts.values()];
const structured = emitted.filter((e) => e.structured).length;

test('most room scripts structure into if / else', () => {
    console.log(`    ${structured}/${emitted.length} structured, the rest raw`);
    assert.ok(structured / emitted.length > 0.8, `${structured}/${emitted.length}`);
});

const python = path.join(REPO, '.venv', 'bin', 'python');
if (!fs.existsSync(python)) {
    console.log('  - SKIP compile round trip: no everscript checkout with .venv at ' + REPO);
} else {
    test('every emitted script compiles back to the ROM bytes', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-roundtrip-'));
        const src = path.join(dir, 'all.evs');
        fs.writeFileSync(src, '#include("in/core")\n' + emitted.map((e) => e.everscript).join('\n'));
        const driver = path.join(dir, 'compile.py');
        fs.writeFileSync(driver, [
            'import sys, os, json',
            'sys.path.insert(0, os.getcwd())',
            'sys.argv = [sys.argv[0], "tests/_dummy.evs"]',
            'from tests.helpers import compile_functions, clean_byte_string',
            'names = json.load(open(os.environ["EVS_NAMES"]))',
            'out = compile_functions(open(os.environ["EVS_SRC"]).read(), names)',
            'print("JSON" + json.dumps({k: clean_byte_string(v) for k, v in out.items()}))',
        ].join('\n'));
        const namesFile = path.join(dir, 'names.json');
        fs.writeFileSync(namesFile, JSON.stringify(emitted.map((e) => `s_${e.entry.toString(16)}`)));
        const stdout = execFileSync(python, [driver], {
            cwd: REPO, env: { ...process.env, EVS_SRC: src, EVS_NAMES: namesFile },
            maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
        }).toString();
        const compiled = JSON.parse(stdout.slice(stdout.indexOf('JSON') + 4));
        const wrong = [];
        for (const e of emitted) {
            const got = compiled[`s_${e.entry.toString(16)}`];
            const want = romHex(e.entry, e.length);
            if (got !== want) {
                const g = (got || '').split(' '), w = want.split(' ');
                let i = 0;
                while (i < w.length && g[i] === w[i]) i++;
                wrong.push(`$${e.entry.toString(16)} (${e.structured ? 'structured' : 'raw'}) at +${i}: rom ${w.slice(i, i + 8).join(' ')} / compiled ${g.slice(i, i + 8).join(' ')}`);
            }
        }
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`    ${emitted.length - wrong.length}/${emitted.length} byte-identical`);
        assert.deepStrictEqual(wrong.slice(0, 10), []);
    });
}

console.log(`\nsimulation everscript: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
