'use strict';

const { pageFile } = require('./page-file');

/**
 * games/evermore/emulator/stack-view.js
 *
 * Evermore's script VM in the emulator page, handed in through host.js webview(): the 20 script slots
 * at $7E:28FC (STACK panel: chains, detail, the write hook on the slot bytes, byte-script exec
 * breakpoints) and the script execution trace (TRACE panel). panel-webview.js splices both where they
 * always ran and calls them only behind typeof guards.
 *
 * Invariant: Must remain strictly ASCII-only.
 */

function getStackScript() {
  return pageFile('stack');
}

function getTraceScript() {
  return pageFile('trace.js');
}

module.exports = { getStackScript, getTraceScript };
