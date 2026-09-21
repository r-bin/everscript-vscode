#!/usr/bin/env node
'use strict';
// Check the ROM **write** path this repo's map editor will depend on.
//
// The encoder itself lives in the sibling everscript repo
// (tools/encode_room.py) and is the verified inverse of dump_room.py. This
// script does not reimplement any of it — it runs the encoder's own two
// self-checks and fails the build if either regresses:
//
//   byte-exact round-trip   model_from_rom -> build_blob == the original bytes
//   re-encoded round-trip   re-encode blocks 1-3 -> decode == the original content
//
// Both must be 127/127 before anything in this extension is allowed to
// write a room back. Skips (does not fail) when the checkout, ROM or venv
// is missing, the same way tests/memory/map-parity.test.js does.
//
// See docs/map-format/map_editor_ui.md §6.

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const REPO = process.env.EVERSCRIPT_REPO ||
    path.join(path.dirname(path.dirname(path.resolve(__dirname))), 'everscript');
const ROM = process.env.EVERSCRIPT_ROM || path.join(REPO, 'Secret of Evermore (U) [!].smc');
const PYTHON = process.env.EVERSCRIPT_PYTHON || path.join(REPO, '.venv', 'bin', 'python3');
const ENCODER = path.join(REPO, 'tools', 'encode_room.py');

function skip(reason) {
    console.log(`SKIP check:encode: ${reason}`);
    process.exit(0);
}

for (const [label, p] of [['everscript repo', REPO], ['ROM', ROM], ['python', PYTHON], ['encode_room.py', ENCODER]]) {
    if (!fs.existsSync(p)) skip(`${label} not found at ${p}`);
}

const res = cp.spawnSync(PYTHON, ['tools/encode_room.py', '--verify', '--verify-rebuild', '--rom', ROM], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
});

const out = `${res.stdout || ''}${res.stderr || ''}`.trim();
console.log(out.split('\n').map((l) => '  ' + l).join('\n'));

if (res.status !== 0) {
    console.error('check:encode: the room encoder does not round-trip — the write path is not safe');
    process.exit(1);
}

// The encoder prints "N/127 rooms" per check; anything short of every room
// is a regression even when it exits 0.
const counts = [...out.matchAll(/(\d+)\/(\d+) rooms/g)];
if (counts.length !== 2 || counts.some((m) => m[1] !== m[2])) {
    console.error('check:encode: expected two full round-trips, got:\n' + out);
    process.exit(1);
}
console.log('check:encode: the room write path round-trips for every vanilla room');
