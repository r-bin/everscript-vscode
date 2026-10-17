// Bundles the extension host (src/extension.js and everything it requires) into one file,
// bundle/extension.js, the package's `main` (docs/cleanup.md 5.3).
//   node tools/bundle.mts            after npm run build:ts (JS requires compiled TS from dist/)
// The files the code reads at runtime (webview pages, cores, knowledge entries, JSON tables) are not
// bundled: they ship as they are, and each module's __dirname is rewritten to its own folder so those
// reads still find them. Functions the pages splice in with .toString() keep their names (the
// modules stay CommonJS closures; esbuild only renames to avoid clashes at the bundle's top level).
import { build, type Plugin } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'bundle', 'extension.js');

/** `__dirname` in a module -> that module's folder, relative to the bundle (bundle/ sits at the root). */
const dirnames: Plugin = {
    name: 'dirnames',
    setup(b) {
        b.onLoad({ filter: /\.(c?js)$/ }, (args) => {
            if (args.path.includes('/node_modules/')) return undefined;
            const text = readFileSync(args.path, 'utf8');
            if (!/\b__(dirname|filename)\b/.test(text)) return undefined;
            const dir = relative(ROOT, dirname(args.path)).split('\\').join('/');
            const file = relative(ROOT, args.path).split('\\').join('/');
            const out = text
                .replace(/\b__dirname\b/g, `__evsPath(${JSON.stringify(dir)})`)
                .replace(/\b__filename\b/g, `__evsPath(${JSON.stringify(file)})`);
            return { contents: out, loader: 'js' };
        });
    },
};

/**
 * A relative require that does not resolve stays a plain require() (it fails at runtime as it does
 * unbundled; most are lazy), listed as a warning instead of failing the build.
 */
const missing: string[] = [];
const unresolved: Plugin = {
    name: 'unresolved',
    setup(b) {
        b.onResolve({ filter: /^\.\.?\// }, async (args) => {
            if (args.pluginData === 'retry') return undefined;
            const r = await b.resolve(args.path, { kind: args.kind, resolveDir: args.resolveDir, importer: args.importer, pluginData: 'retry' });
            if (r.errors.length === 0) return r;
            missing.push(`${relative(ROOT, args.importer)}: ${args.path}`);
            return { path: args.path, external: true };
        });
    },
};

const result = await build({
    entryPoints: [join(ROOT, 'src', 'extension.js')],
    outfile: OUT,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['vscode'],
    plugins: [unresolved, dirnames],
    banner: { js: "const __evsPath = (p) => require('path').join(__dirname, '..', p);" },
    metafile: true,
    logLevel: 'warning',
    legalComments: 'inline',
});

const inputs = Object.keys(result.metafile.inputs);
writeFileSync(join(ROOT, 'bundle', 'inputs.json'), JSON.stringify(inputs.sort(), null, 1) + '\n');
for (const m of missing) console.warn(`  unresolved (left as require): ${m}`);
console.log(`bundle/extension.js: ${inputs.length} modules, ${(result.metafile.outputs['bundle/extension.js']?.bytes ?? 0) >> 10} KB`);
