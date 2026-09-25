'use strict';
// Ownership: exporting a custom map as a playable ROM — the vanilla ROM,
// extended, with the map in Brian's Test Ground's slot and the game sent
// straight there. Pure: takes the ROM buffer, returns a new one.
//
// Three patches, each the one the everscript repo already uses:
//
//   1. The map blob goes into the ROM extension and room 0x15's entry in the
//      map pointer table ($9FFDE7 + id*4) is repointed at it
//      (encode_room.write_room_into_rom).
//   2. The intro's first script code ($92E0CA, `ADDRESS.INTRO_FIRST_CODE_
//      EXECUTED`) becomes `load_map(0x15, x, y); end` — the same jump the
//      practice ROM's `intro_skip()` makes, minus its music and state setup.
//   3. Room 0x15's enter script ($92801B + id*5) is pointed at `fade_in();
//      end`. Its vanilla pointer is 0, i.e. `$928000`, the head of the
//      script pointer table, which is not a script; a room entered with no
//      fade-in stays black.
//
// Nothing is trusted: the result is decoded again with the same decoders
// the Rooms tab uses and compared with what was asked for before it is
// returned. See docs/map-format/rom-export.md.

const maps = require('../../maps');
const script = require('../../script');

/** Brian's Test Ground — a developer room, empty, never reached in play. */
const BRIAN_ROOM = 0x15;

/** `ADDRESS.INTRO_FIRST_CODE_EXECUTED` in the everscript repo's core. */
const INTRO_FIRST_CODE = 0x92e0ca;

/** Enter-script table: 5-byte entries, a packed script pointer first (linker.py `MapData`). */
const ENTER_TABLE = 0x92801b;
const ENTER_STRIDE = 5;

/** Vanilla is 3 MB; everscript's extension is `0x300000..0x3fffff`. */
const VANILLA_SIZE = 0x300000;
const EXPANDED_SIZE = 0x400000;

/**
 * Where the patches go, inside the extension. Upper bank halves, as every
 * vanilla blob is (`$8000..$FFFF`), and clear of what the everscript repo
 * itself places there: strings and scripts at `$B0`, `debug_menu` at `$BE`
 * (`$FE0000`), `scale_enemies` at `$FE8000`, `hotkeys` at `$BF`.
 */
const SCRIPT_OFFSET = 0x3c8000; // $BC:8000
const BLOB_OFFSET = 0x3d8000;   // $BD:8000, up to 32 KB

/** `load_map(map, x, y)`: `22 x y map 00`, coordinates in 8px units. */
const OP_CHANGE_MAP = 0x22;
/** `call_id(0x36)` — what `fade_in()` compiles to in the everscript core. */
const OP_CALL_GLOBAL = 0xa3;
const GLOBAL_FADE_IN = 0x36;
const OP_END = 0x00;

/** SNES header (HiROM, `$FFC0`): checksum complement, then checksum. */
const HEADER_COMPLEMENT = 0xffdc;
const HEADER_CHECKSUM = 0xffde;

/**
 * Where the Boy lands, in the 8px units opcode 0x22 takes: the middle of
 * the start marker's 16px metatile.
 */
function startUnits(start, widthTiles, heightTiles) {
    const sx = start && Number.isInteger(start.x) ? start.x : Math.floor(widthTiles / 2);
    const sy = start && Number.isInteger(start.y) ? start.y : Math.floor(heightTiles / 2);
    return {
        x: Math.max(0, Math.min(widthTiles - 1, sx)) * 2 + 1,
        y: Math.max(0, Math.min(heightTiles - 1, sy)) * 2 + 1,
    };
}

function snesOffset(addr) { return script.snesToRom(addr); }

/** Recompute the header checksum over the whole image. */
function fixChecksum(rom) {
    rom[HEADER_COMPLEMENT] = 0xff; rom[HEADER_COMPLEMENT + 1] = 0xff;
    rom[HEADER_CHECKSUM] = 0x00; rom[HEADER_CHECKSUM + 1] = 0x00;
    let sum = 0;
    for (let i = 0; i < rom.length; i++) sum = (sum + rom[i]) & 0xffff;
    const inv = sum ^ 0xffff;
    rom[HEADER_COMPLEMENT] = inv & 0xff; rom[HEADER_COMPLEMENT + 1] = inv >> 8;
    rom[HEADER_CHECKSUM] = sum & 0xff; rom[HEADER_CHECKSUM + 1] = sum >> 8;
}

