// Ownership: script address arithmetic. Pure.
//
// Ported from SoEScriptDumper/list-rooms.cpp (read_buf*, rom2scriptaddr,
// script2romaddr). See docs/script-format/ and the `script-format` skill.

/** Where the script bank starts in the US ROM. */
export const SCRIPTS_START_ADDR_US = 0x928000;

/**
 * SNES address to an index into the ROM file.
 *
 * Evermore is HiROM, so the bank's top two bits are mirror selects and drop
 * out: $9384D9 and $D384D9 are the same byte.
 */
export function snesToRom(addr: number): number {
    return (addr & ~0xc00000) >>> 0;
}

/** True when the address lands inside the ROM. */
export function addrValid(addr: number, len: number): boolean {
    return snesToRom(addr) < len;
}

export function read8(rom: Uint8Array, addr: number): number {
    const a = snesToRom(addr);
    return a < rom.length ? rom[a] : 0;
}

export function read16(rom: Uint8Array, addr: number): number {
    const a = snesToRom(addr);
    return a + 1 < rom.length ? rom[a] | (rom[a + 1] << 8) : 0;
}

export function read24(rom: Uint8Array, addr: number): number {
    const a = snesToRom(addr);
    return a + 2 < rom.length ? (rom[a] | (rom[a + 1] << 8) | (rom[a + 2] << 16)) >>> 0 : 0;
}

/**
 * A 24-bit script pointer as stored in a table, to the SNES address it means.
 *
 * Script pointers are packed: the low 15 bits are an offset inside a bank and
 * everything above is a bank count, so the bank part doubles on the way out.
 */
export function scriptValueToSnes(value: number, base = SCRIPTS_START_ADDR_US): number {
    return (base + (value & 0x007fff) + ((value & 0xff8000) << 1)) >>> 0;
}

/** Inverse of `scriptValueToSnes`. */
export function snesToScriptValue(addr: number, base = SCRIPTS_START_ADDR_US): number {
    let a = (addr & ~0x8000) >>> 0;
    a = (a - (base & ~0x8000)) >>> 0;
    return ((a & 0x007fff) + ((a & 0x1ff0000) >>> 1)) >>> 0;
}

/** `$1234` — a loRAM address, the form the dumper prints. */
export function ramAddr(n: number): string {
    return '$' + (n & 0xffff).toString(16).padStart(4, '0');
}

/** `0x12` */
export function u8(n: number): string {
    return '0x' + (n & 0xff).toString(16).padStart(2, '0');
}

/** `0x1234` */
export function u16(n: number): string {
    return '0x' + (n & 0xffff).toString(16).padStart(4, '0');
}

/** `0x123456` */
export function u24(n: number): string {
    return '0x' + (n >>> 0).toString(16).padStart(6, '0');
}
