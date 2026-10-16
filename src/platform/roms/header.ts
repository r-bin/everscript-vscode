// SNES cartridge header: where it is and what it says. SNES hardware facts only, no game knowledge.
// The header is 32 bytes ending just before the CPU vectors; its position depends on the memory map.

export type MapKind = 'lorom' | 'hirom' | 'exhirom';

export interface RomHeader {
    /** File offset of the header (after any copier header was skipped). */
    offset: number;
    kind: MapKind;
    /** 21 characters, trailing spaces removed. */
    title: string;
    /** Map mode byte, e.g. $31 = HiROM FastROM, $21 = HiROM SlowROM, $20 = LoROM. */
    mapMode: number;
    romSizeLog2Kb: number;
    /** Destination code: $00 Japan, $01 North America, $02 Europe, $06 France, $08 Spain, $09 Germany, ... */
    region: number;
    version: number;
    checksum: number;
    complement: number;
    /** True when checksum ^ complement == $FFFF. */
    checksumPairOk: boolean;
    /** Native-mode vectors (bank $00 addresses) right after the header: COP, BRK, ABORT, NMI, RESET, IRQ. */
    nativeVectors: { cop: number; brk: number; abort: number; nmi: number; reset: number; irq: number };
}

/** `LoROM` / `HiROM` / `ExHiROM`, as tools and exports print the map. */
export function layoutName(kind: MapKind): 'LoROM' | 'HiROM' | 'ExHiROM' {
    return kind === 'lorom' ? 'LoROM' : kind === 'hirom' ? 'HiROM' : 'ExHiROM';
}

const CANDIDATES: [number, MapKind][] = [[0x40ffc0, 'exhirom'], [0xffc0, 'hirom'], [0x7fc0, 'lorom']];

/** Destination codes that mean a 50 Hz (PAL) console. */
const PAL_REGIONS = new Set([0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x11]);

export function isPal(region: number): boolean {
    return PAL_REGIONS.has(region);
}

/** Bytes of the ROM itself: drops a 512-byte copier header when the size says there is one. */
export function stripCopierHeader(file: Uint8Array): Uint8Array {
    return file.length % 1024 === 512 ? file.subarray(512) : file;
}

function readAt(rom: Uint8Array, offset: number, kind: MapKind): RomHeader | null {
    if (offset + 32 > rom.length) return null;
    const h = rom.subarray(offset, offset + 32);
    const title = String.fromCharCode(...h.subarray(0, 21)).replace(/\s+$/, '');
    const complement = h[0x1c] | (h[0x1d] << 8);
    const checksum = h[0x1e] | (h[0x1f] << 8);
    const vec = (at: number) => (rom[offset + at] ?? 0) | ((rom[offset + at + 1] ?? 0) << 8);
    return {
        offset, kind, title,
        mapMode: h[0x15],
        romSizeLog2Kb: h[0x17],
        region: h[0x19],
        version: h[0x1b],
        checksum, complement,
        checksumPairOk: (checksum ^ complement) === 0xffff,
        nativeVectors: { cop: vec(0x24), brk: vec(0x26), abort: vec(0x28), nmi: vec(0x2a), reset: vec(0x2c), irq: vec(0x2e) },
    };
}

function score(h: RomHeader): number {
    let s = 0;
    if (h.checksumPairOk) s += 4;
    if (/^[\x20-\x7e]+$/.test(h.title) && h.title.length > 0) s += 2;
    const low = h.mapMode & 0x0f;
    if (h.kind === 'lorom' && low === 0x00) s += 2;
    if (h.kind === 'hirom' && low === 0x01) s += 2;
    if (h.kind === 'exhirom' && low === 0x05) s += 2;
    // A header names the map it sits in; an ExHiROM file also carries a HiROM-looking copy at $FFC0.
    return s;
}

/** The most plausible header of a ROM (copier header already stripped), or null. */
export function readHeader(rom: Uint8Array): RomHeader | null {
    let best: RomHeader | null = null;
    let bestScore = -1;
    for (const [offset, kind] of CANDIDATES) {
        const h = readAt(rom, offset, kind);
        if (!h) continue;
        const s = score(h);
        if (s > bestScore) { best = h; bestScore = s; }
    }
    return bestScore >= 4 ? best : null;
}
