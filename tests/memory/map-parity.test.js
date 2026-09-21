// Parity harness: the TypeScript map decoder in src/maps/ vs. the verified
// Python implementation in the sibling everscript repo.
//
// The TS code is a port, not an independent re-derivation — this test is what
// makes that claim checkable. It decodes rooms with both implementations and
// diffs the results field by field.
//
// Skips (does not fail) when the ROM or the everscript checkout is unavailable,
// since neither is committed to this repo.

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const {
    decodeRoom, MAX_ROOMS, renderRoomComposite, encodePng, drawCollisionOverlay,
    parseObjectStamp, applyObjectStates, objectStateCount,
    drawCollisionOverlay: paintOverlay, buildAnimationGroups, buildOverlayTransfer,
} = require('../../src/maps');
const maps = require('../../src/maps');

const EVERSCRIPT_REPO = process.env.EVERSCRIPT_REPO ||
    path.join(path.dirname(path.dirname(path.dirname(path.resolve(__dirname)))), 'everscript');
const ROM_PATH = process.env.EVERSCRIPT_ROM || path.join(EVERSCRIPT_REPO, 'Secret of Evermore (U) [!].smc');
const PYTHON = process.env.EVERSCRIPT_PYTHON || path.join(EVERSCRIPT_REPO, '.venv', 'bin', 'python3');

// Rooms covered by upstream's own VRAM ground-truth tests, plus 0x38 (the room
// the retired sentinel decoder failed on) and 0x15 (uncompressed Block 3).
const SAMPLE_ROOMS = [0x33, 0x34, 0x38, 0x25, 0x26, 0x36, 0x51, 0x5b, 0x15];

function skip(reason) {
    console.log(`SKIP map-parity: ${reason}`);
    process.exit(0);
}

function pythonDump(roomId) {
    const res = cp.spawnSync(PYTHON, ['tools/dump_room.py', `0x${roomId.toString(16)}`, '--json', '--rom', ROM_PATH], {
        cwd: EVERSCRIPT_REPO,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
    });
    if (res.status !== 0) throw new Error(`python dump_room failed for 0x${roomId.toString(16)}: ${res.stderr}`);
    return JSON.parse(res.stdout);
}

function hexGrid(grid) {
    return grid.map((row) => row.map((v) => '0x' + v.toString(16).toUpperCase().padStart(4, '0')));
}

let failures = 0;
function check(label, actual, expected) {
    const a = JSON.stringify(actual) ?? 'undefined';
    const e = JSON.stringify(expected) ?? 'undefined';
    if (a !== e) {
        failures += 1;
        const cut = (s) => (s.length > 220 ? s.slice(0, 220) + '…' : s);
        console.error(`  FAIL ${label}\n    ts: ${cut(a)}\n    py: ${cut(e)}`);
    }
}

