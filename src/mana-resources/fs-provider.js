'use strict';
// Ownership: the read-only `som://` FileSystemProvider. Turns files.js nodes into
// VS Code file-system answers and caches produced files per ROM buffer.

const vscode = require('vscode');
const { resolveSom } = require('./files');

const CACHE_MAX = 64;

class SomFileSystem {
    /** @param {() => Uint8Array | null} getRom */
    constructor(getRom) {
        this._getRom = getRom;
        this._emitter = new vscode.EventEmitter();
        this.onDidChangeFile = this._emitter.event;
        /** @type {WeakMap<Uint8Array, Map<string, Buffer>>} */
        this._cache = new WeakMap();
    }

    /** @param {vscode.Uri} uri */
    _node(uri) {
        if (uri.authority !== 'rom') throw vscode.FileSystemError.FileNotFound(uri);
        const rom = this._getRom();
        if (!rom) throw vscode.FileSystemError.Unavailable('Secret of Mana ROM not found: Everscript: Switch ROM, then add one');
        const segments = uri.path.split('/').filter(Boolean);
        let node;
        try { node = resolveSom(segments, rom); } catch (err) {
            throw vscode.FileSystemError.Unavailable(`${uri.toString()}: ${err && /** @type {Error} */ (err).message || err}`);
        }
        if (!node) throw vscode.FileSystemError.FileNotFound(uri);
        return { node, rom };
    }

    /** @param {vscode.Uri} uri @param {import('./files').SomNode} node @param {Uint8Array} rom */
    _bytes(uri, node, rom) {
        if (node.kind !== 'file') throw vscode.FileSystemError.FileIsADirectory(uri);
        let cache = this._cache.get(rom);
        if (!cache) { cache = new Map(); this._cache.set(rom, cache); }
        const key = uri.path;
        let data = cache.get(key);
        if (!data) {
            try { data = node.read(); } catch (err) {
                throw vscode.FileSystemError.Unavailable(`${uri.toString()}: ${err && /** @type {Error} */ (err).message || err}`);
            }
            if (cache.size >= CACHE_MAX) cache.delete(/** @type {string} */ (cache.keys().next().value));
            cache.set(key, data);
        }
        return data;
    }

    /** @param {vscode.Uri} uri */
    stat(uri) {
        const { node, rom } = this._node(uri);
        const size = node.kind === 'file' ? this._bytes(uri, node, rom).length : 0;
        return {
            type: node.kind === 'dir' ? vscode.FileType.Directory : vscode.FileType.File,
            ctime: 0, mtime: 0, size,
            permissions: vscode.FilePermission ? vscode.FilePermission.Readonly : undefined,
        };
    }

    /** @param {vscode.Uri} uri @returns {[string, vscode.FileType][]} */
    readDirectory(uri) {
        const { node } = this._node(uri);
        if (node.kind !== 'dir') throw vscode.FileSystemError.FileNotADirectory(uri);
        return node.entries.map(([n, k]) => [n, k === 'dir' ? vscode.FileType.Directory : vscode.FileType.File]);
    }

    /** @param {vscode.Uri} uri */
    readFile(uri) {
        const { node, rom } = this._node(uri);
        return new Uint8Array(this._bytes(uri, node, rom));
    }

    watch() { return new vscode.Disposable(() => {}); }
    createDirectory(/** @type {vscode.Uri} */ uri) { throw vscode.FileSystemError.NoPermissions(uri); }
    writeFile(/** @type {vscode.Uri} */ uri) { throw vscode.FileSystemError.NoPermissions(uri); }
    delete(/** @type {vscode.Uri} */ uri) { throw vscode.FileSystemError.NoPermissions(uri); }
    rename(/** @type {vscode.Uri} */ uri) { throw vscode.FileSystemError.NoPermissions(uri); }

    /** Announce that every file changed (a different ROM is configured). */
    refresh() {
        this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse('som://rom/') }]);
    }

    dispose() { this._emitter.dispose(); }
}

module.exports = { SomFileSystem };
