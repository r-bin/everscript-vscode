'use strict';

function alchemyEffectiveMdef(magicDefense) {
    const raw = Math.max(0, Number(magicDefense) || 0);
    return Math.max(0, Math.floor((raw + 20) / 4));
}

function damageRangeFull(w) {
    let min = Infinity;
    let max = 0;
    let count999 = 0;
    const w2 = (w + 1) & 0xffff;
    for (let rng16 = 0; rng16 <= 0xffff; rng16++) {
        const seed = Math.floor((w2 * rng16) / 0x10000) & 0xffff;
        const a = (seed + w) & 0xffff;
        const b = (a << 1) & 0xffff;
        const c = (b + w + ((a & 0x8000) ? 1 : 0)) & 0xffff;
        const dmg = c >>> 2;
        if (dmg < min) min = dmg;
        if (dmg > max) max = dmg;
        if (dmg >= 999) count999++;
    }
    return {
        min: Math.min(999, min),
        max: Math.min(999, max),
        count999,
        pct999: count999 / 65536 * 100,
    };
}

function alchemyRangeLevel0(baseMight, magicDefense) {
    const spellPower = Number(baseMight) || 0;
    const resist = alchemyEffectiveMdef(magicDefense);
    const w = Math.max(1, spellPower - resist);
    return { w, resist, spellPower, ...damageRangeFull(w) };
}

function alchemySpellPowerAtLevel(baseMight, spellLevel) {
    const base = Math.max(0, Number(baseMight) || 0);
    const level = Math.max(0, Math.min(9, Number(spellLevel) || 0));
    if (level === 0) return Math.max(1, base);
    const scale = [2, 4, 7, 11, 15, 20, 26, 32, 39, 46][level];
    return Math.max(1, Math.ceil((base * scale) / 4));
}

function alchemyMagicDefenseAtLevel(baseMagicDefense, defenseGrowth, targetLevel) {
    const raw = Math.max(0, Number(baseMagicDefense) || 0);
    const growth = Math.max(0, Number(defenseGrowth) || 0);
    const level = Math.max(1, Math.min(37, Number(targetLevel) || 1));
    return raw + (level - 1) * growth;
}

function alchemyTargetHpAtLevel(baseHp, hpGrowth, targetLevel) {
    const raw = Math.max(1, Number(baseHp) || 1);
    const growth = Math.max(0, Number(hpGrowth) || 0);
    const level = Math.max(1, Math.min(37, Number(targetLevel) || 1));
    return raw + (level - 1) * growth;
}

function alchemyProjectedRange(baseMight, spellLevel, magicDefense, defenseGrowth, targetLevel) {
    const spellPower = alchemySpellPowerAtLevel(baseMight, spellLevel);
    const scaledMagicDefense = alchemyMagicDefenseAtLevel(magicDefense, defenseGrowth, targetLevel);
    const out = alchemyRangeLevel0(spellPower, scaledMagicDefense);
    out.scaledMagicDefense = scaledMagicDefense;
    out.spellLevel = Math.max(0, Math.min(9, Number(spellLevel) || 0));
    out.targetLevel = Math.max(1, Math.min(37, Number(targetLevel) || 1));
    return out;
}

module.exports = {
    alchemyEffectiveMdef,
    damageRangeFull,
    alchemyRangeLevel0,
    alchemySpellPowerAtLevel,
    alchemyMagicDefenseAtLevel,
    alchemyTargetHpAtLevel,
    alchemyProjectedRange,
};