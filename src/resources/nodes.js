'use strict';
// Ownership: the two shapes a resolved `soe://` path can take. Handlers return
// these; fs-provider.js turns them into VS Code file-system answers.
//
//   { kind: 'dir',  entries: [[name, 'file' | 'dir' | 'link'], ...], index? }
//   { kind: 'file', live, read: () => Buffer | Promise<Buffer>, link? }
//
// `live` files are snapshots of the running emulator: never cached for long,
// re-read when watched. `link` is the canonical `soe://` address of a file
// that is an alias (shown as a symlink). `index` produces the directory's
// `index.md`; without it, autoindex.js writes a plain listing.

const dir = (entries, index) => ({ kind: 'dir', entries, index });
const file = (read, live = false) => ({ kind: 'file', live, read });
const link = (node, target) => (node ? { ...node, link: target } : null);

const json = (produce, live = false) =>
    file(async () => Buffer.from(JSON.stringify(await produce(), null, 2) + '\n', 'utf8'), live);
const text = (produce, live = false) =>
    file(async () => Buffer.from(String(await produce()), 'utf8'), live);

module.exports = { dir, file, link, json, text };
