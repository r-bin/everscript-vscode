'use strict';
// Ownership: Lua watcher POI data and ROM script trigger loading.
// Reads soestuff.lua for gameDrawPoint coordinates and the ROM for trigger data.
// Caches results module-locally; call invalidateLuaWatcherCaches() to clear.

const path = require('path');
const fs   = require('fs');
const { parseEvsEnumValues } = require('../../shared/radar-utils');
const { readRoomScriptModel } = require('../../emulator/room-script-model');

let _radarMapEnumCache = null;
let _luaWatcherCache   = null;

function invalidateLuaWatcherCaches() {
    _radarMapEnumCache = null;
    _luaWatcherCache   = null;
}

/**
 * Return cached MAP enum: Map<enumName, numericId>.
 * Reads all .evs files under in/core/ looking for `enum MAP { ... }`.
 */
function getMapEnum(wsRoot) {
    if (_radarMapEnumCache) return _radarMapEnumCache;
    _radarMapEnumCache = new Map();
    if (!wsRoot) return _radarMapEnumCache;
    const coreDir = path.join(wsRoot, 'in', 'core');
    const scan = (dir) => {
        let entries;
        try { entries = fs.readdirSync(dir); } catch { return; }
        for (const f of entries) {
            const fp = path.join(dir, f);
            try {
                const st = fs.statSync(fp);
                if (st.isDirectory()) scan(fp);
                else if (f.endsWith('.evs')) {
                    const txt = fs.readFileSync(fp, 'utf8');
                    if (!/\benum\s+MAP\b/.test(txt)) continue;
                    for (const [k, v] of parseEvsEnumValues(txt, 'MAP')) _radarMapEnumCache.set(k, v);
                }
            } catch { /* skip unreadable files */ }
        }
    };
    scan(coreDir);
    return _radarMapEnumCache;
}

/**
 * Parse gameDrawPoint/gameDrawBox calls from soestuff.lua per-room watcher blocks.
 * Returns Map<roomId_hex_string, [{x, y}]> in 8-px tile units.
 */
function readLuaWatchers(wsRoot) {
    if (_luaWatcherCache !== null) return _luaWatcherCache;
    _luaWatcherCache = new Map();

    const candidates = [
        path.join(wsRoot, '..', 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
        path.join(wsRoot, '..', '..', 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
        path.join(path.dirname(wsRoot), 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
    ];
    let luaText = '';
    for (const c of candidates) {
        try { luaText = fs.readFileSync(c, 'utf8'); break; } catch { /* try next */ }
    }
    if (!luaText) return _luaWatcherCache;

    const blockRe = /\[0x([0-9a-f]+)\]\s*=\s*\{/gi;
    let m, blocks = [];
    while ((m = blockRe.exec(luaText)) !== null) blocks.push({ id: m[1], start: m.index });

    for (let bi = 0; bi < blocks.length; bi++) {
        const { id, start } = blocks[bi];
        const end  = bi + 1 < blocks.length ? blocks[bi + 1].start : luaText.length;
        const body = luaText.slice(start, end);
        const ptRe = /gameDrawPoint\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)/g;
        let pm, pts = [];
        while ((pm = ptRe.exec(body)) !== null) {
            const px = parseInt(pm[1], pm[1].startsWith('0x') ? 16 : 10);
            const py = parseInt(pm[2], pm[2].startsWith('0x') ? 16 : 10);
            pts.push({ x: px / 8, y: py / 8 });
        }
        if (pts.length) _luaWatcherCache.set(id.toLowerCase().replace(/^0+/, '') || '0', pts);
    }
    return _luaWatcherCache;
}

/**
 * Load all ROM script triggers for a given vanilla room.
 * @param {string} vanillaEnumName  Enum name (e.g. '0x33') or MAP enum key.
 * @returns {{ enter, stepOn, bTrigger, meta }}
 */
function readScriptAllTriggers(wsRoot, vanillaEnumName, romPathOverride = '') {
    const out = { enter: null, stepOn: [], bTrigger: [], meta: null };
    if (!wsRoot || !vanillaEnumName) return out;

    let roomId = NaN;
    if (/^0x/i.test(vanillaEnumName)) {
        roomId = parseInt(vanillaEnumName, 16);
    } else {
        const mapEnum = getMapEnum(wsRoot);
        roomId = mapEnum.get(vanillaEnumName) ?? NaN;
        if (isNaN(roomId)) roomId = parseInt(vanillaEnumName, 10);
    }
    if (isNaN(roomId)) return out;

    const model = readRoomScriptModel(wsRoot, roomId, romPathOverride);
    if (!model) return out;
    return model;
}

module.exports = { getMapEnum, readLuaWatchers, readScriptAllTriggers, invalidateLuaWatcherCaches };
