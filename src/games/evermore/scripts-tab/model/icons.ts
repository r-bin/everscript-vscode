// Ownership: the in-game icons a listing's lines show (script-model icons.ts names them by key),
// drawn from the user's ROM at run time and nothing bundled: an enemy's or a character's first
// frame facing south, the ring menu's icon for a loot reward or a weapon (maps/item-icons.ts,
// docs/item-icons.md), a dog form's idle frame (drawn by the injected `dogIcon`, the sprites
// feature's), a room object in a state (maps.renderObjectState: the picture
// soe://rom/assets/maps/<id>/objects/<n>/state_<s>.png serves). Cached per ROM, room and key; a key
// with no picture maps to null.

import * as maps from '../../maps';
import { ScriptRom } from '../../script-vm';

/** A dog form's picture (form 2..$0C, ram/7e2443), or null; the host injects it. */
export type DogIcon = (rom: Uint8Array, form: number) => string | null;

let _cache: { rom: Uint8Array | null; byKey: Map<string, string | null> } = { rom: null, byKey: new Map() };

/** Weapon index → ring icon: `$26 + index` for 2..$1A (knowledge ram/7e2441). */
const weaponIcon = (index: number): number | null => (index >= 2 && index <= 0x1a && !(index & 1) ? 0x26 + index : null);

function character(rom: Uint8Array, record: number | null): string | null {
    const r = record === null ? null : maps.renderCharacterFrames(rom, record);
    return r ? maps.encodePngDataUri({ width: r.width, height: r.height, data: r.frames[0].data }) : null;
}

/** Room object `index` (the script's numbering, `objectIndex`) in `state`. */
function object(rom: Uint8Array, roomId: number, index: number, state: number): string | null {
    const room = maps.decodeRoom(rom, roomId);
    const at = room.objects.findIndex((o) => o.objectIndex === index);
    const img = maps.renderObjectState(rom, room, at >= 0 ? at : index, state);
    return img ? maps.encodePngDataUri(img) : null;
}

function draw(rom: Uint8Array, roomId: number, key: string, dogIcon: DogIcon | null): string | null {
    const [kind, raw, extra] = key.split(':');
    const v = Number(raw);
    try {
        if (kind === 'enemy') return character(rom, new ScriptRom(rom).enemyCharacter(v));
        if (kind === 'char') return character(rom, v);
        if (kind === 'object') return object(rom, roomId, v, Number(extra));
        if (kind === 'loot' || kind === 'weapon') {
            const id = kind === 'loot' ? maps.lootIconId(rom, v) : weaponIcon(v);
            const px = id === null ? null : maps.renderItemIcon(rom, id);
            return px ? maps.encodePngDataUri(px) : null;
        }
        if (kind === 'dog') return dogIcon ? dogIcon(rom, v) : null;
    } catch { /* a key the ROM cannot draw: no icon */ }
    return null;
}

/**
 * `keys` → their pictures as PNG data URIs (null where there is none). An object key is the
 * room's: it comes back as `object:<room>:<n>:<state>` so pages can keep every room's icons apart.
 */
export function iconsFor(rom: Uint8Array, keys: Iterable<string>, dogIcon: DogIcon | null, roomId: number): Record<string, string | null> {
    if (_cache.rom !== rom) _cache = { rom, byKey: new Map() };
    const out: Record<string, string | null> = {};
    for (const k of keys) {
        const ck = k.startsWith('object:') ? roomKey(k, roomId) : k;
        if (!_cache.byKey.has(ck)) _cache.byKey.set(ck, draw(rom, roomId, k, dogIcon));
        out[ck] = _cache.byKey.get(ck)!;
    }
    return out;
}

/** `object:<n>:<state>` as the page knows it: with the room. */
export const roomKey = (key: string, roomId: number): string => (key.startsWith('object:') ? 'object:' + roomId + key.slice(6) : key);

/** Every icon key the given lines' references name. */
export function iconKeys(refs: Iterable<ReadonlyArray<{ key: string }> | undefined>): Set<string> {
    const out = new Set<string>();
    for (const list of refs) for (const i of list ?? []) out.add(i.key);
    return out;
}
