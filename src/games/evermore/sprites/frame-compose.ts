// Ownership: drawing a run's frames into PNGs aligned on one feet origin, for the Sprites tab. Pure.

import { readSpriteInfo, composeSprite } from '../maps/sprites';
import type { SpritePixels } from '../maps/sprites';
import { encodePng } from '../maps/png';

const EMPTY: SpritePixels = { width: 0, height: 0, originX: 0, originY: 0, pixels: new Int16Array(0), palettes: new Uint8Array(0) };

type Colours = Array<[number, number, number]>;

/**
 * Compose every frame's sprite and blit them into one box large enough for all,
 * aligned on the shared origin, so a caller positions by the origin alone.
 * A frame with no sprite becomes a transparent image. Chunks whose OAM palette bits
 * are 1 use `colours2`, the character's second palette (Harry, Vigor), when given.
 */
function composeAligned(rom: Uint8Array, vmFrames: { sprite: number | null }[], colours: Colours, colours2?: Colours | null) {
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

    const buffers: { pngBuf: Buffer; rgba: Uint8Array }[] = [];
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
        const pngBuf = encodePng({ width, height, data });
        buffers.push({ pngBuf, rgba: data });
        return 'data:image/png;base64,' + pngBuf.toString('base64');
    });

    return { width, height, originX, originY, images, buffers, infos };
}

export { composeAligned };
