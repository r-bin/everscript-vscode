// Ownership: decode a room blob into a structured model.
// Pure — takes a ROM buffer, returns data. No filesystem, no VS Code API.
//
// Ported from everscript/tools/dump_room.py (dump_room).
// See docs/map-format/ and the `rom-map-data` skill.
//
// Unlike the Python original, every grid here is numbers, never hex strings.
// Upstream carries both forms and warns that mixing them silently produces
// wrong results; the port drops the string forms and formats at render time.

import { read16, readByte, roomBlobOffset, snesToRom, read24, MAP_LIST_ADDR, MAP_TABLE_STRIDE, MAX_ROOMS } from './rom';
import { decompressLzss, copyRaw } from './lzss';
import { decompressMarkovGrid } from './markov';
import { parseBlobLayout, BlobLayout, PayloadBlock } from './blob-layout';
import { planesUsed } from './collision';
import {
    parseGrassSwapSection,
    findCuttableGrassTiles,
    checkTableInvariants,
    GrassSwapTable,
} from './cuttable-grass';

export interface RoomHeader {
    /** Trigger rect origin, in 16px-tile units, added to player tile coords. */
    originX: number;
    originY: number;
    widthTiles: number;
    heightTiles: number;
    widthPixels: number;
    heightPixels: number;
    /** SNES PPU main-screen designation ($212C). */
    displayTm: number;
    /** SNES PPU subscreen designation ($212D). */
    subscreenTs: number;
    /** SNES PPU CGADSUB ($2131). */
    colorMath: number;
    /** SNES PPU CGWSEL ($2130). */
    colorWindow: number;
    effectVariant: number;
}

export interface TriggerRecord {
    y1: number;
    x1: number;
    y2: number;
    x2: number;
    /** Matches the `id:` field in script_all. */
    scriptId: number;
}

export interface ObjectState {
    state: number;
    width: number;
    tileX: number;
    tileY: number;
    targetWidth: number;
    targetHeight: number;
    metatiles: number[];
    metatileId: number;
}

export interface RoomObject {
    objectIndex: number;
    maxState: number;
    relativeOffset: number;
    states: ObjectState[];
}

export interface RoomData {
    roomId: number;
    romPointerSnes: number;
    romPointerFile: number;
    header: RoomHeader;
    triggers: { stepOn: TriggerRecord[]; bTrigger: TriggerRecord[] };
    objects: RoomObject[];
    tileFamilies: number[];
    tilePalette: number[];
    animatedTiles: number[];
    payloadBlocks: { block1: PayloadBlock; block2: PayloadBlock; block3: PayloadBlock };
    metatileCount: number;
    baseMetatile: number;
    /** File offset of the Section 3 object area; object stamp pointers are relative to it. */
    objectArea: number;
    /** `[y][x]` metatile IDs (WRAM offsets, 8-byte aligned from baseMetatile). */
    layer1MetatileIds: number[][];
    /** `[y][x]` Layer 1 (canopy / BG2) VRAM tilemap words. */
    layer1VramWords: number[][];
    /** `[y][x]` Layer 2 (terrain / BG1) VRAM tilemap words. */
    layer2VramWords: number[][];
    /** `[y][x]` collision words — decode with `./collision`, never by hand. */
    collisionWords: number[][];
    cuttableGrass: {
        table: GrassSwapTable;
        tiles: Array<[number, number]>;
        warnings: string[];
    };
    elevationPlanes: number[];
}

function readTriggers(rom: Uint8Array, start: number, byteLen: number): TriggerRecord[] {
    const out: TriggerRecord[] = [];
    for (let i = 0; i < Math.floor(byteLen / 6); i++) {
        const p = start + i * 6;
        out.push({
            y1: rom[p],
            x1: rom[p + 1],
            y2: rom[p + 2],
            x2: rom[p + 3],
            scriptId: read16(rom, p + 4),
        });
    }
    return out;
}

function decodeBlock(rom: Uint8Array, block: PayloadBlock, roomId: number, label: string): Uint8Array {
    const dataStart = block.offset + 5;
    if (block.subFlag === 0x03) return decompressLzss(rom, dataStart, block.decompSize || undefined);
    if (block.subFlag === 0x00) return copyRaw(rom, dataStart, block.decompSize);
    throw new Error(
        `Room 0x${roomId.toString(16).toUpperCase()}: ${label} unsupported sub_flag ` +
            `0x${block.subFlag.toString(16).padStart(2, '0')} at 0x${block.offset.toString(16)}`,
    );
}