/**
 * Build the patched ROM.
 *
 * `draft` is what the editor sends: `{ borrowFrom, widthTiles, heightTiles,
 * cells, graphics, families, start }` — see maps/custom-room.ts for `cells`.
 * Returns `{ rom, report }`; throws with a readable message when the map
 * cannot be encoded or the result does not decode back to it.
 */
function buildExportRom(vanilla, draft) {
    const src = vanilla instanceof Uint8Array ? vanilla : new Uint8Array(vanilla);
    if (src.length !== VANILLA_SIZE) {
        throw new Error(`expected the 3 MB vanilla ROM, got ${src.length} bytes — `
            + 'export starts from an unmodified Secret of Evermore (U)');
    }
    const w = Number(draft.widthTiles);
    const h = Number(draft.heightTiles);
    const built = maps.buildCustomRoomBlob(src, {
        borrowFrom: Number(draft.borrowFrom),
        widthTiles: w,
        heightTiles: h,
        cells: draft.cells,
        graphics: draft.graphics || [],
        families: draft.families || [],
    });

    const rom = new Uint8Array(EXPANDED_SIZE);
    rom.set(src, 0);

    // 1. The map.
    maps.writeRoomAt(rom, BRIAN_ROOM, built.blob, BLOB_OFFSET);

    // 3. The enter script, and room 0x15's pointer to it.
    rom.set([OP_CALL_GLOBAL, GLOBAL_FADE_IN, OP_END], SCRIPT_OFFSET);
    const packed = script.snesToScriptValue(0x800000 | SCRIPT_OFFSET);
    const entry = snesOffset(ENTER_TABLE + BRIAN_ROOM * ENTER_STRIDE);
    rom[entry] = packed & 0xff;
    rom[entry + 1] = (packed >> 8) & 0xff;
    rom[entry + 2] = (packed >> 16) & 0xff;

    // 2. The intro jumps there.
    const at = startUnits(draft.start, w, h);
    rom.set([OP_CHANGE_MAP, at.x, at.y, BRIAN_ROOM, 0x00, OP_END], snesOffset(INTRO_FIRST_CODE));

    fixChecksum(rom);
    verifyExport(rom, built, draft, at);

    return {
        rom,
        report: {
            room: BRIAN_ROOM,
            widthTiles: w,
            heightTiles: h,
            blobBytes: built.blob.length,
            blobAddress: 0x800000 | BLOB_OFFSET,
            metatiles: built.metatileCount,
            wramBytes: built.wramBytes,
            start: at,
        },
    };
}

/** Decode what was written and compare it with what was asked for. */
function verifyExport(rom, built, draft, at) {
    const room = maps.decodeRoom(rom, BRIAN_ROOM);
    const w = room.header.widthTiles;
    const h = room.header.heightTiles;
    if (w !== Number(draft.widthTiles) || h !== Number(draft.heightTiles)) {
        throw new Error(`export check: room decodes as ${w}x${h}`);
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 3;
            const got = [room.layer1VramWords[y][x], room.layer2VramWords[y][x], room.collisionWords[y][x]];
            const want = [draft.cells[i] & 0xffff, draft.cells[i + 1] & 0xffff, draft.cells[i + 2] & 0xffff];
            if (got[0] !== want[0] || got[1] !== want[1] || got[2] !== want[2]) {
                throw new Error(`export check: cell (${x},${y}) decodes differently from the draft`);
            }
        }
    }
    if (room.metatileCount !== built.metatileCount) {
        throw new Error(`export check: ${room.metatileCount} metatiles decoded, ${built.metatileCount} written`);
    }

    const enter = script.buildRoomScriptModel(rom, BRIAN_ROOM).enter;
    const call = enter && enter.instructions[0];
    if (!call || call.opcode !== OP_CALL_GLOBAL || !enter.terminated) {
        throw new Error('export check: room 0x15 does not enter with fade_in()');
    }

    const intro = script.decodeScript(rom, INTRO_FIRST_CODE).instructions[0];
    const change = intro && intro.effects && intro.effects.find((e) => e.kind === 'changeMap');
    if (!change || change.mapId !== BRIAN_ROOM || change.x !== at.x * 8 || change.y !== at.y * 8) {
        throw new Error('export check: the intro does not load room 0x15 at the start marker');
    }
}

module.exports = {
    buildExportRom, BRIAN_ROOM, INTRO_FIRST_CODE, BLOB_OFFSET, SCRIPT_OFFSET, EXPANDED_SIZE,
};
