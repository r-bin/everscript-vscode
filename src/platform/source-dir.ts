// Ownership: the source folder of a compiled module. TypeScript builds to dist/, mirroring src/
// (tsconfig.build.json), but the files a module reads beside it (webview pages, knowledge entries,
// kits it copies) stay in src/. In the host bundle each module's __dirname is its dist/ folder too
// (tools/bundle.mts), so the same mapping holds there.

import * as path from 'path';

/** `…/dist/<path>` → `…/src/<path>`; a folder outside dist/ (a JS module in src/) is returned as it is. */
export function sourceDir(dir: string): string {
    const parts = dir.split(/[\\/]/);
    const at = parts.lastIndexOf('dist');
    if (at < 0) return dir;
    parts[at] = 'src';
    return parts.join(path.sep);
}
