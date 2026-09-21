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

    checkHitboxes(rom);
    checkRenderParity(rom, rooms);
    checkOverlayParity(rom, rooms);
    checkObjectStamps(rom);
    checkAnimation(rom);
    checkMetatilePalette(rom);
    checkVanillaIndex(rom);
    checkBudget(rom);

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

    // Character -> sprite, the chain solved from the Mosquito spawn trace.
    // The Mosquito's own answer is the anchor: it is the one case checked
    // against a running game, which drew sprites from the same neighbourhood.
    // $CC5B38 and $CC5B3F are the two frames the game was traced drawing for
    // a Mosquito, 28 and 27 times alternating. Matching them is the strongest
    // check available: it comes from the running game, not from this code.
    check('mosquito idle sprite', maps.resolveCharacterSprite(rom, 113), 0xcc5b38);
    const flap = maps.characterAnimation(rom, 113).frames;
    check('mosquito flaps between the traced frames',
        flap.length === 2 && flap[0].sprite === 0xcc5b38 && flap[1].sprite === 0xcc5b3f, true);
    // The game drew them 28 and 27 times, so the two holds have to come out
    // even. They do, at two frames each.
    check('mosquito holds both frames equally', flap[0].ticks === flap[1].ticks, true);
    check('wimpy flower idle sprite', maps.resolveCharacterSprite(rom, 109), 0xcc4f3b);
    // The flower stands still: one sprite, a long hold, then the script's own
    // loop command. Walking past that loop is what used to play two frames of
    // its attack instead.
    const idle = maps.characterAnimation(rom, 109);
    check('wimpy flower idle is a still image', idle.frames.length, 1);
    check('wimpy flower idle holds for 102 frames', idle.frames[0].ticks, 102);
    check('wimpy flower walk reaches its loop', idle.complete, true);
    // The Viper's animation is directional, so this one is the facing test:
    // $CD2C66 is the sprite the game drew after a FACE SOUTH, and a
    // non-directional read gives $CD2CF5 instead.
    check('viper faces south', maps.resolveCharacterSprite(rom, 92), 0xcd2c66);
    // Sprites anchor at their feet, not their centre — placing by the centre
    // drops an enemy about a tile low.
    const flower = maps.renderCharacterFrames(rom, 109);
    check('flower frames share one box', new Set(flower.frames.map((f) => f.data.length)).size, 1);
    check('flower origin is below centre', flower.originY > flower.height / 2, true);
    const names = require('../../src/script/names.json');
    let rendered = 0;
    let total = 0;
    for (const enemy of Object.values(names.enemies)) {
        if (enemy.character === null) continue;
        total += 1;
        if (maps.renderCharacterSprite(rom, enemy.character)) rendered += 1;
    }
    // The 15 that do not render are 13 whose idle script draws nothing at all
    // (tentacles, Thraxx's arms, the fan and speaker entities — the game does
    // not draw them either) and the two segmented bosses, whose `0x57` command
    // has no fixed length. Raise this as more are learned.
    check('enemies that render >= 126', rendered >= 126, true);
    let animated = 0;
    let complete = 0;
    for (const enemy of Object.values(names.enemies)) {
        if (enemy.character === null) continue;
        const walk = maps.characterAnimation(rom, enemy.character);
        if (new Set(walk.frames.map((f) => f.sprite)).size > 1) animated += 1;
        if (walk.complete) complete += 1;
    }
    check('enemies with a real animation >= 37', animated >= 37, true);
    // A walk that ends on the script's own loop has read the whole cycle.
    check('enemy walks that reach a loop >= 139', complete >= 139, true);
    console.log(`  enemy sprites: ${rendered}/${total} resolved, ${animated} animated, ${complete} complete`);

    // Chunk flags are an OAM attribute byte: bits 4-5 are the priority, and
    // only two levels are ever used. Drawing order follows from that plus the
    // OAM rule that a lower index sits in front — get it backwards and a
    // boss's face ends up behind its body.
    const levels = new Set();
    let ordered = 0;
    for (const info of sprites) for (const c of info.chunks) levels.add(c.priority);
    check('chunk priorities in use', [...levels].sort().join(','), '0,1');
    for (const info of sprites) {
        const seen = new Map();
        for (const c of info.chunks) {
            const key = `${c.priority}:${c.x},${c.y}`;
            if (seen.has(key)) ordered += 1;
            seen.set(key, true);
        }
    }
    check('sprites reuse a cell, so order matters', ordered > 0, true);
}

