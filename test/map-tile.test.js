'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock vscode before requiring patched extension.
const Module = require('module');
const _orig = Module._resolveFilename;
Module._resolveFilename = function(req, ...rest) {
    if (req === 'vscode') return req;
    return _orig.call(this, req, ...rest);
};
require.cache.vscode = require.cache.vscode || {
    id: 'vscode', filename: 'vscode', loaded: true,
    exports: {
        workspace: { workspaceFolders: null },
        window: {},
        commands: {},
        languages: {},
        Uri: { file: (p) => ({ fsPath: p, toString: () => `file://${p}` }) },
        ViewColumn: {},
        SymbolKind: {},
        CompletionItemKind: {},
        TextEditorRevealType: {},
    },
};

const src = fs.readFileSync(path.join(__dirname, '..', 'extension.js'), 'utf8');
const patchedSrc = src.replace(
    /module\.exports\s*=\s*\{[^}]+\};?\s*$/,
    'module.exports = { activate, deactivate, _decodeMapTile16: decodeMapTile16 };'
);
const tmpPath = path.join(__dirname, '..', '_map_tile_tmp.js');
fs.writeFileSync(tmpPath, patchedSrc);
let _decodeMapTile16;
try {
    delete require.cache[require.resolve(tmpPath)];
    _decodeMapTile16 = require(tmpPath)._decodeMapTile16;
} finally {
    fs.unlinkSync(tmpPath);
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('  \u2713', name);
        passed++;
    } catch (error) {
        console.error('  \u2717', name, '\n   ', error.message);
        failed++;
    }
}

function snesToRom(addr) {
    return addr & 0x3fffff;
}

function write24le(buf, off, value) {
    buf[off] = value & 0xff;
    buf[off + 1] = (value >>> 8) & 0xff;
    buf[off + 2] = (value >>> 16) & 0xff;
}

function makeRomWithTile(tileId, dataSnes, tileBytes) {
    const rom = Buffer.alloc(0x400000, 0x00);
    const ptrOff = snesToRom(0xee0000) + tileId * 3;
    write24le(rom, ptrOff, dataSnes);
    const dataOff = snesToRom(dataSnes);
    for (let i = 0; i < tileBytes.length; i++) rom[dataOff + i] = tileBytes[i] & 0xff;
    return rom;
}

