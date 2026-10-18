'use strict';

/**
 * games/evermore/cdl/tools.js
 *
 * What the CDL tab can do with a library beyond recording it: the Asar and
 * WRAM exports and the "who?" lookup. The full extension hands this to the
 * emulator panel (configureEmulator({ cdlTools })); the SNES CDL Recorder does
 * not, so none of it - nor what it requires - ships in the recorder.
 */

const asar = require('../../../platform/cdl/asar-export');
const { evermoreRegions } = require('../../../../dist/games/evermore/cdl/regions');
const { exportWram } = require('../../../platform/cdl/wram-export');
const { lookup } = require('../../../platform/cdl/lookup');
const { findTables } = require('../../../platform/cdl/tables');
const { buildIndex } = require('../../../platform/cdl/xref-index');
const { getActiveAddressLookup } = require('../emulator/address-lookup');
const { hex } = require('../../../../dist/platform/cdl/rom-map');

/** The Asar export with Evermore's known regions (rooms, strings, enter scripts) seeded. */
function exportAsar(lib, rom, outDir, opts = {}) {
    return asar.exportAsar(lib, rom, outDir, { gameRegions: evermoreRegions, ...opts });
}

/** addr -> "$928000 (script name +$12)" for script instructions; plain address when unnamed. */
function scriptNamer(romBody) {
    let starts = [];
    let table = null;
    try {
        table = getActiveAddressLookup(romBody, null);
        starts = [...table.lookupMap.keys()].sort((a, b) => a - b);
    } catch (_) { /* no names: plain addresses */ }
    return addr => {
        let lo = 0, hi = starts.length - 1, best = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (starts[mid] <= addr) { best = starts[mid]; lo = mid + 1; } else hi = mid - 1;
        }
        const plain = '$' + hex(addr, 6);
        if (best < 0 || addr - best > 0x800 || (best >>> 16) !== (addr >>> 16)) return plain;
        const info = table.lookupMap.get(best);
        return plain + ' (' + info.name + (addr !== best ? ' +$' + hex(addr - best, 2) : '') + ')';
    };
}

module.exports = { exportAsar, exportWram, lookup, findTables, buildIndex, scriptNamer };
