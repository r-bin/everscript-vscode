// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

/**
 * The SNES CDL Recorder and what it shares with Everscript:
 *   - gameDetectRom (webview/rom-game.js) on synthetic headers (no ROM bytes)
 *   - recording bundles: export, import, cumulative hit counts not doubled, repeats refused
 *   - the recorder's file list: complete (every staged file loads from a copy of only those files)
 *   - the webview by profile and ROM, in headless Chromium (skipped without playwright)
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');

const ROOT = path.resolve(__dirname, '../..');
const { gameDetectRom } = require('../../src/games/evermore/emulator/webview/rom-game');
const { CdlLibrary } = require('../../dist/platform/cdl/library');
const { buildBundle, importBundle, readBundle } = require('../../dist/platform/cdl/bundle');
const { evsmvHeader } = require('../../dist/platform/tas/movie');

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('  [PASS] ' + name); passed++; }
    catch (e) { console.log('  [FAIL] ' + name + '\n    ' + (e.stack || e.message)); failed++; }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evs-recorder-'));

/** A HiROM-sized buffer with only a header: title + destination code at `at`. */
function fakeRom(title, destination, { size = 0x20000, at = 0xFFC0, copier = false } = {}) {
    const rom = Buffer.alloc(size + (copier ? 512 : 0));
    const base = (copier ? 512 : 0) + at;
    rom.write(title.padEnd(21, ' '), base, 'latin1');
    rom[base + 0x19] = destination;
    return rom;
}

/** A library with one xref and some hits; returns it flushed. */
function recordInto(root, rom, hits) {
    const sha256 = crypto.createHash('sha256').update(rom).digest('hex');
    const lib = new CdlLibrary(root, rom, { title: 'SECRET OF EVERMORE', mapType: 'HiROM', sha256 });
    lib.applyDelta({ xrefs: Uint32Array.from([0x808010, 0x4E57, 2]), romHits: [0x10, hits], wramHits: [0x4E57, hits, 1], romCycles: [0x10, hits * 6] });
    lib.flush();
    return lib;
}