function main() {
    if (!fs.existsSync(EVERSCRIPT_REPO)) skip(`everscript repo not found at ${EVERSCRIPT_REPO}`);
    if (!fs.existsSync(ROM_PATH)) skip(`ROM not found at ${ROM_PATH}`);
    if (!fs.existsSync(PYTHON)) skip(`python not found at ${PYTHON}`);

    const rom = new Uint8Array(fs.readFileSync(ROM_PATH));
    const rooms = process.env.MAP_PARITY_ALL ? Array.from({ length: MAX_ROOMS }, (_, i) => i) : SAMPLE_ROOMS;

    console.log(`map-parity: comparing ${rooms.length} rooms against ${PYTHON}`);

    checkSprites(rom);

    for (const roomId of rooms) {
        const id = `0x${roomId.toString(16).padStart(2, '0')}`;
        let py;
        try {
            py = pythonDump(roomId);
        } catch (err) {
            failures += 1;
            console.error(`  FAIL ${id}: python side errored — ${err.message}`);
            continue;
        }

        const ts = decodeRoom(rom, roomId);

        check(`${id} header.width_tiles`, ts.header.widthTiles, py.header.width_tiles);
        check(`${id} header.height_tiles`, ts.header.heightTiles, py.header.height_tiles);
        check(`${id} header.origin_x`, ts.header.originX, py.header.origin_x);
        check(`${id} header.origin_y`, ts.header.originY, py.header.origin_y);
        check(`${id} metatile_count`, ts.metatileCount, py.metatile_count);
        check(`${id} base_metatile`, '0x' + ts.baseMetatile.toString(16).toUpperCase().padStart(4, '0'), py.base_metatile);
        check(`${id} step_on triggers`, ts.triggers.stepOn.map((t) => [t.y1, t.x1, t.y2, t.x2, t.scriptId]),
            py.triggers.step_on.map((t) => [t.y1, t.x1, t.y2, t.x2, t.script_id]));
        check(`${id} b triggers`, ts.triggers.bTrigger.map((t) => [t.y1, t.x1, t.y2, t.x2, t.scriptId]),
            py.triggers.b_trigger.map((t) => [t.y1, t.x1, t.y2, t.x2, t.script_id]));
        check(`${id} object_count`, ts.objects.length, py.object_count);
        // dump_room.py --json emits the hex-string grid forms only, so the port's
        // number grids are formatted to match.
        check(`${id} layer1_metatile_ids`, hexGrid(ts.layer1MetatileIds), py.layer1_metatile_ids);
        check(`${id} layer1_vram_words`, hexGrid(ts.layer1VramWords), py.layer1_vram_words);
        check(`${id} layer2_vram_words`, hexGrid(ts.layer2VramWords), py.layer2_vram_words);
        check(`${id} collision_words`, hexGrid(ts.collisionWords), py.collision_words);
        check(`${id} elevation_planes`, ts.elevationPlanes, py.elevation_planes);
        check(`${id} cuttable_grass_tiles`, ts.cuttableGrass.tiles.map((t) => [t[0], t[1]]),
            py.cuttable_grass_tiles.map((t) => [t[0], t[1]]));
        check(`${id} tile_palette`, ts.tilePalette.length, py.tile_palette_count);
        console.log(`  ${id} ${py.header.width_tiles}x${py.header.height_tiles} checked`);
    }

    checkRenderParity(rom, rooms);
    checkOverlayParity(rom, rooms);
    checkObjectStamps(rom);
    checkAnimation(rom);

    if (failures) {
        console.error(`\nmap-parity: ${failures} mismatch(es)`);
        process.exit(1);
    }
    console.log('map-parity: all checked fields match the Python implementation');
}

/**
 * Compare the TypeScript renderer against render_map.py pixel for pixel.
 *
 * Both sides encode PNG themselves, so rather than decoding two PNGs this
 * compares the raw RGBA the Python renderer produces (dumped via a tiny inline
 * script) against ours.
 */
function checkRenderParity(rom, rooms) {
    const sample = rooms.length > 12 ? rooms.filter((_, i) => i % 12 === 0) : rooms;
    console.log(`map-parity: comparing rendered pixels for ${sample.length} rooms`);

    for (const roomId of sample) {
        const id = `0x${roomId.toString(16).padStart(2, '0')}`;
        let ts;
        try {
            ts = renderRoomComposite(rom, decodeRoom(rom, roomId));
        } catch (err) {
            failures += 1;
            console.error(`  FAIL ${id} render: ${err.message}`);
            continue;
        }

        const py = cp.spawnSync(PYTHON, ['-c', PY_DUMP_RGBA, String(roomId), ROM_PATH], {
            cwd: EVERSCRIPT_REPO,
            encoding: 'buffer',
            maxBuffer: 512 * 1024 * 1024,
        });
        if (py.status !== 0) {
            failures += 1;
            console.error(`  FAIL ${id} render: python side errored — ${String(py.stderr)}`);
            continue;
        }

        const expected = py.stdout;
        if (expected.length !== ts.data.length) {
            failures += 1;
            console.error(`  FAIL ${id} render: size ${ts.data.length} vs ${expected.length}`);
            continue;
        }
        let diff = 0;
        for (let i = 0; i < expected.length; i += 4) {
            if (ts.data[i] !== expected[i] || ts.data[i + 1] !== expected[i + 1] || ts.data[i + 2] !== expected[i + 2]) diff += 1;
        }
        if (diff) {
            failures += 1;
            console.error(`  FAIL ${id} render: ${diff} differing pixels`);
        } else {
            console.log(`  ${id} render ${ts.width}x${ts.height} pixel-identical`);
        }
    }
}

