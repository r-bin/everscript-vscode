// Ownership: the read-only `som://` FileSystemProvider. Turns files.ts nodes into
// VS Code file-system answers and caches produced files per ROM buffer.

import * as vscode from 'vscode';
import { resolveSom } from './files';
import type { SomNode } from './files';
import { missingRomText } from '../../../platform/roms/library';

const CACHE_MAX = 64;

class SomFileSystem implements vscode.FileSystemProvider {
    private _getRom: () => Uint8Array | null;
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this._emitter.event;
    private _cache = new WeakMap<Uint8Array, Map<string, Buffer>>();

    constructor(getRom: () => Uint8Array | null) {
        this._getRom = getRom;
    }

    _node(uri: vscode.Uri) {
        if (uri.authority !== 'rom') throw vscode.FileSystemError.FileNotFound(uri);
        const rom = this._getRom();
        if (!rom) throw vscode.FileSystemError.Unavailable(missingRomText('mana'));
        const segments = uri.path.split('/').filter(Boolean);
        let node;
        try { node = resolveSom(segments, rom); } catch (err) {
            throw vscode.FileSystemError.Unavailable(`${uri.toString()}: ${err instanceof Error ? err.message : err}`);
        }
        if (!node) throw vscode.FileSystemError.FileNotFound(uri);
        return { node, rom };
    }

    _bytes(uri: vscode.Uri, node: SomNode, rom: Uint8Array) {
        if (node.kind !== 'file') throw vscode.FileSystemError.FileIsADirectory(uri);
        let cache = this._cache.get(rom);
        if (!cache) { cache = new Map(); this._cache.set(rom, cache); }
        const key = uri.path;
        let data = cache.get(key);
        if (!data) {
            try { data = node.read(); } catch (err) {
                throw vscode.FileSystemError.Unavailable(`${uri.toString()}: ${err instanceof Error ? err.message : err}`);
            }
            if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
            cache.set(key, data);
        }
        return data;
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        const { node, rom } = this._node(uri);
        const size = node.kind === 'file' ? this._bytes(uri, node, rom).length : 0;
        return {
            type: node.kind === 'dir' ? vscode.FileType.Directory : vscode.FileType.File,
            ctime: 0, mtime: 0, size,
            permissions: vscode.FilePermission ? vscode.FilePermission.Readonly : undefined,
        };
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        const { node } = this._node(uri);
        if (node.kind !== 'dir') throw vscode.FileSystemError.FileNotADirectory(uri);
        return node.entries.map(([n, k]): [string, vscode.FileType] => [n, k === 'dir' ? vscode.FileType.Directory : vscode.FileType.File]);
    }

    readFile(uri: vscode.Uri) {
        const { node, rom } = this._node(uri);
        return new Uint8Array(this._bytes(uri, node, rom));
    }

    watch(): vscode.Disposable { return new vscode.Disposable(() => {}); }
    createDirectory(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }
    writeFile(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }
    delete(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }
    rename(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }

    /** Announce that every file changed (a different ROM is configured). */
    refresh() {
        this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse('som://rom/') }]);
    }

    dispose() { this._emitter.dispose(); }
}

export { SomFileSystem };
