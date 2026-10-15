'use strict';
// A converted Secret of Mana room in the real Rooms-tab editor, end to end: the real radar
// page in headless Chromium, and a host stub that answers the page's requests the way
// extension.js does (src/mana-to-evermore + src/rooms renderers on both ROMs). Checks the
// Tile, Trigger and Object tabs. Needs both ROMs and playwright, else skips.
// Run: EVERSCRIPT_ROM=<Evermore> EVERSCRIPT_MANA_ROM=<Mana> node tests/mana/mana-editor-dom.test.js [shots dir]

const fs = require('fs');
const os = require('os');
const path = require('path');

const SOE = process.env.EVERSCRIPT_ROM || '', SOM = process.env.EVERSCRIPT_MANA_ROM || '';
let passed = 0, failed = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail ? '\n    ' + detail : '')); failed++; }
};

async function main() {
    if (!SOE || !SOM || !fs.existsSync(SOE) || !fs.existsSync(SOM)) { console.log('\nMana editor DOM: skipped (set EVERSCRIPT_ROM and EVERSCRIPT_MANA_ROM)'); return; }
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nMana editor DOM: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch(); } catch { console.log('\nMana editor DOM: no browser — skipped'); return; }

    const rooms = require('../../src/rooms');
    const bridge = require('../../src/mana-to-evermore');
    const { renderRadarHtml } = require('../../src/memory/render-radar');
    const soe = fs.readFileSync(SOE), som = new Uint8Array(fs.readFileSync(SOM));
    const service = bridge.createManaRooms({ soeRom: () => soe, manaRom: () => som });
    const shots = process.argv[2] || null;

    // The answers extension.js gives (its radarRoomRom routing, condensed).
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
                overlay: { ...rooms.buildRoomTileOverlay(s.rom, s.roomId, msg.originX, msg.originY, msg.layer, msg.overlay, msg.objectStates, false), roomId: msg.roomId } }; }
        case 'requestRoomMetatiles': { const s = src(msg.roomId);
            return { command: 'roomMetatiles', mapName: msg.mapName, roomId: msg.roomId,
                palette: { ...rooms.buildRoomMetatilePalette(s.rom, s.roomId, msg.layer, msg.bgPalette, msg.header), roomId: msg.roomId } }; }
        case 'requestFamilySheet': { const s = service.resolveFamily(msg.family) || { rom: soe };
            return { command: 'familySheet', family: Number(msg.family), sheet: rooms.buildFamilySheet(s.rom, msg.family, s.roomId) }; }
        case 'requestFamilyCatalogue': return { command: 'familyCatalogue', families: rooms.buildFamilyCatalogue(soe) };
        default: return null;
        }
    };

    console.log('\nSecret of Mana room in the editor:');
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.exposeFunction('hostAnswer', (m) => { try { return JSON.stringify(answer(m)); } catch (e) { return JSON.stringify({ error: String(e.message) }); } });
    await page.addInitScript(() => {
        window.acquireVsCodeApi = () => ({ getState: () => null, setState: () => {},
            postMessage: async (m) => { const r = JSON.parse(await window.hostAnswer(m)); if (r) window.postMessage(r, '*'); } });
    });
    const html = renderRadarHtml({ kind: 'function', name: 'f', startLine: 0, endLine: 10 },
        new Map(), [], new Map(), new Map(), [], 'rooms', null,
        [], false, null, null, new Map(), {}, '', null,
        [{ key: 'mana', label: 'Secret of Mana', title: '', areas: service.railGroups() }]);
    const file = path.join(os.tmpdir(), 'mana-editor-dom-' + process.pid + '.html');
    fs.writeFileSync(file, html);
    await page.goto('file://' + file);
    fs.unlinkSync(file);

    // Potos: the ground that breaks open is an object (piece 13, event flag $10).
    await page.click('[data-rail-grp="mana"]');
    await page.click('li[data-import="som-66"]');
    await page.waitForTimeout(2500);
    const tab = async (name) => {
        await page.evaluate((n) => { const t = [...document.querySelectorAll('[data-edit-active-tab]')].find((b) => b.textContent.trim().toLowerCase().startsWith(n)); if (t) t.click(); }, name);
        await page.waitForTimeout(800);
        if (shots) await page.screenshot({ path: path.join(shots, 'mana-' + name + '.png') });
        return page.evaluate(() => (document.getElementById('rg-dock') || document.getElementById('room-detail')).innerText);
    };
    const tile = await tab('tile');
    check('the Tile tab lists the room\'s families by label, with their tiles', /m\d+/.test(tile) && !/no room draws anything/.test(tile), tile.slice(0, 300));
    const objects = await tab('object');
    check('the Object tab lists the ground that breaks open', /#0/.test(objects), objects.slice(0, 300));
    await page.click('li[data-import="som-10"]');
    await page.waitForTimeout(2500);
    await tab('trigger');
    await page.evaluate(() => { const b = [...document.querySelectorAll('#rg-dock button, #rg-dock [role=tab], #rg-dock span')].find((e) => /^S\s*Step-on/.test(e.textContent.trim())); if (b) b.click(); });
    await page.waitForTimeout(500);
    if (shots) await page.screenshot({ path: path.join(shots, 'mana-trigger-step.png') });
    const triggers = await page.evaluate(() => document.getElementById('rg-dock').innerText);
    check('the Trigger tab lists the step events', /Mana event 83F/.test(triggers) || /83F/i.test(triggers), triggers.slice(0, 400));
    check('no page errors', !errors.length, errors.join('; '));
    await browser.close();
}

main().catch((e) => { console.error(e); failed++; }).finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
});
