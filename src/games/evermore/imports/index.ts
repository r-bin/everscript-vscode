// Ownership: the rooms converted from other games (imports/mana, imports/terra) as one source for the Rooms
// tab's host: the rail's groups, and each request answered by the bridge that owns the room. Each bridge's own
// rules: its AGENTS.md; what they share on Evermore's side: common/.

import { createManaRooms } from './mana';
import { createTerraRooms } from './terra';
import { TERRA_ROOM_BASE, IMPORTED_ROOM_BASE } from './common/ids';

type Rom = Uint8Array;
type Bridge = ReturnType<typeof createManaRooms> | ReturnType<typeof createTerraRooms>;

/** The rail groups, in this order under the vanilla rooms. */
const GROUPS = [
    { key: 'mana', label: 'Secret of Mana', title: 'Secret of Mana maps converted to Evermore rooms: tiles, families, collision, step-on events' },
    { key: 'terra', label: 'Terranigma', title: 'Terranigma rooms converted to Evermore rooms: tiles, families, collision, exits, chests, map changes' },
] as const;

/** Each `…Rom()` returns the current buffer (or null). */
function createImportedRooms(deps: { soeRom(): Rom | null; manaRom(): Rom | null; terraRom(): Rom | null }) {
    const bridges: Record<(typeof GROUPS)[number]['key'], Bridge> = {
        mana: createManaRooms({ soeRom: deps.soeRom, manaRom: deps.manaRom }),
        terra: createTerraRooms({ soeRom: deps.soeRom, terraRom: deps.terraRom }),
    };
    const all = Object.values(bridges);
    const first = <T>(ask: (b: Bridge) => T | null | undefined): T | null => {
        for (const b of all) { const r = ask(b); if (r) return r; }
        return null;
    };
    return {
        /** The rail's groups of converted rooms; a game whose ROM is missing (or fails) has none. */
        groups() {
            return GROUPS.map((g) => {
                let areas: { area: string; rooms: { id: string; name: string; tag: string }[] }[] = [];
                try { areas = bridges[g.key].railGroups(); } catch { /* that game's ROM: no group */ }
                return { ...g, areas };
            }).filter((g) => g.areas.length);
        },
        detail: (vid: unknown, name?: string) => first((b) => b.detail(vid, name)),
        resolveRoom: (roomId: unknown) => first((b) => b.resolveRoom(roomId)),
        resolveFamily: (familyId: unknown) => first((b) => b.resolveFamily(familyId)),
        playable: (roomId: unknown) => first((b) => b.playable(roomId)),
        /** The game tab room `roomId` was converted from, by its id's range (common/ids.ts), or null for a ROM room. */
        game: (roomId: unknown): string | null => {
            const n = Number(roomId);
            return n >= TERRA_ROOM_BASE ? GROUPS[1].label : n >= IMPORTED_ROOM_BASE ? GROUPS[0].label : null;
        },
        clear: () => all.forEach((b) => b.clear()),
    };
}

type ImportedRooms = ReturnType<typeof createImportedRooms>;

export type { ImportedRooms };
export { createImportedRooms };
