'use strict';
// Custom maps on disk and their export archive:
// src/rooms/data/custom-store.js, src/rooms/custom-host.js,
// src/rooms/rendering/custom-export.js, src/shared/zip.js.
// The format is docs/map-format/custom-map-files.md.
//
// The archive checks need the ROM and skip, not fail, without it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const store = require('../../src/rooms/data/custom-store');
const widgetStore = require('../../src/rooms/data/widget-store');
const { buildZip, readZip } = require('../../src/shared/zip');
const { handleCustomMapMessage, handlesCustomMapMessage } = require('../../src/rooms/custom-host');
const { mapSlug, sampleEvs } = require('../../src/rooms/rendering/custom-export');

const EVERSCRIPT_REPO = process.env.EVERSCRIPT_REPO ||
    path.join(path.dirname(path.dirname(path.dirname(path.resolve(__dirname)))), 'everscript');
const ROM_PATH = process.env.EVERSCRIPT_ROM || path.join(EVERSCRIPT_REPO, 'Secret of Evermore (U) [!].smc');

let passed = 0;
let failed = 0;
const pending = [];
function test(name, fn) {
    pending.push(async () => {
        try { await fn(); console.log('  ✓ ' + name); passed += 1; }
        catch (e) { console.log('  ✗ ' + name + '\n    ' + (e && e.message)); failed += 1; }
    });
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'evs-maps-'));
const MAP = {
    key: 'custom-abc-1', name: 'New map 1', borrow: 0x34, w: 16, h: 14,
    saved: { cells: { '1,1': 3 }, plane: 1, groups: [] },
    history: { undo: [{ cells: [{ x: 1, y: 1, index: null }], special: [], placed: 0, dropped: [] }], redo: [] },
};


test('a map saves as its own folder, map.json + history.json, and lists back the same', () => {
    const root = tmp();
    store.saveMap(root, MAP, { active: MAP.key });
    const doc = JSON.parse(fs.readFileSync(path.join(root, MAP.key, 'map.json'), 'utf8'));
    assert.strictEqual(doc.format, 'everscript-custom-map');
    assert.strictEqual(doc.version, 1);
    assert.deepStrictEqual([doc.width, doc.height, doc.borrow], [16, 14, 0x34]);
    assert.ok(doc.created && doc.modified);
    const hist = JSON.parse(fs.readFileSync(path.join(root, MAP.key, 'history.json'), 'utf8'));
    assert.strictEqual(hist.format, 'everscript-custom-map-history');
    assert.strictEqual(hist.undo.length, 1);
    const list = store.listMaps(root);
    assert.strictEqual(list.active, MAP.key, 'the open map is remembered');
    assert.deepStrictEqual(list.maps[0].saved, MAP.saved);
    assert.deepStrictEqual(list.maps[0].history, MAP.history, 'the history comes back whole');
});

test('saving again keeps the created date and fields a newer editor wrote', () => {
    const root = tmp();
    store.saveMap(root, MAP);
    const file = path.join(root, MAP.key, 'map.json');
    const first = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify(Object.assign(first, { future: 42 })));
    store.saveMap(root, Object.assign({}, MAP, { name: 'Renamed' }));
    const again = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(again.created, first.created);
    assert.strictEqual(again.name, 'Renamed');
    assert.strictEqual(again.future, 42);
});

test('a map from a newer format version is listed read-only and never overwritten', () => {
    const root = tmp();
    store.saveMap(root, MAP);
    const file = path.join(root, MAP.key, 'map.json');
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify(Object.assign(doc, { version: 2 })));
    assert.strictEqual(store.listMaps(root).maps[0].readOnly, true);
    assert.throws(() => store.saveMap(root, MAP), /newer version/);
});

test('keys are folder names and nothing else', () => {
    assert.throws(() => store.saveMap(tmp(), Object.assign({}, MAP, { key: '../evil' })), /invalid/);
});

test('delete removes the folder and forgets it was open', () => {
    const root = tmp();
    store.saveMap(root, MAP, { active: MAP.key });
    store.deleteMap(root, MAP.key);
    assert.ok(!fs.existsSync(path.join(root, MAP.key)));
    assert.deepStrictEqual(store.listMaps(root), { maps: [], active: null });
});