/**
 * Collision boxes, against the trace of the Boy walking into a Wimpy Flower.
 *
 * The trace is the ground truth here: it walks into the same flower from the
 * west, the north and the east, and the game's own decision is recorded on
 * every frame. 925 of those tests were replayed against this rule and it
 * agreed with all of them, so the boundaries below are the game's, not this
 * code's idea of them.
 */
function checkHitboxes(rom) {
    const flower = maps.characterHitbox(rom, 109);
    const boy = maps.characterHitbox(rom, 0);
    check('wimpy flower radius', flower.radius, 14);
    check('wimpy flower box', `${flower.width}x${flower.height}`, '28x14');
    check('boy radius', boy.radius, 8);

    // The traced flower: room 0x38's spawn at (73,121), which is pixel
    // (584,968) — 8 pixels to the map's unit.
    const traced = { x: 584, y: 968, radius: flower.radius };
    const from = (dx, dy) => maps.entitiesCollide(
        { x: 584 - dx, y: 968 - dy, radius: boy.radius }, traced);
    // Walking in from the west and the east: blocked up to 21 px away, free
    // at 22 — exactly the sum of the two radii.
    check('blocked 21px to the west', from(21, 0), true);
    check('free 22px to the west', from(22, 0), false);
    check('blocked 21px to the east', from(-21, 0), true);
    check('free 22px to the east', from(-22, 0), false);
    // From the north the box is half as tall, so it gives way at 11.
    check('blocked 10px to the north', from(0, 10), true);
    check('free 11px to the north', from(0, 11), false);

    // Radius 0 means no body at all ($8FB4B2 BEQ): the statue, the bridge and
    // the stone cobras are walked straight through.
    check('statue has no body', maps.characterHitbox(rom, 27).solid, false);
    check('bridge has no body', maps.characterHitbox(rom, 28).solid, false);
    const names = require('../../src/script/names.json');
    let solid = 0;
    let insubstantial = 0;
    for (const enemy of Object.values(names.enemies)) {
        if (enemy.character === null) continue;
        if (maps.characterHitbox(rom, enemy.character).solid) solid += 1;
        else insubstantial += 1;
    }
    check('most characters have a body', solid >= 130, true);
    console.log(`  hitboxes: ${solid} solid, ${insubstantial} walk-through`);
    checkStrikeBoxes(rom);
}

/**
 * Strike boxes, against the trace of the Boy hitting that same flower.
 *
 * The Boy's sword animation is not reachable from the character table — the
 * party's attack animations depend on the equipped weapon — so the anchor is
 * the script address the trace itself ran, `$C71468`. Every number below was
 * printed by the game: `$46` = x+30, `$3E` = 23, `$40` = 17.
 */
