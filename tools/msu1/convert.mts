#!/usr/bin/env node
/**
 * Secret of Evermore MSU-1 ROM Builder & Patcher
 *
 * Expands clean 3.0 MB Evermore ROM to 4.0 MB FastROM HiROM,
 * installs the MSU-1 streaming audio hook and fallback kernel at $FE:6000,
 * configures the track looping table, updates the SNES header to 4 MB (32 Mbits),
 * and computes valid SNES checksum and complement.
 *
 * Usage:
 *   node tools/msu1/convert.mts [input_rom] [output_rom]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { MSU1_TRACKS } from './tracks.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO = path.resolve(__dirname, '..', '..');
const DEFAULT_OUT = path.join(REPO, 'out', 'soe-msu1.sfc');

const ROM_SIZE_4MB = 4 * 1024 * 1024; // 4,194,304 bytes

// ROM Offsets
const HEADER_OFFSET = 0x00FFB0;
const ROM_SIZE_OFFSET = 0x00FFD7;
const COMPLEMENT_OFFSET = 0x00FFDC;
const CHECKSUM_OFFSET = 0x00FFDE;

// Hook target: play_music_track in Bank $8C (ROM offset 0x0C828F)
const HOOK_OFFSET = 0x0C828F;

// Kernel target: Bank $FE ($FE:6000 -> ROM offset 0x3E6000)
const KERNEL_OFFSET = 0x3E6000;
const LOOP_TABLE_OFFSET = 0x3E6100;

export interface PatchResult {
    success: boolean;
    inputPath: string;
    outputPath: string;
    inputSize: number;
    outputSize: number;
    checksum: number;
    complement: number;
}

export function stripCopierHeader(buf: Buffer): Buffer {
    return buf.length % 1024 === 512 ? buf.subarray(512) : buf;
}

/**
 * Builds the 65816 machine code payload for the MSU-1 dispatcher at $FE:6000.
 */
