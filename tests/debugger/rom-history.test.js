'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const {
  formatBytes,
  formatRelativeTime,
  getBadge,
  getVanillaRom,
  scanEditorTempRoms,
  recordRomUsage,
  getRecentRoms,
  getRomOfferData,
} = require('../../src/emulator/rom-history');

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

console.log('ROM History & Quick Launch Tests:');

test('rom-history.js is strictly ASCII-only', () => {
  const content = fs.readFileSync(path.join(__dirname, '../../src/emulator/rom-history.js'), 'utf8');
  assert.ok(!/[^\x09\x0A\x0D\x20-\x7E]/.test(content), 'rom-history.js must contain ASCII characters only');
});

test('formatBytes formats bytes cleanly', () => {
  assert.strictEqual(formatBytes(0), '');
  assert.strictEqual(formatBytes(1024), '1.0 KB');
  assert.strictEqual(formatBytes(1024 * 1024 * 3), '3.00 MB');
});

test('formatRelativeTime returns human readable intervals', () => {
  const now = Date.now();
  assert.strictEqual(formatRelativeTime(now), 'Just now');
  assert.strictEqual(formatRelativeTime(now - 120 * 1000), '2m ago');
  assert.strictEqual(formatRelativeTime(now - 7200 * 1000), '2h ago');
});

test('getBadge maps kinds to descriptive labels', () => {
  assert.strictEqual(getBadge('editor'), 'Map Editor');
  assert.strictEqual(getBadge('vanilla'), 'Vanilla');
  assert.strictEqual(getBadge('build'), 'Build');
  assert.strictEqual(getBadge('dropped'), 'Dropped');
  assert.strictEqual(getBadge('file'), 'File');
});

test('getVanillaRom finds workspace vanilla ROM', () => {
  const wsRoot = path.resolve(__dirname, '../..');
  const info = getVanillaRom(wsRoot);
  assert.ok(info.available, 'Vanilla ROM should be detected in repo dependencies');
  assert.ok(info.path && fs.existsSync(info.path), 'Vanilla ROM file must exist');
  assert.ok(info.size > 0, 'Vanilla ROM size must be positive');
  assert.ok(info.sizeFormatted.includes('MB'), 'Size should be formatted in MB');
});

test('scanEditorTempRoms discovers temporary emulator ROMs in temp/storage dir', () => {
  const testDir = path.join(os.tmpdir(), 'evs_test_' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });
  const tempRom = path.join(testDir, 'Wind_Valley_emulator.sfc');
  fs.writeFileSync(tempRom, 'dummy-snes-rom-bytes');

  try {
    const found = scanEditorTempRoms(testDir);
    const match = found.find(f => f.path === tempRom);
    assert.ok(match, 'Temporary map editor ROM must be discovered');
    assert.strictEqual(match.kind, 'editor');
    assert.strictEqual(match.name, 'Wind_Valley_emulator.sfc');
  } finally {
    fs.unlinkSync(tempRom);
    fs.rmdirSync(testDir);
  }
});

test('recordRomUsage and getRecentRoms persist and deduplicate entries', () => {
  const testDir = path.join(os.tmpdir(), 'evs_test_hist_' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });
  const mockContext = { globalStorageUri: { fsPath: testDir } };

  try {
    const file1 = path.join(testDir, 'game1.sfc');
    const file2 = path.join(testDir, 'game2.sfc');
    fs.writeFileSync(file1, '1');
    fs.writeFileSync(file2, '2');

    recordRomUsage({ path: file1, name: 'game1.sfc', kind: 'file' }, mockContext);
    recordRomUsage({ path: file2, name: 'game2.sfc', kind: 'build' }, mockContext);
    // Re-record file1 to test move-to-front
    recordRomUsage({ path: file1, name: 'game1.sfc', kind: 'file' }, mockContext);

    const recents = getRecentRoms(testDir);
    assert.strictEqual(recents.length, 2);
    assert.strictEqual(recents[0].name, 'game1.sfc', 'Most recently used ROM must be first');
    assert.strictEqual(recents[1].name, 'game2.sfc');
    assert.strictEqual(recents[0].exists, true);
  } finally {
    try {
      const files = fs.readdirSync(testDir);
      for (const f of files) fs.unlinkSync(path.join(testDir, f));
      fs.rmdirSync(testDir);
    } catch (_) {}
  }
});

test('getRomOfferData returns both vanilla and recent ROMs', () => {
  const wsRoot = path.resolve(__dirname, '../..');
  const data = getRomOfferData(null, wsRoot);
  assert.ok(data.vanilla !== undefined, 'Offer data must have vanilla property');
  assert.ok(Array.isArray(data.recent), 'Offer data must have recent array');
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