test('maps saved the old way, in the UI prefs, move into folders once', () => {
    const root = tmp();
    const old = [{ key: 'custom-old-1', name: 'New map 1', borrow: 0x34, w: 16, h: 14, saved: { cells: { '0,0': 1 } } }];
    assert.strictEqual(store.migrateFromPrefs(root, old), 1);
    assert.strictEqual(store.migrateFromPrefs(root, old), 0, 'a second run moves nothing');
    assert.deepStrictEqual(store.listMaps(root).maps[0].saved, old[0].saved);
});


/** A fake of the bits of the VS Code API custom-host.js uses. */
function fakeHost(root, answer) {
    const posted = [];
    let prefs = { customMaps: [{ key: 'custom-p-1', name: 'From prefs', borrow: 0x34, w: 16, h: 14, saved: {} }], other: 1 };
    const deps = {
        root,
        post: (m) => posted.push(m),
        prefs: () => prefs,
        setPrefs: (v) => { prefs = v; },
        loadRom: () => ({ romBuf: null, romPath: null }),
        vscode: {
            window: {
                showWarningMessage: async () => answer,
                showErrorMessage: () => {},
                showInformationMessage: async () => undefined,
                showSaveDialog: async () => undefined,
            },
            Uri: { file: (p) => ({ fsPath: p }) },
            commands: { executeCommand: () => {} },
        },
    };
    return { deps, posted, prefs: () => prefs };
}

test('requestCustomMaps migrates the prefs list, drops the key, and answers with the maps', () => {
    const root = tmp();
    const h = fakeHost(root);
    assert.ok(handlesCustomMapMessage('requestCustomMaps'));
    handleCustomMapMessage({ command: 'requestCustomMaps' }, h.deps);
    assert.strictEqual(h.posted[0].command, 'customMaps');
    assert.strictEqual(h.posted[0].maps[0].name, 'From prefs');
    assert.ok(!('customMaps' in h.prefs()), 'the old key is gone');
    assert.strictEqual(h.prefs().other, 1, 'other prefs stay');
});

test('delete asks first: cancelled keeps the map, confirmed removes it', async () => {
    const root = tmp();
    store.saveMap(root, MAP);
    const no = fakeHost(root, undefined);
    handleCustomMapMessage({ command: 'deleteCustomMap', key: MAP.key, name: MAP.name }, no.deps);
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(no.posted[0].cancelled && fs.existsSync(path.join(root, MAP.key)));
    const yes = fakeHost(root, 'Delete');
    handleCustomMapMessage({ command: 'deleteCustomMap', key: MAP.key, name: MAP.name }, yes.deps);
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(!yes.posted[0].cancelled && !fs.existsSync(path.join(root, MAP.key)));
});


// The user's own widgets: one file, shared by every map (v0.79.0).
const WIDGET = { id: 'w-abc', name: 'Gourd', w: 2, h: 2,
    cells: [{ dx: 0, dy: 0, canopy: { graphic: 1058, family: 58, flags: 0 }, terrain: null, collision: 0x1f }],
    attachments: { bTrigger: [{ dx: 0, dy: 0, w: 3, h: 3, scriptId: 0xd74 }], stepOn: [], objects: [{ dx: 0, dy: 0, w: 2, h: 2, states: 1 }] } };

test('widgets: saved, replaced by id, listed and deleted; a bad id is refused', () => {
    const file = path.join(tmp(), 'widgets.json');
    assert.deepStrictEqual(widgetStore.listWidgets(file), []);
    widgetStore.saveWidget(file, WIDGET);
    widgetStore.saveWidget(file, { ...WIDGET, name: 'Pot' });
    const list = widgetStore.listWidgets(file);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].name, 'Pot');
    assert.deepStrictEqual(list[0].attachments, WIDGET.attachments);
    assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).format, 'everscript-widgets');
    assert.throws(() => widgetStore.saveWidget(file, { ...WIDGET, id: '../x' }), /invalid widget id/);
    assert.deepStrictEqual(widgetStore.deleteWidget(file, 'w-abc'), []);
});

