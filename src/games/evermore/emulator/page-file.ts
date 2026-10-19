/**
 * games/evermore/emulator/page-file.ts
 *
 * The page files of Evermore's part of the emulator page: real .js, .css and .html files in webview/,
 * read when the page is built (core/webview/page-file.ts).
 *
 * Invariant: Must remain strictly ASCII-only.
 */

import * as path from 'path';
import { pageFiles } from '../../../core/webview/page-file';
import { sourceDir } from '../../../platform/source-dir';

export const pageFile = pageFiles(path.join(sourceDir(__dirname), 'webview'));
