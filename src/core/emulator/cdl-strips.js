'use strict';

const { pageFile } = require('./page-file');

/**
 * emulator/cdl-strips.js
 *
 * Client script for the CDL tab's strips (see cdl-view.js for the tab and its
 * state): one canvas per 64 KB of ROM and per WRAM bank, one pixel per byte,
 * repainted only for the chunks marked in cdlNeedsPaint; hover descriptions.
 * Shares the tab's globals (cdlRomStrips, cdlWramStrips, cdlNeedsPaint,
 * CDL_COLORS, ...) - both scripts are embedded in the same <script>.
 *
 * Invariant: ASCII only, no backslashes (template literal).
 */

function getCdlStripsScript() {
  return pageFile('cdl-strips.js');
}

module.exports = { getCdlStripsScript };