/**
 * The animation overlay has to agree with the map underneath it.
 *
 * Two regressions this pins, both found on room 0x25's firepit:
 *
 *  - Which channel drives a cell comes from the tilemap word in it, and an
 *    object state rewrites that word. The firepit runs on channels 6-9 unlit
 *    and 0-3 burning, so animation cached across a state change replayed the
 *    unlit frames over the lit tiles.
 *  - An animated cell can also carry a contour, an object box or a label.
 *    Frames are bare composites, so without re-applying the overlay they
 *    wipe that art; with it, every animated pixel has to match what a full
 *    annotated render would have put there.
 */
function checkAnimation(rom) {
    const room = decodeRoom(rom, 0x25);
    const nPal = room.tilePalette.length;
    const slot = (w) => Math.floor((w & 0x3ff) / 0x20) * 8 + Math.floor(((w & 0x3ff) % 0x20) / 2);
    const chansAt = (r, x, y) => [r.layer1VramWords[y][x], r.layer2VramWords[y][x]]
        .map((w) => slot(w) - nPal).filter((c) => c >= 0);

    // The state change really does move the cell onto different channels.
    check('0x25 firepit channels unlit', chansAt(room, 31, 46).concat(chansAt(room, 32, 46)), [6, 7]);
    const lit = applyObjectStates(rom, room, { 17: 1 });
    check('0x25 firepit channels burning', chansAt(lit, 31, 46).concat(chansAt(lit, 32, 46)), [0, 1]);

    // Every animated pixel must match a real annotated render of that frame.
    const w = room.header.widthTiles * 16;
    const transfer = buildOverlayTransfer(w, room.header.heightTiles * 16,
        (img) => paintOverlay(img, room, {}));
    const groups = buildAnimationGroups(rom, room, { layer: 'composite', overlay: transfer });
    let compared = 0; let worst = 0;
    for (const g of groups.slice(0, 8)) {
        for (let s = 0; s < g.frames.length; s++) {
            const tiles = room.animatedTiles.slice();
            for (const c of g.channels) {
                const f = room.animation[c].frames;
                tiles[c] = f[s % f.length].tileId;
            }
            const staged = { ...room, animatedTiles: tiles };
            const truth = renderRoomComposite(rom, staged);
            paintOverlay(truth, staged, {});
            const fr = g.frames[s];
            for (let py = 0; py < fr.height; py++) {
                for (let px = 0; px < fr.width; px++) {
                    const o = (py * fr.width + px) * 4;
                    if (fr.data[o + 3] === 0) continue;
                    const t = ((g.y * 16 + py) * w + (g.x * 16 + px)) * 4;
                    compared += 1;
                    for (let ch = 0; ch < 3; ch++) {
                        worst = Math.max(worst, Math.abs(fr.data[o + ch] - truth.data[t + ch]));
                    }
                }
            }
        }
    }
    // 1 is the rounding of re-applying a blend through the measured transfer.
    check('0x25 animation frames match an annotated render', worst <= 1, true);
    console.log(`map-parity: animation — ${compared} animated pixels, worst channel delta ${worst}`);
}

/**
 * Hold the object stamp format to the hardware.
 *
 * The record layout and the XOR semantics were read off a Mesen CPU trace of
 * looting the chest on map 0x71 ($90A4E8: `TXA / EOR [$B0] / STA [$AD]`).
 * These are the exact values that trace wrote, so a regression in the parser
 * or in applyObjectStates fails here rather than silently drawing the wrong
 * furniture. Unlike the rest of this file it needs no Python, only the ROM.
 */
