'use strict';
// Ownership: raw sprite inspection, chunk listing, and standalone sprite rendering for the Sprites tab. Pure.

const { walkSprites, readSpriteInfo, composeSprite, SPRITE_LIST_START } = require('../maps/dist/sprites');
const { encodePng } = require('../maps/dist/png');
const { paletteAt } = require('../maps/dist/character-record');

const DEFAULT_BOY_PALETTE = 0x90b00b;
const MAX_RAW_SPRITES = 5500;

let _spriteIndexCache = null;

/**
 * Build index of all raw sprites walked sequentially from $CA0003.
 * Cached in memory for speed across panel reloads.
 */
function getRawSpriteIndex(rom) {
    if (_spriteIndexCache) return _spriteIndexCache;
    const sprites = walkSprites(rom, MAX_RAW_SPRITES);
    _spriteIndexCache = sprites.map((s, idx) => {
        let minX = 0, minY = 0, maxX = 1, maxY = 1;
        for (const c of s.chunks) {
            const sz = c.large ? 16 : 8;
            if (c.x < minX) minX = c.x;
            if (c.y < minY) minY = c.y;
            if (c.x + sz > maxX) maxX = c.x + sz;
            if (c.y + sz > maxY) maxY = c.y + sz;
        }
        return {
            index: idx,
            address: s.address,
            addrHex: '$' + s.address.toString(16),
            chunkCount: s.chunks.length,
            width: maxX - minX,
            height: maxY - minY,
            size: s.size,
            label: `$${s.address.toString(16)} -> ${maxX - minX},${maxY - minY}`,
        };
    });
    return _spriteIndexCache;
}

/** Render a single raw sprite at `address` into PNG and chunk breakdown. */
function renderRawSprite(rom, address, paletteAddr = DEFAULT_BOY_PALETTE) {
    const info = readSpriteInfo(rom, address);
    if (!info || !info.chunks || !info.chunks.length) return null;

    const composed = composeSprite(rom, info);
    if (composed.width <= 0 || composed.height <= 0) return null;

    const colours = paletteAt(rom, paletteAddr);
    const data = new Uint8Array(composed.width * composed.height * 4);

    for (let y = 0; y < composed.height; y++) {
        for (let x = 0; x < composed.width; x++) {
            const v = composed.pixels[y * composed.width + x];
            if (v <= 0) continue;
            const o = (y * composed.width + x) * 4;
            const [r, g, b] = colours[v];
            data[o] = r;
            data[o + 1] = g;
            data[o + 2] = b;
            data[o + 3] = 255;
        }
    }

    const pngBuf = encodePng({ width: composed.width, height: composed.height, data });
    const png = 'data:image/png;base64,' + pngBuf.toString('base64');

    const chunks = info.chunks.map((ch) => ({
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

    return {
        address,
        addrHex: '$' + address.toString(16),
        width: composed.width,
        height: composed.height,
        originX: composed.originX,
        originY: composed.originY,
        chunkCount: chunks.length,
        png,
        chunks,
    };
}

module.exports = {
    SPRITE_LIST_START,
    getRawSpriteIndex,
    renderRawSprite,
};
