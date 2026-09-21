'use strict';
// Ownership: finding the ROM on disk for the Rooms tab's script view.
//
// The decoding itself lives in src/script/ and is pure — it takes a buffer.
// This is the thin layer that turns a workspace into that buffer, kept
// separate so the decoder stays testable without a filesystem.

const fs = require('fs');
const path = require('path');

const { buildRoomScriptModel } = require('../../script');
const { renderCharacterSprite, encodePng } = require('../../maps');

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
function attachSprites(rom, spawns) {
    const cache = new Map();
    for (const spawn of spawns) {
        if (spawn.character === null || spawn.character === undefined) continue;
        if (!cache.has(spawn.character)) {
            let uri = null;
            try {
                const px = renderCharacterSprite(rom, spawn.character);
                if (px) {
                    uri = {
                        uri: 'data:image/png;base64,' + encodePng(px).toString('base64'),
                        w: px.width,
                        h: px.height,
                    };
                }
            } catch { uri = null; }
            cache.set(spawn.character, uri);
        }
        const sprite = cache.get(spawn.character);
        if (sprite) { spawn.sprite = sprite.uri; spawn.spriteW = sprite.w; spawn.spriteH = sprite.h; }
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
