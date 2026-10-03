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
//   3. Room 0x15's enter script ($92801B + id*5) is pointed at
//      `MEMORY.GAIN_WEAPON = GAIN_WEAPON.SPEAR_4; fade_in(); end` — a spear,
//      so the test ROM can cut its cuttable grass. Its vanilla pointer is 0, i.e. `$928000`, the head of the
//      script pointer table, which is not a script; a room entered with no
//      fade-in stays black.
//
// Nothing is trusted: the result is decoded again with the same decoders
// the Rooms tab uses and compared with what was asked for before it is
// returned. See docs/map-format/rom-export.md.

const maps = require('../../maps');
const script = require('../../script');
const { vanillaIndex } = require('./vanilla-index');

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
/**
 * `MEMORY.GAIN_WEAPON = GAIN_WEAPON.SPEAR_4;` — opcode `0x14` writes a byte,
 * its address is an offset from `$2258` (`$2441` -> `E9 01`), and `0x18` is
 * the inline constant `0xE0 + (0x18 - 0x10)`. The Boy gets the Laser Lance,
 * so a test ROM can cut grass: after the intro skip he has only the Bone
 * Crusher.
 */
const GAIN_SPEAR_4 = [0x14, 0xe9, 0x01, 0xe8];

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
 * The collision bits that let a trigger fire at all. A B press checks the
 * B-trigger table only when the tile the Boy faces has bit 15 (`$8FCE43
 * BIT #$8000`) — without it he swings his weapon. The step-on table is
 * searched only while he stands on a bit-14 tile (`$8FB07B`). Vanilla
 * gourds carry bit 15 (`$9019`/`$901F`) and lose it when opened (`$1019`).
 * See docs/map-format/gourds-and-map-objects.md §6 and
 * map_collision_mechanics.md §7.2.
 */
const TRIGGER_GATE = { bTrigger: 0x8000, stepOn: 0x4000 };

/**
 * The draft with each trigger's gate bit on every cell it covers, so every
 * trigger the editor drew can fire. Only the map shown on load changes: an
 * object's later states keep their own words, so an opened gourd stops
 * answering B, as vanilla's does. `x2`/`y2` are inclusive here.
 */
function withTriggerGates(draft) {
    const w = Number(draft.widthTiles);
    const h = Number(draft.heightTiles);
    const rects = [];
    for (const kind of Object.keys(TRIGGER_GATE)) {
        for (const t of draft[kind] || []) {
            const x1 = Number(t.x1) || 0, y1 = Number(t.y1) || 0;
            rects.push({
                bit: TRIGGER_GATE[kind], x1, y1,
                x2: Math.max(x1, Number(t.x2) || 0), y2: Math.max(y1, Number(t.y2) || 0),
            });
        }
    }
    if (!rects.length || !Array.isArray(draft.cells)) return draft;
    const gate = (x, y) => rects.reduce((bits, r) =>
        (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2 ? bits | r.bit : bits), 0);
    const cells = draft.cells.slice();
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) cells[(y * w + x) * 3 + 2] |= gate(x, y);
    }
    // A cuttable cell shows its own words on load, so those need the bits too.
    const cut = (draft.cut || []).map((c) => {
        const bits = gate(c[0] | 0, c[1] | 0);
        return bits ? [c[0], c[1], c[2], c[3], c[4] | bits] : c;
    });
    return { ...draft, cells, cut };
}

/**
 * Build the patched ROM.
 *
 * `draft` is what the editor sends: `{ borrowFrom, widthTiles, heightTiles,
 * cells, graphics, families, start }` — see maps/custom-room.ts for `cells`.
 * Returns `{ rom, report }`; throws with a readable message when the map
 * cannot be encoded or the result does not decode back to it.
 */
function buildExportRom(vanilla, asDrawn) {
    // A private copy: the caller's buffer is the extension's cached ROM, and
    // nothing an export does may ever reach it.
    const src = Uint8Array.from(vanilla);
    // What gets written — and checked against below — is the draft with its
    // triggers made reachable.
    const draft = withTriggerGates(asDrawn);
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
        cut: draft.cut || [],
        objects: draft.objects || [],
        stepOn: (draft.stepOn || []).map((t) => ({
            x1: Number(t.x1) || 0,
            y1: Number(t.y1) || 0,
            x2: Math.max(Number(t.x1) || 0, Number(t.x2) || 0) + 1,
            y2: Math.max(Number(t.y1) || 0, Number(t.y2) || 0) + 1,
            scriptId: Number(t.scriptId) || 0,
        })),
        bTrigger: (draft.bTrigger || []).map((t) => ({
            x1: Number(t.x1) || 0,
            y1: Number(t.y1) || 0,
            x2: Math.max(Number(t.x1) || 0, Number(t.x2) || 0) + 1,
            y2: Math.max(Number(t.y1) || 0, Number(t.y2) || 0) + 1,
            scriptId: Number(t.scriptId) || 0,
        })),
        // The map's own header settings (the Info tab), over the donor's.
        header: draft.header || undefined,
        // The Animation tab's channels; a draft from before it gets vanilla's
        // cycle for every animated graphic it placed.
        channels: Array.isArray(draft.channels) ? draft.channels : undefined,
        animations: vanillaIndex(src).animations,
    });

    const rom = new Uint8Array(EXPANDED_SIZE);
    rom.set(src, 0);

    // 1. The map.
    maps.writeRoomAt(rom, BRIAN_ROOM, built.blob, BLOB_OFFSET);

    // 3. The enter script, and room 0x15's pointer to it.
    rom.set(GAIN_SPEAR_4.concat([OP_CALL_GLOBAL, GLOBAL_FADE_IN, OP_END]), SCRIPT_OFFSET);
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
        // The map's own bytes, as written into room 0x15 — the export archive's
        // `.bin` (custom-export.js), checked by the same round trip as the ROM.
        blob: built.blob,
        report: {
            room: BRIAN_ROOM,
            widthTiles: w,
            heightTiles: h,
            blobBytes: built.blob.length,
            blobAddress: 0x800000 | BLOB_OFFSET,
            metatiles: built.metatileCount,
            cuttable: (draft.cut || []).length,
            wramBytes: built.wramBytes,
            /** Section 2 channels: placed graphics that animate. */
            animated: built.animation.channels.length,
            /** Animated graphics left still past the channel limit. */
            stillAnimated: built.animation.skipped,
            start: at,
        },
    };
}