test('widget messages: list, save, and delete only after the confirm', async () => {
    const file = path.join(tmp(), 'widgets.json');
    const posted = [];
    let answer = 'Delete';
    const deps = { widgetsFile: file, post: (m) => posted.push(m),
        vscode: { window: { showWarningMessage: async () => answer, showErrorMessage: () => {} } } };
    assert.ok(handlesCustomMapMessage('saveWidget'));
    handleCustomMapMessage({ command: 'saveWidget', widget: WIDGET }, deps);
    handleCustomMapMessage({ command: 'requestWidgets' }, deps);
    assert.strictEqual(posted.pop().widgets[0].id, 'w-abc');
    answer = undefined;
    handleCustomMapMessage({ command: 'deleteWidget', id: 'w-abc', name: 'Gourd' }, deps);
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(widgetStore.listWidgets(file).length, 1, 'cancelled keeps it');
    answer = 'Delete';
    handleCustomMapMessage({ command: 'deleteWidget', id: 'w-abc', name: 'Gourd' }, deps);
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(widgetStore.listWidgets(file).length, 0);
    assert.strictEqual(posted.pop().deleted, 'w-abc');
});

test('zip: what is written reads back, names and bytes', () => {
    const files = [{ name: 'a/b.bin', data: Buffer.from([0, 1, 2, 250]) }, { name: 'a/c.txt', data: 'héllo\n'.repeat(50) }];
    const back = readZip(buildZip(files));
    assert.deepStrictEqual(back.map((f) => f.name), ['a/b.bin', 'a/c.txt']);
    assert.deepStrictEqual([...back[0].data], [0, 1, 2, 250]);
    assert.strictEqual(back[1].data.toString('utf8'), 'héllo\n'.repeat(50));
});

test('the sample .evs enters the map at the start and lists drawn triggers', () => {
    assert.strictEqual(mapSlug('New map 1'), 'new_map_1');
    assert.strictEqual(mapSlug('  !!  '), 'map');
    const evs = sampleEvs({ name: 'New map 1' }, { x: 17, y: 15 }, [{ kind: 'bTrigger', x: 2, y: 3, w: 2, h: 1, scriptId: null }]);
    assert.match(evs, /@install\(ADDRESS\.INTRO_FIRST_CODE_EXECUTED\)/);
    assert.match(evs, /load_map\(MAP\.BRIAN, 0x11, 0x0f\);/);
    assert.match(evs, /map new_map_1\(MAP\.BRIAN\)/);
    assert.match(evs, /start = entrance\(0x11, 0x0f, NONE\)/);
    assert.match(evs, /GAIN_WEAPON\.SPEAR_4/);
    assert.match(evs, /B-trigger\s+\[2,3 : 3,3\]/);
});

