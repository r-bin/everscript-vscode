// Ownership: a playable ROM for a room that brings its own graphics and colours (a converted
// Secret of Mana map) — the vanilla ROM, expanded, with the room in Brian's slot (0x15) and the
// intro sent there, as rom-export.ts does for a custom map. Pure: ROM bytes in, ROM bytes out.
//
// The engine reaches graphics and families only through 16-bit offsets: `$CC:C88C` and
// `$90:A1B4` read the graphic pointer at `$EE:0000 + 3·id` (A = id·3, then TAX), and the families
// sit at `$9C:C322 + 32·id`. So the ids the editor's in-memory image uses (from 43691, from
// 41447) wrap in the game. The table's free entries end at id 6690 (bank $EE's data follows), so
// nothing can be added: the room takes over the **highest vanilla ids** instead — their pointers
// moved to its graphics in bank $F0, their colours replaced. A test ROM shows no other room, so
// the graphics and families those ids drew are not missed.
//
// Mana's step events are left out: their numbers are Mana's, and as Evermore script ids they
// would run whatever Evermore keeps there. Everything else is the room as the editor shows it,
// and the result is decoded and drawn again: it must give the editor's own picture.

import * as maps from '../../maps';
import type { OwnRoomInput } from '../../maps';
import { BRIAN_ROOM, BLOB_OFFSET, EXPANDED_SIZE, VANILLA_SIZE, patchEntry, verifyEntry, fixChecksum } from './rom-export';

const GRAPHIC_TABLE = 0x2e0000;                 // $EE:0000, 3 bytes an id
const FAMILY_TABLE = 0x1cc322;                  // $9C:C322, 32 bytes an id
const FAMILY_COUNT = 365;                       // asset_9cc322: 365 families
const GRAPHIC_DATA = 0x300000;                  // $F0:0000: 129 bytes each (count byte $3F, 128 raw)
const GRAPHIC_BYTES = 129;
const BLOB_MAX = 0x8000;                        // one bank half
const STEP_ON = 0x4000;

/** What this export needs of a room: its own parts, as the converter makes them (imports/mana). */
interface OwnRoom {
    widthTiles: number; heightTiles: number;
    /** 13 header bytes. */
    header: ArrayLike<number>;
    /** Block 1 graphics, then animation frames: 128 bytes each. */
    graphics: Uint8Array[];
    frameGraphics?: Uint8Array[];
    families: { colours: number[] }[];
    cells: number[];
    cut?: number[][];
    objects?: OwnRoomInput['objects'];
    paletteCycles?: number[][];
    /** Section 2 channels; `frames` index `frameGraphics`. */
    animation?: { frames: number[]; delays: number[] }[];
}

/** The first graphic id whose pointer is empty: one past the last vanilla graphic. */
function graphicEnd(rom: Uint8Array): number {
    for (let id = 1; GRAPHIC_TABLE + id * 3 + 2 < GRAPHIC_TABLE + 0x10000; id++) {
        const p = GRAPHIC_TABLE + id * 3;
        if (!rom[p] && !rom[p + 1] && !rom[p + 2]) return id;
    }
    throw new Error('no end to the graphic pointer table');
}

/** `[x, y, l1, l2, cw]` / three words a cell: the collision word without the step-on bit. */
const noStep = (w: number) => w & ~STEP_ON & 0xffff;

/**
 * Build the ROM. `start` is the Boy's cell (else the middle). Returns `{ rom, report }`; throws
 * with a readable message when the room does not fit or does not decode to the same picture.
 */
