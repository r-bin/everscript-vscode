// Ownership: which files the Secret of Mana Maps page loads and in what order, and filling them into
// webview/index.html. Pure (no `vscode`): the host gives a function that turns a file path into the
// webview URI, the test gives `file://`. The page is built from the shared editor shell, so most of
// the list is core/webview/editor-page.ts': the same files the Evermore Rooms tab runs on.

import * as path from 'path';
import { sourceDir } from '../../../platform/source-dir';
import { EDITOR_CSS, EDITOR_ROOTS, MAP_CORE, MAP_VIEW, SHELL_SCRIPTS, editorPageHtml } from '../../../core/webview/editor-page';

const WEBVIEW = path.join(sourceDir(__dirname), 'webview');

/** Stylesheets, in the order the Rooms tab cascades them (src/games/evermore/memory/webview/index.ts). */
const CSS: Record<string, string> = { ...EDITOR_CSS, styleUri: path.join(WEBVIEW, 'style.css') };

/** Scripts, in load order: shared chips and animation, the core, the shell, then this page. */
const SCRIPTS = [
    path.join(MAP_VIEW, 'tile-animation.js'), path.join(MAP_VIEW, 'view-chips.js'),
    path.join(MAP_CORE, 'edit-history.js'), path.join(MAP_CORE, 'edit-session.js'), path.join(MAP_CORE, 'edit-tools.js'),
    ...SHELL_SCRIPTS,
    ...['editor-model.js', 'editor-props.js', 'map-svg.js', 'editor-overlays.js', 'editor-stage.js', 'editor-tools.js', 'editor-dock.js',
        'editor-dock-cells.js', 'editor.js', 'main.js'].map(f => path.join(WEBVIEW, f)),
];

/** Every directory the page reads from (the host's localResourceRoots). */
const ROOTS = [WEBVIEW, ...EDITOR_ROOTS];

/** The page's HTML; `uriOf` turns a file path into the URI the page uses for it. */
function pageHtml(uriOf: (file: string) => string, v: { cspSource: string; nonce: string; init: object; }): string {
    return editorPageHtml(path.join(WEBVIEW, 'index.html'), CSS, SCRIPTS, uriOf, v);
}

export { pageHtml, ROOTS };
