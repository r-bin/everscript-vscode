'use strict';
// Ownership: Secret of Mana map loading, rendering, and Evermore integration tests.
// Run with: node tests/memory/mana-maps.test.js

const assert = require('assert');
const fs = require('fs');
const maps = require('../../src/maps');
const { buildManaRoomDetails, renderManaTree } = require('../../src/rooms');
const { manaRomCandidates } = require('../../src/shared/rom-readers');

let passed = 0, failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('  ✓ ' + name);
        passed++;
    } catch (e) {
        console.error('  ✗ ' + name + '\n    ' + (e.stack || e.message));
        failed++;
    }
}

console.log('\nSecret of Mana — Decompression & Collision Translation:');

test('decodeMapPiece decompresses literals, repeats, and window lookups', () => {
    // 2x2 piece: width=2, height=2, then literals 0x10, 0x20 and opcode 0xC1 (repeat previous byte 2 times)
    const stream = new Uint8Array([2, 2, 0x10, 0x20, 0xC1]);
    const piece = maps.decodeMapPiece(stream);
    assert.ok(piece);
    assert.strictEqual(piece.width, 2);
    assert.strictEqual(piece.height, 2);
    assert.strictEqual(piece.data.length, 4);
    assert.strictEqual(piece.data[0], 0x10);
    assert.strictEqual(piece.data[1], 0x20);
    assert.strictEqual(piece.data[2], 0x20);
    assert.strictEqual(piece.data[3], 0x20);
});

test('translates Mana collision bytes to Evermore 16-bit collision words', () => {
    assert.strictEqual(maps.manaCollisionToEvermoreWord(0x00), 0x0000); // Walkable ground
    assert.strictEqual(maps.manaCollisionToEvermoreWord(0x04), 0x0001); // Solid barrier
    assert.strictEqual(maps.manaCollisionToEvermoreWord(0x05), 0x2000); // Current (AW)
    assert.strictEqual(maps.manaCollisionToEvermoreWord(0x16), 0x0010); // Plane 1
    assert.strictEqual(maps.manaCollisionToEvermoreWord(0x11), 0x0011); // Stairs
});

test('renderManaTree returns empty message when no rooms are configured', () => {
    const html = renderManaTree({});
    assert.ok(html.includes('No Secret of Mana ROM configured'));
});

// Run live ROM assertions when a ROM is accessible
const candidates = typeof manaRomCandidates === 'function' ? manaRomCandidates(null, '') : [];
const candidateRom = process.env.EVERSCRIPT_MANA_ROM || candidates.find(p => {
    try { return fs.existsSync(p) && fs.statSync(p).size >= 2 * 1024 * 1024; } catch { return false; }
});

let romBuf = null;
if (candidateRom) {
    try {
        romBuf = fs.readFileSync(candidateRom);
    } catch (_e) {
        console.log('\nSecret of Mana — Live ROM (' + candidateRom + ') not readable in sandbox; skipping live ROM tests.');
    }
}

if (romBuf) {
    console.log('\nSecret of Mana — Live ROM Integration (' + candidateRom + '):');

    test('lists 390+ composite maps from ROM catalog', () => {
        const roomList = maps.listManaRooms(romBuf);
        assert.ok(roomList.length >= 390, `Expected >= 390 rooms, got ${roomList.length}`);
        const potos = roomList.find(r => r.id === 16);
        assert.ok(potos, 'Potos South Field (#16) should exist');
        assert.strictEqual(potos.name, 'Potos South Field');
    });

    test('decodes room layers, tilesets, and triggers for Potos South Field (#16)', () => {
        const room = maps.decodeManaRoom(romBuf, 16);
        assert.ok(room);
        assert.strictEqual(room.id, 16);
        assert.strictEqual(room.mapW, 70);
        assert.strictEqual(room.mapH, 116);
        assert.strictEqual(room.gridTerrain.length, 70 * 116);
        assert.strictEqual(room.gridCanopy.length, 70 * 116);
        assert.strictEqual(room.gridCollision.length, 70 * 116);
    });

    test('renders composite map #16 to PNG pixel buffer', () => {
        const room = maps.decodeManaRoom(romBuf, 16);
        const rendered = maps.renderManaRoom(romBuf, room);
        assert.strictEqual(rendered.width, 70 * 16);
        assert.strictEqual(rendered.height, 116 * 16);
        assert.ok(rendered.imageUri.startsWith('data:image/png;base64,'));
        assert.ok(rendered.imageUri.length > 50000);
    });

    test('integrates Mana room #16 into Evermore Custom Map document', () => {
        const room = maps.decodeManaRoom(romBuf, 16);
        const integrated = maps.integrateManaToEvermore(room);
        assert.ok(integrated.key.startsWith('mana_16_'));
        assert.strictEqual(integrated.name, 'Potos South Field (Mana)');
        assert.strictEqual(integrated.borrow, 0x34);
        assert.strictEqual(integrated.w, 70);
        assert.strictEqual(integrated.h, 116);
        assert.strictEqual(Object.keys(integrated.saved.cells).length, 70 * 116);
        assert.strictEqual(Object.keys(integrated.saved.coll).length, 70 * 116);
        assert.ok(integrated.saved.added.length > 0);
        assert.ok(integrated.everscriptSource.includes('fun mana_door_'));
    });

    test('buildManaRoomDetails builds tree metadata', () => {
        const details = buildManaRoomDetails(null, candidateRom);
        assert.ok(Object.keys(details).length >= 390);
        const html = renderManaTree(details);
        assert.ok(html.includes('data-mana-id="16"'));
        assert.ok(html.includes('70×116'));
    });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
