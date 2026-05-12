'use strict';

const assert = require('assert');
const { alchemyEffectiveMdef, alchemyRangeLevel0, alchemySpellPowerAtLevel, alchemyMagicDefenseAtLevel, alchemyTargetHpAtLevel, alchemyProjectedRange, damageRangeFull } = require('../alchemy-model');

const dmgRangeFull = damageRangeFull;

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); failed++; }
}

function chargedPhysicalAttack(atk, charge) {
    if (charge <= 25) return atk >> 2;
    if (charge <= 50) return atk >> 1;
    return atk;
}

function dmgRange(atk, def, atlasMode, charge = 100) {
    const atlasSubtractApplies = atlasMode;
    const atlasOverflowBypassesClamp = atlasMode && charge < 100;
    const chargedAtk = chargedPhysicalAttack(atk, charge);
    const atkEff = atlasSubtractApplies ? ((chargedAtk - 480) & 0xffff) : chargedAtk;
    const inner = (((def >> 2) - atkEff) & 0xffff);
    let w = (~((inner - 1) & 0xffff)) & 0xffff;
    if (w < 1 || (!atlasOverflowBypassesClamp && w >= 0x8000)) w = 1;
    return { w, chargedAtk, atkEff, atlasSubtractApplies, atlasOverflowBypassesClamp, ...dmgRangeFull(w) };
}

