'use strict';
// Ownership: the two shapes a resolved `soe://` path can take. Handlers return
// these; fs-provider.js turns them into VS Code file-system answers.
//
//   { kind: 'dir',  entries: [[name, 'file' | 'dir'], ...] }
//   { kind: 'file', live, read: () => Buffer | Promise<Buffer> }
//
// `live` files are snapshots of the running emulator: never cached for long,
// re-read when watched.

const dir = entries => ({ kind: 'dir', entries });
const file = (read, live = false) => ({ kind: 'file', live, read });

const json = (produce, live = false) =>
    file(async () => Buffer.from(JSON.stringify(await produce(), null, 2) + '\n', 'utf8'), live);
const text = (produce, live = false) =>
    file(async () => Buffer.from(String(await produce()), 'utf8'), live);

module.exports = { dir, file, json, text };
