// Ownership: a ROM room's variants for the Rooms tab — who stands in it per story state
// (simulation/variants.ts) — run in a worker thread, one answer per ROM and room, kept.
//
// A worker because the first analysis of a room can take seconds (Thraxx's chamber ~12 s, its
// boss threads run until the budget), and the extension host must not stall meanwhile.

import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import type { RoomVariant } from '../../simulation';

const answers = new Map<string, Promise<RoomVariant[]>>();

/**
 * The worker's file: next to this one when running from dist/, else the package's own bundle of it
 * (the package leaves out the dist/ modules the worker needs; tools/bundle.mts).
 */
function workerFile(): string {
    const here = path.join(__dirname, 'room-variants-worker.js');
    if (fs.existsSync(path.join(__dirname, '..', '..', 'simulation', 'index.js'))) return here;
    return path.join(__dirname, '..', '..', '..', '..', '..', 'bundle', 'room-variants-worker.js');
}

/** Tells ROMs apart cheaply: the size and a sample of bytes (a patched ROM differs somewhere in them, usually). */
function romKey(rom: Uint8Array): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < rom.length; i += 251) h = Math.imul(h ^ rom[i], 0x01000193) >>> 0;
    return rom.length + ':' + h.toString(16);
}

/** The variants of ROM room `roomId` (0..0x7e). Rejects when the simulation fails. */
function roomVariantsFor(rom: Uint8Array, roomId: number): Promise<RoomVariant[]> {
    const k = romKey(rom) + '#' + roomId;
    let p = answers.get(k);
    if (!p) {
        p = new Promise<RoomVariant[]>((resolve, reject) => {
            const w = new Worker(workerFile(), { workerData: { rom, roomId } });
            w.once('message', (m: { variants?: RoomVariant[]; error?: string }) => {
                if (m.variants) resolve(m.variants); else reject(new Error(m.error || 'no answer'));
            });
            w.once('error', reject);
            w.once('exit', (code) => { if (code) reject(new Error(`the simulation stopped (exit ${code})`)); });
        });
        // A failure is not kept: the next request tries again.
        p.catch(() => answers.delete(k));
        answers.set(k, p);
    }
    return p;
}

export { roomVariantsFor };
