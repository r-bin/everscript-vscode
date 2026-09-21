'use strict';
// Ownership: finding the ROM on disk for the Rooms tab's script view.
//
// The decoding itself lives in src/script/ and is pure — it takes a buffer.
// This is the thin layer that turns a workspace into that buffer, kept
// separate so the decoder stays testable without a filesystem.

const fs = require('fs');
const path = require('path');

const { buildRoomScriptModel } = require('../../script');
const { renderCharacterFrames, encodePng, characterDisposition } = require('../../maps');

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

/**
 * Render one character facing south, as aligned frames.
 *
 * Every frame shares one box anchored on the sprite's origin, so the caller
 * can position by the origin and the frames do not jitter against each
 * other. A single frame is a still; only more than one is animation, since
 * playing one sprite as a loop would claim more than was read.
 */
function buildSprite(rom, character) {
    const r = renderCharacterFrames(rom, character);
    if (!r) return null;
    const png = (data) => 'data:image/png;base64,'
        + encodePng({ width: r.width, height: r.height, data }).toString('base64');
    const frames = r.frames.map((f) => ({
        uri: png(f.data),
        ms: Math.max(16, Math.round(f.ticks * TICK_MS)),
    }));
    return {
        uri: frames[0].uri,
        w: r.width,
        h: r.height,
        ox: r.originX,
        oy: r.originY,
        frames: frames.length > 1 ? frames : null,
    };
}

/**
 * Whether this placement fights back.
 *
 * `INVINCIBLE` (bit 1) is what separates the two: every townsperson carries
 * it and no monster does. A spawn that names its own flags decides for
 * itself — `add_enemy(FIRE_EYES, …, INACTIVE_IMORTAL)` places a character
 * with no flags of her own as a harmless one — and the rest fall back to the
 * character's default.
 */
const FLAG_INVINCIBLE = 0x0002;
const FLAG_INACTIVE = 0x0020;

function attachSprites(rom, spawns) {
    const cache = new Map();
    for (const spawn of spawns) {
        if (spawn.character === null || spawn.character === undefined) continue;
        if (!cache.has(spawn.character)) {
            let built = null;
            let disposition = null;
            try {
                built = buildSprite(rom, spawn.character);
                disposition = characterDisposition(rom, spawn.character);
            } catch { built = null; }
            cache.set(spawn.character, { sprite: built, disposition });
        }
        const { sprite, disposition } = cache.get(spawn.character);
        if (disposition) {
            const flags = spawn.state === null || spawn.state === undefined
                ? disposition.flags
                : spawn.state;
            spawn.flags = flags;
            spawn.hostile = (flags & FLAG_INVINCIBLE) === 0;
            spawn.inactive = (flags & FLAG_INACTIVE) !== 0;
            spawn.flagsFrom = spawn.state === null || spawn.state === undefined ? 'character' : 'spawn';
        }
        if (!sprite) continue;
        spawn.sprite = sprite.uri;
        spawn.spriteW = sprite.w;
        spawn.spriteH = sprite.h;
        spawn.spriteOX = sprite.ox;
        spawn.spriteOY = sprite.oy;
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
