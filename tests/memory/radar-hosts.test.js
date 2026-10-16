'use strict';
// The radar's host-side message handlers outside extension.js: the map editor
// (rooms/editor-host.js) and the Characters tab (sprites/radar-host.js). Unit checks always;
// ROM checks with the Evermore base ROM from the ROM library, else skipped.
// Run: node tests/memory/radar-hosts.test.js

const assert = require('assert');
const Module = require('module');

const _origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
    if (req === 'vscode') return req;
    return _origResolve.call(this, req, ...rest);
};
require.cache.vscode = {
    id: 'vscode', filename: 'vscode', loaded: true,
    exports: {
        workspace: { workspaceFolders: null },
        window: { showErrorMessage: () => {}, showInformationMessage: () => Promise.resolve() },
        commands: { executeCommand: () => {} },
        Uri: { file: (p) => ({ fsPath: p }) },
    },
};

const editor = require('../../src/games/evermore/rooms/editor-host');
const sprites = require('../../src/games/evermore/sprites/radar-host');
const ROM = require('../../dist/games').romPath('evermore');

let passed = 0, failed = 0, skipped = 0;
function test(name, fn, needsRom) {
    if (needsRom && !ROM) { console.log(`  - ${name} (no Evermore ROM in the library)`); skipped++; return; }
    try { fn(); console.log(`  ✓ ${name}`); passed++; } catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; }
}

/** A ctx that collects what the handler posts. */
function ctx(extra) {
    const posted = [];
    return { posted, post: (m) => posted.push(m), roomRom: () => ({ error: 'no room' }), manaRooms: null, ...extra };
}

console.log('radar hosts:');

test('the map editor claims its commands and nothing else', () => {
    for (const c of ['requestRoomTiles', 'requestFamilyCatalogue', 'mapExportRom', 'requestDeco', 'exportRoomPng']) assert.ok(editor.handlesEditorMessage(c), c);
    for (const c of ['goToLine', 'getThumbs', 'hasOwnProperty', 'constructor']) assert.ok(!editor.handlesEditorMessage(c), c);
    for (const c of ['getSpriteAnimation', 'getPaletteGrid', 'getThumbs', 'getRawSprite']) assert.ok(sprites.handlesSpritesMessage(c), c);
    assert.ok(!sprites.handlesSpritesMessage('requestRoomTiles'));
});

test('a room request the radar cannot resolve is answered with the error', () => {
    const c = ctx();
    editor.handleEditorMessage({ command: 'requestRoomTiles', roomId: 0x200, mapName: 'x' }, c);
    assert.deepStrictEqual(c.posted, [{ command: 'roomTiles', mapName: 'x', roomId: 0x200, error: 'no room' }]);
});

test('requestRoomTiles draws a ROM room through the radar\'s room lookup', () => {
    const rom = require('../../src/games/evermore/rom-readers').loadRomFile(ROM);
    const c = ctx({ roomRom: (id) => ({ romBuf: rom, roomId: id }) });
    editor.handleEditorMessage({ command: 'requestRoomTiles', roomId: 0x15, mapName: 'm', layer: 'composite' }, c);
    assert.strictEqual(c.posted.length, 1);
    assert.ok(!c.posted[0].error, c.posted[0].error);
    assert.strictEqual(c.posted[0].overlay.roomId, 0x15);
}, true);

test('requestFamilyCatalogue lists the ROM\'s families', () => {
    const c = ctx();
    editor.handleEditorMessage({ command: 'requestFamilyCatalogue' }, c);
    assert.strictEqual(c.posted[0].command, 'familyCatalogue');
    assert.ok(Array.isArray(c.posted[0].families) && c.posted[0].families.length > 0, c.posted[0].error);
}, true);

test('getThumbs answers with a thumbs map', () => {
    const c = ctx({ spritesBundle: () => ({ characters: [] }) });
    sprites.handleSpritesMessage({ command: 'getThumbs', items: [] }, c);
    assert.deepStrictEqual(c.posted, [{ command: 'thumbsData', thumbs: {} }]);
});

console.log(`\n${passed + failed + skipped} run: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed) process.exit(1);
