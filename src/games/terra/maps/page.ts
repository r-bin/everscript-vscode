// Ownership: which files the Terranigma Maps page loads and in what order, and filling them into
// webview/index.html. Pure (no `vscode`). The page is built from the shared editor shell, so most of the
// list is core/webview/editor-page.ts': the same files the other games' map pages run on.

import * as path from 'path';
import { sourceDir } from '../../../platform/source-dir';
import { pageBundlePath } from '../../../core/webview/page-bundle';
import { EDITOR_CSS, EDITOR_ROOTS, MAP_VIEW, SHELL_SCRIPTS, editorPageHtml } from '../../../core/webview/editor-page';

const WEBVIEW = path.join(sourceDir(__dirname), 'webview');

const CSS: Record<string, string> = { ...EDITOR_CSS, styleUri: path.join(WEBVIEW, 'style.css') };

/** Scripts, in load order: the shared chips, the shell, then this page's bundle (webview/*.dom.ts). */
const SCRIPTS = [path.join(MAP_VIEW, 'view-chips.js'), ...SHELL_SCRIPTS, pageBundlePath('terra-maps')];

/** Every directory the page reads from (the host's localResourceRoots). */
const ROOTS = [WEBVIEW, ...EDITOR_ROOTS];

/** The page's HTML; `uriOf` turns a file path into the URI the page uses for it. */
function pageHtml(uriOf: (file: string) => string, v: { cspSource: string; nonce: string; init: object }): string {
    return editorPageHtml(path.join(WEBVIEW, 'index.html'), CSS, SCRIPTS, uriOf, v);
}

export { pageHtml, ROOTS };
