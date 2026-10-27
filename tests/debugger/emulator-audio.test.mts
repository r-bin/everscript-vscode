// The emulator page's sound output (webview/page/02a-audio-out.js): frames of samples go into a ring, a
// 2048-sample block at a time comes out at 44.1 kHz. Frames and blocks run on two clocks; the ring must
// play without gaps when they disagree a little (a 59.94 Hz screen, a jittery frame loop), where the old
// direct read of the core's buffer ran short every few blocks. Synthetic clocks; no ROM, no core.
// Run: node tests/debugger/emulator-audio.test.mts
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const FILE = join(ROOT, 'src/core/emulator/webview/page/02a-audio-out.js');

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
    try { fn(); console.log('  ✓ ' + name); passed++; }
    catch (e) { console.error('  ✗ ' + name + '\n    ' + ((e as Error).stack || e)); failed++; }
}

interface Ring { w: number; r: number; priming: boolean }
interface Page {
    AUDIO_FREQ: number; AUDIO_BLOCK_SIZE: number; AUDIO_FRAME_SAMPLES: number; AUDIO_TARGET: number; AUDIO_MAX_SKEW: number;
    audioRing: Ring;
    audioRingNew(size: number): Ring;
    audioRingPush(ring: Ring, l: Float32Array, r: Float32Array, n: number): void;
    audioRingPull(ring: Ring, l: Float32Array, r: Float32Array, target: number, maxSkew: number): number;
    audioTakeFrame(m: unknown): void;
    HEAPF32: Float32Array;
}

function loadPage(): Page {
    const context = vm.createContext({ Math, Float32Array, HEAPF32: new Float32Array(0) });
    const exported = ['AUDIO_FREQ', 'AUDIO_BLOCK_SIZE', 'AUDIO_FRAME_SAMPLES', 'AUDIO_TARGET', 'AUDIO_MAX_SKEW', 'audioRing'];
    vm.runInContext(readFileSync(FILE, 'utf8') + '\nthis.consts = {' + exported.join(',') + '};', context);
    return Object.assign(context, context.consts) as unknown as Page;
}

const page = loadPage();
const BLOCK = page.AUDIO_BLOCK_SIZE;
const BLOCK_MS = BLOCK * 1000 / page.AUDIO_FREQ;

