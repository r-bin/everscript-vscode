'use strict';
// Ownership: finding the ROM on disk for the Rooms tab's script view.
//
// The decoding itself lives in src/script/ and is pure — it takes a buffer.
// This is the thin layer that turns a workspace into that buffer, kept
// separate so the decoder stays testable without a filesystem.

const fs = require('fs');
const path = require('path');

const { buildRoomScriptModel } = require('../../script');
const { renderCharacterSprite, renderSpriteAt, characterAnimation, characterPalette, encodePng } = require('../../maps');

const ROM_NAMES = ['Secret of Evermore (U) [!].smc', 'Secret of Evermore.smc'];

function loadRom(wsRoot, romPathOverride) {
    const candidates = [];
    if (romPathOverride) candidates.push(romPathOverride);
    if (wsRoot) for (const name of ROM_NAMES) candidates.push(path.join(wsRoot, name));
    for (const filePath of candidates) {
        if (filePath && fs.existsSync(filePath)) return new Uint8Array(fs.readFileSync(filePath));
    }
    return null;
}

/**
 * Attach each spawn's idle sprite as a PNG data URI.
 *
 * Cached per character for the room: a jungle places fourteen Wimpy Flowers
 * and they are all the same picture. A character whose animation script
 * cannot be walked gets no sprite rather than a stand-in.
 */
const TICK_MS = 1000 / 60;

/** Render one character: its idle frames if they walk, else one still. */
function buildSprite(rom, character) {
    const png = (px) => 'data:image/png;base64,' + encodePng(px).toString('base64');
    const colours = characterPalette(rom, character);
    const walk = characterAnimation(rom, character);
    const distinct = new Set(walk.frames.map((f) => f.sprite));

    // Only animate when the walk actually produced motion. One sprite held
    // for several frames is a still, and playing it as an animation would
    // claim more than was read.
    if (distinct.size > 1) {
        const frames = [];
        let w = 0;
        let h = 0;
        for (const f of walk.frames) {
            const px = renderSpriteAt(rom, f.sprite, colours);
            if (!px) return null;
            w = Math.max(w, px.width);
            h = Math.max(h, px.height);
            frames.push({ uri: png(px), ms: Math.max(16, Math.round(f.ticks * TICK_MS)) });
        }
        return { uri: frames[0].uri, w, h, frames, complete: walk.complete };
    }
    const px = renderCharacterSprite(rom, character);
    return px ? { uri: png(px), w: px.width, h: px.height, frames: null } : null;
}

function attachSprites(rom, spawns) {
    const cache = new Map();
    for (const spawn of spawns) {
        if (spawn.character === null || spawn.character === undefined) continue;
        if (!cache.has(spawn.character)) {
            let built = null;
            try { built = buildSprite(rom, spawn.character); } catch { built = null; }
            cache.set(spawn.character, built);
        }
        const sprite = cache.get(spawn.character);
        if (!sprite) continue;
        spawn.sprite = sprite.uri;
        spawn.spriteW = sprite.w;
        spawn.spriteH = sprite.h;
        if (sprite.frames) spawn.spriteFrames = sprite.frames;
    }
}

/**
 * The room's enter / step-on / B-trigger scripts, or null when there is no
 * ROM to read. A malformed room returns null rather than a partial model.
 */
function readRoomScriptModel(wsRoot, mapId, romPathOverride) {
    const rom = loadRom(wsRoot, romPathOverride);
    if (!rom) return null;
    try {
        const model = buildRoomScriptModel(rom, mapId);
        attachSprites(rom, model.enter.spawns);
        return model;
    } catch { return null; }
}

module.exports = { readRoomScriptModel, ROM_NAMES };