if (!fs.existsSync(ROM_PATH)) {
    console.log(`SKIP archive ROM checks: ${ROM_PATH} not found`);
} else {
    const rom = new Uint8Array(fs.readFileSync(ROM_PATH));
    const rooms = require('../../src/rooms');
    const maps = require('../../src/maps');
    test('the archive holds the blob, the editor file, the .evs, the stamps and a README', () => {
        const w = 16; const h = 14; const cells = [];
        for (let i = 0; i < w * h; i++) cells.push(0xa800, 0x4c62, (i % w) === 0 ? 0x1f : 0x10);
        const draft = { borrowFrom: 0x34, widthTiles: w, heightTiles: h, cells, graphics: [], families: [58], start: { x: 8, y: 7 }, cut: [] };
        const stamps = [{ index: 3, layer1: 0xa800, layer2: 0x4c62, collision: 0x10, cells: 200 }];
        const out = rooms.buildCustomMapArchive(rom, { map: MAP, draft, stamps });
        assert.strictEqual(out.fileName, 'new_map_1.zip');
        const files = readZip(out.zip);
        const names = files.map((f) => f.name).sort();
        assert.deepStrictEqual(names, ['new_map_1/README.md', 'new_map_1/new_map_1.bin', 'new_map_1/new_map_1.evs',
            'new_map_1/new_map_1.map.json', 'new_map_1/stamps.json']);
        const bin = files.find((f) => f.name.endsWith('.bin')).data;
        // The blob is the room: decoded from a ROM that holds it, it is 16x14.
        const scratch = rooms.buildExportRom(rom, draft).rom;
        assert.deepStrictEqual([...bin], [...rooms.buildExportRom(rom, draft).blob]);
        const room = maps.decodeRoom(scratch, 0x15);
        assert.deepStrictEqual([room.header.widthTiles, room.header.heightTiles], [16, 14]);
        const doc = JSON.parse(files.find((f) => f.name.endsWith('.map.json')).data);
        assert.strictEqual(doc.format, 'everscript-custom-map');
        assert.deepStrictEqual(doc.draft, MAP.saved);
        const st = JSON.parse(files.find((f) => f.name.endsWith('stamps.json')).data);
        assert.strictEqual(st.stamps[0].level, 1);
        assert.match(files.find((f) => f.name.endsWith('.evs')).data.toString(), /load_map\(MAP\.BRIAN, 0x11, 0x0f\)/);
    });

    test('a widget gets a thumbnail drawn from its portable cells', () => {
        const { buildWidgetPreviews } = require('../../src/rooms/rendering/deco-preview');
        const p = buildWidgetPreviews(rom, [WIDGET, { id: 'w-empty', w: 1, h: 1, cells: [] }]);
        assert.deepStrictEqual(p.ids, ['w-abc', 'w-empty']);
        assert.ok(/^data:image\/png;base64,/.test(p.imageUri));
    });

    // A vanilla room in the editor: its triggers and objects as the palette
    // hands them over (src/rooms/rendering/metatile-palette.js).
    const { buildRoomMetatilePalette } = require('../../src/rooms');
    test('a vanilla room\'s triggers arrive as inclusive map cells, on the objects they belong to', () => {
        // Room 0x38 (origin 17,11): each gourd's B-trigger covers exactly its
        // 2x2 object. Read raw, the boxes were 17,11 cells off and one too big.
        const p = buildRoomMetatilePalette(rom, 0x38);
        const objs = p.roomObjects;
        const gourd = objs.find((o) => o.x === 39 && o.y === 63);
        assert.ok(gourd && gourd.w === 2 && gourd.h === 2, 'object 39,63 2x2');
        const t = p.attachments.bTrigger.find((b) => b[0] === 39 && b[1] === 63);
        assert.deepStrictEqual(t && t.slice(0, 4), [39, 63, 40, 64]);
        p.attachments.bTrigger.concat(p.attachments.stepOn).forEach((b) => {
            assert.ok(b[2] >= b[0] && b[3] >= b[1], 'never inverted');
        });
    });

    test('the Tile tab\'s deflect filter needs most placements to carry the Deflect gate', () => {
        // Any one placement used to be enough, so blank canopy art and grass
        // gated once somewhere were listed as deflect tiles.
        const { buildFamilySheet } = require('../../src/rooms');
        const sheet = buildFamilySheet(rom, 32);
        assert.strictEqual(sheet.slots.filter((s) => s[16] & 2).length, 0, 'family 32 has no deflect art');
    });

    test('a vanilla room\'s objects come with their states as frames of stamps it has', () => {
        // Room 0x3d, the pipe maze: nine objects, each with a changed state.
        const p = buildRoomMetatilePalette(rom, 0x3d);
        assert.strictEqual(p.roomObjects.length, 9);
        p.roomObjects.forEach((o) => {
            assert.ok(o.frames.length >= 1, 'obj ' + o.index + ' has a changed state');
            o.frames.forEach((f) => Object.keys(f).forEach((k) => {
                const [dx, dy] = k.split(',').map(Number);
                assert.ok(dx >= 0 && dy >= 0 && dx < o.w && dy < o.h, 'inside the area');
                assert.ok(f[k] >= 0 && f[k] < p.count, 'a stamp in the dictionary');
            }));
        });
        // attachments.objects is the same area, not the first delta's footprint.
        assert.deepStrictEqual(p.attachments.objects.map((a) => a.slice(0, 4)),
            p.roomObjects.map((o) => [o.x, o.y, o.w, o.h]));
    });
}

(async () => {
    for (const run of pending) await run();
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
})();
