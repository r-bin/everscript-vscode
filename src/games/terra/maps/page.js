'use strict';
// Terranigma Maps & Room Explorer HTML Page Builder.
// Renders a CSP-compliant webview with the Terranigma celestial-indigo theme,
// Table A room browser, header opcode inspector, and multi-game capability notices. The page is
// webview/page.html, page.css and page.js.

const path = require('path');
const { escapeHtml: escapeEntities } = require('../../../../dist/core/webview/html');
const { pageFiles } = require('../../../core/webview/page-file');

/** The page's files (webview/page.html, page.css, page.js), filled in at their //@@name marks. */
const pageFile = pageFiles(path.join(__dirname, 'webview'));

function renderTerraMapsHtml(params) {
    const { cspSource, nonce, init } = params;
    const values = {
        cspSource, nonce,
        init: JSON.stringify(init).replace(/</g, '\\u003c'),
        variant: escapeHtml(init.variant || 'Europe'),
        tableAOffset: init.tableAOffset, tableBOffset: init.tableBOffset,
        usedCount: init.usedCount, roomCount: init.roomCount, unusedCount: init.unusedCount,
    };
    values.css = pageFile('page.css', values);
    values.script = pageFile('page.js', values);
    return pageFile('page.html', values);
}

function escapeHtml(s) {
    return escapeEntities(String(s || ''));
}

module.exports = { renderTerraMapsHtml };

