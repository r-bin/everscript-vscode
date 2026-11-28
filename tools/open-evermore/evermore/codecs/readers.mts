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

/** True when the `code` kind owns the operand at file offset `operandOffset` (writes it from symbols). */
export const codeOwnsSite = (ctx: ImplodeContext, operandOffset: number): boolean =>
    ctx.marks?.get('code/owned-sites')?.has(operandOffset.toString(16)) ?? false;

/** The operands pointing at the table placed at file offset `at`, skipping sites owned by `code`. */
export function readerWrites(ctx: ImplodeContext, readers: Reader[], at: number, file: string): Write[] {
    return readers.filter(r => !codeOwnsSite(ctx, r.at)).map(r => {
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

const KNOWLEDGE = require('../../../../dist/games/evermore/localizations/knowledge');
/**
 * The routines of one bank by name, as the knowledge base names them (the routine names of soe://rom/code/): a
 * handler table's entries are written by these names. Code is not a kind yet, so a name stands for its fixed
 * address. `name(at)`: the routine at 16-bit address `at` (`$BB:xxxx` when none is named); `at(text)`: back, from a
 * name or `$BB:xxxx` (null when neither).
 */
export function routines(bank: number): { name(at: number): string; at(text: unknown): number | null } {
    const list: { name: string; addr: number }[] = KNOWLEDGE.entries('rom').filter((e: { kind: string; addr: number }) => e.kind === 'code' && e.addr >> 16 === bank);
    const byAt = new Map(list.map(e => [e.addr & 0xFFFF, e.name])), byName = new Map(list.map(e => [e.name, e.addr & 0xFFFF]));
    return {
        name: at => byAt.get(at) ?? hexText(at, 4, bank),
        at: text => typeof text !== 'string' ? null : byName.get(text) ?? parseHex(text, 0xFFFF, bank),
    };
}