(async () => {
    console.log('\nrecorder:');

    await test('gameDetectRom: vanilla US title and region only, any layout, with or without copier header', () => {
        assert.strictEqual(gameDetectRom(fakeRom('SECRET OF EVERMORE', 1)), true);
        assert.strictEqual(gameDetectRom(fakeRom('SECRET OF EVERMORE', 1, { copier: true })), true, 'copier header');
        assert.strictEqual(gameDetectRom(fakeRom('SECRET OF EVERMORE', 1, { size: 0x410000, at: 0x40FFC0 })), true, 'ExHiROM header');
        assert.strictEqual(gameDetectRom(fakeRom('SECRET OF EVERMORE', 2)), false, 'another region');
        assert.strictEqual(gameDetectRom(fakeRom('Secret of MANA', 1)), false, 'another game');
        assert.strictEqual(gameDetectRom(new Uint8Array(0)), false);
    });

    await test('bundle: export, import, newer bundle replaces the install\'s counts, repeats refused, replays deduped', () => {
        const rom = fakeRom('SECRET OF EVERMORE', 1);
        const sha256 = crypto.createHash('sha256').update(rom).digest('hex');
        const src = path.join(tmp, 'src');
        const lib = recordInto(src, rom, 5);
        const movie = { name: 'evermore_2026-10-16_10-00-00.evsmv', data: Buffer.from(evsmvHeader({ rom: 'x.smc', romSha256: sha256, started: 'now' }) + 'F|................\n') };
        const one = buildBundle({ libDir: lib.dir, replays: [movie], installId: 'install-a', tool: { name: 't', version: '1' } });
        const { manifest, cdl, replays } = readBundle(one.zip);
        assert.strictEqual(manifest.rom.sha1, lib.hash);
        assert.strictEqual(manifest.rom.sha256, sha256, 'the library knows its ROM\'s sha256');
        assert.ok(cdl.has('xrefs.bin') && cdl.has('manifest.json') && replays.length === 1);
        assert.ok(![...cdl.keys()].some(n => /\.(smc|sfc)$/.test(n)), 'no ROM in a bundle');

        const dst = path.join(tmp, 'dst');
        const replayDir = path.join(tmp, 'replays');
        const r1 = importBundle(one.zip, dst, replayDir);
        assert.strictEqual(r1.duplicate, false);
        assert.strictEqual(r1.replays, 1);
        let merged = CdlLibrary.open(dst, lib.hash, rom.length);
        assert.strictEqual(merged.xrefs.get(0x808010 * 0x4000000 + 0x4E57), 2);
        assert.strictEqual(merged.romHits[0x10], 5);

        assert.strictEqual(importBundle(one.zip, dst, replayDir).duplicate, true, 'the same bundle twice');

        // The same install plays on: its library now counts 5 + 3.
        lib.applyDelta({ romHits: [0x10, 3], wramHits: [0x4E57, 3, 0], romCycles: [0x10, 18] });
        lib.flush();
        const two = buildBundle({ libDir: lib.dir, replays: [movie], installId: 'install-a' });
        const r2 = importBundle(two.zip, dst, replayDir);
        assert.strictEqual(r2.replays, 0, 'a replay already there is not copied again');
        merged = CdlLibrary.open(dst, lib.hash, rom.length);
        assert.strictEqual(merged.romHits[0x10], 8, 'latest totals of the install, not 5 + 8');
        assert.strictEqual(merged.wramReads[0x4E57], 8);
        assert.strictEqual(merged.romCycles[0x10], 48);

        // Another install adds its own counts.
        const other = recordInto(path.join(tmp, 'other'), rom, 4);
        importBundle(buildBundle({ libDir: other.dir, replays: [], installId: 'install-b' }).zip, dst, replayDir);
        assert.strictEqual(CdlLibrary.open(dst, lib.hash, rom.length).romHits[0x10], 12);
    });

    await test('recorder files: complete, nothing outside src/, tools/ and dist/, and every staged file loads', () => {
        const { recorderFiles, ASSETS } = require('../../tools/recorder/package-files');
        const { files } = recorderFiles();
        for (const a of ASSETS) assert.ok(files.includes(a), 'asset listed: ' + a);
        assert.ok(files.every(f => /^(src|tools|dist)\//.test(f)), 'only src/, tools/ and the dist/ build');
        assert.ok(!files.some(f => /^src\/(memory|rooms\/webview|debugger|mana|music)\//.test(f)), 'no editor, radar or debugger domains');
        assert.ok(!files.includes('src/platform/cdl/asar-export.js'), 'no Asar export in the recorder');
        const missing = files.filter(f => !fs.existsSync(path.join(ROOT, f)) && !/\/core\//.test(f));
        assert.deepStrictEqual(missing, []);

        const stage = path.join(tmp, 'stage');
        for (const f of files) {
            if (!fs.existsSync(path.join(ROOT, f))) continue;
            fs.mkdirSync(path.dirname(path.join(stage, f)), { recursive: true });
            fs.copyFileSync(path.join(ROOT, f), path.join(stage, f));
        }
        const registered = [];
        const vscodeMock = {
            workspace: { getConfiguration: () => ({ get: (k, d) => d }), workspaceFolders: null },
            window: { createOutputChannel: () => ({ appendLine() {}, show() {} }), showErrorMessage() {}, showInformationMessage() {} },
            commands: { registerCommand: (id) => { registered.push(id); return { dispose() {} }; }, executeCommand() {} },
            Uri: { file: p => ({ fsPath: p }) },
            ViewColumn: { Beside: 2, One: 1 },
        };
        const origLoad = Module._load;
        Module._load = function (req, ...rest) { return req === 'vscode' ? vscodeMock : origLoad.call(this, req, ...rest); };
        try {
            for (const f of files) {
                if (!/^src\/.*\.js$/.test(f) || /\/(core|webview)\//.test(f)) continue;
                require(path.join(stage, f));
            }
            require(path.join(stage, 'dist/recorder/extension.js')).activate({ subscriptions: [], globalState: { get: (k, d) => d, update() {} } });
        } finally {
            Module._load = origLoad;
        }
        const manifest = require('../../recorder/package.json');
        const contributed = manifest.contributes.commands.map(c => c.command).sort();
        assert.deepStrictEqual(registered.slice().sort(), contributed);
        for (const c of contributed) assert.ok(manifest.activationEvents.includes('onCommand:' + c), c);
    });

    await test('buildHtml: the recorder profile is data, marks what it hides, offers the bundle export', () => {
        const { buildHtml } = require('../../dist/core/emulator/panel-webview');
        const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core', null, { profile: 'recorder' });
        assert.ok(html.includes('<body class="profile-recorder">'));
        assert.ok(html.includes('<script type="application/json" id="emu-config">{"profile":"recorder"}</script>'));
        assert.ok(html.includes('id="cdl-export-bundle" class="ss-btn" data-needs="recorder"'));
        assert.ok(html.includes('id="ss-tab-trace" class="ss-tab" data-needs="full game"'));
        assert.ok(html.includes('id="menu-tab-btn-9" class="menu-tab-btn" data-needs="full game"'), 'TRACE menu tab: Everscript + Evermore');
        assert.ok(!html.includes('ss-pause-btn') && !html.includes('ss-resume-btn'), 'no pause / resume buttons');
        assert.ok(buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core').includes('<body class="profile-full">'), 'full by default');
    });

    await test('webview: profile and ROM hide tabs, settings apply and save (headless Chromium)', async () => {
        let chromium;
        try { ({ chromium } = require('playwright')); } catch (_) { console.log('    (playwright not installed: skipped)'); return; }
        let browser;
        try { browser = await chromium.launch(); } catch (e) { console.log('    (no browser: skipped)'); return; }
        try {
            const { buildHtml } = require('../../dist/core/emulator/panel-webview');
            const dataUri = (file, type) => `data:${type};base64,` + fs.readFileSync(path.join(ROOT, 'src/core/emulator/webview', file)).toString('base64');
            const page = async profile => {
                const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core', null, {
                    profile,
                    // As the extensions pass it: Everscript hands in Evermore's part of the page, the recorder none.
                    gameView: profile === 'full' ? require('../../dist/games/evermore/emulator/host').webview() : null,
                    styles: [dataUri('emulator-profile.css', 'text/css'), dataUri('emulator-panels.css', 'text/css')],
                    // As the extensions pass them: Everscript's page gets Evermore's files first (webviewFiles(): the ROM
                    // detector and the EvsRom bundle), the recorder's none.
                    scripts: (profile === 'full' ? require('../../dist/games/evermore/emulator/host').webviewFiles().map(f => 'data:text/javascript;base64,' + fs.readFileSync(f).toString('base64')) : []).concat([dataUri('emulator-profile.js', 'text/javascript'), dataUri('emulator-panels.js', 'text/javascript'), dataUri('replays-list.js', 'text/javascript')]),
                }).replace('<head>', '<head><script>window.__sent=[];window.acquireVsCodeApi=()=>({postMessage:m=>window.__sent.push(m)});</script>');
                const p = await browser.newPage();
                const errors = [];
                p.on('pageerror', e => errors.push(e.message));
                await p.setContent(html, { waitUntil: 'load' });
                return { p, errors };
            };
            const shown = (p, id) => p.evaluate(i => getComputedStyle(document.getElementById(i)).display !== 'none', id);

            const rec = await page('recorder');
            assert.deepStrictEqual(rec.errors, []);
            assert.strictEqual(await rec.p.evaluate(() => document.getElementById('ss-view-cdl').parentElement.id), 'emu-side-left', 'CDL starts in the left side bar');
            assert.strictEqual(await rec.p.evaluate(() => document.getElementById('ss-view-tas').parentElement.id), 'emu-slot-tas', 'REPLAYS lives in the pause menu');
            assert.strictEqual(await shown(rec.p, 'script-stack'), false, 'nothing placed at the bottom: no bottom bar');
            assert.strictEqual(await shown(rec.p, 'menu-tab-btn-9'), false, 'no TRACE tab in the recorder');
            assert.strictEqual(await shown(rec.p, 'menu-tab-btn-8'), true);
            assert.strictEqual(await shown(rec.p, 'menu-tab-btn-7'), true);
            // CDL's buttons are in its menu tab (the side bar is compact): ask the profile gate.
            const gated = (p, id) => p.evaluate(i => emuShown(document.getElementById(i)), id);
            assert.strictEqual(await gated(rec.p, 'cdl-export-asm'), false);
            assert.strictEqual(await gated(rec.p, 'cdl-export-bundle'), true);

            const full = await page('full');
            assert.deepStrictEqual(full.errors, []);
            assert.strictEqual(await full.p.evaluate(() => [extendMapEnabled, triggersOverlayEnabled, sndShow, thinHpBarEnabled].some(Boolean)), false, 'every overlay starts off');
            assert.strictEqual(await gated(full.p, 'cdl-export-bundle'), false);
            const mana = Array.from(Buffer.from('Secret of MANA'.padEnd(21, ' '), 'latin1'));
            await full.p.evaluate(title => {
                const rom = new Uint8Array(0x10000); rom.set(title, 0xFFC0); rom[0xFFD9] = 1;
                emuGateRom(rom);
            }, mana);
            assert.strictEqual(await full.p.evaluate(() => emuGameRom), false);
            assert.strictEqual(await shown(full.p, 'menu-tab-btn-9'), false, 'TRACE needs Evermore');
            assert.strictEqual(await shown(full.p, 'menu-tab-btn-1'), false, 'OVERLAYS needs Evermore');
            assert.strictEqual(await full.p.evaluate(() => { menuActiveTab = 0; switchMenuTab(1); return menuActiveTab; }), 7, 'R skips to REPLAYS');
            assert.strictEqual(await full.p.evaluate(() => { menuActiveTab = 8; switchMenuTab(1); return menuActiveTab; }), 5, 'R skips the Evermore panels to EMULATION');
            const evermore = Array.from(Buffer.from('SECRET OF EVERMORE'.padEnd(21, ' '), 'latin1'));
            await full.p.evaluate(title => { const rom = new Uint8Array(0x10000); rom.set(title, 0xFFC0); rom[0xFFD9] = 1; emuGateRom(rom); }, evermore);
            assert.strictEqual(await shown(full.p, 'menu-tab-btn-9'), true);
            // What the game builds from the ROM on the host reaches its page hook (Evermore: the ALCHEMY icons).
            assert.strictEqual(await rec.p.evaluate(() => typeof gameRomData), 'undefined', 'no game, no hook');
            await full.p.evaluate(() => window.postMessage({ command: 'gameRomData', data: { alchemyIcons: { Flash: 'data:,' } } }, '*'));
            await new Promise(r => setTimeout(r, 50));
            assert.deepStrictEqual(await full.p.evaluate(() => loadedAlchemyIcons), { Flash: 'data:,' });

            // Placement: one panel per side, empty bottom bar = no bottom bar, the menu borrows the panel.
            await full.p.evaluate(() => { romLoaded = true; emuSetPanelPlace('trace', 'left'); });
            assert.deepStrictEqual(await full.p.evaluate(() => [emuPanelPlace.cdl, document.getElementById('ss-view-trace').parentElement.id]), ['hidden', 'emu-side-left'], 'a second panel on the left replaces the first');
            assert.strictEqual(await shown(full.p, 'emu-side-left'), true);
            assert.strictEqual(await shown(full.p, 'script-stack'), false);
            await full.p.evaluate(() => { emuSetPanelPlace('entities', 'bottom'); emuSetPanelPlace('cdl', 'bottom'); });
            assert.strictEqual(await shown(full.p, 'script-stack'), true);
            assert.deepStrictEqual(await full.p.evaluate(() => Array.from(document.querySelectorAll('#ss-tabs .ss-tab')).filter(b => getComputedStyle(b).display !== 'none').map(b => b.id)), ['ss-tab-entities', 'ss-tab-cdl'], 'the bottom bar lists what is placed there');
            assert.strictEqual(await full.p.evaluate(() => emuBottomTab), 'cdl');
            await full.p.evaluate(() => { menuActiveTab = 9; openEmulatorMenu(); });
            assert.deepStrictEqual(await full.p.evaluate(() => [document.getElementById('ss-view-trace').parentElement.id, getComputedStyle(document.getElementById('emu-side-left')).display]), ['emu-slot-trace', 'none'], 'the menu shows TRACE and hides the side bars');
            assert.strictEqual(await full.p.evaluate(() => { changeMenuValue(1); return emuPanelPlace.trace; }), 'right', 'Right steps the placement');
            await full.p.evaluate(() => closeEmulatorMenu());
            assert.strictEqual(await full.p.evaluate(() => document.getElementById('ss-view-trace').parentElement.id), 'emu-side-right');
            await full.p.evaluate(() => { emuSetPanelPlace('entities', 'hidden'); emuSetPanelPlace('cdl', 'hidden'); });
            assert.strictEqual(await shown(full.p, 'script-stack'), false, 'empty bottom bar = no bottom bar');

            // REPLAYS: the usual card size; Down jumps row to row; Left / Right choose the action; B asks, B again does, A cancels.
            await full.p.evaluate(() => {
                tasItems = [
                    { id: 'file:a.evsmv', name: 'a', frames: 600, romMatch: true, meta: { started: '2026-10-16T15:39:37Z' } },
                    { id: 'file:b.evsmv', name: 'b', frames: 900, romMatch: true, meta: { started: '2026-10-15T15:39:37Z' } },
                ];
                menuActiveTab = 7; tabSelectedRows[7] = 0; openEmulatorMenu(); tasRenderList();
            });
            const card = await full.p.evaluate(() => document.getElementById('menu-card').getBoundingClientRect().width);
            assert.ok(card <= 520, 'REPLAYS keeps the card width: ' + card);
            const sent = cmd => full.p.evaluate(c => window.__sent.filter(m => m.command === c), cmd);
            const sel = () => full.p.evaluate(() => [menuSelectedRow, Array.from(document.querySelectorAll('#tas-list .menu-row')).findIndex(r => r.classList.contains('selected'))]);
            await full.p.keyboard.press('ArrowDown');
            assert.deepStrictEqual(await sel(), [1, 1], 'Down selects the first recording');
            await full.p.keyboard.press('c');
            assert.strictEqual((await sent('tasLoad')).length, 0, 'the first B only asks');
            assert.ok(await full.p.evaluate(() => /play\? B/.test(document.querySelector('#tas-list .menu-row.selected').textContent)));
            await full.p.keyboard.press('v');
            assert.strictEqual(await full.p.evaluate(() => isMenuOpen && !document.querySelector('.rp-act.asking')), true, 'A cancels the question, the menu stays');
            await full.p.keyboard.press('ArrowRight');
            await full.p.keyboard.press('c');
            await full.p.keyboard.press('c');
            assert.deepStrictEqual((await sent('tasDelete')).map(m => [m.id, m.confirmed]), [['file:a.evsmv', true]], 'Right, B, B deletes');
            await full.p.keyboard.press('ArrowLeft');
            await full.p.keyboard.press('ArrowLeft');
            await full.p.keyboard.press('c');
            assert.deepStrictEqual((await sent('tasPin')).map(m => [m.id, m.pinned]), [['file:a.evsmv', true]], 'Left, Left, B: favourite at once');
            await full.p.keyboard.press('ArrowDown');
            await full.p.keyboard.press('c');
            await full.p.keyboard.press('c');
            assert.deepStrictEqual((await sent('tasLoad')).map(m => m.id), ['file:b.evsmv'], 'B, B plays the next one');
            assert.strictEqual(await full.p.evaluate(() => isMenuOpen), false, 'playing closes the menu');
            // CDL: the usual card; Recording and Export are rows, then one selectable row per bank that does nothing.
            await full.p.evaluate(() => { cdlBuildStrips(0x300000); menuActiveTab = 8; tabSelectedRows[8] = 0; openEmulatorMenu(); window.__sent.length = 0; });
            const cdlCard = await full.p.evaluate(() => document.getElementById('menu-card').getBoundingClientRect().width);
            assert.ok(cdlCard <= 520, 'CDL keeps the card width: ' + cdlCard);
            assert.deepStrictEqual(await full.p.evaluate(() => ['cdl-legend', 'cdl-side', 'cdl-toggle'].map(id => getComputedStyle(document.getElementById(id)).display)), ['none', 'none', 'none'], 'no legend, lookup or buttons in the menu');
            await full.p.keyboard.press('ArrowDown');
            await full.p.keyboard.press('ArrowDown');
            assert.strictEqual(await full.p.evaluate(() => document.getElementById('menu-val-cdl-export').textContent), 'Asar project');
            await full.p.keyboard.press('ArrowRight');
            await full.p.keyboard.press('c');
            assert.deepStrictEqual((await sent('cdlExport')).map(m => m.kind), ['wram'], 'Export: Right picks the WRAM map, B exports it');
            for (let i = 0; i < 4; i++) await full.p.keyboard.press('ArrowDown');
            assert.deepStrictEqual(await full.p.evaluate(() => [menuSelectedRow, document.querySelector('#emu-slot-cdl .cdl-bank.selected canvas').getAttribute('data-strip')]), [6, '1'], 'Down walks the banks (WRAM 7E, 7F, then ROM)');
            const before = await full.p.evaluate(() => window.__sent.length);
            await full.p.keyboard.press('c');
            await full.p.keyboard.press('ArrowRight');
            assert.strictEqual(await full.p.evaluate(() => window.__sent.length), before, 'a bank row does nothing');
            await full.p.evaluate(() => closeEmulatorMenu());
            // In a side bar: no title, status or WRAM; the ROM strips fill the height.
            await full.p.evaluate(() => emuSetPanelPlace('cdl', 'left'));
            const fit = await full.p.evaluate(() => {
                const side = document.getElementById('emu-side-left').getBoundingClientRect();
                const banks = Array.from(document.querySelectorAll('#emu-side-left .cdl-bank')).filter(r => getComputedStyle(r).display !== 'none');
                return { title: getComputedStyle(document.getElementById('emu-side-left'), '::before').display, n: banks.length, bottom: banks[banks.length - 1].getBoundingClientRect().bottom, top: banks[0].getBoundingClientRect().top, side: [side.top, side.bottom] };
            });
            assert.strictEqual(fit.title, 'none');
            assert.strictEqual(fit.n, 48, 'only the ROM banks');
            assert.ok(fit.bottom <= fit.side[1] + 1 && fit.top - fit.side[0] < 8, 'the strips fit the side bar: ' + JSON.stringify(fit));
            await full.p.evaluate(() => emuSetPanelPlace('cdl', 'hidden'));

            // TRACE: no button bar; the bottom bar shows everything, the menu time + source + script,
            // a side bar time + script. Clear is a menu row; Down past it scrolls the trace.
            const { ScriptTraceFormatter } = require('../../dist/games/evermore/emulator/trace-formatter');
            const fmt = new ScriptTraceFormatter();
            const traceHtml = fmt.formatHtml({ slot: 0, entity: 0x23b9, event: 'step', loc: 0x9DD008, locHex: '0x9DD008', bytesHex: '9D D0 08', summary: 'Make boy walk', timeStr: '20:18:59.123' }, { shortTag: '0x12.step[0]', name: 'step' });
            assert.strictEqual(await full.p.evaluate(() => document.getElementById('ss-trace-header')), null, 'no button bar');
            await full.p.evaluate(html => { appendTraceEntries(Array.from({ length: 120 }, () => ({ event: 'step', html }))); emuSetPanelPlace('trace', 'bottom'); }, traceHtml);
            const cols = () => full.p.evaluate(() => ['time', 'tag', 'lookup', 'addr', 'text', 'bytes'].filter(c => {
                const el = document.querySelector('#ss-trace-log .ss-trace-row .ss-trace-' + c);
                return el && getComputedStyle(el).display !== 'none';
            }));
            assert.deepStrictEqual(await cols(), ['time', 'tag', 'lookup', 'addr', 'text', 'bytes'], 'bottom bar: everything');
            await full.p.evaluate(() => emuSetPanelPlace('trace', 'left'));
            assert.deepStrictEqual(await cols(), ['time', 'lookup', 'text'], 'side bar: time and source, then the script');
            assert.ok(await full.p.evaluate(() => { const r = document.querySelector('#ss-trace-log .ss-trace-row'); return r.querySelector('.ss-trace-text').getBoundingClientRect().top >= r.querySelector('.ss-trace-time').getBoundingClientRect().bottom - 1; }), 'the script is on its own line');
            await full.p.evaluate(() => { menuActiveTab = 9; tabSelectedRows[9] = 0; openEmulatorMenu(); });
            assert.deepStrictEqual(await cols(), ['time', 'lookup', 'text'], 'menu: time, source and script');
            const log = () => full.p.evaluate(() => { const l = document.getElementById('ss-trace-log'); return [l.childNodes.length, Math.round(l.scrollTop), menuSelectedRow, emuPanelScrolling(9)]; });
            const atEnd = (await log())[1];
            assert.ok(atEnd > 0, 'the trace follows the newest line');
            await full.p.keyboard.press('ArrowDown');
            assert.deepStrictEqual((await log()).slice(2), [1, false], 'Down selects Clear');
            await full.p.keyboard.press('ArrowDown');
            await full.p.keyboard.press('ArrowUp');
            const up = await log();
            assert.ok(up[1] < atEnd && up[3] === true, 'Down past Clear, then Up scrolls the trace back: ' + up);
            await full.p.keyboard.press('c');
            assert.strictEqual((await log())[0], 120, 'B while scrolling does not clear');
            for (let i = 0; i < 40 && (await log())[3]; i++) await full.p.keyboard.press('ArrowUp');
            assert.deepStrictEqual((await log()).slice(2), [1, false], 'Up at the top goes back to the rows');
            await full.p.keyboard.press('c');
            assert.strictEqual((await log())[0], 0, 'B on Clear empties the trace');
            for (const tab of [9, 10, 11, 12, 13]) {
                const w = await full.p.evaluate(t => { menuActiveTab = t; renderMenuTab(t); return document.getElementById('menu-card').getBoundingClientRect().width; }, tab);
                assert.ok(w <= 520, 'tab ' + tab + ' keeps the card width: ' + w);
            }
            assert.strictEqual(await full.p.evaluate(() => { renderMenuTab(10); return getComputedStyle(document.getElementById('ss-detail')).display; }), 'none', 'STACK: no header in the menu');

            // ENTITIES: "Show" filters (Left / Right, B steps), Down selects a character, B pings it.
            await full.p.evaluate(() => {
                renderMenuTab(11); menuSelectedRow = 0; updateMenuRowSelection(false);
                const tb = document.getElementById('ent-tbody');
                for (const [x, y] of [[10, 20], [30, 40]]) {
                    const tr = document.createElement('tr'); tr.className = 'menu-pick ent-row'; tr.innerHTML = '<td>e</td>';
                    tr.onMenuAction = () => activeTargetPings.push({ x, y, birth: 0, duration: 1e12 });
                    tb.appendChild(tr);
                }
            });
            await full.p.keyboard.press('ArrowDown');
            await full.p.keyboard.press('ArrowRight');
            assert.deepStrictEqual(await full.p.evaluate(() => [panelFilter.entities, document.getElementById('menu-val-filter-entities').textContent]), ['party', 'Party (0)'], 'Right on Show filters the list');
            await full.p.keyboard.press('ArrowLeft');
            await full.p.evaluate(() => { const tb = document.getElementById('ent-tbody'); if (!tb.children.length) throw new Error('rows gone'); });
            await full.p.keyboard.press('ArrowDown');
            await full.p.keyboard.press('ArrowDown');
            await full.p.keyboard.press('c');
            assert.deepStrictEqual(await full.p.evaluate(() => [menuSelectedRow, activeTargetPings.map(p => [p.x, p.y])]), [3, [[30, 40]]], 'Down, Down selects the second character, B pings it');
            await full.p.evaluate(() => { activeTargetPings.length = 0; renderMenuTab(12); menuSelectedRow = 1; changeMenuValue(1); changeMenuValue(1); });
            assert.deepStrictEqual(await full.p.evaluate(() => ['palc', 'aalc', 'proj'].map(k => getComputedStyle(document.getElementById('alc-sec-' + k)).display !== 'none')), [false, true, false], 'ALCHEMY: Show steps to animation alchemy');
            await full.p.evaluate(() => { changeMenuValue(-2); changeMenuValue(-1); });
            await full.p.evaluate(() => { closeEmulatorMenu(); emuSetPanelPlace('trace', 'hidden'); });

            await full.p.evaluate(() => { menuActiveTab = 1; openEmulatorMenu(); menuSelectedRow = 10; activateMenuRow(); });
            assert.deepStrictEqual(await full.p.evaluate(() => [tasOverlayIsOn(), document.getElementById('menu-val-inputs').textContent]), [true, 'ON'], 'the input display is in OVERLAYS');
            await full.p.evaluate(() => closeEmulatorMenu());

            await full.p.evaluate(() => window.postMessage({ command: 'emuSettings', settings: { overlays: { triggers: true, sounds: true }, muted: true, keybinds: { A: 'k' } } }, '*'));
            await full.p.waitForTimeout(50);
            assert.deepStrictEqual(await full.p.evaluate(() => [triggersOverlayEnabled, sndShow, emuMuted, userKeyMap.A, extendMapEnabled]), [true, true, true, 'k', false]);
            assert.strictEqual(await full.p.evaluate(() => window.__sent.filter(m => m.command === 'saveEmuSettings').length), 0, 'applying is not saving');
            await full.p.evaluate(() => setCollisionOverlay(true));
            await full.p.waitForTimeout(400);
            const saved = await full.p.evaluate(() => window.__sent.filter(m => m.command === 'saveEmuSettings').pop());
            assert.ok(saved && saved.settings.overlays.collision === true && saved.settings.overlays.triggers === true && saved.settings.muted === true);
            assert.deepStrictEqual([saved.settings.panels.cdl, saved.settings.panels.trace], ['left', 'hidden'], 'the placement is saved (settings without one reset it to the defaults)');
            await full.p.evaluate(() => window.postMessage({ command: 'emuSettings', settings: { panels: { cdl: 'bottom', stack: 'left', trace: 'left' } } }, '*'));
            await full.p.waitForTimeout(50);
            assert.deepStrictEqual(await full.p.evaluate(() => [emuPanelPlace.cdl, emuPanelPlace.stack, emuPanelPlace.trace]), ['bottom', 'hidden', 'left'], 'saved placement applies, one per side (the first in tab order wins)');
            await full.p.evaluate(() => window.postMessage({ command: 'emuSettings', settings: null }, '*'));
            await full.p.waitForTimeout(50);
            assert.strictEqual(await full.p.evaluate(() => emuPanelPlace.cdl), 'left', 'nothing saved: CDL on the left');
            assert.deepStrictEqual(full.errors, []);
        } finally {
            await browser.close();
        }
    });

    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed) process.exit(1);
})();