/** Decode what was written and compare it with what was asked for. */
function verifyExport(rom, built, draft, at) {
    const room = maps.decodeRoom(rom, BRIAN_ROOM);
    // What the room shows on load: the cuttable layer where there is one.
    const shown = maps.draftTopCells({ widthTiles: Number(draft.widthTiles), cells: draft.cells, cut: draft.cut || [] });
    const w = room.header.widthTiles;
    const h = room.header.heightTiles;
    if (w !== Number(draft.widthTiles) || h !== Number(draft.heightTiles)) {
        throw new Error(`export check: room decodes as ${w}x${h}`);
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 3;
            const got = [room.layer1VramWords[y][x], room.layer2VramWords[y][x], room.collisionWords[y][x]];
            // The same graphics: an animated one sits in its channel's slot now.
            const want = [built.remap(shown[i]), built.remap(shown[i + 1]), shown[i + 2] & 0xffff];
            if (got[0] !== want[0] || got[1] !== want[1] || got[2] !== want[2]) {
                throw new Error(`export check: cell (${x},${y}) decodes differently from the draft`);
            }
        }
    }
    if (room.metatileCount !== built.metatileCount) {
        throw new Error(`export check: ${room.metatileCount} metatiles decoded, ${built.metatileCount} written`);
    }

    // Each cuttable cell is cut to exactly the words beneath it.
    const grass = room.cuttableGrass;
    if (grass.warnings.length) throw new Error('export check: grass table — ' + grass.warnings.join('; '));
    if (grass.tiles.length !== (draft.cut || []).length) {
        throw new Error(`export check: ${grass.tiles.length} cuttable cells decoded, ${(draft.cut || []).length} drawn`);
    }
    const S = room.metatileSlices;
    for (const [x, y] of grass.tiles) {
        const dst = (grass.table.swaps.get(room.layer1MetatileIds[y][x]) - room.baseMetatile) / 8;
        const i = (y * w + x) * 3;
        if (S.layer1[dst] !== built.remap(draft.cells[i]) || S.layer2[dst] !== built.remap(draft.cells[i + 1])
            || S.collision[dst] !== (draft.cells[i + 2] & 0xffff)) {
            throw new Error(`export check: cutting (${x},${y}) does not reveal the tile beneath it`);
        }
    }

    // Each channel drives the graphic it was planned for, with its cycle.
    const chans = built.animation.channels;
    if (room.animation.length !== chans.length) {
        throw new Error(`export check: ${room.animation.length} animation channels decoded, ${chans.length} written`);
    }
    chans.forEach((c, k) => {
        const got = room.animation[k].frames.map((f) => f.tileId);
        if (room.animatedTiles[k] !== c.graphic || got.join() !== c.frames.join()) {
            throw new Error(`export check: animation channel ${k} does not play graphic ${c.graphic}'s cycle`);
        }
    });

    const expStep = (draft.stepOn || []).length;
    if (room.triggers.stepOn.length !== expStep) {
        throw new Error(`export check: ${room.triggers.stepOn.length} step triggers decoded, ${expStep} expected`);
    }
    const expB = (draft.bTrigger || []).length;
    if (room.triggers.bTrigger.length !== expB) {
        throw new Error(`export check: ${room.triggers.bTrigger.length} B-triggers decoded, ${expB} expected`);
    }

    const enter = script.buildRoomScriptModel(rom, BRIAN_ROOM).enter;
    const ops = enter ? enter.instructions.map((r) => r.opcode) : [];
    if (ops.join() !== [GAIN_SPEAR_4[0], OP_CALL_GLOBAL, OP_END].join() || !enter.terminated
        || !/\$2441\) = .*\(0x18\)/.test(enter.instructions[0].summary)) {
        throw new Error('export check: room 0x15 does not enter with the spear and fade_in()');
    }

    const intro = script.decodeScript(rom, INTRO_FIRST_CODE).instructions[0];
    const change = intro && intro.effects && intro.effects.find((e) => e.kind === 'changeMap');
    if (!change || change.mapId !== BRIAN_ROOM || change.x !== at.x * 8 || change.y !== at.y * 8) {
        throw new Error('export check: the intro does not load room 0x15 at the start marker');
    }
}

module.exports = {
    buildExportRom, withTriggerGates, BRIAN_ROOM, INTRO_FIRST_CODE, BLOB_OFFSET, SCRIPT_OFFSET, EXPANDED_SIZE,
};
