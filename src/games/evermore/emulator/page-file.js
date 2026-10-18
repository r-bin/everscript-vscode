'use strict';

/**
 * games/evermore/emulator/page-file.js
 *
 * The page files of Evermore's part of the emulator page: real .js, .css and .html files in webview/,
 * read when the page is built (core/webview/page-file.js).
 *
 * Invariant: Must remain strictly ASCII-only.
 */

const path = require('path');
const { pageFiles } = require('../../../core/webview/page-file');

module.exports = { pageFile: pageFiles(path.join(__dirname, 'webview')) };
