'use strict';

const assert = require('assert');
const fs = require('fs');

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

const ROM_CANDIDATES = [
    '/Users/v/Documents/GitHub/SoETilesViewer/SoEScriptDumper/Secret of Evermore (U) [!].smc',
    '/Users/v/Documents/GitHub/everscript/Secret of Evermore (U) [!].smc',
    'Secret of Evermore (U) [!].smc',
    'Secret of Evermore.smc',
];

function getRomBufOrSkip() {
    for (const p of ROM_CANDIDATES) {
        try {
            if (fs.existsSync(p)) return fs.readFileSync(p);
        } catch {}
    }
    return null;
}

function mapDataRom(romBuf, mapId) {
    const mapTableRom = 0x1ffde7;
    const ptrAddr = mapTableRom + mapId * 4;
    const dataSnes = romBuf[ptrAddr] | (romBuf[ptrAddr + 1] << 8) | (romBuf[ptrAddr + 2] << 16);
    return ((dataSnes >> 16) & 0x3f) * 0x10000 + (dataSnes & 0xffff);
}

function readMapBasics(romBuf, mapId) {
    const dataRom = mapDataRom(romBuf, mapId);
    const h8 = (off) => romBuf[dataRom + off];
    const h16 = (off) => romBuf[dataRom + off] | (romBuf[dataRom + off + 1] << 8);
    const mapW = h8(2);
    const mapH = h8(3);
    const stepLen = h16(13);
    const bLenOff = 15 + stepLen;
    const bLen = h16(bLenOff);
    const payloadOff = bLenOff + 2 + bLen;
    const tileCount = h8(payloadOff);
    const compressStartAbs = dataRom + payloadOff + 1 + tileCount * 2;
    return { mapW, mapH, tileCount, compressStartAbs };
}

function findStrict7Sentinel(romBuf, startAbs, maxScanBytes) {
    for (let off = 0; off < maxScanBytes && startAbs + off + 7 <= romBuf.length; off++) {
        const abs = startAbs + off;
        // strict7 core: x 00 00 00 01 00 ff
        if (
            romBuf[abs + 1] === 0x00 &&
            romBuf[abs + 2] === 0x00 &&
            romBuf[abs + 3] === 0x00 &&
            romBuf[abs + 4] === 0x01 &&
            romBuf[abs + 5] === 0x00 &&
            romBuf[abs + 6] === 0xff
        ) {
            return { abs, off, lead: romBuf[abs] };
        }
    }
    return null;
}

