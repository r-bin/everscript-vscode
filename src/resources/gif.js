'use strict';
// Ownership: pure GIF89a encoder for animated character and sprite animations.
// Pure Node/JS with zero external dependencies.

/**
 * Encode an animated GIF from a sequence of frames.
 *
 * @param {number} width Canvas width in pixels
 * @param {number} height Canvas height in pixels
 * @param {Array<{ data: Uint8Array|Buffer, ticks?: number, delay?: number }>} frames
 *        data is RGBA (4 bytes per pixel, length width * height * 4).
 *        ticks is duration in 60Hz SNES ticks (default 4).
 * @returns {Buffer}
 */
function encodeGif(width, height, frames) {
    if (!frames || frames.length === 0 || width <= 0 || height <= 0) {
        return Buffer.alloc(0);
    }

    // Build palette across all frames (up to 256 colors).
    // Index 0 is reserved for transparent.
    const paletteMap = new Map();
    paletteMap.set('0,0,0,0', 0);
    const paletteColors = [[0, 0, 0]]; // index 0: transparent background

    const indexedFrames = frames.map((f) => {
        const { data, ticks = 4, delay } = f;
        const indices = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            const a = data[i * 4 + 3];
            if (a < 128) {
                indices[i] = 0;
            } else {
                const key = `${r},${g},${b}`;
                let idx = paletteMap.get(key);
                if (idx === undefined) {
                    if (paletteColors.length < 256) {
                        idx = paletteColors.length;
                        paletteColors.push([r, g, b]);
                        paletteMap.set(key, idx);
                    } else {
                        // Nearest color fallback if palette exceeds 256
                        idx = 1;
                    }
                }
                indices[i] = idx;
            }
        }
        // Delay in hundredths of a second (min 2 = 20ms)
        const frameDelay = delay !== undefined
            ? Math.max(2, delay)
            : Math.max(2, Math.round((ticks || 4) * 100 / 60));
        return { indices, delay: frameDelay };
    });

    // Pad color table to 256 entries
    while (paletteColors.length < 256) {
        paletteColors.push([0, 0, 0]);
    }

    const chunks = [];

    // Header: GIF89a
    chunks.push(Buffer.from('GIF89a', 'ascii'));

    // Logical Screen Descriptor (7 bytes)
    const lsd = Buffer.alloc(7);
    lsd.writeUInt16LE(width, 0);
    lsd.writeUInt16LE(height, 2);
    lsd[4] = 0xf7; // GCT flag = 1, resolution = 7 (8bpp), size = 7 (256 colors)
    lsd[5] = 0;    // Background color index = 0
    lsd[6] = 0;    // Pixel aspect ratio = 0
    chunks.push(lsd);

    // Global Color Table (256 * 3 bytes)
    const gct = Buffer.alloc(256 * 3);
    for (let i = 0; i < 256; i++) {
        const [r, g, b] = paletteColors[i];
        gct[i * 3] = r;
        gct[i * 3 + 1] = g;
        gct[i * 3 + 2] = b;
    }
    chunks.push(gct);

    // Netscape Application Extension for infinite loop
    chunks.push(Buffer.from([
        0x21, 0xff, 0x0b,
        0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, // NETSCAPE2.0
        0x03, 0x01, 0x00, 0x00, // loop count 0 (infinite loop)
        0x00, // block terminator
    ]));

    // Output each frame
    for (const frame of indexedFrames) {
        // Graphic Control Extension (8 bytes)
        const gce = Buffer.from([
            0x21, 0xf9, 0x04,
            0x09, // disposal = 2 (restore to background), transparent color flag = 1
            frame.delay & 0xff, (frame.delay >> 8) & 0xff,
            0x00, // transparent color index = 0
            0x00, // block terminator
        ]);
        chunks.push(gce);

        // Image Descriptor (10 bytes)
        const desc = Buffer.alloc(10);
        desc[0] = 0x2c; // image separator ','
        desc.writeUInt16LE(0, 1); // left = 0
        desc.writeUInt16LE(0, 3); // top = 0
        desc.writeUInt16LE(width, 5);
        desc.writeUInt16LE(height, 7);
        desc[9] = 0; // no local color table
        chunks.push(desc);

        // LZW compressed image data
        chunks.push(lzwEncode(8, frame.indices));
    }

    // Trailer (1 byte)
    chunks.push(Buffer.from([0x3b]));

    return Buffer.concat(chunks);
}

/**
 * Standard LZW encoder for GIF image data sub-blocks.
 *
 * @param {number} minCodeSize Minimum code size (8 for 256 colors)
 * @param {Uint8Array} pixels Array of palette indices
 * @returns {Buffer}
 */
function lzwEncode(minCodeSize, pixels) {
    const clearCode = 1 << minCodeSize; // 256
    const eoiCode = clearCode + 1;      // 257

    let codeSize = minCodeSize + 1;
    let nextCode = clearCode + 2;

    const dict = new Map();
    function resetDict() {
        dict.clear();
        codeSize = minCodeSize + 1;
        nextCode = clearCode + 2;
    }

    const subBlocks = [];
    let curSubBlock = [];

    let bitBuffer = 0;
    let bitCount = 0;

    function writeBits(val, bits) {
        bitBuffer |= (val << bitCount);
        bitCount += bits;
        while (bitCount >= 8) {
            curSubBlock.push(bitBuffer & 0xff);
            if (curSubBlock.length === 255) {
                subBlocks.push(Buffer.from([255, ...curSubBlock]));
                curSubBlock = [];
            }
            bitBuffer >>= 8;
            bitCount -= 8;
        }
    }

    function flushBits() {
        if (bitCount > 0) {
            curSubBlock.push(bitBuffer & 0xff);
            bitBuffer = 0;
            bitCount = 0;
        }
        if (curSubBlock.length > 0) {
            subBlocks.push(Buffer.from([curSubBlock.length, ...curSubBlock]));
            curSubBlock = [];
        }
    }

    writeBits(clearCode, codeSize);

    if (pixels.length > 0) {
        let prefix = pixels[0];
        for (let i = 1; i < pixels.length; i++) {
            const k = pixels[i];
            const key = (prefix << 8) | k;
            if (dict.has(key)) {
                prefix = dict.get(key);
            } else {
                writeBits(prefix, codeSize);
                if (nextCode < 4096) {
                    dict.set(key, nextCode++);
                    if (nextCode > (1 << codeSize) && codeSize < 12) {
                        codeSize++;
                    }
                } else {
                    writeBits(clearCode, codeSize);
                    resetDict();
                }
                prefix = k;
            }
        }
        writeBits(prefix, codeSize);
    }

    writeBits(eoiCode, codeSize);
    flushBits();

    return Buffer.concat([
        Buffer.from([minCodeSize]),
        ...subBlocks,
        Buffer.from([0x00]), // block terminator
    ]);
}

module.exports = { encodeGif };

