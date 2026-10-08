'use strict';
// Ownership: the ROM tab's address formatting. Pure, no state.

const hex = (n, w) => (n >>> 0).toString(16).toUpperCase().padStart(w, '0');

/** File offset → the bus address the game uses: `$Cx` for a lower half, `$8x` for an upper half. */
function bus(off) {
    const b = off >> 16, a = off & 0xFFFF;
    return a >= 0x8000 ? `$${hex(0x80 + b, 2)}:${hex(a, 4)}` : `$${hex(0xC0 + b, 2)}:${hex(a, 4)}`;
}

/** Bus address (any mirror) → file offset in a HiROM image. */
const busToFile = a => a & 0x3FFFFF;

module.exports = { hex, bus, busToFile };
