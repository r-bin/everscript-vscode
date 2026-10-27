// Ownership: the Scripts tab's room scripts — every room's enter script,
// step-on and B-triggers (the decoder in ../../script), each trigger's box in
// the room picture's pixels, and the picture itself; the enter script with its
// calls merged in, and the characters it can place as sprites in the picture's
// pixels (a variant shows those it places). Pure apart from the ROM buffer.
//
// A spawn stands at pixel 8 * x of the room picture, its sprite's origin on
// that point (rooms/webview/svg-spawns.js says how that was checked): unlike a
// trigger box, no header origin is taken off.
//
// A trigger box is in 16 px tiles, offset by the room header's origin:
// pixel = (x - originX) * 16, x2/y2 exclusive (maps/collision-overlay.ts draws
// them the same way).

import { buildRoomScriptModel, mergedEnterScript } from '../../script-model';
import type { RoomScript, RoomTrigger, SpawnFacts } from '../../script-model';
import * as maps from '../../maps';
import { getMapName, getMapArea } from '../../localizations';
import { hex } from '../../../../platform';

/** Every room with a name: [{ id, idHex, name, area }]. */
function roomList() {
    const out: { id: number; idHex: string; name: string; area: string }[] = [];
    for (let id = 0; id < maps.MAX_ROOMS; id++) {
        out.push({ id, idHex: hex(id, 2), name: getMapName(id) || 'Room $' + hex(id, 2), area: getMapArea(id) || '' });
    }
    return out;
}

type Box = { x: number; y: number; w: number; h: number };
type Origin = { x: number; y: number };
type ScriptView = {
    key: string; kind: string; index: number | null; address: number; addrHex: string; label: string; stop: string;
    rows: { a: string; op: string; b: string; s: string; d: number; t: boolean; u: boolean }[];
    loot: string[]; to: string[]; scriptId?: number; box?: Box;
};

function scriptView(s: RoomScript | RoomTrigger, kind: string, index: number | null, origin: Origin): ScriptView {
    const view: ScriptView = {
        key: kind + (index === null ? '' : ':' + index),
        kind,
        index,
        address: s.scriptAddressSnes,
        addrHex: '$' + hex(s.scriptAddressSnes, 6),
        label: s.label,
        stop: s.stopReason,
        rows: s.instructions.map((r) => ({
            a: '$' + hex(r.addressSnes, 6), op: r.opcodeHex, b: r.bytesHex, s: r.summary,
            d: r.depth, t: r.terminal, u: r.unsupported || r.untraced,
        })),
        loot: s.everscript,
        to: s.transitions.map((t) => `${t.mapName} (${t.x}, ${t.y})`),
    };
    if (kind !== 'enter') {
        const t = s as RoomTrigger;
        view.scriptId = t.scriptId;
        view.box = {
            x: (t.x1 - origin.x) * 16, y: (t.y1 - origin.y) * 16,
            w: Math.max(1, t.x2 - t.x1) * 16, h: Math.max(1, t.y2 - t.y1) * 16,
        };
    }
    return view;
}

/** One room's scripts: { id, name, scripts: [view] } or { id, error }. */
function roomScripts(rom: Uint8Array, id: number) {
    let model: ReturnType<typeof buildRoomScriptModel>;
    let room: ReturnType<typeof maps.decodeRoom>;
    try {
        model = buildRoomScriptModel(rom, id);
        room = maps.decodeRoom(rom, id);
    } catch (err) {
        return { id, error: String(err instanceof Error ? err.message : err) };
    }
    const origin = { x: room.header.originX, y: room.header.originY };
    const scripts = [scriptView(model.enter, 'enter', null, origin)];
    model.stepOn.forEach((t, i) => scripts.push(scriptView(t, 'step', i, origin)));
    model.bTrigger.forEach((t, i) => scripts.push(scriptView(t, 'b', i, origin)));
    let merged: ReturnType<typeof mergedEnterScript> = null;
    try { merged = mergedEnterScript(rom, id); } catch { merged = null; }
    return { id, idHex: hex(id, 2), name: getMapName(id) || '', scripts, merged, sprites: spawnSprites(rom, model.enter.spawns) };
}

type Sprite = { at: number; name: string; uri: string; x: number; y: number; w: number; h: number };

/** Each placement the enter script can make, as its character's first frame facing south, in picture pixels. */
function spawnSprites(rom: Uint8Array, spawns: SpawnFacts[]): Sprite[] {
    const pictures = new Map<number, { uri: string; w: number; h: number; ox: number; oy: number } | null>();
    const out: Sprite[] = [];
    for (const s of spawns) {
        if (s.character === null || s.x === null || s.y === null) continue;
        if (!pictures.has(s.character)) {
            let p = null;
            try {
                const r = maps.renderCharacterFrames(rom, s.character);
                if (r) p = { uri: maps.encodePngDataUri({ width: r.width, height: r.height, data: r.frames[0].data }), w: r.width, h: r.height, ox: r.originX, oy: r.originY };
            } catch { p = null; }
            pictures.set(s.character, p);
        }
        const p = pictures.get(s.character);
        if (!p) continue;
        out.push({ at: s.at, name: s.romName || s.name || '', uri: p.uri, x: s.x * 8 - p.ox, y: s.y * 8 - p.oy, w: p.w, h: p.h });
    }
    return out;
}

/**
 * The room as the game draws it, as a PNG data URI: { uri, width, height } or { error }. `states`:
 * object index → state (a variant's `objects`), the rest at state 0; `palette`: MAP_PALETTE, the
 * palette set (a variant's `palette`; 0 is the one the room loads with).
 */
function roomPicture(rom: Uint8Array, id: number, states?: Record<number, number>, palette = 0) {
    try {
        let room = maps.decodeRoom(rom, id);
        if (palette > 0 && palette < room.tileFamilies.length) room = { ...room, tileFamilies: maps.familiesAt(room.tileFamilies, palette) };
        const img = maps.renderRoomComposite(rom, states ? maps.applyObjectStates(rom, room, states) : room);
        return { uri: maps.encodePngDataUri(img), width: img.width, height: img.height };
    } catch (err) {
        return { error: String(err instanceof Error ? err.message : err) };
    }
}

export { roomList, roomScripts, roomPicture };
