// Ownership: the room blob *write* path — block encoders, the container
// serialiser, and placing a blob in a ROM image. Pure. The compressors
// themselves are in encode-streams.ts.
//
// Ported from everscript/tools/encode_room.py, which round-trips all 127
// vanilla rooms (`--verify`, `--verify-rebuild`). The inverse of room.ts:
// every function here has its decoder in lzss.ts, markov.ts or
// blob-layout.ts, and `checkEncoder` in tests/memory/map-units.test.js
// decodes what these produce.
//
// See docs/map-format/map_encoding.md.

import { parseBlobLayout, BlobLayout } from './blob-layout';
import { decompressLzss } from './lzss';
import { lzssCompress, encodeMarkovGrid } from './encode-streams';

export { lzssCompress, encodeMarkovGrid };
import { MAP_LIST_ADDR, MAX_ROOMS, MAP_TABLE_STRIDE, read16, read24, snesToRom } from './rom';

export const SUB_RAW = 0x00;
export const SUB_LZSS = 0x03;
export const SUB_MARKOV = 0x07;

// ---------------------------------------------------------------------------
// Room model
// ---------------------------------------------------------------------------

/** One dispatcher sub-block: `payloadLen:2, subFlag:1, decomp:2, data`. */
export interface Block {
    sub: number;
    decomp: number;
    data: Uint8Array;
}

export interface TriggerRecord {
    y1: number; x1: number; y2: number; x2: number; scriptId: number;
}

/** Everything a room blob contains, in writable form. */
export interface RoomModel {
    /** 13 bytes. */
    header: Uint8Array;
    stepOn: TriggerRecord[];
    bTrigger: TriggerRecord[];
    tileFamilies: number[];
    /** `extraCount * 3` CHR descriptor bytes. */
    extras: Uint8Array;
    block1: Block;
    section2Count: number;
    section2Data: Uint8Array;
    objectOffsets: number[];
    block2: Block;
    /** `$0FC4` byte + metatile swap records. */
    section4: Uint8Array;
    block3: Block;
    objectArea: Uint8Array;
}

class ByteSink {
    readonly out: number[] = [];
    u8(v: number): void { this.out.push(v & 0xff); }
    u16(v: number): void { this.out.push(v & 0xff, (v >> 8) & 0xff); }
    bytes(b: ArrayLike<number>): void { for (let i = 0; i < b.length; i++) this.out.push(b[i]); }
}

function blockBytes(sink: ByteSink, b: Block): void {
    const payloadLen = 3 + b.data.length;
    if (payloadLen > 0xffff) throw new Error(`block payload ${payloadLen} exceeds the 16-bit length field`);
    sink.u16(payloadLen);
    sink.u8(b.sub);
    sink.u16(b.decomp);
    sink.bytes(b.data);
}

function triggerBytes(records: TriggerRecord[]): number[] {
    const s = new ByteSink();
    for (const r of records) {
        s.u8(r.y1); s.u8(r.x1); s.u8(r.y2); s.u8(r.x2);
        s.u16(r.scriptId);
    }
    return s.out;
}

/** Serialise a RoomModel into the byte blob the engine loads. */
export function buildBlob(model: RoomModel): Uint8Array {
    if (model.header.length !== 13) throw new Error(`header must be 13 bytes, got ${model.header.length}`);
    if (model.extras.length % 3) {
        throw new Error(`extras must be a whole number of 3-byte descriptors, got ${model.extras.length}`);
    }
    const s = new ByteSink();
    s.bytes(model.header);

    const step = triggerBytes(model.stepOn);
    s.u16(step.length); s.bytes(step);
    const btrig = triggerBytes(model.bTrigger);
    s.u16(btrig.length); s.bytes(btrig);

    s.u8(model.tileFamilies.length);
    for (const t of model.tileFamilies) s.u16(t);

    s.u8(model.extras.length / 3); s.bytes(model.extras);
    blockBytes(s, model.block1);

    s.u8(model.section2Count);
    s.u16(model.section2Data.length); s.bytes(model.section2Data);

    s.u8(model.objectOffsets.length);
    for (const o of model.objectOffsets) s.u16(o);

    blockBytes(s, model.block2);
    s.u16(model.section4.length); s.bytes(model.section4);
    blockBytes(s, model.block3);
    s.bytes(model.objectArea);
    return Uint8Array.from(s.out);
}

