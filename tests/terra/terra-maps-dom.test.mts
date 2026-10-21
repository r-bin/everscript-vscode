// The Terranigma Maps page in headless Chromium: the real page (src/games/terra/maps/page.ts) built from the shared
// editor shell, with a stub host answering terra:// reads from the ROM of the ROM library (the pictures written
// to a temp dir as the page asks for a room). Checks the shell's frame, rail and search, a room's picture, the
// filter chips, Pick and the Tile tab's details, the Info tab, the variant bar, and that a second room does not
// double the clicks (webview-dom-safety §1). Skips without the ROM or playwright.
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
    const init = { supported: true, rooms: JSON.parse(read('rooms/index.json')!.toString()), groups: JSON.parse(read('groups/index.json')!.toString()), terraBase: url(base) + '/' };
    const page = path.join(tmp, 'page.html');
    fs.writeFileSync(page, pageHtml(url, { cspSource: "file: 'self'", nonce: 'n1', init }));

    const p = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errors: string[] = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.exposeFunction('hostRead', (f: string) => {
        const hit = /^rooms\/([0-9a-f]{3})\.json$/.exec(f);
        if (hit) for (const ext of ROOM_FILE_EXTS) if (ext !== 'json') fs.writeFileSync(path.join(base, 'rooms', hit[1] + '.' + ext), read('rooms/' + hit[1] + '.' + ext)!);
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
    check('the pill (Select, Pick), the filter bar (BG1, BG2, Cell types, Grid) and the dock (Tile, Info) with the metatile picker',
        opened.pill.join() === 'select,pick' && opened.chips.join() === 'BG1,BG2,Cell types,Grid' && opened.tabs.join() === 'Tile,Info' && opened.picker, opened);

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
