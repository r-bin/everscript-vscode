// Ownership: the two shapes a resolved `soe://` path can take. Handlers return
// these; fs-provider.ts turns them into VS Code file-system answers.
//
//   { kind: 'dir',  entries: [[name, 'file' | 'dir' | 'link'], ...], index? }
//   { kind: 'file', live, read: () => Buffer | Promise<Buffer>, link? }
//
// `live` files are snapshots of the running emulator: never cached for long,
// re-read when watched. `link` is the canonical `soe://` address of a file
// that is an alias (shown as a symlink). `index` produces the directory's
// `index.md`; without it, autoindex.ts writes a plain listing.

type EntryKind = 'file' | 'dir' | 'link';
type Entry = [string, EntryKind];
type Bytes = Buffer | Uint8Array;

interface DirNode { kind: 'dir'; entries: Entry[]; index?: () => string | Promise<string>; link?: string }
interface FileNode { kind: 'file'; live: boolean; read: () => Bytes | Promise<Bytes>; link?: string }
type VfsNode = DirNode | FileNode;

const dir = (entries: Entry[], index?: DirNode['index']): DirNode => ({ kind: 'dir', entries, index });
const file = (read: FileNode['read'], live = false): FileNode => ({ kind: 'file', live, read });
const link = <N extends VfsNode>(node: N | null | undefined, target: string): N | null => (node ? { ...node, link: target } : null);

const json = (produce: () => unknown, live = false): FileNode =>
    file(async () => Buffer.from(JSON.stringify(await produce(), null, 2) + '\n', 'utf8'), live);
const text = (produce: () => unknown, live = false): FileNode =>
    file(async () => Buffer.from(String(await produce()), 'utf8'), live);

export type { Entry, EntryKind, DirNode, FileNode, VfsNode };
export { dir, file, link, json, text };
