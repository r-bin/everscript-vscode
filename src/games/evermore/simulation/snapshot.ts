// Ownership: starting a simulation from a moment of the real game — its WRAM
// and its script slots — instead of from one script and an unknown save. Pure.
//
// The slot layout, from the allocator $8C:CF18 and the dispatcher $8C:D096:
//   +0..+2 pc (24-bit)   +3 state (2 run, 4 sleep, 6/8/10/12 engine waits)
//   +5/+7 sleep deadline against the 32-bit timer $0B19
//   +0B caller's slot (0 for a thread's first script)   +0D owner entity
//   +0F.. ten argument words
// The run list at $7E2F28 (zero-terminated) gives the order.

import { c } from './sym';
import { Memory } from './memory';
import { PathState, Frame, Thread, SLOT_BASE } from './state';
import { START } from './time';

export interface GameMoment {
    /** WRAM bank $7E (at least 64 KB) at the start of a field tick, before the timer increments. */
    wram: Uint8Array;
    /** For slots waiting on the engine: the tick (from 0 = this moment) they run again, if known. */
    resumeAt?: (slot: number) => number | undefined;
}

export function pathFromMoment(m: GameMoment): PathState {
    const w = m.wram;
    const word = (a: number): number => w[a] | (w[a + 1] << 8);
    const s = new PathState(0, Memory.fromImage(w.subarray(0, 0x10000)), 'game');
    s.threads = [];
    for (let x = 0; ; x += 2) {
        const top = word(0x2f28 + x);
        if (!top) break;
        // Callee at the top of the list; walk +0B down to the thread's first script.
        const chain: number[] = [];
        for (let slot = top; slot && chain.length < 32; slot = word(slot + 0x0b)) chain.unshift(slot);
        const frames: Frame[] = chain.map((slot, i) => ({
            ret: i === 0 ? null : pcOf(w, slot),
            entry: pcOf(w, slot),
            args: new Map(Array.from({ length: 10 }, (_, k) => [2 * k, c(word(slot + 0x0f + 2 * k))] as [number, ReturnType<typeof c>])),
            name: `slot ${slot.toString(16)}`,
            slot,
            root: false,
            owner: c(word(slot + 0x0d)),
        }));
        // Frame k resumes in its caller at the caller's saved pc.
        for (let i = 1; i < frames.length; i++) frames[i].ret = pcOf(w, chain[i - 1]);
        frames[0].ret = null;
        const state = word(top + 3);
        const t: Thread = { uid: s.nextUid++, pc: pcOf(w, top), frames, stack: [], wait: { k: 'run' } };
        if (state === 4) {
            const deadline = word(top + 5) + word(top + 7) * 0x10000;
            const timer = word(0x0b19) + word(0x0b1b) * 0x10000;
            t.wait = { k: 'sleep', until: { ...START, off: Math.max(0, deadline - timer - 1) } };
        } else if (state !== 2) {
            const at = m.resumeAt?.(top);
            t.wait = at !== undefined
                ? { k: 'sleep', until: { ...START, off: at } }
                : { k: 'engine', event: s.clock.event(`engine wait of slot ${top.toString(16)} (state ${state})`, START, 0), what: `state ${state}` };
        }
        s.threads.push(t);
    }
    s.lastEntity = c(word(0x0341));
    return s;
}

function pcOf(w: Uint8Array, slot: number): number {
    return w[slot] | (w[slot + 1] << 8) | (w[slot + 2] << 16);
}

export { SLOT_BASE };
