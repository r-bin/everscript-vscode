// Ownership: the ROM tab's address formatting. Pure, no state.

import { hiromFileOffset, hex } from '../../../../platform';

/** File offset → the bus address the game uses: `$Cx` for a lower half, `$8x` for an upper half. */
function bus(off: number): string {
    const b = off >> 16, a = off & 0xFFFF;
    return a >= 0x8000 ? `$${hex(0x80 + b, 2)}:${hex(a, 4)}` : `$${hex(0xC0 + b, 2)}:${hex(a, 4)}`;
}

/** Bus address (any mirror) → file offset in a HiROM image. */
const busToFile = hiromFileOffset;

/**
 * Claims a ROM region for the map (rom/build.js): file offsets s..e, its category icon and name, notes,
 * the area (world) it belongs to, its priority (a higher one wins where claims overlap) and extra fields.
 */
type Claim = (s: number, e: number, cat: string, name: string, notes?: string, area?: string, prio?: number, extra?: object) => void;

export type { Claim };
export { hex, bus, busToFile };
