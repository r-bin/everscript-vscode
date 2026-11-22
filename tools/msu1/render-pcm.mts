#!/usr/bin/env node
/**
 * MSU-1 Audio Track Packager (.pcm Generator)
 *
 * Wraps raw 44.1 kHz 16-bit stereo signed little-endian PCM audio (or 44.1kHz 16-bit stereo WAV)
 * with the standard 8-byte MSU-1 header:
 *   Bytes 0..3: ASCII "MSU1" (0x4D, 0x53, 0x55, 0x31)
 *   Bytes 4..7: 32-bit unsigned little-endian integer loop point in sample frames
 *               (File byte offset = 8 + loop_sample * 4). Non-looping tracks set this to 0.
 *
 * Usage:
 *   node tools/msu1/render-pcm.mts <input_pcm_or_wav> <output_track.pcm> [loop_sample_index]
 */

import * as fs from 'fs';
import * as path from 'path';

export function createMsu1Header(loopSampleIndex = 0): Buffer {
    const header = Buffer.alloc(8);
    // Signature "MSU1"
    header.write('MSU1', 0, 4, 'ascii');
    // Loop point (32-bit unsigned little-endian sample offset)
    header.writeUInt32LE(loopSampleIndex, 4);
    return header;
}

/**
 * Parses WAV header if present and extracts raw 16-bit 44.1kHz stereo PCM data.
 */
export function extractPcmFromWav(wavBuf: Buffer): { pcmData: Buffer; sampleRate: number; channels: number } {
    if (wavBuf.length >= 44 && wavBuf.toString('ascii', 0, 4) === 'RIFF' && wavBuf.toString('ascii', 8, 12) === 'WAVE') {
        const channels = wavBuf.readUInt16LE(22);
        const sampleRate = wavBuf.readUInt32LE(24);
        const bitsPerSample = wavBuf.readUInt16LE(34);

        // Find "data" chunk
        let offset = 12;
        while (offset + 8 <= wavBuf.length) {
            const chunkId = wavBuf.toString('ascii', offset, offset + 4);
            const chunkSize = wavBuf.readUInt32LE(offset + 4);
            if (chunkId === 'data') {
                const dataStart = offset + 8;
                return {
                    pcmData: wavBuf.subarray(dataStart, dataStart + chunkSize),
                    sampleRate,
                    channels
                };
            }
            offset += 8 + chunkSize;
        }
    }
    // Otherwise assume it's already raw PCM
    return { pcmData: wavBuf, sampleRate: 44100, channels: 2 };
}

export function packageMsu1Pcm(inputData: Buffer, loopSampleIndex = 0): Buffer {
    const { pcmData } = extractPcmFromWav(inputData);
    const header = createMsu1Header(loopSampleIndex);
    return Buffer.concat([header, pcmData]);
}

export function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: node tools/msu1/render-pcm.mts <input.wav|input.raw> <output.pcm> [loop_sample]');
        process.exit(1);
    }

    const inputPath = args[0];
    const outputPath = args[1];
    const loopSample = args[2] ? parseInt(args[2], 10) : 0;

    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    const inputBuf = fs.readFileSync(inputPath);
    const msuPcmBuf = packageMsu1Pcm(inputBuf, loopSample);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, msuPcmBuf);

    console.log(`Created MSU-1 track: ${outputPath}`);
    console.log(`  Size: ${msuPcmBuf.length} bytes`);
    console.log(`  Loop point: ${loopSample} samples (${loopSample === 0 ? 'no loop' : `offset 0x${(8 + loopSample * 4).toString(16)}`})`);
}

if (process.argv[1] && process.argv[1].endsWith('render-pcm.mts')) {
    main();
}

