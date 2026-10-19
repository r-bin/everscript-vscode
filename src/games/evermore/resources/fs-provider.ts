// Ownership: the read-only `soe://` FileSystemProvider. Routes a URI to the
// rom/, ram/, bus/, localization/ or tags/ handler, picks the ROM, caches what it produced, adds an
// `index.md` to every directory, and turns handler results and failures into
// VS Code file-system answers. Aliases (`node.link`) stat as symlinks.
//
// Which ROM (`soe://rom/...`): `?rom=vanilla` is the configured ROM file,
// `?rom=emulator` the one running in the emulator, `?rom=<absolute path>` or a
// `~…` mount segment that file (a ROM opened as a folder); without either, the
// emulator's when one runs, else vanilla.

import * as vscode from 'vscode';
import { parseSoeParts } from './resource-uri';
import { resolveRom } from './rom-files';
import { resolveRam } from './ram-files';
import { busTarget, indexMarkdown as busIndex } from './bus-files';
import { resolveLocalization } from './localization-files';
import { resolveTags } from './tag-files';
import type { TagContext } from './tag-files';
import { resolveMaps } from './custom-map-files';
import { resolveLogs } from './log-files';
import { autoIndex } from './autoindex';
import { dir, text } from './nodes';
import { intoMount, pageLinks } from './page-links';
import { missingRomText } from '../../../platform/roms/library';
import type { VfsNode, Entry } from './nodes';
import type { MapsDeps } from './map-files';

type Rom = Uint8Array;
/** What the provider is given by the extension (see the constructor). */
interface Deps {
    vanillaRom(): Uint8Array | null;
    emulatorRom(): Uint8Array | null;
    romFile(path: string): Uint8Array | null;
    readMemory(bus: number, len: number): Promise<Uint8Array>;
    emulatorStatus(): Promise<object>;
    getLogs?: Parameters<typeof resolveLogs>[1];
}
/** A resolved node and the ROM that decides how long its bytes are cached. */
interface Routed { node: VfsNode | null; rom: Rom | null }
type Parts = ReturnType<typeof parseSoeParts>;

const LIVE_TTL_MS = 250;
const WATCH_INTERVAL_MS = 1000;
const STATIC_CACHE_MAX = 256;
const NO_ROM = {};   // cache owner of static files that need no ROM (ram/symbols.json, indexes)
const READONLY = vscode.FilePermission ? vscode.FilePermission.Readonly : undefined;

class SoeFileSystem implements vscode.FileSystemProvider {
    _deps: Deps;
    _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    onDidChangeFile = this._emitter.event;
    _static = new WeakMap<object, Map<string, Uint8Array>>();   // rom buffer (or NO_ROM) → Map(uri → bytes)
    _live = new Map<string, { at: number; promise: Promise<Uint8Array> }>();   // uri → the read in flight
    _watched = new Map<string, { uri: vscode.Uri; count: number }>();   // uri string → who watches
    _timer: ReturnType<typeof setInterval> | null = null;
    _tags: TagContext | null = null;   // tags/ context, built on first use

    constructor(deps: Deps) {
        this._deps = deps;
    }

    // ── routing ──────────────────────────────────────────────────────────

