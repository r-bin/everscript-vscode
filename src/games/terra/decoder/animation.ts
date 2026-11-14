// Ownership: a room's animation helpers — the characters the room change starts that animate its palette or its
// background characters (docs/terra/README.md §3.10). Pure: ROM bytes and a room id in, records out.
//
// After the load, the room change runs $80:F3F1: it walks the room's character list and starts each entry. The list
// is the room property stream (`$82:8000 + room × 2`, else `$83:8000`; $86:955C reads its first two bytes) from its
// third byte, parsed by $80:F4EA, up to an `$FF` byte:
//   $FB  param, header pointer (word, bank)   a helper (no sprite, record from $86:8380): `+6` = param, its script
//                                             3 bytes into the header ($80:F6E6)
//   $FD  x, y, kind, header (word, bank)       7 bytes; `$FE` the same without x, y (5 bytes) ($80:F5F9, $80:F5F0)
//   $FA  flag words, target word              a branch on event flags ($80:F759, flags tested by $80:BBC7): words
//                                             follow while bits 11-14 chain them (bit 15 or none ends); then either
//                                             the next entries or those at the target are read
//   $F0  6 bytes (layer size and a mode-7 setup, $80:F689); `$FC` one byte (a link, $80:F47B)
//   else a character: flags, x, y, kind, header (word, bank), 3 more bytes; 6 more when the kind has bits 6-7 ($80:F4EA)
// Which branch of `$FA` the game takes depends on the story; the walk here follows both, and says which helpers every
// path starts.
//
// Two helper scripts animate:
//   $87:987F  palette: param → list at `$9C:8000 + word($9C:8000 + param × 2)` of 6-byte steps — frame count (0 ends:
//             start over), source (bank $9C), first colour, length − 1, delay ($8D:9331); each frame copies `length`
//             bytes into the palette buffer `$7F:0600` and moves the source on ($8D:93B2), then waits `delay + 1` frames
//   $87:98A8  characters: param → word at `$9D:8000 + param × 2` (bit 15: an index into the bank table at $8D:9407);
//             8-byte steps — frame count, source (from the table's base), VRAM word address, length, delay ($8D:93D8, $8D:940D); each frame
//             queues a DMA of `length` bytes to VRAM ($8D:9470) and moves the source on
const PROPERTIES = [0x828000, 0x838000];
export const PALETTE_HELPER = 0x87987F, TILE_HELPER = 0x8798A8;
const PALETTE_TABLE = 0x9C8000, TILE_TABLE = 0x9D8000, TILE_BANKS = 0x8D9407;
const MAX_ENTRIES = 256, MAX_STEPS = 64;

const file = (bus: number) => bus & 0x3FFFFF;
const word = (rom: Uint8Array, bus: number) => rom[file(bus)] | (rom[file(bus) + 1] << 8);

export interface TerraHelper {
    script: number; param: number;
    /** Bus address of the `$FB` entry (the first, when several paths reach it). */
    at: number;
    /** Started on every path through the list's `$FA` branches (false: only in some story states). */
    always: boolean;
}

/** Most paths followed through a list's `$FA` branches (each branch doubles them). */
const MAX_PATHS = 256;