function readAnimatedTiles(rom: Uint8Array, layout: BlobLayout): number[] {
    const out: number[] = [];
    const count = layout.section2Count;
    const dataStart = layout.section2 + 3;
    if (count <= 0 || dataStart > rom.length) return out;

    for (let i = 0; i < count; i++) {
        const entry = dataStart + i * 4;
        if (entry + 4 > rom.length) continue;
        const rel = read16(rom, entry + 2);
        const sub = dataStart + rel;
        if (sub + 3 > rom.length) continue;
        out.push(read16(rom, sub + 1));
    }
    return out;
}

function readObjects(rom: Uint8Array, layout: BlobLayout): RoomObject[] {
    const count = layout.objectCount;
    const listStart = layout.section3 + 1;
    if (count <= 0 || listStart + count * 2 > rom.length) return [];

    const areaStart = layout.objectArea;
    const objects: RoomObject[] = [];

    for (let i = 0; i < count; i++) {
        const relOffset = read16(rom, listStart + i * 2);
        const recPtr = areaStart + relOffset;
        if (recPtr >= rom.length) continue;

        const maxState = rom[recPtr];
        const states: ObjectState[] = [];
        for (let s = 0; s < maxState; s++) {
            const sPtr = recPtr + 1 + s * 5;
            if (sPtr + 5 > rom.length) continue;
            const metatileId = read16(rom, sPtr + 3);
            const targetPtr = areaStart + metatileId;
            const tw = readByte(rom, targetPtr) || 1;
            const th = readByte(rom, targetPtr + 1) || 1;
            const metatiles: number[] = [];
            if (targetPtr + 2 + tw * th * 2 <= rom.length) {
                for (let k = 0; k < tw * th; k++) metatiles.push(read16(rom, targetPtr + 2 + k * 2));
            }
            states.push({
                state: s,
                width: rom[sPtr],
                tileX: rom[sPtr + 1],
                tileY: rom[sPtr + 2],
                targetWidth: tw,
                targetHeight: th,
                metatiles,
                metatileId,
            });
        }
        objects.push({ objectIndex: i, maxState, relativeOffset: relOffset, states });
    }
    return objects;
}

/**
 * Decode one room from a ROM buffer. Throws if the blob is malformed.
 *
 * Validation here is deliberately explicit: every offset is derived by walking
 * length fields, so a ROM whose layout differs from stock (a patch that
 * relocates the pointer table, resizes a room, or adds rooms) would otherwise
 * read arbitrary bytes and produce plausible-looking nonsense rather than
 * failing. Everything upstream verified is vanilla-only — see
 * docs/map-port-gap-analysis.md §1.6.
 */
