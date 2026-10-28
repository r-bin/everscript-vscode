// Ownership: the in-game icons a listing's lines show (script-model icons.ts names them by key),
// drawn from the user's ROM at run time and nothing bundled: an enemy's first frame facing south,
// the ring menu's icon for a loot reward or a weapon (maps/item-icons.ts, docs/item-icons.md), a
// dog form's idle frame (drawn by the injected `dogIcon`, the sprites feature's). Cached per ROM
// and key; a key with no picture maps to null.

import * as maps from '../../maps';
import { ScriptRom } from '../../script-vm';

/** A dog form's picture (form 2..$0C, ram/7e2443), or null; the host injects it. */
export type DogIcon = (rom: Uint8Array, form: number) => string | null;

let _cache: { rom: Uint8Array | null; byKey: Map<string, string | null> } = { rom: null, byKey: new Map() };

/** Weapon index → ring icon: `$26 + index` for 2..$1A (knowledge ram/7e2441). */
const weaponIcon = (index: number): number | null => (index >= 2 && index <= 0x1a && !(index & 1) ? 0x26 + index : null);

function draw(rom: Uint8Array, key: string, dogIcon: DogIcon | null): string | null {
    const [kind, raw] = key.split(':');
    const v = Number(raw);
    try {
        if (kind === 'enemy') {
            const character = new ScriptRom(rom).enemyCharacter(v);
            const r = character === null ? null : maps.renderCharacterFrames(rom, character);
            return r ? maps.encodePngDataUri({ width: r.width, height: r.height, data: r.frames[0].data }) : null;
        }
        if (kind === 'loot' || kind === 'weapon') {
            const id = kind === 'loot' ? maps.lootIconId(rom, v) : weaponIcon(v);
            const px = id === null ? null : maps.renderItemIcon(rom, id);
            return px ? maps.encodePngDataUri(px) : null;
        }
        if (kind === 'dog') return dogIcon ? dogIcon(rom, v) : null;
    } catch { /* a key the ROM cannot draw: no icon */ }
    return null;
}

/** `keys` → their pictures as PNG data URIs (null where there is none). */
export function iconsFor(rom: Uint8Array, keys: Iterable<string>, dogIcon: DogIcon | null): Record<string, string | null> {
    if (_cache.rom !== rom) _cache = { rom, byKey: new Map() };
    const out: Record<string, string | null> = {};
    for (const k of keys) {
        if (!_cache.byKey.has(k)) _cache.byKey.set(k, draw(rom, k, dogIcon));
        out[k] = _cache.byKey.get(k)!;
    }
    return out;
}

/** Every icon key the given lines' references name. */
export function iconKeys(refs: Iterable<ReadonlyArray<{ key: string }> | undefined>): Set<string> {
    const out = new Set<string>();
    for (const list of refs) for (const i of list ?? []) out.add(i.key);
    return out;
}
