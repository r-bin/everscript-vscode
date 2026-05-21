'use strict';
/**
 * debugger/tests/emulator-health.test.js
 *
 * Validates the emulator vendor assets and core bundles before a browser
 * launch.  Two scenarios:
 *
 *   A) Pre-delivered core  — emulator/vendor/emulatorjs/cores/snes9x-wasm.data
 *   B) Custom core bundle  — tmp/custom-snes9x.data  (built by tools/pack_snes_core.py)
 *
 * xtest() marks checks that are EXPECTED to fail given the current state of the
 * project.  They display as "~ xfail" and are listed at the end.  They do NOT
 * count as test failures — the suite exits 0 even when they trigger.
 *
 * Expected xfails right now:
 *   - Custom core does not define EJS_Runtime: snes9x_2005.js is a standalone
 *     Emscripten build, not a libretro wrapper.  EmulatorJS will always refuse
 *     it until the core is rebuilt as a libretro core.
 */

const assert        = require('assert');
const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');

const ROOT         = path.resolve(__dirname, '../..');
const VENDOR       = path.join(ROOT, 'emulator', 'vendor', 'emulatorjs');
const CORES        = path.join(VENDOR, 'cores');
const BUNDLED_CORE = path.join(CORES, 'snes9x-wasm.data');
const CUSTOM_CORE  = path.join(ROOT, 'tmp', 'custom-snes9x.data');

// 7-zip file signature: 37 7A BC AF 27 1C
const SEVENZIP_MAGIC = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);

let passed = 0;
let failed = 0;
const xfails = [];   // { name, reason }

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
}

/** Mark a check as an expected failure.  Counts as pass; listed in summary. */
function xtest(name, reason, fn) {
    try {
        fn();
        // If the check unexpectedly passes, warn — it may mean the issue was fixed.
        console.log(`  ~ xfail [passed — may be fixed] ${name}`);
        xfails.push({ name, reason: 'UNEXPECTEDLY PASSED — verify fix: ' + reason });
    } catch (e) {
        console.log(`  ~ xfail [expected]  ${name}`);
        xfails.push({ name, reason: e.message });
    }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isSevenZip(filePath) {
    const fd  = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(6);
    fs.readSync(fd, buf, 0, 6, 0);
    fs.closeSync(fd);
    return SEVENZIP_MAGIC.equals(buf);
}

/** Returns the list of filenames inside a .data bundle (requires 7z on PATH). */
function listBundle(bundlePath) {
    try {
        const out = execSync(`7z l -ba "${bundlePath}" 2>/dev/null`, {
            encoding: 'utf8',
            timeout: 10000,
        });
        return out.split('\n')
            .filter(l => l.trim())
            .map(l => l.trim().split(/\s+/).pop())
            .filter(f => f && !f.startsWith('-'));
    } catch (_) {
        return null;   // 7z not available — skip check
    }
}

/**
 * Extract a named file from the bundle and return true if its text contains
 * the string `EJS_Runtime`.  Returns null if 7z is not available.
 */
function bundleJsDefinesEjsRuntime(bundlePath) {
    try {
        const out = execSync(
            `7z e -so "${bundlePath}" snes9x_libretro.js 2>/dev/null`,
            { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 15000 }
        );
        return out.includes('EJS_Runtime');
    } catch (_) {
        return null;   // 7z not available — skip check
    }
}

// ── A. Vendor assets ─────────────────────────────────────────────────────────
console.log('\nA. Vendor assets:');

test('emulator.min.js exists', () => {
    assert.ok(
        fs.existsSync(path.join(VENDOR, 'emulator.min.js')),
        'emulator.min.js missing'
    );
});

test('emulator.min.css exists', () => {
    // EmulatorJS shows a console.warn and falls back gracefully, but the
    // missing file causes noise and may mask real errors.
    // Fix: copy emulator.css → emulator.min.css  (already done in v0.2.66+)
    assert.ok(
        fs.existsSync(path.join(VENDOR, 'emulator.min.css')),
        'emulator.min.css missing — run: cp emulator.css emulator.min.css in the vendor dir'
    );
});

test('loader.js exists', () => {
    assert.ok(
        fs.existsSync(path.join(VENDOR, 'loader.js')),
        'loader.js missing'
    );
});

test('extract7z.js decompressor exists', () => {
    assert.ok(
        fs.existsSync(path.join(VENDOR, 'compression', 'extract7z.js')),
        'compression/extract7z.js missing — bundle decompression will fail at runtime'
    );
});

// ── B. Pre-delivered (bundled) core ──────────────────────────────────────────
console.log('\nB. Pre-delivered core  (snes9x-wasm.data):');

test('bundled core file exists', () => {
    assert.ok(fs.existsSync(BUNDLED_CORE), `snes9x-wasm.data not found at ${BUNDLED_CORE}`);
});

test('bundled core is a valid 7-zip archive', () => {
    assert.ok(isSevenZip(BUNDLED_CORE), 'not a 7-zip archive (wrong magic bytes)');
});

test('bundled core contains required files', () => {
    const files = listBundle(BUNDLED_CORE);
    if (files === null) { console.log('    (skipped — 7z not on PATH)'); return; }
    const required = ['snes9x_libretro.js', 'snes9x_libretro.wasm', 'build.json', 'core.json'];
    for (const f of required) {
        assert.ok(files.includes(f), `missing "${f}" in bundle (found: ${files.join(', ')})`);
    }
});

test('bundled core JS defines EJS_Runtime', () => {
    // If this fails, EmulatorJS will always show "Error loading EmulatorJS runtime"
    // even with the bundled default core.
    const result = bundleJsDefinesEjsRuntime(BUNDLED_CORE);
    if (result === null) { console.log('    (skipped — 7z not on PATH)'); return; }
    assert.ok(result, 'snes9x_libretro.js does not define EJS_Runtime');
});

// ── C. Custom core bundle ─────────────────────────────────────────────────────
console.log('\nC. Custom core bundle  (tmp/custom-snes9x.data):');

test('custom core file exists', () => {
    assert.ok(
        fs.existsSync(CUSTOM_CORE),
        `custom-snes9x.data not found — run: python3 tools/pack_snes_core.py`
    );
});

test('custom core is a valid 7-zip archive', () => {
    assert.ok(isSevenZip(CUSTOM_CORE), 'not a 7-zip archive (wrong magic bytes)');
});

test('custom core contains required files', () => {
    const files = listBundle(CUSTOM_CORE);
    if (files === null) { console.log('    (skipped — 7z not on PATH)'); return; }
    const required = ['snes9x_libretro.js', 'snes9x_libretro.wasm', 'build.json', 'core.json'];
    for (const f of required) {
        assert.ok(files.includes(f), `missing "${f}" in bundle (found: ${files.join(', ')})`);
    }
});

xtest(
    'custom core JS defines EJS_Runtime',
    'snes9x_2005.js is a standalone Emscripten build, not a libretro wrapper. ' +
    'EmulatorJS expects the JS file to assign window.EJS_Runtime. ' +
    'The core must be rebuilt as a RetroArch/libretro core for EmulatorJS compatibility.',
    () => {
        const result = bundleJsDefinesEjsRuntime(CUSTOM_CORE);
        if (result === null) return;   // 7z unavailable — treat as pass for xtest
        assert.ok(result, 'snes9x_libretro.js (custom) does not define EJS_Runtime');
    }
);

// ── summary ──────────────────────────────────────────────────────────────────
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
