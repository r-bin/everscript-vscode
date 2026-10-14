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
    ) {
        this.cells = cells ?? new Map();
        this.words = words ?? new Set();
    }

    clone(): Memory {
        return new Memory(this.pins, new Map(this.cells), new Set(this.words));
    }

    private initial(addr: number): Sym {
        let v: Sym = { k: 'mem', addr, size: 1 };
        for (const p of this.pins) {
            if (p.addr !== addr) continue;
            v = p.bit === undefined ? c(p.value & 0xff) : setbit(v, p.bit, c(p.value ? 1 : 0));
        }
        return v;
    }

    readByte(addr: number): Sym {
        addr &= 0xffff;
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
        this.cells.set(addr, lo(v));
        this.words.delete(addr);
        this.words.delete((addr - 1) & 0xffff);
    }

    writeWord(addr: number, v: Sym): void {
        addr &= 0xffff;
        this.words.delete((addr - 1) & 0xffff);
        this.words.delete((addr + 1) & 0xffff);
        this.cells.set(addr, lo(v));
        this.cells.set((addr + 1) & 0xffff, hi(v));
        this.words.add(addr);
    }

    writeBit(addr: number, n: number, v: Sym): void {
        this.writeByte(addr, setbit(this.readByte(addr), n, v));
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
        const out = new Memory(this.pins, new Map(), new Set([...this.words, ...other.words]));
        for (const a of new Set([...this.cells.keys(), ...other.cells.keys()])) {
            out.cells.set(a, ite(cond, this.readByte(a), other.readByte(a)));
        }
        return out;
    }

    /** A fingerprint of the written cells, for spotting a loop that changed nothing. */
    fingerprint(): string {
        return [...this.cells.entries()].map(([a, v]) => `${ramHex(a)}=${key(v)}`).join(';');
    }
}

/** The byte and bit a flag operand names: a byte offset ×8 plus a bit index. */
export function flagAddr(code: number, base: number): { addr: number; bit: number } {
    return { addr: (base + (code >> 3)) & 0xffff, bit: code & 7 };
}
