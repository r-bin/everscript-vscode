// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// Shared by the Secret of Mana Maps page tests: the real page (src/games/mana/maps/page.ts, the same file list the
// host uses) with `file://` URIs, written to a temp dir. The page is the shared editor shell plus the Mana editor.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pageHtml } = require('../../dist/games/mana/maps/page');

const url = p => 'file://' + p;

/** Write the page for `init` into a new temp dir; returns {dir, page (file path)}. */
function writePage(init, somBase) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mana-page-'));
    const page = path.join(dir, 'page.html');
    fs.writeFileSync(page, pageHtml(url, { cspSource: "file: 'self'", nonce: 'n1', init: Object.assign({ somBase }, init) }));
    return { dir, page };
}

module.exports = { writePage, url };
