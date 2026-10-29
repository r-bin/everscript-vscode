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

import { buildRoomScriptModel, mergedEnterScript, mergedRoomScript, roleOf, buildArrivalIndex, mergeArrivals, paths, printNames, iconRefs } from '../../script-model';
import type { RoomScript, RoomTrigger, SpawnFacts, MergedScript, Role, ArrivalIndex } from '../../script-model';
import { ScriptRom, decodeAt, facts, printed } from '../../script-vm';
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
    rows: { a: string; op: string; b: string; s: string; d: number; t: boolean; u: boolean; m?: RoomScript['instructions'][number]['marks']; i?: RoomScript['instructions'][number]['icons'] }[];
    loot: string[]; to: string[]; scriptId?: number; box?: Box; role: Role | null;
    /** What it is about, as an icon key (script-model icons.ts): its first loot reward, else the weapon it tests (an axe wall); the page lays it over the trigger's chip. */
    lootKey?: string;
    fromMap?: number;
    fromName?: string;
    fromTrigger?: string;
    sliced?: boolean;
};

/** LOOT_REWARD MONEY: drawn as the era's currency (`money`, model/icons.ts). */
const MONEY = 0x0001;

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
            d: r.depth, t: r.terminal, u: r.unsupported || r.untraced, ...(r.marks ? { m: r.marks } : {}), ...(r.icons ? { i: r.icons } : {}),
        })),
        loot: s.everscript,
        to: s.transitions.map((t) => `${t.mapName} (${t.x}, ${t.y})`),
        role: kind === 'enter' ? 'init' : roleOf(rom, s.scriptAddressSnes),
    };
    const reward = s.loot.find((l) => l.item)?.item?.value;
    const weapon = s.instructions.flatMap((r) => r.icons ?? []).find((i) => i.key.startsWith('weapon:'))?.key;
    if (kind !== 'enter') view.lootKey = reward !== undefined ? (reward === MONEY ? 'money' : 'loot:' + reward) : weapon;
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

