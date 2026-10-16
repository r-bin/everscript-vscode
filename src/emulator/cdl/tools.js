'use strict';

/**
 * emulator/cdl/tools.js
 *
 * What the CDL tab can do with a library beyond recording it: the Asar and
 * WRAM exports and the "who?" lookup. The full extension hands this to the
 * emulator panel (configureEmulator({ cdlTools })); the SNES CDL Recorder does
 * not, so none of it - nor what it requires - ships in the recorder.
 */

const { exportAsar } = require('./asar-export');
const { exportWram } = require('./wram-export');
const { lookup } = require('./lookup');
const { findTables } = require('./tables');
const { buildIndex } = require('./xref-index');
const { getActiveAddressLookup } = require('../address-lookup');
const { hex } = require('./rom-map');

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
