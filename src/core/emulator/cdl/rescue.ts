/**
 * emulator/cdl/rescue.ts
 *
 * Deltas a page kept because no host said they were on disk (webview/page/06-cdl-rescue.js): its extension
 * host died, the page parked them in its own storage, and the next emulator page hands them over here.
 * Each goes into the library it was recorded for, once: hit and cycle counters are summed, so a delta at or
 * below the library's `delivered` number for that page session is already on disk and is skipped.
 */

import { CdlLibrary } from '../../../platform/cdl/library';
import { decodeDelta, type WireDelta } from './wire';

/** One kept delta: its number in the page session and the library it was recorded for. */
interface RescueEntry { seq: number; lib: { hash: string; romSize: number }; delta: WireDelta }
interface RescueMessage { session: string; at: number; entries: RescueEntry[] }

/** `session`'s last merged delta is now `seq` (kept last in the manifest's list: the newest sessions stay). */
function markDelivered(lib: CdlLibrary, session: string, seq: number): void {
    delete lib.delivered[session];
    lib.delivered[session] = seq;
}

/**
 * Merges and writes the rescued deltas. `current` is the library the panel has open (merged in place, it
 * writes it); the others are opened from `root`. Throws when a write fails: the page keeps the deltas then.
 */
function applyRescue(root: string, current: CdlLibrary | null, msg: RescueMessage): { applied: number; skipped: number } {
    let applied = 0, skipped = 0;
    const byLib = new Map<string, RescueEntry[]>();
    for (const e of msg.entries || []) {
        if (!e || !e.lib || !e.lib.hash || !e.delta) continue;
        if (!byLib.has(e.lib.hash)) byLib.set(e.lib.hash, []);
        byLib.get(e.lib.hash)!.push(e);
    }
    for (const [hash, entries] of byLib) {
        const lib = current && current.hash === hash ? current : CdlLibrary.open(root, hash, entries[0].lib.romSize);
        const done = lib.delivered[msg.session] ?? 0;
        for (const e of entries.sort((a, b) => a.seq - b.seq)) {
            if (e.seq <= done) { skipped++; continue; }
            lib.applyDelta(decodeDelta(e.delta));
            markDelivered(lib, msg.session, e.seq);
            applied++;
        }
        lib.dirty.add('manifest.json');
        lib.flush();
    }
    return { applied, skipped };
}

export type { RescueMessage, RescueEntry };
export { applyRescue, markDelivered };