function buildOwnRoomExportRom(vanilla: ArrayLike<number>, room: OwnRoom, start: { x?: number; y?: number } | null) {
    const src = Uint8Array.from(vanilla);
    if (src.length !== VANILLA_SIZE) {
        throw new Error(`expected the 3 MB vanilla ROM, got ${src.length} bytes — export starts from an unmodified Secret of Evermore (U)`);
    }
    const all = [...room.graphics, ...(room.frameGraphics || [])];
    const end = graphicEnd(src);
    if (all.length >= end) throw new Error(`${all.length} graphics, the table has ${end}`);
    if (all.length * GRAPHIC_BYTES > 0x10000 * 12) throw new Error(`${all.length} graphics do not fit the extension`);
    if (room.families.length > 7) throw new Error(`${room.families.length} families, a room loads 7`);
    const firstId = end - all.length;
    const famIds = room.families.map((_, i) => FAMILY_COUNT - room.families.length + i);

    const rom = new Uint8Array(EXPANDED_SIZE);
    rom.set(src, 0);
    // Graphics in bank $F0 on, none across a bank's end; the top vanilla ids point at them.
    let at = GRAPHIC_DATA;
    all.forEach((g, i) => {
        if ((at & 0xffff) + GRAPHIC_BYTES > 0x10000) at = (at & ~0xffff) + 0x10000;
        rom[at] = 0x3f;
        rom.set(g, at + 1);
        const p = GRAPHIC_TABLE + (firstId + i) * 3, bus = 0xc00000 | at;
        rom[p] = bus & 0xff; rom[p + 1] = (bus >> 8) & 0xff; rom[p + 2] = bus >> 16;
        at += GRAPHIC_BYTES;
    });
    room.families.forEach((f, i) => {
        const p = FAMILY_TABLE + famIds[i] * 32;
        f.colours.forEach((c, k) => { rom[p + k * 2] = c & 0xff; rom[p + k * 2 + 1] = (c >> 8) & 0x7f; });
    });

    const nBlock1 = room.graphics.length;
    const built = maps.buildOwnRoomBlob({
        widthTiles: room.widthTiles, heightTiles: room.heightTiles, header: room.header,
        graphics: room.graphics.map((_, i) => firstId + i),
        families: famIds,
        cells: room.cells.map((w, i) => (i % 3 === 2 ? noStep(w) : w)),
        cut: (room.cut || []).map((c) => [c[0], c[1], c[2], c[3], noStep(c[4])]),
        objects: room.objects,
        paletteCycles: room.paletteCycles,
        animation: (room.animation || []).map((c) => ({ frames: c.frames.map((f) => firstId + nBlock1 + f), delays: c.delays })),
    });
    if (built.blob.length > BLOB_MAX) throw new Error(`the room needs ${built.blob.length} bytes, one bank half holds ${BLOB_MAX}`);
    maps.writeRoomAt(rom, BRIAN_ROOM, built.blob, BLOB_OFFSET);
    const entry = patchEntry(rom, start, room.widthTiles, room.heightTiles);
    fixChecksum(rom);
    verifyEntry(rom, entry);
    return {
        rom,
        report: {
            room: BRIAN_ROOM, widthTiles: room.widthTiles, heightTiles: room.heightTiles,
            blobBytes: built.blob.length, blobAddress: 0x800000 | BLOB_OFFSET,
            metatiles: built.metatileCount, wramBytes: built.wramBytes,
            animated: (room.animation || []).length, paletteCycles: (room.paletteCycles || []).length,
            graphicIds: [firstId, end - 1], familyIds: famIds, start: entry,
        },
    };
}

/**
 * The exported room drawn by the editor's own renderer next to `shown` (the picture the editor
 * drew): equal, or the first cell that differs. Collision is compared without the step-on bit.
 */
function verifyOwnRoomExport(rom: Uint8Array, shown: { rom: Uint8Array; roomId: number }) {
    const got = maps.decodeRoom(rom, BRIAN_ROOM), want = maps.decodeRoom(shown.rom, shown.roomId);
    const w = want.header.widthTiles, h = want.header.heightTiles;
    if (got.header.widthTiles !== w || got.header.heightTiles !== h) throw new Error(`export check: room decodes as ${got.header.widthTiles}x${got.header.heightTiles}`);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (got.layer1VramWords[y][x] !== want.layer1VramWords[y][x] || got.layer2VramWords[y][x] !== want.layer2VramWords[y][x]
                || got.collisionWords[y][x] !== noStep(want.collisionWords[y][x])) {
                throw new Error(`export check: cell (${x},${y}) decodes differently from the editor's room`);
            }
        }
    }
    const a = maps.renderRoomComposite(rom, got).data, b = maps.renderRoomComposite(shown.rom, want).data;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            const px = i >> 2, x = px % (w * 16), y = Math.floor(px / (w * 16));
            throw new Error(`export check: pixel (${x},${y}) draws differently from the editor's room`);
        }
    }
    const pc = (r: typeof got) => r.paletteCycles.map((c) => [c.paletteIndex, c.colorStart, c.span, c.rate].join()).join('|');
    if (pc(got) !== pc(want)) throw new Error('export check: palette cycles differ from the editor\'s room');
    if (got.animation.length !== want.animation.length) throw new Error(`export check: ${got.animation.length} animation channels, the editor has ${want.animation.length}`);
}

export type { OwnRoom };
export { buildOwnRoomExportRom, verifyOwnRoomExport };
