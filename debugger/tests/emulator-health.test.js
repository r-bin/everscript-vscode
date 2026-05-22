'use strict';
/**
 * debugger/tests/emulator-health.test.js
 *
 * Validates the snes9x2005-wasm core assets bundled with the extension.
 * The EmulatorJS wrapper has been removed (v0.2.67+); we now load the
 * Emscripten-compiled core directly inside the VS Code webview.
 *
 * Checks:
 *   A) Core files exist at emulator/core/
 *   B) WASM binary has correct magic bytes
 *   C) Core JS contains all required Emscripten exports
 *   D) Core JS does NOT define EJS_Runtime (it is NOT a libretro wrapper)
 *   E) panel.js does not reference the old EmulatorJS vendor paths
 */

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const ROOT      = path.resolve(__dirname, '../..');
const CORE_DIR  = path.join(ROOT, 'emulator', 'core');
const CORE_JS   = path.join(CORE_DIR, 'snes9x_2005.js');
const CORE_WASM = path.join(CORE_DIR, 'snes9x_2005.wasm');
const PANEL_JS  = path.join(ROOT, 'emulator', 'panel.js');

// WebAssembly binary magic: \0asm  (00 61 73 6D)
const WASM_MAGIC = Buffer.from([0x00, 0x61, 0x73, 0x6d]);

let passed = 0;
let failed = 0;
const xfails = [];

function test(name, fn) {
    try {
        fn();
        console.log(`  \u2713 ${name}`);
        passed++;
    } catch (e) {
        console.error(`  \u2717 ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
}

function xtest(name, reason, fn) {
    try {
        fn();
        console.log(`  ~ xfail [passed \u2014 may be fixed] ${name}`);
        xfails.push({ name, reason: 'UNEXPECTEDLY PASSED \u2014 verify fix: ' + reason });
    } catch (e) {
        console.log(`  ~ xfail [expected]  ${name}`);
        xfails.push({ name, reason: e.message });
    }
}

// ── A. Core files ─────────────────────────────────────────────────────────────
console.log('\nA. Core files (emulator/core/):');

test('snes9x_2005.js exists', () => {
    assert.ok(fs.existsSync(CORE_JS), `snes9x_2005.js not found at ${CORE_JS}`);
});

test('snes9x_2005.wasm exists', () => {
    assert.ok(fs.existsSync(CORE_WASM), `snes9x_2005.wasm not found at ${CORE_WASM}`);
});

// ── B. WASM binary validation ─────────────────────────────────────────────────
console.log('\nB. WASM binary:');

test('snes9x_2005.wasm has correct magic bytes (\\0asm)', () => {
    const fd  = fs.openSync(CORE_WASM, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    assert.ok(WASM_MAGIC.equals(buf),
        `wrong magic bytes: ${buf.toString('hex')} (expected 0061736d)`);
});

// ── C. Required Emscripten exports ────────────────────────────────────────────
console.log('\nC. Required exports in snes9x_2005.js:');

let coreJsContent = null;
try { coreJsContent = fs.readFileSync(CORE_JS, 'utf8'); } catch (_) {}

const REQUIRED_EXPORTS = [
    '_mainLoop',
    '_startWithRom',
    '_getScreenBuffer',
    '_getSoundBuffer',
    '_setJoypadInput',
    '_my_malloc',
    '_my_free',
    '_saveState',
    '_getStateSaveSize',
];

for (const exp of REQUIRED_EXPORTS) {
    test(`core JS exports ${exp}`, () => {
        if (!coreJsContent) { assert.fail('snes9x_2005.js could not be read'); return; }
        assert.ok(coreJsContent.includes(exp),
            `"${exp}" not found in snes9x_2005.js`);
    });
}

// ── D. EJS_Runtime check ──────────────────────────────────────────────────────
// snes9x_2005.js is a standalone Emscripten build, NOT a libretro wrapper.
// It must NOT define EJS_Runtime. If it does, we accidentally bundled the wrong core.
console.log('\nD. EJS_Runtime (must be absent \u2014 we run the core directly, not via EmulatorJS):');

test('core JS does NOT define EJS_Runtime', () => {
    if (!coreJsContent) { assert.fail('snes9x_2005.js could not be read'); return; }
    assert.ok(!coreJsContent.includes('EJS_Runtime'),
        'snes9x_2005.js unexpectedly defines EJS_Runtime \u2014 wrong core bundled (should be lrusso standalone build)');
});

// ── E. panel.js sanity ────────────────────────────────────────────────────────
console.log('\nE. panel.js:');

let panelContent = null;
try { panelContent = fs.readFileSync(PANEL_JS, 'utf8'); } catch (_) {}

test('panel.js exists', () => {
    assert.ok(fs.existsSync(PANEL_JS), 'emulator/panel.js not found');
});

test('panel.js references emulator/core not emulator/vendor', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(!panelContent.includes('emulator/vendor'),
        'panel.js still references emulator/vendor — remove EmulatorJS dependency');
});

test('panel.js references CORE_JS constant', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('snes9x_2005.js'),
        'panel.js does not reference snes9x_2005.js');
});

test('panel.js exports openEmulatorPanel', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('module.exports') && panelContent.includes('openEmulatorPanel'),
        'panel.js does not export openEmulatorPanel');
});

test('panel.js arms write breakpoints with WRAM offsets', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('SCRIPT_BASE + slot * SLOT_SIZE'),
        'script stack hook does not appear to use WRAM offsets required by addWriteBreakpoint()');
});

test('panel.js resumes AudioContext after user interaction', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('audioCtx.resume()'),
        'panel.js does not resume AudioContext; webview audio may stay suspended');
});

test('panel.js reads Float32 planar audio blocks from the core', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('new Float32Array(HEAPF32.buffer, ptr, AUDIO_BLOCK_SIZE * 2)'),
        'panel.js does not appear to read the core audio buffer as Float32 planar samples');
});

test('panel.js applies transform-based canvas scaling', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes("canvas.style.transform = 'scale('"),
        'panel.js does not apply deterministic transform-based scaling to the screen canvas');
});

test('panel.js logs script hook arm and observed-write status', () => {
    if (!panelContent) { assert.fail('panel.js could not be read'); return; }
    assert.ok(panelContent.includes('debugHookStatus') && panelContent.includes('debugHookObserved'),
        'panel.js does not emit explicit hook lifecycle or observed-write log messages');
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
if (xfails.length) {
    console.log('  Known issues (xfail):');
    for (const x of xfails) {
        console.log(`    ~ ${x.name}`);
        console.log(`      ${x.reason}`);
    }
    console.log('');
}
console.log(`  ${passed} passed, ${failed} failed, ${xfails.length} xfail`);
console.log('');

if (failed > 0) process.exit(1);
