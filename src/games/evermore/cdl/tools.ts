/**
 * games/evermore/cdl/tools.ts
 *
 * What the CDL tab can do with a library beyond recording it: the Asar and
 * WRAM exports (the panel runs them in a worker: exportInBackground,
 * export-job.ts) and the "who?" lookup. The full extension hands this to the
 * emulator panel (configureEmulator({ cdlTools })); the SNES CDL Recorder does
 * not, so none of it - nor what it requires - ships in the recorder.
 */

import type { CdlLibrary } from '../../../platform/cdl/library';
import type { ExportOptions } from '../../../platform/cdl/asar-export';
import * as asar from '../../../platform/cdl/asar-export';
import { evermoreRegions } from './regions';
import { exportWram } from '../../../platform/cdl/wram-export';
import { lookup } from '../../../platform/cdl/lookup';
import { findTables } from '../../../platform/cdl/tables';
import { buildIndex } from '../../../platform/cdl/xref-index';
import { getActiveAddressLookup } from '../emulator/address-lookup';
import { hex } from '../../../platform/cdl/rom-map';
import { exportInBackground } from './export-job';

/** The Asar export with Evermore's known regions (rooms, strings, enter scripts) seeded. */
function exportAsar(lib: CdlLibrary, rom: Uint8Array, outDir: string, opts: ExportOptions = {}) {
    return asar.exportAsar(lib, rom, outDir, { gameRegions: evermoreRegions, ...opts });
}

/** addr -> "$928000 (script name +$12)" for script instructions; plain address when unnamed. */
function scriptNamer(romBody: Uint8Array) {
    let starts: number[] = [];
    let table: ReturnType<typeof getActiveAddressLookup> | null = null;
    try {
        table = getActiveAddressLookup(romBody, null);
        starts = [...table.lookupMap.keys()].sort((a, b) => a - b);
    } catch (_) { /* no names: plain addresses */ }
    return (addr: number) => {
        let lo = 0, hi = starts.length - 1, best = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (starts[mid] <= addr) { best = starts[mid]; lo = mid + 1; } else hi = mid - 1;
        }
        const plain = '$' + hex(addr, 6);
        if (best < 0 || addr - best > 0x800 || (best >>> 16) !== (addr >>> 16)) return plain;
        const info = table!.lookupMap.get(best);
        return plain + ' (' + (info ? info.name : '?') + (addr !== best ? ' +$' + hex(addr - best, 2) : '') + ')';
    };
}

export { exportAsar, exportWram, exportInBackground, lookup, findTables, buildIndex, scriptNamer };
