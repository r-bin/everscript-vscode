// manifest.json, the memory map (docs/open-evermore/manifest.md): its types, the manifest explode writes for a
// ROM, and the checks implode runs on it. SNES facts only; nothing here names a game.
import type { Findings } from './findings.mts';

export const FORMAT = 'open-evermore', VERSION = 1;
export const FILE = 'manifest.json';

export type Layout = 'hirom' | 'exhirom' | 'sa1';
export type RegionUse = 'resources' | 'header' | 'free' | 'reserved';

export interface Region { name: string; from: string; to: string; use: RegionUse; why?: string }

export interface Manifest {
    format: string;
    version: number;
    game: string;
    base: { release: string; sha1: string; explodedWith: string };
    /**
     * The cartridge implode builds: its layout, the smallest image `size` (hirom: the base size or 4 MiB; exhirom and
     * sa1: 8 MiB), and `grow` (default true): a hirom build that does not fit grows to 4 MiB, then to exhirom.
     */
    memoryMap: { layout: Layout; size: string; fastRom: boolean; sram: string; grow?: boolean };
    regions: Region[];
    placement: Record<string, unknown>;
    renames: { kind: string; from: string; to: string }[];
    /** How explode wrote a kind's files, by kind (`palettes: { format: 'png' }`); the round trip writes them so again. */
    options?: Record<string, Record<string, string>>;
    /** The kinds this tree was exploded with, when not all (`explode --kinds`, to prove kinds apart); the rest is `_base/`. */
    kinds?: string[];
}

// The internal header of a HiROM cartridge, as file offsets (hardware).
const MAP_MODE = 0xFFD5, ROM_SIZE = 0xFFD7, SRAM_SIZE = 0xFFD8;
const HIROM = 0x01, FAST = 0x10;
const HIROM_BASE = 0xC00000;

const UNITS: Record<string, number> = { KiB: 1024, MiB: 1024 * 1024 };

/** '3MiB' → 3145728; null when malformed. */
export function parseSize(s: unknown): number | null {
    const m = typeof s === 'string' ? /^(\d+)(KiB|MiB)$/.exec(s) : null;
    return m ? Number(m[1]) * UNITS[m[2]] : null;
}

export function formatSize(n: number): string {
    return n % UNITS.MiB === 0 ? n / UNITS.MiB + 'MiB' : n / UNITS.KiB + 'KiB';
}

/** '$C08000' → 0xC08000; null when malformed. */
export function parseAddr(s: unknown): number | null {
    return typeof s === 'string' && /^\$[0-9A-Fa-f]{6}$/.test(s) ? parseInt(s.slice(1), 16) : null;
}

export const formatAddr = (n: number): string => '$' + n.toString(16).toUpperCase().padStart(6, '0');

/** HiROM: file offset → its bus address in $C0-$FF (hardware). */
export const busOf = (offset: number): number => HIROM_BASE + offset;
export const fileOf = (bus: number): number => bus - HIROM_BASE;

/** What the cartridge header says about the memory map. */
export function headerMemoryMap(rom: Uint8Array): Pick<Manifest['memoryMap'], 'fastRom' | 'sram'> & { hirom: boolean } {
    const mode = rom[MAP_MODE], sram = rom[SRAM_SIZE];
    return { hirom: (mode & 0x0F) === HIROM, fastRom: (mode & FAST) !== 0, sram: sram ? formatSize(1024 << sram) : '0KiB' };
}

/** The manifest of a freshly exploded ROM: its own memory map, one region holding all resources. */
export function manifestFor(rom: Uint8Array, game: string, base: Manifest['base']): Manifest {
    const h = headerMemoryMap(rom);
    return {
        format: FORMAT, version: VERSION, game, base,
        memoryMap: { layout: 'hirom', size: formatSize(rom.length), fastRom: h.fastRom, sram: h.sram, grow: true },
        regions: [{ name: 'rom', from: formatAddr(busOf(0)), to: formatAddr(busOf(rom.length - 1)), use: 'resources' }],
        placement: {},
        renames: [],
    };
}

const USES: RegionUse[] = ['resources', 'header', 'free', 'reserved'];

