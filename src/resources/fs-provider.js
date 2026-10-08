'use strict';
// Ownership: the read-only `soe://` FileSystemProvider. Routes a URI to the
// rom/, ram/ or bus/ handler, picks the ROM, caches what it produced, adds an
// `index.md` to every directory, and turns handler results and failures into
// VS Code file-system answers. Aliases (`node.link`) stat as symlinks.
//
// Which ROM (`soe://rom/...`): `?rom=vanilla` is the configured ROM file,
// `?rom=emulator` the one running in the emulator; without a query, the
// emulator's when one runs, else vanilla.

const vscode = require('vscode');
const { parseSoeParts } = require('../shared/resource-uri');
const { resolveRom } = require('./rom-files');
const { resolveRam } = require('./ram-files');
const { busTarget, indexMarkdown: busIndex } = require('./bus-files');
const { autoIndex } = require('./autoindex');
const { dir, text } = require('./nodes');

const LIVE_TTL_MS = 250;
const WATCH_INTERVAL_MS = 1000;
const STATIC_CACHE_MAX = 256;
const NO_ROM = {};   // cache owner of static files that need no ROM (ram/symbols.json, indexes)
const READONLY = vscode.FilePermission ? vscode.FilePermission.Readonly : undefined;

class SoeFileSystem {
    /**
     * @param {object} deps
     * @param {() => Uint8Array|null} deps.vanillaRom
     * @param {() => Uint8Array|null} deps.emulatorRom
     * @param {(bus: number, len: number) => Promise<Uint8Array>} deps.readMemory
     * @param {() => Promise<object>} deps.emulatorStatus
     */
    constructor(deps) {
        this._deps = deps;
        this._emitter = new vscode.EventEmitter();
        this.onDidChangeFile = this._emitter.event;
        this._static = new WeakMap();   // rom buffer (or NO_ROM) → Map(uri → Buffer)
        this._live = new Map();         // uri → { at, promise }
        this._watched = new Map();      // uri string → { uri, count }
        this._timer = null;
    }

    // ── routing ──────────────────────────────────────────────────────────

    _route(uri) {
        const p = parseSoeParts(uri.authority, uri.path, uri.query);
        let r;
        if (p.authority === 'rom') {
            const rom = this._pickRom(uri, p.rom);
            r = { node: resolveRom(p.segments, rom), rom };
        } else if (p.authority === 'ram') {
            r = { node: resolveRam(p.segments, this._deps.readMemory, this._deps.emulatorStatus), rom: null };
        } else if (p.authority === 'bus') {
            r = this._routeBus(uri, p.segments);
        } else {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        if (!r.node && p.segments[p.segments.length - 1] === 'index.md') r.node = this._index(uri, p.segments);
        return r;
    }

    /** A bus address is served as the ram/ or rom/ file it names, marked as a link to it. */
    _routeBus(uri, segments) {
        if (segments.length === 0) return { node: dir([], busIndex), rom: null };
        const t = segments.length === 1 ? busTarget(segments[0]) : null;
        if (!t) return { node: null, rom: null };
        const target = uri.with({ authority: t.authority, path: '/' + t.name });
        const r = this._route(target);
        return { node: r.node && { ...r.node, link: target.toString() }, rom: r.rom };
    }

    /** `index.md` of a directory that has none of its own. */
    _index(uri, segments) {
        const parent = uri.with({ path: '/' + segments.slice(0, -1).map(s => s + '/').join('') });
        const { node } = this._route(parent);
        if (!node || node.kind !== 'dir') return null;
        const address = `soe://${parent.authority}${parent.path}`;
        return text(() => (node.index ? node.index() : autoIndex(address, node.entries)));
    }

    _pickRom(uri, which) {
        let rom;
        if (which === 'vanilla') rom = this._deps.vanillaRom();
        else if (which === 'emulator') rom = this._deps.emulatorRom();
        else if (which === null) rom = this._deps.emulatorRom() || this._deps.vanillaRom();
        else throw vscode.FileSystemError.FileNotFound(`${uri.toString()} (rom=${which}: use vanilla or emulator)`);
        if (!rom) {
            throw vscode.FileSystemError.Unavailable(which === 'emulator'
                ? 'No ROM is running in the emulator'
                : 'ROM not found: set everscript.romPath');
        }
        return rom instanceof Uint8Array ? rom : new Uint8Array(rom);
    }

    _node(uri) {
        let r;
        try { r = this._route(uri); } catch (err) {
            if (err instanceof vscode.FileSystemError) throw err;
            throw vscode.FileSystemError.Unavailable(`${uri.toString()}: ${err && err.message || err}`);
        }
        if (!r.node) throw vscode.FileSystemError.FileNotFound(uri);
        return r;
    }

    async _bytes(uri, node, rom) {
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
        if (cache.has(key)) return cache.get(key);
        const bytes = await this._produce(uri, node);
        if (cache.size >= STATIC_CACHE_MAX) cache.delete(cache.keys().next().value);
        cache.set(key, bytes);
        return bytes;
    }

    async _produce(uri, node) {
        try {
            const out = await node.read();
            return out instanceof Uint8Array ? out : Buffer.from(out);
        } catch (err) {
            if (err instanceof vscode.FileSystemError) throw err;
            throw vscode.FileSystemError.Unavailable(`${uri.toString()}: ${err && err.message || err}`);
        }
    }

    // ── FileSystemProvider ───────────────────────────────────────────────

    async stat(uri) {
        const { node, rom } = this._node(uri);
        const base = { ctime: 0, mtime: 0, size: 0, permissions: READONLY };
        if (node.kind === 'dir') return { ...base, type: vscode.FileType.Directory };
        const bytes = await this._bytes(uri, node, rom);
        return { ...base, type: fileType(node.link ? 'link' : 'file'), size: bytes.length, mtime: node.live ? Date.now() : 0 };
    }

    async readFile(uri) {
        const { node, rom } = this._node(uri);
        if (node.kind !== 'file') throw vscode.FileSystemError.FileIsADirectory(uri);
        return this._bytes(uri, node, rom);
    }

    readDirectory(uri) {
        const { node } = this._node(uri);
        if (node.kind !== 'dir') throw vscode.FileSystemError.FileNotADirectory(uri);
        const entries = node.entries.some(([name]) => name === 'index.md') ? node.entries : [['index.md', 'file'], ...node.entries];
        return entries.map(([name, kind]) => [name, fileType(kind)]);
    }

    /** Live files are re-announced while watched; static ones never change. */
    watch(uri) {
        if (uri.authority !== 'ram' && uri.authority !== 'bus') return new vscode.Disposable(() => {});
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

    createDirectory(uri) { throw vscode.FileSystemError.NoPermissions(uri); }
    writeFile(uri) { throw vscode.FileSystemError.NoPermissions(uri); }
    delete(uri) { throw vscode.FileSystemError.NoPermissions(uri); }
    rename(uri) { throw vscode.FileSystemError.NoPermissions(uri); }
}

function fileType(kind) {
    if (kind === 'dir') return vscode.FileType.Directory;
    if (kind === 'link') return vscode.FileType.File | vscode.FileType.SymbolicLink;
    return vscode.FileType.File;
}

module.exports = { SoeFileSystem };
