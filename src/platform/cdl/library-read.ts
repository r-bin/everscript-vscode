// Ownership: reading a ROM's CDL library for display (the Code tab, the ROM tab): one loaded library per
// directory, loaded again only when its manifest changes (a flush), and per-instruction views of it
// (what an instruction touched, the DB / D it ran with) indexed once per loaded library.
// Read-only: never flushes, never merges.

import * as fs from 'fs';
import * as path from 'path';
import { CdlLibrary, romHash } from './library';
import { regsByPc } from './library-ext';

/** What one instruction (by the bus address it ran at) did while recorded. */
interface PcFacts {
    /** [space << 24 | address, xref flags] for each distinct address it touched (capped per space, see `counts`). */
    xrefs: [number, number][];
    /** space -> how many distinct addresses it touched (above the cap the xrefs list stops). */
    counts: Map<number, number>;
    db: number[];
    d: number[];
}
interface CdlView { lib: CdlLibrary; at(pc: number): PcFacts | null }

const loaded = new Map<string, { stamp: number; view: CdlView }>();
const hashes = new WeakMap<Uint8Array, string>();   // a ROM buffer's SHA-1, hashed once

/** The index behind `at`: built on first use, it walks every xref once. */
function makeView(lib: CdlLibrary): CdlView {
    let byPc: Map<number, PcFacts> | null = null;
    const index = (): Map<number, PcFacts> => {
        const out = new Map<number, PcFacts>();
        const get = (pc: number): PcFacts => {
            let f = out.get(pc);
            if (!f) { f = { xrefs: [], counts: new Map(), db: [], d: [] }; out.set(pc, f); }
            return f;
        };
        for (const [key, flags] of lib.xrefs) get(Math.floor(key / 0x4000000)).xrefs.push([key % 0x4000000, flags]);
        for (const [key, s] of lib.stats) get(key % 0x1000000).counts.set(Math.floor(key / 0x1000000), s.count);
        for (const [pc, r] of regsByPc(lib)) { const f = get(pc); f.db = [...r.db]; f.d = [...r.d]; }
        return out;
    };
    return { lib, at: (pc) => (byPc || (byPc = index())).get(pc) || null };
}

/** The library of `rom` under `root` for reading, or null when none was recorded. */
function readLibrary(root: string, rom: Uint8Array): CdlView | null {
    let hash = hashes.get(rom);
    if (!hash) { hash = romHash(rom as Buffer); hashes.set(rom, hash); }
    const dir = path.join(root, hash);
    let stamp: number;
    try { stamp = fs.statSync(path.join(dir, 'manifest.json')).mtimeMs; } catch { return null; }
    const hit = loaded.get(dir);
    if (hit && hit.stamp === stamp) return hit.view;
    const view = makeView(new CdlLibrary(root, rom as Buffer));
    loaded.set(dir, { stamp, view });
    return view;
}

export type { CdlView, PcFacts };
export { readLibrary };
