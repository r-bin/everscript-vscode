// Ownership: what every game's map-editor page loads from the shared editor (src/core/map-editor/) and the
// shared page CSS (here), in order, and filling a page's index.html with them. Pure (no `vscode`): the host
// gives a function that turns a file path into the webview URI, a test gives `file://`. Game-neutral: each game's
// `maps/page.ts` adds its own stylesheet and scripts (the Secret of Mana and Terranigma Maps panels).

import * as fs from 'fs';
import * as path from 'path';
import { sourceDir } from '../../platform/source-dir';
import { pageBundlePath } from './page-bundle';

const SHARED = sourceDir(__dirname);
const MAP_EDITOR = path.join(SHARED, '..', 'map-editor');
/** The shared editor's folders: map view (chips, tile animation, tokens), core (history, sessions), shell. */
export const MAP_VIEW = path.join(MAP_EDITOR, 'view');
export const MAP_CORE = path.join(MAP_EDITOR, 'core');
export const MAP_SHELL = path.join(MAP_EDITOR, 'shell');

/** Stylesheets by template key, in the order the Evermore Rooms tab cascades them; a page adds its own `styleUri`. */
export const EDITOR_CSS: Record<string, string> = {
    sharedCss: path.join(SHARED, 'shared.css'),
    sharedEditorCss: path.join(SHARED, 'shared-map-editor.css'),
    sharedTabsCss: path.join(SHARED, 'shared-tabs.css'),
    shellTabsCss: path.join(MAP_SHELL, 'shell-tabs.css'),
    shellCanvasCss: path.join(MAP_SHELL, 'shell-canvas.css'),
    mapViewCss: path.join(MAP_VIEW, 'map-view.css'),
    coreCss: path.join(MAP_CORE, 'map-editor-core.css'),
    shellRailCss: path.join(MAP_SHELL, 'shell-rail.css'),
    shellLayoutCss: path.join(MAP_SHELL, 'shell-layout.css'),
};

/** The shell's scripts, in load order: frame markup (bundled from frame.ts), dock, layout, zoom/pan, pan, rail, status. */
export const SHELL_SCRIPTS = [
    pageBundlePath('shell-frame'), path.join(MAP_SHELL, 'frame-dock.js'), path.join(MAP_SHELL, 'layout.js'),
    path.join(MAP_SHELL, 'zoom-pan.js'), path.join(MAP_SHELL, 'pan.js'), path.join(MAP_SHELL, 'rail.js'), path.join(MAP_SHELL, 'status.js'),
];

/** Every shared directory a page reads from (its host adds them to localResourceRoots). */
export const EDITOR_ROOTS = [MAP_VIEW, MAP_CORE, MAP_SHELL, SHARED, path.dirname(pageBundlePath('shell-frame'))];

/**
 * A page's HTML: `indexHtml` (a file with `{{key}}` slots) filled with the CSP source, nonce, the `#init` JSON,
 * the `scripts` as nonce'd tags and each of `css`'s stylesheets by its key; `uriOf` turns a file path into a URI.
 */
export function editorPageHtml(indexHtml: string, css: Record<string, string>, scripts: string[],
    uriOf: (file: string) => string, v: { cspSource: string; nonce: string; init: object }): string {
    const values: Record<string, string> = {
        cspSource: v.cspSource,
        nonce: v.nonce,
        init: JSON.stringify(v.init).replace(/</g, '\\u003c'),
        scripts: scripts.map(f => `<script nonce="${v.nonce}" src="${uriOf(f)}"></script>`).join('\n'),
    };
    Object.keys(css).forEach(k => { values[k] = uriOf(css[k]); });
    return fs.readFileSync(indexHtml, 'utf8').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => values[k] ?? '');
}
