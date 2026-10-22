// Ownership: the Data tab's Palettes view — the sprite palettes in bank $90
// (every address an animation script or a character record names,
// maps/character-record.ts) with the characters that use them, and the map
// palettes at $9C:C322 (what the room format calls a "tile family": one
// 16-colour palette; a room lists up to 7 per set, loaded into BG palettes
// 1–7) with the rooms that load them. A user carries a sample picture: the
// character's sprite, or the room's metatiles drawn in that palette
// (`mapPaletteSamples`, asked for one palette at a time). Pure apart from the
// ROM buffer and the character list the host hands in.

import * as maps from '../../maps';
import { paletteAddresses, paletteAt } from '../../maps/character-record';
import { getMapName } from '../../localizations';
import { hex } from '../../../../platform';

/** A character as the host knows it (sprites/character-model.ts, with the thumbnails the radar adds). */
interface CharacterInfo { id: number; name: string; paletteAddrHex?: string; thumbs?: Record<string, string | null> | null }
interface User { name: string; icon?: string; room?: number; slot?: number }
interface Palette { id: string; group: string; title: string; addr: string; colors: string[]; users: User[]; note: string; vfs?: string }

const SPRITE_BANK = 0x900000;
/** The map palette table `$9C:C322`, 32 bytes per palette (knowledge rom/90d020.md). */
const MAP_PALETTES = 0x9cc322;
/** Palettes per set: `$90:D020` loads at most 7 (BG palettes 1–7), starting at the set `$7E:2437` selects. */
const SET = 7;
const SAMPLE_ROOMS = 8;
const SAMPLE_TILES = 4;

const css = (c: ArrayLike<number>): string => '#' + [c[0], c[1], c[2]].map((v) => hex(v, 2).toLowerCase()).join('');

function spritePalettes(rom: Uint8Array, chars: CharacterInfo[]): Palette[] {
    const users = new Map<number, User[]>();
    chars.forEach((c) => {
        const a = parseInt(c.paletteAddrHex || '', 16);
        if (a) users.set(a, (users.get(a) || []).concat({ name: hex(c.id, 2) + ' ' + c.name, icon: c.thumbs?.s || c.thumbs?.e || undefined }));
    });
    return paletteAddresses(rom).map((a, i) => ({
        id: 's:' + a, group: 'Sprite palettes · bank $90', title: '#' + i + ' $90:' + hex(a, 4), addr: '$' + hex(SPRITE_BANK | a, 6),
        colors: paletteAt(rom, a).map(css), users: users.get(a) || [], vfs: 'soe://bus/' + hex(SPRITE_BANK | a, 6).toLowerCase(),
        note: users.has(a) ? 'The characters whose record (+$09) names it.' : 'Named by an animation script only (a 0x4B palette command), not by a character record.',
    }));
}

/** Every room's palette list, as read from the blob ($90:D020 walks the same bytes). */
function roomPalettes(rom: Uint8Array): Map<number, number[]> {
    const out = new Map<number, number[]>();
    for (let id = 0; id < maps.MAX_ROOMS; id++) {
        try {
            const L = maps.parseBlobLayout(rom, maps.roomBlobOffset(rom, id));
            out.set(id, Array.from({ length: L.tileCount }, (_, i) => maps.read16(rom, L.payloadOffset + 1 + i * 2)));
        } catch { /* a room that does not decode lists nothing */ }
    }
    return out;
}

function mapPalettes(rom: Uint8Array): Palette[] {
    const users = new Map<number, User[]>();
    roomPalettes(rom).forEach((list, id) => list.forEach((f, i) => users.set(f, (users.get(f) || []).concat({
        name: '$' + hex(id, 2) + ' ' + (getMapName(id) || '') + ' · ' + (i >= SET ? 'set ' + (Math.floor(i / SET) + 1) + ', ' : '') + 'BG palette ' + (i % SET + 1),
        room: id, slot: i,
    }))));
    return [...users.keys()].sort((a, b) => a - b).map((f) => ({
        id: 'm:' + f, group: 'Map palettes · $9C:C322', title: '#' + f + ' · ' + users.get(f)!.length + ' rooms', addr: '$' + hex(MAP_PALETTES + f * 32, 6),
        colors: maps.extractTileFamilyPalette(rom, f).map(css), users: users.get(f)!, vfs: 'soe://bus/' + hex(MAP_PALETTES + f * 32, 6).toLowerCase(),
        note: 'Map palette #' + f + ' (the room format\'s "tile family" ' + f + '). A room lists the palettes it loads; the first 7 go to BG palettes 1–7.',
    }));
}

function palettesModel(rom: Uint8Array, chars: CharacterInfo[]): Palette[] {
    return spritePalettes(rom, chars).concat(mapPalettes(rom));
}

/**
 * For map palette `family`: per room that loads it (the first few), the metatiles drawn in it
 * most often, rendered with the palette set that holds it — { room, slot, images: PNG URIs }.
 */
function mapPaletteSamples(rom: Uint8Array, family: number) {
    const out: { room: number; slot: number; images: string[] }[] = [];
    for (const [id, list] of roomPalettes(rom)) {
        if (out.length >= SAMPLE_ROOMS) break;
        const slots = list.map((f, i) => (f === family ? i : -1)).filter((i) => i >= 0);
        if (!slots.length) continue;
        let decoded: maps.RoomData;
        try { decoded = maps.decodeRoom(rom, id); } catch { continue; }
        for (const slot of slots) {
            const set = Math.floor(slot / SET);
            // Palettes past this set's end keep what the first set loaded ($90:D020 loads only what the set has).
            const room = { ...decoded, tileFamilies: list.slice(0, SET).map((f, k) => list[set * SET + k] ?? f) };
            const bg = slot % SET + 1;
            const picks = maps.metatileTable(room).filter((t) => t.uses && (((t.layer1 >> 10) & 7) === bg || ((t.layer2 >> 10) & 7) === bg))
                .sort((a, b) => b.uses - a.uses).slice(0, SAMPLE_TILES);
            const images = picks.map((t) => {
                const mini = { ...room, header: { ...room.header, widthTiles: 1, heightTiles: 1, widthPixels: 16, heightPixels: 16 }, layer1VramWords: [[t.layer1]], layer2VramWords: [[t.layer2]] };
                return maps.encodePngDataUri(maps.renderRoomComposite(rom, mini));
            });
            out.push({ room: id, slot, images });
        }
    }
    return out;
}

export { palettesModel, mapPaletteSamples };
export type { Palette, CharacterInfo, User };
