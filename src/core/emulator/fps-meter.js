'use strict';

const { pageFile } = require('./page-file');

/**
 * emulator/fps-meter.js
 *
 * Screen chip with two rates, both measured over running (not paused, not
 * hidden) wall time and refreshed once per second:
 *   FPS  - frames the core emulated (every _mainLoop() that ran); drops when
 *          the host cannot keep up;
 *   game - of those, frames in which the game read the joypad (the core's
 *          takeInputPolled, EVS_TAS builds only); drops when the game itself
 *          lags, i.e. spends more than one frame on a frame's work.
 * While paused nothing is counted and the chip keeps its last reading.
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getFpsCss() {
  return pageFile('fps.css');
}

function getFpsChipHtml() {
  return `<span id="screen-fps" class="screen-chip" title="FPS: frames emulated per second. game: frames in which the game read the joypad (fewer = the game lags). Frozen while paused.">-- FPS</span>`;
}

function getFpsClientScript() {
  return pageFile('fps.js');
}

module.exports = { getFpsCss, getFpsChipHtml, getFpsClientScript };