// Independent reference decoder based on SoETilesViewer tile.h logic.
function decodeMapTile16Reference(romBuf, tileId) {
    const ptrOff = snesToRom(0xee0000 + tileId * 3);
    const dataAddr = romBuf[ptrOff] | (romBuf[ptrOff + 1] << 8) | (romBuf[ptrOff + 2] << 16);
    if (!dataAddr) return null;
    const dataOff = snesToRom(dataAddr);
    const tileInfo = romBuf[dataOff];
    const compressed = !!(tileInfo & 0x80);
    const uncompressedSize = 128;
    const dec = new Uint8Array(uncompressedSize);

    if (!compressed) {
        let wordCount = (tileInfo & 0x7f) + 1;
        if (wordCount > 64) wordCount = 64;
        const byteCount = wordCount * 2;
        for (let i = 0; i < byteCount; i++) dec[i] = romBuf[dataOff + 1 + i];
        for (let i = byteCount; i < uncompressedSize; i += 2) {
            dec[i] = dec[Math.max(0, i - 2)];
            dec[i + 1] = dec[Math.max(1, i - 1)];
        }
    } else {
        let dataPtr = dataOff + (tileInfo & 0x7f);
        let cmdPtr = dataOff + 1;
        let cmdSecondHalf = false;
        let outPos = 0;
        const read4cmdBits = () => {
            const v = romBuf[cmdPtr];
            let res;
            if (cmdSecondHalf) {
                res = v & 0x0f;
                cmdPtr++;
            } else {
                res = v >>> 4;
            }
            cmdSecondHalf = !cmdSecondHalf;
            return res;
        };

        while (outPos < uncompressedSize) {
            let indicators = romBuf[dataPtr++];
            for (let i = 0; i < 8 && outPos < uncompressedSize; i++) {
                if ((indicators & 0x80) === 0) {
                    dec[outPos++] = romBuf[dataPtr++];
                    dec[outPos++] = romBuf[dataPtr++];
                } else {
                    const mode = read4cmdBits();
                    switch (mode) {
                    case 0: dec[outPos++] = 0x00; dec[outPos++] = 0x00; break;
                    case 1: dec[outPos++] = 0xff; dec[outPos++] = 0x00; break;
                    case 2: dec[outPos++] = 0x00; dec[outPos++] = 0xff; break;
                    case 3: dec[outPos++] = 0xff; dec[outPos++] = 0xff; break;
                    case 4: dec[outPos++] = romBuf[dataPtr++]; dec[outPos++] = 0x00; break;
                    case 5: dec[outPos++] = romBuf[dataPtr++]; dec[outPos++] = 0xff; break;
                    case 6: dec[outPos++] = 0x00; dec[outPos++] = romBuf[dataPtr++]; break;
                    case 7: dec[outPos++] = 0xff; dec[outPos++] = romBuf[dataPtr++]; break;
                    case 8: {
                        const v = romBuf[dataPtr++];
                        dec[outPos++] = v;
                        dec[outPos++] = v;
                        break;
                    }
                    case 9:
                    case 10:
                    case 11:
                    case 12: {
                        const n = (mode - 9 + 1) + (mode === 12 ? read4cmdBits() : 0);
                        for (let j = 0; j < n && outPos < uncompressedSize; j++) {
                            if (outPos < 2) {
                                dec[outPos++] = 0;
                                dec[outPos++] = 0;
                            } else {
                                dec[outPos] = dec[outPos - 2]; outPos++;
                                dec[outPos] = dec[outPos - 2]; outPos++;
                            }
                        }
                        break;
                    }
                    case 13:
                        if (outPos < 2) dec[outPos++] = 0;
                        else { dec[outPos] = dec[outPos - 2]; outPos++; }
                        dec[outPos++] = romBuf[dataPtr++];
                        break;
                    case 14:
                        dec[outPos++] = romBuf[dataPtr++];
                        if (outPos < 2) dec[outPos++] = 0;
                        else { dec[outPos] = dec[outPos - 2]; outPos++; }
                        break;
                    case 15: {
                        const v = romBuf[dataPtr++];
                        dec[outPos++] = v;
                        dec[outPos++] = v ^ 0xff;
                        break;
                    }
                    }
                }
                indicators <<= 1;
            }
        }
    }

    const pix = new Uint8Array(16 * 16);
    let n = 0;
    for (let l = 0; l < 2; l++) {
        for (let k = 0; k < 8; k++) {
            for (let j = 0; j < 2; j++) {
                for (let i = 7; i >= 0; i--) {
                    let p = 0;
                    const base = (j + 2 * l) * 32 + k * 2;
                    if (dec[base + 0] & (1 << i)) p |= 1;
                    if (dec[base + 1] & (1 << i)) p |= 2;
                    if (dec[base + 16] & (1 << i)) p |= 4;
                    if (dec[base + 17] & (1 << i)) p |= 8;
                    pix[n++] = p;
                }
            }
        }
    }
    return Array.from(pix);
}

function seqBytes(len, seed) {
    const out = new Array(len);
    let x = seed >>> 0;
    for (let i = 0; i < len; i++) {
        x = (x * 1664525 + 1013904223) >>> 0;
        out[i] = (x >>> 16) & 0xff;
    }
    return out;
}

function makeCompressedCopyOnlyTileBytes(seed) {
    const bytes = [0x81];
    let x = seed >>> 0;
    for (let b = 0; b < 8; b++) {
        bytes.push(0x00); // all words uncompressed in this block
        for (let i = 0; i < 16; i++) {
            x = (x * 1103515245 + 12345) >>> 0;
            bytes.push((x >>> 17) & 0xff);
        }
    }
    return bytes;
}

