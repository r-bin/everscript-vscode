'use strict';
// Ownership: running an animation script, aligning and rendering its frames, and its script listing for the Sprites tab. Pure.

const { animationScript, characterPalette, paletteAt, FACING_SOUTH } = require('../maps/dist/character-record');
const { runAnimation, facingScript } = require('../maps/dist/animation-vm');
const { disassembleScript } = require('../maps/dist/animation-opcodes');
const { composeAligned } = require('./frame-compose');
const { renderProjectiles } = require('./projectile-render');
const { targetFor, buildTarget, hitTicks, DEFAULT_DISTANCE, OUT_OF_REACH_ABOVE, OUT_OF_REACH_BELOW } = require('./target');

/** Resolve script address for a record, taking facing into account if directional. */
function resolveExternalScript(rom, animRec, facing) {
    return facingScript(rom, animRec, facing);
}

/**
 * Decode and render all frames for a character's animation.
 * Returns aligned PNG frames, hold durations in 60Hz ticks, sprite addresses, chunks, and strike boxes.
 */
function renderAnimation(rom, characterId, animOpt = {}, facing = FACING_SOUTH) {
    let scriptAddr = 0;
    if (typeof animOpt === 'string' || typeof animOpt === 'number') {
        const field = typeof animOpt === 'number' ? animOpt : 0x32;
        scriptAddr = animationScript(rom, characterId, facing, field);
    } else if (animOpt.category === 'external' || animOpt.category === 'weapon') {
        scriptAddr = resolveExternalScript(rom, animOpt.animRec, facing) || animOpt.scriptAddr;
    } else if (animOpt.offset) {
        scriptAddr = animationScript(rom, characterId, facing, animOpt.offset);
    } else if (animOpt.scriptAddr) {
        scriptAddr = animOpt.scriptAddr;
    } else {
        scriptAddr = animationScript(rom, characterId, facing, 0x32);
    }

    if (!scriptAddr) return null;

    // Run the script the way the engine does: holds are checkpoints, counted
    // loops repeat, and a strike lasts exactly the ticks that run it.
    const run = runAnimation(rom, scriptAddr, facing);
    const script = scriptListing(rom, scriptAddr);
    if (!run.frames.length) {
        return { projectiles: [], width: 0, height: 0, originX: 0, originY: 0, complete: run.complete, scriptAddr,
            scriptHex: hex6(scriptAddr), frames: [], strikeBoxes: [], script, totalTicks: run.totalTicks,
            stoppedAtHex: run.stoppedAt ? hex6(run.stoppedAt) : null };
    }

    const strikes = distinctStrikes(run.frames);
    const colours = animOpt.paletteAddr ? paletteAt(rom, animOpt.paletteAddr) : characterPalette(rom, characterId);
    const { width, height, originX, originY, images, infos } = composeAligned(rom, run.frames, colours);
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
    if (target) target.hits = hitTicks(run.frames, projectiles.spawns, target);

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
        target,
        reach: { above: OUT_OF_REACH_ABOVE, below: OUT_OF_REACH_BELOW },
        shadow: shadow ? { width: shadow.width, height: shadow.height, originX: shadow.originX, originY: shadow.originY } : null,
    };
}

const hex6 = (v) => '$' + v.toString(16).padStart(6, '0');

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
