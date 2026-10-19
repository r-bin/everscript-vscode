// Ownership: Lua watcher POI data and ROM script trigger loading.
// Reads soestuff.lua for gameDrawPoint coordinates and the ROM for trigger data.
// Caches results module-locally; call invalidateLuaWatcherCaches() to clear.

import * as path from 'path';
import * as fs from 'fs';
import { parseEvsEnumValues } from '../../radar-utils';
import { readRoomScriptModel } from './room-scripts';
import type { RoomScriptModel } from '../../script-model';

/** What a room without a ROM or a name gives back. */
interface EmptyTriggers { enter: null; stepOn: unknown[]; bTrigger: unknown[]; meta: null }

let _radarMapEnumCache: Map<string, number> | null = null;
let _luaWatcherCache: Map<string, { x: number; y: number }[]> | null = null;

function invalidateLuaWatcherCaches() {
    _radarMapEnumCache = null;
    _luaWatcherCache   = null;
}

/**
 * Return cached MAP enum: Map<enumName, numericId>.
 * Reads all .evs files under in/core/ looking for `enum MAP { ... }`.
 */
function getMapEnum(wsRoot: string): Map<string, number> {
    if (_radarMapEnumCache) return _radarMapEnumCache;
    const cache = _radarMapEnumCache = new Map<string, number>();
    if (!wsRoot) return cache;
    const coreDir = path.join(wsRoot, 'in', 'core');
    const scan = (dir: string): void => {
        let entries: string[];
        try { entries = fs.readdirSync(dir); } catch { return; }
        for (const f of entries) {
            const fp = path.join(dir, f);
            try {
                const st = fs.statSync(fp);
                if (st.isDirectory()) scan(fp);
                else if (f.endsWith('.evs')) {
                    const txt = fs.readFileSync(fp, 'utf8');
                    if (!/\benum\s+MAP\b/.test(txt)) continue;
                    for (const [k, v] of parseEvsEnumValues(txt, 'MAP')) cache.set(k, v);
                }
            } catch { /* skip unreadable files */ }
        }
    };
    scan(coreDir);
    return cache;
}

/**
 * Parse gameDrawPoint/gameDrawBox calls from soestuff.lua per-room watcher blocks.
 * Returns Map<roomId_hex_string, [{x, y}]> in 8-px tile units.
 */
function readLuaWatchers(wsRoot: string): Map<string, { x: number; y: number }[]> {
    if (_luaWatcherCache !== null) return _luaWatcherCache;
    const cache = _luaWatcherCache = new Map<string, { x: number; y: number }[]>();

    const candidates = [
        path.join(wsRoot, '..', 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
        path.join(wsRoot, '..', '..', 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
        path.join(path.dirname(wsRoot), 'snes-scripts', 'Secret of Evermore', 'soestuff.lua'),
    ];
    let luaText = '';
    for (const c of candidates) {
        try { luaText = fs.readFileSync(c, 'utf8'); break; } catch { /* try next */ }
    }
    if (!luaText) return cache;

    const blockRe = /\[0x([0-9a-f]+)\]\s*=\s*\{/gi;
    let m: RegExpExecArray | null;
    const blocks: { id: string; start: number }[] = [];
    while ((m = blockRe.exec(luaText)) !== null) blocks.push({ id: m[1], start: m.index });

    for (let bi = 0; bi < blocks.length; bi++) {
        const { id, start } = blocks[bi];
        const end  = bi + 1 < blocks.length ? blocks[bi + 1].start : luaText.length;
        const body = luaText.slice(start, end);
        const ptRe = /gameDrawPoint\s*\(\s*(0x[0-9a-fA-F]+|\d+)\s*,\s*(0x[0-9a-fA-F]+|\d+)/g;
        let pm: RegExpExecArray | null;
        const pts: { x: number; y: number }[] = [];
        while ((pm = ptRe.exec(body)) !== null) {
            const px = parseInt(pm[1], pm[1].startsWith('0x') ? 16 : 10);
            const py = parseInt(pm[2], pm[2].startsWith('0x') ? 16 : 10);
            pts.push({ x: px / 8, y: py / 8 });
        }
        if (pts.length) cache.set(id.toLowerCase().replace(/^0+/, '') || '0', pts);
    }
    return cache;
}

/**
 * Load all ROM script triggers for a given vanilla room.
 * @param {string} vanillaEnumName  Enum name (e.g. '0x33') or MAP enum key.
 * @returns {{ enter, stepOn, bTrigger, meta }}
 */
function readScriptAllTriggers(wsRoot: string, vanillaEnumName: string, romPathOverride = ''): RoomScriptModel | EmptyTriggers {
    const out: EmptyTriggers = { enter: null, stepOn: [], bTrigger: [], meta: null };
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

export { getMapEnum, readLuaWatchers, readScriptAllTriggers, invalidateLuaWatcherCaches };
