// The file formats of an Open Evermore tree (docs/open-evermore/resources.md): the compact JSON every file is
// written in, the PNG decoder that reads tile families saved by an image editor (RGB, every row filter), and a
// room's objects and cuttable grass as text.
// Run: node tests/open-evermore/formats.test.mts   (npm run build:ts first)
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
import { json, readText } from '../../tools/open-evermore/tree.mts';
import { fromText, toText } from '../../tools/open-evermore/evermore/codecs/strings.mts';

const require = createRequire(import.meta.url);
const { decodePng, encodePng, encodeIndexedPng } = require('../../dist/platform/png');
const { crc32 } = require('../../dist/platform/crc32');
const { objectsText, parseObjects, grassText, parseGrass } = require('../../dist/games/evermore/maps/tree-map-text');

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓ ' + name); };
console.log('\nOpen Evermore formats:');

test('compact JSON: each number row on one line, short records on one line, lists of records one per line', () => {
    const v = { rows: [[1, 2], [3, 4]], stepOn: [{ area: [1, 2, 3, 4], script: 5 }], pair: ['a', 'b'], nested: { x: { y: 1 } } };
    assert.strictEqual(readText(json(v)), [
        '{',
        '  "rows": [',
        '    [1, 2],',
        '    [3, 4]',
        '  ],',
        '  "stepOn": [',
        '    { "area": [1, 2, 3, 4], "script": 5 }',
        '  ],',
        '  "pair": ["a", "b"],',
        '  "nested": { "x": { "y": 1 } }',
        '}',
        '',
    ].join('\n'));
    const long = Array.from({ length: 20 }, (_, i) => 'tile_' + String(i).padStart(4, '0'));
    assert.strictEqual(readText(json(long)).split('\n').length, 23, 'a long list of names: one per line');
    assert.deepStrictEqual(JSON.parse(readText(json(v))), v);
});

test('PNG: our RGBA files read back', () => {
    const rgba = Uint8Array.from({ length: 5 * 3 * 4 }, (_, i) => (i * 37) & 255);
    const img = decodePng(encodePng(5, 3, rgba));
    assert.deepStrictEqual([img.width, img.height, Array.from(img.rgba)], [5, 3, Array.from(rgba)]);
});

test('PNG: an RGB file with filters 0-4 reads as opaque RGBA', () => {
    const w = 4, h = 5, px = Uint8Array.from({ length: w * h * 3 }, (_, i) => (i * 53 + 7) & 255);
    const raw: number[] = [];
    for (let y = 0; y < h; y++) {
        const filter = y;
        raw.push(filter);
        for (let x = 0; x < w * 3; x++) {
            const at = (xx: number, yy: number) => xx >= 0 && yy >= 0 ? px[yy * w * 3 + xx] : 0;
            const a = at(x - 3, y), b = at(x, y - 1), c = at(x - 3, y - 1);
            const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
            const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
            raw.push((px[y * w * 3 + x] - pred) & 255);
        }
    }
    const chunk = (type: string, data: Buffer) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
        const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
        return Buffer.concat([len, body, crc]);
    };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    const file = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from(raw))), chunk('IEND', Buffer.alloc(0))]);
    const img = decodePng(file);
    for (let i = 0; i < w * h; i++) assert.deepStrictEqual(Array.from(img.rgba.subarray(i * 4, i * 4 + 4)), [px[i * 3], px[i * 3 + 1], px[i * 3 + 2], 255]);
    assert.throws(() => decodePng(Buffer.from('not a png')), /not a PNG/);
});

