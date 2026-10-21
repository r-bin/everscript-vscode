// The Terranigma Maps page in headless Chromium: the real page (src/games/terra/maps/page.ts) built from the shared
// editor shell, with a stub host answering terra:// reads from the ROM of the ROM library (the pictures written
// to a temp dir as the page asks for a room). Checks the shell's frame, rail and search, a room's picture, the
// filter chips, Pick and the Tile tab's details, the Collision and Trigger tabs with their overlays (an exit
// clicked on the map, its target opened; a chest), the Object tab (a map change previewed), the Info tab, the variant bar, and that a second room does not double
// the clicks (webview-dom-safety §1). Skips without the ROM or playwright.
// Run: node tests/terra/terra-maps-dom.test.mts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pageHtml } = require('../../dist/games/terra/maps/page');
const { resolveTerra } = require('../../dist/games/terra/resources/files');
const { ROOM_FILE_EXTS } = require('../../dist/games/terra/resources/room-files');

let passed = 0, failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
    if (cond) { console.log('  ✓ ' + name); passed++; }
    else { console.error('  ✗ ' + name + (detail !== undefined ? '\n    ' + JSON.stringify(detail) : '')); failed++; }
};

async function main() {
    const romPath: string = require('../../dist/games').romPath('terra') || '';
    if (!romPath || !fs.existsSync(romPath)) { console.log('\nTerranigma Maps page: no Terranigma ROM — skipped'); return; }
    let chromium;
    try { ({ chromium } = require('playwright')); } catch { console.log('\nTerranigma Maps page: playwright not installed — skipped'); return; }
    let browser;
    try { browser = await chromium.launch({ args: ['--allow-file-access-from-files'] }); } catch { console.log('\nTerranigma Maps page: no browser — skipped'); return; }
    console.log('\nTerranigma Maps page (the shared editor shell):');

    const rom = new Uint8Array(fs.readFileSync(romPath));
    const read = (p: string): Buffer | null => { const n = resolveTerra(p.split('/').filter(Boolean), rom); return n && n.kind === 'file' ? n.read() : null; };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'terra-page-'));
    const base = path.join(tmp, 'terra');
    fs.mkdirSync(path.join(base, 'rooms'), { recursive: true });
    const url = (p: string) => 'file://' + p;
    const init = { supported: true, rooms: JSON.parse(read('rooms/index.json')!.toString()), groups: JSON.parse(read('groups/index.json')!.toString()),
        cellTypes: JSON.parse(read('cell-types.json')!.toString()), terraBase: url(base) + '/' };
    const page = path.join(tmp, 'page.html');
    fs.writeFileSync(page, pageHtml(url, { cspSource: "file: 'self'", nonce: 'n1', init }));

    const p = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errors: string[] = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.exposeFunction('hostRead', (f: string) => {
        const hit = /^rooms\/([0-9a-f]{3})\.json$/.exec(f);
        if (hit) {
            const changes = JSON.parse(read(f)!.toString()).changes.map((_: unknown, k: number) => 'c' + k + '.png');
            for (const ext of [...ROOM_FILE_EXTS, ...changes]) if (ext !== 'json') fs.writeFileSync(path.join(base, 'rooms', hit[1] + '.' + ext), read('rooms/' + hit[1] + '.' + ext)!);
        }
        const b = read(f);
        return b ? b.toString('utf8') : null;
    });
    await p.addInitScript(() => {
        let st = {};
        const w = window as unknown as Record<string, unknown>;
        w.acquireVsCodeApi = () => ({
            getState: () => st, setState: (s: object) => { st = s; },
            postMessage: async (m: { command: string; path: string }) => {
                if (m.command === 'read') window.postMessage({ command: 'file', path: m.path, text: await (w.hostRead as (f: string) => Promise<string>)(m.path) }, '*');
            },
        });
    });
    await p.goto(url(page));
    await p.waitForTimeout(300);

    const frame = await p.evaluate(() => ({
        panels: !!document.querySelector('.rm-panels > .rm-rail + .rm-split[data-split="rail"] + .rm-right > #room-detail'),
        rows: document.querySelectorAll('li.rn-map').length,
        areas: [...document.querySelectorAll('.rn-area-label')].map(a => a.textContent),
    }));
    check('the page is the shell’s frame (rail, splitter, detail)', frame.panels, frame);
    check('the rail lists one row per picture, in groups of 64 room ids', frame.rows === init.groups.reduce((n: number, g: { pictures: unknown[] }) => n + g.pictures.length, 0)
        && frame.areas[0] === 'Rooms $000–$03F', { rows: frame.rows, first: frame.areas[0] });

    await p.fill('#rm-rail-q', '00d');
    await p.waitForTimeout(100);
    const found = await p.$$eval('li.rn-map:not(.rm-off)', ls => ls.map(l => (l as HTMLElement).dataset.hexes));
    check('the search finds a room by any id that shows the picture (00d → the row of 00c)', found.length === 1 && /00d/.test(found[0] || ''), found);
    await p.fill('#rm-rail-q', '');

    await p.click('li.rn-map[data-room="15"]');
    await p.waitForTimeout(800);
    const opened = await p.evaluate(async () => {
        const img = document.getElementById('rg-img');
        const href = img ? img.getAttribute('href') || '' : '';
        const size = await new Promise(res => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = href; });
        return { name: document.querySelector('.rd-name')?.textContent, href, size, tabs: [...document.querySelectorAll('.rg-tab')].map(t => t.textContent),
            pill: [...document.querySelectorAll('[data-edit-tool]')].map(b => (b as HTMLElement).dataset.editTool),
            chips: [...document.querySelectorAll('.rg-view-filters .rdf')].map(b => b.textContent), picker: !!document.getElementById('tm-picker') };
    });
    check('a room opens on the canvas card with its picture (512×1024 for $00F)', opened.name === 'Room $00F' && /00f\.png$/.test(opened.href)
        && JSON.stringify(opened.size) === '[512,1024]', opened);
    check('the pill (Select, Pick), the filter bar (BG1, BG2, Cell types, Collision, Objects, Triggers, Grid) and the dock (Tile, Collision, Object, Trigger, Info) with the metatile picker',
        opened.pill.join() === 'select,pick' && opened.chips.join() === 'BG1,BG2,Cell types,Collision,Objects,Triggers,Grid'
        && opened.tabs.join() === 'Tile,Collision,Object,Trigger,Info' && opened.picker, opened);

    await p.click('[data-edit-tool="pick"]');
    const box = await p.$eval('#rg-svg', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await p.mouse.click(box.x + box.w * 0.75, box.y + box.h * 0.12);
    await p.waitForTimeout(200);
    const picked = await p.evaluate(() => ({ text: document.getElementById('rg-panels')?.textContent || '', sel: document.getElementById('tm-sel')?.getAttribute('display') }));
    check('Pick takes a cell’s metatile: PICKED shows it and its four tile words, CELL the map word and cell type, the cell is outlined',
        /metatile \$[0-9A-F]{3} of layer 0/.test(picked.text) && /top left: \$[0-9A-F]{4} · char/.test(picked.text) && /map word \$[0-9A-F]{4}/.test(picked.text) && picked.sel === null, picked.text.slice(0, 300));

    await p.click('[data-toggle="types"]');
    const types = await p.$$eval('#tm-types .tm-type', l => l.length);
    await p.click('[data-toggle="types"]');
    const typesOff = await p.$$eval('#tm-types .tm-type', l => l.length);
    check('the Cell types chip draws layer 0’s typed cells, and clears them again', types > 500 && typesOff === 0, { types, typesOff });

    const bg1 = await p.$('.rg-view-filters [data-toggle="l1"]');
    await bg1!.click();
    const href = await p.$eval('#rg-img', el => el.getAttribute('href'));
    check('turning BG1 off shows layer 0 alone', /00f\.l0\.png$/.test(href || ''), href);
    await p.click('.rg-view-filters [data-toggle="l1"]');

    await p.click('[data-terra-tab="collision"]');
    const coll = await p.evaluate(() => ({
        forced: document.querySelector('.rg-view-filters [data-toggle="collision"]')?.className || '',
        walls: document.querySelectorAll('#tm-coll .tm-wall').length,
        cards: [...document.querySelectorAll('[data-terra-ctype]')].map(b => (b as HTMLElement).dataset.terraCtype),
    }));
    check('the Collision tab turns the Collision chip on (locked), draws the walls and lists the room’s cell types',
        /\bon\b/.test(coll.forced) && /forced/.test(coll.forced) && coll.walls > 0 && coll.cards.includes('0') && coll.cards.includes('14'), coll);
    await p.click('[data-terra-ctype="14"]');
    const ctype = await p.evaluate(() => ({ text: document.getElementById('rg-panels')?.textContent || '', outlined: document.querySelectorAll('#tm-coll .tm-ctype').length }));
    check('a type card shows what the type does and outlines its cells', /TYPE 14/.test(ctype.text) && /wall: every move stops/.test(ctype.text) && ctype.outlined === 1, ctype.text.slice(0, 200));

    await p.click('[data-terra-tab="trigger"]');
    const rowsT = await p.$$eval('[data-exit]', l => l.map(e => e.textContent));
    check('the Trigger tab lists the room’s exits ($00F: to $010 and $122)', rowsT.length === 2 && /→ \$010/.test(rowsT[0] || '') && /→ \$122/.test(rowsT[1] || ''), rowsT);
    await p.click('[data-terra-tab="tile"]');
    await p.click('[data-edit-tool="select"]');
    await p.click('.rg-view-filters [data-toggle="triggers"]');
    const exits = await p.$$eval('#tm-exits .tm-exit', l => l.length);
    await p.mouse.click(box.x + box.w * (24.5 / 32), box.y + box.h * (12.5 / 64));
    await p.waitForTimeout(200);
    const hit = await p.evaluate(() => ({ tab: document.querySelector('.rg-tab.on')?.textContent, sel: document.querySelectorAll('#tm-exits .tm-exit.sel').length,
        text: document.getElementById('rg-panels')?.textContent || '' }));
    check('with Triggers on, clicking an exit on the map selects it in the Trigger tab', exits === 2 && hit.tab === 'Trigger' && hit.sel === 1
        && /room \$010 at 384,336/.test(hit.text), { exits, ...hit, text: hit.text.slice(0, 200) });
    await p.click('.rg-object-expanded [data-open-room="16"]');
    await p.waitForTimeout(800);
    check('an exit’s button opens the room it leads to', await p.$eval('.rd-name', el => el.textContent) === 'Room $010');
    const openById = async (id: number) => {
        await p.evaluate(r => { document.querySelector('li.rn-map[data-room="' + r + '"]')?.closest('li.rn-area')?.classList.remove('collapsed'); }, id);
        await p.click('li.rn-map[data-room="' + id + '"]');
        await p.waitForTimeout(900);
    };
    const svgBox = async () => p.$eval('#rg-svg', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });

    await openById(0x103);
    await p.click('[data-terra-tab="trigger"]');
    await p.click('[data-trig-sub="chests"]');
    const chests = await p.$$eval('[data-chest]', l => l.map(e => e.textContent));
    check('room $103: the Trigger tab’s Chests list has its chest (12,37, item $10)', chests.length === 1 && /12,37 · item \$10/.test(chests[0] || ''), chests);
    await p.click('[data-trig-sub="exits"]');
    await p.click('[data-terra-tab="tile"]');
    const b103 = await svgBox();
    await p.mouse.click(b103.x + b103.w * (12.5 / 64), b103.y + b103.h * (37.5 / 64));
    await p.waitForTimeout(200);
    const chest = await p.evaluate(() => ({ tab: document.querySelector('.rg-tab.on')?.textContent, sub: document.querySelector('.rg-subtab.on')?.textContent || '',
        sel: document.querySelectorAll('#tm-exits .tm-chest.sel').length, text: document.getElementById('rg-panels')?.textContent || '' }));
    check('with Triggers on, clicking the chest selects it: contents, opened flag $580', chest.tab === 'Trigger' && /Chests/.test(chest.sub) && chest.sel === 1
        && /opened: event flag \$580/.test(chest.text), { ...chest, text: chest.text.slice(0, 200) });
    await p.click('.rg-view-filters [data-toggle="triggers"]');

    await openById(0x101);
    await p.click('[data-terra-tab="object"]');
    const changes = await p.$$eval('[data-change]', l => l.map(e => e.textContent));
    const forced = await p.$eval('.rg-view-filters [data-toggle="objects"]', el => el.className);
    check('room $101: the Object tab lists its two map changes and forces the Objects chip', changes.length === 2 && /^bit 0/.test(changes[0] || '') && /forced/.test(forced), { changes, forced });
    await p.click('[data-change="0"]');
    await p.waitForTimeout(300);
    const preview = await p.evaluate(async () => {
        const href = document.getElementById('rg-img')?.getAttribute('href') || '';
        const ok = await new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = href; });
        return { href, ok, sel: document.querySelectorAll('#tm-changes .tm-change.sel').length, src: document.querySelectorAll('#tm-changes .tm-change-src').length };
    });
    check('picking a map change shows the room with it applied and outlines its cells and the copy’s source',
        /101\.c0\.png$/.test(preview.href) && preview.ok && preview.sel === 1 && preview.src === 1, preview);
    await p.click('[data-terra-tab="info"]');
    const back = await p.$eval('#rg-img', el => el.getAttribute('href'));
    check('leaving the Object tab shows the room as it loads again', /101\.png$/.test(back || ''), back);

    await p.click('li.rn-map[data-room="15"]');
    await p.waitForTimeout(800);

    await p.click('[data-terra-tab="info"]');
    const info = await p.$eval('#rg-panels', el => el.textContent || '');
    check('the Info tab: the room, what its load ran, its display registers', /ROOM/.test(info) && /LOAD/.test(info) && /layer maps/.test(info) && /BG mode 1/.test(info), info.slice(0, 200));

    await p.click('li.rn-map[data-room="12"]');
    await p.waitForTimeout(800);
    const variants = await p.$$eval('#rg-variant-bar [data-terra-room]', l => l.map(b => (b as HTMLElement).dataset.terraRoom));
    check('a picture several rooms show has a variant bar with each of them', variants.length >= 2 && variants[0] === '12', variants);
    await p.click('#rg-variant-bar [data-terra-room="' + variants[1] + '"]');
    await p.waitForTimeout(800);
    const name2 = await p.$eval('.rd-name', el => el.textContent);
    check('a variant opens that room', name2 === 'Room $' + Number(variants[1]).toString(16).toUpperCase().padStart(3, '0'), name2);
    const before = await p.$eval('.rg-view-filters [data-toggle="grid"]', el => el.classList.contains('on'));
    await p.click('.rg-view-filters [data-toggle="grid"]');
    const after = await p.$eval('.rg-view-filters [data-toggle="grid"]', el => el.classList.contains('on'));
    check('after opening another room one click flips a chip once', before !== after, { before, after });

    check('no page errors', errors.length === 0, errors);
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
}

main().catch(e => { console.error(e); failed++; }).finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
});
