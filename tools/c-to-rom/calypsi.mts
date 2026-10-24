// The Calypsi 65816 C tool chain (closed source, free for personal non-commercial use, not redistributable): fetched
// from its GitHub release into out/toolchains/ on first use, never committed or packaged. macOS gets the .pkg (x86_64
// binaries, run under Rosetta 2 on Apple Silicon), Linux the .deb.
//   node tools/c-to-rom/calypsi.mts      fetch it (no-op when present) and print where it is
import { existsSync, mkdirSync, writeFileSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { REPO } from './emu.mts';

export const CALYPSI_VERSION = '5.18';
const RELEASE = `https://github.com/hth313/Calypsi-tool-chains/releases/download/${CALYPSI_VERSION}/`;
const PACKAGES: Record<string, { file: string; sha256: string }> = {
    darwin: { file: `calypsi-65816-${CALYPSI_VERSION}.pkg`, sha256: '3a95095f9edbc98a0000a43451e78b78a32e3ed3425c1c266b950045ec8ede7e' },
    linux: { file: `calypsi-65816-${CALYPSI_VERSION}.deb`, sha256: '' },
};
export const CALYPSI_HOME = join(REPO, 'out', 'toolchains', `calypsi-65816-${CALYPSI_VERSION}`);

/** Path of a Calypsi tool (cc65816, as65816, ln65816); fetches the tool chain first when it is missing. */
export async function calypsi(tool: 'cc65816' | 'as65816' | 'ln65816'): Promise<string> {
    const bin = join(CALYPSI_HOME, 'bin', tool);
    if (!existsSync(bin)) await fetchCalypsi();
    return bin;
}

async function fetchCalypsi(): Promise<void> {
    const pkg = PACKAGES[process.platform];
    if (!pkg) throw new Error(`no Calypsi package for ${process.platform}: install it by hand into ${CALYPSI_HOME}`);
    const work = CALYPSI_HOME + '.download';
    rmSync(work, { recursive: true, force: true });
    mkdirSync(work, { recursive: true });
    console.error(`fetching ${pkg.file} …`);
    const res = await fetch(RELEASE + pkg.file);
    if (!res.ok) throw new Error(`${RELEASE + pkg.file}: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const sha = createHash('sha256').update(bytes).digest('hex');
    if (pkg.sha256 && sha !== pkg.sha256) throw new Error(`${pkg.file}: sha256 ${sha}, expected ${pkg.sha256}`);
    const file = join(work, pkg.file);
    writeFileSync(file, bytes);
    let root: string;
    if (process.platform === 'darwin') {
        execFileSync('pkgutil', ['--expand-full', file, join(work, 'x')]);
        root = join(work, 'x', 'Payload', 'usr', 'local', 'lib', `calypsi-65816-${CALYPSI_VERSION}`);
    } else {
        execFileSync('ar', ['x', file], { cwd: work });
        const data = readdirSync(work).find(f => f.startsWith('data.tar'));
        if (!data) throw new Error(`${pkg.file}: no data.tar inside`);
        execFileSync('tar', ['xf', data], { cwd: work });
        root = join(work, 'usr', 'local', 'lib', `calypsi-65816-${CALYPSI_VERSION}`);
    }
    if (!existsSync(join(root, 'bin', 'cc65816'))) throw new Error(`${pkg.file}: no bin/cc65816 under ${root}`);
    rmSync(CALYPSI_HOME, { recursive: true, force: true });
    renameSync(root, CALYPSI_HOME);
    rmSync(work, { recursive: true, force: true });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const cc = await calypsi('cc65816');
    console.log(execFileSync(cc, ['--version']).toString().trim(), '\n' + CALYPSI_HOME);
}
