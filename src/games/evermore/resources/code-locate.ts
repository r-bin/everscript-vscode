// Ownership: where a routine known by its US address sits in another ROM (a PAL release, a rebuilt
// or patched ROM). Pure: two ROM buffers in, an address out.
//
// The signature is the routine's first instructions in the reference (US) ROM with every operand
// that names an address masked (absolute, long, indirect, PEA), since those change when code
// moves; opcodes, immediates, direct-page operands and branch offsets stay. A routine is found
// where it was, else at the one place within WINDOW bytes of it, else (on request) anywhere;
// several places come back as `candidates` (code-catalog.ts picks by the neighbours' shift).

import { OPCODES, instructionLength } from '../../../platform/snes/opcodes-65816';
import { busToFile } from './asm-view';

/** `bytes` with `mask[i]` false where any value matches. */
interface Signature { bytes: number[]; mask: boolean[] }
/** How the routine was found: `same` place, `moved` (with `ambiguous` when several places matched), or `missing`. */
interface Located { addr: number | null; how: 'same' | 'moved' | 'missing'; ambiguous?: boolean; candidates?: number[] }

const MASKED = new Set(['abs', 'absx', 'absy', 'long', 'longx', 'iabs', 'iabsx', 'ilabs', 'pea']);
const MIN_FIXED = 8, MAX_BYTES = 32, WINDOW = 0x8000;

/** The signature of the routine at `bus` in `ref`; null when it is too short to find reliably. */
function signature(ref: Uint8Array, bus: number): Signature | null {
    const start = busToFile(bus);
    if (start === null || start >= ref.length) return null;
    const bytes: number[] = [], mask: boolean[] = [];
    let off = start, m8 = false, x8 = false;
    while (bytes.length < MAX_BYTES && off < ref.length) {
        const op = ref[off], o = OPCODES[op], len = instructionLength(op, m8, x8);
        for (let k = 0; k < len && off + k < ref.length; k++) {
            bytes.push(ref[off + k]);
            mask.push(k === 0 || !MASKED.has(o.mode));
        }
        if (o.mnemonic === 'REP') { if (ref[off + 1] & 0x20) m8 = false; if (ref[off + 1] & 0x10) x8 = false; }
        if (o.mnemonic === 'SEP') { if (ref[off + 1] & 0x20) m8 = true; if (ref[off + 1] & 0x10) x8 = true; }
        off += len;
        if (/^(RTS|RTL|RTI|JMP|JML|BRA|BRL)$/.test(o.mnemonic) && mask.filter(Boolean).length >= MIN_FIXED) break;
    }
    return mask.filter(Boolean).length >= MIN_FIXED ? { bytes, mask } : null;
}

function matchesAt(rom: Uint8Array, off: number, sig: Signature): boolean {
    if (off < 0 || off + sig.bytes.length > rom.length) return false;
    for (let i = 0; i < sig.bytes.length; i++) if (sig.mask[i] && rom[off + i] !== sig.bytes[i]) return false;
    return true;
}

/** File offset -> the bus address code there runs at ($80-$BF upper halves, else $C0+). */
function toBus(off: number): number { return off < 0x400000 && (off & 0xFFFF) >= 0x8000 ? 0x800000 | off : 0xC00000 + off; }

/**
 * Where the routine at `bus` in `ref` sits in `rom`. `anywhere` also searches the whole ROM
 * (one routine at a time: a full scan is a few milliseconds).
 */
function locate(rom: Uint8Array, ref: Uint8Array, bus: number, anywhere = false): Located {
    if (rom === ref) return { addr: bus, how: 'same' };
    const sig = signature(ref, bus), start = busToFile(bus);
    if (!sig || start === null) return { addr: null, how: 'missing' };
    if (matchesAt(rom, start, sig)) return { addr: bus, how: 'same' };
    const lo = anywhere ? 0 : Math.max(0, start - WINDOW), hi = anywhere ? rom.length : Math.min(rom.length, start + WINDOW);
    const found: number[] = [];
    for (let off = lo; off < hi; off++) {
        if (rom[off] === sig.bytes[0] && matchesAt(rom, off, sig)) found.push(off);
    }
    if (!found.length) return { addr: null, how: 'missing' };
    const asBus = (off: number) => ((bus & 0xFF0000) >= 0xC00000 ? 0xC00000 + off : toBus(off));
    const best = found.reduce((a, b) => (Math.abs(b - start) < Math.abs(a - start) ? b : a));
    return found.length > 1 ? { addr: asBus(best), how: 'moved', ambiguous: true, candidates: found.map(asBus) } : { addr: asBus(best), how: 'moved' };
}

export type { Located, Signature };
export { locate, signature };