function checkStrikeBoxes(rom) {
    const swing = maps.strikeBoxes(rom, 0xc71468);
    check('the Boy swings one box', swing.boxes.length, 1);
    check('...23x17, 30px east', JSON.stringify(swing.boxes[0]),
        JSON.stringify({ dx: 30, dy: 0, width: 23, height: 17 }));

    // The flower's own lunge: a short box as it rears, a long one as it bites.
    const flower = maps.characterStrikeBoxes(rom, 109);
    check('wimpy flower strikes twice', flower.boxes.length, 2);
    check('...reaching two tiles south', flower.boxes[1].dy, 34);
    check('mosquito strike', maps.characterStrikeBoxes(rom, 113).boxes.length, 1);

    const names = require('../../src/script/names.json');
    let armed = 0;
    let stopped = 0;
    for (const enemy of Object.values(names.enemies)) {
        if (enemy.character === null) continue;
        const walk = maps.characterStrikeBoxes(rom, enemy.character);
        if (walk.boxes.length) armed += 1;
        if (!walk.complete) stopped += 1;
    }
    // The rest either have no attack animation or damage by contact, which
    // uses the collision box instead ($8FB52C).
    check('characters with a strike box >= 45', armed >= 45, true);
    check('attack walks that stop early <= 5', stopped <= 5, true);
    console.log(`  strike boxes: ${armed}/141 characters, ${stopped} walks incomplete`);
    checkPalettes(rom);
    checkForeground(rom);
}

/**
 * Sprite palettes: the slot a character asks for is its `+0x09`, and two
 * characters with the same value share one. See docs/script-format/palettes.md.
 */
function checkPalettes(rom) {
    // The Mosquito's palette is the one the trace watched being loaded into
    // slot offset 4 ($90CE92 overwriting $127C, then DMA to CGADD $A1).
    check('mosquito palette address', maps.characterPaletteAddress(rom, 113), 0xb34b);
    // Room 0x76's two greens really are one palette: this is what "which
    // enemies can I add for free" rests on.
    check('hedgadillo and blue goo share a palette',
        maps.characterPaletteAddress(rom, 57) === maps.characterPaletteAddress(rom, 63), true);
    check('a villager and a monster do not',
        maps.characterPaletteAddress(rom, 4) === maps.characterPaletteAddress(rom, 88), false);

    const names = require('../../src/script/names.json');
    const distinct = new Set();
    let none = 0;
    for (const enemy of Object.values(names.enemies)) {
        if (enemy.character === null) continue;
        const addr = maps.characterPaletteAddress(rom, enemy.character);
        if (!addr) { none += 1; continue; }     // invisible helpers carry no palette
        distinct.add(addr);
    }
    check('distinct character palettes', distinct.size, 90);
    check('characters with no palette', none, 7);
    console.log(`  palettes: ${distinct.size} distinct across the named characters, ${none} with none`);
}

/**
 * The canopy pass: the pixels a character standing in the room goes behind.
 *
 * Two things have to hold for it to be laid over the composite — it must
 * agree with the composite wherever it is opaque, and it must not be the
 * whole room, or it would just hide everything.
 */
function checkForeground(rom) {
    const room = decodeRoom(rom, 0x76);
    const full = renderRoomComposite(rom, room);
    const fg = maps.renderRoomForeground(rom, room);
    check('foreground has the room\'s size', `${fg.width}x${fg.height}`, `${full.width}x${full.height}`);
    let opaque = 0;
    let mismatched = 0;
    for (let i = 0; i < fg.data.length; i += 4) {
        if (!fg.data[i + 3]) continue;
        opaque += 1;
        if (fg.data[i] !== full.data[i] || fg.data[i + 1] !== full.data[i + 1]
            || fg.data[i + 2] !== full.data[i + 2]) mismatched += 1;
    }
    const share = opaque / (fg.width * fg.height);
    check('foreground pixels match the composite', mismatched, 0);
    check('foreground is a part of the room, not all of it', share > 0.05 && share < 0.95, true);
    console.log(`  foreground: ${(share * 100).toFixed(1)}% of room 0x76 draws over a character`);
    checkSpriteDepth(rom);
    checkHiddenContour(rom);
}

/**
 * Which side of the foreground a character is drawn on.
 *
 * `$8FC773` reads entity `+0x3C` — the collision word of the metatile it
 * stands on, written there by `$8FAFE5` — and gives OAM priority 3 when bit
 * 12 is set. `walking_against_flower.txt` loads four such words in room
 * 0x38; they are the pin, because they prove `+0x3C` is the word this
 * decoder already produces. See docs/script-format/sprite_priority.md.
 */