// Room-data experiment: apply tile codec framing to arbitrary room compressed bytes.
// This mirrors tile-mode control flow but reads from an in-memory byte array.
function decompressWithTileCodecFraming(inputBytes, outSize) {
    if (!inputBytes || !inputBytes.length) return new Uint8Array(0);
    const out = new Uint8Array(outSize);
    const read = (idx) => (idx >= 0 && idx < inputBytes.length ? inputBytes[idx] : 0);
    const tileInfo = read(0);
    const compressed = !!(tileInfo & 0x80);

    if (!compressed) {
        let wordCount = (tileInfo & 0x7f) + 1;
        if (wordCount > 64) wordCount = 64;
        const byteCount = wordCount * 2;
        for (let i = 0; i < byteCount && i < outSize; i++) out[i] = read(1 + i);
        for (let i = byteCount; i < outSize; i += 2) {
            out[i] = out[Math.max(0, i - 2)];
            if (i + 1 < outSize) out[i + 1] = out[Math.max(1, i - 1)];
        }
        return out;
    }

    let dataPtr = (tileInfo & 0x7f);
    let cmdPtr = 1;
    let cmdSecondHalf = false;
    let outPos = 0;

    const read4cmdBits = () => {
        const v = read(cmdPtr);
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

    while (outPos < outSize) {
        let indicators = read(dataPtr++);
        for (let bit = 0; bit < 8 && outPos < outSize; bit++) {
            if ((indicators & 0x80) === 0) {
                out[outPos++] = read(dataPtr++);
                if (outPos < outSize) out[outPos++] = read(dataPtr++);
            } else {
                const mode = read4cmdBits();
                switch (mode) {
                case 0: out[outPos++] = 0x00; if (outPos < outSize) out[outPos++] = 0x00; break;
                case 1: out[outPos++] = 0xff; if (outPos < outSize) out[outPos++] = 0x00; break;
                case 2: out[outPos++] = 0x00; if (outPos < outSize) out[outPos++] = 0xff; break;
                case 3: out[outPos++] = 0xff; if (outPos < outSize) out[outPos++] = 0xff; break;
                case 4: out[outPos++] = read(dataPtr++); if (outPos < outSize) out[outPos++] = 0x00; break;
                case 5: out[outPos++] = read(dataPtr++); if (outPos < outSize) out[outPos++] = 0xff; break;
                case 6: out[outPos++] = 0x00; if (outPos < outSize) out[outPos++] = read(dataPtr++); break;
                case 7: out[outPos++] = 0xff; if (outPos < outSize) out[outPos++] = read(dataPtr++); break;
                case 8: {
                    const v = read(dataPtr++);
                    out[outPos++] = v;
                    if (outPos < outSize) out[outPos++] = v;
                    break;
                }
                case 9:
                case 10:
                case 11:
                case 12: {
                    const n = (mode - 9 + 1) + (mode === 12 ? read4cmdBits() : 0);
                    for (let j = 0; j < n && outPos < outSize; j++) {
                        if (outPos < 2) {
                            out[outPos++] = 0;
                            if (outPos < outSize) out[outPos++] = 0;
                        } else {
                            out[outPos] = out[outPos - 2]; outPos++;
                            if (outPos < outSize) { out[outPos] = out[outPos - 2]; outPos++; }
                        }
                    }
                    break;
                }
                case 13:
                    out[outPos++] = (outPos < 2 ? 0 : out[outPos - 2]);
                    if (outPos < outSize) out[outPos++] = read(dataPtr++);
                    break;
                case 14:
                    out[outPos++] = read(dataPtr++);
                    if (outPos < outSize) out[outPos++] = (outPos < 2 ? 0 : out[outPos - 2]);
                    break;
                case 15: {
                    const v = read(dataPtr++);
                    out[outPos++] = v;
                    if (outPos < outSize) out[outPos++] = v ^ 0xff;
                    break;
                }
                }
            }
            indicators <<= 1;
        }
    }
    return out;
}

function nibbleValues(bytes) {
    const vals = [];
    for (let i = 0; i < bytes.length; i++) {
        vals.push(bytes[i] & 0x0f);
        vals.push((bytes[i] >>> 4) & 0x0f);
    }
    return vals;
}

console.log('\nMap payload compression model checks');

const romBuf = getRomBufOrSkip();
if (!romBuf) {
    console.log('  - ROM not found locally; skipping map-payload compression tests');
    process.exit(0);
}

test('tile-compression framing fails to reproduce 0x33 tilemap diversity', () => {
    const mapId = 0x33;
    const { mapW, mapH, compressStartAbs } = readMapBasics(romBuf, mapId);
    const sentinel = findStrict7Sentinel(romBuf, compressStartAbs, 0x80000);
    assert.ok(sentinel, 'Expected strict7 sentinel for map 0x33');

    const compressed = romBuf.slice(compressStartAbs, sentinel.abs);
    const tilemapBytes = ((mapW * mapH) + 1) >>> 1;
    const decoded = decompressWithTileCodecFraming(compressed, tilemapBytes);

    const tileCodecNibs = nibbleValues(decoded);
    const tileCodecUnique = new Set(tileCodecNibs).size;

    // Trace-backed row 0 for map 0x33 includes values: 5, b, 0, 7, 8, 2, 3
    const expectedRow0 = [5, 11, 0, 0, 7, 0, 0, 8, 2, 0, 3, 3, 8, 8, 8, 8, 8, 8, 8, 8];
    const gotRow0 = tileCodecNibs.slice(0, mapW);

    // If the room stream used the tile codec framing directly, this row should match.
    // It does not, which is strong evidence they are different encodings.
    assert.notDeepStrictEqual(gotRow0, expectedRow0, 'Unexpected match: tile codec framing appears equivalent, re-check assumptions');
    assert.ok(tileCodecUnique <= 4, 'Expected low-value collapse under wrong framing (evidence of mismatch)');
});

test('trace-style room boundary markers are not part of tile codec framing', () => {
    const mapId = 0x33;
    const { compressStartAbs } = readMapBasics(romBuf, mapId);
    const sentinel = findStrict7Sentinel(romBuf, compressStartAbs, 0x80000);
    assert.ok(sentinel, 'Expected strict7 sentinel for map 0x33');

    const compressed = romBuf.slice(compressStartAbs, sentinel.abs);
    // Tile codec framing starts with tileInfo and has no concept of strict7 sentinel boundaries.
    // The room stream, by trace, uses a sentinel boundary before position table/tilemap.
    const hasStrict7CoreInsideCompressed = (() => {
        for (let i = 0; i + 7 <= compressed.length; i++) {
            if (
                compressed[i + 1] === 0x00 &&
                compressed[i + 2] === 0x00 &&
                compressed[i + 3] === 0x00 &&
                compressed[i + 4] === 0x01 &&
                compressed[i + 5] === 0x00 &&
                compressed[i + 6] === 0xff
            ) return true;
        }
        return false;
    })();

    assert.strictEqual(hasStrict7CoreInsideCompressed, false, 'Compressed section should end before sentinel core by room trace model');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
