// Ownership: a room's alternate family sets, for the map editor's Header
// sub-tab (map-editor-family-sets.js) — every family entry's colours, and the
// MAP_PALETTE values the room's own scripts write.
//
// A room's family list can be longer than the seven slots: `$90D020` loads
// seven starting at MAP_PALETTE (`$7E2437`, 0 on load), and a script writing
// the variable switches set (Thraxx going from orange to white, Ebon/Ivor
// Keep, dark storerooms). docs/map-format/room-reference.md §5.

import * as maps from '../../maps';
import * as vm from '../../script-vm';
import type { RoomData } from '../../maps/room';

/** MAP_PALETTE: the room's palette variant, which enter and trigger scripts write. */
const MAP_PALETTE = 0x2437;

const _values = new Map<string, number[]>();

/** Every MAP_PALETTE value the room's enter and trigger scripts write, sorted. */
function scriptPaletteValues(rom: Uint8Array, roomId: number, key: string): number[] {
    const k = key + ':' + roomId;
    const hit = _values.get(k);
    if (hit) return hit;
    const found = new Set<number>();
    try {
        const sr = new vm.ScriptRom(rom);
        const r = vm.roomScripts(sr, roomId);
        const entries = [r.enter, ...r.triggers.map((t) => t.script)].filter((a): a is number => a !== null && sr.contains(a));
        for (const ins of vm.walk(sr, entries, false).instructions.values()) {
            const f = vm.facts(ins);
            if (f.k === 'write' && f.area === 'save' && f.addr === MAP_PALETTE && f.value !== null) found.add(f.value);
        }
    } catch { /* an unreadable script just offers no values */ }
    const out = Array.from(found).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    _values.set(k, out);
    return out;
}

const hex = (c: ArrayLike<number>): string => '#' + [c[0], c[1], c[2]].map((v) => (v & 0xff).toString(16).padStart(2, '0')).join('');

/**
 * `{colors, scriptValues}`: colours 1..15 of every family entry (0 is
 * transparent), and the values scripts set. Only a room with more than seven
 * entries has sets to switch between; the rest get `null`.
 */
function familySetInfo(rom: Uint8Array, room: Pick<RoomData, 'tileFamilies'> | null | undefined, roomId: number, key: string) {
    if (!room || !room.tileFamilies || room.tileFamilies.length <= 7) return null;
    return {
        colors: room.tileFamilies.map((id) => maps.extractTileFamilyPalette(rom, id).slice(1).map(hex)),
        scriptValues: scriptPaletteValues(rom, roomId, key),
    };
}

export { familySetInfo };