function checkSpriteDepth(rom) {
    const room = decodeRoom(rom, 0x38);
    // Absolute pixel position, word: the entity's $001A/$001C and $003C as
    // the trace printed them. A metatile is 16 px.
    const traced = [[0x248, 0x3c8, 0x0010], [0x358, 0x408, 0x0010],
        [0x314, 0x304, 0x0013], [0x229, 0x3e6, 0x0010]];
    let agree = 0;
    for (const [px, py, word] of traced) {
        if (room.collisionWords[py >> 4][px >> 4] === word) agree += 1;
    }
    check('traced tile words match the decoded collision map', agree, traced.length);
    check('a flower in 0x38 is behind the foreground',
        maps.spriteDrawsInFront(room.collisionWords[0x3c8 >> 4][0x248 >> 4]), false);

    // The plane comparison at $8FC7A0 comes first, and a plane-transparent
    // tile does not hand the character a plane ($8FA914) — so in a room with
    // more than one plane the answer is not in the map. Room 0x3b's Rock at
    // (89, 61) stands on 0x0061 and is exactly that case; calling it
    // "behind" buried it under the canopy.
    const multi = decodeRoom(rom, 0x3b);
    const planes = maps.planesUsed(multi.collisionWords);
    check('0x3b uses two planes', planes.length, 2);
    check('a spawn on a plane-transparent tile has no readable depth',
        maps.spawnDepth(multi.collisionWords[61 >> 1][89 >> 1], planes), 'unknown');
    check('a character below the tile plane is in front', maps.spriteDepth(0x0020, 1), 'front');
    check('a character above it is behind', maps.spriteDepth(0x1010, 2), 'behind');
    check('same plane falls through to bit 12', maps.spriteDepth(0x1010, 1), 'front');

    // The distribution is the finding that matters to the Rooms tab: drawing
    // the canopy over every character was wrong for most of them.
    let inFront = 0;
    let total = 0;
    for (let id = 0; id < 0x7f; id++) {
        let m;
        try { m = decodeRoom(rom, id); } catch { continue; }
        for (const row of m.collisionWords) {
            for (const cw of row) { total += 1; if (maps.spriteDrawsInFront(cw)) inFront += 1; }
        }
    }
    const share = inFront / total;
    check('most tiles draw a character in front', share > 0.8 && share < 0.9, true);
    console.log(`  sprite depth: ${(share * 100).toFixed(1)}% of tiles put a character in front`);
}

/**
 * The dotted contour: colour says which plane, a dash says the foreground
 * covers the boundary. Room 0x76 has one plane, so every difference from the
 * upstream drawing has to come from the visibility mask alone.
 */
