#!/usr/bin/env node
'use strict';

/**
 * tools/map-dump.js  --  Unified map blob dump
 * Usage:  node tools/map-dump.js [mapId]
 *         node tools/map-dump.js 0x33
 *         ROM=/path/to/rom.smc node tools/map-dump.js 0x51
 *
 * Prints a full structured dump of a map blob, covering:
 *   1. Blob header
 *   2. Step-on trigger table
 *   3. B-trigger table
 *   4. Tile family list
 *   5. Compressed section (raw bytes + research notes)
 *   6. Sentinel marker
 *   7. Position table
 *   8. Tilemap (nibble grid + family grid)
 *   9. Remaining bytes (second section after tilemap)
 *  10. Delta decode sample (pass1 -> pass2 for first 16 words)
 *  11. EE descriptor sample (first 12 macro IDs -> render script addresses)
 *  12. Render script 0x93 structure for macro 0x0282 (if ROM has it)
 *
 * Model: memory_radar/models/map-pipeline-model.js
 * Dossier: docs/map-0x33-analysis.md
 */

const path = require('path');
const {
    loadRom, hex,
    snesToRomOffset, romToSnesHiRom,
    getMapBlobRom,
    parseBlobHeader,
    parseTriggerTables,
    parseTileFamilies,
    findSentinel,
    parsePositionTable,
    parseTilemap,
    applyDeltaDecode,
    lookupEEDescriptor,
    parseRenderScript93,
    previewRenderScript,
    TRUSTED_MAPS,
} = require('../memory_radar/models/map-pipeline-model');

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function banner(title) {
    const line = '-'.repeat(72);
    console.log(`\n${line}\n  ${title}\n${line}`);
}

function hexRow(bytes, base = 0, bytesPerRow = 16) {
    for (let i = 0; i < bytes.length; i += bytesPerRow) {
        const slice = bytes.slice(i, i + bytesPerRow);
        const addr = `  ${hex(base + i, 6)}:  `;
        const hexPart = Array.from(slice).map((b) => hex(b, 2)).join(' ').padEnd(bytesPerRow * 3 - 1);
        console.log(addr + hexPart);
    }
}

