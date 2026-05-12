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

module.exports = {
    alchemyEffectiveMdef,
    damageRangeFull,
    alchemyRangeLevel0,
};