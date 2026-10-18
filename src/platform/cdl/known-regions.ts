/**
 * platform/cdl/known-regions.ts
 *
 * What the export knows about a ROM before any CDL data: the header, plus whatever the
 * game hands in as `gameRegions` (Evermore: games/evermore/cdl/regions.js). Each region
 * replaces the CDL's guess for its bytes:
 *   blob   -> incbin of its own file (rooms/room_XX.bin)
 *   bytes  -> db lines under a label (header, strings)
 *   table  -> pointer entries written as label expressions, so a moved target
 *             moves its pointer with it
 * Every region is a plain slice of the ROM, so a wrong end only moves a label;
 * the rebuild stays byte-identical either way.
 */

import { hex, createRomMap } from './rom-map';

const CDL_CODE = 0x01;

type RomMap = ReturnType<typeof createRomMap>;

/** A ROM range the export writes as known data, not from the CDL's guess (file offsets, end exclusive). */
interface KnownRegion {
    start: number; end: number; kind: 'blob' | 'bytes' | 'table'; name: string; note?: string;
    /** blob: the file it is written to. */
    file?: string;
    /** bytes, table: the asm lines under the label. */
    lines?: string[];
}
/** The game's regions and the defines its tables use, or null when it knows none for this image. */
type GameRegions = (rom: Uint8Array, map: RomMap, cdl: Uint8Array | null | undefined, steps: string[]) => { regions: KnownRegion[]; defines: string[] } | null;

function headerRegions(rom: Uint8Array, map: RomMap, steps: string[]): KnownRegion[] {
    const h = map.header;
    if (!h) { steps.push('Header: none found, no header labels.'); return []; }
    const base = map.type === 'LoROM' ? 0x7FB0 : 0xFFB0;
    if (base + 0x50 > rom.length) return [];
    const at = (o: number, n: number): number[] => [...rom.subarray(base + o, base + o + n)];
    steps.push(`Header: "${h.title}", ${map.type}, ${rom.length} bytes; labels rom_header ($${hex(map.canonical(base), 6)}) and rom_vectors.`);
    return [
        { start: base, end: base + 0x30, kind: 'bytes', name: 'rom_header', note: `${h.title} - ${map.type}`, lines: dbLines(at(0, 0x30)) },
        { start: base + 0x30, end: base + 0x50, kind: 'bytes', name: 'rom_vectors', note: 'native $FFE0-$FFEF, emulation $FFF0-$FFFF', lines: dbLines(at(0x30, 0x20)) },
    ];
}

function dbLines(bytes: number[], per = 16): string[] {
    const out: string[] = [];
    for (let i = 0; i < bytes.length; i += per) out.push('    db ' + bytes.slice(i, i + per).map(b => '$' + hex(b, 2)).join(','));
    return out;
}

function labelExpr(name: string, delta: number): string {
    if (!delta) return name;
    return name + (delta < 0 ? '-$' + hex(-delta, 6) : '+$' + hex(delta, 6));
}

/**
 * Known regions for this ROM, sorted and non-overlapping (a later region that
 * overlaps an earlier one is dropped and reported).
 */
function findKnownRegions(rom: Uint8Array, map: RomMap, cdl: Uint8Array | null | undefined, gameRegions?: GameRegions | null): { regions: KnownRegion[]; defines: string[]; steps: string[] } {
    const steps: string[] = [];
    let all = headerRegions(rom, map, steps);
    const defines: string[] = [];
    const game = gameRegions ? gameRegions(rom, map, cdl, steps) : null;
    if (game) {
        all = all.concat(game.regions);
        defines.push(...game.defines);
    } else {
        steps.push('Content: no game regions for this image, only the header is seeded.');
    }
    all.sort((a, b) => a.start - b.start || b.end - a.end);
    const regions: KnownRegion[] = [], dropped: string[] = [];
    for (const r of all) {
        const prev = regions[regions.length - 1];
        const crosses = map.segment && Math.floor(r.start / map.segment) !== Math.floor((r.end - 1) / map.segment);
        if ((prev && r.start < prev.end) || crosses) dropped.push(r.name + (crosses ? ' (crosses a bank)' : ' (overlaps ' + prev.name + ')'));
        else regions.push(r);
    }
    if (dropped.length) steps.push('Dropped: ' + dropped.join(', ') + '.');
    if (cdl) {
        let codeInside = 0;
        for (const r of regions) for (let o = r.start; o < r.end; o++) if (cdl[o] & CDL_CODE) codeInside++;
        if (codeInside) steps.push(`Warning: the CDL saw ${codeInside} bytes inside known regions execute as code; the known region wins.`);
    }
    return { regions, defines, steps };
}

export type { KnownRegion, GameRegions };
export { findKnownRegions, dbLines, labelExpr };
