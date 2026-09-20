// Ownership: deterministic section-offset resolution inside a room blob.
// Pure. No searching or signature scanning — every section stores its own
// length, so the whole chain is walkable from the header.
//
// Ported from everscript/tools/dump_room.py (parse_blob_layout).
// See docs/map-format/map_decompression_trace_analysis.md.
//
//     +$00                header[13]
//     +$0D                step_len:2, step-on records (6 bytes each)
//                         b_len:2,    B-trigger records (6 bytes each)
//     payloadOffset       tileFamilyCount:1, families (2 bytes each)
//     extrasOffset        extraCount:1, CHR descriptors (3 bytes each)
//     block1              payloadLen:2, subFlag:1, decompSize:2, data
//     section2            count:1, len:2, animated-tile descriptors
//     section3            objectCount:1, object offsets (2 bytes each)
//     block2              payloadLen:2, subFlag:1, decompSize:2, data
//     section4            len:2, $0FC4:1, metatile swap records
//     block3              payloadLen:2, subFlag:1, decompSize:2, data
//     objectArea          object records and their stamping blocks

import { read16 } from './rom';

/** A dispatcher sub-block header: `[payloadLen:2][subFlag:1][decompSize:2]`. */
export interface PayloadBlock {
    /** ROM file offset of the sub-block header. */
    offset: number;
    payloadLen: number;
    /** 0x00 raw copy, 0x03 LZSS, 0x07 Markov. */
    subFlag: number;
    decompSize: number;
}

export interface BlobLayout {
    blob: number;
    stepLen: number;
    bLenOffset: number;
    bLen: number;
    payloadOffset: number;
    tileCount: number;
    extrasOffset: number;
    extraCount: number;
    block1: PayloadBlock;
    section2: number;
    section2Count: number;
    section2Len: number;
    section3: number;
    objectCount: number;
    block2: PayloadBlock;
    section4: number;
    section4Len: number;
    /** Section 4's initial metatile counter, consumed by the Markov decoder. */
    fc4: number;
    block3: PayloadBlock;
    objectArea: number;
}

function readBlock(rom: Uint8Array, offset: number): PayloadBlock {
    return {
        offset,
        payloadLen: read16(rom, offset),
        subFlag: rom[offset + 2],
        decompSize: read16(rom, offset + 3),
    };
}

/**
 * Resolve every section offset inside a room blob.
 *
 * Verified upstream against all 127 vanilla rooms — including room 0x15, whose
 * Block 3 is an uncompressed 12-byte table that the older signature scan missed.
 */
export function parseBlobLayout(rom: Uint8Array, blobOffset: number): BlobLayout {
    const stepLen = read16(rom, blobOffset + 0x0d);
    const bLenOffset = blobOffset + 0x0f + stepLen;
    const bLen = read16(rom, bLenOffset);

    const payloadOffset = bLenOffset + 2 + bLen;
    const tileCount = rom[payloadOffset];

    const extrasOffset = payloadOffset + 1 + tileCount * 2;
    const extraCount = rom[extrasOffset];

    const block1 = readBlock(rom, extrasOffset + 1 + extraCount * 3);

    const section2 = block1.offset + 2 + block1.payloadLen;
    const section2Len = read16(rom, section2 + 1);

    const section3 = section2 + 3 + section2Len;
    const objectCount = rom[section3];

    const block2 = readBlock(rom, section3 + 1 + objectCount * 2);

    const section4 = block2.offset + 2 + block2.payloadLen;
    const section4Len = read16(rom, section4);

    const block3 = readBlock(rom, section4 + 2 + section4Len);

    return {
        blob: blobOffset,
        stepLen,
        bLenOffset,
        bLen,
        payloadOffset,
        tileCount,
        extrasOffset,
        extraCount,
        block1,
        section2,
        section2Count: rom[section2],
        section2Len,
        section3,
        objectCount,
        block2,
        section4,
        section4Len,
        fc4: section4Len > 0 ? rom[section4 + 2] : 0,
        block3,
        objectArea: block3.offset + 2 + block3.payloadLen,
    };
}
