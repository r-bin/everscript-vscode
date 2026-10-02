'use strict';
// Ownership: animation script execution, frame alignment, and strike box extraction for the Sprites tab. Pure.

const { animationScript, characterPalette, FACING_SOUTH, ANIMATION_TABLE } = require('../maps/dist/character-record');
const { walkAnimationScript, strikeBoxes } = require('../maps/dist/character-animation');
const { readSpriteInfo, composeSprite } = require('../maps/dist/sprites');
const { encodePng } = require('../maps/dist/png');
const { snesToRom } = require('../maps/dist/rom');

const DIRECTIONAL_FLAG = 0x80;
const TABLE_FLAG = 0x40;
const FACING_TABLE = 0x90815b;

/** Read 16-bit word at SNES address. */
function read16(rom, snes) {
    const o = snesToRom(snes);
    return rom[o] | (rom[o + 1] << 8);
}

/** Resolve script address for an external animation, taking facing into account if directional. */
function resolveExternalScript(rom, animRec, facing) {
    if (!animRec) return 0;
    let rec = animRec;
    const flags = rom[snesToRom(ANIMATION_TABLE + rec + 3)];
    if (flags & DIRECTIONAL_FLAG) rec += 2 * facing;
    else if (flags & TABLE_FLAG) rec += read16(rom, FACING_TABLE + facing);
    const low = read16(rom, ANIMATION_TABLE + rec);
    const bank = rom[snesToRom(ANIMATION_TABLE + rec + 2)];
    return ((low | (bank << 16)) >>> 0);
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
    } else if (animOpt.category === 'external') {
        scriptAddr = resolveExternalScript(rom, animOpt.animRec, facing) || animOpt.scriptAddr;
    } else if (animOpt.offset) {
        scriptAddr = animationScript(rom, characterId, facing, animOpt.offset);
    } else if (animOpt.scriptAddr) {
        scriptAddr = animOpt.scriptAddr;
    } else {
        scriptAddr = animationScript(rom, characterId, facing, 0x32);
    }

    if (!scriptAddr) return null;

    const walk = walkAnimationScript(rom, scriptAddr);
    if (!walk.frames || !walk.frames.length) return null;

    // Strike boxes declared in this script
    const strikesWalk = strikeBoxes(rom, scriptAddr);
    const strikes = strikesWalk.boxes || [];

    // Compose sprite info and pixels for each frame
    const spriteInfos = walk.frames.map((f) => readSpriteInfo(rom, f.sprite));
    const composed = spriteInfos.map((info) => composeSprite(rom, info));

    // Align all frames on the shared feet origin (originX, originY)
    let originX = 0;
    let originY = 0;
    let right = 0;
    let below = 0;
    for (const c of composed) {
        originX = Math.max(originX, c.originX);
        originY = Math.max(originY, c.originY);
        right = Math.max(right, c.width - c.originX);
        below = Math.max(below, c.height - c.originY);
    }

    const width = originX + right;
    const height = originY + below;
    if (width <= 0 || height <= 0) return null;

    const colours = characterPalette(rom, characterId);
    const frames = [];

    for (let i = 0; i < composed.length; i++) {
        const c = composed[i];
        const info = spriteInfos[i];
        const data = new Uint8Array(width * height * 4);
        const dx = originX - c.originX;
        const dy = originY - c.originY;

        for (let y = 0; y < c.height; y++) {
            for (let x = 0; x < c.width; x++) {
                const v = c.pixels[y * c.width + x];
                if (v <= 0) continue; // transparent or unset
                const o = ((y + dy) * width + (x + dx)) * 4;
                const [r, g, b] = colours[v];
                data[o] = r;
                data[o + 1] = g;
                data[o + 2] = b;
                data[o + 3] = 255;
            }
        }

        const pngBuf = encodePng({ width, height, data });
        const pngDataUri = 'data:image/png;base64,' + pngBuf.toString('base64');

        // Format chunks list for inspection (matching SoETilesViewer style: 0x0000 @ -12, -31, flags 10)
        const chunkList = info.chunks.map((ch) => ({
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

        frames.push({
            frameIndex: i,
            png: pngDataUri,
            ticks: walk.frames[i].ticks,
            spriteAddr: walk.frames[i].sprite,
            spriteHex: '$' + walk.frames[i].sprite.toString(16),
            chunks: chunkList,
        });
    }

    return {
        width,
        height,
        originX,
        originY,
        complete: walk.complete,
        scriptAddr,
        scriptHex: '$' + scriptAddr.toString(16),
        frames,
        strikeBoxes: strikes,
    };
}

module.exports = {
    renderAnimation,
    resolveExternalScript,
};
