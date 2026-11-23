// Ownership: the maps of Open Evermore trees (tools/open-evermore explode; docs/open-evermore/) as rooms of the Rooms
// tab — the rail's list, a room's details, and the image that answers the tab's requests for it. Not a conversion:
// a tree's map is Evermore's own room, read from its files (maps/tree-map.ts, the codec implode uses) and built into
// a copy of an Evermore image, so the tab draws, inspects and edits it like a ROM room. No `vscode`: the host hands
// over the folders to look in and the library ROM.
//
// The image's graphics and palettes: the tree's `_build/evermore.sfc` when implode left a 3 MiB one (an edited tile
// shows once imploded), else the library ROM. The blob goes past the image's end ($B1:8000), the room's own map
// table entry points at it; nothing else of the image changes. A room's files are read again whenever one changes.

import * as fs from 'fs';
import * as path from 'path';
import { blobFromTree, TREE_MAP } from '../../maps/tree-map';
import type { TreeMapFiles, TreeProblem, TreeRefs } from '../../maps/tree-map';
import { writeRoomAt } from '../../maps/encode';
import { readRomMapHeaderFrom } from '../../rom-readers';
import { TREE_ROOM_BASE } from '../common/ids';

type Rom = Uint8Array;
type Tree = { dir: string; label: string };
type Entry = { key: string; image: Rom; roomId: number; blobBytes: number; files: TreeMapFiles };

const VID_PREFIX = 'tree-';
const PER_TREE = 0x100, MAX_TREES = 16, CACHE_MAX = 6;
const ROM_3MIB = 0x300000, BLOB_AT = 0x318000, IMAGE_SIZE = 0x320000;
/** Folders not worth looking into for a tree. */
const SKIP = new Set(['node_modules', '.git', 'dist', '_build', '_base']);

const readJson = (file: string): any => JSON.parse(fs.readFileSync(file, 'utf8'));
const mtime = (file: string): number => { try { return fs.statSync(file).mtimeMs; } catch { return -1; } };

