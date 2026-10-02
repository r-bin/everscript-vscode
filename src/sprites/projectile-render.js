'use strict';
// Ownership: what an animation throws, for the Sprites tab — each `projectile` spawn's
// timing, offset and flight, and the projectile's own animation rendered once per type. Pure.

const { runAnimation, facingScript } = require('../maps/dist/animation-vm');
const { projectileRecord, projectileVelocity } = require('../maps/dist/projectiles');
const { paletteAt } = require('../maps/dist/character-record');
const { composeAligned } = require('./frame-compose');

const MAX_SPAWNS = 64;
const hex = (v, d) => v.toString(16).padStart(d, '0');

/** A projectile type's own animation at this facing, in its palette or the thrower's. */
function renderProjectileAnimation(rom, record, facing, throwerColours) {
    const script = facingScript(rom, record.animRecord, facing);
    if (!script) return null;
    const run = runAnimation(rom, script);
    if (!run.frames.some((f) => f.sprite)) return null;
    const colours = record.palette ? paletteAt(rom, record.palette) : throwerColours;
    const { width, height, originX, originY, images } = composeAligned(rom, run.frames, colours);
    return {
        width, height, originX, originY,
        recHex: '$' + hex(record.animRecord, 4),
        scriptHex: '$' + hex(script, 6),
        ownPalette: record.palette !== 0,
        frames: run.frames.map((f, i) => ({ png: images[i], ticks: f.ticks })),
    };
}

/**
 * Every projectile a run throws, placed on the playback timeline: `tick` counts
 * from the first displayed frame, the same clock the webview plays on.
 * `vx`/`vy` are pixels per tick for straight-flying routines, null otherwise.
 */
function renderProjectiles(rom, vmFrames, facing, throwerColours) {
    const spawns = [];
    const anims = {};
    let t = 0;
    for (const f of vmFrames) {
        for (const sp of f.spawns || []) {
            if (spawns.length >= MAX_SPAWNS) break;
            const record = projectileRecord(rom, sp.id);
            const key = '$' + hex(sp.id, 4);
            if (!(key in anims)) anims[key] = renderProjectileAnimation(rom, record, facing, throwerColours);
            const v = projectileVelocity(record, facing);
            spawns.push({
                id: sp.id,
                idHex: key,
                tick: t + sp.at,
                dx: sp.dx,
                dy: sp.dy,
                dz: sp.dz,
                routine: record.routine,
                speed: record.speed,
                power: record.power,
                flying: v !== null,
                vx: v ? v.vx : 0,
                vy: v ? v.vy : 0,
            });
        }
        t += f.ticks;
    }
    return { spawns, anims };
}

module.exports = { renderProjectiles };
