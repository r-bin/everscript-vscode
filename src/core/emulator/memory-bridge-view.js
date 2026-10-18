'use strict';

const { pageFile } = require('./page-file');

/**
 * emulator/memory-bridge-view.js
 *
 * Page side of memory-bridge.js: answers { command: 'soeRequest' } with the
 * bytes at a bus address (kind 'read') or the run state (kind 'status'). The debugger core reads any bus address through
 * readMemoryRange (4 KB per call); the vanilla core only has its save state,
 * so it serves WRAM from there (offset 0x10c14, verified on that core).
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getMemoryBridgeClientScript() {
  return pageFile('memory-bridge.js');
}

module.exports = { getMemoryBridgeClientScript };
