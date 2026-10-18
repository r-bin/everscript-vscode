// Ownership: the shapes a simulated path is made of — a thread and its call frames, what it waits
// for, an entity the scripts spawned, the events and steps it records, why it ended. Pure types;
// ./state is the path that holds them.

import type { Sym } from './sym';
import type { TimePoint } from './time';

export interface Frame {
    /** Where the caller resumes, or null for the thread's first script. */
    ret: number | null;
    entry: number;
    args: Map<number, Sym>;
    name: string;
    /** The script slot this call runs in (a call gets a slot of its own). */
    slot: number;
    /** Started by the engine (arguments unknown) rather than by a script (unpassed arguments are 0). */
    root: boolean;
    /** The slot's owner entity (+0x0D), what operand 0x2e ("script owner") reads; calls and starts inherit it. */
    owner?: Sym;
}

/** What a thread is doing between its turns. */
export type Wait =
    | { k: 'run' }
    | { k: 'sleep'; until: TimePoint }
    /** An engine wait (opcode 0x2e): event `event` of the clock, at least one tick away. */
    | { k: 'engine'; event: number; what: string };

export interface Thread {
    /** Unique per path history: slots are reused, threads are not. */
    uid: number;
    pc: number;
    frames: Frame[];
    stack: Sym[];
    wait: Wait;
}

/** The game's script slots: 20 of 0x4F bytes from $7E28FC up to the run list at $7E2F28. */
export const SLOT_BASE = 0x28fc, SLOT_SIZE = 0x4f, SLOT_COUNT = 20;

export interface SimEntity {
    /** Stable across forks: the spawn instruction's address, ×16 plus a repeat count. */
    id: number;
    label: string;
    npc: number;
    x: number | null;
    y: number | null;
    /** Instruction that placed it. */
    at: number;
    /** WRAM words the script stored its handle in. */
    refs: number[];
    /** When it exists: 1 unless a merged branch placed it on one side only. */
    when: Sym;
}

/**
 * Something a path did. `depth` 0 is the thread's first script, 1+ inside
 * calls; `thread` is the slot of the thread's first script; `time` the tick.
 */
export type SimEvent = { at: number; depth: number; opcode: number; summary: string; thread: number; tid: number; time: string } & (
    | { type: 'write'; addr: number; size: 1 | 2; value: Sym; src: string }
    | { type: 'flag'; addr: number; bit: number; value: Sym; src: string }
    | { type: 'call'; target: number; name: string; async: boolean; args: Sym[]; global: number | null }
    | { type: 'spawn'; entity: number; label: string }
    | { type: 'map'; mapId: number; x: number; y: number }
    | { type: 'music'; track: number }
    | { type: 'text' }
    | { type: 'object'; index: Sym; value: Sym; when: Sym }
    | { type: 'wait' }
    | { type: 'wake'; why: string }
    | { type: 'thread-end' }
    /** A write to the thread's own arguments: local, touches nothing shared. */
    | { type: 'arg' }
    | { type: 'opaque' }
);

export type Step =
    | { kind: 'event'; event: SimEvent }
    | { kind: 'decide'; at: number; depth: number; cond: Sym; src: string; value: boolean; summary: string }
    /**
     * Two paths that split at `at` and met again: what each side did. The
     * paths' later steps are shared — this is an `if` that rejoins.
     */
    | { kind: 'branch'; at: number; depth: number; cond: Sym; src: string; summary: string; then: Step[]; else: Step[] };

export type EndReason = 'end' | 'map' | 'idle' | 'horizon' | 'loop' | 'recursion' | 'undecodable' | 'budget' | 'depth' | 'fork-cap';
