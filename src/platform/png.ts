// A minimal PNG encoder: 8-bit RGBA, filter 0, one IDAT. Host side only (node zlib). The one copy for every
// game (docs/cleanup.md 5.1).
import { deflateSync } from 'node:zlib';
import { crc32 } from './crc32';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
}

/** Encodes `width × height` RGBA pixels (4 bytes each, row by row) as a PNG file. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // colour type: RGBA
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height); // each row starts with filter type 0
    for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
    return Buffer.concat([
        SIGNATURE,
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, { level: 6 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}
