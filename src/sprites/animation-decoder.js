'use strict';
// Ownership: running an animation script, aligning and rendering its frames, and its script listing for the Sprites tab. Pure.

const { animationScript, characterPalette, characterHitbox, paletteAt, FACING_SOUTH } = require('../maps/dist/character-record');
const { runAnimation, facingScript, MODE_INVULNERABLE } = require('../maps/dist/animation-vm');
const { resolveCharacterSprite } = require('../maps/dist/character-animation');
const { MODE_CONTACT } = require('../maps/dist/hit-test');
const { disassembleScript } = require('../maps/dist/animation-opcodes');
const { composeAligned } = require('./frame-compose');
const { snesToRom } = require('../maps/dist/rom');
const { renderProjectiles } = require('./projectile-render');
const { targetFor, buildTarget, hitTicks, DEFAULT_DISTANCE, OUT_OF_REACH_ABOVE, OUT_OF_REACH_BELOW } = require('./target');

/** Resolve script address for a record, taking facing into account if directional. */
function resolveExternalScript(rom, animRec, facing) {
    return facingScript(rom, animRec, facing);
}

/** The script an animation option plays at a facing. */
function resolveScript(rom, characterId, animOpt, facing) {
    if (typeof animOpt === 'string' || typeof animOpt === 'number') {
        return animationScript(rom, characterId, facing, typeof animOpt === 'number' ? animOpt : 0x32);
    }
    if (animOpt.category === 'external' || animOpt.category === 'weapon') {
        return resolveExternalScript(rom, animOpt.animRec, facing) || animOpt.scriptAddr;
    }
    if (animOpt.offset) return animationScript(rom, characterId, facing, animOpt.offset);
    if (animOpt.scriptAddr) return animOpt.scriptAddr;
    return animationScript(rom, characterId, facing, 0x32);
}

const SPEED_FACINGS = [['N', 0], ['E', 4], ['S', 8], ['W', 12]];
const TICKS_PER_SECOND = 60;

/**
 * How fast an animation carries the character, per cardinal facing: distance over the
 * repeating part of the cycle. Each facing has its own script, so they differ (the spear
 * walk steps 6 north/south but 8 east/west). Null when it does not move.
 */
function movementSpeeds(rom, characterId, animOpt) {
    const out = {};
    let any = false;
    for (const [name, f] of SPEED_FACINGS) {
        const script = resolveScript(rom, characterId, animOpt, f);
        if (!script) continue;
        const run = runAnimation(rom, script, f, { oneShot: isOneShot(animOpt) });
        const samples = run.frames.flatMap((fr) => fr.motion);
        if (!samples.length) continue;
        const from = run.loopFrom > 0 ? samples[run.loopFrom - 1] : [0, 0];
        const to = samples[samples.length - 1];
        const ticks = samples.length - (run.loopFrom > 0 ? run.loopFrom : 0);
        const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
        if (dist) any = true;
        out[name] = { px: Math.round(dist), ticks, perTick: ticks ? dist / ticks : 0, perSecond: ticks ? (dist / ticks) * TICKS_PER_SECOND : 0 };
    }
    return any ? out : null;
}

/**
 * Decode and render all frames for a character's animation.
 * Returns aligned PNG frames, hold durations in 60Hz ticks, sprite addresses, chunks, and strike boxes.
 */
