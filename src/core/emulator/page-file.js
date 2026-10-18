'use strict';

/**
 * core/emulator/page-file.js
 *
 * The emulator page's own parts as real files: scripts, style sheets and HTML in webview/, read when
 * the page is built (core/webview/page-file.js).
 *
 * Invariant: Must remain strictly ASCII-only.
 */

const path = require('path');
const { pageFiles } = require('../webview/page-file');

module.exports = { pageFile: pageFiles(path.join(__dirname, 'webview')) };
