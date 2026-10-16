'use strict';

/**
 * The SNES CDL Recorder and what it shares with Everscript:
 *   - detectEvermore (webview/rom-game.js) on synthetic headers (no ROM bytes)
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
const { detectEvermore } = require('../../src/emulator/webview/rom-game');
const { CdlLibrary } = require('../../src/emulator/cdl/library');
const { buildBundle, importBundle, readBundle } = require('../../src/emulator/cdl/bundle');
const { evsmvHeader } = require('../../src/emulator/tas/movie');

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

    await test('detectEvermore: vanilla US title and region only, any layout, with or without copier header', () => {
        assert.strictEqual(detectEvermore(fakeRom('SECRET OF EVERMORE', 1)), true);
        assert.strictEqual(detectEvermore(fakeRom('SECRET OF EVERMORE', 1, { copier: true })), true, 'copier header');
        assert.strictEqual(detectEvermore(fakeRom('SECRET OF EVERMORE', 1, { size: 0x410000, at: 0x40FFC0 })), true, 'ExHiROM header');
        assert.strictEqual(detectEvermore(fakeRom('SECRET OF EVERMORE', 2)), false, 'another region');
        assert.strictEqual(detectEvermore(fakeRom('Secret of MANA', 1)), false, 'another game');
        assert.strictEqual(detectEvermore(new Uint8Array(0)), false);
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

    await test('recorder files: complete, nothing outside src/ and tools/, and every staged file loads', () => {
        const { recorderFiles, ASSETS } = require('../../tools/recorder/package-files');
        const { files } = recorderFiles();
        for (const a of ASSETS) assert.ok(files.includes(a), 'asset listed: ' + a);
        assert.ok(files.every(f => /^(src|tools)\//.test(f)), 'only src/ and tools/');
        assert.ok(!files.some(f => /^src\/(memory|rooms\/webview|debugger|mana|music)\//.test(f)), 'no editor, radar or debugger domains');
        assert.ok(!files.includes('src/emulator/cdl/asar-export.js'), 'no Asar export in the recorder');
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
            require(path.join(stage, 'src/recorder/extension.js')).activate({ subscriptions: [], globalState: { get: (k, d) => d, update() {} } });
        } finally {
            Module._load = origLoad;
        }
        const manifest = require('../../recorder/package.json');
        const contributed = manifest.contributes.commands.map(c => c.command).sort();
        assert.deepStrictEqual(registered.slice().sort(), contributed);
        for (const c of contributed) assert.ok(manifest.activationEvents.includes('onCommand:' + c), c);
    });

    await test('buildHtml: the recorder profile is data, marks what it hides, offers the bundle export', () => {
        const { buildHtml } = require('../../src/emulator/panel-webview');
        const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core', null, { profile: 'recorder' });
        assert.ok(html.includes('<body class="profile-recorder">'));
        assert.ok(html.includes('<script type="application/json" id="emu-config">{"profile":"recorder"}</script>'));
        assert.ok(html.includes('id="cdl-export-bundle" class="ss-btn" data-needs="recorder"'));
        assert.ok(html.includes('id="ss-tab-trace" class="ss-tab" data-needs="full evermore"'));
        assert.ok(html.includes('id="menu-tab-btn-9" class="menu-tab-btn" data-needs="full evermore"'), 'TRACE menu tab: Everscript + Evermore');
        assert.ok(!html.includes('ss-pause-btn') && !html.includes('ss-resume-btn'), 'no pause / resume buttons');
        assert.ok(buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core').includes('<body class="profile-full">'), 'full by default');
    });

    await test('webview: profile and ROM hide tabs, settings apply and save (headless Chromium)', async () => {
        let chromium;
        try { ({ chromium } = require('playwright')); } catch (_) { console.log('    (playwright not installed: skipped)'); return; }
        let browser;
        try { browser = await chromium.launch(); } catch (e) { console.log('    (no browser: skipped)'); return; }
        try {
            const { buildHtml } = require('../../src/emulator/panel-webview');
            const dataUri = (file, type) => `data:${type};base64,` + fs.readFileSync(path.join(ROOT, 'src/emulator/webview', file)).toString('base64');
            const page = async profile => {
                const html = buildHtml({ cspSource: '' }, 'core.js', 'core.wasm', 'core', 'core', null, {
                    profile,
                    styles: [dataUri('emulator-profile.css', 'text/css'), dataUri('emulator-panels.css', 'text/css')],
                    scripts: [dataUri('rom-game.js', 'text/javascript'), dataUri('emulator-profile.js', 'text/javascript'), dataUri('emulator-panels.js', 'text/javascript')],
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
            assert.strictEqual(await full.p.evaluate(() => emuEvermore), false);
            assert.strictEqual(await shown(full.p, 'menu-tab-btn-9'), false, 'TRACE needs Evermore');
            assert.strictEqual(await shown(full.p, 'menu-tab-btn-1'), false, 'OVERLAYS needs Evermore');
            assert.strictEqual(await full.p.evaluate(() => { menuActiveTab = 0; switchMenuTab(1); return menuActiveTab; }), 7, 'R skips to REPLAYS');
            assert.strictEqual(await full.p.evaluate(() => { menuActiveTab = 8; switchMenuTab(1); return menuActiveTab; }), 5, 'R skips the Evermore panels to EMULATION');
            const evermore = Array.from(Buffer.from('SECRET OF EVERMORE'.padEnd(21, ' '), 'latin1'));
            await full.p.evaluate(title => { const rom = new Uint8Array(0x10000); rom.set(title, 0xFFC0); rom[0xFFD9] = 1; emuGateRom(rom); }, evermore);
            assert.strictEqual(await shown(full.p, 'menu-tab-btn-9'), true);

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
            assert.deepStrictEqual(await full.p.evaluate(() => [document.getElementById('ss-view-trace').parentElement.id, getComputedStyle(document.getElementById('emu-side-left')).display]), ['emu-slot-trace', 'none'], 'the menu shows TRACE in full and hides the side bars');
            assert.strictEqual(await full.p.evaluate(() => { changeMenuValue(1); return emuPanelPlace.trace; }), 'right', 'Right steps the placement');
            await full.p.evaluate(() => closeEmulatorMenu());
            assert.strictEqual(await full.p.evaluate(() => document.getElementById('ss-view-trace').parentElement.id), 'emu-side-right');
            await full.p.evaluate(() => { emuSetPanelPlace('entities', 'hidden'); emuSetPanelPlace('cdl', 'hidden'); });
            assert.strictEqual(await shown(full.p, 'script-stack'), false, 'empty bottom bar = no bottom bar');

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
