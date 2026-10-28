// Ownership: what a listing computes at run time, read from the running game: an object index
// that is an expression (script-model icons.ts `live`, `<instruction address>:<operand>`) becomes
// the object it names now. The WRAM read is injected (the emulator's, as soe://ram/ reads it).

import { ScriptRom, decodeAt } from '../../script-vm';
import { liveCells, liveObjectKey } from '../../script-model';

/** Bytes at a 24-bit bus address; rejects (or gives null) without a running game. */
export type ReadMemory = (bus: number, len: number) => Promise<Uint8Array | null | undefined>;

const WRAM = 0x7E0000;

/** Each `live` id → the object key it names in the running game now (`object:<n>:<state>`), null where it cannot be read. One read covers every cell. */
export async function liveObjects(rom: Uint8Array, ids: string[], read: ReadMemory): Promise<Record<string, string | null>> {
    const script = new ScriptRom(rom);
    const lines = ids.map((id) => {
        const [at, i] = id.split(':').map(Number);
        try { return { id, ins: decodeAt(script, at), i }; } catch { return { id, ins: null, i }; }
    });
    const cells = lines.flatMap((l) => (l.ins ? liveCells(l.ins, l.i) : []));
    let byte: (a: number) => number | null = () => null;
    if (cells.length) {
        const lo = Math.min(...cells), hi = Math.max(...cells);
        const got = await Promise.resolve(read(WRAM + lo, hi - lo + 1)).catch(() => null);
        if (got && got.length === hi - lo + 1) byte = (a) => (a >= lo && a <= hi ? got[a - lo] : null);
    }
    const out: Record<string, string | null> = {};
    for (const l of lines) out[l.id] = l.ins ? liveObjectKey(l.ins, l.i, byte) : null;
    return out;
}