export function buildMsu1Kernel(): Uint8Array {
    interface Op {
        label?: string;
        bytes: number[];
        branchTo?: string;
    }

    const ops: Op[] = [
        { label: 'msu1_music_dispatcher', bytes: [0xC2, 0x30] },             // REP #$30
        { bytes: [0x8D, 0x4D, 0x0E] },                                       // STA $0E4D (ACTIVE_MUSIC_TRACK_ID)
        { bytes: [0x8F, 0x44, 0x0E, 0x7E] },                                 // STA $7E0E44 (ACTIVE_BGM_TRACK)

        // 1. Hardware ID Check ($002002..$002007 == "S-MSU1")
        { bytes: [0xAF, 0x02, 0x20, 0x00] },                                 // LDA $002002
        { bytes: [0xC9, 0x53, 0x2D] },                                       // CMP #$2D53 ('S' | '-'<<8)
        { bytes: [0xF0, 0x04] },                                             // BEQ .id0_ok (+4 skip JML)
        { bytes: [0x5C, 0x94, 0x82, 0x8C] },                                 // JML $8C8294 (fallback vanilla)

        { bytes: [0xAF, 0x04, 0x20, 0x00] },                                 // LDA $002004
        { bytes: [0xC9, 0x4D, 0x53] },                                       // CMP #$534D ('M' | 'S'<<8)
        { bytes: [0xF0, 0x04] },                                             // BEQ .id1_ok (+4 skip JML)
        { bytes: [0x5C, 0x94, 0x82, 0x8C] },                                 // JML $8C8294 (fallback vanilla)

        { bytes: [0xAF, 0x06, 0x20, 0x00] },                                 // LDA $002006
        { bytes: [0xC9, 0x55, 0x31] },                                       // CMP #$3155 ('U' | '1'<<8)
        { bytes: [0xF0, 0x04] },                                             // BEQ .id2_ok (+4 skip JML)
        { bytes: [0x5C, 0x94, 0x82, 0x8C] },                                 // JML $8C8294 (fallback vanilla)

        // 2. Track bounds / Stop check
        { bytes: [0xAD, 0x4D, 0x0E] },                                       // LDA $0E4D
        { bytes: [0x30], branchTo: 'stop_playback' },                        // BMI stop_playback
        { bytes: [0xC9, 0x46, 0x00] },                                       // CMP #$0046 (70 tracks $00..$45)
        { bytes: [0xB0], branchTo: 'stop_playback' },                        // BCS stop_playback

        // 3. Stop currently playing MSU-1 track
        { bytes: [0xE2, 0x20] },                                             // SEP #$20 (8-bit A)
        { bytes: [0x9F, 0x07, 0x20, 0x00] },                                 // STZ $002007

        // 4. Select MSU-1 track (1-based: track = song_id + 1)
        { bytes: [0xC2, 0x20] },                                             // REP #$20 (16-bit A)
        { bytes: [0xAD, 0x4D, 0x0E] },                                       // LDA $0E4D
        { bytes: [0x1A] },                                                   // INC A
        { bytes: [0xE2, 0x20] },                                             // SEP #$20 (8-bit A)
        { bytes: [0x8F, 0x04, 0x20, 0x00] },                                 // STA $002004 (track low byte)
        { bytes: [0xEB] },                                                   // XBA
        { bytes: [0x8F, 0x05, 0x20, 0x00] },                                 // STA $002005 (track high byte - triggers seek)

        // 5. Wait for MSU-1 audio controller to clear busy (Bit 6)
        { label: 'wait_busy', bytes: [0xAF, 0x00, 0x20, 0x00] },             // LDA $002000
        { bytes: [0x29, 0x40] },                                             // AND #$40
        { bytes: [0xD0], branchTo: 'wait_busy' },                            // BNE wait_busy

        // 6. Verify if track is present (Bit 3)
        { bytes: [0xAF, 0x00, 0x20, 0x00] },                                 // LDA $002000
        { bytes: [0x29, 0x08] },                                             // AND #$08
        { bytes: [0xF0, 0x04] },                                             // BEQ .track_ok (+4 skip JML)
        { bytes: [0x5C, 0x94, 0x82, 0x8C] },                                 // JML $8C8294 (missing track fallback)

        // 7. Track is present: silence SPC700 background music
        { bytes: [0xC2, 0x20] },                                             // REP #$20 (16-bit A)
        { bytes: [0xA9, 0x1A, 0x00] },                                       // LDA #$001A (APU cmd $1A: silence)
        { bytes: [0xA0, 0x00, 0x00] },                                       // LDY #$0000
        { bytes: [0x22, 0xFD, 0x81, 0x8C] },                                 // JSL $8C81FD (apu_command_handshake)

        // 8. Set maximum MSU-1 playback volume ($FF)
        { bytes: [0xE2, 0x20] },                                             // SEP #$20 (8-bit A)
        { bytes: [0xA9, 0xFF] },                                             // LDA #$FF
        { bytes: [0x8F, 0x06, 0x20, 0x00] },                                 // STA $002006 (MSU-1 volume)

        // 9. Determine if track loops from ROM table at $FE:6100
        { bytes: [0xC2, 0x20] },                                             // REP #$20
        { bytes: [0xAD, 0x4D, 0x0E] },                                       // LDA $0E4D
        { bytes: [0x29, 0x7F, 0x00] },                                       // AND #$007F
        { bytes: [0xAA] },                                                   // TAX
        { bytes: [0xE2, 0x20] },                                             // SEP #$20
        { bytes: [0xBF, 0x00, 0x61, 0xFE] },                                 // LDA.l $FE6100,X
        { bytes: [0x8F, 0x07, 0x20, 0x00] },                                 // STA $002007 (Start MSU-1 playback!)

        // Track is streaming. Return to caller:
        { bytes: [0xC2, 0x30] },                                             // REP #$30
        { bytes: [0x6B] },                                                   // RTL

        // stop_playback:
        { label: 'stop_playback', bytes: [0xE2, 0x20] },                     // SEP #$20
        { bytes: [0x9F, 0x07, 0x20, 0x00] },                                 // STZ $002007 (stop MSU-1)
        { bytes: [0xC2, 0x20] },                                             // REP #$20
        { bytes: [0xA9, 0x1A, 0x00] },                                       // LDA #$001A
        { bytes: [0xA0, 0x00, 0x00] },                                       // LDY #$0000
        { bytes: [0x22, 0xFD, 0x81, 0x8C] },                                 // JSL $8C81FD
        { bytes: [0xC2, 0x30] },                                             // REP #$30
        { bytes: [0x6B] }                                                    // RTL
    ];

    // Pass 1: Resolve label offsets
    const labels: Record<string, number> = {};
    let offset = 0;
    for (const op of ops) {
        if (op.label) labels[op.label] = offset;
        offset += op.bytes.length + (op.branchTo ? 1 : 0);
    }

    // Pass 2: Emit bytecode with resolved branches
    const out: number[] = [];
    offset = 0;
    for (const op of ops) {
        out.push(...op.bytes);
        offset += op.bytes.length;
        if (op.branchTo) {
            const target = labels[op.branchTo];
            if (target === undefined) throw new Error(`Missing branch target: ${op.branchTo}`);
            const rel = target - (offset + 1);
            if (rel < -128 || rel > 127) throw new Error(`Branch out of 8-bit range: ${rel}`);
            out.push((rel < 0 ? rel + 256 : rel) & 0xFF);
            offset += 1;
        }
    }

    return new Uint8Array(out);
}

/**
 * Builds the 70-byte track loop configuration table.
 * $03 = Play + Repeat (looping)
 * $01 = Play once (non-looping)
 */
export function buildLoopTable(): Uint8Array {
    const table = new Uint8Array(70);
    for (const t of MSU1_TRACKS) {
        if (t.songId >= 0 && t.songId < 70) {
            table[t.songId] = t.loops ? 0x03 : 0x01;
        }
    }
    return table;
}