/** The helpers (`$FB` entries) room `id`'s character list can start, on every path through its `$FA` branches or some. */
export function roomHelpers(rom: Uint8Array, id: number): TerraHelper[] {
    let start = 0;
    for (const table of PROPERTIES) {
        const p = word(rom, table + id * 2);
        if (p) { start = (table & 0xFF0000) | ((p + 2) & 0xFFFF); break; }
    }
    if (!start) return [];
    const bank = start & 0xFF0000;
    const found = new Map<string, TerraHelper>();
    const paths: Set<string>[] = [];
    // One path: the entries from `a` on, `seen` guarding against a branch back into itself.
    const walk = (a: number, got: Set<string>, seen: Set<number>): void => {
        for (let n = 0; n < MAX_ENTRIES && !seen.has(a); n++) {
            seen.add(a);
            const b = rom[file(a)];
            if (b === 0xFF) break;
            if (b === 0xFC) { a++; continue; }
            if (b === 0xFA) {
                let y = 1, w: number;
                do { w = word(rom, a + y); y += 2; } while (!(w & 0x8000) && (w & 0xF800));
                if (paths.length + 1 < MAX_PATHS) walk(bank | word(rom, a + y), new Set(got), new Set(seen));
                a += y + 2;
                continue;
            }
            if (b === 0xFB) {
                const script = ((rom[file(a + 4)] << 16) | word(rom, a + 2)) + 3, param = rom[file(a + 1)], key = script + ':' + param;
                if (!found.has(key)) found.set(key, { script, param, at: a, always: false });
                got.add(key);
                a += 5;
                continue;
            }
            if (b === 0xFD) { a += 7; continue; }
            if (b === 0xFE) { a += 5; continue; }
            if (b === 0xF0) { a += 7; continue; }
            if (b > 0xF0) break;
            a += (rom[file(a + 3)] & 0xC0) === 0xC0 ? 16 : 10;
        }
        paths.push(got);
    };
    walk(start, new Set(), new Set());
    for (const [key, h] of found) h.always = paths.every((p) => p.has(key));
    return [...found.values()];
}

/** One frame of a palette animation: `colours` written from colour `first`, shown for `hold` frames. */
export interface PaletteFrame { first: number; colours: number[]; hold: number }

/** The frames palette helper `param` shows, one loop of them (steps expanded: a step of n frames is n frames). */
export function paletteFrames(rom: Uint8Array, param: number): PaletteFrame[] {
    const list = (PALETTE_TABLE & 0xFF0000) | word(rom, PALETTE_TABLE + param * 2);
    const out: PaletteFrame[] = [];
    for (let k = 0; k < MAX_STEPS; k++) {
        const e = list + k * 6, count = rom[file(e)];
        if (!count) break;
        const bytes = rom[file(e + 4)] + 1, first = rom[file(e + 3)], hold = rom[file(e + 5)] + 1;
        let src = (PALETTE_TABLE & 0xFF0000) | word(rom, e + 1);
        for (let f = 0; f < count; f++, src += bytes) {
            out.push({ first, hold, colours: Array.from({ length: bytes >> 1 }, (_, c) => word(rom, src + c * 2) & 0x7FFF) });
        }
    }
    return out;
}

/** One frame of a character animation: `bytes` from `source` to VRAM word `vram`, shown for `hold` frames. */
export interface TileFrame { source: number; vram: number; bytes: number; hold: number }

/** The frames character helper `param` shows, one loop of them. */
export function tileFrames(rom: Uint8Array, param: number): TileFrame[] {
    // Bit 15 of the word at `$9D:8000 + param × 2` picks another table (base word, bank word at $8D:9407 + the low
    // bits); the param's entry is then read from that table ($8D:93D8, $8D:940D).
    const raw = word(rom, TILE_TABLE + param * 2);
    const base = raw & 0x8000 ? (word(rom, TILE_BANKS + 2 + (raw & 0x7FFF)) << 16) | word(rom, TILE_BANKS + (raw & 0x7FFF)) : TILE_TABLE;
    const list = (base & 0xFF0000) | ((base + word(rom, base + param * 2)) & 0xFFFF);
    const out: TileFrame[] = [];
    for (let k = 0; k < MAX_STEPS; k++) {
        const e = list + k * 8, count = rom[file(e)];
        if (!count) break;
        const bytes = word(rom, e + 5), vram = word(rom, e + 3), hold = rom[file(e + 7)] + 1;
        let source = (base & 0xFF0000) | ((base + word(rom, e + 1)) & 0xFFFF);
        for (let f = 0; f < count; f++, source += bytes) out.push({ source, vram, bytes, hold });
    }
    return out;
}
