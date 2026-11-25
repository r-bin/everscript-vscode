// Typed references between resources (docs/open-evermore/roadmap.md R2, §3): a value that names another kind's resource
// is written as that resource's place in the tree, `<folder>/<name>` (`wram/DOG_BISCUIT`, `menus/ring_items/item_honey`,
// `strings/menu/rare_item`, `targets/enemies`), so a reader sees what kind of thing it is and where to find it. The folder
// is the kind's (`Codec.folder`, else its path); the kinds register once (`setFolders`, from the game's kinds list).
// A bare name is still read (hand-written files, older trees); explode writes the typed form.
import type { Codec } from './codec.mts';

const FOLDERS = new Map<string, string>();

/** Registers every kind's folder; the game's kinds list calls it once. */
export function setFolders(kinds: Codec[]): void {
    for (const k of kinds) FOLDERS.set(k.kind, k.folder ?? k.path);
}

/** The folder a kind's resources are in (the kind's name until registered). */
export const folderOf = (kind: string): string => FOLDERS.get(kind) ?? kind;

/** A reference to resource `name` of `kind`: `<folder>/<name>`. */
export const link = (kind: string, name: string): string => `${folderOf(kind)}/${name}`;

/** The name a reference to `kind` names: the typed form without its folder, or a bare name as it is; undefined when not
 *  a string or typed for another folder. */
export function unlink(kind: string, value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const prefix = `${folderOf(kind)}/`;
    if (value.startsWith(prefix)) return value.slice(prefix.length);
    // A typed reference to another folder is not this kind's; a bare name may contain '/' only where the kind's names do
    // (animations: `boy/walk`), so only a known folder prefix is refused.
    for (const f of FOLDERS.values()) if (f !== folderOf(kind) && value.startsWith(`${f}/`) && !prefix.startsWith(`${f}/`)) return undefined;
    return value;
}
