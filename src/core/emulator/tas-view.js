'use strict';

const { pageFile } = require('./page-file');

/**
 * emulator/tas-view.js
 *
 * Input recording and replay, webview half (host half: tas/host.js):
 *  - every boot of a ROM starts an input recording; each emulated frame's pad
 *    word is buffered and sent to the host in batches (and on pause / ROM
 *    change / tab hide), so the SSD sees one small append per two seconds;
 *  - the REPLAYS tab of the pause menu lists this ROM's recordings (rows and their
 *    keys: webview/replays-list.js); playing one closes the menu, then reboots
 *    the loaded ROM (with the custom core's EVS_TAS build a restart is a true
 *    power-on) and feeds the recorded pads frame by frame; "take over" or the end
 *    hands control back to the keyboard while the new recording continues as a branch;
 *    the first desync, or a full replay in sync, is written into the recording (host);
 *  - the input overlay (OVERLAYS tab, INPUTS chip) draws the pad fed to the core this frame.
 *
 * Beyond the pad, a movie also records everything that changes the emulation
 * from outside (movie.js documents the lines): memory writes made through
 * Module.writeMemory (cheats, object states, menu toggles, injected scripts;
 * a hook installed once records them, WRAM writes that change nothing are
 * dropped), soft resets, and a WRAM checksum every TAS_CHECK_EVERY frames. A
 * replay applies the same events at the same frame boundaries and compares the
 * checksums, so a desync is reported at the first checkpoint that differs.
 * Opening the pause menu changes nothing by itself: no frame runs while it is
 * open, so only what is done in it (a flag toggle = a write, reset = an event) counts.
 *
 * tasApplyInput() is the only place the frame loop sets joypads.
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getTasCss() {
  return pageFile('tas.css');
}

// REC / PLAY / DESYNC on the screen; opens the pause menu on REPLAYS.
function getTasBadgeHtml() {
  return `<button id="tas-rec-badge" type="button" title="Replays (opens the pause menu)" style="display:none">no ROM</button>`;
}

function getTasChipHtml() {
  return `<button id="screen-inputs-toggle" class="screen-chip" type="button" title="Toggle the input overlay (the pad fed to the core each frame)">INPUTS OFF</button>`;
}

function getTasOverlayHtml() {
  return `<canvas id="tas-input-overlay" width="236" height="160"></canvas>`;
}

function getTasViewHtml() {
  return `
    <div id="ss-view-tas" class="ss-tab-view">
      <div id="tas-status"></div>
      <div id="tas-list"><div id="tas-empty">Every session is recorded automatically from power-on. Load a ROM to start.</div></div>
    </div>
  `;
}

function getTasClientScript() {
  return pageFile('tas.js');
}

module.exports = { getTasCss, getTasBadgeHtml, getTasChipHtml, getTasOverlayHtml, getTasViewHtml, getTasClientScript };
