// Ownership: the Data tab's Enums view — every enum the Everscript core
// library declares (the language data file, generated from the compiler's
// in/core/*.evs), grouped by what its values are: ROM addresses, WRAM
// addresses, plain values; and the game's own lists read from the ROM:
// character blobs (the WRAM entity slots and the ROM records) and map blobs
// (the map pointer table). Pure apart from the ROM buffer and the character
// names the host hands in (the sprites tab's, injected).

import indexJson from '../../language/data/index.json';
import * as maps from '../../maps';
import { CHARACTER_TABLE, CHARACTER_STRIDE } from '../../maps/character-record';
import { getMapName, getMapArea } from '../../localizations';
import { hex } from '../../../../platform';

interface Entry { name: string; value: string; comment: string; vfs?: string }
interface EnumList { id: string; group: string; title: string; entries: Entry[] }
/** A character as the host knows it: its record index and name. */
interface CharacterName { id: number; name: string }

type RawEntry = { name: string; value: string; comment: string };
const ENUMS = (indexJson as { enums: Record<string, RawEntry[]> }).enums;
/** Enums whose plain values are WRAM offsets (the others mark theirs `<0x…>`). */
const WRAM_VALUED = new Set(['CHARACTER_ADDRESS']);

const ROM_BANK = 0x800000;
const bus = (addr: number): string => 'soe://bus/' + hex(addr, 6).toLowerCase();

function parse(v: string): number {
    const s = v.replace(/[<>\s]/g, '');
    if (/^0x/i.test(s)) return parseInt(s, 16);
    if (/^0d/i.test(s)) return parseInt(s.slice(2), 10);
    return /^-?\d+$/.test(s) ? parseInt(s, 10) : NaN;
}

/** ROM / WRAM / value, and the bus address of an entry when it is one. WRAM: most values are marked `<0x…>`. */
function classify(id: string, list: RawEntry[]): { group: string; addr: (e: RawEntry) => number | null } {
    if (WRAM_VALUED.has(id) || list.filter((e) => e.value.trim().startsWith('<')).length * 2 > list.length) {
        return { group: 'WRAM addresses', addr: (e) => { const n = parse(e.value); return Number.isFinite(n) ? 0x7e0000 + (n & 0x1ffff) : null; } };
    }
    const nums = list.map((e) => parse(e.value)).filter(Number.isFinite);
    if (nums.length && nums.every((n) => n >= ROM_BANK)) return { group: 'ROM addresses', addr: (e) => { const n = parse(e.value); return Number.isFinite(n) ? n : null; } };
    return { group: 'Values', addr: () => null };
}

function coreEnums(): EnumList[] {
    return Object.keys(ENUMS).filter((id) => ENUMS[id].length).map((id) => {
        const c = classify(id, ENUMS[id]);
        return {
            id: 'e:' + id, group: c.group, title: id,
            entries: ENUMS[id].map((e) => {
                const a = c.addr(e);
                return { name: e.name, value: e.value, comment: e.comment, ...(a != null ? { vfs: bus(a) } : {}) };
            }),
        };
    });
}

function characterBlobs(rom: Uint8Array, names: CharacterName[]): EnumList {
    const slots = (ENUMS.CHARACTER_ADDRESS || []).map((e): Entry => {
        const a = 0x7e0000 + (parse(e.value) & 0xffff);
        return { name: 'WRAM · ' + e.name, value: '$' + hex(a, 6), comment: 'entity slot', vfs: bus(a) };
    });
    const records: Entry[] = [];
    for (let i = 0; i < names.length && maps.snesToRom(CHARACTER_TABLE + (i + 1) * CHARACTER_STRIDE) <= rom.length; i++) {
        const a = CHARACTER_TABLE + i * CHARACTER_STRIDE;
        records.push({ name: 'ROM · ' + hex(i, 2) + ' ' + (names[i]?.name || ''), value: '$' + hex(a, 6), comment: CHARACTER_STRIDE + '-byte record', vfs: bus(a) });
    }
    return { id: 'characters', group: 'Game lists', title: 'Character blobs', entries: slots.concat(records) };
}

function mapBlobs(rom: Uint8Array): EnumList {
    const entries: Entry[] = [];
    for (let id = 0; id < maps.MAX_ROOMS; id++) {
        try {
            const blob = maps.roomBlobOffset(rom, id);
            const end = maps.objectAreaEnd(rom, maps.parseBlobLayout(rom, blob));
            entries.push({ name: hex(id, 2) + ' ' + (getMapName(id) || 'Room $' + hex(id, 2)), value: '$' + hex(0xc00000 + blob, 6),
                comment: (end - blob) + ' bytes · ' + (getMapArea(id) || ''), vfs: bus(0xc00000 + blob) });
        } catch (err) {
            entries.push({ name: hex(id, 2) + ' ' + (getMapName(id) || ''), value: '?', comment: String(err instanceof Error ? err.message : err) });
        }
    }
    return { id: 'maps', group: 'Game lists', title: 'Map blobs', entries };
}

/** Every list the view shows: the game's lists first, then the core enums by kind. */
function enumsModel(rom: Uint8Array, names: CharacterName[]): EnumList[] {
    return [characterBlobs(rom, names), mapBlobs(rom)].concat(coreEnums());
}

export { enumsModel };
export type { EnumList, Entry, CharacterName };
