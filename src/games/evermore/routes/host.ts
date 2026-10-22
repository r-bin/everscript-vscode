// Ownership: the Routes tab's host side: reads the route files, plays them against the room
// scripts of the user's ROM (the simulation's cases of each trigger a step runs), and answers the
// page with the routes, each room's overlay (trigger boxes, enemy spawns) and pictures. No VS
// Code dependency: the ROM loader, the workspace folder and `open` are injected by radar-open.js.
//
//   page -> routesInit                           host -> routesIndex { routes, rooms, files, problems, rom }
//   page -> routesPicture { room, opened: [] }   host -> routesPicture { room, key, uri, width, height } | { room, key, error }
//   page -> routesFight { route, n }             host -> routesFight { route, n, report, inputs } | { route, n, error }
//   page -> routesOpen { file }                  host opens the route file (or its source notes) in the editor
//
// Routes: the bundled drafts (data/), then every `*.route.json` in the workspace root and its
// `routes/` folder (routes.md: saved next to the workspace).
//
// State owned: `_cache` (room overlays, trigger analyses and pictures, for one ROM); `_routes` (the
// routes last sent, for `routesFight`).

import * as fs from 'fs';
import * as path from 'path';
import { parseRoute, routeViews } from './model/route';
import type { RouteView } from './model/route';
import { triggerOf } from './model/simulate';
import type { Sym, TriggerAnalysis } from './model/simulate';
import { buildRoomScriptModel } from '../script-model';
import type { RoomScriptModel } from '../script-model';
import { createSimulator, PINS_BETWEEN_PICKUPS } from '../simulation';
import type { Simulator } from '../simulation';
import * as maps from '../maps';
import { getMapName, getMapArea } from '../localizations';
import { sourceDir } from '../../../platform/source-dir';
import anyPercent from './data/any-percent.route.json';
import { fightFor } from './fight-inputs';
import { simulateFight } from './model/fight';

type Rom = Uint8Array;
interface Deps {
    post(message: object): void;
    loadRom(): Buffer | Uint8Array | null;
    workspace(): string | null;
    open(file: string): void;
}

/** What the map draws over a room's picture, in its pixels. */
export interface RoomOverlay {
    room: number; hex: string; name: string; area: string;
    triggers: { key: string; label: string; x: number; y: number; w: number; h: number }[];
    /** Enemies and NPCs the enter script places at a literal position: candidates, the script branches on story state. */
    spawns: { index: number; name: string; x: number; y: number }[];
    error?: string;
}

const BUNDLED: { file: string; raw: unknown }[] = [
    { file: 'src/games/evermore/routes/data/any-percent.route.json', raw: anyPercent },
];
const COMMANDS = new Set(['routesInit', 'routesPicture', 'routesFight', 'routesOpen']);
const handlesRoutesMessage = (command: unknown): boolean => COMMANDS.has(String(command));
const hex = (n: number): string => '0x' + n.toString(16).padStart(2, '0').toUpperCase();

let _cache: { rom: Rom | null; sim: Simulator | null; models: Map<number, RoomScriptModel | null>; triggers: Map<string, TriggerAnalysis | null>; pictures: Map<string, object> } =
    { rom: null, sim: null, models: new Map(), triggers: new Map(), pictures: new Map() };

function cacheFor(rom: Rom) {
    if (_cache.rom !== rom) _cache = { rom, sim: null, models: new Map(), triggers: new Map(), pictures: new Map() };
    return _cache;
}

function model(rom: Rom, room: number): RoomScriptModel | null {
    const c = cacheFor(rom);
    if (!c.models.has(room)) { try { c.models.set(room, buildRoomScriptModel(rom, room)); } catch { c.models.set(room, null); } }
    return c.models.get(room)!;
}

