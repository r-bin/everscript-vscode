// Terranigma Maps & Room Explorer HTML Page Builder.
// Renders a CSP-compliant webview with the Terranigma celestial-indigo theme,
// Table A room browser, header opcode inspector, and multi-game capability notices. The page is
// webview/page.html, page.css and page.js.

import * as path from 'path';
import { escapeHtml as escapeEntities } from '../../../core/webview/html';
import { pageFiles } from '../../../core/webview/page-file';
import { sourceDir } from '../../../platform/source-dir';

/** The page's files (webview/page.html, page.css, page.js), filled in at their //@@name marks. */
const pageFile = pageFiles(path.join(sourceDir(__dirname), 'webview'));

/** What the page is built from: the CSP source, the nonce and the init data the page script reads. */
interface TerraPageParams {
    cspSource: string; nonce: string;
    init: { variant?: string; tableAOffset: string; tableBOffset: string; usedCount: number; roomCount: number; unusedCount: number; [key: string]: unknown };
}

function renderTerraMapsHtml(params: TerraPageParams) {
    const { cspSource, nonce, init } = params;
    const values: Record<string, unknown> = {
        cspSource, nonce,
        init: JSON.stringify(init).replace(/</g, '\\u003c'),
        variant: escapeHtml(init.variant || 'Europe'),
        tableAOffset: init.tableAOffset, tableBOffset: init.tableBOffset,
        usedCount: init.usedCount, roomCount: init.roomCount, unusedCount: init.unusedCount,
    };
    values.css = pageFile('page.css', values);
    values.script = pageFile('page.js', values);
    return pageFile('page.html', values);
}

function escapeHtml(s: unknown) {
    return escapeEntities(String(s || ''));
}

export { renderTerraMapsHtml };

