// Bundles the code webview pages share with the host into one script per page, from the real
// TypeScript (docs/cleanup.md 5.1 / 5.3): each entry becomes dist/webview/<name>.js, an IIFE that sets
// one global. Run by `npm run build:ts`, so the tests and the package always have them.
//   node tools/bundle-pages.mts
import { build } from 'esbuild';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** name → [entry, global, globals]: with `globals` the module's exports are also set on the page's global object, for the page scripts that call them by name. */
const PAGES: Record<string, [string, string, boolean?]> = {
    'evermore-rom': ['src/games/evermore/emulator/page-rom.ts', 'EvsRom'],
    'shell-frame': ['src/core/map-editor/shell/frame.ts', 'ShellFrame', true],
    'music-view': ['src/games/evermore/music/webview/music-view.ts', 'MusicView', true],
    'music-engine': ['src/games/evermore/music/webview/music-engine.ts', 'MusicEngine', true],
};

for (const [name, [entry, globalName, globals]] of Object.entries(PAGES)) {
    await build({
        entryPoints: [join(ROOT, entry)],
        outfile: join(ROOT, 'dist', 'webview', name + '.js'),
        bundle: true,
        format: 'iife',
        globalName,
        platform: 'browser',
        target: 'es2020',
        charset: 'ascii',
        legalComments: 'none',
        footer: globals ? { js: `Object.assign(globalThis, ${globalName});` } : undefined,
        logLevel: 'warning',
    });
}
