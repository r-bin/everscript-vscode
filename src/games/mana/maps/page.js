'use strict';
// Ownership: which files the Secret of Mana Maps page loads and in what order, and filling them into
// webview/index.html. Pure (no `vscode`): the host gives a function that turns a file path into the
// webview URI, the test gives `file://`. The page is built from the shared editor shell, so most of
// the list is src/shared/webview/: the same files the Evermore Rooms tab runs on.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', '..');
const SHARED = path.join(SRC, 'shared');
const MAP_VIEW = path.join(SHARED, 'webview', 'map-view');
const CORE = path.join(SHARED, 'webview', 'map-editor-core');
const SHELL = path.join(SHARED, 'webview', 'map-editor-shell');
const WEBVIEW = path.join(__dirname, 'webview');

/** Stylesheets, in the order the Rooms tab cascades them (src/memory/webview/index.js). */
const CSS = {
    sharedCss: path.join(SHARED, 'shared.css'),
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

/**
 * @param {(file: string) => string} uriOf the URI the page uses for a file
 * @param {{cspSource: string, nonce: string, init: object}} v
 */
function pageHtml(uriOf, v) {
    const values = /** @type {Record<string, string>} */ ({
        cspSource: v.cspSource,
        nonce: v.nonce,
        init: JSON.stringify(v.init).replace(/</g, '\\u003c'),
        scripts: SCRIPTS.map(f => `<script nonce="${v.nonce}" src="${uriOf(f)}"></script>`).join('\n'),
    });
    Object.keys(CSS).forEach(k => { values[k] = uriOf(CSS[k]); });
    return fs.readFileSync(path.join(WEBVIEW, 'index.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => values[k] ?? '');
}

module.exports = { pageHtml, ROOTS, CSS, SCRIPTS };