/** The simulation's cases of one trigger, cut to what playing a step reads. */
function trigger(rom: Rom, room: number, at: string): TriggerAnalysis | null {
    const c = cacheFor(rom), key = room + ':' + at;
    if (c.triggers.has(key)) return c.triggers.get(key)!;
    const t = triggerOf(at), m = model(rom, room);
    const list = !t || !m ? [] : t.type === 'b-button' ? m.bTrigger : m.stepOn;
    const script = t ? list[t.index] : undefined;
    let out: TriggerAnalysis | null = null;
    if (script && script.scriptAddressSnes) {
        c.sim = c.sim || createSimulator(rom);
        const a = c.sim.analyze(script.scriptAddressSnes, PINS_BETWEEN_PICKUPS);
        out = {
            cases: a.cases.map((x) => ({ label: x.label, when: x.when, mapId: x.mapId, loot: x.loot ? {
                itemName: x.loot.itemName, object: x.loot.object, looted: x.loot.looted, amount: x.loot.amount as Sym,
                slot: x.loot.slot, flagsSet: x.loot.flagsSet,
            } : null })),
            always: a.always, otherwise: a.otherwise.map((o) => ({ when: o.when, note: o.note })),
        } as TriggerAnalysis;
    }
    c.triggers.set(key, out);
    return out;
}

/** Trigger boxes (16 px tiles from the room's origin) and literal spawns (8 px units) in picture pixels. */
function overlay(rom: Rom | null, room: number): RoomOverlay {
    const base: RoomOverlay = { room, hex: hex(room), name: getMapName(room), area: getMapArea(room), triggers: [], spawns: [] };
    if (!rom) return base;
    const m = model(rom, room);
    if (!m) return { ...base, error: 'The room scripts could not be read.' };
    const { originX, originY } = maps.decodeRoom(rom, room).header;
    const box = (key: string, label: string, t: { x1: number; y1: number; x2: number; y2: number }) => ({
        key, label, x: (t.x1 - originX) * 16, y: (t.y1 - originY) * 16, w: Math.max(1, t.x2 - t.x1) * 16, h: Math.max(1, t.y2 - t.y1) * 16,
    });
    const triggers = m.stepOn.map((t, i) => box('step' + i, 'step-on #' + i, t)).concat(m.bTrigger.map((t, i) => box('b' + i, 'B-trigger #' + i, t)));
    const spawns = m.enter.spawns.map((s, index) => ({ index, name: s.romName || s.name || 'enemy ' + s.npc, x: s.x === null ? NaN : s.x * 8, y: s.y === null ? NaN : s.y * 8 }))
        .filter((s) => !isNaN(s.x));
    return { ...base, triggers, spawns };
}

/** The room drawn with the given objects in their opened state (state 1: a gourd has two). */
function picture(rom: Rom, room: number, opened: number[]): object {
    const c = cacheFor(rom), key = room + ':' + opened.slice().sort((a, b) => a - b).join(',');
    if (!c.pictures.has(key)) {
        try {
            const states: Record<number, number> = {};
            for (const o of opened) states[o] = 1;
            const data = maps.applyObjectStates(rom, maps.decodeRoom(rom, room), states);
            const img = maps.renderRoomComposite(rom, data);
            c.pictures.set(key, { uri: maps.encodePngDataUri(img), width: img.width, height: img.height });
        } catch (err) {
            c.pictures.set(key, { error: String(err instanceof Error ? err.message : err) });
        }
    }
    return { room, key, ...c.pictures.get(key)! };
}

function workspaceRoutes(ws: string | null): { file: string; text: string }[] {
    if (!ws) return [];
    const out: { file: string; text: string }[] = [];
    for (const dir of [ws, path.join(ws, 'routes')]) {
        let names: string[] = [];
        try { names = fs.readdirSync(dir).filter((f) => f.endsWith('.route.json')).sort(); } catch { continue; }
        for (const f of names) {
            try { out.push({ file: path.join(dir, f), text: fs.readFileSync(path.join(dir, f), 'utf8') }); } catch { /* unreadable: skipped */ }
        }
    }
    return out;
}

