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
//
// Each script has a role (script-model roleOf: init, exit, loot, sniff,
// cutscene) the page tints it by. The enter script's camera-bound writes
// (knowledge ram/7e23e9, room pixels) come with their line, so the page can
// draw the bounds the lines it shows leave; a write that restates what every
// room load already set (the whole map, rom/908f80) is marked a warning.
// `arrivals` are the doors in other rooms that lead here (script-model
// arrivals.ts, one index per ROM).

import { buildRoomScriptModel, mergedEnterScript, roleOf, buildArrivalIndex, mergeArrivals } from '../../script-model';
import type { RoomScript, RoomTrigger, SpawnFacts, MergedScript, Role, ArrivalIndex } from '../../script-model';
import { ScriptRom, decodeAt, facts } from '../../script-vm';
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
    rows: { a: string; op: string; b: string; s: string; d: number; t: boolean; u: boolean; m?: RoomScript['instructions'][number]['marks'] }[];
    loot: string[]; to: string[]; scriptId?: number; box?: Box; role: Role | null;
};

function scriptView(rom: ScriptRom, s: RoomScript | RoomTrigger, kind: string, index: number | null, origin: Origin): ScriptView {
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
            d: r.depth, t: r.terminal, u: r.unsupported || r.untraced, ...(r.marks ? { m: r.marks } : {}),
        })),
        loot: s.everscript,
        to: s.transitions.map((t) => `${t.mapName} (${t.x}, ${t.y})`),
        role: kind === 'enter' ? 'init' : roleOf(rom, s.scriptAddressSnes),
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
    const sr = new ScriptRom(rom);
    const scripts = [scriptView(sr, model.enter, 'enter', null, origin)];
    model.stepOn.forEach((t, i) => scripts.push(scriptView(sr, t, 'step', i, origin)));
    model.bTrigger.forEach((t, i) => scripts.push(scriptView(sr, t, 'b', i, origin)));
    let merged: ReturnType<typeof mergedEnterScript> = null;
    try { merged = mergedEnterScript(rom, id); } catch { merged = null; }
    const size = { w: room.header.widthTiles * 16, h: room.header.heightTiles * 16 };
    const bounds = merged ? cameraBounds(sr, merged, size) : [];
    return {
        id, idHex: hex(id, 2), name: getMapName(id) || '', scripts, merged, sprites: spawnSprites(rom, model.enter.spawns),
        size, bounds, arrivals: arrivalsOf(rom, id),
    };
}

/** The camera bounds (knowledge ram/7e23e9): MAP_X_START / MAP_Y_START, MAP_X_END / MAP_Y_END. */
const BOUND_START = 0x23E9, BOUND_END = 0x23ED;
type BoundWrite = { at: number; edge: 'start' | 'end'; x: number; y: number };

/**
 * The enter script's camera-bound writes, in listing order. A write that restates what the room
 * load set (start 0, 0; end the map's size: rom/908f80) before any other write to that edge gets a
 * warning on its line.
 */
function cameraBounds(rom: ScriptRom, merged: MergedScript, size: { w: number; h: number }): BoundWrite[] {
    const out: BoundWrite[] = [];
    for (const line of merged.lines) {
        if (line.note || line.brace) continue;
        let f;
        try { f = facts(decodeAt(rom, line.addressSnes)); } catch { continue; }
        if (f.k !== 'tilePair' || f.area !== 'save' || (f.xAddr !== BOUND_START && f.xAddr !== BOUND_END)) continue;
        const edge = f.xAddr === BOUND_START ? 'start' : 'end';
        const same = edge === 'start' ? f.x === 0 && f.y === 0 : f.x === size.w && f.y === size.h;
        if (same && !out.some((o) => o.edge === edge)) {
            line.marks = [...(line.marks ?? []), {
                severity: 'warning',
                message: `Changes nothing: every room load already sets the camera bounds to the whole map (${edge === 'start' ? '0, 0' : size.w + ', ' + size.h}), $90:8F80.`,
            }];
        }
        out.push({ at: line.addressSnes, edge, x: f.x, y: f.y });
    }
    return out;
}

let _arrivals: { rom: Uint8Array | null; index: ArrivalIndex | null } = { rom: null, index: null };

/** The doors in other rooms (and this one) that lead here: where they are and where you land, in room pixels. */
function arrivalsOf(rom: Uint8Array, id: number) {
    if (_arrivals.rom !== rom) _arrivals = { rom, index: buildArrivalIndex(rom) };
    return mergeArrivals(_arrivals.index!.get(id) ?? []).map((a) => ({
        fromMap: a.fromMap, fromName: getMapName(a.fromMap) || 'Room $' + hex(a.fromMap, 2),
        key: a.kind === 'enter' ? 'enter' : (a.kind === 'step-on' ? 'step:' : 'b:') + a.index,
        x: a.x, y: a.y, direction: a.direction,
    }));
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
