// Ownership: reading a page bundle, the code a webview page shares with the host. tools/bundle-pages.mts builds each
// one from its real TypeScript into dist/webview/<name>.js (an IIFE; with `globals` its exports are also set on the
// page's global object, so the page's other scripts call them by name). The host imports the same module directly.

import * as fs from 'fs';
import * as path from 'path';

const cache = new Map<string, string>();

/** The built page bundle `dist/webview/<name>.js` (this module runs from dist/core/webview/). */
function pageBundle(name: string): string {
    let text = cache.get(name);
    if (text === undefined) {
        text = fs.readFileSync(pageBundlePath(name), 'utf8');
        cache.set(name, text);
    }
    return text;
}

/** Where `pageBundle(name)` reads from; the Mana page serves it to the webview by URI. */
function pageBundlePath(name: string): string {
    return path.join(__dirname, '..', '..', '..', 'dist', 'webview', name + '.js');
}

export { pageBundle, pageBundlePath };