function romOf(deps: Deps): Rom | null {
    const buf = deps.loadRom();
    return !buf ? null : buf.length % 0x8000 === 0x200 ? buf.subarray(0x200) : buf;
}

let _routes: RouteView[] = [];

/** A fight or death step simulated: the enemy is the step's spawn in its room, the party the route's. */
function fight(rom: Rom, routeId: string, n: number): object {
    const r = _routes.find((x) => x.id === routeId), s = r && r.steps[n - 1];
    if (!r || !s) return { error: 'No such step.' };
    if (!r.route.start.party) return { error: 'The route states no party (start.party): nothing to fight with.' };
    const m = model(rom, s.room), spawn = m && s.enemy !== undefined ? m.enter.spawns[s.enemy] : undefined;
    if (!spawn || spawn.character === null) return { error: 'The step names no enemy the room places (enemy).' };
    const f = fightFor(rom, r.route.start.party, s, spawn.character, spawn.romName || spawn.name || 'enemy');
    if (!f) return { error: 'Only fight and death steps simulate.' };
    return { report: simulateFight(f.setup), inputs: f.inputs, until: f.setup.until, party: r.route.start.party.source };
}

function handleRoutesMessage(msg: { command: string; file?: string; room?: number; opened?: number[]; route?: string; n?: number }, deps: Deps): void {
    if (msg.command === 'routesOpen') {
        if (typeof msg.file !== 'string') return;
        // A bundled file or its notes are repo paths: resolved from the extension's own tree.
        deps.open(path.isAbsolute(msg.file) ? msg.file : path.join(sourceDir(__dirname), '..', '..', '..', '..', msg.file));
        return;
    }
    const rom = romOf(deps);
    if (msg.command === 'routesPicture') {
        const room = Number(msg.room);
        const opened = Array.isArray(msg.opened) ? msg.opened.map(Number) : [];
        deps.post(rom ? { command: 'routesPicture', ...picture(rom, room, opened) } : { command: 'routesPicture', room, key: room + ':' + opened.join(','), error: 'No ROM' });
        return;
    }
    if (msg.command === 'routesFight') {
        const head = { command: 'routesFight', route: msg.route, n: msg.n };
        try { deps.post({ ...head, ...(rom ? fight(rom, String(msg.route), Number(msg.n)) : { error: 'No ROM' }) }); }
        catch (e) { deps.post({ ...head, error: String(e instanceof Error ? e.message : e) }); }
        return;
    }
    const problems: string[] = [];
    const routes: RouteView[] = [];
    const files: { id: string; file: string; source?: string }[] = [];
    const sources = BUNDLED.map((b) => ({ file: b.file, raw: b.raw as unknown }))
        .concat(workspaceRoutes(deps.workspace()).map((w) => {
            try { return { file: w.file, raw: JSON.parse(w.text) as unknown }; } catch (e) { problems.push(w.file + ': ' + (e instanceof Error ? e.message : String(e))); return { file: w.file, raw: null }; }
        }).filter((x) => x.raw !== null));
    const names = { name: (r: number) => getMapName(r), area: (r: number) => getMapArea(r) };
    for (const s of sources) {
        const { route, problems: p } = parseRoute(s.raw, s.file);
        problems.push(...p);
        if (!route) continue;
        files.push({ id: route.id, file: s.file, source: route.source });
        routes.push(...routeViews(route, names, (room, at) => rom ? trigger(rom, room, at) : undefined));
    }
    _routes = routes;
    const rooms: Record<string, RoomOverlay> = {};
    for (const r of routes) for (const s of r.steps) if (!rooms[s.room]) rooms[s.room] = overlay(rom, s.room);
    deps.post({ command: 'routesIndex', routes, rooms, files, problems, rom: !!rom });
}

export { handlesRoutesMessage, handleRoutesMessage };
