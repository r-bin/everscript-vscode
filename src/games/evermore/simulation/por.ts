// Ownership: when the order of two script turns cannot change the outcome.
// Pure.
//
// Two turns commute when neither writes what the other reads or writes, and
// they do not touch the same engine resource (an entity, the text box, the
// screen, the camera, audio, a room object). Then running them in either order
// gives the same WRAM and the same thing on screen, so the simulation does not
// have to fork on which came first — the classic partial-order reduction,
// with WRAM bytes and engine resources as the shared objects.
//
// Resources of opaque instructions are read from their (entity-resolved)
// summaries; one the reader cannot place is `global`, which conflicts with
// every other `global`. Erring towards a conflict only costs a fork.

import { Step } from './state';

export interface Footprint {
    reads: Set<number>;
    writes: Set<number>;
    resources: Set<string>;
    /** Read the timer: its value depends on exactly when the turn runs. */
    timer: boolean;
    /** Ended by yielding (runs again next tick) rather than by a wait or END. */
    active: boolean;
    /** Started another thread. */
    starts: boolean;
}

export function emptyFootprint(): Footprint {
    return { reads: new Set(), writes: new Set(), resources: new Set(), timer: false, active: false, starts: false };
}

export function union(a: Footprint, b: Footprint): Footprint {
    return {
        reads: new Set([...a.reads, ...b.reads]), writes: new Set([...a.writes, ...b.writes]),
        resources: new Set([...a.resources, ...b.resources]),
        timer: a.timer || b.timer, active: a.active || b.active, starts: a.starts || b.starts,
    };
}

/**
 * Entities an instruction's text names: a placed NPC's label (`Boy#ca7d`, step.ts resolveText),
 * the character sub-ops (`boy()` the boy, `dog()` the dog, `camera_entity()` the
 * controlled one, `other_character()`, `script_owner()` the script's owner) or a WRAM cell.
 */
const ENTITY = /([A-Z][\w' .-]*#[0-9a-f.]+)|\b(boy|dog|camera_entity|other_character|script_owner)\(\)|<0x([0-9a-f]{4})>/gi;
/** Opcodes that act on fixed characters, with no operand naming them. */
const IMPLIED: Record<number, string[]> = {
    0xbc: ['boy'], 0xbd: ['boy'], 0xbf: ['dog'],
    0xaa: ['boy', 'dog'], 0xc0: ['boy', 'dog'], 0xc1: ['boy', 'dog'],
};
/** What the other opaque opcodes touch (see reach.ts GLOBAL). */
const AUDIO = new Set([0x30, 0x31, 0x32, 0x33, 0x58, 0x59, 0x86, 0x87]);
const TEXT = new Set([0x44, 0x45, 0x46, 0x47, 0x50, 0x51, 0x52, 0x54, 0x55, 0x5a, 0x5b, 0x7f, 0x80, 0x81, 0x8e, 0x9f, 0xa0, 0xa1]);
const SCREEN = new Set([0x26, 0x27, 0x2b, 0x58, 0x59, 0x63, 0x82, 0x83, 0x8d, 0x91, 0x96, 0xbd, 0xbf, 0xc1]);

/** The engine resources a run of steps touches. */
export function resourcesOf(steps: readonly Step[]): Set<string> {
    const out = new Set<string>();
    for (const st of steps) {
        if (st.kind !== 'event') continue;
        const e = st.event;
        switch (e.type) {
            case 'text': out.add('text'); break;
            case 'music': out.add('audio'); break;
            case 'map': out.add('global'); break;
            case 'spawn': out.add('entities'); out.add(`ent:${e.label}`); break;
            case 'object': out.add(`obj:${e.index.k === 'c' ? e.index.v : '?'}`); if (e.index.k !== 'c') out.add('global'); break;
            case 'opaque': {
                const s = e.summary;
                let placed = false;
                if (AUDIO.has(e.opcode)) { out.add('audio'); placed = true; }
                if (TEXT.has(e.opcode)) { out.add('text'); placed = true; }
                if (SCREEN.has(e.opcode)) { out.add('screen'); placed = true; }
                let first = true;
                for (const who of IMPLIED[e.opcode] ?? []) { out.add(`ent:${who}`); first = false; placed = true; }
                // The first entity an instruction names is the one it changes; the rest it only looks at.
                for (const m of s.matchAll(ENTITY)) {
                    out.add(`${first ? 'ent' : 'see'}:${(m[1] ?? m[2] ?? m[3]).toLowerCase()}`);
                    first = false;
                    placed = true;
                }
                if (!placed) out.add('global');
                break;
            }
            default: break;
        }
    }
    return out;
}

/** True when running `a` and `b` in the other order could change anything. */
export function conflicts(a: Footprint, b: Footprint): boolean {
    if (a.timer || b.timer) return true;
    for (const w of a.writes) if (b.writes.has(w) || b.reads.has(w)) return true;
    for (const w of b.writes) if (a.reads.has(w)) return true;
    // `see:x` only conflicts with a change to x; `ent:x`, `text`, … with any use of the same name.
    const touches = (f: Footprint, name: string): boolean => f.resources.has(`ent:${name}`);
    for (const r of a.resources) {
        if (r.startsWith('see:')) { if (touches(b, r.slice(4))) return true; continue; }
        if (b.resources.has(r)) return true;
        if (r.startsWith('ent:') && b.resources.has(`see:${r.slice(4)}`)) return true;
    }
    return false;
}
