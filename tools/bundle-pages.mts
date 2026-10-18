// Bundles the code webview pages share with the host into one script per page, from the real
// TypeScript (docs/cleanup.md 5.1 / 5.3): each entry becomes dist/webview/<name>.js, an IIFE that sets
// one global. Run by `npm run build:ts`, so the tests and the package always have them.
//   node tools/bundle-pages.mts
import { build } from 'esbuild';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** name → [entry, global] */
const PAGES: Record<string, [string, string]> = {
    'evermore-sprites': ['src/games/evermore/emulator/page-sprites.ts', 'EvsSprites'],
};

for (const [name, [entry, globalName]] of Object.entries(PAGES)) {
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
        logLevel: 'warning',
    });
}