/** A deterministic pseudo-random number in [0, 1). */
function rng(seed: number) {
    return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/**
 * Plays `seconds` of frames at `fps` (each `jitterMs` late at most) against blocks pulled at 44.1 kHz,
 * through `pull(blockIndex)` after `push()`es. Counts the blocks that came up short after `warmupBlocks`.
 */
function play(fps: number, jitterMs: number, seconds: number, push: () => void, pull: () => number, warmupBlocks = 4) {
    const rand = rng(11);
    let frame = 0, block = 0, short = 0;
    const end = seconds * 1000;
    let nextFrame = 0;
    while (block * BLOCK_MS < end) {
        const blockAt = (block + 1) * BLOCK_MS;
        if (nextFrame <= blockAt) {
            push();
            frame++;
            nextFrame = frame * 1000 / fps + rand() * jitterMs;
            continue;
        }
        const got = pull();
        if (block >= warmupBlocks && got < BLOCK) short++;
        block++;
    }
    return { short, blocks: block };
}

/** The ring of the page, fed with a ramp so gaps and repeats would show. */
function ringPlayer() {
    const ring = page.audioRingNew(16384);
    const n = page.AUDIO_FRAME_SAMPLES;
    const L = new Float32Array(n), R = new Float32Array(n);
    const outL = new Float32Array(BLOCK), outR = new Float32Array(BLOCK);
    return {
        ring,
        push: () => page.audioRingPush(ring, L, R, n),
        pull: () => page.audioRingPull(ring, outL, outR, page.AUDIO_TARGET, page.AUDIO_MAX_SKEW),
    };
}

/** What the page did before: one block straight from the core's buffer, short when less is buffered (exports.c getSoundBuffer). */
function directPlayer() {
    let buffered = 0;
    return {
        push: () => { buffered += page.AUDIO_FRAME_SAMPLES; },
        pull: () => {
            const got = Math.min(buffered, BLOCK);
            buffered -= got;
            if (buffered > 6144) buffered = 2048;
            return got;
        },
    };
}

test('one frame of sound is 735 samples at 44.1 kHz (the core mixes SoundPlaybackRate / 60)', () => {
    assert.strictEqual(page.AUDIO_FRAME_SAMPLES, 735);
});

test('at 59.94 Hz the old direct read runs short every few blocks once its head start is gone; the ring does not', () => {
    const old = directPlayer();
    const before = play(59.94, 1, 60, old.push, old.pull);
    assert.ok(before.short > 60, `old: ${before.short} of ${before.blocks} blocks short`);
    const now = ringPlayer();
    assert.strictEqual(play(59.94, 1, 60, now.push, now.pull).short, 0);
});

for (const fps of [59.94, 60.1]) {
    test(`a ${fps} Hz frame loop plays two minutes without a gap (the rate stretch absorbs the drift)`, () => {
        const p = ringPlayer();
        const { short } = play(fps, 1, 120, p.push, p.pull);
        assert.strictEqual(short, 0);
        const fill = p.ring.w - p.ring.r;
        assert.ok(fill < 2 * page.AUDIO_TARGET, `the reserve (latency) does not grow: ${fill}`);
    });
}

test('a frame loop up to 30 ms late plays without a gap', () => {
    const p = ringPlayer();
    assert.strictEqual(play(60, 30, 60, p.push, p.pull).short, 0);
});

test('running dry fades out, then waits for a full reserve before playing again', () => {
    const ring = page.audioRingNew(16384);
    const src = new Float32Array(page.AUDIO_TARGET).fill(0.5);
    const outL = new Float32Array(BLOCK), outR = new Float32Array(BLOCK);
    page.audioRingPush(ring, src, src, page.AUDIO_TARGET);
    assert.strictEqual(page.audioRingPull(ring, outL, outR, page.AUDIO_TARGET, 0), BLOCK);
    const got = page.audioRingPull(ring, outL, outR, page.AUDIO_TARGET, 0);
    assert.ok(got < BLOCK && got > BLOCK - 10, `got ${got}`);
    assert.ok(outL[got] > 0 && outL[got] < 0.5, 'the first missing sample is faded, not cut');
    assert.ok(ring.priming);
    const edge = outL[BLOCK - 1];
    page.audioRingPush(ring, src, src, BLOCK);
    assert.strictEqual(page.audioRingPull(ring, outL, outR, page.AUDIO_TARGET, 0), 0, 'less than the reserve: silence');
    assert.ok(outL[0] > 0 && outL[0] < edge && outL[100] === 0, 'the fade-out goes on into the next block');
    page.audioRingPush(ring, src, src, BLOCK);
    assert.strictEqual(page.audioRingPull(ring, outL, outR, page.AUDIO_TARGET, 0), BLOCK);
});

test('fast forward overfills the ring: the oldest samples go, the reserve stays bounded', () => {
    const ring = page.audioRingNew(16384);
    const src = new Float32Array(735);
    for (let i = 0; i < 100; i++) page.audioRingPush(ring, src, src, 735);
    assert.strictEqual(ring.w - ring.r, 16383);
});

test('back from fast forward the sound is in time at once (v0.353.5 lagged ~280 ms for a minute)', () => {
    const p = ringPlayer();
    for (let i = 0; i < 100; i++) p.push();
    const outL = new Float32Array(BLOCK), outR = new Float32Array(BLOCK);
    assert.strictEqual(page.audioRingPull(p.ring, outL, outR, page.AUDIO_TARGET, page.AUDIO_MAX_SKEW), BLOCK);
    assert.ok(p.ring.w - p.ring.r <= page.AUDIO_TARGET, `reserve after one block: ${p.ring.w - p.ring.r}`);
    assert.strictEqual(play(60, 1, 20, p.push, p.pull, 0).short, 0, 'and plays on without a gap');
});

test('audioTakeFrame takes one frame from the fork core, and nothing from the vanilla core', () => {
    const heap = new Float32Array(8192);
    for (let i = 0; i < 2048; i++) { heap[1024 + i] = i; heap[1024 + 2048 + i] = -i; }
    page.HEAPF32 = heap;
    const before = page.audioRing.w;
    page.audioTakeFrame({ _getSoundBuffer: () => 1024 * 4, _takeInputPolled: () => 0 });
    assert.strictEqual(page.audioRing.w - before, 735);
    page.audioTakeFrame({ _getSoundBuffer: () => 1024 * 4 });
    assert.strictEqual(page.audioRing.w - before, 735);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
