/**
 * core/emulator/page-file.ts
 *
 * The emulator page's own parts as real files: scripts, style sheets and HTML in webview/, read when
 * the page is built (core/webview/page-file.ts).
 *
 * Invariant: Must remain strictly ASCII-only.
 */

import * as path from 'path';
import { pageFiles } from '../webview/page-file';
import { sourceDir } from '../../platform/source-dir';

export const pageFile = pageFiles(path.join(sourceDir(__dirname), 'webview'));
