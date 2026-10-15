'use strict';
// Shared by the Secret of Mana Maps page tests: the real webview files (panel + shared map-view
// + editor core) filled into index.html the way src/mana-maps/index.js does, written to a temp dir.

const fs = require('fs');
const os = require('os');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'src');
const WV = path.join(SRC, 'mana-maps', 'webview');
const MV = path.join(SRC, 'shared', 'webview', 'map-view');
const CORE = path.join(SRC, 'shared', 'webview', 'map-editor-core');
const url = p => 'file://' + p;

/** Write the page for `init` into a new temp dir; returns {dir, page (file path)}. */
function writePage(init, somBase) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mana-page-'));
    const values = {
        cspSource: "file: 'self'", nonce: 'n1',
        styleUri: url(path.join(WV, 'style.css')), scriptUri: url(path.join(WV, 'main.js')), mapSvgJs: url(path.join(WV, 'map-svg.js')),
        editorModelJs: url(path.join(WV, 'editor-model.js')), editorJs: url(path.join(WV, 'editor.js')),
        coreCss: url(path.join(CORE, 'map-editor-core.css')),
        coreHistoryJs: url(path.join(CORE, 'edit-history.js')), coreSessionJs: url(path.join(CORE, 'edit-session.js')),
        coreGridJs: url(path.join(CORE, 'edit-grid.js')), coreToolsJs: url(path.join(CORE, 'edit-tools.js')),
        mapViewCss: url(path.join(MV, 'map-view.css')), animJs: url(path.join(MV, 'tile-animation.js')), chipsJs: url(path.join(MV, 'view-chips.js')),
        init: JSON.stringify(Object.assign({ somBase }, init)).replace(/</g, '\\u003c'),
    };
    const page = path.join(dir, 'page.html');
    fs.writeFileSync(page, fs.readFileSync(path.join(WV, 'index.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => values[k]));
    return { dir, page };
}

module.exports = { writePage, url };