/**
 * Calculates standard SNES 16-bit checksum and complement.
 */
export function calculateSnesChecksum(rom: Uint8Array): { checksum: number; complement: number } {
    let sum = 0;
    // Clear checksum and complement locations before summing
    const copy = new Uint8Array(rom);
    copy[COMPLEMENT_OFFSET] = 0xFF;
    copy[COMPLEMENT_OFFSET + 1] = 0xFF;
    copy[CHECKSUM_OFFSET] = 0x00;
    copy[CHECKSUM_OFFSET + 1] = 0x00;

    for (let i = 0; i < copy.length; i++) {
        sum = (sum + copy[i]) & 0xFFFF;
    }

    const complement = (sum ^ 0xFFFF) & 0xFFFF;
    return { checksum: sum, complement };
}

/**
 * Applies the MSU-1 patch to an in-memory Evermore ROM image.
 */
export function patchEvermoreMsu1(sourceRom: Uint8Array): Uint8Array {
    const cleanRom = stripCopierHeader(Buffer.from(sourceRom));

    // Allocate 4 MB ROM buffer (filled with 0xFF)
    const outRom = new Uint8Array(ROM_SIZE_4MB);
    outRom.fill(0xFF);

    // Copy original 3 MB image
    outRom.set(cleanRom.subarray(0, Math.min(cleanRom.length, ROM_SIZE_4MB)));

    // 1. Hook $8C:828F: JML $FE6000 + NOP
    // 5C 00 60 FE EA
    outRom[HOOK_OFFSET + 0] = 0x5C;
    outRom[HOOK_OFFSET + 1] = 0x00;
    outRom[HOOK_OFFSET + 2] = 0x60;
    outRom[HOOK_OFFSET + 3] = 0xFE;
    outRom[HOOK_OFFSET + 4] = 0xEA;

    // 2. Write MSU-1 kernel to $FE:6000 (File offset 0x3E6000)
    const kernel = buildMsu1Kernel();
    outRom.set(kernel, KERNEL_OFFSET);

    // 3. Write track loop table to $FE:6100 (File offset 0x3E6100)
    const loopTable = buildLoopTable();
    outRom.set(loopTable, LOOP_TABLE_OFFSET);

    // 4. Update SNES header: 4.0 MB (32 Mbits) -> ROM size byte = 0x0C
    outRom[ROM_SIZE_OFFSET] = 0x0C;

    // 5. Compute and update SNES checksum
    const { checksum, complement } = calculateSnesChecksum(outRom);
    outRom[COMPLEMENT_OFFSET] = complement & 0xFF;
    outRom[COMPLEMENT_OFFSET + 1] = (complement >> 8) & 0xFF;
    outRom[CHECKSUM_OFFSET] = checksum & 0xFF;
    outRom[CHECKSUM_OFFSET + 1] = (checksum >> 8) & 0xFF;

    return outRom;
}

/**
 * CLI Entrypoint
 */
export function main() {
    const args = process.argv.slice(2);
    let inputRomPath = args[0];
    const outputRomPath = args[1] || DEFAULT_OUT;

    if (!inputRomPath) {
        // Check for workspace default clean ROM
        const defaultCandidate = path.join(REPO, 'Secret of Evermore (U) [!].smc');
        if (fs.existsSync(defaultCandidate)) {
            inputRomPath = defaultCandidate;
        } else {
            console.error('Usage: node tools/msu1/convert.mts <input_rom.sfc> [output_rom.sfc]');
            process.exit(1);
        }
    }

    if (!fs.existsSync(inputRomPath)) {
        console.error(`Input ROM not found: ${inputRomPath}`);
        process.exit(1);
    }

    console.log(`Reading input ROM: ${inputRomPath}`);
    const inputBuf = fs.readFileSync(inputRomPath);
    console.log(`Input size: ${inputBuf.length} bytes`);

    const patchedRom = patchEvermoreMsu1(inputBuf);

    fs.mkdirSync(path.dirname(outputRomPath), { recursive: true });
    fs.writeFileSync(outputRomPath, patchedRom);

    const { checksum, complement } = calculateSnesChecksum(patchedRom);
    console.log(`\nSuccessfully created MSU-1 ROM: ${outputRomPath}`);
    console.log(`  Size: ${patchedRom.length} bytes (4.0 MB FastROM HiROM)`);
    console.log(`  SNES Checksum: $${checksum.toString(16).toUpperCase().padStart(4, '0')}`);
    console.log(`  Complement:    $${complement.toString(16).toUpperCase().padStart(4, '0')}`);
    console.log(`  Hook:          $8C:828F -> JML $FE:6000`);
    console.log(`  Kernel:        $FE:6000 (File 0x3E6000)`);
    console.log(`  Loop Table:    $FE:6100 (70 tracks configured)`);
}

if (process.argv[1] && process.argv[1].endsWith('convert.mts')) {
    main();
}
