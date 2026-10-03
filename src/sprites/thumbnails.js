'use strict';
// Ownership: small preview images for the Sprites tab — a character's resting pose per
// facing, and one sprite shown in every palette the game's characters use. Pure.

const { animationScript, characterPalette, paletteAt } = require('../maps/dist/character-record');
const { runAnimation } = require('../maps/dist/animation-vm');
const { readSpriteInfo, composeSprite } = require('../maps/dist/sprites');
const { encodePng } = require('../maps/dist/png');
const { composeAligned } = require('./frame-compose');

/** The facings the tab's S and E buttons use. */
const THUMB_FACINGS = { s: 0, e: 4 };

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

/** `{ s, e }` data URIs (or null) for one character's list entry. */
function characterThumbs(rom, c) {
    if (c.noVisuals) return null;
    const colours = displayPalette(rom, c);
    const out = {};
    for (const [key, facing] of Object.entries(THUMB_FACINGS)) {
        const sprite = restingSprite(rom, c.id, facing);
        out[key] = sprite ? composeAligned(rom, [{ sprite }], colours).images[0] : null;
    }
    return out.s || out.e ? out : null;
}

const hex4 = (v) => '$' + v.toString(16).padStart(4, '0');

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

module.exports = { characterThumbs, listPalettes, renderInPalettes, THUMB_FACINGS };