/**
 * Lossless extraction: `buildBlob(modelFromRom(rom, id))` reproduces the
 * original bytes exactly. Compressed payloads are kept verbatim.
 */
export function modelFromRom(rom: Uint8Array, roomId: number): RoomModel {
    // Copies, never views. The ROM is often a Node Buffer, whose `slice()`
    // shares memory: an edit to a model's header (custom-room.ts sets the
    // size) then wrote straight into the cached vanilla ROM, and every later
    // decode of the donor room failed.
    const copy = (from: number, to: number): Uint8Array => Uint8Array.prototype.slice.call(rom, from, to);

    const blob = snesToRom(read24(rom, MAP_LIST_ADDR + roomId * MAP_TABLE_STRIDE));
    const L = parseBlobLayout(rom, blob);

    const records = (start: number, length: number): TriggerRecord[] => {
        const out: TriggerRecord[] = [];
        for (let i = 0; i < Math.floor(length / 6); i++) {
            const r = start + i * 6;
            out.push({ y1: rom[r], x1: rom[r + 1], y2: rom[r + 2], x2: rom[r + 3], scriptId: read16(rom, r + 4) });
        }
        return out;
    };
    const block = (off: number): Block => {
        const payloadLen = read16(rom, off);
        return { sub: rom[off + 2], decomp: read16(rom, off + 3), data: copy(off + 5, off + 2 + payloadLen) };
    };

    const tileFamilies: number[] = [];
    for (let i = 0; i < L.tileCount; i++) tileFamilies.push(read16(rom, L.payloadOffset + 1 + i * 2));
    const objectOffsets: number[] = [];
    for (let i = 0; i < L.objectCount; i++) objectOffsets.push(read16(rom, L.section3 + 1 + i * 2));

    return {
        header: copy(blob, blob + 13),
        stepOn: records(blob + 0x0f, L.stepLen),
        bTrigger: records(L.bLenOffset + 2, L.bLen),
        tileFamilies,
        extras: copy(L.extrasOffset + 1, L.block1.offset),
        block1: block(L.block1.offset),
        section2Count: L.section2Count,
        section2Data: copy(L.section2 + 3, L.section3),
        objectOffsets,
        block2: block(L.block2.offset),
        section4: copy(L.section4 + 2, L.block3.offset),
        block3: block(L.block3.offset),
        objectArea: copy(L.objectArea, objectAreaEnd(rom, L)),
    };
}

/**
 * The furthest byte any object record or stamping block reaches. Vanilla
 * rooms share stamping blocks between states, so the end is measured, not
 * summed.
 */
export function objectAreaEnd(rom: Uint8Array, L: BlobLayout): number {
    const aa = L.objectArea;
    let end = aa;
    for (let i = 0; i < L.objectCount; i++) {
        const rec = aa + read16(rom, L.section3 + 1 + i * 2);
        const maxState = rom[rec];
        end = Math.max(end, rec + 1 + maxState * 5);
        for (let s = 0; s < maxState; s++) {
            const tp = aa + read16(rom, rec + 1 + s * 5 + 3);
            end = Math.max(end, tp + 2 + rom[tp] * rom[tp + 1] * 2);
        }
    }
    return end;
}

// ---------------------------------------------------------------------------
// Block re-encoders
// ---------------------------------------------------------------------------

/**
 * Block 1 is the CHR tile palette stored as 16-bit deltas, accumulated by
 * the engine at `$908E85`; room.ts reports the accumulated values, so this
 * differentiates them back.
 */
