// Ownership: the Routes tab's host side: reads the route files, checks every step against the
// room scripts of the user's ROM, and answers the page. No VS Code dependency: the ROM loader,
// the workspace folder and `open` are injected by radar-open.js.
//
//   page -> routesInit            host -> routesIndex { routes: RouteView[], files, problems, rom }
//   page -> routesOpen { file }   host opens the route file (or its source notes) in the editor
//
// Routes: the bundled drafts (data/), then every `*.route.json` in the workspace root and its
// `routes/` folder (routes.md: saved next to the workspace).

import * as fs from 'fs';
import * as path from 'path';
import { parseRoute, routeViews } from './model/route';
import type { RoomFacts, RouteView } from './model/route';
import { buildRoomScriptModel } from '../script-model';
import { getMapName, getMapArea } from '../localizations';
import { sourceDir } from '../../../platform/source-dir';
import anyPercent from './data/any-percent.route.json';

interface Deps {
    post(message: object): void;
    loadRom(): Buffer | Uint8Array | null;
    workspace(): string | null;
    open(file: string): void;
}

const BUNDLED: { file: string; raw: unknown }[] = [
    { file: 'src/games/evermore/routes/data/any-percent.route.json', raw: anyPercent },
];
const COMMANDS = new Set(['routesInit', 'routesOpen']);
const handlesRoutesMessage = (command: unknown): boolean => COMMANDS.has(String(command));

let _facts: { rom: Uint8Array | null; rooms: Map<number, RoomFacts | null> } = { rom: null, rooms: new Map() };

/** Loot and exits of one room, per trigger, from its scripts (script-model). */
function roomFacts(rom: Uint8Array, room: number): RoomFacts | null {
    if (_facts.rom !== rom) _facts = { rom, rooms: new Map() };
    if (_facts.rooms.has(room)) return _facts.rooms.get(room)!;
    let facts: RoomFacts | null = null;
    try {
        const m = buildRoomScriptModel(rom, room);
        facts = { loot: [], exits: [] };
        const scripts = [{ trigger: 'enter script', s: m.enter }]
            .concat(m.stepOn.map((t, i) => ({ trigger: 'step-on #' + i + ' (' + t.x1 + ',' + t.y1 + ')', s: t })))
            .concat(m.bTrigger.map((t, i) => ({ trigger: 'B #' + i + ' (' + t.x1 + ',' + t.y1 + ')', s: t })));
        for (const { trigger, s } of scripts) {
            for (const l of s.loot) facts.loot.push({ trigger, kind: l.kind || 'pickup', item: l.itemName || '?', amount: l.amount });
            for (const t of s.transitions) facts.exits.push({ trigger, to: t.mapId });
        }
    } catch { facts = null; }
    _facts.rooms.set(room, facts);
    return facts;
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

function handleRoutesMessage(msg: { command: string; file?: string }, deps: Deps): void {
    if (msg.command === 'routesOpen') {
        if (typeof msg.file !== 'string') return;
        // A bundled file or its notes are repo paths: resolved from the extension's own tree.
        deps.open(path.isAbsolute(msg.file) ? msg.file : path.join(sourceDir(__dirname), '..', '..', '..', '..', msg.file));
        return;
    }
    const buf = deps.loadRom();
    const rom = !buf ? null : buf.length % 0x8000 === 0x200 ? buf.subarray(0x200) : buf;
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
        routes.push(...routeViews(route, names, (room) => rom ? roomFacts(rom, room) : null));
    }
    deps.post({ command: 'routesIndex', routes, files, problems, rom: !!rom });
}

export { handlesRoutesMessage, handleRoutesMessage };