    _route(uri: vscode.Uri): Routed {
        const p = parseSoeParts(uri.authority, uri.path, uri.query);
        let r: Routed;
        if (p.authority === 'rom' && p.mount && (!p.segments.length || MOUNTED.includes(p.segments[0])
            || (p.segments.length === 1 && p.segments[0] === 'index.md'))) {
            r = this._routeMounted(uri, p);
        } else if (p.authority === 'rom') {
            // Also the paths a mount had before it gained rom/ (`~m/assets/…`): served, not listed.
            const rom = this._pickRom(uri, p.rom);
            const deps: Deps & MapsDeps = uri.query ? Object.assign({}, this._deps, { query: uri.query }) : this._deps;
            r = { node: resolveRom(p.segments, rom, deps), rom };
        } else if (p.authority === 'ram') {
            r = { node: present(resolveRam(p.segments, this._deps.readMemory, this._deps.emulatorStatus), uri, null), rom: null };
        } else if (p.authority === 'bus') {
            r = this._routeBus(uri, p.segments);
        } else if (p.authority === 'localization' || p.authority === 'localizations') {
            const rom = this._optionalRom(p.rom);
            r = { node: resolveLocalization(p.segments, rom), rom };
        } else if (p.authority === 'tags') {
            r = { node: present(resolveTags(p.segments, this._tagContext()), uri, null), rom: null };
        } else if (p.authority === 'maps') {
            const rom = this._optionalRom(p.rom);
            const deps = uri.query ? Object.assign({}, this._deps, { query: uri.query }) : this._deps;
            r = { node: resolveMaps(p.segments, rom, deps), rom };
        } else if (p.authority === 'logs') {
            r = { node: resolveLogs(p.segments, this._deps.getLogs), rom: null };
        } else {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (!r.node && p.segments[p.segments.length - 1] === 'index.md') r.node = this._index(uri, p);
        return r;
    }

    /**
     * A ROM opened as a folder (`soe://rom/~<mount>/`) is a game root: `rom/` is the
     * cartridge, `ram/`, `tags/` and `localization/` are those authorities. Pages
     * served here link into the mount (page-links.ts), so the Markdown preview,
     * whose resource roots are the workspace folders, loads their images.
     */
    _routeMounted(uri: vscode.Uri, p: Parts): Routed {
        const [authority, ...rest] = p.segments;
        if (authority === undefined) return { node: dir([['index.md', 'file'], ...MOUNTED.map((m): Entry => [m, 'dir'])], () => mountIndex(p.rom ?? '')), rom: null };
        if (authority === 'index.md') return { node: text(() => mountIndex(p.rom ?? '')), rom: null };
        if (authority === 'rom') {
            const rom = this._pickRom(uri, p.rom);
            const deps = uri.query ? Object.assign({}, this._deps, { query: uri.query }) : this._deps;
            return { node: resolveRom(rest, rom, deps), rom };
        }
        if (authority === 'localization') {
            const rom = this._pickRom(uri, p.rom);
            return { node: resolveLocalization(rest, rom), rom };
        }
        if (authority === 'maps') {
            const rom = this._pickRom(uri, p.rom);
            const deps = uri.query ? Object.assign({}, this._deps, { query: uri.query }) : this._deps;
            return { node: resolveMaps(rest, rom, deps), rom };
        }
        if (authority === 'logs') {
            return { node: resolveLogs(rest, this._deps.getLogs), rom: null };
        }
        const node = authority === 'tags' ? resolveTags(rest, this._tagContext())
            : resolveRam(rest, this._deps.readMemory, this._deps.emulatorStatus);
        return { node: present(node, uri, p.mount), rom: null };
    }

    /** A bus address is served as the ram/ or rom/ file it names, marked as a link to it. */
    _routeBus(uri: vscode.Uri, segments: string[]): Routed {
        if (segments.length === 0) return { node: dir([], busIndex), rom: null };
        const t = segments.length === 1 ? busTarget(segments[0]) : null;
        if (!t) return { node: null, rom: null };
        const target = uri.with({ authority: t.authority, path: '/' + t.name });
        const r = this._route(target);
        return { node: r.node && { ...r.node, link: target.toString() } as VfsNode, rom: r.rom };
    }

    /** What tags/ may ask of the other authorities: read a file, or whether one exists (null: cannot tell without a ROM). */
    _tagContext(): TagContext {
        if (!this._tags) {
            this._tags = {
                read: (s: string) => this.readFile(vscode.Uri.parse(s)),
                exists: (s: string) => {
                    try {
                        return !!this._route(vscode.Uri.parse(s)).node;
                    } catch (err) {
                        return (err as { code?: string } | null)?.code === 'FileNotFound' ? false : null;
                    }
                },
            };
        }
        return this._tags;
    }

    /** `index.md` of a directory that has none of its own. */
    _index(uri: vscode.Uri, p: Parts): VfsNode | null {
        const dirPath = p.segments.slice(0, -1).map((s: string) => s + '/').join('');
        const parent = uri.with({ path: '/' + (p.mount ? p.mount + '/' : '') + dirPath });
        const { node } = this._route(parent);
        if (!node || node.kind !== 'dir') return null;
        const address = `soe://${parent.authority}/${dirPath}`;
        return text(() => (node.index ? node.index() : autoIndex(address, node.entries)));
    }

    _pickRom(uri: vscode.Uri | null, which: string | null): Rom {
        let rom: Uint8Array | null;
        if (which === 'vanilla') rom = this._deps.vanillaRom();
        else if (which === 'emulator') rom = this._deps.emulatorRom();
        else if (which === null) rom = this._deps.emulatorRom() || this._deps.vanillaRom();
        else if (isAbsolutePath(which)) rom = this._deps.romFile(which);
        else throw vscode.FileSystemError.FileNotFound(`${uri && uri.toString()} (rom=${which}: use vanilla, emulator or an absolute path)`);
        if (!rom) {
            throw vscode.FileSystemError.Unavailable(which === 'emulator' ? 'No ROM is running in the emulator'
                : isAbsolutePath(which) ? `ROM not readable: ${which}`
                : missingRomText('evermore'));
        }
        return rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    }

    _optionalRom(which: string | null): Rom | null {
        try {
            return this._pickRom(null, which);
        } catch (_) {
            return null;
        }
    }

    _node(uri: vscode.Uri): Routed & { node: VfsNode } {
        let r: Routed;
        try { r = this._route(uri); } catch (err) {
            if (err instanceof vscode.FileSystemError) throw err;
            throw vscode.FileSystemError.Unavailable(`${uri.toString()}: ${err instanceof Error ? err.message : String(err)}`);
        }
        if (!r.node) throw vscode.FileSystemError.FileNotFound(uri);
        return r as Routed & { node: VfsNode };
    }

    async _bytes(uri: vscode.Uri, node: VfsNode & { kind: 'file' }, rom: Rom | null): Promise<Uint8Array> {
        const key = uri.toString();
        if (node.live) {
            const hit = this._live.get(key);
            if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit.promise;
            const promise = this._produce(uri, node);
            this._live.set(key, { at: Date.now(), promise });
            promise.catch(() => this._live.delete(key));
            return promise;
        }
        const owner = rom || NO_ROM;
        let cache = this._static.get(owner);
        if (!cache) { cache = new Map(); this._static.set(owner, cache); }
        if (cache.has(key)) return cache.get(key)!;
        const bytes = await this._produce(uri, node);
        if (cache.size >= STATIC_CACHE_MAX) cache.delete(cache.keys().next().value!);
        cache.set(key, bytes);
        return bytes;
    }

    async _produce(uri: vscode.Uri, node: VfsNode & { kind: 'file' }): Promise<Uint8Array> {
        try {
            const out = await node.read();
            return out instanceof Uint8Array ? out : Buffer.from(out);
        } catch (err) {
            if (err instanceof vscode.FileSystemError) throw err;
            throw vscode.FileSystemError.Unavailable(`${uri.toString()}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    // ── FileSystemProvider ───────────────────────────────────────────────

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        const { node, rom } = this._node(uri);
        const base = { ctime: 0, mtime: 0, size: 0, permissions: READONLY };
        if (node.kind === 'dir') return { ...base, type: vscode.FileType.Directory };
        const bytes = await this._bytes(uri, node, rom);
        return { ...base, type: fileType(node.link ? 'link' : 'file'), size: bytes.length, mtime: node.live ? Date.now() : 0 };
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const { node, rom } = this._node(uri);
        if (node.kind !== 'file') throw vscode.FileSystemError.FileIsADirectory(uri);
        return this._bytes(uri, node, rom);
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        const { node } = this._node(uri);
        if (node.kind !== 'dir') throw vscode.FileSystemError.FileNotADirectory(uri);
        const entries = node.entries.some(([name]) => name === 'index.md') ? node.entries : [['index.md', 'file'] as Entry, ...node.entries];
        return entries.map(([name, kind]) => [name, fileType(kind)]);
    }

    /** Live files are re-announced while watched; static ones never change. */
    watch(uri: vscode.Uri): vscode.Disposable {
        if (!isLive(uri)) return new vscode.Disposable(() => {});
        const key = uri.toString();
        const w = this._watched.get(key) || { uri, count: 0 };
        w.count++;
        this._watched.set(key, w);
        this._startTimer();
        return new vscode.Disposable(() => {
            if (--w.count <= 0) this._watched.delete(key);
            if (!this._watched.size) this._stopTimer();
        });
    }

    _startTimer() {
        if (this._timer) return;
        this._timer = setInterval(() => {
            if (!this._deps.emulatorRom()) return;
            const events = [...this._watched.values()].map(w => ({ type: vscode.FileChangeType.Changed, uri: w.uri }));
            if (events.length) this._emitter.fire(events);
        }, WATCH_INTERVAL_MS);
    }

    _stopTimer() {
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
    }

    dispose() { this._stopTimer(); this._emitter.dispose(); }

    createDirectory(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }
    writeFile(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }
    delete(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }
    rename(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }
}

/** What a mounted ROM folder holds. */
const MOUNTED = ['rom', 'ram', 'tags', 'localization', 'logs'];

/** Whether files under `uri` can change while watched (WRAM, and pages that show it). */
function isLive(uri: vscode.Uri) {
    if (uri.authority === 'ram' || uri.authority === 'bus' || uri.authority === 'tags' || uri.authority === 'logs') return true;
    const p = parseSoeParts(uri.authority, uri.path, uri.query);
    return p.authority === 'rom' && !!p.mount && (p.segments[0] === 'ram' || p.segments[0] === 'tags' || p.segments[0] === 'logs');
}

/**
 * A tags/ or ram/ file as served at `uri`: Markdown link targets relative to the
 * page (and inside `mount`), JSON addresses inside `mount`.
 */
function present(node: VfsNode | null, uri: vscode.Uri, mount: string | null): VfsNode | null {
    if (!node || node.kind !== 'file') return node;
    const md = /\.md$/.test(uri.path);
    if (!md && !mount) return node;
    const rewrite = (s: string) => (md ? pageLinks(s, uri.authority, uri.path, mount) : intoMount(s, mount as string));
    return {
        ...node,
        link: node.link && mount ? intoMount(node.link, mount) : node.link,
        read: async () => Buffer.from(rewrite(Buffer.from(await node.read()).toString('utf8')), 'utf8'),
    };
}

/** The `index.md` of a mounted ROM folder. */
function mountIndex(romPath: string) {
    const name = String(romPath).split(/[\\/]/).pop();
    return `# ${name}

\`${romPath}\`, opened as a folder.

| Folder | Content |
|---|---|
| [rom/](rom/index.md) | the cartridge: header, decoded assets (icons, items, rooms, characters, audio, tables), byte slices |
| [ram/](ram/index.md) | the running game's WRAM: every known address with its live value, flags |
| [tags/](tags/index.md) | concepts that connect both: [boy](tags/boy/index.md), [map.jungle_raptors](tags/map/jungle_raptors.md) |
| [localization/](localization/index.md) | names for scripts, rooms, sounds, tables, functions |
| [logs/](logs/index.md) | emulator runtime logs: crashes, launches, script execution trace |
`;
}

/** An absolute path to a `.smc` / `.sfc` file: a `?rom=` naming a ROM file. */
function isAbsolutePath(s: unknown): s is string {
    return typeof s === 'string' && (s.startsWith('/') || /^[A-Za-z]:[\\/]/.test(s));
}

function fileType(kind: string) {
    if (kind === 'dir') return vscode.FileType.Directory;
    if (kind === 'link') return vscode.FileType.File | vscode.FileType.SymbolicLink;
    return vscode.FileType.File;
}

export { SoeFileSystem };
