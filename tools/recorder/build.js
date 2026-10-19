// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

/**
 * tools/recorder/build.js  (npm run build:recorder)
 *
 * Packages the SNES CDL Recorder: copies the files it uses (package-files.js)
 * into out/recorder-stage/, adds recorder/package.json (version = the main
 * extension's) and recorder/README.md, and runs vsce there:
 * out/snes-cdl-recorder-<version>.vsix. Needs the built cores and the compiled
 * TypeScript (the npm script builds maps / script first).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { recorderFiles, ROOT } = require('./package-files');

const STAGE = path.join(ROOT, 'out', 'recorder-stage');
const VSCE_CANDIDATES = ['/opt/homebrew/bin/vsce', 'vsce'];

function main() {
    const { files, unresolved } = recorderFiles();
    const missing = files.filter(f => !fs.existsSync(path.join(ROOT, f)));
    if (missing.length) throw new Error('missing (build the cores / TypeScript first):\n  ' + missing.join('\n  '));
    if (unresolved.length) console.log('note: unresolved requires (fallbacks in try/catch):\n  ' + unresolved.join('\n  '));

    fs.rmSync(STAGE, { recursive: true, force: true });
    for (const f of files) {
        const to = path.join(STAGE, f);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(path.join(ROOT, f), to);
    }
    const version = require(path.join(ROOT, 'package.json')).version;
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'recorder', 'package.json'), 'utf8'));
    manifest.version = version;
    fs.writeFileSync(path.join(STAGE, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.copyFileSync(path.join(ROOT, 'recorder', 'README.md'), path.join(STAGE, 'README.md'));
    fs.writeFileSync(path.join(STAGE, '.vscodeignore'), '');

    const out = path.join(ROOT, 'out', `${manifest.name}-${version}.vsix`);
    const vsce = VSCE_CANDIDATES.find(c => c === 'vsce' || fs.existsSync(c));
    execFileSync(vsce, ['package', '--no-dependencies', '--out', out], { cwd: STAGE, stdio: 'inherit' });
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(`\n${path.relative(ROOT, out)}: ${files.length} files, ${kb} KB`);
}

main();
