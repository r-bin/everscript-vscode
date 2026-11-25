// The experience kind (docs/open-evermore/resources.md §experience): how much experience the Boy and the Dog need for
// their next level, one file each, characters/experience/<boy|dog>.json { next_level_at: [n by level] }. Two tables
// of 24-bit totals in bank $8C, read in place (records.mts): the game copies the entry of the current level when the
// level changes and compares the experience counter with it.
//
// Facts used (knowledge routines/BOY_XP_PER_LEVEL.md, DOG_XP_PER_LEVEL.md):
//   Boy  $8C:8BD0, 100 entries (levels 0-99), by the level byte $0A50 ($8D:B66B: $8C:8BCD + 3·(level+1); $8F:8336);
//        entry 99 is $FFFFFF: no level after 99
//   Dog  $8C:8CFC, right after the Boy's, by $0A9A ($8D:B686, $8F:851B); 99 entries, no end mark: the three bytes after them
//        belong to the next table, and the Dog's level stops at 99 ($8F:84F5) before it reads them
// The tables are code-bank data read by `lda.l` with the address in the operand: they could move, but nothing here
// moves them, so the counts are fixed (100 and 99).
import { recordsCodec } from './records.mts';
import type { Field } from './records.mts';

export const EXPERIENCE = 'experience';
const BOY_TABLE = 0x0C8BD0, DOG_TABLE = 0x0C8CFC, LEVELS = 100, DOG_LEVELS = 99, ENTRY = 3;
const NAMES = ['boy', 'dog'];
/** Every `lda.l` of the two tables (file offset, operand): the level-up copy ($8D:B676-$B69C, 3 bytes in two words) and
 *  the level-up check ($8F:8336, $8F:851B). The operands are table - 3 (index (level+1)·3), table, table + 1. */
const READERS: [number, number][] = [
    [0x0DB676, 0x8C8BCD], [0x0DB67E, 0x8C8BCE], [0x0DB691, 0x8C8CF9], [0x0DB699, 0x8C8CFA],
    [0x0F8336, 0x8C8BD1], [0x0F833D, 0x8C8BD0], [0x0F851B, 0x8C8CFD], [0x0F8522, 0x8C8CFC],
];

/** Level n's entry: the Boy's at BOY_TABLE + 3n, the Dog's one table further (stride: the Boy's table). */
const fields: Field[] = Array.from({ length: LEVELS }, (_, n): Field => ({
    path: `next_level_at/${n}`, at: BOY_TABLE + ENTRY * n, stride: DOG_TABLE - BOY_TABLE, width: 3,
    form: { type: 'number' }, ids: id => id === 0 || n < DOG_LEVELS,
}));

export const experienceCodec = recordsCodec({
    kind: EXPERIENCE, group: 'characters', count: NAMES.length, names: () => NAMES, fields,
    why: 'the Boy\'s table ($8C:8BD0, 100 levels) and the Dog\'s right after it ($8C:8CFC, 99), read in place by level',
    // The readers' operands (`lda.l table,x`), not the values: an edited table must explode again.
    check: rom => {
        if (!READERS.every(([at, table]) => rom[at] === 0xBF && (rom[at + 1] | (rom[at + 2] << 8) | (rom[at + 3] << 16)) === table))
            throw new Error('experience: the readers of $8C:8BD0 and $8C:8CFC are not where this codec knows them; another release?');
    },
});
