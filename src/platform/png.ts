// A minimal PNG encoder (8-bit RGBA, or 8-bit indexed; filter 0, one IDAT) and decoder (8-bit RGB or RGBA, or
// indexed at 1/2/4/8 bits; any filter, not interlaced). Host side only (node zlib). The one copy for every game
// (docs/cleanup.md 5.1).
import { deflateSync, inflateSync } from 'node:zlib';
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

/**
 * Encodes `width × height` palette indices as an indexed PNG (8 bits per pixel). `palette` is [r, g, b] per entry;
 * `alpha`, when given, is each entry's alpha (tRNS), e.g. index 0 transparent.
 */
export function encodeIndexedPng(width: number, height: number, indices: Uint8Array, palette: number[][], alpha?: number[]): Buffer {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 3; // colour type: indexed
    const raw = Buffer.alloc((width + 1) * height);
    for (let y = 0; y < height; y++) raw.set(indices.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
    return Buffer.concat([
        SIGNATURE,
        chunk('IHDR', ihdr),
        chunk('PLTE', Buffer.from(palette.flat())),
        ...(alpha ? [chunk('tRNS', Buffer.from(alpha))] : []),
        chunk('IDAT', deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

/**
 * Decodes a PNG of 8-bit RGB or RGBA (what image editors save by default) into RGBA pixels. Throws, with a reason,
 * on anything else (palette, 16-bit, grey, interlaced): callers report it to the user.
 */
export function decodePng(file: Uint8Array): { width: number; height: number; rgba: Uint8Array; indices?: Uint8Array; palette?: number[][] } {
    const buf = Buffer.from(file);
    if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file');
    let width = 0, height = 0, type = -1, depth = 8;
    let plte: Buffer | null = null, trns: Buffer | null = null;
    const idat: Buffer[] = [];
    for (let at = 8; at + 8 <= buf.length;) {
        const len = buf.readUInt32BE(at), name = buf.toString('ascii', at + 4, at + 8), data = buf.subarray(at + 8, at + 8 + len);
        if (name === 'IHDR') {
            width = data.readUInt32BE(0); height = data.readUInt32BE(4); type = data[9]; depth = data[8];
            const ok = type === 3 ? [1, 2, 4, 8].includes(depth) : (type === 2 || type === 6) && depth === 8;
            if (!ok) throw new Error('only 8-bit RGB or RGBA, or indexed PNGs are read');
            if (data[12] !== 0) throw new Error('interlaced PNGs are not read');
        } else if (name === 'IDAT') idat.push(data);
        else if (name === 'PLTE') plte = data;
        else if (name === 'tRNS') trns = data;
        else if (name === 'IEND') break;
        at += 12 + len;
    }
    if (type < 0) throw new Error('the PNG has no IHDR');
    if (type === 3 && !plte) throw new Error('the indexed PNG has no palette');
    // Bytes per pixel for the filters (at least 1), bytes per row.
    const bpp = type === 6 ? 4 : type === 2 ? 3 : 1, stride = type === 3 ? Math.ceil(width * depth / 8) : width * bpp;
    const raw = inflateSync(Buffer.concat(idat));
    if (raw.length < (stride + 1) * height) throw new Error('the PNG image data is short');
    const px = new Uint8Array(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        for (let x = 0; x < stride; x++) {
            const v = raw[y * (stride + 1) + 1 + x];
            const a = x >= bpp ? px[y * stride + x - bpp] : 0;
            const b = y > 0 ? px[(y - 1) * stride + x] : 0;
            const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
            let pred = 0;
            if (filter === 1) pred = a;
            else if (filter === 2) pred = b;
            else if (filter === 3) pred = (a + b) >> 1;
            else if (filter === 4) {
                const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            } else if (filter !== 0) throw new Error(`unknown PNG row filter ${filter}`);
            px[y * stride + x] = (v + pred) & 0xff;
        }
    }
    if (type === 3) {
        const palette: number[][] = [];
        for (let i = 0; i + 2 < plte!.length; i += 3) palette.push([plte![i], plte![i + 1], plte![i + 2]]);
        const indices = new Uint8Array(width * height), rgba = new Uint8Array(width * height * 4);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const bit = x * depth, b = px[y * stride + (bit >> 3)];
            const v = (b >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
            if (v >= palette.length) throw new Error(`pixel ${x},${y} uses palette entry ${v} of ${palette.length}`);
            indices[y * width + x] = v;
            rgba.set([...palette[v], trns && v < trns.length ? trns[v] : 255], (y * width + x) * 4);
        }
        return { width, height, rgba, indices, palette };
    }
    if (bpp === 4) return { width, height, rgba: px };
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) rgba.set([px[i * 3], px[i * 3 + 1], px[i * 3 + 2], 255], i * 4);
    return { width, height, rgba };
}
