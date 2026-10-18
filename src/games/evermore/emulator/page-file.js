'use strict';

/**
 * games/evermore/emulator/page-file.js
 *
 * The page files of Evermore's part of the emulator page (webview/): real .js, .css and .html files,
 * read when the page is built. A line `//@@name`, or a number written as an empty comment with @@name
 * in it, is replaced by the value the host hands in.
 *
 * Invariant: Must remain strictly ASCII-only.
 */

const fs = require('fs');
const path = require('path');

/** The text of webview/<name>, with each marked place (see above) replaced by values[key]. */
function pageFile(name, values = {}) {
  const text = fs.readFileSync(path.join(__dirname, 'webview', name), 'utf8');
  const take = (key) => {
    if (!(key in values)) throw new Error(name + ': no value for @@' + key);
    return String(values[key]);
  };
  return text.replace(/\/\/@@(\w+)/g, (_, key) => take(key)).replace(/\/\*@@(\w+)\*\/\d+/g, (_, key) => take(key));
}

module.exports = { pageFile };
