'use strict';
// Ownership: the second character on the Sprites stage — who it is, where it stands, how it
// is drawn — and which ticks of the viewed animation hit it, by strike or projectile. Pure.

const { strikeHits, bodiesTouch, MODE_CONTACT, OUT_OF_REACH_ABOVE, OUT_OF_REACH_BELOW } = require('../maps/dist/hit-test');
const { facingVector, PROJECTILE_HIT_SIZE } = require('../maps/dist/projectiles');
const { characterHitbox, characterDisposition } = require('../maps/dist/character-record');

const BOY = 0;
const DOG = 1;
const WIMPY_FLOWER = 'Wimpy Flower';
const DEFAULT_DISTANCE = 40;

/** Enemies are shown against the Boy; the Boy, the Dog and NPCs against a Wimpy Flower. */
function targetFor(rom, viewedId, characters) {
    const hostile = viewedId !== BOY && viewedId !== DOG && characterDisposition(rom, viewedId).hostile;
    if (hostile) return BOY;
    const wimpy = characters ? characters.find((c) => c.name === WIMPY_FLOWER) : null;
    return wimpy ? wimpy.id : BOY;
}

/** Where the target stands: `distance` px ahead along the facing, on the ground. */
function placeTarget(facing, distance) {
    const [ux, uy] = facingVector(facing);
    return { x: ux * distance, y: uy * distance, z: 0 };
}

/**
 * A hit leaves the target immune to that attacker for a while: $8FBA1B writes the
 * attacker into the target's +0x36 and $14 into +0x38, which counts down every tick
 * ($8FB014) and clears +0x36 once it goes negative — 21 ticks. Others can still hit.
 */
const HIT_COOLDOWN = 0x14 + 1;

/** The ticks that land, given every tick of contact and the per-attacker cooldown. */
function withCooldown(ticks) {
    const out = [];
    for (const t of ticks) if (!out.length || t >= out[out.length - 1] + HIT_COOLDOWN) out.push(t);
    return out;
}

/**
 * Every tick a strike box or a projectile first reaches the target. Ticks are on the
 * playback clock (from the first displayed frame); strikes move and lift with the
 * attacker, projectiles hit with their 16×16 box at their own height. After a hit the
 * same attacker cannot hit again for 21 ticks (+0x36/+0x38). A projectile consumed on
 * hit (procs 2 and 6) hits once and its path is cut there.
 */
function hitTicks(vmFrames, spawns, target, attackerRadius = 0) {
    const melee = [];
    // Contact damage: a charging body that runs into the target, once per charge.
    let contact = null;
    let prev = [0, 0];
    let t = 0;
    for (const f of vmFrames) {
        f.motion.forEach((m, i) => {
            const moved = m[0] !== prev[0] || m[1] !== prev[1];
            prev = m;
            if (contact !== null || !moved || !(f.mode & MODE_CONTACT)) return;
            if (bodiesTouch({ x: m[0], y: m[1], z: m[2], radius: attackerRadius }, target)) contact = t + i;
        });
        t += f.ticks;
    }
    t = 0;
    for (const f of vmFrames) {
        if (f.strikeBox) {
            f.motion.forEach((m, i) => {
                const s = { x: m[0] + f.strikeBox.dx, y: m[1] + f.strikeBox.dy, width: f.strikeBox.width, height: f.strikeBox.height, z: m[2] };
                if (strikeHits(s, target)) melee.push(t + i);
            });
        }
        t += f.ticks;
    }
    const projectile = [];
    for (const sp of spawns) {
        const path = sp.path || [];
        const contact = [];
        path.forEach((p, i) => { if (strikeHits({ x: p[0], y: p[1], width: PROJECTILE_HIT_SIZE, height: PROJECTILE_HIT_SIZE, z: p[2] }, target)) contact.push(i); });
        if (!contact.length) continue;
        if (sp.onHit === 'consumed') {
            const i = contact[0];
            projectile.push({ idHex: sp.idHex, tick: sp.tick + i + 1, onHit: sp.onHit });
            sp.path = path.slice(0, i + 1);
            sp.ends = 'hit';
        } else {
            for (const i of withCooldown(contact)) projectile.push({ idHex: sp.idHex, tick: sp.tick + i + 1, onHit: sp.onHit });
        }
    }
    return { melee: withCooldown(melee), projectile, contact: contact === null ? [] : [contact] };
}

/** The target, ready to draw: its standing frame, facing back at the viewed character. */
function buildTarget(rom, render, opts) {
    const id = opts.character;
    const at = placeTarget(opts.facing, opts.distance);
    const radius = characterHitbox(rom, id).radius;
    const stand = render(id, (opts.facing ^ 8) & 0x0e);
    const frame = stand && stand.frames[0];
    return {
        id,
        name: opts.name,
        x: at.x,
        y: at.y,
        z: at.z,
        radius,
        distance: opts.distance,
        png: frame ? frame.png : null,
        width: stand ? stand.width : 0,
        height: stand ? stand.height : 0,
        originX: stand ? stand.originX : 0,
        originY: stand ? stand.originY : 0,
    };
}

module.exports = { targetFor, placeTarget, hitTicks, buildTarget, DEFAULT_DISTANCE, OUT_OF_REACH_ABOVE, OUT_OF_REACH_BELOW };