function atlasDocPreview(atk, sub, def) {
    const atkEff = (atk - sub) & 0xffff;
    if (sub <= atk) {
        const inner = (((def >> 2) - atkEff) & 0xffff);
        let w = (~((inner - 1) & 0xffff)) & 0xffff;
        if (w < 1 || w >= 0x8000) w = 1;
        return { underflow: false, w, ...dmgRangeFull(w) };
    }
    const inner = (((def >> 2) - atkEff) & 0xffff);
    const w = (~((inner - 1) & 0xffff)) & 0xffff;
    return { underflow: true, w, ...dmgRangeFull(w) };
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

test('atlas underflow keeps large wrapped unsigned w below 100 percent charge', () => {
    const r = dmgRange(10, 32, true, 50);
    assert.strictEqual(r.atlasSubtractApplies, true);
    assert.strictEqual(r.atlasOverflowBypassesClamp, true);
    assert.strictEqual(r.chargedAtk, 5);
    assert.strictEqual(r.w, 65053);
    assert.strictEqual(r.min, 0);
    assert.strictEqual(r.max, 999);
    assert.strictEqual(r.count999, 61511);
    assert.strictEqual(r.pct999.toFixed(6), '93.858337');
    assert.strictEqual(fmtDmgRange(r.min, r.max, r.pct999), '0–999 [93.86%]');
});

test('atlas at 100 percent charge stays on the weak clamped path', () => {
    const r = dmgRange(17, 230, true, 100);
    assert.strictEqual(r.atlasSubtractApplies, true);
    assert.strictEqual(r.atlasOverflowBypassesClamp, false);
    assert.strictEqual(r.atkEff, (17 - 480) & 0xffff);
    assert.strictEqual(r.w, 1);
    assert.deepStrictEqual({ min: r.min, max: r.max }, { min: 0, max: 1 });
    assert.strictEqual(r.count999, 0);
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
    const r = dmgRange(81, 160, true, 50);
    assert.strictEqual(r.atlasSubtractApplies, true);
    assert.strictEqual(r.atlasOverflowBypassesClamp, true);
    assert.strictEqual(r.chargedAtk, 40);
    assert.strictEqual(r.w, 65056);
    assert.strictEqual(r.count999, 61510);
    assert.strictEqual(r.pct999.toFixed(6), '93.856812');
    assert.ok(r.count999 < 65536, 'expected some Sterling hits below 999');
    assert.strictEqual(fmtDmgRange(r.min, r.max, r.pct999), '0–999 [93.86%]');
});

test('no atlas: higher stamina thresholds increase Boy Sword I damage vs Wimpy Flower', () => {
    const low = dmgRange(17, 28, false, 25);
    const mid = dmgRange(17, 28, false, 50);
    const high = dmgRange(17, 28, false, 100);
    assert.deepStrictEqual({ min: low.min, max: low.max }, { min: 0, max: 1 });
    assert.deepStrictEqual({ min: mid.min, max: mid.max }, { min: 0, max: 1 });
    assert.deepStrictEqual({ min: high.min, max: high.max }, { min: 7, max: 12 });
    assert.ok(high.max > mid.max && mid.max >= low.max);
});

test('minimum pre-rng value is clamped to 1 instead of allowing a 0–0 range', () => {
    const r = dmgRange(29, 28, false, 25);
    assert.strictEqual(r.chargedAtk, 7);
    assert.strictEqual(r.w, 1);
    assert.deepStrictEqual({ min: r.min, max: r.max }, { min: 0, max: 1 });
});

test('no atlas: better weapons usually deal more damage at the same stamina', () => {
    const sword1 = dmgRange(17, 28, false, 100);
    const sword4 = dmgRange(57, 28, false, 100);
    assert.ok(sword4.min > sword1.min, 'expected higher-tier weapon to raise minimum damage');
    assert.ok(sword4.max > sword1.max, 'expected higher-tier weapon to raise maximum damage');
});

test('atlas: 100 percent stamina stays weak but sub-100 stamina mostly caps', () => {
    const full = dmgRange(17, 28, true, 100);
    const half = dmgRange(17, 28, true, 50);
    const quarter = dmgRange(17, 28, true, 25);
    assert.deepStrictEqual({ min: full.min, max: full.max, pct999: full.pct999 }, { min: 0, max: 1, pct999: 0 });
    assert.strictEqual(half.count999, 61512);
    assert.strictEqual(half.pct999.toFixed(6), '93.859863');
    assert.strictEqual(quarter.count999, 61511);
    assert.strictEqual(quarter.pct999.toFixed(6), '93.858337');
    assert.ok(half.pct999 > quarter.pct999, 'expected stronger sub-100 charge to retain slightly better 999 odds');
});

test('atlas at 100 percent stays weak even as level attack rises', () => {
    const low = dmgRange(17, 28, true, 100);
    const high = dmgRange(79, 28, true, 100);
    assert.deepStrictEqual({ min: low.min, max: low.max }, { min: 0, max: 1 });
    assert.deepStrictEqual({ min: high.min, max: high.max }, { min: 0, max: 1 });
});

test('atlas docs preview falls back to normal damage when subtraction does not underflow', () => {
    const r = atlasDocPreview(56, 0, 230);
    assert.strictEqual(r.underflow, false);
    assert.strictEqual(r.w, 1);
    assert.deepStrictEqual({ min: r.min, max: r.max }, { min: 0, max: 1 });
});

test('offensive alchemy gives Hard Ball L0 vs Purple/Wimpy Flower as 6–10', () => {
    const r = alchemyRangeLevel0(21, 32);
    assert.strictEqual(r.spellPower, 21);
    assert.strictEqual(r.resist, 13);
    assert.strictEqual(r.w, 8);
    assert.deepStrictEqual({ min: r.min, max: r.max, pct999: r.pct999 }, { min: 6, max: 10, pct999: 0 });
});

test('offensive alchemy gives Hard Ball L0 vs Carltron-like m.def 60 as 0–1', () => {
    const r = alchemyRangeLevel0(21, 60);
    assert.strictEqual(r.resist, 20);
    assert.strictEqual(r.w, 1);
    assert.deepStrictEqual({ min: r.min, max: r.max, pct999: r.pct999 }, { min: 0, max: 1, pct999: 0 });
});

test('offensive alchemy gives Hard Ball L0 vs Mosquito-like m.def 0 as 12–20', () => {
    const r = alchemyRangeLevel0(21, 0);
    assert.strictEqual(r.resist, 5);
    assert.strictEqual(r.w, 16);
    assert.deepStrictEqual({ min: r.min, max: r.max, pct999: r.pct999 }, { min: 12, max: 20, pct999: 0 });
});

test('offensive alchemy floors negative inputs before applying the shared m.def model', () => {
    const r = alchemyRangeLevel0(21, 70);
    assert.strictEqual(alchemyEffectiveMdef(-1), 5);
    assert.strictEqual(r.resist, 22);
    assert.strictEqual(r.w, 1);
    assert.deepStrictEqual({ min: r.min, max: r.max, pct999: r.pct999 }, { min: 0, max: 1, pct999: 0 });
});

test('projected alchemy spell level preview scales spell power upward', () => {
    assert.strictEqual(alchemySpellPowerAtLevel(21, 0), 21);
    assert.strictEqual(alchemySpellPowerAtLevel(21, 1), 21);
    assert.strictEqual(alchemySpellPowerAtLevel(21, 9), 242);
});

test('projected scalable target preview reuses growth tables for hp and m.def', () => {
    assert.strictEqual(alchemyMagicDefenseAtLevel(10, 1, 37), 46);
    assert.strictEqual(alchemyTargetHpAtLevel(30, 9, 37), 354);
    const r = alchemyProjectedRange(21, 9, 10, 1, 37);
    assert.ok(r.spellPower > 21, 'expected projected spell power to rise with spell level');
    assert.strictEqual(r.scaledMagicDefense, 46);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exit(1);