export function decodeRoom(rom: Uint8Array, roomId: number): RoomData {
    if (!Number.isInteger(roomId) || roomId < 0 || roomId >= MAX_ROOMS) {
        throw new Error(`Room id ${roomId} out of range (expected 0..${MAX_ROOMS - 1})`);
    }
    const tableEntry = MAP_LIST_ADDR + roomId * MAP_TABLE_STRIDE;
    if (tableEntry + 3 > rom.length) {
        throw new Error(
            `ROM too small for the map pointer table (need 0x${(tableEntry + 3).toString(16)}, ` +
                `have 0x${rom.length.toString(16)}) — is this a Secret of Evermore ROM?`,
        );
    }

    const snesPtr = read24(rom, MAP_LIST_ADDR + roomId * MAP_TABLE_STRIDE);
    const blob = roomBlobOffset(rom, roomId);
    if (blob + 0x0f > rom.length) {
        throw new Error(
            `Room 0x${roomId.toString(16).toUpperCase()}: blob pointer 0x${blob.toString(16)} ` +
                `is past the end of the ROM — pointer table may be patched or this is not a stock ROM`,
        );
    }

    const header: RoomHeader = {
        originX: rom[blob],
        originY: rom[blob + 1],
        widthTiles: rom[blob + 2],
        heightTiles: rom[blob + 3],
        widthPixels: rom[blob + 2] * 16,
        heightPixels: rom[blob + 3] * 16,
        displayTm: rom[blob + 4],
        subscreenTs: rom[blob + 5],
        colorMath: rom[blob + 6],
        colorWindow: rom[blob + 7],
        effectVariant: rom[blob + 8],
    };

    const layout = parseBlobLayout(rom, blob);
    const { widthTiles, heightTiles } = header;
    const totalTiles = widthTiles * heightTiles;
    const targetGridBytes = totalTiles * 2;

    if (widthTiles === 0 || heightTiles === 0) {
        throw new Error(
            `Room 0x${roomId.toString(16).toUpperCase()}: header reports ${widthTiles}x${heightTiles} metatiles`,
        );
    }
    // Every section offset comes from walking length fields, so one bad length
    // sends the whole chain off the end rather than failing at the bad field.
    if (layout.objectArea > rom.length) {
        throw new Error(
            `Room 0x${roomId.toString(16).toUpperCase()}: section chain runs past the end of the ROM ` +
                `(object area at 0x${layout.objectArea.toString(16)}, ROM is 0x${rom.length.toString(16)}) — ` +
                `the blob layout does not match the stock format`,
        );
    }

    // --- Block 2: Markov -> 2D metatile grid (WRAM $7F0000) ---
    const b2 = layout.block2;
    if (b2.subFlag !== 0x07 || b2.decompSize !== targetGridBytes) {
        throw new Error(
            `Room 0x${roomId.toString(16).toUpperCase()}: Block 2 at 0x${b2.offset.toString(16)} has ` +
                `sub_flag 0x${b2.subFlag.toString(16)} / decomp ${b2.decompSize}, ` +
                `expected 0x07 / ${targetGridBytes}`,
        );
    }
    const baseMetatile = targetGridBytes;
    const rawMetatiles = decompressMarkovGrid(rom, b2.offset + 5, widthTiles, heightTiles, baseMetatile, layout.fc4);

    // --- Block 1: tile palette deltas -> 16-bit accumulator ($908E85) ---
    const block1Out = decodeBlock(rom, layout.block1, roomId, 'Block 1');
    const tilePalette: number[] = [];
    let runningAcc = 0;
    for (let i = 0; i + 1 < block1Out.length; i += 2) {
        runningAcc = (runningAcc + (block1Out[i] | (block1Out[i + 1] << 8))) & 0xffff;
        tilePalette.push(runningAcc);
    }

    // --- Block 3: LZSS -> 3-slice planar metatile table (WRAM $7F0280) ---
    const b3 = layout.block3;
    if (b3.decompSize % 6 !== 0) {
        throw new Error(
            `Room 0x${roomId.toString(16).toUpperCase()}: Block 3 decomp size ${b3.decompSize} is not a multiple of 6`,
        );
    }
    const b3Out = decodeBlock(rom, b3, roomId, 'Block 3');
    const metatileCount = Math.floor(b3.decompSize / 6); // hardware division by 6 ($9091B0)
    const words: number[] = [];
    for (let i = 0; i + 1 < b3Out.length; i += 2) words.push(b3Out[i] | (b3Out[i + 1] << 8));
    const slice0 = words.slice(0, metatileCount); // Layer 1 VRAM words
    const slice1 = words.slice(metatileCount, metatileCount * 2); // Layer 2 VRAM words
    const slice2 = words.slice(metatileCount * 2, metatileCount * 3); // collision attributes

    // --- Assemble the per-tile grids ---
    const layer1MetatileIds: number[][] = [];
    const layer1VramWords: number[][] = [];
    const layer2VramWords: number[][] = [];
    const collisionWords: number[][] = [];

    for (let r = 0; r < heightTiles; r++) {
        const meta: number[] = [];
        const v1: number[] = [];
        const v2: number[] = [];
        const coll: number[] = [];
        for (let c = 0; c < widthTiles; c++) {
            const metaId = rawMetatiles[r * widthTiles + c];
            const mIdx = Math.floor((metaId - baseMetatile) / 8);
            const inRange = mIdx >= 0 && mIdx < metatileCount;
            meta.push(metaId);
            v1.push(inRange ? slice0[mIdx] ?? 0 : 0);
            v2.push(inRange ? slice1[mIdx] ?? 0 : 0);
            coll.push(inRange ? slice2[mIdx] ?? 0 : 0);
        }
        layer1MetatileIds.push(meta);
        layer1VramWords.push(v1);
        layer2VramWords.push(v2);
        collisionWords.push(coll);
    }

    const grassTable = parseGrassSwapSection(rom, layout.section4);

    return {
        roomId,
        romPointerSnes: snesPtr,
        romPointerFile: blob,
        header,
        triggers: {
            stepOn: readTriggers(rom, blob + 0x0f, layout.stepLen),
            bTrigger: readTriggers(rom, layout.bLenOffset + 2, layout.bLen),
        },
        objects: readObjects(rom, layout),
        tileFamilies: Array.from({ length: layout.tileCount }, (_, i) =>
            read16(rom, layout.payloadOffset + 1 + i * 2),
        ),
        tilePalette,
        animatedTiles: readAnimatedTiles(rom, layout),
        payloadBlocks: { block1: layout.block1, block2: b2, block3: b3 },
        metatileCount,
        baseMetatile,
        objectArea: layout.objectArea,
        layer1MetatileIds,
        layer1VramWords,
        layer2VramWords,
        collisionWords,
        cuttableGrass: {
            table: grassTable,
            tiles: findCuttableGrassTiles(grassTable, layer1MetatileIds),
            warnings: checkTableInvariants(grassTable, baseMetatile),
        },
        elevationPlanes: planesUsed(collisionWords),
    };
}

export { snesToRom };
