// `<kind>/_enum.json`: the one file that turns a kind's unordered folder into an ordered enum
// (docs/open-evermore/README.md §4). `names[i]` is the resource with id i; null is a gap. Everything else in the
// folder is a map by name. Explode writes the vanilla order; implode reads it, and gives a new name the lowest
// free id (a warning until the file lists it). Game-neutral.
import type { Findings } from './findings.mts';
import { json, NAME_RE, readText } from './tree.mts';

export const ENUM = '_enum.json';

export interface EnumFile {
    kind: string;
    /** How many ids the game can address, and why. */
    limit: number;
    why: string;
    names: (string | null)[];
}

export const enumFile = (e: EnumFile): Uint8Array => json(e);

/**
 * Ids for every name in `present`: the enum's own, then the lowest free id for each new name (sorted, so the
 * result never depends on folder order). Null when the enum file is unusable.
 */
export function resolveEnum(path: string, raw: Uint8Array | undefined, present: Set<string>, f: Findings, listedOnly = false, nameRe = NAME_RE): Map<string, number> | null {
    if (!raw) { f.error('missing-file', path, '', 'the enum of this kind is missing'); return null; }
    let e: EnumFile;
    try { e = JSON.parse(readText(raw)); }
    catch (err) { f.error('parse-error', path, '', (err as Error).message); return null; }
    if (!Array.isArray(e.names) || !Number.isInteger(e.limit)) { f.error('schema', path, '', '{ kind, limit, why, names: [name | null, …] }'); return null; }
    if (e.names.length > e.limit) f.error('id-over-limit', path, '/names', `${e.names.length} ids; the limit is ${e.limit}: ${e.why}`);

    const ids = new Map<string, number>();
    e.names.forEach((name, id) => {
        if (name === null) return;
        if (typeof name !== 'string' || !nameRe.test(name)) return f.error('bad-name', path, `/names/${id}`, `"${name}": snake_case, at most 80 characters`);
        if (ids.has(name)) return f.error('duplicate-name', path, `/names/${id}`, `"${name}" is also id ${ids.get(name)}`);
        if (!present.has(name)) return f.error('locked-name-missing', path, `/names/${id}`, `"${name}" (id ${id}) has no resource; set the entry to null to delete it`);
        ids.set(name, id);
    });
    const used = new Set(ids.values());
    // A kind whose resources need no id (scripts reached only from other scripts): only the listed ones get one.
    if (listedOnly) return ids;
    for (const name of [...present].sort()) {
        if (ids.has(name)) continue;
        let id = 0;
        while (used.has(id)) id++;
        if (id >= e.limit) { f.error('id-over-limit', path, '/names', `no free id for "${name}" below ${e.limit}: ${e.why}`); continue; }
        used.add(id); ids.set(name, id);
        f.warning('unlocked-id', path, '/names', `"${name}" gets id ${id}; list it in ${path} to keep it`);
    }
    return ids;
}