function checkHiddenContour(rom) {
    const room = decodeRoom(rom, 0x76);
    const fg = maps.renderRoomForeground(rom, room);
    const hidden = maps.hiddenTileMask(room, fg);

    // Per tile, not per pixel: foreground art is full of holes, and a mask
    // that flickers along a wall is what made a covered boundary read as a
    // visible one.
    let ragged = 0;
    for (let ty = 0; ty < fg.height; ty += 16) {
        for (let tx = 0; tx < fg.width; tx += 16) {
            const first = hidden[ty * fg.width + tx];
            for (let y = ty; y < Math.min(ty + 16, fg.height); y++) {
                for (let x = tx; x < Math.min(tx + 16, fg.width); x++) {
                    if (hidden[y * fg.width + x] !== first) ragged += 1;
                }
            }
        }
    }
    check('the visibility mask is whole tiles', ragged, 0);

    // Bit 12 is the half that keeps ordinary floor out of it: rooms scatter
    // ground across both layers with the priority bit set purely so the art
    // layers nicely, and none of that hides anything. Room 0x06 is the
    // extreme case — a third of it renders into the foreground pass and
    // almost none of it covers a character.
    const plain = decodeRoom(rom, 0x06);
    const plainFg = maps.renderRoomForeground(rom, plain);
    const rawShare = maps.opaqueMask(plainFg).reduce((a, b) => a + b, 0) / (plainFg.width * plainFg.height);
    const realShare = maps.hiddenTileMask(plain, plainFg).reduce((a, b) => a + b, 0) / (plainFg.width * plainFg.height);
    check('0x06 renders a lot of priority floor', rawShare > 0.2, true);
    check('but almost none of it hides the ground', realShare < 0.05, true);

    const share = hidden.reduce((a, b) => a + b, 0) / hidden.length;
    check('room 0x76 is partly covered', share > 0.05 && share < 0.9, true);

    const solid = renderRoomComposite(rom, room);
    const dotted = renderRoomComposite(rom, room);
    drawCollisionOverlay(solid, room, { contours: true });
    drawCollisionOverlay(dotted, room, { contours: true, hidden });

    let differ = 0;
    let differUncovered = 0;
    for (let i = 0; i < hidden.length; i++) {
        const o = i * 4;
        if (solid.data[o] === dotted.data[o] && solid.data[o + 1] === dotted.data[o + 1]
            && solid.data[o + 2] === dotted.data[o + 2]) continue;
        differ += 1;
        if (!hidden[i]) differUncovered += 1;
    }
    check('only covered pixels are drawn differently', differUncovered, 0);
    check('some contour is dotted', differ > 0, true);
    console.log(`  hidden contour: ${(share * 100).toFixed(1)}% of 0x76 is covered `
        + `(0x06: ${(rawShare * 100).toFixed(0)}% priority art, ${(realShare * 100).toFixed(0)}% covering), `
        + `${differ} pixels dotted`);

    for (const id of [0x3b, 0x76, 0x25]) checkDashBreaks(rom, id);
}

/**
 * A dash has to break whichever way the wall runs.
 *
 * The pattern used to be a screen-space stripe along `x + y`, which is
 * constant along the 45-degree diagonal every geometry code draws — so a
 * diagonal boundary came out fully solid next to a correctly dotted
 * horizontal one. Measuring the longest unbroken run in each of the four
 * directions a contour can take is what catches that: it was the length of
 * the wall, and it is now the length of a dash.
 */
function checkDashBreaks(rom, roomId) {
    const room = decodeRoom(rom, roomId);
    const hidden = maps.hiddenTileMask(room, maps.renderRoomForeground(rom, room));
    const plain = renderRoomComposite(rom, room);
    const dotted = renderRoomComposite(rom, room);
    drawCollisionOverlay(plain, room, { contours: true });
    drawCollisionOverlay(dotted, room, { contours: true, hidden });

    const w = plain.width;
    const h = plain.height;
    const planeColours = new Set(Object.values(maps.PLANE_COLORS).map((c) => c.join(',')));
    const at = (img, i) => `${img.data[i * 4]},${img.data[i * 4 + 1]},${img.data[i * 4 + 2]}`;
    // A covered contour pixel, and whether the dash left it painted.
    const isContour = new Uint8Array(w * h);
    const isOn = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        if (!hidden[i] || !planeColours.has(at(plain, i))) continue;
        isContour[i] = 1;
        if (planeColours.has(at(dotted, i))) isOn[i] = 1;
    }

    const LONGEST_DASH = 12;
    for (const [name, dx, dy] of [['E', 1, 0], ['S', 0, 1], ['SE', 1, 1], ['NE', 1, -1]]) {
        let longest = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                if (!isOn[i]) continue;
                const px = x - dx;
                const py = y - dy;
                // Only start counting at the beginning of a run.
                if (px >= 0 && py >= 0 && px < w && py < h && isOn[py * w + px]) continue;
                let n = 0;
                let cx = x;
                let cy = y;
                while (cx >= 0 && cy >= 0 && cx < w && cy < h && isOn[cy * w + cx]) { n += 1; cx += dx; cy += dy; }
                if (n > longest) longest = n;
            }
        }
        check(`0x${roomId.toString(16)} covered contour breaks going ${name} (${longest}px)`,
            longest > 0 && longest <= LONGEST_DASH, true);
    }
}