function entranceScriptViews(rom: Uint8Array, sr: ScriptRom, id: number, rawArrivals: ReturnType<typeof mergeArrivals>): ScriptView[] {
    const loc = require('../../localizations');
    const names = printNames(loc);
    const out: ScriptView[] = [];

    for (let i = 0; i < rawArrivals.length; i++) {
        const a = rawArrivals[i];
        let srcModel: ReturnType<typeof buildRoomScriptModel> | null = null;
        try { srcModel = buildRoomScriptModel(rom, a.fromMap); } catch { srcModel = null; }
        if (!srcModel) continue;

        const source = a.kind === 'step-on' ? srcModel.stepOn[a.index]
            : a.kind === 'b-trigger' ? srcModel.bTrigger[a.index]
            : srcModel.enter;
        if (!source) continue;

        const fromName = getMapName(a.fromMap) || 'Room $' + hex(a.fromMap, 2);
        const trigLabel = a.kind === 'step-on' ? 'S' + a.index : a.kind === 'b-trigger' ? 'B' + a.index : 'Enter';

        let rows: ScriptView['rows'] = [];
        let sliced = false;

        // Step-on triggers and short scripts: whole trigger is the entrance
        if (a.kind === 'step-on' || source.instructions.length <= 15) {
            rows = source.instructions.map((r) => ({
                a: '$' + hex(r.addressSnes, 6), op: r.opcodeHex, b: r.bytesHex, s: r.summary,
                d: r.depth, t: r.terminal, u: r.unsupported || r.untraced, ...(r.marks ? { m: r.marks } : {}), ...(r.icons ? { i: r.icons } : {}),
            }));
        } else {
            // Cutscene / large script: lines directly before load_map
            sliced = true;
            let idx = source.instructions.findIndex((r) => r.summary.startsWith('load_map(') && r.summary.includes(hex(id, 2)));
            if (idx < 0) idx = source.instructions.findIndex((r) => r.summary.startsWith('load_map('));

            if (idx >= 0) {
                let start = Math.max(0, idx - 7);
                for (let j = idx - 1; j >= start; j--) {
                    if (source.instructions[j].terminal) { start = j + 1; break; }
                }
                let end = idx + 1;
                if (end < source.instructions.length && source.instructions[end].terminal) end++;
                const slice = source.instructions.slice(start, end);
                const baseDepth = slice[0]?.depth ?? 0;
                rows = slice.map((r) => ({
                    a: '$' + hex(r.addressSnes, 6), op: r.opcodeHex, b: r.bytesHex, s: r.summary,
                    d: Math.max(0, r.depth - baseDepth), t: r.terminal, u: r.unsupported || r.untraced, ...(r.marks ? { m: r.marks } : {}), ...(r.icons ? { i: r.icons } : {}),
                }));
            } else {
                // Reached through subroutines
                try {
                    const p = paths(sr, source.scriptAddressSnes).paths;
                    const hit = p.find((path) => {
                        const last = path[path.length - 1];
                        const f = facts(last.ins);
                        return f.k === 'changeMap' && f.map === id;
                    });
                    if (hit) {
                        const slice = hit.slice(-8);
                        rows = slice.map((step) => {
                            const ins = step.ins;
                            const pr = printed(ins, names);
                            const icons = iconRefs(ins, names);
                            const bytes: string[] = [];
                            for (let b = 0; b < ins.size; b++) bytes.push(sr.u8(ins.address + b).toString(16).padStart(2, '0').toUpperCase());
                            return {
                                a: '$' + hex(ins.address, 6),
                                op: '0x' + hex(ins.opcode, 2),
                                b: bytes.join(' '),
                                s: pr.text,
                                d: 0,
                                t: ins.flow === 'end' || ins.flow === 'jump',
                                u: false,
                                ...(pr.marks.length ? { m: pr.marks } : {}),
                                ...(icons.length ? { i: icons } : {}),
                            };
                        });
                    }
                } catch { rows = []; }
            }
        }

        if (!rows.length) {
            rows = source.instructions.map((r) => ({
                a: '$' + hex(r.addressSnes, 6), op: r.opcodeHex, b: r.bytesHex, s: r.summary,
                d: r.depth, t: r.terminal, u: r.unsupported || r.untraced, ...(r.marks ? { m: r.marks } : {}), ...(r.icons ? { i: r.icons } : {}),
            }));
        }

        const address = rows[0] ? parseInt(rows[0].a.replace('$', ''), 16) : source.scriptAddressSnes;
        out.push({
            key: 'entrance:' + i,
            kind: 'entrance',
            index: i,
            address,
            addrHex: rows[0]?.a ?? ('$' + hex(source.scriptAddressSnes, 6)),
            label: `${fromName} (${trigLabel})`,
            stop: source.stopReason,
            rows,
            loot: [],
            to: [`${getMapName(id) || 'Room $' + hex(id, 2)} (${a.x}, ${a.y})`],
            role: 'exit',
            box: {
                x: Math.max(0, a.x - 8),
                y: Math.max(0, a.y - 8),
                w: 16,
                h: 16,
            },
            fromMap: a.fromMap,
            fromName,
            fromTrigger: trigLabel,
            sliced,
        });
    }

    return out;
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
    if (_arrivals.rom !== rom) _arrivals = { rom, index: buildArrivalIndex(rom) };
    const rawArrivals = mergeArrivals(_arrivals.index!.get(id) ?? []);
    const entrances = entranceScriptViews(rom, sr, id, rawArrivals);
    const scripts = [
        ...entrances,
        scriptView(sr, model.enter, 'enter', null, origin),
    ];
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
    return mergeArrivals(_arrivals.index!.get(id) ?? []).map((a, i) => ({
        fromMap: a.fromMap, fromName: getMapName(a.fromMap) || 'Room $' + hex(a.fromMap, 2),
        key: a.kind === 'enter' ? 'enter' : (a.kind === 'step-on' ? 'step:' : 'b:') + a.index,
        x: a.x, y: a.y, direction: a.direction,
        entranceKey: 'entrance:' + i,
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

/** A trigger's script (`key`: `step:0`, `b:1`, `entrance:0`) with its calls merged: { merged } or { error }. */
function triggerMerged(rom: Uint8Array, room: ReturnType<typeof roomScripts>, key: string): { merged: MergedScript } | { error: string } {
    const s = room.scripts?.find((x) => x.key === key);
    if (!s || s.kind === 'enter') return { error: 'No trigger ' + key };
    if (s.kind === 'entrance') {
        if (s.sliced) {
            return {
                merged: {
                    entry: s.address,
                    lines: s.rows.map((r) => ({
                        addressSnes: parseInt(r.a.replace('$', ''), 16) || 0,
                        opcode: parseInt(r.op, 16) || 0,
                        opcodeHex: r.op,
                        size: 0,
                        bytesHex: r.b,
                        summary: r.s,
                        terminal: r.t,
                        untraced: r.u,
                        unsupported: false,
                        depth: r.d,
                        indent: r.d,
                        flat: 0,
                        in: -1,
                        thread: -1,
                        marks: r.m,
                        icons: r.i,
                    })),
                    blocks: [],
                    slices: [],
                    entities: {},
                },
            };
        }
        try {
            return { merged: mergedRoomScript(rom, s.address, ('merged' in room && room.merged?.entities) || {}) };
        } catch {
            return {
                merged: {
                    entry: s.address,
                    lines: s.rows.map((r) => ({
                        addressSnes: parseInt(r.a.replace('$', ''), 16) || 0,
                        opcode: parseInt(r.op, 16) || 0,
                        opcodeHex: r.op,
                        size: 0,
                        bytesHex: r.b,
                        summary: r.s,
                        terminal: r.t,
                        untraced: r.u,
                        unsupported: false,
                        depth: r.d,
                        indent: r.d,
                        flat: 0,
                        in: -1,
                        thread: -1,
                        marks: r.m,
                        icons: r.i,
                    })),
                    blocks: [],
                    slices: [],
                    entities: {},
                },
            };
        }
    }
    try { return { merged: mergedRoomScript(rom, s.address, ('merged' in room && room.merged?.entities) || {}) }; } catch (err) { return { error: String(err instanceof Error ? err.message : err) }; }
}

export { roomList, roomScripts, roomPicture, triggerMerged };
