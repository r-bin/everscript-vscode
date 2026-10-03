'use strict';
// Ownership: small preview images for the Sprites tab — a character's resting pose per
// facing, and one sprite shown in every palette the game's characters use. Pure.

const { animationScript, characterPalette, paletteAt } = require('../maps/dist/character-record');
const { runAnimation, facingScript } = require('../maps/dist/animation-vm');
const { readSpriteInfo, composeSprite, decodeSpriteBlock } = require('../maps/dist/sprites');
const { encodePng } = require('../maps/dist/png');
const { composeAligned } = require('./frame-compose');
const { snesToRom } = require('../maps/dist/rom');
const { resolveCharacterSprite } = require('../maps/dist/character-animation');

/** South (8, the front view) and east (4) — the direction tables move 8 down the screen. */
const THUMB_FACINGS = { s: 8, e: 4 };

/**
 * The idle's resting pose: the last frame of its cycle that draws something (what the
 * character settles back into before the loop), else a segmented body's head.
 */
function restingSprite(rom, id, facing) {
    const script = animationScript(rom, id, facing, 0x32);
    if (!script) return 0;
    const run = runAnimation(rom, script, facing);
    for (let i = run.frames.length - 1; i >= 0; i--) {
        const f = run.frames[i];
        if (f.sprite) return f.sprite;
        if (f.segments && f.segments.sprites.length) return f.segments.sprites[0];
    }
    return 0;
}

/** The palette a character is shown in: the Boy's first weapon, the Dog's first form, else its own. */
function displayPalette(rom, c) {
    if ((c.id === 0 || c.id === 1) && c.weapons && c.weapons[0] && c.weapons[0].paletteAddr) return paletteAt(rom, c.weapons[0].paletteAddr);
    return characterPalette(rom, c.id);
}

/** A character's second palette (+0x0B: Harry, Vigor), or null. */
function secondPalette(rom, c) {
    return c && c.stats && c.stats.unknown0b ? paletteAt(rom, c.stats.unknown0b) : null;
}

/** `{ s, e }` data URIs (or null) for one character's list entry. */
function characterThumbs(rom, c) {
    if (c.noVisuals) return null;
    const colours = displayPalette(rom, c);
    const colours2 = secondPalette(rom, c);
    const out = {};
    for (const [key, facing] of Object.entries(THUMB_FACINGS)) {
        const sprite = restingSprite(rom, c.id, facing);
        out[key] = sprite ? composeAligned(rom, [{ sprite }], colours, colours2).images[0] : null;
    }
    return out.s || out.e ? out : null;
}

const hex4 = (v) => '$' + v.toString(16).padStart(4, '0');
const read16 = (rom, snes) => { const o = snesToRom(snes); return rom[o] | (rom[o + 1] << 8); };

/**
 * Every distinct palette the characters use — record +0x09 and +0x0B, the Boy's weapon
 * palettes, the Dog's forms — each with who uses it.
 */
function listPalettes(characters) {
    const byAddr = new Map();
    const add = (addr, who) => {
        if (!addr) return;
        if (!byAddr.has(addr)) byAddr.set(addr, []);
        const list = byAddr.get(addr);
        if (!list.includes(who)) list.push(who);
    };
    for (const c of characters) {
        add(c.stats.palette, c.name);
        add(c.stats.unknown0b, c.name + ' (2nd)');
        for (const w of c.weapons || []) add(w.paletteAddr, (c.id === 1 ? 'Dog · ' : 'Boy · ') + w.name);
    }
    return [...byAddr.entries()].sort((a, b) => a[0] - b[0]).map(([addr, owners]) => ({ addr, addrHex: hex4(addr), owners }));
}

/** One sprite coloured with each palette — composed once, recoloured per palette. */
function renderInPalettes(rom, sprite, palettes) {
    if (!sprite) return [];
    const c = composeSprite(rom, readSpriteInfo(rom, sprite));
    if (!c.width || !c.height) return [];
    return palettes.map((p) => {
        const colours = paletteAt(rom, p.addr);
        const data = new Uint8Array(c.width * c.height * 4);
        for (let i = 0; i < c.pixels.length; i++) {
            const v = c.pixels[i];
            if (v <= 0) continue;
            const [r, g, b] = colours[v];
            data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
        }
        const png = 'data:image/png;base64,' + encodePng({ width: c.width, height: c.height, data }).toString('base64');
        return { addr: p.addr, addrHex: p.addrHex, owners: p.owners, png };
    });
}

/** The resting sprite of whatever a record plays at a facing (last drawn frame, else a head segment). */
function recordRestingSprite(rom, record, facing) {
    const script = facingScript(rom, record, facing);
    if (!script) return 0;
    const run = runAnimation(rom, script, facing);
    for (let i = run.frames.length - 1; i >= 0; i--) {
        const f = run.frames[i];
        if (f.sprite) return f.sprite;
        if (f.segments && f.segments.sprites.length) return f.segments.sprites[0];
    }
    return 0;
}

/**
 * One list thumbnail, rendered on demand: `{ sprite }` a raw sprite, or `{ record, facing }`
 * an animation's resting pose; coloured by `paletteAddr`, else `character`'s own palette.
 * Returns a data URI, or null when there is nothing to draw.
 */
function thumbFor(rom, item) {
    if (Number.isInteger(item.block)) return blockThumb(rom, item);
    let sprite = item.sprite || (item.record ? recordRestingSprite(rom, item.record, item.facing || 0) : 0);
    // An animation that sets no sprite (the shared knock-back) keeps the character's standing one.
    if (!sprite && item.record && Number.isInteger(item.character)) sprite = resolveCharacterSprite(rom, item.character, item.facing || 0) || 0;
    if (!sprite) return null;
    const colours = item.paletteAddr ? paletteAt(rom, item.paletteAddr) : characterPalette(rom, item.character || 0);
    const pal2 = Number.isInteger(item.character) ? read16(rom, 0x8eb678 + item.character * 74 + 0x0b) : 0;
    const c = composeAligned(rom, [{ sprite }], colours, pal2 ? paletteAt(rom, pal2) : null);
    return c.width > 1 || c.height > 1 ? c.images[0] : null;
}

/**
 * One sprite chunk's tile: block `item.block` from the 8×8 or 16×16 pool, flipped like the
 * chunk, coloured with the character's own palette or — when its OAM palette bits are 1 —
 * its second one.
 */
function blockThumb(rom, item) {
    const b = decodeSpriteBlock(rom, item.block, !!item.large);
    const own = item.paletteAddr ? paletteAt(rom, item.paletteAddr) : characterPalette(rom, item.character || 0);
    const pal2 = item.pal && Number.isInteger(item.character) ? read16(rom, 0x8eb678 + item.character * 74 + 0x0b) : 0;
    const colours = pal2 ? paletteAt(rom, pal2) : own;
    const data = new Uint8Array(b.size * b.size * 4);
    for (let y = 0; y < b.size; y++) {
        for (let x = 0; x < b.size; x++) {
            const v = b.pixels[(item.flipY ? b.size - 1 - y : y) * b.size + (item.flipX ? b.size - 1 - x : x)];
            if (!v) continue;
            const o = (y * b.size + x) * 4;
            const [r, g, bl] = colours[v];
            data[o] = r; data[o + 1] = g; data[o + 2] = bl; data[o + 3] = 255;
        }
    }
    return 'data:image/png;base64,' + encodePng({ width: b.size, height: b.size, data }).toString('base64');
}

module.exports = { characterThumbs, listPalettes, renderInPalettes, thumbFor, THUMB_FACINGS };