/**
 * The tile palette: the metatile dictionary, drawn as an atlas.
 *
 * The atlas is built as a synthetic room whose tilemaps are the dictionary,
 * so it goes through the same renderer the map does. That claim is the whole
 * test — every sampled cell has to be pixel-identical to the same metatile
 * where it appears in the room, or the palette is showing the user something
 * they cannot actually place.
 */
function checkMetatilePalette(rom) {
    let sampled = 0;
    let mismatched = 0;
    let stamps = 0;
    let spare = 0;
    for (const roomId of [0x76, 0x38, 0x25, 0x06]) {
        const room = decodeRoom(rom, roomId);
        const full = renderRoomComposite(rom, room);
        const atlas = maps.renderMetatileAtlas(rom, room, { columns: 16 });
        const table = maps.metatileTable(room);
        stamps += table.length;
        spare += table.filter((m) => !m.uses).length;

        check(`0x${roomId.toString(16)} atlas covers the dictionary`, atlas.count, room.metatileCount);
        check(`0x${roomId.toString(16)} table covers the dictionary`, table.length, room.metatileCount);

        for (let r = 0; r < room.header.heightTiles; r += 7) {
            for (let c = 0; c < room.header.widthTiles; c += 5) {
                const index = maps.metatileIndex(room, room.layer1MetatileIds[r][c]);
                if (index < 0 || index >= atlas.count) continue;
                const cell = maps.metatileCellRect(atlas, index);
                sampled += 1;
                let differs = false;
                for (let y = 0; y < 16 && !differs; y++) {
                    for (let x = 0; x < 16; x++) {
                        const a = ((r * 16 + y) * full.width + (c * 16 + x)) * 4;
                        const b = ((cell.y + y) * atlas.image.width + (cell.x + x)) * 4;
                        if (full.data[a] !== atlas.image.data[b] || full.data[a + 1] !== atlas.image.data[b + 1]
                            || full.data[a + 2] !== atlas.image.data[b + 2]) { differs = true; break; }
                    }
                }
                if (differs) mismatched += 1;
            }
        }
    }
    check('atlas cells match the room they came from', mismatched, 0);
    check('enough cells sampled to mean something', sampled > 400, true);
    // The usage count is what tells an editor which slots are free.
    check('some slots are defined but never placed', spare > 0, true);
    console.log(`  tile palette: ${sampled} cells sampled across 4 rooms, `
        + `${stamps} stamps, ${spare} never placed`);
}

/**
 * The vanilla index: what the ROM already answers about a graphic.
 *
 * The index is the foundation of "build a room from a picture" — it is what
 * turns "which family does this graphic belong to" from a guess into a
 * lookup. These are floors, not exact equalities, because the interesting
 * property is that the evidence stays strong, not that a count never moves.
 * The one exact check is the gourd, which is traced cell by cell in
 * docs/map-format/building-a-room-from-a-picture.md §3.1.
 */
