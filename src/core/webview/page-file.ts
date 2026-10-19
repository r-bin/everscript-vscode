/**
 * core/webview/page-file.ts
 *
 * The page files of a feature's part of a webview page: real .js, .css and .html files that sit in a
 * folder next to the module, read when the page is built (no code in template literals). A line
 * `//@@name`, or a number written as an empty comment with @@name in it, is replaced by the value
 * the module hands in.
 *
 * Invariant: Must remain strictly ASCII-only.
 */

import * as fs from 'fs';
import * as path from 'path';

/** The text of <dir>/<name>; for a folder, its files in name order (a long script is kept as parts: 01-..., 02-...). */
function read(dir: string, name: string) {
  const file = path.join(dir, name);
  if (!fs.statSync(file).isDirectory()) return fs.readFileSync(file, 'utf8');
  return fs.readdirSync(file).sort().map((part) => fs.readFileSync(path.join(file, part), 'utf8')).join('');
}

/** pageFile(name, values) reads <dir>/<name>; a place marked for a key that has no value throws. */
function pageFiles(dir: string) {
  return function pageFile(name: string, values: Record<string, unknown> = {}) {
    const text = read(dir, name);
    const take = (key: string) => {
      if (!(key in values)) throw new Error(name + ': no value for ' + key);
      return String(values[key]);
    };
    return text.replace(/\/\/@@(\w+)/g, (_, key) => take(key)).replace(/\/\*@@(\w+)\*\/\d+/g, (_, key) => take(key));
  };
}

export { pageFiles };
