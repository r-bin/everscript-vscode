// The recomp project: its own repository (SecretOfEvermoreRecomp: snesrecomp scaffold, our glue, docs). This repo
// does not write into it: `npm run recomp` leaves the seeds, the annotations and (in reconstructed-c/) the bound C
// here, and the recomp's tools/import.mts copies them over. What the seeds need from it is read here: the
// exclusions it decided (its recomp/seed-exclusions.txt) and the entries its last generation found.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '..', '..');
export const EXCLUSIONS = 'recomp/seed-exclusions.txt';

/** The recomp repository: `--repo`, else SOE_RECOMP, else the sibling checkout. */
export function recompRepo(arg?: string): string {
    return resolve(arg || process.env.SOE_RECOMP || join(REPO, '..', 'SecretOfEvermoreRecomp'));
}

/** The exclusions file's text, or '' when the repository has none. */
export function readExclusions(repo: string): string {
    const f = join(repo, EXCLUSIONS);
    return existsSync(f) ? readFileSync(f, 'utf8') : '';
}

/**
 * Entry PCs of the last generation (src/gen/program_manifest.json, `nodes` keyed "0C98C7:M0X0"): the entries
 * snesrecomp found itself, which the seeds then name with `symbol` lines. Empty before the first generation;
 * `symbol` adds no roots, so the set is the same on the next run.
 */
export function readNodes(repo: string): number[] {
    const f = join(repo, 'src', 'gen', 'program_manifest.json');
    if (!existsSync(f)) return [];
    const keys = Object.keys(JSON.parse(readFileSync(f, 'utf8')).nodes || {});
    return [...new Set(keys.map(k => parseInt(k.slice(0, 6), 16)))];
}
