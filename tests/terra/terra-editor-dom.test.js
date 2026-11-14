// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';
// A converted Terranigma room in the real Rooms-tab editor, end to end: the real radar page in headless
// Chromium, and a host stub that answers the page's requests the way extension.js does
// (src/games/evermore/imports + src/games/evermore/rooms renderers on both ROMs). Checks the rail group, the
// Tile, Trigger and Object tabs, the Boy's start marker and Play in emulator. Needs both ROMs and
// playwright, else skips.
// Run: node tests/terra/terra-editor-dom.test.js [shots dir]  (both ROMs from the ROM library: npm run roms)

const fs = require('fs');
const os = require('os');
const path = require('path');

const SOE = require('../../dist/games').romPath('evermore') || '', TERRA = require('../../dist/games').romPath('terra') || '';
let passed = 0, failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};

async function main() {
    if (!SOE || !TERRA || !fs.existsSync(SOE) || !fs.existsSync(TERRA)) { console.log('\nTerranigma editor DOM: skipped (add both ROMs: npm run roms -- add <path>)'); return; }
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nTerranigma editor DOM: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch { console.log('\nTerranigma editor DOM: no browser — skipped'); return; }

    const rooms = require('../../dist/games/evermore/rooms');
    const { createImportedRooms } = require('../../dist/games/evermore/imports');
    const { renderRadarHtml } = require('../../dist/games/evermore/memory/render-radar');
    const own = require('../../dist/games/evermore/rooms/rendering/rom-export-own');
    const played = [];
    const soe = new Uint8Array(fs.readFileSync(SOE)), terraRom = new Uint8Array(fs.readFileSync(TERRA));
    const service = createImportedRooms({ soeRom: () => soe, manaRom: () => null, terraRom: () => terraRom });
    const shots = process.argv[2] || null;

    // The answers extension.js gives (radar-panel.ts radarRoomRom, editor-host*.ts), condensed.
    const answer = (msg) => {
        const src = (id) => service.resolveRoom(id) || { rom: soe, roomId: id };
        switch (msg.command) {
        case 'requestImportedRoom': {
            const room = service.detail(msg.id, msg.name);
            const s = service.resolveRoom(room.romRoomId);
            room.familyPreviews = rooms.buildFamilyPreviews(s.rom, room.families.map((f) => f.id), 2);
            return { command: 'importedRoom', id: msg.id, room };
        }
        case 'requestRoomTiles': { const s = src(msg.roomId);
            return { command: 'roomTiles', mapName: msg.mapName, roomId: msg.roomId,
                overlay: { ...rooms.buildRoomTileOverlay(s.rom, s.roomId, msg.originX, msg.originY, msg.layer, msg.overlay, msg.objectStates, msg.animate === true, msg.header), roomId: msg.roomId } }; }
        case 'requestRoomMetatiles': { const s = src(msg.roomId);
            return { command: 'roomMetatiles', mapName: msg.mapName, roomId: msg.roomId,
                palette: { ...rooms.buildRoomMetatilePalette(s.rom, s.roomId, msg.layer, msg.bgPalette, msg.header), roomId: msg.roomId } }; }
        case 'requestFamilySheet': { const s = service.resolveFamily(msg.family) || { rom: soe };
            return { command: 'familySheet', family: Number(msg.family), sheet: rooms.buildFamilySheet(s.rom, msg.family, s.roomId) }; }
        case 'requestFamilyCatalogue': return { command: 'familyCatalogue', families: rooms.buildFamilyCatalogue(soe) };
        case 'requestCustomMaps': return { command: 'customMaps', maps: [], active: null };
        case 'mapPlayImported': {   // editor-host-rom.ts: the real builder and its picture check
            const parts = service.playable(msg.roomId);
            const built = own.buildOwnRoomExportRom(soe, parts.room, msg.start || parts.start);
            own.verifyOwnRoomExport(built.rom, parts.shown);
            played.push({ msg, report: built.report });
            return { command: 'mapExportRomDone', played: 'converted.sfc', report: built.report };
        }
        default: return null;
        }
    };

    console.log('\nTerranigma room in the editor:');
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.exposeFunction('hostAnswer', (m) => { try { return JSON.stringify(answer(m)); } catch (e) { return JSON.stringify({ error: String(e.message) }); } });
    await page.addInitScript(() => {
        window.acquireVsCodeApi = () => ({ getState: () => null, setState: () => {},
            postMessage: async (m) => { (window.__sent = window.__sent || []).push(m); const r = JSON.parse(await window.hostAnswer(m)); if (r) window.postMessage(r, '*'); } });
    });
    const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 10 },
        new Map(), [], new Map(), new Map(), [], 'rooms', null,
        [], false, null, null, new Map(), {}, '', null, service.groups());
    const file = path.join(os.tmpdir(), 'terra-editor-dom-' + process.pid + '.html');
    fs.writeFileSync(file, html);
    await page.goto('file://' + file);
    fs.unlinkSync(file);

    const order = await page.evaluate(() => [...document.querySelectorAll('.rm-grp')].map((g) => g.id));
    check('the Terranigma group sits under the vanilla rooms, before the custom rooms',
        order.indexOf('rm-grp-terra') > order.indexOf('rm-grp-vanilla') && order.indexOf('rm-grp-terra') < order.indexOf('rm-grp-live'), order.join(','));
    await page.click('[data-rail-grp="terra"]');
    const rows = await page.locator('#rm-grp-terra li[data-import]').count();
    check('it lists every Terranigma picture (511)', rows === 511, String(rows));

    // Crysta: nine exits, a map change.
    await page.click('li[data-import="terra-a"]');
    await page.waitForTimeout(3000);
    const tab = async (name) => {
        await page.evaluate((n) => { const t = [...document.querySelectorAll('[data-edit-active-tab]')].find((b) => b.textContent.trim().toLowerCase().startsWith(n)); if (t) t.click(); }, name);
        await page.waitForTimeout(800);
        if (shots) await page.screenshot({ path: path.join(shots, 'terra-' + name + '.png') });
        return page.evaluate(() => (document.getElementById('rg-dock') || document.getElementById('room-detail')).innerText);
    };
    const shown = await page.evaluate(() => ({ svg: !!document.getElementById('rg-svg'), err: !!document.querySelector('.rs-error'),
        tiles: (window.__sent || []).filter((m) => m.command === 'requestRoomTiles').map((m) => m.roomId) }));
    check('Crysta opens in the editor as room 0x200A', shown.svg && !shown.err && shown.tiles.includes(0x200a), JSON.stringify(shown));
    const tile = await tab('tile');
    check('the Tile tab lists the room\'s families by label (t<n>)', /\bt\d+\b/.test(tile) && !/no room draws anything/.test(tile), tile.slice(0, 300));
    const triggers = await tab('trigger');
    check('the Trigger tab lists the exits as step-on triggers', /Terranigma exit to \$0/.test(triggers) || /Step-on\s*9\b/.test(triggers), triggers.slice(0, 400));
    const objects = await tab('object');
    check('the Object tab lists the map change', /#0/.test(objects), objects.slice(0, 300));
    check('a converted room shows the Boy\'s start marker', await page.locator('#rg-svg .rg-start').count() === 1);
    await page.evaluate(() => { const b = document.querySelector('[data-edit-act="play-rom"]'); if (b) b.click(); });
    await page.waitForTimeout(3000);
    const play = played[played.length - 1];
    check('Play in emulator builds the converted room as a ROM, entered at the marker', !!play && play.msg.roomId === 0x200a
        && !!play.msg.start && play.report.room === 0x15, JSON.stringify(play && { start: play.msg.start, report: play.report }));

    // A room with a chest: its B-trigger.
    await page.click('li[data-import="terra-108"]');
    await page.waitForTimeout(3000);
    await tab('trigger');
    await page.evaluate(() => { const b = [...document.querySelectorAll('#rg-dock button, #rg-dock [role=tab], #rg-dock span')].find((e) => /^B\s*B-trigger/.test(e.textContent.trim())); if (b) b.click(); });
    await page.waitForTimeout(500);
    if (shots) await page.screenshot({ path: path.join(shots, 'terra-chest.png') });
    const chest = await page.evaluate(() => document.getElementById('rg-dock').innerText);
    check('a chest is a B-trigger', /B-triggers\s*1\b/.test(chest) || /Terranigma chest/.test(chest), chest.slice(0, 400));
    check('no page errors', !errors.length, errors.join('; '));
    await browser.close();
}

main().catch((e) => { console.error(e); failed++; }).finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
});
