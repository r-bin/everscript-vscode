'use strict';
// Ownership: what an animation throws, for the Sprites tab — each `projectile` spawn's
// timing, offset and flight, and the projectile's own animation rendered once per type. Pure.

const { runAnimation, facingScript } = require('../maps/dist/animation-vm');
const { projectileRecord, projectileFlight } = require('../maps/dist/projectiles');
const { paletteAt } = require('../maps/dist/character-record');
const { composeAligned } = require('./frame-compose');

const MAX_SPAWNS = 64;

/**
 * Record +0x14 becomes the projectile's attack proc ($0E9A), dispatched at $8FB6A5
 * through $8FB6AE. Procs 2 ($B6E0) and 6 ($B73C) damage and then delete the
 * projectile (`LDX $0E9E / STZ $0010,X`); proc 4 ($B724) damages and skips that.
 */
const CONSUMED_PROCS = new Set([2, 6]);
const PIERCING_PROCS = new Set([4]);
const onHit = (proc) => (CONSUMED_PROCS.has(proc) ? 'consumed' : PIERCING_PROCS.has(proc) ? 'pierces' : 'unknown');
const hex = (v, d) => v.toString(16).padStart(d, '0');

/** A projectile type's own animation at this facing, in its palette or the thrower's. */
function renderProjectileAnimation(rom, record, facing, throwerColours) {
    const script = facingScript(rom, record.animRecord, facing);
    if (!script) return null;
    const run = runAnimation(rom, script, facing);
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
 * from the first displayed frame, the same clock the webview plays on. `path`
 * is where it is on each tick it lives ([x, y, height 1/16 px] from the
 * thrower's start); empty when its routine is not modelled. `target` is where
 * aimed routines aim, or null to aim straight ahead.
 */
function renderProjectiles(rom, vmFrames, facing, throwerColours, target) {
    const spawns = [];
    const anims = {};
    let t = 0;
    for (const f of vmFrames) {
        for (const sp of f.spawns || []) {
            if (spawns.length >= MAX_SPAWNS) break;
            const record = projectileRecord(rom, sp.id);
            const key = '$' + hex(sp.id, 4);
            if (!(key in anims)) anims[key] = renderProjectileAnimation(rom, record, facing, throwerColours);
            const start = { x: sp.ex + sp.dx, y: sp.ey + sp.dy, z: sp.ez + sp.dz * 16 };
            const flight = projectileFlight(rom, record, start, facing, target || null);
            spawns.push({
                id: sp.id,
                idHex: key,
                tick: t + sp.at,
                ex: sp.ex,
                ey: sp.ey,
                ez: sp.ez,
                dx: sp.dx,
                dy: sp.dy,
                dz: sp.dz,
                routine: record.routine,
                speed: record.speed,
                power: record.power,
                proc: record.field14,
                onHit: onHit(record.field14),
                model: flight.model,
                ends: flight.ends,
                start: [start.x, start.y, start.z],
                path: flight.path,
            });
        }
        t += f.ticks;
    }
    return { spawns, anims };
}

module.exports = { renderProjectiles };
