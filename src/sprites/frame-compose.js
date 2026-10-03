'use strict';
// Ownership: drawing a run's frames into PNGs aligned on one feet origin, for the Sprites tab. Pure.

const { readSpriteInfo, composeSprite } = require('../maps/dist/sprites');
const { encodePng } = require('../maps/dist/png');

const EMPTY = { width: 0, height: 0, originX: 0, originY: 0, pixels: [], palettes: [] };

/**
 * Compose every frame's sprite and blit them into one box large enough for all,
 * aligned on the shared origin, so a caller positions by the origin alone.
 * A frame with no sprite becomes a transparent image. Chunks whose OAM palette bits
 * are 1 use `colours2`, the character's second palette (Harry, Vigor), when given.
 */
function composeAligned(rom, vmFrames, colours, colours2) {
    const infos = vmFrames.map((f) => (f.sprite ? readSpriteInfo(rom, f.sprite) : null));
    const composed = infos.map((info) => (info ? composeSprite(rom, info) : EMPTY));

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
    const width = Math.max(1, originX + right);
    const height = Math.max(1, originY + below);

    const images = composed.map((c) => {
        const data = new Uint8Array(width * height * 4);
        const dx = originX - c.originX;
        const dy = originY - c.originY;
        for (let y = 0; y < c.height; y++) {
            for (let x = 0; x < c.width; x++) {
                const v = c.pixels[y * c.width + x];
                if (v <= 0) continue; // transparent or unset
                const o = ((y + dy) * width + (x + dx)) * 4;
                const pal = colours2 && c.palettes[y * c.width + x] ? colours2 : colours;
                const [r, g, b] = pal[v];
                data[o] = r;
                data[o + 1] = g;
                data[o + 2] = b;
                data[o + 3] = 255;
            }
        }
        return 'data:image/png;base64,' + encodePng({ width, height, data }).toString('base64');
    });

    return { width, height, originX, originY, images, infos };
}

module.exports = { composeAligned };