function checkObjectStamps(rom) {
    const room = decodeRoom(rom, 0x71);

    // Straight from the trace: object 0x14, anchor (0x14, 0x39), stamp
    // pointer 0x324, footprint 2x2, and the grid words before and after.
    const obj = room.objects[0x14];
    check('0x71 obj 0x14 state count', objectStateCount(obj), 2);
    check('0x71 obj 0x14 anchor', [obj.states[0].tileX, obj.states[0].tileY], [0x14, 0x39]);
    check('0x71 obj 0x14 stamp pointer', obj.states[0].metatileId, 0x324);

    const stamp = parseObjectStamp(rom, room.objectArea, obj.states[0].metatileId);
    check('0x71 obj 0x14 footprint', [stamp.tw, stamp.th], [2, 2]);
    check('0x71 obj 0x14 first two deltas', stamp.deltas.slice(0, 2), [0x2470, 0x2410]);

    // $7F34B4 and $7F34B6, i.e. (20,57) and (21,57) at map width 118.
    check('0x71 grid before (trace $7F34B4/6)',
        [room.layer1MetatileIds[0x39][0x14], room.layer1MetatileIds[0x39][0x15]], [0x5CC8, 0x5CD0]);
    const opened = applyObjectStates(rom, room, { 0x14: 1 });
    check('0x71 grid after the trace wrote it',
        [opened.layer1MetatileIds[0x39][0x14], opened.layer1MetatileIds[0x39][0x15]], [0x78B8, 0x78C0]);

    // The whole-ROM invariants the format was validated against.
    let records = 0; let sized = 0; let writes = 0; let resolved = 0;
    for (let id = 0; id < MAX_ROOMS; id++) {
        let r;
        try { r = decodeRoom(rom, id); } catch { continue; }
        const seen = new Map();
        for (const o of r.objects) {
            const grid = new Map();
            for (const st of o.states) {
                const sp = parseObjectStamp(rom, r.objectArea, st.metatileId);
                if (!sp.valid) continue;
                seen.set(st.metatileId, sp.byteLength);
                for (let k = 0; k < sp.deltas.length; k++) {
                    if (sp.deltas[k] === null) continue;
                    const tx = st.tileX + (k % sp.tw);
                    const ty = st.tileY + Math.floor(k / sp.tw);
                    if (ty >= r.header.heightTiles || tx >= r.header.widthTiles) continue;
                    const key = ty * 4096 + tx;
                    const cur = grid.has(key) ? grid.get(key) : r.layer1MetatileIds[ty][tx];
                    const next = cur ^ sp.deltas[k];
                    grid.set(key, next);
                    writes += 1;
                    const idx = (next - r.baseMetatile) / 8;
                    if (Number.isInteger(idx) && idx >= 0 && idx < r.metatileCount) resolved += 1;
                }
            }
        }
        // A record's computed length must land exactly on the next record.
        const ptrs = Array.from(seen.keys()).sort((a, b) => a - b);
        for (let i = 0; i + 1 < ptrs.length; i++) {
            records += 1;
            if (seen.get(ptrs[i]) === ptrs[i + 1] - ptrs[i]) sized += 1;
        }
    }
    check('object stamp record lengths tile exactly', `${sized}/${records}`, `${records}/${records}`);
    check('cumulative XOR always lands on a real metatile', `${resolved}/${writes}`, `${writes}/${writes}`);
    console.log(`map-parity: object stamps — ${records} record lengths, ${writes} tile writes, all exact`);
}

/**
 * Compare the feature visualization against render_full_composition.
 *
 * Exact: every pass including the 3x5 index labels is now ported, so a single
 * differing pixel is a real regression. The budget stayed non-zero only while
 * the labels were missing; there is nothing left for it to forgive.
 */
const OVERLAY_DIFF_BUDGET = 0; // exact — the port draws every pass upstream does

/**
 * The sprite decoder, against the reference's own walk.
 *
 * SoETilesViewer reads this format and nothing else does, so the number of
 * sprites its walk finds is the only external check available — and it is a
 * sharp one: the walk chains on each entry's own length, so a single
 * mis-sized sprite desynchronises every one after it.
 */
function checkSprites(rom) {
    const sprites = maps.walkSprites(rom);
    // SoETilesViewer's own walk from $CA0003 ends here.
    check('sprite count', sprites.length, 5128);

    // Nearly every sprite composes to something visible; an all-transparent
    // result would mean the block pointers or the decompression came out
    // wrong. Nine of the 5128 are genuinely blank — padding between banks —
    // so this is a bound, not zero.
    let empty = 0;
    let widest = 0;
    for (const info of sprites) {
        const px = maps.composeSprite(rom, info);
        if (!px.pixels.some((v) => v >= 0)) empty += 1;
        if (px.width > widest) widest = px.width;
    }
    check('sprites that compose to nothing', empty <= 16, true);
    check('widest sprite is plausible', widest > 8 && widest <= 256, true);

    // Both block pools decode to their declared size.
    check('16x16 block size', maps.decodeSpriteBlock(rom, 0, true).pixels.length, 256);
    check('8x8 block size', maps.decodeSpriteBlock(rom, 0, false).pixels.length, 64);
    console.log(`  sprites: ${sprites.length} walked, ${empty} blank, widest ${widest}px`);
}

