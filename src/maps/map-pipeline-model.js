'use strict';

/**
 * map-pipeline-model.js
 * Evidence-backed model of the map blob processing pipeline.
 *
 * Pipeline stages (in execution order):
 *   1. parseBlobHeader        - fixed 13-byte map header
 *   2. parseTriggerTables     - step-on + B-trigger records
 *   3. parseTileFamilies      - tile family list + compressed section start
 *      [DECOMPRESSOR]         - NOT FULLY REVERSE-ENGINEERED (see below)
 *   4. findSentinel           - locate sentinel marker after compressed data
 *   5. parsePositionTable     - entry count + packed position records
 *   6. parseTilemap           - nibble-packed 2D tile grid
 *   7. applyDeltaDecode       - cumulative 16-bit word sum (pass1 -> pass2)
 *   8. lookupEEDescriptor     - macro ID -> 3-byte SNES render script pointer
 *   9. parseRenderScript93    - opcode 0x93 structure (counter-driven bitstream)
 *
 * Evidence sources (see also tmp/map_research.md):
 *   - ROM: Secret of Evermore (U) [!].smc
 *   - Trace: strongheart_exterior_decode_tiles_fist_call__breakpoint_bus=ee0000.txt
 *   - Trace: strongheart_exterior_read_7fc300_twice__breakpoint_read_bu=7FC300.txt
 *   - Trace: map_strongheart_exterior.txt (vertical flow, write-side)
 *   - Memory snapshot: "0x7FC300_1" and "0x7FC300_2" (Mesen2 memory viewer)
 *   - Source: list-rooms.cpp (SoE reverse-engineering reference)
 *
 * ---- DECOMPRESSOR STATUS ----
 * Input : compressed section, 6-byte sub-header + 158-byte bitstream (map 0x33)
 *         Sub-header layout (offsets relative to section start):
 *           [0x00]       = 0x00     (unused/padding)
 *           [0x01]       = 0xA4     = 164 = total section size in bytes
 *           [0x02]       = 0x00     (unused)
 *           [0x03]       = 0x03     = decompression mode/setup (read by PC 8C9890)
 *           [0x04]       = 0xC2     = initial decoder state (read 49 times by PC 8C9898 -- loop body)
 *           [0x05]       = 0x00     (never read)
 *         Bitstream: 158 bytes starting at sub-header+6 (reloff 0x030 for map 0x33)
 * Output: 97 LE 16-bit words written to 0x7FC300 (FIRST PASS, delta-encoded).
 *         Parallel mirror written to 0x7FA000.
 * Algorithm: NOT RECONSTRUCTED. Known from trace:
 *   - PC 8C9909: reads each bitstream byte.
 *   - Each byte is read twice: once at 8C9909, once at a secondary dispatch PC
 *     in range 8C9B22..8C9B5F. The secondary PC varies by byte content -> dispatch.
 *   - Decode loop signature (PC 8C9978-8C99DC):
 *       XBA + AND #$00FF  -> isolate source byte half
 *       LSR * 4           -> extract high nibble (byte >> 4)
 *       AND #$000F        -> extract low nibble (byte & 0x0F)
 *       STA ($02)         -> write to 0x7FC300 (PC 8C9928 or 8C99E8)
 *       STA ($08)         -> write to 0x7FA000 (PC 8C992A or 8C99EA)
 * Note: The decompressor is called TWICE per map load (two render layers).
 *   TRUSTED pass1Words below come from the SECOND invocation (Mesen2 trigger 2).
 *   The first invocation produces different data (observed in map_strongheart trace).
 * Missing to fully reverse-engineer:
 *   - Disassembly of ROM PC 8C9909 through 8C9B60 (the dispatch table region).
 *   - Mapping from bitstream nibble pairs to output macro ID deltas.
 *   - Meaning of the 0x03 mode byte and 0xC2 initial-state byte.
 */

