'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getMenuCss, getMenuHtml, getMenuClientScript } = require('../../src/emulator/menu/menu-view');
const { getMenuSoundScript } = require('../../src/emulator/menu/menu-sound');
const { getSoundSourceClientScript } = require('../../src/emulator/sound-source-view');
const { buildHtml } = require('../../src/emulator/panel-webview');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (e) {
        console.error(`  [FAIL] ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
}

console.log('Emulator Quick Menu Tests:');

// 1. ASCII-only verification
test('menu-view.js, menu-sound.js, and sound-source-view.js are strictly ASCII-only', () => {
    const files = [
        path.join(__dirname, '..', '..', 'src', 'emulator', 'menu', 'menu-view.js'),
        path.join(__dirname, '..', '..', 'src', 'emulator', 'menu', 'menu-sound.js'),
        path.join(__dirname, '..', '..', 'src', 'emulator', 'sound-source-view.js'),
        path.join(__dirname, '..', '..', 'src', 'emulator', 'panel-webview.js'),
    ];
    for (const f of files) {
        const content = fs.readFileSync(f, 'utf8');
        const nonAscii = /[^\x09\x0A\x0D\x20-\x7E]/.test(content);
        assert.strictEqual(nonAscii, false, `${path.basename(f)} contains non-ASCII characters`);
    }
});

// 2. CSS verification (fixed top, lens tab active, tabs, and rows)
test('getMenuCss generates fixed top alignment, lens tab active style, tabs, and rows', () => {
    const css = getMenuCss();
    assert.ok(css.includes('#emulator-menu'), 'missing #emulator-menu style');
    assert.ok(css.includes('align-items: flex-start;'), 'menu should be pinned to the top');
    assert.ok(css.includes('.lens-tab-active'), 'missing .lens-tab-active style');
    assert.ok(css.includes('#menu-card'), 'missing #menu-card style');
    assert.ok(css.includes('.menu-shoulder-btn'), 'missing .menu-shoulder-btn style');
    assert.ok(css.includes('.menu-tab-btn'), 'missing .menu-tab-btn style');
    assert.ok(css.includes('.menu-row.selected'), 'missing .menu-row.selected style');
    assert.ok(css.includes('.lens-tab-active #menu-body'), 'missing .lens-tab-active #menu-body hide');
    assert.ok(css.includes('.menu-preview-box'), 'missing .menu-preview-box style');
    assert.ok(css.includes('.menu-preview-img'), 'missing .menu-preview-img style');
});

// 3. HTML verification (6 tabs, Lens default, Objects list, Loot list, non-looping steppers)
test('getMenuHtml defines 6 tabs with Lens default, Objects list, Loot list, and steppers', () => {
    const html = getMenuHtml();
    // Header & L/R shoulder controls
    assert.ok(html.includes('id="menu-l-btn"'), 'missing menu-l-btn');
    assert.ok(html.includes('id="menu-r-btn"'), 'missing menu-r-btn');
    assert.ok(html.includes('id="menu-close-btn"'), 'missing menu-close-btn');

    // 6 Tab buttons
    assert.ok(html.includes('id="menu-tab-btn-0"'), 'missing LENS tab button');
    assert.ok(html.includes('id="menu-tab-btn-1"'), 'missing OVERLAYS tab button');
    assert.ok(html.includes('id="menu-tab-btn-2"'), 'missing OBJECTS tab button');
    assert.ok(html.includes('id="menu-tab-btn-3"'), 'missing LOOT tab button');
    assert.ok(html.includes('id="menu-tab-btn-4"'), 'missing EMULATION tab button');
    assert.ok(html.includes('id="menu-tab-btn-5"'), 'missing CONTROLS tab button');

    // Tab 0: LENS (Default tab)
    assert.ok(html.includes('id="menu-panel-0"'), 'missing lens panel');
    assert.ok(html.includes('id="menu-lens-room-title"'), 'missing lens room title');
    assert.ok(html.includes('id="menu-lens-coords"'), 'missing lens coords');
    assert.ok(html.includes('id="menu-val-lens-zoom"'), 'missing lens zoom stepper');

    // Tab 1: Overlays
    assert.ok(html.includes('id="menu-panel-1"'), 'missing overlays panel');
    assert.ok(html.includes('id="menu-val-extend"'), 'missing extend map toggle');
    assert.ok(html.includes('id="menu-val-triggers"'), 'missing triggers toggle');
    assert.ok(html.includes('id="menu-val-objects"'), 'missing objects toggle');
    assert.ok(html.includes('id="menu-val-anim"'), 'missing anim tiles toggle');
    assert.ok(html.includes('id="menu-val-collision"'), 'missing collision toggle');
    assert.ok(html.includes('id="menu-val-fog"'), 'missing fog toggle');
    assert.ok(html.includes('id="menu-val-sound-vis"'), 'missing sound entity visualizer toggle');
    assert.ok(html.includes('id="menu-val-zoom"'), 'missing zoom control');

    // Tab 2: Section 3 Objects
    assert.ok(html.includes('id="menu-panel-2"'), 'missing objects panel');
    assert.ok(html.includes('id="menu-objects-list"'), 'missing objects list container');

    // Tab 3: Lootables
    assert.ok(html.includes('id="menu-panel-3"'), 'missing loot panel');
    assert.ok(html.includes('id="menu-loot-list"'), 'missing loot list container');

    // Tab 4: Emulation
    assert.ok(html.includes('id="menu-panel-4"'), 'missing emulation panel');
    assert.ok(html.includes('id="menu-val-speed"'), 'missing speed control');
    assert.ok(html.includes('id="menu-val-sound"'), 'missing sound control');
    assert.ok(html.includes('id="menu-val-focus"'), 'missing breakpoint focus control');

    // Tab 5: Controls & Remapper
    assert.ok(html.includes('id="menu-panel-5"'), 'missing controls panel');
    assert.ok(html.includes('id="menu-bind-list"'), 'missing keybind list');
    assert.ok(html.includes('id="menu-preset-arrows"'), 'missing preset arrows');
    assert.ok(html.includes('id="menu-preset-wasd"'), 'missing preset wasd');
    assert.ok(html.includes('id="menu-preset-reset"'), 'missing preset reset');
});

// 4. Sound synthesis script
test('getMenuSoundScript synthesizes authentic Evermore sound effect IDs', () => {
    const script = getMenuSoundScript();
    assert.ok(script.includes('function playMenuSound(id)'), 'missing playMenuSound definition');
    assert.ok(script.includes('wheel_turn'), 'missing wheel_turn SFX (0x02)');
    assert.ok(script.includes('wheel_open'), 'missing wheel_open SFX (0x04)');
    assert.ok(script.includes('wheel_close'), 'missing wheel_close SFX (0x06)');
    assert.ok(script.includes('click_nav'), 'missing click_nav SFX (0x38)');
    assert.ok(script.includes('click_toggle'), 'missing click_toggle SFX (0x3A)');
    assert.ok(script.includes('click_confirm'), 'missing click_confirm SFX (0x44)');
});

// 5. Client script: Controllable Character gate, unified pause, objects, loot, scrollIntoView
test('getMenuClientScript defines isPlayerControllable, unified pause, objects, loot, and scrollIntoView', () => {
    const script = getMenuClientScript();
    assert.ok(script.includes('function isPlayerControllable(m)'), 'missing isPlayerControllable gate');
    assert.ok(script.includes('function togglePauseMenu(source)'), 'missing unified togglePauseMenu');
    assert.ok(script.includes('function renderObjectRows()'), 'missing renderObjectRows');
    assert.ok(script.includes('function stepObjectState(objIndex, delta)'), 'missing stepObjectState');
    assert.ok(script.includes('function renderLootRows()'), 'missing renderLootRows');
    assert.ok(script.includes('menu-preview-box'), 'missing preview box markup in rows');
    assert.ok(script.includes('function toggleLootState(lootIdx)'), 'missing toggleLootState');
    assert.ok(script.includes('function runLootScript(lootIdx)'), 'missing runLootScript');
    assert.ok(script.includes('scrollIntoView'), 'selection change must call scrollIntoView');
    assert.ok(script.includes('MENU_SPEED_LABELS'), 'missing non-looping speed labels');
    assert.ok(script.includes('1/4x'), 'missing 1/4x speed');
    assert.ok(script.includes('1/2x'), 'missing 1/2x speed');
    assert.ok(script.includes('function pollGamepadMenu()'), 'missing pollGamepadMenu');
    assert.ok(script.includes('function startKeybindListen(btnName)'), 'missing startKeybindListen');
});

// 6. Sound source positioning (script sound mapping to object center, trigger, or enter script)
test('sound-source-view.js maps script sound position to object center, trigger, or enter script', () => {
    const script = getSoundSourceClientScript();
    assert.ok(script.includes('sndMapScriptPosition'), 'missing sndMapScriptPosition');
    assert.ok(script.includes('OBJ #'), 'script sound should be mapped to object center');
    assert.ok(script.includes('B-trig #') || script.includes('Step-on #'), 'script sound should be mapped to trigger center');
    assert.ok(script.includes('Enter Script'), 'script sound should handle enter script');
    assert.ok(script.includes('p.worldX !== undefined'), 'sndDraw should support mapped world coordinates');
});

// 7. Template integration in buildHtml
test('buildHtml embeds menu, hides old overlay bar, and wires wheel event isolation', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(html.includes('id="emulator-menu"'), 'emulator-menu missing from buildHtml');
    assert.ok(html.includes('#screen-overlay-bar {\n      display: none !important;'), 'old overlay bar should be hidden');
    assert.ok(html.includes('openEmulatorMenu'), 'openEmulatorMenu missing from buildHtml');
    assert.ok(html.includes('isPlayerControllable'), 'isPlayerControllable missing from buildHtml');
    assert.ok(html.includes('playMenuSound'), 'playMenuSound missing from buildHtml');
    assert.ok(html.includes('menuCard.contains(e.target)'), 'wheel event should check if target is inside menu');
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