function checkVanillaIndex(rom) {
    const ix = maps.buildVanillaIndex(rom);
    check('index covers every room', ix.roomCount, 127);
    check('index counts placements', ix.placements > 700000, true);
    check('index knows thousands of graphics', ix.families.size > 5000, true);

    // Family lookup is the strong one: most graphics have exactly one.
    let single = 0;
    let dominant = 0;
    for (const [, list] of ix.families) {
        const total = list.reduce((n, a) => n + a.uses, 0);
        if (list.length === 1) single += 1;
        if (list[0].uses / total >= 0.9) dominant += 1;
    }
    const sharePct = (single / ix.families.size) * 100;
    check('over half of graphics have exactly one family', sharePct > 55, true);
    check('a dominant family for most graphics', dominant / ix.families.size > 0.6, true);

    // Collision is the weak one, and the UI promises evidence because of it.
    let collSingle = 0;
    for (const [, list] of ix.collisions) if (list.length === 1) collSingle += 1;
    const collPct = (collSingle / ix.collisions.size) * 100;
    check('collision is genuinely ambiguous — under 60% single-valued', collPct < 60, true);

    // Graphic 4191 is the gourd's terrain tile; room 0x34 draws it in f58.
    const fam = maps.suggestFamily(ix, 4191);
    check('graphic 4191 resolves to family 58', fam && fam.value, 58);
    check('and vanilla never draws it in another', fam && fam.alternatives.length, 1);
    const coll = maps.suggestCollision(ix, 4191);
    check('its usual collision is $101F', coll && coll.value, 0x101f);
    check('with the evidence attached', coll && coll.confidence > 0.9, true);

    // Choosing seven families is what filters the tile list.
    const picked = maps.graphicsForFamilies(ix, [35, 187, 58, 165, 149, 59, 166]);
    check('room 0x34’s families attest a usable vocabulary', picked.length > 100, true);
    check('and fewer graphics than a room can load', picked.length < maps.MAX_GRAPHICS, true);
    check('a family offers examples', maps.familyExamples(ix, 166).length, 8);

    console.log(`  vanilla index: ${ix.families.size} graphics, ${ix.graphics.size} families, `
        + `${sharePct.toFixed(1)}% single-family, ${collPct.toFixed(1)}% single-collision`);
}

/**
 * The four ceilings, and what an edit costs against them.
 *
 * The gourd is the worked example both ways: free in the room that already
 * has it, and over the family ceiling in a room that does not.
 */
function checkBudget(rom) {
    let worstGraphics = 0;
    let worstWram = 0;
    let worstStamps = 0;
    for (let id = 0; id < maps.MAX_ROOMS; id += 1) {
        let room;
        try { room = decodeRoom(rom, id); } catch { continue; }
        const b = maps.roomBudget(room);
        worstGraphics = Math.max(worstGraphics, b.graphics.used);
        worstWram = Math.max(worstWram, b.wram.used);
        worstStamps = Math.max(worstStamps, b.stamps.used);
        check(`0x${id.toString(16)} fits the graphics ceiling`, b.graphics.used <= maps.MAX_GRAPHICS, true);
        check(`0x${id.toString(16)} fits the WRAM window`, b.wram.used <= maps.MAX_WRAM, true);
    }
    // The high-water marks the doc quotes. Exact, because they are the whole
    // reason the ceilings are believed — 255 of ~264 and 32680 of 32768 are
    // what make the margins real rather than theoretical.
    check('fullest graphics list is 255', worstGraphics, 255);
    check('largest WRAM footprint is 32680', worstWram, 32680);
    check('largest dictionary is 2131 stamps', worstStamps, 2131);

    const gourd = {
        graphics: [3736, 3737, 3740, 3741, 4177, 4191, 4195, 4197, 1674, 4190],
        families: [187, 58, 166],
        stamps: [{ layer1: 0x1d22, layer2: 0x0c2e, collision: 0x901f }],
    };
    // Room 0x34 is where the gourd already lives, so re-placing it is free.
    const home = maps.marginalCost(decodeRoom(rom, 0x34), gourd);
    check('the gourd costs nothing in its own room', [home.graphics, home.families, home.stamps], [0, 0, 0]);
    check('and overflows nothing', home.over.length, 0);

    // Room 0x33 is the hut's exterior: same area, different families.
    const away = maps.marginalCost(decodeRoom(rom, 0x33), gourd);
    check('elsewhere it costs its whole art', away.graphics, 10);
    check('and three families it does not have', away.families, 3);
    check('which is what blows the seven-slot ceiling', away.over, ['families']);
    check('one new stamp is eight bytes', away.wram, 8);

    console.log(`  budgets: worst room ${worstGraphics}/${maps.MAX_GRAPHICS} graphics, `
        + `${worstWram}/${maps.MAX_WRAM} B WRAM, ${worstStamps} stamps`);
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