test('PNG: indexed files keep their indices; 1-, 4- and 8-bit rows unpack', () => {
    const palette = Array.from({ length: 16 }, (_, i) => [i * 16, 255 - i * 16, i]);
    const idx = Uint8Array.from({ length: 16 * 16 }, (_, i) => (i * 5) & 15);
    const img = decodePng(encodeIndexedPng(16, 16, idx, palette, [0, ...Array(15).fill(255)]));
    assert.deepStrictEqual(Array.from(img.indices), Array.from(idx));
    assert.deepStrictEqual(Array.from(img.rgba.subarray(0, 8)), [0, 255, 0, 0, 80, 175, 5, 255], 'index 0 transparent');
    for (const depth of [1, 4]) {
        const w = 10, h = 3, per = 8 / depth, stride = Math.ceil(w / per), mask = (1 << depth) - 1;
        const want = Array.from({ length: w * h }, (_, i) => (i * 3) & mask);
        const raw: number[] = [];
        for (let y = 0; y < h; y++) {
            raw.push(0);
            for (let b = 0; b < stride; b++) {
                let v = 0;
                for (let k = 0; k < per; k++) { const x = b * per + k; v = (v << depth) | (x < w ? want[y * w + x] : 0); }
                raw.push(v);
            }
        }
        const chunk = (type: string, data: Buffer) => {
            const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
            const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
            const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
            return Buffer.concat([len, body, crc]);
        };
        const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = depth; ihdr[9] = 3;
        const file = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('PLTE', Buffer.from(palette.flat())), chunk('IDAT', deflateSync(Buffer.from(raw))), chunk('IEND', Buffer.alloc(0))]);
        assert.deepStrictEqual(Array.from(decodePng(file).indices), want, `${depth}-bit`);
    }
});

test('string text: every byte has one spelling, and it parses back', () => {
    const raw = [0x48, 0x69, 0x0a, 0x5b, 0x81, 0x80, 0x3d, 0x80, 0x5f, 0x7b, 0x60, 0x7d, 0x9c, 0x80, 0x41];
    const t = toText(raw);
    assert.strictEqual(t, 'Hi\n[[[BOY][PAUSE:3d]…‘`’[0x9c][0x80]A');
    assert.deepStrictEqual(fromText(t), raw);
    assert.match(fromText('[WAVE]') as string, /no such tag/);
    assert.match(fromText('é') as string, /U\+00e9/);
});


test('objects: states as cells over the grid, deltas back byte for byte, records then stamps', () => {
    // A 4×2 grid of metatiles 0-3 (ids base + 8·index); object 0 steps twice at [1, 0] (2×1), the second time one
    // cell; object 1 writes a raw delta off the grid's edge.
    const room = { width: 4, height: 2, base: 16, count: 6, cells: [0, 1, 2, 3, 0, 1, 2, 3] };
    const list = [
        { id: 0, holds: [0, 6], states: [{ at: [1, 0], cells: ['004 005'] }, { at: [1, 0], cells: ['001   .'] }] },
        { id: 1, holds: [1], states: [{ at: [3, 1], cells: ['002 ^0018'] }] },
    ];
    const r = parseObjects(list, room);
    assert.deepStrictEqual(r.offsets, [0, 11]);
    // records: [2, 0,1,0,stamp, 6,1,0,stamp], [1, 1,3,1,stamp]; stamps: 2×1 mask 3 (1^4)·8, (2^5)·8; 2×1 mask 1; 2×1 mask 3
    const id = (i: number) => 16 + 8 * i;
    assert.deepStrictEqual(Array.from(r.area), [
        2, 0, 1, 0, 17, 0, 6, 1, 0, 24, 0,
        1, 1, 3, 1, 29, 0,
        2, 1, 3, id(1) ^ id(4), 0, id(2) ^ id(5), 0,
        2, 1, 1, id(4) ^ id(1), 0,
        2, 1, 3, id(3) ^ id(2), 0, 0x18, 0,
    ]);
    assert.deepStrictEqual(objectsText(r.offsets, r.area, room, 3), list);
    assert.strictEqual(parseObjects([{ holds: [1], states: [{ at: [0, 0], cells: ['009'] }] }], room).pointer, '/list/0/states/0/cells/0');
});

test('cuttable grass: cut → into, the source count derived unless it differs', () => {
    const list = [{ cut: '000', into: ['004'] }, { cut: '001', into: ['005'] }, { cut: '000', into: ['005'], steps: 2 }];
    const s4 = parseGrass(list, undefined, 16, 6);
    assert.deepStrictEqual(Array.from(s4), [2, 1, 16, 0, 48, 0, 0, 0, 1, 24, 0, 56, 0, 0, 0, 2, 16, 0, 56, 0, 0, 0]);
    assert.deepStrictEqual(grassText(s4, 16, 6, 3), { list });
    const odd = parseGrass(list, 5, 16, 6);
    assert.deepStrictEqual(grassText(odd, 16, 6, 3), { list, sources: 5 });
    assert.deepStrictEqual(Array.from(parseGrass([], undefined, 16, 6)), [0]);
});

console.log(`  ${passed} passed`);
