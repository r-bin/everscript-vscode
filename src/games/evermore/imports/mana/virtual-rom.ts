// Ownership: an Evermore ROM image with one converted room in it — the user's Evermore
// ROM, copied, plus the room's graphics, its families' colours and its blob (ids.ts says
// where). Built in memory, never written to disk. Every Evermore reader then sees an
// ordinary room: decodeRoom, the renderer, the collision overlay, the tile palette.
//
// The blob is made with Evermore's own builder (src/games/evermore/maps own-room.ts), so the room is real
// Evermore data: grid, dictionary, Block 1, step-on triggers, the cuttable layer
// (Section 4) and objects (Section 3), numbered the way a custom map's are.

import * as maps from '../../maps';
import * as ids from './ids';

import type { OwnRoomInput } from '../../maps/own-room';

/** Header bytes 11-12 are not known; they are copied from this vanilla room. */
const HEADER_DONOR = 0x34;

/** A Mana map converted to an Evermore room (convert.js): what these builders read of it. */
interface ConvertedRoom {
    widthTiles: number; heightTiles: number;
    display: { tm: number; ts: number; colorMath: number; colorWindow: number };
    /** Each graphic's 128 bytes (64 words). */
    graphics: Uint8Array[];
    families: { id: number; colours: number[] }[];
    cells: number[]; cut?: number[][];
    objects: (NonNullable<OwnRoomInput['objects']>[number] & { w: number; h: number; flag: number })[];
    stepOn?: OwnRoomInput['stepOn'];
    stats: { droppedObjects?: { flag: number; w: number; h: number }[]; [counter: string]: unknown };
}

function header(soeRom: Uint8Array, room: ConvertedRoom): Uint8Array {
    const donor = maps.modelFromRom(soeRom, HEADER_DONOR).header;
    const h = Uint8Array.from(donor);
    h[0] = 0; h[1] = 0;                         // trigger origin: boxes are in map cells
    h[2] = room.widthTiles; h[3] = room.heightTiles;
    h[4] = room.display.tm; h[5] = room.display.ts;
    h[6] = room.display.colorMath; h[7] = room.display.colorWindow;
    h[8] = 0; h[9] = 0; h[10] = 0;              // no effect
    return h;
}

/** The blob for a converted room (Evermore's own builder), and what it costs against Evermore's budgets. */
function buildRoomBlob(soeRom: Uint8Array, room: ConvertedRoom) {
    const built = maps.buildOwnRoomBlob({
        widthTiles: room.widthTiles, heightTiles: room.heightTiles,
        header: header(soeRom, room),
        graphics: room.graphics.map((_, i) => ids.GRAPHIC_BASE + i),
        families: room.families.map((f) => f.id),
        cells: room.cells, cut: room.cut, objects: room.objects, stepOn: room.stepOn,
    });
    return { blob: built.blob, metatileCount: built.metatileCount, wramBytes: built.wramBytes, cuttable: built.cuttable };
}

/**
 * The image: `soeRom` (a stock-size Evermore ROM) with `room` in slot ids.ROOM_SLOT.
 * Its length differs per map (`salt`), so caches keyed on a ROM fingerprint never mix
 * two converted rooms.
 */
function buildVirtualRom(soeRom: Uint8Array, room: ConvertedRoom, salt: number) {
    if (soeRom.length > ids.ROM_END) throw new Error('an expanded Evermore ROM leaves no room for converted maps');
    const rom = new Uint8Array(ids.IMAGE_SIZE + (salt & 0xFFF));
    rom.set(soeRom.subarray(0, ids.ROM_END));
    room.graphics.forEach((g, i) => {
        const at = ids.GRAPHIC_DATA + i * 129;
        rom[at] = 0x3F;                         // uncompressed: 64 words ($8CC8B0)
        rom.set(g, at + 1);
        const ptr = ids.GRAPHIC_TABLE + (ids.GRAPHIC_BASE + i) * 3, bus = 0xC00000 | at;
        rom[ptr] = bus & 0xFF; rom[ptr + 1] = (bus >> 8) & 0xFF; rom[ptr + 2] = bus >> 16;
    });
    for (const f of room.families) {
        const at = ids.PALETTE_TABLE + f.id * 32;
        f.colours.forEach((c, k) => { rom[at + k * 2] = c & 0xFF; rom[at + k * 2 + 1] = c >> 8; });
    }
    let built = buildRoomBlob(soeRom, room);
    // Too big for one bank half: leave out the largest objects (whole-map variants) first.
    const dropped: { flag: number; w: number; h: number }[] = [];
    while (built.blob.length > ids.BLOB_MAX && room.objects.length) {
        const big = room.objects.reduce((a, o) => (o.w * o.h > a.w * a.h ? o : a));
        room.objects = room.objects.filter((o) => o !== big);
        dropped.push({ flag: big.flag, w: big.w, h: big.h });
        built = buildRoomBlob(soeRom, room);
    }
    room.stats.droppedObjects = dropped;
    if (built.blob.length > ids.BLOB_MAX) throw new Error(`the converted room needs ${built.blob.length} bytes, one bank half holds ${ids.BLOB_MAX}`);
    maps.writeRoomAt(rom, ids.ROOM_SLOT, built.blob, ids.BLOB_AT);
    return { rom, roomId: ids.ROOM_SLOT, blobBytes: built.blob.length, metatileCount: built.metatileCount, wramBytes: built.wramBytes };
}

export type { ConvertedRoom };
export { buildVirtualRom, buildRoomBlob };
