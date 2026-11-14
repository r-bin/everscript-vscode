// Ownership: Terranigma rooms as rooms of Evermore's Rooms tab — the rail's list, a room's details when it is
// opened, which ROM image (common/virtual-rom.ts) answers the tab's requests for it, and what Play in emulator
// needs. No `vscode`: both ROMs arrive as functions from the host.
//
// A converted room's id in the tab is TERRA_ROOM_BASE + room id, never a ROM room (0..0x7E) nor a Mana map.
// Families are named t<n>: one id per distinct 16 colours, so the same palette is the same family in every
// room that draws with it.

import * as terra from '../../../terra/decoder';
import { readRomMapHeaderFrom } from '../../rom-readers';
import { buildVirtualRom, roomHeader } from '../common/virtual-rom';
import { defaultStart } from '../common/start';
import * as ids from '../common/ids';
import { convertTerraRoom } from './convert';
import type { TerraConverted } from './convert';

type Rom = Uint8Array;
type Entry = { soe: Rom; terraRom: Rom; room: TerraConverted; image: ReturnType<typeof buildVirtualRom> };

const VID_PREFIX = 'terra-';
const CACHE_MAX = 4;
/** Added to the room id for the image's length (common/virtual-rom.ts): past every Mana map's. */
const SALT = 0x800;

const hex3 = (n: number): string => '$' + terra.hex3(n).toUpperCase();

