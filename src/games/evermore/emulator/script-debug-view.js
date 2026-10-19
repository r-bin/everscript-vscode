// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

const { pageFile } = require('./page-file');

/**
 * emulator/script-debug-view.js
 *
 * Webview half of the VS Code script debugger (host: script-debug-host.ts,
 * session: debugger/emulator-session.ts).
 *
 * The script interpreter fetches every opcode at $8C:D0A6 (lda [$82]), with
 * the instruction's address in $82-$84 and the running slot's pointer in $7E.
 * An exec breakpoint there, armed only while something is wanted, makes the
 * core call sdbgOnHit() at every script instruction; returning false keeps
 * the game running (custom core: a conditional breakpoint), true pauses it
 * right after that one CPU instruction, before the script instruction runs.
 *
 * A stop is wanted on a breakpoint address (ROM offset), a requested pause,
 * or when a step's predicate says so (debugger/script-frames.ts):
 *   { slot, scope, parent, parentScope, ranges: [[start, end)], into, callerOnly }
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getScriptDebugClientScript() {
  return pageFile('script-debug.js');
}

module.exports = { getScriptDebugClientScript };