export function encodeBlock1(accumWords: number[], compress = false): Block {
    const s = new ByteSink();
    let prev = 0;
    for (const w of accumWords) {
        s.u16((w - prev) & 0xffff);
        prev = w & 0xffff;
    }
    return wrapBlock(Uint8Array.from(s.out), compress);
}

/** Block 2 is Markov-encoded (sub_flag 0x07) in all 127 vanilla rooms. */
export function encodeBlock2(grid: ArrayLike<number>, width: number, height: number,
    baseMetatile: number, fc4 = 0): Block {
    return { sub: SUB_MARKOV, decomp: width * height * 2, data: encodeMarkovGrid(grid, width, height, baseMetatile, fc4) };
}

/** Block 3 is Layer 1 words, Layer 2 words and collision words, one slice after the other. */
export function encodeBlock3(layer1: number[], layer2: number[], collision: number[], compress = false): Block {
    if (layer1.length !== layer2.length || layer2.length !== collision.length) {
        throw new Error('the three metatile slices must be the same length');
    }
    const s = new ByteSink();
    for (const slice of [layer1, layer2, collision]) for (const w of slice) s.u16(w);
    return wrapBlock(Uint8Array.from(s.out), compress);
}

/** The smallest legal encoding of `raw`: uncompressed, or LZSS when that is shorter. */
export function wrapBlock(raw: Uint8Array, compress: boolean): Block {
    let best: Block = { sub: SUB_RAW, decomp: raw.length, data: raw };
    if (compress) {
        const packed = lzssCompress(raw);
        if (packed.length < best.data.length) best = { sub: SUB_LZSS, decomp: raw.length, data: packed };
    }
    return best;
}

/** A block's decompressed payload, whichever sub_flag it uses. */
export function unpackBlock(b: Block): Uint8Array {
    if (b.sub === SUB_LZSS) return decompressLzss(b.data, 0, b.decomp).slice(0, b.decomp);
    if (b.sub === SUB_RAW) return Uint8Array.prototype.slice.call(b.data, 0, b.decomp);
    throw new Error(`cannot unpack sub_flag 0x${b.sub.toString(16)}`);
}

// ---------------------------------------------------------------------------
// Writing a blob into a ROM image
// ---------------------------------------------------------------------------

/**
 * Place `blob` at ROM offset `atOffset` and repoint room `roomId` at it.
 * Mutates `rom`.
 *
 * Upstream's `write_room_into_rom(at_offset=...)` repoints to
 * `0x800000 | offset`. That is a HiROM address only in the upper half of a
 * bank (`$8000..$FFFF`) — which is where all 127 vanilla blobs are — so this
 * port refuses the lower half instead of writing a pointer into I/O space.
 * The bank rule is upstream's: the loader walks a blob with 16-bit offsets
 * from its own bank, so it may not cross one.
 */
export function writeRoomAt(rom: Uint8Array, roomId: number, blob: Uint8Array, atOffset: number): void {
    if (!(roomId >= 0 && roomId < MAX_ROOMS)) throw new Error(`room id 0x${roomId.toString(16)} out of range`);
    if (atOffset + blob.length > rom.length) throw new Error('blob does not fit in the ROM image at that offset');
    if ((atOffset & 0xffff) < 0x8000) {
        throw new Error(`0x${atOffset.toString(16)} is in the lower half of a bank; every vanilla blob is at $8000 or above`);
    }
    if ((atOffset >> 16) !== ((atOffset + blob.length - 1) >> 16)) {
        throw new Error(`a ${blob.length}-byte blob at 0x${atOffset.toString(16)} would cross a bank boundary`);
    }
    rom.set(blob, atOffset);
    const snes = 0x800000 | atOffset;
    const entry = MAP_LIST_ADDR + roomId * MAP_TABLE_STRIDE;
    rom[entry] = snes & 0xff;
    rom[entry + 1] = (snes >> 8) & 0xff;
    rom[entry + 2] = (snes >> 16) & 0xff;
}
