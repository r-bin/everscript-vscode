'use strict';

const assert = require('assert');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

function dmgRangeFull(w) {
    let mn = Infinity, mx = 0, cnt999 = 0;
    const w2 = (w + 1) & 0xffff;
    for (let i = 0; i <= 0xffff; i++) {
        const seed = Math.floor((w2 * i) / 0x10000) & 0xffff;
        const sum1 = (seed + w) & 0xffff;
        const carry = (sum1 & 0x8000) ? 1 : 0;
        const sum2 = (sum1 << 1) & 0xffff;
        const sum3 = (sum2 + w + carry) & 0xffff;
        const dmg = sum3 >>> 2;
        if (dmg < mn) mn = dmg;
        if (dmg > mx) mx = dmg;
        if (dmg >= 999) cnt999++;
    }
    return {
        min: Math.min(999, mn),
        max: Math.min(999, mx),
        count999: cnt999,
        pct999: cnt999 / 65536 * 100,
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
    const fmtPct = (pct) => {
        if (pct === 0 || pct === 100) return String(pct.toFixed(0));
        const digits = pct < 0.1 ? 3 : 2;
        return pct.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
    };
    if (pct999 > 0) return (pct999 >= 100 ? '999' : (min + '–999')) + ' [' + fmtPct(pct999) + '%]';
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
    assert.strictEqual(r.min, 0);
    assert.strictEqual(r.max, 999);
    assert.strictEqual(r.count999, 61511);
    assert.strictEqual(r.pct999.toFixed(6), '93.858337');
    assert.strictEqual(fmtDmgRange(r.min, r.max, r.pct999), '0–999 [93.86%]');
});

test('there are partial-cap cases with some seeds below 999', () => {
    const r = dmgRangeFull(1163);
    assert.strictEqual(r.min, 872);
    assert.strictEqual(r.max, 999);
    assert.strictEqual(r.count999, 51235);
    assert.strictEqual(r.pct999.toFixed(6), '78.178406');
    assert.ok(r.min < 999, 'expected at least one seed below 999');
    assert.strictEqual(fmtDmgRange(r.min, r.max, r.pct999), '872–999 [78.18%]');
});

test('Sterling atlas is not a true 100 percent cap', () => {
    const r = dmgRange(81, 160, true);
    assert.strictEqual(r.w, 65097);
    assert.strictEqual(r.count999, 61513);
    assert.strictEqual(r.pct999.toFixed(6), '93.861389');
    assert.ok(r.count999 < 65536, 'expected some Sterling hits below 999');
    assert.strictEqual(fmtDmgRange(r.min, r.max, r.pct999), '0–999 [93.86%]');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exit(1);