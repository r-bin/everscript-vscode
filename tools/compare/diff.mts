// The pure part of compare: checkpoints in, first divergence and byte / write differences out. No emulator, no files,
// so the unit test drives it with synthetic hash streams (tests/compare/compare-units.test.mts).
import { crc32 } from 'node:zlib';

export type Region = 'wram' | 'vram' | 'cgram' | 'oam' | 'aram';
export const REGION_SIZE: Record<Region, number> = { wram: 0x20000, vram: 0x10000, cgram: 0x200, oam: 0x220, aram: 0x10000 };

/** One region's CRC-32 per entry of `regions`, at one key (a frame count, or the game's NMI counter $0100). */
export type Crcs = number[];

/** The one hash over all regions the default mode compares: a CRC-32 of the region CRCs. */
export function combined(crcs: Crcs): number {
    return crc32(new Uint8Array(Uint32Array.from(crcs).buffer));
}

export interface Divergence {
    /** The last key both agreed on (0 = none compared before it). */
    lastGood: number;
    /** The first key they differ at. */
    key: number;
    /** Indexes into `regions` of the regions that differ there. */
    regions: number[];
}

export interface TargetResult {
    /** The last key compared, whether it matched or not. */
    lastCompared: number;
    compared: number;
    differing: number;
    first: Divergence | null;
}

/**
 * Compares targets with one reference as checkpoints arrive, in any order between setups but in rising key order
 * within one. A key either side lacks is not compared; keys at or below `skipThrough` are not compared either
 * (before the RNG sync of a cross-backend run).
 */
export class Tracker {
    readonly ref = new Map<number, Crcs>();
    private readonly pending: Map<number, Crcs>[];
    private readonly lastMatch: number[];
    readonly results: TargetResult[];
    private readonly skipThrough: number;

    constructor(targets: number, skipThrough = -1) {
        this.skipThrough = skipThrough;
        this.pending = Array.from({ length: targets }, () => new Map());
        this.lastMatch = new Array(targets).fill(0);
        this.results = Array.from({ length: targets }, () => ({ lastCompared: 0, compared: 0, differing: 0, first: null }));
    }

    /** Returns the targets that diverged for the first time at this key. */
    addRef(key: number, crcs: Crcs): number[] {
        this.ref.set(key, crcs);
        const hit: number[] = [];
        this.pending.forEach((p, i) => {
            const t = p.get(key);
            if (!t) return;
            p.delete(key);
            if (this.check(i, key, t)) hit.push(i);
        });
        return hit;
    }

    /** True when this target diverged for the first time at this key. */
    addTarget(i: number, key: number, crcs: Crcs): boolean {
        if (key <= this.skipThrough) return false;
        const r = this.ref.get(key);
        if (!r) { this.pending[i].set(key, crcs); return false; }
        return this.check(i, key, crcs);
    }

    private check(i: number, key: number, crcs: Crcs): boolean {
        const res = this.results[i];
        res.compared++;
        res.lastCompared = Math.max(res.lastCompared, key);
        const r = this.ref.get(key)!;
        if (combined(r) === combined(crcs)) {
            if (!res.first) this.lastMatch[i] = Math.max(this.lastMatch[i], key);
            return false;
        }
        res.differing++;
        if (res.first) return false;
        res.first = { lastGood: this.lastMatch[i], key, regions: crcs.flatMap((c, j) => c === r[j] ? [] : [j]) };
        return true;
    }
}

export interface ByteDiff { offset: number; a: number; b: number }

/** The differing bytes of two snapshots of one region, skipping the ignored offsets; at most `max`. */
export function byteDiff(a: Uint8Array, b: Uint8Array, ignore: ReadonlySet<number> = new Set(), max = Infinity): { diffs: ByteDiff[]; total: number } {
    const diffs: ByteDiff[] = [];
    let total = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        if (a[i] === b[i] || ignore.has(i)) continue;
        total++;
        if (diffs.length < max) diffs.push({ offset: i, a: a[i], b: b[i] });
    }
    return { diffs, total };
}

/** Consecutive offsets as [first, last] runs, for a short listing. */
export function runs(offsets: number[]): [number, number][] {
    const out: [number, number][] = [];
    for (const o of [...offsets].sort((x, y) => x - y)) {
        const last = out[out.length - 1];
        if (last && o === last[1] + 1) last[1] = o;
        else out.push([o, o]);
    }
    return out;
}

/** A CPU write to a watched WRAM byte; `frame` counts frames since the watch window began. */
export interface Write { frame: number; offset: number; pc: number; value: number }

export interface WriteSplit { offset: number; index: number; a: Write | null; b: Write | null }

/**
 * Per watched byte, the first write where the two setups part: a different writer, a different value, or one side
 * writing where the other does not. Bytes both sides wrote identically are left out.
 */
export function firstDifferingWrites(a: Write[], b: Write[]): WriteSplit[] {
    const by = (ws: Write[]) => {
        const m = new Map<number, Write[]>();
        for (const w of ws) { if (!m.has(w.offset)) m.set(w.offset, []); m.get(w.offset)!.push(w); }
        return m;
    };
    const ma = by(a), mb = by(b), out: WriteSplit[] = [];
    for (const offset of new Set([...ma.keys(), ...mb.keys()])) {
        const xa = ma.get(offset) || [], xb = mb.get(offset) || [];
        for (let k = 0; k < Math.max(xa.length, xb.length); k++) {
            const wa = xa[k] || null, wb = xb[k] || null;
            if (wa && wb && wa.frame === wb.frame && wa.pc === wb.pc && wa.value === wb.value) continue;
            out.push({ offset, index: k, a: wa, b: wb });
            break;
        }
    }
    return out.sort((x, y) => firstFrame(x) - firstFrame(y) || x.offset - y.offset);
}

function firstFrame(s: WriteSplit): number {
    return Math.min(s.a ? s.a.frame : Infinity, s.b ? s.b.frame : Infinity);
}
