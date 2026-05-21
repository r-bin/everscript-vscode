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
    return alchemyRangeAtLevel(baseMight, 0, magicDefense);
}

function alchemySpellPowerAtLevel(baseMight, spellLevel) {
    const base = Math.max(0, Number(baseMight) || 0);
    const level = Math.max(0, Math.min(9, Number(spellLevel) || 0));
    const scale = [2, 4, 7, 11, 15, 20, 26, 32, 39, 46][level];
    return Math.max(1, Math.ceil((base * scale) / 4));
}

function alchemySpellBonusBaseAtLevel(baseMight, spellLevel) {
    const base = Math.max(0, Number(baseMight) || 0);
    const level = Math.max(0, Math.min(9, Number(spellLevel) || 0));
    const scale = [2, 4, 7, 11, 15, 20, 26, 32, 39, 46][level];
    return Math.max(0, Math.floor((base * scale) / 4));
}

function alchemyDamageFromPower(power, magicDefense) {
    const rawPower = Math.max(0, Number(power) || 0);
    const rawMdef = Math.max(0, Math.min(0x40, Number(magicDefense) || 0));
    return Math.max(0, Math.floor((rawPower * (0x40 - rawMdef)) / 0x40));
}

function alchemyDamageSamples(baseMight, spellLevel, magicDefense) {
    const rawMdef = Math.max(0, Math.min(0x40, Number(magicDefense) || 0));
    const key = `${Number(baseMight) || 0}|${Math.max(0, Math.min(9, Number(spellLevel) || 0))}|${rawMdef}`;
    const cache = alchemyDamageSamples._cache || (alchemyDamageSamples._cache = new Map());
    if (cache.has(key)) return cache.get(key);
    const prePower = alchemySpellPowerAtLevel(baseMight, spellLevel);
    const bonusBase = alchemySpellBonusBaseAtLevel(baseMight, spellLevel);
    const samples = new Array(0x10000);
    for (let rng16 = 0; rng16 <= 0xffff; rng16++) {
        const bonus = Math.floor((bonusBase * rng16) / 0x10000);
        samples[rng16] = alchemyDamageFromPower(prePower + bonus, rawMdef);
    }
    cache.set(key, samples);
    return samples;
}

function alchemyRangeAtLevel(baseMight, spellLevel, magicDefense) {
    const rawMdef = Math.max(0, Math.min(0x40, Number(magicDefense) || 0));
    const key = `${Number(baseMight) || 0}|${Math.max(0, Math.min(9, Number(spellLevel) || 0))}|${rawMdef}`;
    const cache = alchemyRangeAtLevel._cache || (alchemyRangeAtLevel._cache = new Map());
    if (cache.has(key)) return { ...cache.get(key) };
    const prePower = alchemySpellPowerAtLevel(baseMight, spellLevel);
    const bonusBase = alchemySpellBonusBaseAtLevel(baseMight, spellLevel);
    const samples = alchemyDamageSamples(baseMight, spellLevel, rawMdef);
    let min = Infinity;
    let max = 0;
    let count999 = 0;
    for (const damage of samples) {
        if (damage < min) min = damage;
        if (damage > max) max = damage;
        if (damage >= 999) count999++;
    }
    const out = {
        spellPower: prePower,
        bonusBase,
        rawMagicDefense: rawMdef,
        defenseFactor: 0x40 - rawMdef,
        min: Math.min(999, min),
        max: Math.min(999, max),
        count999,
        pct999: count999 / 65536 * 100,
    };
    cache.set(key, out);
    return { ...out };
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
    const scaledMagicDefense = alchemyMagicDefenseAtLevel(magicDefense, defenseGrowth, targetLevel);
    const out = alchemyRangeAtLevel(baseMight, spellLevel, scaledMagicDefense);
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
    alchemySpellBonusBaseAtLevel,
    alchemyDamageFromPower,
    alchemyDamageSamples,
    alchemyRangeAtLevel,
    alchemyMagicDefenseAtLevel,
    alchemyTargetHpAtLevel,
    alchemyProjectedRange,
};