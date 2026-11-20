// A table the game reads only through `lda.l table,x` operands (24-bit, opcode $BF): where it is, and the operands
// implode rewrites once it has placed it. Used by the kinds whose whole binding is such a table (animate ids,
// enemies, sprite blocks); maps, strings and scripts keep their own because their readers differ.
import { createRequire } from 'node:module';
import type { ImplodeContext, Span, Write } from '../../codec.mts';

const require = createRequire(import.meta.url);
const maps = require('../../../../dist/games/evermore/maps');

/** A reader: the file offset of the 24-bit operand of an `lda.l`, and what it adds to the table's address. */
export interface Reader { at: number; add: number }

/** The table's file offset, from its readers (they must agree and be `lda.l`); `what` names it in the error. */
export function tableAt(rom: Uint8Array, readers: Reader[], what: string): number {
    const ops = readers.map(r => maps.romFileOffset(rom, ((rom[r.at] | rom[r.at + 1] << 8 | rom[r.at + 2] << 16) - r.add) & 0xFFFFFF));
    if (readers.some(r => rom[r.at - 1] !== 0xBF) || ops.some((o: number) => o !== ops[0])) throw new Error(`${what}: the table readers are not the ones this codec knows; another release?`);
    return ops[0];
}

/** The operand bytes, as generated table space. */
export const readerSpans = (readers: Reader[]): Span[] => readers.map(r => ({ start: r.at, end: r.at + 3 }));

/** The operands pointing at the table placed at file offset `at`. */
export function readerWrites(ctx: ImplodeContext, readers: Reader[], at: number, file: string): Write[] {
    return readers.map(r => {
        const bus = (ctx.pointer(at) + r.add) & 0xFFFFFF;
        return { at: r.at, bytes: Uint8Array.of(bus & 0xFF, (bus >> 8) & 0xFF, bus >> 16), file };
    });
}

/** `$xxxx` / `$BB:xxxx` text, and back (null when it is not one). */
export const hexText = (v: number, digits: number, bank?: number): string => '$' + (bank === undefined ? '' : bank.toString(16).toUpperCase().padStart(2, '0') + ':') + v.toString(16).toUpperCase().padStart(digits, '0');
export function parseHex(v: unknown, max: number, bank?: number): number | null {
    if (typeof v !== 'string') return null;
    const m = (bank === undefined ? /^\$([0-9a-fA-F]+)$/ : /^\$([0-9a-fA-F]{2}):([0-9a-fA-F]{4})$/).exec(v);
    if (!m) return null;
    if (bank !== undefined && parseInt(m[1], 16) !== bank) return null;
    const n = parseInt(m[bank === undefined ? 1 : 2], 16);
    return n <= max ? n : null;
}
