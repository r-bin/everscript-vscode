// Ownership: the in-game icons a listing's lines show (script-model icons.ts names them by key),
// drawn from the user's ROM at run time and nothing bundled: an enemy's or a character's first
// frame facing south, the ring menu's icon for a loot reward or a weapon (maps/item-icons.ts,
// docs/item-icons.md), a dog form's idle frame (drawn by the injected `dogIcon`, the sprites
// feature's), a room object in a state (maps.renderObjectState: the picture
// soe://rom/assets/maps/<id>/objects/<n>/state_<s>.png serves), the HUD portraits (the Boy's,
// maps/hud-icons.ts; a Dog form's, the injected `dogPortrait`), a currency (maps/hud-icons.ts).
// Cached per ROM, room and key; a key with no picture maps to null.
//
// Some keys are the room's: an object, and what depends on the era the room is in (its area,
// localizations): `money` its currency, `portrait:dog` the form the Dog has there. They come back
// as `object:<room>:<n>:<s>`, `money@<room>`, `portrait:dog@<room>` (roomKey).

import * as maps from '../../maps';
import { ScriptRom } from '../../script-vm';
import { getMapArea } from '../../localizations';

/** A dog form's picture (form 2..$0C, ram/7e2443), or null; the host injects it. */
export type DogIcon = (rom: Uint8Array, form: number) => string | null;

/** What other features draw, injected by the host: a dog form's idle frame and HUD portrait, an animation id's first frame (`anim:<id>`). */
export interface Drawers { dogIcon?: DogIcon | null; dogPortrait?: DogIcon | null; animation?: ((rom: Uint8Array, id: number) => string | null) | null }

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

/** Each era: its currency (maps/hud-icons.ts CURRENCIES) and the Dog's form there (ram/7e2443; Podunk has no money). */
const ERAS: Record<string, { currency: number | null; dog: number }> = {
    Podunk: { currency: null, dog: 0x0a }, Prehistoria: { currency: 0, dog: 2 }, Antiqua: { currency: 1, dog: 6 },
    Gothica: { currency: 2, dog: 8 }, Omnitopia: { currency: 3, dog: 0x0c },
};

const png = (img: { width: number; height: number; data: Uint8Array } | null): string | null => (img ? maps.encodePngDataUri(img) : null);

function draw(rom: Uint8Array, roomId: number, key: string, { dogIcon = null, dogPortrait = null, animation = null }: Drawers): string | null {
    const era = ERAS[getMapArea(roomId) || ''] ?? null;
    if (key === 'money') return era && era.currency !== null ? png(maps.currencyIcon(rom, era.currency)) : null;
    if (key === 'portrait:boy') return png(maps.boyPortrait(rom));
    if (key.startsWith('portrait:dog')) {
        const form = key === 'portrait:dog' ? era?.dog : Number(key.split(':')[2]);
        return dogPortrait && form ? dogPortrait(rom, form) : null;
    }
    const [kind, raw, extra] = key.split(':');
    const v = Number(raw);
    if (kind === 'anim') return animation ? animation(rom, v) : null;
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
export function iconsFor(rom: Uint8Array, keys: Iterable<string>, roomId: number, drawers: Drawers = {}): Record<string, string | null> {
    if (_cache.rom !== rom) _cache = { rom, byKey: new Map() };
    const out: Record<string, string | null> = {};
    for (const k of keys) {
        const ck = roomKey(k, roomId);
        if (!_cache.byKey.has(ck)) _cache.byKey.set(ck, draw(rom, roomId, k, drawers));
        out[ck] = _cache.byKey.get(ck)!;
    }
    return out;
}

/** Keys that depend on the room (above). */
const OF_THE_ROOM = new Set(['money', 'portrait:dog']);

/** A key as the page knows it: an object's and an era's with the room (scripts-listing.dom.ts does the same). */
export const roomKey = (key: string, roomId: number): string =>
    key.startsWith('object:') ? 'object:' + roomId + key.slice(6) : OF_THE_ROOM.has(key) ? key + '@' + roomId : key;

/** Every icon key the given lines' references name. */
export function iconKeys(refs: Iterable<ReadonlyArray<{ key: string }> | undefined>): Set<string> {
    const out = new Set<string>();
    for (const list of refs) for (const i of list ?? []) out.add(i.key);
    return out;
}
