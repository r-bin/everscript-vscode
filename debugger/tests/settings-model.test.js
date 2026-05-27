'use strict';

const assert = require('assert');
const { buildRepoDefaults, resolveExtConfig, getRepoAutofillUpdates } = require('../../settings-model');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
    }
}

console.log('settings-model:');

test('buildRepoDefaults derives the expected project paths', () => {
    const out = buildRepoDefaults('/tmp/everscript', null);
    assert.strictEqual(out.inDirectory, '/tmp/everscript/in');
    assert.strictEqual(out.patchesDirectory, '/tmp/everscript/patches');
    assert.strictEqual(out.romPath, '/tmp/everscript/Secret of Evermore (U) [!].smc');
    assert.strictEqual(out.compilerPath, '/tmp/everscript/everscript.py');
    assert.strictEqual(out.pythonPath, '/tmp/everscript/.venv/bin/python3');
});

test('resolveExtConfig prefers explicit settings over derived repo defaults', () => {
    const out = resolveExtConfig({
        repoPath: '/tmp/everscript',
        inDirectory: '/custom/in',
        patchesDirectory: '/custom/patches',
        romPath: '/roms/soe.smc',
        compilerPath: '/bin/everscript',
        pythonPath: '/bin/python3',
    }, '/workspace');
    assert.strictEqual(out.inDirectory, '/custom/in');
    assert.strictEqual(out.patchesDirectory, '/custom/patches');
    assert.strictEqual(out.romPath, '/roms/soe.smc');
    assert.strictEqual(out.compilerPath, '/bin/everscript');
    assert.strictEqual(out.pythonPath, '/bin/python3');
});

test('resolveExtConfig falls back to workspace defaults when repoPath is empty', () => {
    const out = resolveExtConfig({}, '/workspace');
    assert.strictEqual(out.inDirectory, '/workspace/in');
    assert.strictEqual(out.patchesDirectory, '/workspace/patches');
    assert.strictEqual(out.romPath, '/workspace/Secret of Evermore (U) [!].smc');
});

test('resolveExtConfig still honors legacy patchesPath when patchesDirectory is empty', () => {
    const out = resolveExtConfig({ repoPath: '/tmp/everscript', patchesPath: '/legacy/patches' }, null);
    assert.strictEqual(out.patchesDirectory, '/legacy/patches');
});

test('getRepoAutofillUpdates only suggests missing fields', () => {
    const out = getRepoAutofillUpdates({
        repoPath: '/tmp/everscript',
        inDirectory: '',
        patchesDirectory: '',
        romPath: '',
        compilerPath: '/manual/compiler',
        pythonPath: '',
    }, null);
    assert.strictEqual(out.inDirectory, '/tmp/everscript/in');
    assert.strictEqual(out.patchesDirectory, '/tmp/everscript/patches');
    assert.strictEqual(out.romPath, '/tmp/everscript/Secret of Evermore (U) [!].smc');
    assert.strictEqual(out.pythonPath, '/tmp/everscript/.venv/bin/python3');
    assert.ok(!Object.prototype.hasOwnProperty.call(out, 'compilerPath'), 'compilerPath should not be auto-filled when explicitly set');
});

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);