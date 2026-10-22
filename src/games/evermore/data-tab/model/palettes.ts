// Ownership: the Data tab's Palettes view — the sprite palettes in bank $90
// (every address an animation script or a character record names,
// maps/character-record.ts) with the characters that use them, and the map
// tile families every room loads (maps/palette.ts) with the rooms that load
// them. Pure apart from the ROM buffer and the character list the host hands in.

import * as maps from '../../maps';
import { paletteAddresses, paletteAt } from '../../maps/character-record';
import { getMapName } from '../../localizations';
import { hex } from '../../../../platform';

interface Palette { id: string; group: string; title: string; addr: string; colors: string[]; users: string[]; vfs?: string }
/** A character as the host knows it: index, name and its record's palette (`0xad0b`). */
interface CharacterPalette { id: number; name: string; paletteAddrHex?: string }

const SPRITE_BANK = 0x900000;
const css = (c: ArrayLike<number>): string => '#' + [c[0], c[1], c[2]].map((v) => hex(v, 2).toLowerCase()).join('');

function spritePalettes(rom: Uint8Array, chars: CharacterPalette[]): Palette[] {
    const users = new Map<number, string[]>();
    chars.forEach((c) => {
        const a = parseInt(c.paletteAddrHex || '', 16);
        if (a) users.set(a, (users.get(a) || []).concat(hex(c.id, 2) + ' ' + c.name));
    });
    return paletteAddresses(rom).map((a, i) => ({
        id: 's:' + a, group: 'Sprite palettes · bank $90', title: '#' + i + ' $90:' + hex(a, 4), addr: '$' + hex(SPRITE_BANK | a, 6),
        colors: paletteAt(rom, a).map(css), users: users.get(a) || [], vfs: 'soe://bus/' + hex(SPRITE_BANK | a, 6).toLowerCase(),
    }));
}

function mapPalettes(rom: Uint8Array): Palette[] {
    const rooms = new Map<number, string[]>();
    for (let id = 0; id < maps.MAX_ROOMS; id++) {
        try {
            const L = maps.parseBlobLayout(rom, maps.roomBlobOffset(rom, id));
            for (let i = 0; i < L.tileCount; i++) {
                const f = maps.read16(rom, L.payloadOffset + 1 + i * 2);
                rooms.set(f, (rooms.get(f) || []).concat('$' + hex(id, 2) + ' ' + (getMapName(id) || '') + ' · palette ' + (i + 1)));
            }
        } catch { /* a room that does not decode lists nothing */ }
    }
    return [...rooms.keys()].sort((a, b) => a - b).map((f) => ({
        id: 'm:' + f, group: 'Map tile families', title: 'family $' + hex(f, 4) + ' · ' + rooms.get(f)!.length + ' rooms',
        addr: 'family $' + hex(f, 4), colors: maps.extractTileFamilyPalette(rom, f).map(css), users: rooms.get(f)!,
    }));
}

function palettesModel(rom: Uint8Array, chars: CharacterPalette[]): Palette[] {
    return spritePalettes(rom, chars).concat(mapPalettes(rom));
}

export { palettesModel };
export type { Palette, CharacterPalette };
