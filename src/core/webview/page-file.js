'use strict';

/**
 * core/webview/page-file.js
 *
 * The page files of a feature's part of a webview page: real .js, .css and .html files that sit in a
 * folder next to the module, read when the page is built (no code in template literals). A line
 * `//@@name`, or a number written as an empty comment with @@name in it, is replaced by the value
 * the module hands in.
 *
 * Invariant: Must remain strictly ASCII-only.
 */

const fs = require('fs');
const path = require('path');

/** pageFile(name, values) reads <dir>/<name>; a place marked for a key that has no value throws. */
function pageFiles(dir) {
  return function pageFile(name, values = {}) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const take = (key) => {
      if (!(key in values)) throw new Error(name + ': no value for ' + key);
      return String(values[key]);
    };
    return text.replace(/\/\/@@(\w+)/g, (_, key) => take(key)).replace(/\/\*@@(\w+)\*\/\d+/g, (_, key) => take(key));
  };
}

module.exports = { pageFiles };
