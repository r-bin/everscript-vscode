// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// The host bundle (tools/bundle.mts -> bundle/extension.js, the package's main): it builds, it
// activates like src/extension.js (the activation test run against it), and the functions the pages
// splice in with .toString() keep their names.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const BUNDLE = path.join(ROOT, 'bundle', 'extension.js');
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log('host bundle:');

test('tools/bundle.mts builds bundle/extension.js', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'bundle.mts')], { cwd: ROOT, encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr || r.stdout);
    assert.ok(fs.existsSync(BUNDLE));
    // A relative require that resolves nowhere fails at runtime (v0.272.0: Terranigma Maps' ../../../dist).
    assert.ok(!/unresolved/.test(r.stdout + r.stderr), 'every relative require resolves:\n' + (r.stdout + r.stderr));
});

test('package.json main is the bundle', () => {
    assert.strictEqual(require(path.join(ROOT, 'package.json')).main, './bundle/extension.js');
});

test('the bundle activates and registers every command (activation test)', () => {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'activation.test.js')], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, EVS_MAIN: BUNDLE } });
    assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
});

test('functions spliced with .toString() keep their names', () => {
    const text = fs.readFileSync(BUNDLE, 'utf8');
    for (const name of ['parseRoomTriggers', 'calculateTriggerBox', 'resolveScriptIdToSnes']) {
        assert.ok(text.includes(`function ${name}(`), `${name} is renamed in the bundle`);
        assert.ok(!new RegExp(`function ${name}\\d+\\(`).test(text), `${name} has a renamed twin`);
    }
});

test('__dirname points at each module\'s own folder', () => {
    const text = fs.readFileSync(BUNDLE, 'utf8');
    assert.ok(!/(^|[^\w$])__dirname\b(?!, '\.\.', p\))/m.test(text.replace(/const __evsPath = \(p\) => require\('path'\)\.join\(__dirname, '\.\.', p\);/, '')), 'a bare __dirname is left');
    for (const m of text.matchAll(/__evsPath\("([^"]+)"\)/g)) assert.ok(fs.existsSync(path.join(ROOT, m[1])), `${m[1]} does not exist`);
});

if (failed) process.exit(1);
