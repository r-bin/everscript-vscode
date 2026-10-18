// Ownership: where a converted room's own data sits in the Evermore ROM image it is
// drawn from (virtual-rom.ts), and the ids that follow from it.
//
// Evermore finds a graphic through a 3-byte pointer at $EE0000 + id*3 (file 0x2E0000)
// and a family's 16 colours at file 0x1CC322 + id*32 (docs/map-format/
// map_tile_graphics_decompression.md, map_palette_extraction.md). Both are fixed
// strides, so ids whose entries land past the end of the 3 MB ROM point into space the
// image adds — no vanilla graphic or family is touched.

const ROM_END = 0x300000;                       // a stock 3 MB Evermore ROM
const GRAPHIC_TABLE = 0x2E0000;
const PALETTE_TABLE = 0x1CC322;

/** First graphic id whose pointer lies past the ROM (pointer at 0x300001). */
const GRAPHIC_BASE = Math.ceil((ROM_END - GRAPHIC_TABLE) / 3);
const GRAPHIC_DATA = 0x301000;                  // 129 bytes each: count byte + 128 raw

/** First family id whose colours lie at or past 0x310000; one id per Mana (set, palette). */
const PALETTE_AREA = 0x310000;
const FAMILY_BASE = Math.ceil((PALETTE_AREA - PALETTE_TABLE) / 32);
const FAMILY_COUNT = 128 * 8;                   // palette sets & $7F, 8 ids each

/** The room blob: the upper half of a bank, as every vanilla blob ($8000-$FFFF). */
const BLOB_AT = 0x328000;
const BLOB_MAX = 0x8000;
const IMAGE_SIZE = 0x330000;

/** The room slot the converted blob replaces in the image. */
const ROOM_SLOT = 0x7E;

/** Graphics one room can name: a tilemap word's 10-bit character field (budget.ts MAX_GRAPHICS). */
const MAX_GRAPHICS = 264;

/** Room ids the Rooms tab uses for converted maps: never a ROM room (0..0x7E). */
const IMPORTED_ROOM_BASE = 0x1000;

const isImportedFamily = (f: number): boolean => f >= FAMILY_BASE && f < FAMILY_BASE + FAMILY_COUNT;

export { ROM_END, GRAPHIC_TABLE, PALETTE_TABLE, GRAPHIC_BASE, GRAPHIC_DATA, FAMILY_BASE, FAMILY_COUNT, BLOB_AT, BLOB_MAX, IMAGE_SIZE, ROOM_SLOT, MAX_GRAPHICS, IMPORTED_ROOM_BASE, isImportedFamily };
