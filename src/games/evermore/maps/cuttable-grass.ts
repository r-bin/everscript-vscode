// Ownership: the cuttable-grass metatile swap table in Section 4. Pure.
//
// Ported from everscript/tools/cuttable_grass.py (driven by $90A6EF).
// See docs/map-format/cuttable_grass_mechanics.md.

const SEQUENCE_TERMINATOR = 0x0000;

export interface GrassRecord {
    steps: number;
    source: number;
    sequence: number[];
}

export interface GrassSwapTable {
    romOffset: number;
    /** Header word: payload byte count. */
    sectionLen: number;
    /** Header byte: number of distinct sources. */
    sourceCount: number;
    records: GrassRecord[];
    /** source metatile ID -> cut metatile ID. */
    swaps: Map<number, number>;
    /** True if a record ran past the declared section end. */
    truncated: boolean;
}

/**
 * Parse the metatile swap table between Block 2 and Block 3 of a room blob.
 *
 * `offset` is the ROM file offset of the section header, i.e. the byte directly
 * after Block 2's payload. A room without cuttable grass yields an empty table.
 */
export function parseGrassSwapSection(rom: Uint8Array, offset: number): GrassSwapTable {
    const sectionLen = rom[offset] | (rom[offset + 1] << 8);
    const end = Math.min(offset + 2 + sectionLen, rom.length);
    const sourceCount = offset + 2 < rom.length ? rom[offset + 2] : 0;

    const records: GrassRecord[] = [];
    let truncated = false;
    let p = offset + 3;

    while (p < end) {
        const steps = rom[p];
        let q = p + 1;
        const sequence: number[] = [];
        for (;;) {
            if (q + 2 > end) {
                truncated = true;
                break;
            }
            const word = rom[q] | (rom[q + 1] << 8);
            q += 2;
            if (word === SEQUENCE_TERMINATOR) break;
            sequence.push(word);
        }
        if (truncated) break;
        p = q;
        if (sequence.length) {
            records.push({ steps, source: sequence[0], sequence: sequence.slice(1) });
        }
    }

    // First-match-wins: duplicate source records exist (22 of room 0x38's 94
    // records repeat an earlier source). Which one the engine picks is not
    // established, so keep the first and leave the rest in `records`.
    const swaps = new Map<number, number>();
    for (const rec of records) {
        if (!swaps.has(rec.source)) {
            swaps.set(rec.source, rec.sequence.length ? rec.sequence[rec.sequence.length - 1] : rec.source);
        }
    }

    return { romOffset: offset, sectionLen, sourceCount, records, swaps, truncated };
}

/**
 * Room-local `[x, y]` coordinates whose terrain metatile is cuttable.
 * Sorted by x then y, matching upstream's `sorted()` over a set of tuples.
 */
export function findCuttableGrassTiles(
    table: GrassSwapTable,
    metatileIds: number[][],
): Array<[number, number]> {
    if (table.swaps.size === 0) return [];
    const tiles: Array<[number, number]> = [];
    for (let y = 0; y < metatileIds.length; y++) {
        const row = metatileIds[y];
        for (let x = 0; x < row.length; x++) {
            if (table.swaps.has(row[x])) tiles.push([x, y]);
        }
    }
    return tiles.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/**
 * Re-check the two structural invariants observed across all 7 vanilla
 * cuttable-grass rooms. Returns human-readable mismatch strings; empty when the
 * table looks well-formed. For ROM-hack sanity checking, not identification.
 */
export function checkTableInvariants(table: GrassSwapTable, baseMetatile: number): string[] {
    const problems: string[] = [];
    if (table.truncated) problems.push('record ran past the declared section length');

    const sources = Array.from(table.swaps.keys()).sort((a, b) => a - b);
    if (!sources.length) return problems;

    if (table.sourceCount !== sources.length) {
        problems.push(`header source_count ${table.sourceCount} != ${sources.length} distinct source IDs`);
    }

    const indices = sources.map((s) => Math.floor((s - baseMetatile) / 8));
    const contiguous = indices.every((v, i) => v === i);
    if (!contiguous) {
        problems.push(
            `source metatile indices are not the contiguous run 0..${indices.length - 1}: ${indices.join(', ')}`,
        );
    }
    return problems;
}
