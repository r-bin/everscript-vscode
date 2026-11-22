// What an animation record shows, for the reader (docs/open-evermore/resources.md §characters): its facings, each
// facing's frames (the sprites its script draws, in script order) and each frame's pieces, naming the sprite blocks
// (sprite_blocks_16/, sprite_blocks_8/). Derived from the ROM by the repo's decoders; implode reads none of it, the
// record id is what a file holds.
//
// Facts used (src/games/evermore/maps/animation-table.ts, sprites.ts, docs/entities/character_table.md):
//   record    an offset in bank $C4: [script:16][bank:8][flags:8]; flags bit 7: eight records, one per facing; bit 6:
//             four (north, east, south, west)
//   frames    the sprites the script names (sprite commands $22-$2B and the long forms), each a list of chunks:
//             x, y (signed, from the origin), a block id (16×16 or 8×8), flips, palette
import { createRequire } from 'node:module';
import type { NameOf } from '../../codec.mts';

const require = createRequire(import.meta.url);
const table = require('../../../../dist/games/evermore/maps/animation-table');
const sprites = require('../../../../dist/games/evermore/maps/sprites');

const BANK = 0xC4, FOUR = ['north', 'east', 'south', 'west'];
const hex = (v: number, n: number) => v.toString(16).toUpperCase().padStart(n, '0');
const bus = (v: number) => `$${hex(v >>> 16, 2)}:${hex(v & 0xFFFF, 4)}`;

/** The facings, frames and pieces of record `record` (null for 0, no animation). */
export function describeRecord(rom: Uint8Array, record: number, name: NameOf): Record<string, unknown> | null {
    if (!record) return null;
    const flags = rom[((BANK & 0x3F) << 16) | (record + 3)];
    const facings: [string, number][] = flags & 0x80 ? Array.from({ length: 8 }, (_, i) => [`facing_${i}`, 2 * i])
        : flags & 0x40 ? FOUR.map((f, i) => [f, 4 * i]) : [['any', 0]];
    const out: Record<string, unknown> = {};
    for (const [label, facing] of facings) {
        let script: number;
        try { script = table.facingScript(rom, record, facing); } catch { continue; }
        let frames: number[] = [];
        try { frames = [...new Set<number>(sprites.scriptSprites(rom, script))]; } catch { /* a command of unknown width: unwalked */ }
        out[label] = {
            script: bus(script),
            frames: frames.map(a => {
                let chunks: { x: number; y: number; block: number; large: boolean; flipX: boolean; flipY: boolean; palette: number }[] = [];
                try { chunks = sprites.readSpriteInfo(rom, a).chunks; } catch { /* outside the image */ }
                return {
                    sprite: bus(a),
                    pieces: chunks.map(c => ({
                        block: name(c.large ? 'sprite_blocks_16' : 'sprite_blocks_8', c.block), x: c.x, y: c.y,
                        ...(c.flipX || c.flipY ? { flip: `${c.flipX ? 'x' : ''}${c.flipY ? 'y' : ''}` } : {}), palette: c.palette,
                    })),
                };
            }),
        };
    }
    return out;
}
