// Ownership: a read-only VS Code file system over a game's ROM, for any game. The game gives a pure
// `resolve(segments, rom)` (folders and files, how to produce each file); this turns its answers into
// FileSystemProvider answers and caches produced files per ROM buffer. Which ROM comes from `getRom`.
// Used by terra:// (games/terra/resources); soe:// and som:// still have their own copies.

import * as vscode from 'vscode';

/** What a path resolves to: a folder and its entries, or a file and how to produce its bytes. */
export type RomNode = { kind: 'dir'; entries: Array<[string, 'file' | 'dir']> } | { kind: 'file'; read: () => Buffer };

export interface RomFileSystemOptions {
    /** The URI scheme (`terra`); paths live under `<scheme>://rom/`. */
    scheme: string;
    getRom: () => Uint8Array | null;
    resolve: (segments: string[], rom: Uint8Array) => RomNode | null;
    /** What to say when there is no ROM. */
    missing: string;
    /** Produced files kept per ROM (default 64). */
    cacheMax?: number;
}

export class RomFileSystem implements vscode.FileSystemProvider {
    private emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this.emitter.event;
    private cache = new WeakMap<Uint8Array, Map<string, Buffer>>();

    constructor(private o: RomFileSystemOptions) {}

    private node(uri: vscode.Uri): { node: RomNode; rom: Uint8Array } {
        if (uri.authority !== 'rom') throw vscode.FileSystemError.FileNotFound(uri);
        const rom = this.o.getRom();
        if (!rom) throw vscode.FileSystemError.Unavailable(this.o.missing);
        let node: RomNode | null;
        try { node = this.o.resolve(uri.path.split('/').filter(Boolean), rom); } catch (err) {
            throw vscode.FileSystemError.Unavailable(`${uri.toString()}: ${err instanceof Error ? err.message : err}`);
        }
        if (!node) throw vscode.FileSystemError.FileNotFound(uri);
        return { node, rom };
    }

    private bytes(uri: vscode.Uri, node: RomNode, rom: Uint8Array): Buffer {
        if (node.kind !== 'file') throw vscode.FileSystemError.FileIsADirectory(uri);
        let cache = this.cache.get(rom);
        if (!cache) { cache = new Map(); this.cache.set(rom, cache); }
        let data = cache.get(uri.path);
        if (!data) {
            try { data = node.read(); } catch (err) {
                throw vscode.FileSystemError.Unavailable(`${uri.toString()}: ${err instanceof Error ? err.message : err}`);
            }
            if (cache.size >= (this.o.cacheMax ?? 64)) cache.delete(cache.keys().next().value as string);
            cache.set(uri.path, data);
        }
        return data;
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        const { node, rom } = this.node(uri);
        return {
            type: node.kind === 'dir' ? vscode.FileType.Directory : vscode.FileType.File,
            ctime: 0, mtime: 0, size: node.kind === 'file' ? this.bytes(uri, node, rom).length : 0,
            permissions: vscode.FilePermission ? vscode.FilePermission.Readonly : undefined,
        };
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        const { node } = this.node(uri);
        if (node.kind !== 'dir') throw vscode.FileSystemError.FileNotADirectory(uri);
        return node.entries.map(([n, k]): [string, vscode.FileType] => [n, k === 'dir' ? vscode.FileType.Directory : vscode.FileType.File]);
    }

    readFile(uri: vscode.Uri): Uint8Array {
        const { node, rom } = this.node(uri);
        return new Uint8Array(this.bytes(uri, node, rom));
    }

    watch(): vscode.Disposable { return new vscode.Disposable(() => {}); }
    createDirectory(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }
    writeFile(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }
    delete(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }
    rename(uri: vscode.Uri): never { throw vscode.FileSystemError.NoPermissions(uri); }

    /** Announce that every file changed (a different ROM is selected). */
    refresh(): void {
        this.emitter.fire([{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse(`${this.o.scheme}://rom/`) }]);
    }

    dispose(): void { this.emitter.dispose(); }
}
