// Ownership: script addresses — the 32 KB windows script code lives in, and the packed
// pointers scripts store. Pure.
//
// Script code is read through the 24-bit pointer at DP $82-$84 and lives in the upper half
// ($8000-$FFFF) of the banks from $92 up: stepping past $FFFF continues at $8000 of the next
// bank (the jump handler at $8C:D434 ORs in $8000 and adjusts the bank byte). A packed pointer is
// the byte offset from $92:8000 in that window space: bank = $92 + (p >> 15), address =
// $8000 | (p & $7FFF) ($8C:CF2E builds the bus pointer that way).

import { busU8, hiromFileOffset } from '../../../platform/snes/hirom';
import { getScriptHeaderOffset } from '../variant-resolver';

/** First bank of script code. */
export const SCRIPT_BANK = 0x92;
/** Start of the script bank: its header words locate the pointer tables. */
export const SCRIPT_HEADER = 0x928000;
/**
 * The spawn opcode 0x3C's handler ($8C:DCEC) reads the enemy index with `lda.l <table>,x`; its
 * operand is here (knowledge rom/8eb55a). Read rather than assumed, so a moved table (the table
 * hack, docs/table-hack.md) is followed.
 */
const ENEMY_INDEX_OPERAND = 0x8cdcf4;
/** Character records start at $xx:B678 in every layout so far (vanilla bank $8E, the table hack's $B8), 74 bytes each (rom/8eb678). */
const RECORDS_LOW = 0xb678, RECORD_SIZE = 74;

export function pack(bus: number): number {
    return (((bus >>> 16) - SCRIPT_BANK) << 15) | (bus & 0x7FFF);
}

export function unpack(packed: number): number {
    return ((SCRIPT_BANK + (packed >>> 15)) << 16) | 0x8000 | (packed & 0x7FFF);
}

/** The script address `n` bytes after `bus`, staying in the upper half of each bank. */
export function advance(bus: number, n: number): number {
    return unpack(pack(bus) + n);
}

/** Bytes from `from` to `to` (both script addresses). */
export function distance(from: number, to: number): number {
    return pack(to) - pack(from);
}

/** A script byte reader over the user's ROM (HiROM, unheadered). */
export class ScriptRom {
    /** `rom`: the user's ROM, unheadered. The US layout only (other releases keep scripts at $93). */
    constructor(readonly rom: Uint8Array) {
        if (getScriptHeaderOffset(rom) !== (hiromFileOffset(SCRIPT_HEADER))) throw new Error('script VM: this ROM keeps its scripts elsewhere (only the US layout is known)');
    }

    /** Whether `bus` is script space inside this ROM. */
    contains(bus: number): boolean {
        const bank = bus >>> 16;
        if (bank < SCRIPT_BANK || bank > 0xBF || (bus & 0xFFFF) < 0x8000) return false;
        return ((bank & 0x3F) << 16 | (bus & 0xFFFF)) < this.rom.length;
    }

    u8(bus: number): number { return busU8(this.rom, bus); }
    u16(bus: number): number { return this.u8(bus) | (this.u8(advance(bus, 1)) << 8); }
    u24(bus: number): number { return this.u16(bus) | (this.u8(advance(bus, 2)) << 16); }

    /** Header word `k` of the script bank (`$92:8000 + 2k`). */
    header(k: number): number { return busU8(this.rom, SCRIPT_HEADER + 2 * k) | (busU8(this.rom, SCRIPT_HEADER + 2 * k + 1) << 8); }

    /**
     * The script a trigger id or an `0xA4` operand names: a byte offset into the pointer table at
     * $92:8000 + word[$92:8000].
     */
    triggerScript(offset: number): number {
        return unpack(this.u24Table(this.header(0) + offset));
    }

    /**
     * The script a global id names (`0xA3`, `0xB0`): id * 3 + word[$92:8008] into the same table
     * ($8C:D3A0).
     */
    globalScript(id: number): number {
        return unpack(this.u24Table(id * 3 + this.header(4) + this.header(0)));
    }

    /**
     * The character record an ENEMY id spawns, as the spawn handlers find it: the id's word in the
     * enemy index is the record's 16-bit address. Null for the Boy and the Dog (their records are
     * in WRAM) and for an entry that is no record.
     */
    enemyCharacter(id: number): number | null {
        const table = busU8(this.rom, ENEMY_INDEX_OPERAND) | (busU8(this.rom, ENEMY_INDEX_OPERAND + 1) << 8) | (busU8(this.rom, ENEMY_INDEX_OPERAND + 2) << 16);
        const word = busU8(this.rom, table + id * 2) | (busU8(this.rom, table + id * 2 + 1) << 8);
        const at = word - RECORDS_LOW;
        return at >= 0 && at % RECORD_SIZE === 0 ? at / RECORD_SIZE : null;
    }

    /**
     * Every entry of the pointer table at $92:8000 + word[$92:8000], as byte offsets: the table
     * runs up to the first script it points at.
     */
    tableOffsets(): number[] {
        const out: number[] = [];
        let first = Infinity;
        for (let off = 0; SCRIPT_HEADER + this.header(0) + off + 3 <= Math.min(first, SCRIPT_HEADER | 0x7FFF); off += 3) {
            const t = this.triggerScript(off);
            if (this.contains(t)) first = Math.min(first, t);
            out.push(off);
        }
        return out;
    }

    private u24Table(offset: number): number {
        const at = SCRIPT_HEADER + offset;
        return busU8(this.rom, at) | (busU8(this.rom, at + 1) << 8) | (busU8(this.rom, at + 2) << 16);
    }
}