function renderAnimation(rom, characterId, animOpt = {}, facing = FACING_SOUTH) {
    const scriptAddr = resolveScript(rom, characterId, animOpt, facing);
    if (!scriptAddr) return null;

    // Run the script the way the engine does: holds are checkpoints, counted
    // loops repeat, and a strike lasts exactly the ticks that run it.
    // A script that never sets a sprite (the shared damage knock-back) keeps showing
    // what the character had on: its standing sprite for this facing.
    const initialSprite = Number.isInteger(characterId) ? resolveCharacterSprite(rom, characterId, facing) : null;
    // The Boy's and Dog's scripts set +0x42/+0x44 to values (e.g. −132/−144) that cannot be
    // hurt offsets; until that is explained their hurt region stays at the default.
    const playerSlot = characterId === 0 || characterId === 1;
    const run = runAnimation(rom, scriptAddr, facing, { initialSprite, oneShot: isOneShot(animOpt) });
    const script = scriptListing(rom, scriptAddr);
    if (!run.frames.length) {
        return { projectiles: [], width: 0, height: 0, originX: 0, originY: 0, complete: run.complete, scriptAddr,
            scriptHex: hex6(scriptAddr), frames: [], strikeBoxes: [], script, totalTicks: run.totalTicks,
            stoppedAtHex: run.stoppedAt ? hex6(run.stoppedAt) : null };
    }

    const strikes = distinctStrikes(run.frames);
    const colours = animOpt.paletteAddr ? paletteAt(rom, animOpt.paletteAddr) : characterPalette(rom, characterId);
    // Harry and Vigor draw some chunks with their second palette (+0x0B).
    const colours2 = secondPalette(rom, characterId);
    const { width, height, originX, originY, images, infos } = composeAligned(rom, run.frames, colours, colours2);
    // The second sprite slot (usually the shadow) as its own layer: it stays on the
    // ground while height lifts the main sprite.
    const shadow = run.frames.some((f) => f.sprite2 && f.sprite2 !== f.sprite)
        ? composeAligned(rom, run.frames.map((f) => ({ sprite: f.sprite2 })), colours)
        : null;
    const frames = [];

    for (let i = 0; i < images.length; i++) {
        const info = infos[i];
        const pngDataUri = images[i];

        // Format chunks list for inspection (matching SoETilesViewer style: 0x0000 @ -12, -31, flags 10)
        const chunkList = (info ? info.chunks : []).map((ch) => ({
            blockHex: '0x' + ch.block.toString(16).padStart(4, '0'),
            block: ch.block,
            x: ch.x,
            y: ch.y,
            flagsHex: ch.flags.toString(16).padStart(2, '0'),
            flags: ch.flags,
            large: ch.large,
            flipX: ch.flipX,
            flipY: ch.flipY,
            priority: ch.priority,
            summary: `0x${ch.block.toString(16).padStart(4, '0')} @ ${ch.x}, ${ch.y}, flags ${ch.flags.toString(16).padStart(2, '0')}${ch.flipX ? ' [flipX]' : ''}${ch.flipY ? ' [flipY]' : ''}`,
        }));

        const f = run.frames[i];
        frames.push({
            frameIndex: i,
            png: pngDataUri,
            ticks: f.ticks,
            spriteAddr: f.sprite || 0,
            spriteHex: f.sprite ? hex6(f.sprite) : '—',
            strikeBox: f.strikeBox || null,
            lines: f.lines,
            step: f.step,
            random: f.random || null,
            spawns: f.spawns,
            mode: f.mode,
            invulnerable: (f.mode & MODE_INVULNERABLE) !== 0,
            contact: (f.mode & MODE_CONTACT) !== 0,
            segments: f.segments ? { sprites: f.segments.sprites.map(hex6), ticks: f.segments.ticks } : null,
            hurt: playerSlot ? [0, -16] : f.hurt,
            motion: f.motion,
            shadowPng: shadow && f.sprite2 ? shadow.images[i] : null,
            chunks: chunkList,
        });
    }

    // The second character: where it stands decides where aimed projectiles go.
    const targetOpt = animOpt && animOpt.target && animOpt.target.on ? animOpt.target : null;
    let target = null;
    if (targetOpt) {
        const character = targetOpt.character != null ? targetOpt.character : targetFor(rom, characterId, null);
        const distance = Number.isFinite(targetOpt.distance) ? targetOpt.distance : DEFAULT_DISTANCE;
        target = buildTarget(rom, (id, f) => renderAnimation(rom, id, { offset: 0x32, paletteAddr: targetOpt.paletteAddr || 0 }, f), {
            character, distance, facing, name: targetOpt.name || '',
        });
    }
    const projectiles = renderProjectiles(rom, run.frames, facing, colours, target);
    if (target) {
        // Hits as drawn with the walk path, and with the entity kept in place (Walk path off).
        const radius = Number.isInteger(characterId) ? characterHitbox(rom, characterId).radius : 0;
        target.hits = hitTicks(run.frames, projectiles.spawns, target, radius, false);
        target.hitsStill = hitTicks(run.frames, projectiles.spawns, target, radius, true);
        projectiles.spawns.forEach((sp, k) => {
            if (k in target.hits.cut) { sp.cutWalk = target.hits.cut[k]; sp.ends = 'hit'; }
            if (k in target.hitsStill.cut) sp.cutStill = target.hitsStill.cut[k];
        });
    }
    const segmentSprites = renderSegmentSprites(rom, run.frames, colours, colours2);

    return {
        width,
        height,
        originX,
        originY,
        complete: run.complete,
        scriptAddr,
        scriptHex: hex6(scriptAddr),
        frames,
        strikeBoxes: strikes,
        script,
        totalTicks: run.totalTicks,
        stoppedAtHex: run.stoppedAt ? hex6(run.stoppedAt) : null,
        projectiles,
        moves: run.moves,
        speeds: run.moves ? movementSpeeds(rom, characterId, animOpt) : null,
        loopFrom: run.loopFrom,
        initialSprite: initialSprite ? hex6(initialSprite) : null,
        segmentSprites,
        target,
        reach: { above: OUT_OF_REACH_ABOVE, below: OUT_OF_REACH_BELOW },
        shadow: shadow ? { width: shadow.width, height: shadow.height, originX: shadow.originX, originY: shadow.originY } : null,
    };
}