const fs = require('fs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAP_POINTER_TABLE_ROM    = 0x1ffde7;   // 4-byte entries: SNES ptr (3B LE) + size flag
const EE_TABLE_SNES            = 0xee0000;   // each entry: 3-byte LE SNES pointer
const EE_TABLE_ENTRY_STRIDE    = 3;

// Sentinel variants confirmed by parse tests (see docs/map-0x33-analysis.md).
const SENTINEL_PATTERNS = {
    strict7: { lead: [0x30], core: [0x00, 0x00, 0x00, 0x01, 0x00, 0xFF] },
    short6:  { lead: [0x80], core: [0x00, 0x00, 0x01, 0x00, 0xFF] },
    alt7:    { lead: null,   core: [0x00, 0x00, 0x00, 0x01, 0x00, 0xFF] },   // any lead byte
};

// Trusted per-map evidence (map 0x33 is the primary validated map).
const TRUSTED_MAPS = {
    0x33: {
        mapName: "Prehistoria - Strong Heart's Exterior",
        dataSnes: 0xadb50c,
        blobSize: 0x455,
        mapW: 20,
        mapH: 16,
        compressedSectionOffset: 0x2a,   // relative to blob start
        compressedSectionSize: 164,      // bytes (6-byte sub-header + 158-byte bitstream)
        sentinelOffset: 0xce,            // relative to blob start: 30 00 00 00 01 00 FF
        // Pass 1: 97 LE 16-bit words at 0x7FC300 after the SECOND decompressor invocation.
        // Source: Mesen2 memory viewer snapshot "0x7FC300_1" (bus-write breakpoint, trigger 2).
        // See tmp/map_research.md for raw bytes and derivation.
        // The FIRST invocation writes different data (observed in vertical-flow trace).
        // Algorithm producing these from the 158-byte bitstream: NOT RECONSTRUCTED.
        pass1Words: [
            0x0000, 0x0282, 0x0145, 0x0001, 0x0001, 0xFEBC, 0x0001, 0x012A,
            0x0001, 0x093D, 0x0001, 0xF58F, 0xFFF4, 0x0009, 0x0139, 0x0001,
            0x093B, 0x0001, 0xF58B, 0xFFFB, 0x0DD7, 0xFCC8, 0x0001, 0x0001,
            0xF69E, 0x0979, 0x0001, 0xFFE9, 0x0001, 0x0001, 0xFFD7, 0xFFF5,
            0xF5A3, 0x0001, 0x0A6A, 0x0001, 0x0001, 0xF58A, 0x0AA4, 0x000E,
            0xFFF8, 0x0011, 0xFFEC, 0x001C, 0xFFD8, 0x001B, 0x0006, 0xFFE9,
            0x0006, 0x0001, 0x0322, 0xFCF6, 0xFFEF, 0x0005, 0xFFF8, 0x0010,
            0x030F, 0xFCE5, 0xFFFD, 0x0011, 0xFFE4, 0xF375, 0x0001, 0x0004,
            0x0001, 0x0001, 0x0004, 0x0001, 0x0001, 0x0001, 0x0001, 0x0004,
            0x0001, 0x0001, 0x0001, 0x0001, 0x0004, 0x0001, 0x0001, 0x0001,
            0x0001, 0x0C7B, 0xF389, 0x0001, 0x0001, 0x0001, 0x0004, 0x0001,
            0x000A, 0x0001, 0xFFFB, 0x0001, 0x000A, 0x0C1C, 0xF3E1, 0x000B,
            0x0C35,
        ],
        // Pass 2: after applyDeltaDecode(pass1Words). These are the 97 tile macro IDs.
        // Source: Mesen2 memory viewer snapshot "0x7FC300_2" (no breakpoint needed).
        // Each macro ID resolves via EE table: EE:macroId*3 -> render script SNES pointer.
        pass2Words: [
            0x0000, 0x0282, 0x03C7, 0x03C8, 0x03C9, 0x0285, 0x0286, 0x03B0,
            0x03B1, 0x0CEE, 0x0CEF, 0x027E, 0x0272, 0x027B, 0x03B4, 0x03B5,
            0x0CF0, 0x0CF1, 0x027C, 0x0277, 0x104E, 0x0D16, 0x0D17, 0x0D18,
            0x03B6, 0x0D2F, 0x0D30, 0x0D19, 0x0D1A, 0x0D1B, 0x0CF2, 0x0CE7,
            0x028A, 0x028B, 0x0CF5, 0x0CF6, 0x0CF7, 0x0281, 0x0D25, 0x0D33,
            0x0D2B, 0x0D3C, 0x0D28, 0x0D44, 0x0D1C, 0x0D37, 0x0D3D, 0x0D26,
            0x0D2C, 0x0D2D, 0x104F, 0x0D45, 0x0D34, 0x0D39, 0x0D31, 0x0D41,
            0x1050, 0x0D35, 0x0D32, 0x0D43, 0x0D27, 0x009C, 0x009D, 0x00A1,
            0x00A2, 0x00A3, 0x00A7, 0x00A8, 0x00A9, 0x00AA, 0x00AB, 0x00AF,
            0x00B0, 0x00B1, 0x00B2, 0x00B3, 0x00B7, 0x00B8, 0x00B9, 0x00BA,
            0x00BB, 0x0D36, 0x00BF, 0x00C0, 0x00C1, 0x00C2, 0x00C6, 0x00C7,
            0x00D1, 0x00D2, 0x00CD, 0x00CE, 0x00D8, 0x0CF4, 0x00D5, 0x00E0,
            0x0D15,
        ],
    },
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function hex(value, width) {
    return (value >>> 0).toString(16).toUpperCase().padStart(width, '0');
}

function snesToRomOffset(snesAddr) {
    return (((snesAddr >>> 16) & 0x3f) * 0x10000) + (snesAddr & 0xffff);
}

function romToSnesHiRom(romOff) {
    const bank = ((romOff >>> 16) & 0x3f) | 0x80;
    return (bank << 16) | (romOff & 0xffff);
}

function readU8(buf, off)  { return buf[off]; }
function readU16LE(buf, off) { return buf[off] | (buf[off + 1] << 8); }
function readU24LE(buf, off) { return buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16); }

// ---------------------------------------------------------------------------
// Stage 1: Map blob pointer
// ---------------------------------------------------------------------------

/**
 * Returns the ROM offset of the map blob for mapId.
 * Map pointer table at ROM 0x1FFde7, 4 bytes per entry:
 *   bytes 0-2: SNES address (24-bit LE)
 *   byte  3:   flags/bank override
 */
function getMapBlobRom(romBuf, mapId) {
    const ptrOff = MAP_POINTER_TABLE_ROM + mapId * 4;
    const snesAddr = readU24LE(romBuf, ptrOff);
    return snesToRomOffset(snesAddr);
}

// ---------------------------------------------------------------------------
// Stage 2: Blob header (13 bytes, fully known)
// ---------------------------------------------------------------------------

/**
 * Parses the 13-byte map header at the blob start.
 * Evidence: MCP byte notes byte_000..byte_012 for map 0x33.
 */
function parseBlobHeader(romBuf, dataRom) {
    return {
        trigOffX:   readU8(romBuf, dataRom + 0x00),   // trigger grid X offset
        trigOffY:   readU8(romBuf, dataRom + 0x01),   // trigger grid Y offset
        mapW:       readU8(romBuf, dataRom + 0x02),   // map width in tiles
        mapH:       readU8(romBuf, dataRom + 0x03),   // map height in tiles
        displayCfg: readU8(romBuf, dataRom + 0x04),   // TM register preset
        subscreenCfg: readU8(romBuf, dataRom + 0x05),
        colorMathCfg: readU8(romBuf, dataRom + 0x06),
        colorWinCfg:  readU8(romBuf, dataRom + 0x07),
        unknown08:   readU8(romBuf, dataRom + 0x08),  // -> 0x7E241F
        unknown09:   readU16LE(romBuf, dataRom + 0x09), // 16-bit -> 0x7E0F84
        unknown0b:   readU16LE(romBuf, dataRom + 0x0b),
        stepLen:     readU16LE(romBuf, dataRom + 0x0d), // byte count of step-on table
    };
}

// ---------------------------------------------------------------------------
// Stage 3: Trigger tables (6-byte records)
// ---------------------------------------------------------------------------

/**
 * Parses the step-on trigger table and B-trigger table.
 * Each record is 6 bytes. Returns { stepOns, bTriggers, payloadStart }.
 */
function parseTriggerTables(romBuf, dataRom, header) {
    const stepOnBase = dataRom + 0x0f;
    const stepOnCount = header.stepLen / 6;
    const stepOns = [];
    for (let i = 0; i < stepOnCount; i++) {
        const off = stepOnBase + i * 6;
        stepOns.push({
            x: readU8(romBuf, off),
            y: readU8(romBuf, off + 1),
            scriptSnes: readU24LE(romBuf, off + 2),
            flags: readU8(romBuf, off + 5),
            _rom: off,
        });
    }

    const bLenOff = 0x0f + header.stepLen;
    const bLen = readU16LE(romBuf, dataRom + bLenOff);
    const bBase = dataRom + bLenOff + 2;
    const bCount = bLen / 6;
    const bTriggers = [];
    for (let i = 0; i < bCount; i++) {
        const off = bBase + i * 6;
        bTriggers.push({
            x: readU8(romBuf, off),
            y: readU8(romBuf, off + 1),
            scriptSnes: readU24LE(romBuf, off + 2),
            flags: readU8(romBuf, off + 5),
            _rom: off,
        });
    }

    const payloadStart = dataRom + bLenOff + 2 + bLen;
    return { stepOns, bTriggers, payloadStart };
}

// ---------------------------------------------------------------------------
// Stage 4: Tile family list
// ---------------------------------------------------------------------------

/**
 * Parses the tile family list at payloadStart.
 * Format: 1-byte count, then count*2-byte family IDs (16-bit LE).
 * Returns { count, families, compressStart }.
 */
function parseTileFamilies(romBuf, payloadStart) {
    const count = readU8(romBuf, payloadStart);
    const families = [];
    for (let i = 0; i < count; i++) {
        families.push(readU16LE(romBuf, payloadStart + 1 + i * 2));
    }
    const compressStart = payloadStart + 1 + count * 2;
    return { count, families, compressStart };
}

// ---------------------------------------------------------------------------
// Compressed section (between tile families and sentinel)
// ---------------------------------------------------------------------------

/**
 * Returns the raw bytes of the compressed section.
 * The algorithm that decompresses these bytes is NOT fully reverse-engineered.
 *
 * What is known (from trace evidence, map 0x33):
 *   - PC 8C988D sets up twin output buffers: 0x7FC300 and 0x7FA000.
 *   - PC 8C9909 (main loop) reads one byte from the compressed stream per iteration.
 *   - For each compressed byte, two output bytes are written: one to 0x7FC300+i,
 *     one to 0x7FA000+i (the mirror buffer).
 *   - 160 input bytes -> 97 output words (194 bytes) at 0x7FC300 (pass 1).
 *   - The first 4 bytes of the compressed section are a sub-header:
 *       bytes 0-1: compressed stream size or config
 *       bytes 2-3: decompression mode/parameters
 *   - The actual compressed data starts at byte 4 (first byte = 0xC2 for map 0x33).
 *   - Output is stored in TRUSTED_MAPS[mapId].pass1Words.
 *
 * Research gap: the bit-level decoding of the 160-byte stream is not modeled.
 * For map 0x33 the known pass1Words are embedded in TRUSTED_MAPS.
 */
function getCompressedBytes(romBuf, compressStart, sentinel) {
    const len = sentinel.romOffset - compressStart;
    return Buffer.from(romBuf.buffer || romBuf, compressStart, len);
}

// ---------------------------------------------------------------------------
// Stage 5: Sentinel scan
// ---------------------------------------------------------------------------

/**
 * Scans for a sentinel marker starting from compressStart.
 * Returns { type, romOffset, patternBytes } or null.
 *
 * Confirmed sentinel types for known maps:
 *   strict7: 0x33 Strong Heart Exterior  (lead=0x30, core=00 00 00 01 00 FF)
 *   short6:  0x34 Strong Heart Hut       (lead=0x80, core=00 00 01 00 FF)
 */
function findSentinel(romBuf, compressStart, blobEnd) {
    for (let off = compressStart; off < blobEnd - 5; off++) {
        for (const [type, { lead, core }] of Object.entries(SENTINEL_PATTERNS)) {
            if (lead !== null && romBuf[off] !== lead[0]) continue;
            const coreStart = lead !== null ? off + 1 : off;
            let match = true;
            for (let j = 0; j < core.length; j++) {
                if (romBuf[coreStart + j] !== core[j]) { match = false; break; }
            }
            if (!match) continue;
            const total = (lead !== null ? 1 : 0) + core.length;
            return {
                type,
                romOffset: off,
                patternBytes: Array.from(romBuf.slice(off, off + total)),
            };
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Stage 6: Position table + tilemap
// ---------------------------------------------------------------------------

/**
 * Parses the position table after the sentinel.
 * Format: 1-byte count, then count*2-byte position entries (16-bit LE each).
 * Returns { count, entries, tilemapStart }.
 */
function parsePositionTable(romBuf, postSentinel) {
    const count = readU8(romBuf, postSentinel);
    const entries = [];
    for (let i = 0; i < count; i++) {
        entries.push(readU16LE(romBuf, postSentinel + 1 + i * 2));
    }
    const tilemapStart = postSentinel + 1 + count * 2;
    return { count, entries, tilemapStart };
}

/**
 * Parses the nibble-packed tilemap into a 2D array [row][col].
 * Each byte encodes two 4-bit nibbles (lo nibble = left tile, hi nibble = right tile).
 *
 * family/variant encoding: PROVISIONAL - source is list-rooms.cpp via map_research.md.
 *   family  = nibble >> 2  (bits 3-2, values 0-3)
 *   variant = nibble & 0x3 (bits 1-0)
 * Caveat: map 0x33 has 6 tile families but only 4 family indices (0-3) are reachable
 * via nibble >> 2. The DECOMPRESSION-ANALYSIS-SUMMARY found 62.8% of nibble values
 * outside the 0-5 family range, suggesting this formula may be incomplete.
 * The raw nibble value is always stored; callers can reinterpret family/variant.
 */
function parseTilemap(romBuf, tilemapStart, mapW, mapH) {
    const rows = [];
    let off = tilemapStart;
    for (let row = 0; row < mapH; row++) {
        const cols = [];
        for (let col = 0; col < mapW; col += 2) {
            const byte = readU8(romBuf, off++);
            const lo = byte & 0x0f;
            const hi = (byte >>> 4) & 0x0f;
            cols.push({ nibble: lo, family: lo >> 2, variant: lo & 0x3 });
            if (col + 1 < mapW) {
                cols.push({ nibble: hi, family: hi >> 2, variant: hi & 0x3 });
            }
        }
        rows.push(cols);
    }
    return rows;
}

// ---------------------------------------------------------------------------
// Stage 7: Full blob parse (convenience wrapper)
// ---------------------------------------------------------------------------

/**
 * Parses all sections of a map blob. Returns a structured result.
 */
function parseMapBlob(romBuf, mapId) {
    const dataRom = getMapBlobRom(romBuf, mapId);
    const header = parseBlobHeader(romBuf, dataRom);
    const { stepOns, bTriggers, payloadStart } = parseTriggerTables(romBuf, dataRom, header);
    const { count: tileCount, families, compressStart } = parseTileFamilies(romBuf, payloadStart);

    // Blob end = start of the NEXT map blob (or approximation)
    const nextMapRom = getMapBlobRom(romBuf, mapId + 1);
    const blobEnd = nextMapRom;

    const sentinel = findSentinel(romBuf, compressStart, blobEnd);
    if (!sentinel) {
        return { dataRom, header, stepOns, bTriggers, tileCount, families, compressStart, sentinel: null };
    }

    const sentinelEnd = sentinel.romOffset + sentinel.patternBytes.length;
    const { count: posCount, entries: posEntries, tilemapStart } = parsePositionTable(romBuf, sentinelEnd);
    const tilemap = parseTilemap(romBuf, tilemapStart, header.mapW, header.mapH);

    const tilemapEnd = tilemapStart + Math.ceil((header.mapW * header.mapH) / 2);
    const remainingBytes = blobEnd - tilemapEnd;

    return {
        mapId,
        dataRom,
        dataSnes: romToSnesHiRom(dataRom),
        header,
        stepOns,
        bTriggers,
        tileCount,
        families,
        compressStart,
        sentinel,
        posCount,
        posEntries,
        tilemapStart,
        tilemap,
        tilemapEnd,
        remainingBytes,   // bytes after tilemap (second compressed section, algorithm unknown)
        blobEnd,
    };
}

// ---------------------------------------------------------------------------
// Stage 8: Delta decode (proven from trace evidence)
// ---------------------------------------------------------------------------

/**
 * Applies the delta (cumulative-sum) decode to pass-1 words.
 * Formula: out[0] = in[0]; out[i] = (out[i-1] + in[i]) & 0xFFFF.
 * Evidence: map_research.md section "0x7FC300_2 but endianess removed - delta calculations".
 */
function applyDeltaDecode(words) {
    if (words.length === 0) return [];
    const out = new Array(words.length);
    out[0] = words[0] & 0xffff;
    for (let i = 1; i < words.length; i++) {
        out[i] = (out[i - 1] + words[i]) & 0xffff;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Stage 9: EE descriptor lookup (proven from trace evidence)
// ---------------------------------------------------------------------------

/**
 * Resolves a tile macro ID to a render script SNES address via the EE table.
 * EE table: at SNES 0xEE0000, each entry is 3 bytes (24-bit LE SNES address).
 * Formula: tableSnes = 0xEE0000 + macroId * 3.
 */
function lookupEEDescriptor(romBuf, macroId) {
    const tableSnes = EE_TABLE_SNES + macroId * EE_TABLE_ENTRY_STRIDE;
    const tableRom  = snesToRomOffset(tableSnes);
    const targetSnes = readU24LE(romBuf, tableRom);
    const targetRom  = snesToRomOffset(targetSnes);
    return { macroId, tableSnes, tableRom, targetSnes, targetRom };
}

/**
 * Resolves all macro IDs in an array to EE descriptors.
 */
function resolveAllMacros(romBuf, macroIds) {
    return macroIds.map((id) => lookupEEDescriptor(romBuf, id));
}

// ---------------------------------------------------------------------------
// Stage 10: Render script 0x93 (proven from traces, docs/render-script-93.md)
// ---------------------------------------------------------------------------

/**
 * Parses the structure of an opcode 0x93 render command at scriptRom.
 *
 * Proven facts (all from trace evidence in render-script-93.md):
 *   - Opcode byte = 0x93
 *   - Low 7 bits (0x13) = relative byte offset to secondary payload
 *   - Byte +1 = header control byte (consumed by jump-table header loop)
 *   - Bytes +2 to +(relOffset-1) = header stream bytes
 *   - Secondary payload starts at scriptRom + relOffset
 *   - Decoder uses hardcoded counter LDX #$001F at PC 8CC9CD and 8CCAF6
 *     -> 2 phases * 32 iterations = 64 VRAM words output (one 16x16 4bpp tile)
 *   - Termination is counter-driven, NOT via a size field
 *   - Payload size is variable (compressed bitstream); ~114 bytes for map 0x33 macro 0x0282
 */
function parseRenderScript93(romBuf, scriptRom) {
    const opcode = readU8(romBuf, scriptRom);
    if (opcode !== 0x93) return null;

    const payloadRelOffset = opcode & 0x7f;   // = 0x13 for opcode 0x93
    const headerControl    = readU8(romBuf, scriptRom + 1);

    const headerBytes = [];
    for (let i = 1; i < payloadRelOffset; i++) {
        headerBytes.push(readU8(romBuf, scriptRom + i));
    }

    return {
        opcode,
        scriptRom,
        scriptSnes: romToSnesHiRom(scriptRom),
        payloadRelOffset,
        headerControl,
        headerBytes,
        payloadStart: scriptRom + payloadRelOffset,
        // Proven output dimensions
        vramWordsPerCommand: 64,
        phasesPerCommand: 2,
        iterationsPerPhase: 32,
        // Proven: termination is counter-driven, not size-field-driven
        terminationMode: 'counter',
    };
}

/**
 * Reads raw bytes of a render script payload for inspection.
 * previewLen: how many bytes to capture (payload is variable-length).
 */
function previewRenderScript(romBuf, scriptRom, previewLen = 32) {
    const info = parseRenderScript93(romBuf, scriptRom);
    if (!info) return null;
    const raw = Array.from(romBuf.slice(scriptRom, scriptRom + previewLen));
    return { ...info, rawPreview: raw };
}

// ---------------------------------------------------------------------------
// ROM loading helper
// ---------------------------------------------------------------------------

const ROM_CANDIDATES = [
    process.env.ROM,
    '/Users/v/Documents/GitHub/SoETilesViewer/SoEScriptDumper/Secret of Evermore (U) [!].smc',
    '/Users/v/Documents/GitHub/everscript/Secret of Evermore (U) [!].smc',
].filter(Boolean);

function loadRom(romPath) {
    const finalPath = romPath || ROM_CANDIDATES.find((p) => {
        try { return p && fs.existsSync(p); } catch { return false; }
    });
    if (!finalPath) return null;
    return fs.readFileSync(finalPath);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    // Constants
    MAP_POINTER_TABLE_ROM,
    EE_TABLE_SNES,
    SENTINEL_PATTERNS,
    TRUSTED_MAPS,

    // Utilities
    hex,
    snesToRomOffset,
    romToSnesHiRom,
    readU8,
    readU16LE,
    readU24LE,
    loadRom,

    // Pipeline stages
    getMapBlobRom,
    parseBlobHeader,
    parseTriggerTables,
    parseTileFamilies,
    getCompressedBytes,
    findSentinel,
    parsePositionTable,
    parseTilemap,
    parseMapBlob,
    applyDeltaDecode,
    lookupEEDescriptor,
    resolveAllMacros,
    parseRenderScript93,
    previewRenderScript,
};