function makeCompressedModeTileBytes(mode, dataSeed) {
    const dataOffset = 0x40;
    const bytes = new Array(dataOffset + 8 + 64).fill(0);
    bytes[0] = 0x80 | dataOffset;

    // 64 compressed words -> 64 nibbles command stream.
    for (let i = 0; i < 32; i++) bytes[1 + i] = ((mode & 0x0f) << 4) | (mode & 0x0f);

    // 8 indicator bytes, all compressed bits set.
    for (let i = 0; i < 8; i++) bytes[dataOffset + i] = 0xff;

    // Data bytes for modes that consume source bytes.
    const needsData = mode >= 4 && mode <= 8 || mode === 13 || mode === 14 || mode === 15;
    if (needsData) {
        const seq = seqBytes(64, dataSeed);
        for (let i = 0; i < 64; i++) bytes[dataOffset + 8 + i] = seq[i];
    }
    return bytes;
}

console.log('\nMap tile decoder parity (single 16x16 tile)');

test('uncompressed tiles match reference for multiple seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
        const tileId = seed;
        const dataSnes = 0xee1000 + seed * 0x40;
        const wordCount = (seed % 63) + 1;
        const tileInfo = (wordCount - 1) & 0x7f;
        const body = seqBytes(wordCount * 2, 0x1234 + seed);
        const rom = makeRomWithTile(tileId, dataSnes, [tileInfo].concat(body));
        const got = _decodeMapTile16(rom, tileId);
        const exp = decodeMapTile16Reference(rom, tileId);
        assert.deepStrictEqual(got, exp, 'seed=' + seed);
    }
});

test('uncompressed overflow wordCount clamps like TileViewer', () => {
    const tileId = 100;
    const dataSnes = 0xee3000;
    const body = seqBytes(256, 0xbeef);
    const rom = makeRomWithTile(tileId, dataSnes, [0x7f].concat(body));
    const got = _decodeMapTile16(rom, tileId);
    const exp = decodeMapTile16Reference(rom, tileId);
    assert.deepStrictEqual(got, exp);
});

test('compressed copy-only stream matches reference', () => {
    for (let seed = 1; seed <= 10; seed++) {
        const tileId = 150 + seed;
        const dataSnes = 0xee5000 + seed * 0x100;
        const rom = makeRomWithTile(tileId, dataSnes, makeCompressedCopyOnlyTileBytes(seed));
        const got = _decodeMapTile16(rom, tileId);
        const exp = decodeMapTile16Reference(rom, tileId);
        assert.deepStrictEqual(got, exp, 'seed=' + seed);
    }
});

test('compressed command modes 0..8,13,14,15 match reference', () => {
    const modes = [0,1,2,3,4,5,6,7,8,13,14,15];
    modes.forEach((mode, idx) => {
        const tileId = 220 + idx;
        const dataSnes = 0xee7000 + idx * 0x200;
        const rom = makeRomWithTile(tileId, dataSnes, makeCompressedModeTileBytes(mode, 0x4444 + mode));
        const got = _decodeMapTile16(rom, tileId);
        const exp = decodeMapTile16Reference(rom, tileId);
        assert.deepStrictEqual(got, exp, 'mode=' + mode);
    });
});

test('single tile 16x16 output has exact dimensions and palette-index range', () => {
    const tileId = 300;
    const dataSnes = 0xee9000;
    const rom = makeRomWithTile(tileId, dataSnes, [0x00, 0xaa, 0x55]); // 1 uncompressed word, repeated
    const got = _decodeMapTile16(rom, tileId);
    assert.strictEqual(got.length, 256, 'Expected 16x16 = 256 pixels');
    got.forEach((p) => {
        assert.ok(p >= 0 && p <= 15, 'Palette index out of 4bpp range: ' + p);
    });
});

console.log(`\n${passed + failed} run: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