const hex6 = (v) => '$' + v.toString(16).padStart(6, '0');

/** A character's second palette (+0x0B), or null when it has none. */
function secondPalette(rom, characterId) {
    if (!Number.isInteger(characterId)) return null;
    const rec = 0x8eb678 + characterId * 74 + 0x0b;
    const o = snesToRom(rec);
    const addr = rom[o] | (rom[o + 1] << 8);
    return addr ? paletteAt(rom, addr) : null;
}

/**
 * Attacks, damage, death, spoils and casting end on `end_check`, which hands the entity
 * back to its AI; idles, walks and runs loop. Record fields from +0x38 on are the former.
 */
const ONE_SHOT_LABEL = /attack|damage|knockback|death|spoils|cast|dodge|hurt/i;
function isOneShot(opt) {
    if (!opt || typeof opt !== 'object') return typeof opt === 'number' && opt >= 0x38;
    if (typeof opt.oneShot === 'boolean') return opt.oneShot;
    if (typeof opt.offset === 'number') return opt.offset >= 0x38;
    if (/^w_(atk|charge|damage)/.test(opt.key || '') || /^d_slot[4-8]$/.test(opt.key || '')) return true;
    return ONE_SHOT_LABEL.test(String(opt.label || opt.key || ''));
}

/** Each distinct segment sprite, composed once, keyed by address. */
function renderSegmentSprites(rom, frames, colours, secondPaletteFor) {
    const out = {};
    for (const f of frames) {
        if (!f.segments) continue;
        for (const sprite of f.segments.sprites) {
            const key = hex6(sprite);
            if (key in out) continue;
            const c = composeAligned(rom, [{ sprite }], colours, secondPaletteFor);
            out[key] = { png: c.images[0], width: c.width, height: c.height, originX: c.originX, originY: c.originY };
        }
    }
    return out;
}

/** The script's reachable commands, as the webview lists them. */
function scriptListing(rom, scriptAddr) {
    return disassembleScript(rom, scriptAddr).map((l) => ({
        address: l.address,
        addrHex: l.address.toString(16).padStart(6, '0'),
        bytesHex: l.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' '),
        text: l.text,
        endFrame: l.endFrame,
        known: l.known,
    }));
}

/** Each distinct strike box the run produced, in order. */
function distinctStrikes(frames) {
    const out = [];
    const seen = new Set();
    for (const f of frames) {
        const b = f.strikeBox;
        if (!b) continue;
        const k = `${b.dx},${b.dy},${b.width},${b.height}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(b);
    }
    return out;
}

module.exports = {
    renderAnimation,
    resolveExternalScript,
};
