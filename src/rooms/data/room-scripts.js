'use strict';
// Ownership: finding the ROM on disk for the Rooms tab's script view.
//
// The decoding itself lives in src/script/ and is pure — it takes a buffer.
// This is the thin layer that turns a workspace into that buffer, kept
// separate so the decoder stays testable without a filesystem.

const fs = require('fs');
const path = require('path');

const { buildRoomScriptModel } = require('../../script');

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
 * The room's enter / step-on / B-trigger scripts, or null when there is no
 * ROM to read. A malformed room returns null rather than a partial model.
 */
function readRoomScriptModel(wsRoot, mapId, romPathOverride) {
    const rom = loadRom(wsRoot, romPathOverride);
    if (!rom) return null;
    try { return buildRoomScriptModel(rom, mapId); }
    catch { return null; }
}

module.exports = { readRoomScriptModel, ROM_NAMES };
