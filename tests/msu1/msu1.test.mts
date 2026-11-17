import test from 'node:test';
import assert from 'node:assert/strict';
import { MSU1_TRACKS, getMsu1Track } from '../../tools/msu1/tracks.ts';
import {
    buildMsu1Kernel,
    buildLoopTable,
    patchEvermoreMsu1,
    calculateSnesChecksum,
    stripCopierHeader
} from '../../tools/msu1/convert.mts';
import { createMsu1Header, packageMsu1Pcm } from '../../tools/msu1/render-pcm.mts';

test('MSU-1 Track Manifest', async (t) => {
    await t.test('covers all 70 Evermore tracks with contiguous 1-based indexing', () => {
        assert.equal(MSU1_TRACKS.length, 70);
        for (let i = 0; i < 70; i++) {
            const track = MSU1_TRACKS[i];
            assert.equal(track.songId, i);
            assert.equal(track.msuTrack, i + 1);
            assert.equal(track.pcmFileName, `track-${i + 1}.pcm`);
            assert.ok(track.name.length > 0);
        }
    });

    await t.test('correctly configures non-looping one-shot tracks', () => {
        const gameOver = getMsu1Track(0x17);
        assert.ok(gameOver);
        assert.equal(gameOver.name, 'Game Over');
        assert.equal(gameOver.loops, false);

        const fanfare = getMsu1Track(0x19);
        assert.ok(fanfare);
        assert.equal(fanfare.name, 'Victory Fanfare');
        assert.equal(fanfare.loops, false);

        const staffRoll = getMsu1Track(0x24);
        assert.ok(staffRoll);
        assert.equal(staffRoll.name, 'Staff Roll');
        assert.equal(staffRoll.loops, false);

        const thraxx = getMsu1Track(0x01);
        assert.ok(thraxx);
        assert.equal(thraxx.name, 'Battle with Thraxx');
        assert.equal(thraxx.loops, true);
    });
});

test('MSU-1 PCM Header Construction', async (t) => {
    await t.test('creates valid 8-byte MSU1 header with loop sample index', () => {
        const headerNoLoop = createMsu1Header(0);
        assert.equal(headerNoLoop.length, 8);
        assert.equal(headerNoLoop.toString('ascii', 0, 4), 'MSU1');
        assert.equal(headerNoLoop.readUInt32LE(4), 0);

        const loopSample = 44100 * 5; // 5 seconds in
        const headerWithLoop = createMsu1Header(loopSample);
        assert.equal(headerWithLoop.toString('ascii', 0, 4), 'MSU1');
        assert.equal(headerWithLoop.readUInt32LE(4), loopSample);
    });

    await t.test('packages raw PCM with MSU-1 header', () => {
        const rawPcm = Buffer.from([0x01, 0x02, 0x03, 0x04]);
        const packaged = packageMsu1Pcm(rawPcm, 100);
        assert.equal(packaged.length, 12);
        assert.equal(packaged.toString('ascii', 0, 4), 'MSU1');
        assert.equal(packaged.readUInt32LE(4), 100);
        assert.deepEqual(packaged.subarray(8), rawPcm);
    });
});

test('MSU-1 ROM Patching Engine', async (t) => {
    // Synthetic clean 3 MB ROM
    const fakeRom = new Uint8Array(3 * 1024 * 1024);
    fakeRom.fill(0xEA); // NOPs

    // Set minimal SNES header at $00:FFB0 (file offset 0x00FFB0)
    fakeRom[0x00FFD5] = 0x21; // FastROM HiROM
    fakeRom[0x00FFD7] = 0x0B; // 3.0 MB (24 Mbits)

    const patched = patchEvermoreMsu1(fakeRom);

    await t.test('expands ROM footprint to 4.0 MB HiROM', () => {
        assert.equal(patched.length, 4 * 1024 * 1024);
        assert.equal(patched[0x00FFD7], 0x0C); // 4.0 MB (32 Mbits)
    });

    await t.test('injects JML $FE6000 hook at $8C:828F', () => {
        const hookOffset = 0x0C828F;
        assert.equal(patched[hookOffset + 0], 0x5C); // JML
        assert.equal(patched[hookOffset + 1], 0x00);
        assert.equal(patched[hookOffset + 2], 0x60);
        assert.equal(patched[hookOffset + 3], 0xFE); // $FE:6000
        assert.equal(patched[hookOffset + 4], 0xEA); // NOP
    });

    await t.test('installs MSU-1 dispatcher at $FE:6000 with hardware check and fallback', () => {
        const kernelOffset = 0x3E6000;
        // Starts with REP #$30 and store to $0E4D and $7E0E44
        assert.equal(patched[kernelOffset + 0], 0xC2);
        assert.equal(patched[kernelOffset + 1], 0x30); // REP #$30
        assert.equal(patched[kernelOffset + 2], 0x8D); // STA $0E4D
        assert.equal(patched[kernelOffset + 3], 0x4D);
        assert.equal(patched[kernelOffset + 4], 0x0E);

        // Checks MSU-1 ID signature $002002..$002007 with fallback JML $8C8294
        assert.equal(patched[kernelOffset + 9], 0xAF);  // LDA $002002
        assert.equal(patched[kernelOffset + 10], 0x02);
        assert.equal(patched[kernelOffset + 11], 0x20);
        assert.equal(patched[kernelOffset + 12], 0x00);

        // First fallback JML at kernelOffset + 18 preceded by BEQ +4
        assert.equal(patched[kernelOffset + 16], 0xF0); // BEQ +4
        assert.equal(patched[kernelOffset + 17], 0x04);
        assert.equal(patched[kernelOffset + 18], 0x5C); // JML
        assert.equal(patched[kernelOffset + 19], 0x94);
        assert.equal(patched[kernelOffset + 20], 0x82);
        assert.equal(patched[kernelOffset + 21], 0x8C); // $8C:8294
    });

    await t.test('populates loop table at $FE:6100', () => {
        const loopTableOffset = 0x3E6100;
        assert.equal(patched[loopTableOffset + 0x00], 0x03); // Main Title -> loops
        assert.equal(patched[loopTableOffset + 0x01], 0x03); // Thraxx -> loops
        assert.equal(patched[loopTableOffset + 0x17], 0x01); // Game Over -> no loop
        assert.equal(patched[loopTableOffset + 0x19], 0x01); // Victory Fanfare -> no loop
        assert.equal(patched[loopTableOffset + 0x24], 0x01); // Staff Roll -> no loop
    });

    await t.test('computes valid SNES checksum and complement (sum + complement = 0xFFFF)', () => {
        const checksum = patched[0x00FFDE] | (patched[0x00FFDF] << 8);
        const complement = patched[0x00FFDC] | (patched[0x00FFDD] << 8);
        assert.equal((checksum + complement) & 0xFFFF, 0xFFFF);
    });
});
