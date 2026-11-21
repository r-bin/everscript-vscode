// An Open Evermore tree's maps in the real Rooms-tab editor (src/games/evermore/imports/tree): the base ROM exploded
// into a temporary tree, the real radar page in headless Chromium, and a host stub that answers the page's requests
// the way extension.ts does. Checks the rail group (the tree's map names), that every map draws as the vanilla room,
// a map opening in the editor with its families and objects, and an edit to grid.txt showing when it is opened
// again. Needs the base ROM and playwright, else skips.
// Run: node tests/open-evermore/tree-editor-dom.test.mts [shots dir]   (npm run build:ts first)
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GAME, KINDS } from '../../tools/open-evermore/evermore/kinds.mts';
import { explode } from '../../tools/open-evermore/explode.mts';
import { sha1, writeTree } from '../../tools/open-evermore/tree.mts';

const require = createRequire(import.meta.url);
const games = require('../../dist/games');
const { stripCopierHeader } = require('../../dist/platform/roms/header');

let passed = 0, failed = 0;
const check = (name: string, cond: boolean, detail?: string) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};

async function main() {
    const romPath = games.baseRomPath('evermore');
    if (!romPath || !existsSync(romPath)) { console.log('\nOpen Evermore tree in the editor: skipped (no Evermore base ROM)'); return; }
    let chromium: any;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nOpen Evermore tree in the editor: playwright not installed — skipped'); return; }
    let browser: any;
    try { browser = await chromium.launch(); } catch { console.log('\nOpen Evermore tree in the editor: no browser — skipped'); return; }

    const maps = require('../../dist/games/evermore/maps');
    const rooms = require('../../dist/games/evermore/rooms');
    const { createImportedRooms } = require('../../dist/games/evermore/imports');
    const { renderRadarHtml } = require('../../dist/games/evermore/memory/render-radar');
    const rom: Uint8Array = stripCopierHeader(new Uint8Array(readFileSync(romPath)));
    const root = mkdtempSync(join(tmpdir(), 'oe-tree-')), dir = join(root, 'tree');
    writeTree(dir, explode(rom, { release: 'us', sha1: sha1(rom), explodedWith: 'test' }, GAME, KINDS));
    const service = createImportedRooms({ soeRom: () => rom, manaRom: () => null, terraRom: () => null, treeRoots: () => [root] });
    const shots = process.argv[2] || null;
    try {
        console.log('\nOpen Evermore tree in the editor:');
        const group = service.groups().find((g: any) => g.key === 'tree');
        const list = group ? group.areas[0].rooms : [];
        const enumNames: string[] = JSON.parse(readFileSync(join(dir, 'maps', 'rooms', '_enum.json'), 'utf8')).names;
        check('the rail has an Open Evermore group: the tree, its 127 maps by their names in id order',
            list.length === 127 && list.every((r: any, i: number) => r.name === enumNames[i]), JSON.stringify(list.slice(0, 2)));

        // Every map, built from its files, draws as the ROM's room.
        const differs = list.filter((r: any) => {
            const s = service.resolveRoom(service.detail(r.id, r.name).romRoomId);
            const a = maps.renderRoomComposite(s.rom, maps.decodeRoom(s.rom, s.roomId)), b = maps.renderRoomComposite(rom, maps.decodeRoom(rom, s.roomId));
            return a.data.length !== b.data.length || a.data.some((x: number, i: number) => x !== b.data[i]);
        }).map((r: any) => r.name);
        check('every map, read from its files, draws as the vanilla room', differs.length === 0, differs.join(', '));

        // The answers extension.ts gives (radar-panel.ts radarRoomRom, editor-host*.ts), condensed.
        const answer = (msg: any) => {
            const src = (id: number) => service.resolveRoom(id) || { rom, roomId: id };
            switch (msg.command) {
            case 'requestImportedRoom': {
                const room = service.detail(msg.id, msg.name);
                room.familyPreviews = rooms.buildFamilyPreviews(service.resolveRoom(room.romRoomId).rom, room.families.map((f: any) => f.id), 2);
                return { command: 'importedRoom', id: msg.id, room };
            }
            case 'requestRoomTiles': { const s = src(msg.roomId);
                return { command: 'roomTiles', mapName: msg.mapName, roomId: msg.roomId,
                    overlay: { ...rooms.buildRoomTileOverlay(s.rom, s.roomId, msg.originX, msg.originY, msg.layer, msg.overlay, msg.objectStates, msg.animate === true, msg.header), roomId: msg.roomId } }; }
            case 'requestRoomMetatiles': { const s = src(msg.roomId);
                return { command: 'roomMetatiles', mapName: msg.mapName, roomId: msg.roomId,
                    palette: { ...rooms.buildRoomMetatilePalette(s.rom, s.roomId, msg.layer, msg.bgPalette, msg.header), roomId: msg.roomId } }; }
            case 'requestFamilySheet': return { command: 'familySheet', family: Number(msg.family), sheet: rooms.buildFamilySheet(rom, msg.family) };
            case 'requestFamilyCatalogue': return { command: 'familyCatalogue', families: rooms.buildFamilyCatalogue(rom) };
            case 'requestCustomMaps': return { command: 'customMaps', maps: [], active: null };
            case 'requestImportedStatus': return { command: 'importedStatus', statuses: Object.fromEntries(list.slice(0, 5).map((r: any) => [r.id, service.status(r.id)])) };
            default: return null;
            }
        };
        const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
        const errors: string[] = [];
        page.on('pageerror', (e: Error) => errors.push(e.message));
        await page.exposeFunction('hostAnswer', (m: any) => { try { return JSON.stringify(answer(m)); } catch (e) { return JSON.stringify({ error: String((e as Error).message) }); } });
        await page.addInitScript(() => {
            const w = window as any;
            w.acquireVsCodeApi = () => ({ getState: () => null, setState: () => {},
                postMessage: async (m: any) => { (w.__sent = w.__sent || []).push(m); const r = JSON.parse(await w.hostAnswer(m)); if (r) window.postMessage(r, '*'); } });
        });
        const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 10 },
            new Map(), [], new Map(), new Map(), [], 'rooms', null, [], false, null, null, new Map(), {}, '', null, service.groups());
        const file = join(tmpdir(), 'tree-editor-dom-' + process.pid + '.html');
        writeFileSync(file, html);
        await page.goto('file://' + file);
        unlinkSync(file);

        await page.click('[data-rail-grp="tree"]');
        const rows = await page.locator('#rm-grp-tree li[data-import]').count();
        check('the page lists the tree\'s 127 maps', rows === 127, String(rows));

        // The game's first room: many objects (gourds, sniff spots) and cuttable grass.
        const first = list.find((r: any) => r.name === 'prehistoria_jungle_south_where_the_game_starts');
        const open = async () => {
            await page.click(`li[data-import="${first.id}"]`);
            await page.waitForTimeout(3000);
        };
        await open();
        const roomId = service.detail(first.id).romRoomId;
        const shown = await page.evaluate(() => ({ svg: !!document.getElementById('rg-svg'), err: !!document.querySelector('.rs-error'),
            tiles: ((window as any).__sent || []).filter((m: any) => m.command === 'requestRoomTiles').map((m: any) => m.roomId) }));
        check('a map opens in the editor, drawn from its own image', shown.svg && !shown.err && shown.tiles.includes(roomId), JSON.stringify(shown));
        const tab = async (name: string) => {
            await page.evaluate((n: string) => { const t = [...document.querySelectorAll('[data-edit-active-tab]')].find((b) => (b.textContent || '').trim().toLowerCase().startsWith(n)) as HTMLElement | undefined; if (t) t.click(); }, name);
            await page.waitForTimeout(800);
            if (shots) await page.screenshot({ path: join(shots, 'tree-' + name + '.png') });
            return page.evaluate(() => (document.getElementById('rg-dock') || document.getElementById('room-detail'))!.innerText);
        };
        const tile = await tab('tile');
        check('the Tile tab shows the map\'s families', !/no room draws anything/.test(tile) && /\d/.test(tile), tile.slice(0, 300));
        const objects = await tab('object');
        check('the Object tab lists the map\'s objects (objects.json)', /#0/.test(objects), objects.slice(0, 300));

        // An edit to the files shows the next time the map is opened: one cell of grid.txt becomes another metatile.
        const grid = join(dir, 'maps', 'rooms', first.name, 'grid.txt'), text = readFileSync(grid, 'utf8');
        const cells = text.trim().split('\n').map(r => r.split(' '));
        const other = cells.flat().find(c => c !== cells[0][0])!;   // a metatile the grid already uses, so Markov order holds
        writeFileSync(grid, [[other, ...cells[0].slice(1)].join(' '), ...cells.slice(1).map(r => r.join(' '))].join('\n') + '\n');
        const s = service.resolveRoom(roomId), d = maps.decodeRoom(s.rom, s.roomId), v = maps.decodeRoom(rom, s.roomId);
        check('an edited grid.txt is read again: the cell shows the other metatile',
            d.layer1MetatileIds[0][0] !== v.layer1MetatileIds[0][0] && d.layer1MetatileIds[0][0] === d.baseMetatile + 8 * parseInt(other, 16),
            `${d.layer1MetatileIds[0][0]} vs vanilla ${v.layer1MetatileIds[0][0]}`);
        writeFileSync(grid, 'not a grid\n');
        check('a map whose files do not build says why', (() => { try { service.detail(first.id); return false; } catch (e) { return /grid\.txt/.test((e as Error).message); } })());
        check('no page errors', !errors.length, errors.join('; '));
    } finally {
        await browser.close();
        rmSync(root, { recursive: true, force: true });
    }
}

main().catch((e) => { console.error(e); failed++; }).finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
});