function checkOverlayParity(rom, rooms) {
    // Rooms chosen to exercise the passes: 0x06 has all four elevation planes,
    // 0x1b is drift-heavy and multi-plane (SHEAR arrows), 0x36 has cuttable
    // grass, 0x0b is label-dense (13 objects, 22 triggers, 15 entity gates).
    const sample = [0x33, 0x38, 0x1b, 0x06, 0x0b, 0x36].filter((id) => rooms.indexOf(id) >= 0 || rooms.length > 12);
    if (!sample.length) return;
    console.log(`map-parity: comparing collision overlay for ${sample.length} rooms`);

    for (const roomId of sample) {
        const id = `0x${roomId.toString(16).padStart(2, '0')}`;
        let ts;
        try {
            const room = decodeRoom(rom, roomId);
            ts = renderRoomComposite(rom, room);
            drawCollisionOverlay(ts, room, { triggers: true });
        } catch (err) {
            failures += 1;
            console.error(`  FAIL ${id} overlay: ${err.message}`);
            continue;
        }

        const py = cp.spawnSync(PYTHON, ['-c', PY_DUMP_COMPOSITION, String(roomId), ROM_PATH], {
            cwd: EVERSCRIPT_REPO, encoding: 'buffer', maxBuffer: 512 * 1024 * 1024,
        });
        if (py.status !== 0) {
            failures += 1;
            console.error(`  FAIL ${id} overlay: python side errored — ${String(py.stderr).slice(-300)}`);
            continue;
        }

        const expected = py.stdout;
        if (expected.length !== ts.data.length) {
            failures += 1;
            console.error(`  FAIL ${id} overlay: size ${ts.data.length} vs ${expected.length}`);
            continue;
        }
        let diff = 0;
        for (let i = 0; i < expected.length; i += 4) {
            if (ts.data[i] !== expected[i] || ts.data[i + 1] !== expected[i + 1] || ts.data[i + 2] !== expected[i + 2]) diff += 1;
        }
        const ratio = diff / (expected.length / 4);
        if (ratio > OVERLAY_DIFF_BUDGET) {
            failures += 1;
            console.error(`  FAIL ${id} overlay: ${diff} pixels differ (${(ratio * 100).toFixed(4)}%)`);
        } else {
            console.log(`  ${id} overlay ${ts.width}x${ts.height} pixel-identical`);
        }
    }
}

// Dumps the composited RGBA buffer to stdout so the two renderers can be
// compared without either side's PNG encoder in the way.
const PY_DUMP_RGBA = `
import sys
sys.path.insert(0, '.')
from tools.dump_room import dump_room
from tools.render_map import RoomRenderer
room_id = int(sys.argv[1]); rom_path = sys.argv[2]
data = dump_room(room_id, rom_path)
rom = open(rom_path, 'rb').read()
r = RoomRenderer(data, rom)
l1 = r.render_vram_layer(data['layer1_vram_int_words'])
l2 = r.render_vram_layer(data['layer2_vram_int_words'])
sys.stdout.buffer.write(bytes(r.composite_layers(l2, l1)))
`;


// Same, but through render_full_composition — the annotated view the Rooms
// tab's collision overlay ports. Legend banner disabled so the buffer is just
// the map area.
const PY_DUMP_COMPOSITION = `
import sys
sys.path.insert(0, '.')
from tools.dump_room import dump_room
from tools.render_map import RoomRenderer
room_id = int(sys.argv[1]); rom_path = sys.argv[2]
data = dump_room(room_id, rom_path)
rom = open(rom_path, 'rb').read()
r = RoomRenderer(data, rom)
l1 = r.render_vram_layer(data['layer1_vram_int_words'])
l2 = r.render_vram_layer(data['layer2_vram_int_words'])
comp = r.composite_layers(l2, l1)
out, ow, oh = r.render_full_composition(comp, add_legend=False)
sys.stdout.buffer.write(bytes(out[:r.w_pixels * r.h_pixels * 4]))
`;

main();