/** Schema and memory map checks (validation.md §2 stage 1, §3); returns the smallest image size, or null on an error. */
export function checkManifest(m: Manifest, f: Findings): number | null {
    const bad = (pointer: string, msg: string) => f.error('schema', FILE, pointer, msg);
    if (m.format !== FORMAT) bad('/format', `must be "${FORMAT}"`);
    if (m.version !== VERSION) bad('/version', `must be ${VERSION}; this tool reads no other`);
    if (typeof m.game !== 'string') bad('/game', 'missing');
    if (!m.base || !/^[0-9a-f]{40}$/.test(m.base.sha1)) bad('/base/sha1', 'must be the base ROM\'s sha1');
    const mm = m.memoryMap;
    if (!mm) { bad('/memoryMap', 'missing'); return null; }
    if (!(['hirom', 'exhirom', 'sa1'] as Layout[]).includes(mm.layout)) f.error('unsupported-layout', FILE, '/memoryMap/layout', `"${mm.layout}": hirom, exhirom or sa1 (manifest.md §1.1)`);
    const size = parseSize(mm.size);
    if (mm.layout === 'hirom' && (size === null || size > 4 * UNITS.MiB || size % (64 * UNITS.KiB))) bad('/memoryMap/size', 'whole 64 KiB banks, at most 4MiB under hirom');
    if (mm.layout !== 'hirom' && size !== 8 * UNITS.MiB) bad('/memoryMap/size', `"8MiB" under ${mm.layout}`);
    if (mm.grow !== undefined && typeof mm.grow !== 'boolean') bad('/memoryMap/grow', 'true or false');
    if (typeof mm.fastRom !== 'boolean') bad('/memoryMap/fastRom', 'true or false');
    if (parseSize(mm.sram) === null && mm.sram !== '0KiB') bad('/memoryMap/sram', 'a size such as "8KiB"');
    if (!Array.isArray(m.regions)) { bad('/regions', 'missing'); return null; }
    return f.failed || size === null ? null : size;
}

/** The regions describe the base image: they must cover it exactly, without overlap (manifest.md §1.3). */
export function checkRegions(m: Manifest, size: number, f: Findings): void {
    const bad = (pointer: string, msg: string) => f.error('schema', FILE, pointer, msg);

    const spans: { name: string; from: number; to: number; i: number }[] = [];
    m.regions.forEach((r, i) => {
        const from = parseAddr(r.from), to = parseAddr(r.to);
        if (from === null || to === null || to < from) return bad(`/regions/${i}`, 'from/to as "$BBAAAA", from ≤ to');
        if (!USES.includes(r.use)) bad(`/regions/${i}/use`, USES.join(' | '));
        if (r.use === 'reserved' && !r.why) bad(`/regions/${i}/why`, 'a reserved region says why');
        spans.push({ name: r.name, from: fileOf(from), to: fileOf(to), i });
    });
    spans.sort((a, b) => a.from - b.from);
    let next = 0;
    for (const s of spans) {
        if (s.from > next) f.error('region-gap', FILE, `/regions/${s.i}`, `no region covers ${formatAddr(busOf(next))}-${formatAddr(busOf(s.from - 1))}`);
        if (s.from < next) f.error('region-overlap', FILE, `/regions/${s.i}`, `"${s.name}" overlaps the region before it`);
        next = Math.max(next, s.to + 1);
    }
    if (next < size) f.error('region-gap', FILE, '/regions', `no region covers ${formatAddr(busOf(next))}-${formatAddr(busOf(size - 1))}`);
    if (next > size) f.error('region-overlap', FILE, '/regions', `regions reach past the ${formatSize(size)} base image`);
}

/** The 4 checksum bytes at $FFDC (complement, checksum): generated, so explode blanks them in `_base/`. */
export const CHECKSUM: { start: number; end: number } = { start: 0xFFDC, end: 0xFFE0 };

/**
 * Writes the header checksum (hardware): the 16-bit sum of every byte, with an image that is not a power of two
 * counted as the largest power of two below its size plus the rest repeated up to that size again (3 MiB = 2 MiB
 * + the last 1 MiB twice). The complement/checksum pair is summed as $FF $FF $00 $00, which the final values
 * always add up to as well.
 */
export function writeChecksum(image: Uint8Array, copies: number[] = [CHECKSUM.start]): number {
    for (const at of copies) image.set([0xFF, 0xFF, 0x00, 0x00], at);
    let low = 1;
    while (low * 2 <= image.length) low *= 2;
    let sum = 0;
    for (let i = 0; i < low; i++) sum += image[i];
    const rest = image.length - low;
    if (rest) {
        let part = 0;
        for (let i = low; i < image.length; i++) part += image[i];
        sum += part * (low / rest);
    }
    const checksum = sum & 0xFFFF;
    for (const at of copies) image.set([~checksum & 0xFF, (~checksum >> 8) & 0xFF, checksum & 0xFF, checksum >> 8], at);
    return checksum;
}

/** The ROM size the header declares (a power of two: Evermore's 3 MiB image declares 4 MiB). */
export const declaredSize = (image: Uint8Array): number => image[ROM_SIZE] ? 1024 << image[ROM_SIZE] : 0;

/** The built image's header must say what the manifest says (manifest.md §1.2, §2). */
export function checkHeader(m: Manifest, image: Uint8Array, f: Findings): void {
    const h = headerMemoryMap(image);
    if (!h.hirom) f.error('header-mismatch', FILE, '/memoryMap/layout', 'the header\'s map mode is not HiROM');
    if (h.fastRom !== m.memoryMap.fastRom) f.error('header-mismatch', FILE, '/memoryMap/fastRom', `the header says fastRom ${h.fastRom}`);
    if (h.sram !== m.memoryMap.sram) f.error('header-mismatch', FILE, '/memoryMap/sram', `the header says ${h.sram}`);
    const declared = declaredSize(image);
    if (declared < image.length) f.error('header-mismatch', FILE, '/memoryMap/size', `the header declares ${formatSize(declared)}, less than the image`);
}
