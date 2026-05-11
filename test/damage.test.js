'use strict';

const assert = require('assert');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

function dmgRangeFull(w) {
    let mn = Infinity, mx = 0, cnt999 = 0;
    const w2 = w + 1;
    for (let i = 0; i <= 0xffff; i++) {
        const lo = i & 0xff;
        const hi = (i >> 8) & 0xff;
        const a = (w2 * lo) & 0xffff;
        const b = (w2 * hi) & 0xffff;
        const c = (b + ((a >> 8) & 0xff)) & 0xffff;
        const seed = (c >> 8) & 0xff;
        const da = (seed + w) & 0xffff;
        const db = (da << 1) & 0xffff;
        const dc = (db + w) & 0xffff;
        const dmg = dc >> 2;
        if (dmg < mn) mn = dmg;
        if (dmg > mx) mx = dmg;
        if (dmg >= 999) cnt999++;
    }
    return {
        min: Math.min(999, mn),
        max: Math.min(999, mx),
        pct999: Math.round(cnt999 / 65536 * 100),
    };
}

function dmgRange(atk, def, atlasMode) {
    const atkEff = atlasMode ? ((atk - 480) & 0xffff) : atk;
    const inner = (((def >> 2) - atkEff) & 0xffff);
    let w = (~((inner - 1) & 0xffff)) & 0xffff;
    if (!atlasMode && w >= 0x8000) w = 1;
    if (atlasMode) return { w, ...dmgRangeFull(w) };
    return {
        w,
        min: Math.min(999, (3 * w) >> 2),
        max: Math.min(999, (5 * w) >> 2),
        pct999: 0,
    };
}

function fmtDmgRange(min, max, pct999) {
    if (pct999 > 0) return (pct999 >= 100 ? '999' : (min + '–999')) + ' [' + pct999 + '%]';
    return min + '–' + max;
}

console.log('\ndamage calculations:');
test('normal damage uses unclitched signed clamp path', () => {
    const r = dmgRange(10, 32, false);
    assert.strictEqual(r.w, 2);
    assert.deepStrictEqual({ min: r.min, max: r.max, pct999: r.pct999 }, { min: 1, max: 2, pct999: 0 });
});

test('atlas underflow keeps large wrapped unsigned w', () => {
    const r = dmgRange(10, 32, true);
    assert.strictEqual(r.w, 65058);
    assert.strictEqual(r.min > 999, false);
    assert.strictEqual(r.max, 999);
    assert.strictEqual(r.pct999, 100);
    assert.strictEqual(fmtDmgRange(r.min, r.max, r.pct999), '999 [100%]');
});

test('there are partial-cap cases with some seeds below 999', () => {
    const r = dmgRangeFull(1163);
    assert.strictEqual(r.min, 872);
    assert.strictEqual(r.max, 999);
    assert.strictEqual(r.pct999, 1);
    assert.ok(r.min < 999, 'expected at least one seed below 999');
    assert.strictEqual(fmtDmgRange(r.min, r.max, r.pct999), '872–999 [1%]');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exit(1);