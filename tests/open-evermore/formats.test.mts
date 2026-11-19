// The file formats of an Open Evermore tree (docs/open-evermore/resources.md): the compact JSON every file is
// written in, and the PNG decoder that reads tile families saved by an image editor (RGB, every row filter).
// Run: node tests/open-evermore/formats.test.mts   (npm run build:ts first)
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
import { json, readText } from '../../tools/open-evermore/tree.mts';

const require = createRequire(import.meta.url);
const { decodePng, encodePng } = require('../../dist/platform/png');
const { crc32 } = require('../../dist/platform/crc32');

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

console.log(`  ${passed} passed`);