/** `{soeRom(), terraRom()}` return the current buffers (or null). */
function createTerraRooms(deps: { soeRom(): Rom | null; terraRom(): Rom | null }) {
    const cache = new Map<number, Entry>();
    const familyMap = new Map<number, number>();         // family id -> room that last used it
    const familyIds = new Map<string, number>();         // 16 colours -> family id
    let arrivalCache: { rom: Rom; at: Map<number, { x: number; y: number }[]> } | null = null;

    const roms = () => {
        const soe = deps.soeRom(), t = deps.terraRom();
        return soe && t && terra.isBaseTerraRom(t) && !terra.isTerraRom(soe) ? { soe, t } : null;
    };

    /** A family id for 16 colours: the same colours keep their id; past the range the oldest is reused. */
    function familyId(colours: number[]): number {
        const key = colours.join(',');
        let id = familyIds.get(key);
        if (id === undefined) {
            if (familyIds.size >= ids.TERRA_FAMILY_COUNT) familyIds.delete(familyIds.keys().next().value!);
            const taken = new Set(familyIds.values());
            id = ids.TERRA_FAMILY_BASE;
            while (taken.has(id)) id++;
            familyIds.set(key, id);
        }
        return id;
    }

    function entry(roomId: number): Entry | null {
        const r = roms();
        if (!r) return null;
        const hit = cache.get(roomId);
        if (hit && hit.soe === r.soe && hit.terraRom === r.t) return hit;
        const room = convertTerraRoom(r.t, roomId, familyId);
        if (!room) return null;
        const image = buildVirtualRom(r.soe, room, SALT + roomId);
        const e: Entry = { soe: r.soe, terraRom: r.t, room, image };
        cache.set(roomId, e);
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
        room.families.forEach((f) => familyMap.set(f.id, roomId));
        return e;
    }

    /** The rail: one row per picture (its first room), in Terranigma's groups of 64 ids. [] without both ROMs. */
    function railGroups() {
        const r = roms();
        if (!r) return [];
        return terra.roomCatalog(r.t).groups.map((g) => ({
            area: g.name,
            rooms: g.pictures.map(([id, ...same]) => ({
                id: VID_PREFIX + id.toString(16),
                name: 'Room ' + hex3(id) + (same.length ? ' +' + same.length : ''),
                tag: 'terra ' + terra.hex3(id),
                same: same.map((n) => n.toString(16)),
            })),
        })).filter((g) => g.rooms.length);
    }

    /** Where the game's exits into room `id` put the player (pixels), from every room's exit list. */
    function arrivals(rom: Rom, id: number) {
        if (!arrivalCache || arrivalCache.rom !== rom) {
            const at = new Map<number, { x: number; y: number }[]>();
            for (let k = 0; k < terra.TERRA_ROOM_COUNT; k++) {
                if (!terra.isRoomSlotUsed(rom, k)) continue;
                for (const e of terra.roomExits(rom, k)) for (const t of e.targets) {
                    if (!at.has(t.room)) at.set(t.room, []);
                    at.get(t.room)!.push({ x: t.x, y: t.y });
                }
            }
            arrivalCache = { rom, at };
        }
        return arrivalCache.at.get(id) ?? [];
    }

    /**
     * Where the Boy starts by default: the first floor cell where one of the game's exits arrives (the cell
     * holding the point, else the floor cell nearest it within two cells), else the middle (common/start.ts).
     */
    function startOf(e: Entry, roomId: number) {
        const { room } = e, w = room.widthTiles, h = room.heightTiles;
        const floor = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !(room.cells[(y * w + x) * 3 + 2] & 0xC00F);
        for (const p of arrivals(e.terraRom, roomId)) {
            const cx = p.x >> 4, cy = p.y >> 4;
            let best: { x: number; y: number } | null = null, bestD = Infinity;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                const d = dx * dx + dy * dy;
                if (d < bestD && floor(cx + dx, cy + dy)) { bestD = d; best = { x: cx + dx, y: cy + dy }; }
            }
            if (best) return best;
        }
        return defaultStart(room);
    }

    /** What a step-on box (an exit) or B-trigger box (a chest) does, in words. */
    function exitLabel(e: TerraConverted['exits'][number]): string {
        return 'Terranigma exit to ' + e.targets.map((t) => hex3(t.room) + (t.flag ? ' (flag ' + hex3(t.flag) + ')' : '')).join(' / ');
    }
    function chestLabel(c: TerraConverted['chests'][number]): string {
        if (!c.contents) return 'Terranigma chest, empty';
        return 'Terranigma chest, contents $' + c.contents.toString(16).toUpperCase().padStart(4, '0') + (c.contents & 0x8000 ? ' (not an item)' : '');
    }

    /** The Rooms tab's room object for `vid` (`terra-a`), or null. */
    function detail(vid: unknown, name?: string) {
        if (typeof vid !== 'string' || !vid.startsWith(VID_PREFIX)) return null;
        const roomId = parseInt(vid.slice(VID_PREFIX.length), 16);
        const e = Number.isInteger(roomId) ? entry(roomId) : null;
        if (!e) return null;
        const { room, image } = e;
        const row = (label: string) => (t: { x1: number; y1: number; x2: number; y2: number; scriptId: number }) =>
            ({ x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, scriptId: t.scriptId, label, what: label });
        // `scriptId` is the exit's or chest's index in the room's list: it names no Evermore script.
        const stepOn = room.stepOn.map((t) => row(exitLabel(room.exits[t.scriptId]))(t));
        const bTrigger = room.bTrigger.map((t) => row(chestLabel(room.chests[t.scriptId]))(t));
        const context = room.context.length ? ', drawn after room ' + room.context.map(hex3).join(', ') + ' (the parts it keeps from before)' : '';
        return {
            name: name || ('Terranigma room ' + hex3(roomId)),
            vanillaId: 'terra ' + terra.hex3(roomId),
            romRoomId: ids.TERRA_ROOM_BASE + roomId,
            imported: 'terra',
            importedFrom: 'Terranigma',
            relPath: 'Terranigma room ' + hex3(roomId) + ', converted' + context,
            start: startOf(e, roomId),
            startLine: -1, endLine: -1, imageUri: null, imageDims: null,
            families: room.families.map((f) => ({
                id: f.id, label: 't' + (f.id - ids.TERRA_FAMILY_BASE), tiles: f.graphics, rooms: 1, areas: ['Terranigma'],
                names: ['palette ' + f.palette],
            })),
            conversion: Object.assign({ blobBytes: image.blobBytes, stamps: image.metatileCount, wramBytes: image.wramBytes }, room.stats),
            content: {
                initMap: { x1: 0, y1: 0, x2: room.widthTiles * 2, y2: room.heightTiles * 2 },
                // Terranigma's characters are set up by the room's script past its header, not decoded yet.
                entrances: [], objects: [], transitions: [], enemies: [],
                triggerNames: { stepOn: stepOn.map((t) => t.label), bTrigger: bTrigger.map((t) => t.label) },
                triggers: { enter: null, stepOn, bTrigger, meta: null },
                roomError: null,
                mapId: ids.TERRA_ROOM_BASE + roomId,
                romHeader: readRomMapHeaderFrom(image.rom, image.roomId),
                trigOffset: { offX: 0, offY: 0 },
            },
        };
    }

    const own = (roomId: unknown): number | null => {
        const n = Number(roomId) - ids.TERRA_ROOM_BASE;
        return Number.isInteger(n) && n >= 0 && n < terra.TERRA_ROOM_COUNT ? n : null;
    };

    /** What a playable ROM needs of tab room `roomId` (rooms/rendering rom-export-own.ts); null when it is not a converted Terranigma room. */
    function playable(roomId: unknown) {
        const n = own(roomId);
        const e = n === null ? null : entry(n);
        if (!e) return null;
        return { room: { ...e.room, header: roomHeader(e.soe, e.room) }, shown: { rom: e.image.rom, roomId: e.image.roomId }, start: startOf(e, n!) };
    }

    /** `{rom, roomId}` to answer a request about tab room `roomId`, or null when it is not a converted Terranigma room. */
    function resolveRoom(roomId: unknown) {
        const n = own(roomId);
        const e = n === null ? null : entry(n);
        return e ? { rom: e.image.rom, roomId: e.image.roomId } : null;
    }

    /** The image that holds family `familyId`, when it is a converted Terranigma one already seen. */
    function resolveFamily(familyId: unknown) {
        const n = Number(familyId);
        if (!familyMap.has(n)) return null;
        const e = entry(familyMap.get(n)!);
        return e ? { rom: e.image.rom, roomId: e.image.roomId } : null;
    }

    return { railGroups, detail, resolveRoom, resolveFamily, playable, clear: () => { cache.clear(); familyMap.clear(); familyIds.clear(); arrivalCache = null; } };
}

export { createTerraRooms, VID_PREFIX };
