// Names for the entries of a room that nothing names in the ROM: its triggers (scripts.json) and its objects
// (objects.json), by what they do (docs/open-evermore/resources.md §maps). Explode writes them; implode reads the
// files, so a name here only has to be the same on every explode of the same bytes (the layout does not matter).
//
//   trigger  `<what>_<nn>`, counted per room over the step-on then the B triggers: what its script does with
//            everything it calls (script-model `roleOf`): `door` (changes the map), `sniff` (calls the sniff spot's
//            loot driver), `loot` (a gourd's or a chest's driver, or stages a reward), `scene` (text, animations),
//            `unknown` when nothing says. A room script is named after the first trigger that runs it (scripts.mts)
//   object   the name of the first trigger whose script (or a script of the same room it calls) names the object, or
//            stages it as the pickup's object (LOOT_OBJECT); a second object of the same trigger gets `_2`, … Objects
//            no trigger touches are `unknown_<nn>`
import { createRequire } from 'node:module';
import { roomBlobs } from './maps.mts';
import { fileOfPacked, scriptLayout, tableOf } from './scripts.mts';
import { OBJECTS, REF, scriptText, WINDOW } from './script-lines.mts';
import { windowPos } from '../../layout.mts';

const require = createRequire(import.meta.url);
const V = require('../../../../dist/games/evermore/script-vm');
const maps = require('../../../../dist/games/evermore/maps');
const { lootOf, paths, roleOf } = require('../../../../dist/games/evermore/script-model');

type NameOf = (kind: string, id: number) => string;
type CountOf = (kind: string) => number | undefined;
type NameAt = (kind: string, at: number) => string | undefined;

/** What a trigger's script does → the first part of its name. */
const WHAT: Record<string, string> = { exit: 'door', sniff: 'sniff', loot: 'loot', cutscene: 'scene' };
const UNKNOWN = 'unknown';
const MAP_COUNT = 127;
const two = (n: number) => String(n).padStart(2, '0');
const u24 = (rom: Uint8Array, at: number) => rom[at] | (rom[at + 1] << 8) | (rom[at + 2] << 16);

/** The script VM's view of a ROM, reading calls by id through the pointer table where its readers point: a built
 *  layout moves the table and rebases the readers, the header word the VM adds stays (scripts.mts `tableOf`). */
function scriptRom(rom: Uint8Array) {
    const R = new V.ScriptRom(rom), table = tableOf(rom), entry = (at: number) => 0x800000 | fileOfPacked(u24(rom, at));
    R.triggerScript = (offset: number) => entry(table + offset);
    R.globalScript = (id: number) => entry(table + R.header(4) + id * 3);
    return R;
}

export interface RoomTriggers { stepOn: string[]; bTrigger: string[]; entries: { stepOn: number[]; bTrigger: number[] } }

const triggerCache = new WeakMap<Uint8Array, Map<number, RoomTriggers[]>>();
/** Each room's trigger names and the file offset of each trigger's script, by room id. */
export function triggerNames(rom: Uint8Array, count: CountOf): RoomTriggers[] {
    const rooms = count('maps') ?? MAP_COUNT, hit = triggerCache.get(rom)?.get(rooms);
    if (hit) return hit;
    const R = scriptRom(rom), table = tableOf(rom), roles = new Map<number, string>();
    const what = (at: number) => {
        if (!roles.has(at)) { const r = roleOf(R, 0x800000 | at); roles.set(at, r ? WHAT[r] ?? UNKNOWN : UNKNOWN); }
        return roles.get(at)!;
    };
    const out = roomBlobs(rom, rooms).map((blob, room) => {
        const m = maps.modelFromRom(rom, room, blob), counts = new Map<string, number>();
        const name = (at: number) => { const w = what(at), k = (counts.get(w) ?? 0) + 1; counts.set(w, k); return `${w}_${two(k)}`; };
        const entryOf = (t: { scriptId: number }) => fileOfPacked(u24(rom, table + t.scriptId));
        const stepAt: number[] = m.stepOn.map(entryOf), bAt: number[] = m.bTrigger.map(entryOf);
        return { stepOn: stepAt.map(name), bTrigger: bAt.map(name), entries: { stepOn: stepAt, bTrigger: bAt } };
    });
    if (!triggerCache.has(rom)) triggerCache.set(rom, new Map());
    triggerCache.get(rom)!.set(rooms, out);
    return out;
}

const objectCache = new WeakMap<Uint8Array, Map<string, string[][]>>();
/** Each room's object names, by room id. */
export function objectNames(rom: Uint8Array, name: NameOf, count: CountOf, nameAt: NameAt): string[][] {
    const key = `${count('maps')}/${count('scripts')}/${name('maps', 0)}/${name('scripts', 0)}`, hit = objectCache.get(rom)?.get(key);
    if (hit) return hit;
    const L = scriptLayout(rom, name, count, nameAt), R = scriptRom(rom);
    const rooms = count('maps') ?? MAP_COUNT, triggers = triggerNames(rom, count);
    // The objects a script names (its operands), read once per script.
    const named = new Map<number, number[]>();
    const objectsIn = (at: number): number[] => {
        if (!named.has(at)) {
            const s = L.byAt.get(at), ids: number[] = [];
            if (s) scriptText(rom, s, windowPos(WINDOW, s.end), () => '@x', op => op.toString(16), () => undefined,
                { name: (k, id) => { if (k === OBJECTS) ids.push(id); return undefined; }, id: () => undefined });
            named.set(at, ids);
        }
        return named.get(at)!;
    };
    const out = roomBlobs(rom, rooms).map((blob, room) => {
        const n: number = maps.modelFromRom(rom, room, blob).objectOffsets.length, mine = `${name('maps', room)}/`;
        const names: (string | undefined)[] = new Array(n).fill(undefined), used = new Map<string, number>();
        const claim = (id: number, by: string) => {
            if (id >= n || names[id] !== undefined) return;
            const k = (used.get(by) ?? 0) + 1;
            used.set(by, k);
            names[id] = k === 1 ? by : `${by}_${k}`;
        };
        const t = triggers[room];
        const all: [string, number][] = [...t.stepOn.map((w, i) => [w, t.entries.stepOn[i]] as [string, number]), ...t.bTrigger.map((w, i) => [w, t.entries.bTrigger[i]] as [string, number])];
        for (const [by, entry] of all) {
            // The trigger's script and the scripts of this room it calls.
            const seen = new Set<number>(), todo = [entry];
            while (todo.length) {
                const at = todo.shift()!, s = L.byAt.get(at);
                if (seen.has(at) || !s || (at !== entry && !s.name.startsWith(mine))) continue;
                seen.add(at);
                for (const id of objectsIn(at)) claim(id, by);
                for (const i of [...s.ins.values()].sort((a, b) => a.address - b.address)) {
                    const last = i.operands[i.operands.length - 1];
                    if (REF[i.opcode] && last?.target !== undefined) todo.push(last.target & 0x3FFFFF);
                }
            }
            for (const l of lootOf(paths(R, 0x800000 | entry).paths)) if (l.objectId !== null) claim(l.objectId, by);
        }
        // The rest counted on past the names a trigger called `unknown_<nn>` gave.
        const taken = new Set(names);
        let k = 0;
        const next = () => { let x; do x = `${UNKNOWN}_${two(++k)}`; while (taken.has(x)); return x; };
        return names.map(x => x ?? next());
    });
    if (!objectCache.has(rom)) objectCache.set(rom, new Map());
    objectCache.get(rom)!.set(key, out);
    return out;
}
