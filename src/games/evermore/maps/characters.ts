// Ownership: drawing a character — its idle animation as pixels, in its own
// palette. Pure.
//
// The two halves it stands on: ./character-record for the table fields and
// ./character-animation for the frames an idle cycles through. Sprite pixels
// themselves are ./sprites.

import { composeSprite, readSpriteInfo } from './sprites';
import { characterPalette, FACING_SOUTH } from './character-record';
import { characterAnimation, resolveCharacterSprite } from './character-animation';

/**
 * A character's idle animation as aligned RGBA frames.
 *
 * Chunk offsets are signed around an **origin that sits at the sprite's
 * feet**, not its centre — a 32x32 flower has its origin at y=25. Placing a
 * sprite by its centre therefore drops it about a tile too low, and frames
 * of different sizes jitter against each other.
 *
 * So every frame is blitted into one box big enough for all of them, aligned
 * on that origin, and the caller positions the box by the origin alone.
 */
export function renderCharacterFrames(
    rom: Uint8Array,
    character: number,
    facing = FACING_SOUTH,
): { width: number; height: number; originX: number; originY: number;
     frames: Array<{ data: Uint8Array; ticks: number }>; complete: boolean } | null {
    const walk = characterAnimation(rom, character, facing);
    const list = walk.frames.length
        ? walk.frames
        : (() => {
            const p = resolveCharacterSprite(rom, character, facing);
            return p === null ? [] : [{ sprite: p, ticks: 0 }];
        })();
    if (!list.length) return null;

    const composed = list.map((f) => composeSprite(rom, readSpriteInfo(rom, f.sprite)));
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

    const colours = characterPalette(rom, character);
    const frames = composed.map((c, i) => {
        const data = new Uint8Array(width * height * 4);
        const dx = originX - c.originX;
        const dy = originY - c.originY;
        for (let y = 0; y < c.height; y++) {
            for (let x = 0; x < c.width; x++) {
                const v = c.pixels[y * c.width + x];
                if (v <= 0) continue;
                const o = ((y + dy) * width + (x + dx)) * 4;
                const [r, g, b] = colours[v];
                data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
            }
        }
        return { data, ticks: list[i].ticks };
    });
    return { width, height, originX, originY, frames, complete: walk.complete };
}

/** One sprite as RGBA in a character's palette. */
export function renderSpriteAt(
    rom: Uint8Array,
    pointer: number,
    colours: Array<[number, number, number]>,
): { width: number; height: number; data: Uint8Array } | null {
    const px = composeSprite(rom, readSpriteInfo(rom, pointer));
    if (px.width <= 0 || px.height <= 0) return null;
    const data = new Uint8Array(px.width * px.height * 4);
    for (let i = 0; i < px.pixels.length; i++) {
        const v = px.pixels[i];
        if (v <= 0) continue;                 // -1 unset, 0 transparent
        const [r, g, b] = colours[v];
        data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
    }
    return { width: px.width, height: px.height, data };
}

/** A character's idle sprite as RGBA, or null when its script cannot be walked. */
export function renderCharacterSprite(
    rom: Uint8Array,
    character: number,
    facing = FACING_SOUTH,
): { width: number; height: number; data: Uint8Array } | null {
    const pointer = resolveCharacterSprite(rom, character, facing);
    if (pointer === null) return null;
    return renderSpriteAt(rom, pointer, characterPalette(rom, character));
}