/** Trees under `roots`: the folders (the roots and two levels below them) whose manifest.json is an Evermore tree's. */
function findTrees(roots: string[]): Tree[] {
    const out: Tree[] = [];
    const look = (dir: string, root: string, depth: number) => {
        if (out.length >= MAX_TREES) return;
        try {
            const m = readJson(path.join(dir, 'manifest.json'));
            if (m.format === 'open-evermore' && m.game === 'evermore' && ['maps/rooms', 'maps'].some(f => fs.existsSync(path.join(dir, f, '_enum.json')))) {
                out.push({ dir, label: path.relative(path.dirname(root), dir) });
                return;
            }
        } catch { /* not a tree */ }
        if (depth === 0) return;
        let names: string[] = [];
        try { names = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.') && !SKIP.has(d.name)).map(d => d.name).sort(); } catch { return; }
        for (const n of names) look(path.join(dir, n), root, depth - 1);
    };
    for (const r of roots) look(r, r, 2);
    return out;
}

/** `{roots(), soeRom()}`: the folders to look in (the workspace's), the library's Evermore ROM. */
function createTreeRooms(deps: { roots(): string[]; soeRom(): Rom | null }) {
    const cache = new Map<string, Entry>();
    const enums = new Map<string, { at: number; names: string[] }>();
    let trees: { at: number; list: Tree[] } | null = null;

    /** The trees, looked up again at most every few seconds (the rail asks on each page build). */
    const treeList = (): Tree[] => {
        if (!trees || Date.now() - trees.at > 5000) trees = { at: Date.now(), list: findTrees(deps.roots()) };
        return trees.list;
    };
    /** A kind's folder in a tree (v0.464.0: palettes/backgrounds; older trees: maps/palettes); the first folder holding the kind's _enum.json wins. */
    const FOLDERS: Record<string, string[]> = {
        maps: ['maps/rooms', 'maps'], tiles: ['maps/tiles', 'tiles'], palettes: ['palettes/backgrounds', 'maps/palettes'], collisions: ['maps/collisions'], scripts: ['scripts', 'scripts/global'],
    };
    const folderOf = (dir: string, kind: string): string =>
        (FOLDERS[kind] ?? [kind]).find(f => fs.existsSync(path.join(dir, f, '_enum.json'))) ?? kind;
    /** A kind's names[id] in a tree, read again when its _enum.json changes. */
    const names = (dir: string, kind: string): string[] => {
        const file = path.join(dir, folderOf(dir, kind), '_enum.json'), at = mtime(file), hit = enums.get(file);
        if (hit && hit.at === at) return hit.names;
        let list: string[] = [];
        try { list = readJson(file).names ?? []; } catch { /* a kind not exploded: no names */ }
        enums.set(file, { at, names: list });
        return list;
    };
    const parse = (vid: unknown): { tree: Tree; t: number; id: number } | null => {
        const m = typeof vid === 'string' ? /^tree-(\d+)-([0-9a-f]+)$/.exec(vid) : null;
        const list = treeList(), t = m ? +m[1] : -1;
        return m && t < list.length ? { tree: list[t], t, id: parseInt(m[2], 16) } : null;
    };
    const own = (roomId: unknown) => {
        const n = Number(roomId) - TREE_ROOM_BASE, list = treeList();
        if (!Number.isInteger(n) || n < 0 || n >= list.length * PER_TREE) return null;
        return { tree: list[Math.floor(n / PER_TREE)], t: Math.floor(n / PER_TREE), id: n % PER_TREE };
    };

    /** Room `id` of a tree built into its image; throws with the problems when its files do not build. */
    function entry(tree: Tree, id: number): Entry {
        const name = names(tree.dir, 'maps')[id];
        if (name === undefined) throw new Error(`${folderOf(tree.dir, 'maps')}/_enum.json has no map ${id}`);
        const dir = path.join(tree.dir, folderOf(tree.dir, 'maps'), name), build = path.join(tree.dir, '_build', 'evermore.sfc');
        const watched = [...Object.values(TREE_MAP).map(f => path.join(dir, f)), build,
            ...['palettes', 'tiles', 'scripts', 'collisions'].map(k => path.join(tree.dir, folderOf(tree.dir, k), '_enum.json'))];
        const soe = deps.soeRom();
        const key = watched.map(mtime).join(',') + '|' + (soe ? soe.length : 0);
        const hit = cache.get(tree.dir + '#' + id);
        if (hit && hit.key === key) return hit;

        let files: TreeMapFiles;
        try {
            const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
            const parsed = (f: string) => JSON.parse(read(f));
            files = {
                map: parsed(TREE_MAP.map), scripts: parsed(TREE_MAP.scripts), animations: parsed(TREE_MAP.animations), grass: parsed(TREE_MAP.grass),
                grid: read(TREE_MAP.grid), metatiles: parsed(TREE_MAP.metatiles), objects: parsed(TREE_MAP.objects),
            };
        } catch (e) { throw new Error(`${folderOf(tree.dir, 'maps')}/${name}: ${(e as Error).message}`); }
        const byName = (kind: string) => new Map(names(tree.dir, kind).map((n, i) => [n, i] as [string, number]));
        const palettes = byName('palettes'), tiles = byName('tiles'), scripts = byName('scripts'), forms = byName('collisions');
        // A trigger names its script in full (scripts.json); the trigger record holds its table offset, 3·id (scripts/_enum.json).
        const refs: TreeRefs = { palette: n => palettes.get(n), tile: n => tiles.get(n), script: n => {
            const id = scripts.get(n);
            return id === undefined ? undefined : id * 3;
        }, collision: n => forms.get(n) };
        const problems: TreeProblem[] = [];
        const blob = blobFromTree(files, refs, p => problems.push(p));
        if (!blob) throw new Error(problems.filter(p => p.level === 'error').map(p => `${folderOf(tree.dir, 'maps')}/${name}/${p.file}${p.pointer ? '#' + p.pointer : ''}: ${p.message}`).join('; '));

        let source: Rom | null = null;
        try { const b = fs.readFileSync(build); if (b.length === ROM_3MIB) source = new Uint8Array(b); } catch { /* not imploded */ }
        source = source ?? soe;
        if (!source) throw new Error('needs an Evermore ROM for the graphics (Everscript: Switch ROM), or an imploded tree (_build/evermore.sfc)');
        if (source.length > ROM_3MIB) throw new Error('needs a 3 MiB Evermore image to draw in');
        const image = new Uint8Array(IMAGE_SIZE);
        image.set(source);
        writeRoomAt(image, id, blob, BLOB_AT);
        const e: Entry = { key, image, roomId: id, blobBytes: blob.length, files };
        cache.set(tree.dir + '#' + id, e);
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
        return e;
    }

    /** One area per tree, its maps in id order (maps/_enum.json) under their names. */
    function railGroups() {
        return treeList().map((tree, t) => ({
            area: tree.label,
            rooms: names(tree.dir, 'maps').map((name, id) => ({ id: `${VID_PREFIX}${t}-${id.toString(16)}`, name, tag: 'tree ' + id.toString(16).padStart(2, '0') })),
        })).filter(g => g.rooms.length);
    }

    /** The counts a status reads (common/status.ts); throws with the problems when the map does not build. */
    function check(vid: unknown) {
        const p = parse(vid);
        if (!p) return null;
        // The WRAM window holds the grid (2 bytes a cell) and the stamps (8 bytes each); the files built, so they are well formed.
        const e = entry(p.tree, p.id), cells = e.files.grid.trim().split(/\s+/).length;
        return { blobBytes: e.blobBytes, wramBytes: cells * 2 + e.files.metatiles.list.length * 8, families: e.files.map.palettes.length };
    }

    /** The Rooms tab's room object for `vid` (`tree-0-2a`), or null. */
    function detail(vid: unknown, name?: string) {
        const p = parse(vid);
        if (!p) return null;
        const e = entry(p.tree, p.id), mapName = names(p.tree.dir, 'maps')[p.id];
        // Triggers are in scripts.json (v7), each by name and its script by name (a number in trees without scripts).
        const scriptIds = new Map(names(p.tree.dir, 'scripts').map((n, i) => [n, i * 3] as [string, number]));
        const row = (t: { name?: string; from: number[]; to: number[]; script: string | number }) => {
            const scriptId = typeof t.script === 'number' ? t.script : scriptIds.get(t.script) ?? null;
            const label = t.name ?? (scriptId === null ? String(t.script) : 'script ' + scriptId.toString(16).padStart(4, '0'));
            return { x1: t.from[0], y1: t.from[1], x2: t.to[0], y2: t.to[1], scriptId, label, what: typeof t.script === 'string' ? t.script : label };
        };
        const stepOn: ReturnType<typeof row>[] = (e.files.scripts.stepOn ?? []).map(row), bTrigger: ReturnType<typeof row>[] = (e.files.scripts.bTrigger ?? []).map(row);
        const roomId = TREE_ROOM_BASE + p.t * PER_TREE + p.id;
        return {
            name: name || mapName,
            vanillaId: 'tree ' + p.id.toString(16).padStart(2, '0'),
            romRoomId: roomId,
            imported: 'tree',
            importedFrom: 'Open Evermore',
            relPath: `${p.tree.label}/maps/${mapName} · Open Evermore tree, read from its files`,
            start: null,
            startLine: -1, endLine: -1, imageUri: null, imageDims: null,
            families: [],
            conversion: { blobBytes: e.blobBytes },
            content: {
                initMap: { x1: 0, y1: 0, x2: 0, y2: 0 },
                entrances: [], objects: [], transitions: [], enemies: [],
                triggerNames: { stepOn: stepOn.map(t => t.label), bTrigger: bTrigger.map(t => t.label) },
                triggers: { enter: null, stepOn, bTrigger, meta: null },
                roomError: null,
                mapId: roomId,
                romHeader: readRomMapHeaderFrom(e.image, e.roomId),
                trigOffset: { offX: 0, offY: 0 },
            },
        };
    }

    /** `{rom, roomId}` to answer a request about tab room `roomId`, or null when it is not a tree's map. */
    function resolveRoom(roomId: unknown) {
        const o = own(roomId);
        if (!o) return null;
        const e = entry(o.tree, o.id);
        return { rom: e.image, roomId: e.roomId };
    }

    return {
        railGroups, detail, check, resolveRoom,
        // A tree's palettes are ROM families (their ids are the tree's palette enum = the image's table).
        resolveFamily: (_familyId: unknown) => null,
        // Play in emulator: implode the tree (tools/open-evermore) and run _build/evermore.sfc.
        playable: (_roomId: unknown) => null,
        clear: () => { cache.clear(); enums.clear(); trees = null; },
    };
}

export { createTreeRooms };
