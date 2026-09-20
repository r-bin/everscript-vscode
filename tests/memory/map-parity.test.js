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

const { decodeRoom, MAX_ROOMS, renderRoomComposite, encodePng, drawCollisionOverlay } = require('../../src/maps');

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
 * Compare the collision/feature visualization against render_full_composition.
 *
 * The residual is the text labels (script-id digits and their black outlines),
 * which are deliberately not ported — the Rooms tab draws labels as
 * interactive SVG instead of baking a 3x5 bitmap font into the raster. Every
 * graphical element is expected to match exactly, so the budget is small.
 */
const OVERLAY_DIFF_BUDGET = 0.005; // 0.5% of pixels

function checkOverlayParity(rom, rooms) {
    // Rooms chosen to exercise the passes: 0x06 has all four elevation planes,
    // 0x1b is drift-heavy and multi-plane, 0x36 has cuttable grass.
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
            console.error(`  FAIL ${id} overlay: ${(ratio * 100).toFixed(3)}% differ (budget ${(OVERLAY_DIFF_BUDGET * 100).toFixed(1)}%)`);
        } else {
            console.log(`  ${id} overlay ${ts.width}x${ts.height} within budget (${(ratio * 100).toFixed(3)}% = label text)`);
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
