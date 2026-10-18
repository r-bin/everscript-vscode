// Ownership: which files the Secret of Mana Maps page loads and in what order, and filling them into
// webview/index.html. Pure (no `vscode`): the host gives a function that turns a file path into the
// webview URI, the test gives `file://`. The page is built from the shared editor shell, so most of
// the list is src/core/map-editor/ and src/core/webview/: the same files the Evermore Rooms tab runs on.

import * as fs from 'fs';
import * as path from 'path';
import { sourceDir } from '../../../platform/source-dir';

const HERE = sourceDir(__dirname);
const SRC = path.join(HERE, '..', '..', '..');
const SHARED = path.join(SRC, 'core', 'webview');
const MAP_EDITOR = path.join(SRC, 'core', 'map-editor');
const MAP_VIEW = path.join(MAP_EDITOR, 'view');
const CORE = path.join(MAP_EDITOR, 'core');
const SHELL = path.join(MAP_EDITOR, 'shell');
const WEBVIEW = path.join(HERE, 'webview');

/** Stylesheets, in the order the Rooms tab cascades them (src/games/evermore/memory/webview/index.js). */
const CSS: Record<string, string> = {
    sharedCss: path.join(SHARED, 'shared.css'),
    sharedEditorCss: path.join(SHARED, 'shared-map-editor.css'),
    sharedTabsCss: path.join(SHARED, 'shared-tabs.css'),
    shellTabsCss: path.join(SHELL, 'shell-tabs.css'),
    shellCanvasCss: path.join(SHELL, 'shell-canvas.css'),
    mapViewCss: path.join(MAP_VIEW, 'map-view.css'),
    coreCss: path.join(CORE, 'map-editor-core.css'),
    shellRailCss: path.join(SHELL, 'shell-rail.css'),
    shellLayoutCss: path.join(SHELL, 'shell-layout.css'),
    styleUri: path.join(WEBVIEW, 'style.css'),
};

/** Scripts, in load order: shared chips and animation, the core, the shell, then this page. */
const SCRIPTS = [
    path.join(MAP_VIEW, 'tile-animation.js'), path.join(MAP_VIEW, 'view-chips.js'),
    path.join(CORE, 'edit-history.js'), path.join(CORE, 'edit-session.js'), path.join(CORE, 'edit-tools.js'),
    path.join(SHELL, 'frame.js'), path.join(SHELL, 'layout.js'), path.join(SHELL, 'zoom-pan.js'),
    path.join(SHELL, 'pan.js'), path.join(SHELL, 'rail.js'), path.join(SHELL, 'status.js'),
    ...['editor-model.js', 'editor-props.js', 'map-svg.js', 'editor-overlays.js', 'editor-stage.js', 'editor-tools.js', 'editor-dock.js',
        'editor-dock-cells.js', 'editor.js', 'main.js'].map(f => path.join(WEBVIEW, f)),
];

/** Every directory the page reads from (the host's localResourceRoots). */
const ROOTS = [WEBVIEW, MAP_VIEW, CORE, SHELL, SHARED];

/** The page's HTML; `uriOf` turns a file path into the URI the page uses for it. */
function pageHtml(uriOf: (file: string) => string, v: { cspSource: string; nonce: string; init: object; }): string {
    const values: Record<string, string> = ({
        cspSource: v.cspSource,
        nonce: v.nonce,
        init: JSON.stringify(v.init).replace(/</g, '\\u003c'),
        scripts: SCRIPTS.map(f => `<script nonce="${v.nonce}" src="${uriOf(f)}"></script>`).join('\n'),
    });
    Object.keys(CSS).forEach(k => { values[k] = uriOf(CSS[k]); });
    return fs.readFileSync(path.join(WEBVIEW, 'index.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => values[k] ?? '');
}

export { pageHtml, ROOTS, CSS, SCRIPTS };
