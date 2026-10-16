// Marker our builders write into a ROM they derive from a base Evermore ROM (multi-game.md §4), so the
// plugin keeps its address features on the result. Layout (our own format):
//   'EVSX'  version (1)  kind length  kind (ASCII)  base SHA-1 (20 bytes)
// Places: the table hack's directory at file 0x310000 ($F1:0000), else the last 64 bytes of the file
// (the ExHiROM build leaves them $FF).
import type { DerivedMarker } from '../../platform/games';

const MAGIC = [0x45, 0x56, 0x53, 0x58]; // 'EVSX'
export const MARKER_SPOTS = (size: number): number[] => [0x310000, size - 64];

function readAt(rom: Uint8Array, at: number): DerivedMarker | null {
    if (at < 0 || at + 64 > rom.length) return null;
    for (let i = 0; i < 4; i++) if (rom[at + i] !== MAGIC[i]) return null;
    if (rom[at + 4] !== 1) return null;
    const len = rom[at + 5];
    if (len === 0 || len > 32) return null;
    const kind = String.fromCharCode(...rom.subarray(at + 6, at + 6 + len));
    const sha = rom.subarray(at + 6 + len, at + 26 + len);
    return { kind, baseSha1: Array.from(sha, (b) => b.toString(16).padStart(2, '0')).join('') };
}

export function readDerivedMarker(rom: Uint8Array): DerivedMarker | null {
    for (const at of MARKER_SPOTS(rom.length)) {
        const m = readAt(rom, at);
        if (m) return m;
    }
    return null;
}

/** Writes the marker at `at` (a spot the builder owns); returns the bytes written. */
export function writeDerivedMarker(rom: Uint8Array, at: number, marker: DerivedMarker): number {
    const kind = Array.from(marker.kind, (c) => c.charCodeAt(0) & 0x7f);
    const bytes = [...MAGIC, 1, kind.length, ...kind];
    for (let i = 0; i < 40; i += 2) bytes.push(parseInt(marker.baseSha1.slice(i, i + 2), 16));
    rom.set(bytes, at);
    return bytes.length;
}