function wordsRow(words, base = 0, wordsPerRow = 8) {
    for (let i = 0; i < words.length; i += wordsPerRow) {
        const slice = words.slice(i, i + wordsPerRow);
        const idxPart = `[${String(i).padStart(3)}]  `;
        console.log('  ' + idxPart + slice.map((w) => hex(w, 4)).join(' '));
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    const arg = process.argv[2] || '0x33';
    const mapId = parseInt(arg, 16);
    if (isNaN(mapId)) {
        console.error(`Usage: node tools/map-dump.js <mapId hex>  (e.g. 0x33)`);
        process.exit(1);
    }

    const rom = loadRom();
    if (!rom) {
        console.error('ROM not found. Set ROM env var or place at default path.');
        console.error('  ROM=/path/to/rom.smc node tools/map-dump.js 0x' + hex(mapId, 2));
        process.exit(1);
    }

    console.log(`\nMap 0x${hex(mapId, 2)} dump  (${rom.length} byte ROM)`);
    console.log(`Model: memory_radar/models/map-pipeline-model.js`);

    const trusted = TRUSTED_MAPS[mapId];
    if (trusted) {
        console.log(`Trusted map: ${trusted.mapName}`);
    }

    // --- 1. Blob pointer ----------------------------------------------------
    const dataRom = getMapBlobRom(rom, mapId);
    const dataSnes = romToSnesHiRom(dataRom);
    banner(`1. BLOB POINTER`);
    console.log(`  ROM:  0x${hex(dataRom, 6)}`);
    console.log(`  SNES: 0x${hex(dataSnes, 6)}`);

    // --- 2. Header ----------------------------------------------------------
    const header = parseBlobHeader(rom, dataRom);
    banner(`2. HEADER (13 bytes at ROM 0x${hex(dataRom, 6)})`);
    console.log(`  trigOffX    = ${header.trigOffX}  (tile grid trigger X offset)`);
    console.log(`  trigOffY    = ${header.trigOffY}  (tile grid trigger Y offset)`);
    console.log(`  mapW        = ${header.mapW}  tiles`);
    console.log(`  mapH        = ${header.mapH}  tiles`);
    console.log(`  displayCfg  = 0x${hex(header.displayCfg, 2)}  (TM register preset)`);
    console.log(`  subscreenCfg= 0x${hex(header.subscreenCfg, 2)}`);
    console.log(`  colorMathCfg= 0x${hex(header.colorMathCfg, 2)}`);
    console.log(`  colorWinCfg = 0x${hex(header.colorWinCfg, 2)}`);
    console.log(`  unknown08   = 0x${hex(header.unknown08, 2)}  (-> 0x7E241F)`);
    console.log(`  unknown09   = 0x${hex(header.unknown09, 4)}  (16-bit -> 0x7E0F84)`);
    console.log(`  unknown0b   = 0x${hex(header.unknown0b, 4)}`);
    console.log(`  stepLen     = ${header.stepLen}  (step-on table bytes)`);

    // --- 3. Step-on triggers ------------------------------------------------
    const { stepOns, bTriggers, payloadStart } = parseTriggerTables(rom, dataRom, header);
    banner(`3. STEP-ON TRIGGERS (${stepOns.length} entries)`);
    if (stepOns.length === 0) {
        console.log('  (none)');
    } else {
        stepOns.forEach((t, i) => {
            console.log(`  [${i}] x=${t.x} y=${t.y} script=SNES:0x${hex(t.scriptSnes, 6)} flags=0x${hex(t.flags, 2)}`);
        });
    }

    banner(`4. B-TRIGGERS (${bTriggers.length} entries)`);
    if (bTriggers.length === 0) {
        console.log('  (none)');
    } else {
        bTriggers.forEach((t, i) => {
            console.log(`  [${i}] x=${t.x} y=${t.y} script=SNES:0x${hex(t.scriptSnes, 6)} flags=0x${hex(t.flags, 2)}`);
        });
    }

    // --- 4. Tile families --------------------------------------------------
    const { count: tileCount, families, compressStart } = parseTileFamilies(rom, payloadStart);
    banner(`5. TILE FAMILY LIST (${tileCount} entries at ROM 0x${hex(payloadStart, 6)})`);
    families.forEach((fid, i) => {
        console.log(`  slot[${i}] = 0x${hex(fid, 4)}  (EE table index -> render descriptor)`);
    });
    console.log(`  Compressed section starts at ROM 0x${hex(compressStart, 6)}`);

    // --- 5. Compressed section (raw) ---------------------------------------
    // Find sentinel first so we know the section boundary
    const nextMapRom = getMapBlobRom(rom, mapId + 1);
    const sentinel = findSentinel(rom, compressStart, nextMapRom);

    const compressEnd = sentinel ? sentinel.romOffset : nextMapRom;
    const compressLen = compressEnd - compressStart;

    banner(`6. COMPRESSED SECTION (${compressLen} bytes at ROM 0x${hex(compressStart, 6)})`);
    console.log(`  Sub-header (6 bytes): ${Array.from(rom.slice(compressStart, compressStart + 6)).map((b) => hex(b, 2)).join(' ')}`);
    console.log(`    [+0x00] 0x${hex(rom[compressStart], 2)}         = unused`);
    console.log(`    [+0x01] 0x${hex(rom[compressStart+1], 2)}         = section size in bytes (0xA4=164 for map 0x33)`);
    console.log(`    [+0x02] 0x${hex(rom[compressStart+2], 2)}         = unused`);
    console.log(`    [+0x03] 0x${hex(rom[compressStart+3], 2)}         = decompression mode/setup (read by PC 8C9890)`);
    console.log(`    [+0x04] 0x${hex(rom[compressStart+4], 2)}         = initial decoder state (read ~49x by PC 8C9898)`);
    console.log(`    [+0x05] 0x${hex(rom[compressStart+5], 2)}         = unused`);
    console.log(`  Bitstream: ${compressLen - 6} bytes starting at ROM 0x${hex(compressStart + 6, 6)}`);
    console.log(`  NOTE: Decompression algorithm NOT fully reverse-engineered.`);
    console.log(`        PC 8C9909 reads bitstream -> writes to 0x7FC300 + 0x7FA000 in parallel.`);
    console.log(`        Decompressor called TWICE per map. Pass1 data is from 2nd invocation.`);
    console.log(`        See tmp/map_research.md for Mesen2 snapshots and research notes.`);
    console.log(`  Raw bytes:`);
    hexRow(rom.slice(compressStart, compressEnd), compressStart);

    if (trusted && trusted.pass1Words) {
        console.log(`\n  TRUSTED pass1 words at 0x7FC300 (${trusted.pass1Words.length} words)`);
        console.log(`  Source: Mesen2 memory snapshot "0x7FC300_1" from 2nd invocation (tmp/map_research.md).`);
        console.log(`  These are delta-encoded; apply applyDeltaDecode to get tile macro IDs.`);
        wordsRow(trusted.pass1Words);
    }

    // --- 6. Sentinel -------------------------------------------------------
    if (!sentinel) {
        console.log(`\n  WARNING: Sentinel not found between 0x${hex(compressStart, 6)} and 0x${hex(nextMapRom, 6)}`);
        return;
    }

    banner(`7. SENTINEL (type="${sentinel.type}" at ROM 0x${hex(sentinel.romOffset, 6)})`);
    console.log(`  Bytes: ${sentinel.patternBytes.map((b) => hex(b, 2)).join(' ')}`);

    // --- 7. Position table -------------------------------------------------
    const sentinelEnd = sentinel.romOffset + sentinel.patternBytes.length;
    const { count: posCount, entries: posEntries, tilemapStart } = parsePositionTable(rom, sentinelEnd);
    banner(`8. POSITION TABLE (${posCount} entries at ROM 0x${hex(sentinelEnd, 6)})`);
    if (posCount === 0) {
        console.log('  (empty)');
    } else {
        posEntries.forEach((e, i) => console.log(`  [${i}] = 0x${hex(e, 4)}`));
    }
    console.log(`  Tilemap starts at ROM 0x${hex(tilemapStart, 6)}`);

    // --- 8. Tilemap (nibble grid) ------------------------------------------
    const tilemap = parseTilemap(rom, tilemapStart, header.mapW, header.mapH);
    const tilemapEnd = tilemapStart + Math.ceil((header.mapW * header.mapH) / 2);

    banner(`9. TILEMAP (${header.mapW}x${header.mapH} tiles, nibble-packed, ROM 0x${hex(tilemapStart, 6)})`);
    console.log(`  Each nibble (0-15) encodes one tile. family/variant formula is PROVISIONAL:`);
    console.log(`    family  = nibble >> 2  (values 0-3; source: list-rooms.cpp via map_research.md)`);
    console.log(`    variant = nibble & 0x3 (values 0-3)`);
    console.log(`  Note: map 0x33 has 6 families but formula gives only 4 indices (0-3).`);
    console.log(`        62.8% of nibbles are out-of-range; full formula may need more context.`);
    console.log(`  Family grid (family index only):`);
    tilemap.forEach((row, r) => {
        const line = row.map((c) => String(c.family)).join(' ');
        console.log(`  row ${String(r).padStart(2)}: ${line}`);
    });
    console.log(`  Nibble grid (full nibble value):`);
    tilemap.forEach((row, r) => {
        const line = row.map((c) => hex(c.nibble, 1)).join('');
        console.log(`  row ${String(r).padStart(2)}: ${line}`);
    });

    // Family usage stats
    const familyCount = new Map();
    tilemap.flat().forEach(({ family }) => {
        familyCount.set(family, (familyCount.get(family) || 0) + 1);
    });
    console.log(`  Family usage:`);
    familyCount.forEach((cnt, fam) => {
        const id = families[fam] !== undefined ? `0x${hex(families[fam], 4)}` : '(out of range)';
        console.log(`    family[${fam}] -> tile ${id}  used ${cnt} tiles`);
    });

    // --- 9. Remaining bytes (second section) --------------------------------
    const remainingLen = nextMapRom - tilemapEnd;
    if (remainingLen > 0) {
        banner(`10. REMAINING BYTES (${remainingLen} bytes at ROM 0x${hex(tilemapEnd, 6)})`);
        console.log(`  NOTE: This section is NOT fully understood.`);
        console.log(`        It likely contains additional compressed map data`);
        console.log(`        (the section that produces the final 0x7FC300 tile macro IDs).`);
        console.log(`        Algorithm: NOT REVERSE-ENGINEERED.`);
        console.log(`  First 64 bytes:`);
        hexRow(rom.slice(tilemapEnd, Math.min(tilemapEnd + 64, nextMapRom)), tilemapEnd);
    }

    // --- 10. Delta decode sample -------------------------------------------
    if (trusted && trusted.pass1Words) {
        const pass2 = applyDeltaDecode(trusted.pass1Words);

        // Verify against trusted pass2
        let mismatch = 0;
        if (trusted.pass2Words) {
            for (let i = 0; i < Math.min(pass2.length, trusted.pass2Words.length); i++) {
                if (pass2[i] !== trusted.pass2Words[i]) mismatch++;
            }
        }

        banner(`11. DELTA DECODE (pass1 -> pass2)  ${mismatch === 0 ? '[OK vs trusted]' : `[${mismatch} MISMATCHES vs trusted]`}`);
        console.log(`  Formula: out[0]=in[0]; out[i]=(out[i-1]+in[i]) & 0xFFFF`);
        console.log(`  First 16 words (pass1 -> pass2):`);
        for (let i = 0; i < Math.min(16, pass2.length); i++) {
            const p1 = hex(trusted.pass1Words[i], 4);
            const p2 = hex(pass2[i], 4);
            const check = (trusted.pass2Words && trusted.pass2Words[i] !== undefined)
                ? (pass2[i] === trusted.pass2Words[i] ? ' [OK]' : ` [MISMATCH: expected ${hex(trusted.pass2Words[i], 4)}]`)
                : '';
            console.log(`  [${String(i).padStart(2)}]  pass1=${p1}  ->  pass2=${p2}${check}`);
        }
    }

    // --- 11. EE descriptor sample ------------------------------------------
    if (trusted && trusted.pass2Words) {
        banner(`12. EE DESCRIPTOR SAMPLE (macro IDs -> render script pointers)`);
        console.log(`  Formula: tableSnes = 0xEE0000 + macroId * 3  ->  3-byte LE SNES target`);
        const sampleCount = Math.min(12, trusted.pass2Words.length);
        for (let i = 0; i < sampleCount; i++) {
            const macroId = trusted.pass2Words[i];
            try {
                const desc = lookupEEDescriptor(rom, macroId);
                console.log(`  [${String(i).padStart(2)}] macro=0x${hex(macroId, 4)}  tableAt=EE:${hex(macroId * 3, 6)}  -> SNES:0x${hex(desc.targetSnes, 6)}`);
            } catch (e) {
                console.log(`  [${String(i).padStart(2)}] macro=0x${hex(macroId, 4)}  -> ERROR: ${e.message}`);
            }
        }
    }

    // --- 12. Render script 0x93 sample for macro 0x0282 --------------------
    if (trusted && trusted.pass2Words && trusted.pass2Words.includes(0x0282)) {
        const macroId = 0x0282;
        try {
            const desc = lookupEEDescriptor(rom, macroId);
            const scriptInfo = previewRenderScript(rom, desc.targetRom, 32);
            if (scriptInfo) {
                banner(`13. RENDER SCRIPT 0x93 (macro 0x${hex(macroId, 4)} at SNES:0x${hex(desc.targetSnes, 6)})`);
                console.log(`  Opcode:          0x${hex(scriptInfo.opcode, 2)}`);
                console.log(`  Payload offset:  +0x${hex(scriptInfo.payloadRelOffset, 2)} (low 7 bits of opcode)`);
                console.log(`  Header control:  0x${hex(scriptInfo.headerControl, 2)} (byte +1)`);
                console.log(`  Header bytes:    ${scriptInfo.headerBytes.map((b) => hex(b, 2)).join(' ')}`);
                console.log(`  Payload start:   ROM 0x${hex(scriptInfo.payloadStart, 6)}`);
                console.log(`  Output:          ${scriptInfo.vramWordsPerCommand} VRAM words`);
                console.log(`                   (${scriptInfo.phasesPerCommand} phases x ${scriptInfo.iterationsPerPhase} = ${scriptInfo.vramWordsPerCommand})`);
                console.log(`  Termination:     counter-driven (LDX #$001F at PC 8CC9CD, hardcoded)`);
                console.log(`  First 32 bytes:  ${scriptInfo.rawPreview.map((b) => hex(b, 2)).join(' ')}`);
            }
        } catch (e) {
            console.log(`  render script sample: ${e.message}`);
        }
    }

    // --- Summary ------------------------------------------------------------
    banner(`SUMMARY`);
    console.log(`  Map 0x${hex(mapId, 2)}  ${trusted ? trusted.mapName : ''}`);
    console.log(`  Blob: ROM 0x${hex(dataRom, 6)}  size 0x${hex(nextMapRom - dataRom, 3)}`);
    console.log(`  ${header.mapW}x${header.mapH} tiles  ${tileCount} tile families`);
    console.log(`  ${stepOns.length} step-on triggers  ${bTriggers.length} B-triggers`);
    console.log(`  Sentinel: ${sentinel ? sentinel.type : 'NOT FOUND'} at ROM 0x${sentinel ? hex(sentinel.romOffset, 6) : '------'}`);
    if (trusted && trusted.pass1Words) {
        console.log(`  pass1 words: ${trusted.pass1Words.length} (trusted trace capture)`);
        const pass2 = applyDeltaDecode(trusted.pass1Words);
        const mismatch = trusted.pass2Words
            ? pass2.filter((w, i) => trusted.pass2Words[i] !== undefined && w !== trusted.pass2Words[i]).length
            : -1;
        console.log(`  delta decode: ${mismatch === 0 ? 'VERIFIED' : mismatch < 0 ? 'no reference' : `${mismatch} mismatches`}`);
    }
    console.log('');
}

main();
