// Ownership: the simulated WRAM — byte cells over an unknown starting state.
// Pure.
//
// Only bytes a script wrote are stored. A read of anything else is the
// starting value, `mem(addr)`, which stays symbolic unless the caller pinned it
// (a preset, a snapshot, or a flag the user fixed). That is the "never guess a
// starting state" rule from simulation/virtual-wram.md, in code: there is no
// default, only "unknown" or "pinned by someone who said so".
//
// Addresses are the 16-bit offsets into bank $7E the script engine uses.

import { Sym, c, lo, hi, word, bit, setbit, ite, key, ramHex } from './sym';

/** Where the two script variable banks start: saved state and room scratch. */
export const SAVE_BASE = 0x2258;
export const TEMP_BASE = 0x2834;

/**
 * A starting value someone vouched for: a whole byte, or one bit of it.
 * Every pin is an assumption the report has to show.
 */
export interface Pin { addr: number; bit?: number; value: number; why?: string }

export class Memory {
    private cells: Map<number, Sym>;
    /** Addresses last written as the low byte of a word. */
    private words: Set<number>;

    constructor(
        /** Starting values the caller vouches for, by byte address. */
        private readonly pins: readonly Pin[] = [],
        cells?: Map<number, Sym>,
        words?: Set<number>,
        /** A whole starting WRAM (bank $7E, from a save state or the emulator): everything known. */
        private readonly image: Uint8Array | null = null,
    ) {
        this.cells = cells ?? new Map();
        this.words = words ?? new Set();
        for (const p of pins) this.byAddr.set(p.addr, [...(this.byAddr.get(p.addr) ?? []), p]);
    }

    private readonly byAddr = new Map<number, Pin[]>();
    /** When set, every byte read and written is noted (footprints, see por.ts). Shared by clones. */
    track: { reads: Set<number>; writes: Set<number> } | null = null;

    clone(): Memory {
        const m = new Memory(this.pins, new Map(this.cells), new Set(this.words), this.image);
        m.track = this.track;
        return m;
    }

    /** Start from a full WRAM image (pins still apply on top). */
    static fromImage(image: Uint8Array, pins: readonly Pin[] = []): Memory {
        return new Memory(pins, undefined, undefined, image);
    }

    private initial(addr: number): Sym {
        let v: Sym = this.image ? c(this.image[addr & 0xffff]) : { k: 'mem', addr, size: 1 };
        for (const p of this.byAddr.get(addr) ?? []) {
            v = p.bit === undefined ? c(p.value & 0xff) : setbit(v, p.bit, c(p.value ? 1 : 0));
        }
        return v;
    }

    readByte(addr: number): Sym {
        addr &= 0xffff;
        this.track?.reads.add(addr);
        return this.cells.get(addr) ?? this.initial(addr);
    }

    readWord(addr: number): Sym {
        return word(this.readByte(addr), this.readByte(addr + 1));
    }

    readBit(addr: number, n: number): Sym {
        return bit(this.readByte(addr), n);
    }

    writeByte(addr: number, v: Sym): void {
        addr &= 0xffff;
        this.track?.writes.add(addr);
        this.cells.set(addr, lo(v));
        this.words.delete(addr);
        this.words.delete((addr - 1) & 0xffff);
    }

    writeWord(addr: number, v: Sym): void {
        addr &= 0xffff;
        this.words.delete((addr - 1) & 0xffff);
        this.words.delete((addr + 1) & 0xffff);
        this.track?.writes.add(addr);
        this.track?.writes.add((addr + 1) & 0xffff);
        this.cells.set(addr, lo(v));
        this.cells.set((addr + 1) & 0xffff, hi(v));
        this.words.add(addr);
    }

    writeBit(addr: number, n: number, v: Sym): void {
        const t = this.track;
        this.track = null; // the read-modify-write of one bit is a write, not a read
        this.writeByte(addr, setbit(this.readByte(addr), n, v));
        this.track = t;
        t?.writes.add(addr & 0xffff);
    }

    /**
     * What changed, merged back into words where a script wrote words. A
     * byte whose value is its own starting value is not a change.
     */
    diff(): Array<{ addr: number; size: 1 | 2; value: Sym }> {
        const out: Array<{ addr: number; size: 1 | 2; value: Sym }> = [];
        const addrs = [...this.cells.keys()].sort((a, b) => a - b);
        const done = new Set<number>();
        for (const a of addrs) {
            if (done.has(a)) continue;
            const v = this.cells.get(a)!;
            if (this.words.has(a)) {
                done.add(a + 1);
                const w = word(v, this.cells.get(a + 1)!);
                if (key(w) !== key(word(this.initial(a), this.initial(a + 1)))) out.push({ addr: a, size: 2, value: w });
                continue;
            }
            if (key(v) === key(this.initial(a))) continue;
            out.push({ addr: a, size: 1, value: v });
        }
        return out;
    }

    /** WRAM after two paths rejoin: where `cond` held it is this one, else `other`. */
    merge(cond: Sym, other: Memory): Memory {
        const out = new Memory(this.pins, new Map(), new Set([...this.words, ...other.words]), this.image);
        out.track = this.track;
        for (const a of new Set([...this.cells.keys(), ...other.cells.keys()])) {
            out.cells.set(a, ite(cond, this.readByte(a), other.readByte(a)));
        }
        return out;
    }

    /** A fingerprint of the written cells, for spotting a loop that changed nothing. */
    fingerprint(): string {
        const raw = [...this.cells.entries()].map(([a, v]) => `${ramHex(a)}=${key(v)}`).join(';');
        // Fresh unknowns are numbered per path (⟨n⟩); two paths equal up to that numbering are the same.
        const ren = new Map<string, number>();
        return raw.replace(/⟨\d+⟩/g, (m) => { if (!ren.has(m)) ren.set(m, ren.size); return `⟨${ren.get(m)}⟩`; });
    }
}

/** The byte and bit a flag operand names: a byte offset ×8 plus a bit index. */
export function flagAddr(code: number, base: number): { addr: number; bit: number } {
    return { addr: (base + (code >> 3)) & 0xffff, bit: code & 7 };
}
