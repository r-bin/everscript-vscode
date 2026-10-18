'use strict';

const { pageFile } = require('./page-file');

/**
 * emulator/cdl-float.js
 *
 * Scrolling-combat-text for CDL coverage: when a ROM bank's coverage grows, a
 * "C4 +0.8%" number rises from the active character (entity pointer at
 * $7E0F42) and fades out; the centre of the screen when the character is off
 * screen. Gains of one tick are batched per bank; size grows with the gain.
 *
 * Invariant: ASCII only, no backslashes in the client script (template literal).
 */

function getCdlFloatCss() {
  return pageFile('cdl-float.css');
}

function getCdlFloatHtml() {
  return `<div id="cdl-float-layer"></div>`;
}

function getCdlFloatScript() {
  return pageFile('cdl-float.js');
}

module.exports = { getCdlFloatCss, getCdlFloatHtml, getCdlFloatScript };
