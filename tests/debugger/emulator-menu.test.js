'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getMenuCss, getMenuHtml, getMenuClientScript } = require('../../src/emulator/menu/menu-view');
const { getMenuSoundScript } = require('../../src/emulator/menu/menu-sound');
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
test('menu-view.js and menu-sound.js are strictly ASCII-only', () => {
    const files = [
        path.join(__dirname, '..', '..', 'src', 'emulator', 'menu', 'menu-view.js'),
        path.join(__dirname, '..', '..', 'src', 'emulator', 'menu', 'menu-sound.js'),
    ];
    for (const f of files) {
        const content = fs.readFileSync(f, 'utf8');
        const nonAscii = /[^\x09\x0A\x0D\x20-\x7E]/.test(content);
        assert.strictEqual(nonAscii, false, `${path.basename(f)} contains non-ASCII characters`);
    }
});

// 2. CSS verification
test('getMenuCss generates required styling for modal, tabs, rows, and shoulder buttons', () => {
    const css = getMenuCss();
    assert.ok(css.includes('#emulator-menu'), 'missing #emulator-menu style');
    assert.ok(css.includes('#menu-card'), 'missing #menu-card style');
    assert.ok(css.includes('.menu-shoulder-btn'), 'missing .menu-shoulder-btn style');
    assert.ok(css.includes('.menu-tab-btn'), 'missing .menu-tab-btn style');
    assert.ok(css.includes('.menu-row.selected'), 'missing .menu-row.selected style');
    assert.ok(css.includes('.menu-bind-badge'), 'missing .menu-bind-badge style');
});

// 3. HTML verification
test('getMenuHtml defines L/R buttons, 3 tabs, overlay toggles, emulation speed, and remapper', () => {
    const html = getMenuHtml();
    // Header & L/R shoulder controls
    assert.ok(html.includes('id="menu-l-btn"'), 'missing menu-l-btn');
    assert.ok(html.includes('id="menu-r-btn"'), 'missing menu-r-btn');
    assert.ok(html.includes('id="menu-close-btn"'), 'missing menu-close-btn');

    // Tab buttons
    assert.ok(html.includes('id="menu-tab-btn-0"'), 'missing OVERLAYS tab button');
    assert.ok(html.includes('id="menu-tab-btn-1"'), 'missing EMULATION tab button');
    assert.ok(html.includes('id="menu-tab-btn-2"'), 'missing CONTROLS tab button');

    // Tab 0: Overlays
    assert.ok(html.includes('id="menu-panel-0"'), 'missing overlays panel');
    assert.ok(html.includes('id="menu-val-extend"'), 'missing extend map toggle');
    assert.ok(html.includes('id="menu-val-triggers"'), 'missing triggers toggle');
    assert.ok(html.includes('id="menu-val-objects"'), 'missing objects toggle');
    assert.ok(html.includes('id="menu-val-anim"'), 'missing anim tiles toggle');
    assert.ok(html.includes('id="menu-val-collision"'), 'missing collision toggle');
    assert.ok(html.includes('id="menu-val-fog"'), 'missing fog toggle');
    assert.ok(html.includes('id="menu-val-zoom"'), 'missing zoom control');

    // Tab 1: Emulation
    assert.ok(html.includes('id="menu-panel-1"'), 'missing emulation panel');
    assert.ok(html.includes('id="menu-val-speed"'), 'missing speed control');
    assert.ok(html.includes('id="menu-val-sound"'), 'missing sound control');
    assert.ok(html.includes('id="menu-val-focus"'), 'missing breakpoint focus control');

    // Tab 2: Controls & Remapper
    assert.ok(html.includes('id="menu-panel-2"'), 'missing controls panel');
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

// 5. Client script & Controllable Character gate
test('getMenuClientScript defines isPlayerControllable gate, L/R navigation, and key remapper', () => {
    const script = getMenuClientScript();
    assert.ok(script.includes('function isPlayerControllable(m)'), 'missing isPlayerControllable gate');
    assert.ok(script.includes('0x7E0ADB'), 'missing map check in isPlayerControllable');
    assert.ok(script.includes('0x7E22EB'), 'missing engine sequence flags check');
    assert.ok(script.includes('0x7E0A35'), 'missing boy max HP check');

    assert.ok(script.includes('function openEmulatorMenu()'), 'missing openEmulatorMenu');
    assert.ok(script.includes('function closeEmulatorMenu()'), 'missing closeEmulatorMenu');
    assert.ok(script.includes('function switchMenuTab(delta)'), 'missing switchMenuTab');
    assert.ok(script.includes('function pollGamepadMenu()'), 'missing pollGamepadMenu');
    assert.ok(script.includes('function startKeybindListen(btnName)'), 'missing startKeybindListen');
});

// 6. Template integration in buildHtml
test('buildHtml embeds menu CSS, HTML, menu button, and script', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(html.includes('id="emulator-menu"'), 'emulator-menu missing from buildHtml');
    assert.ok(html.includes('id="screen-menu-btn"'), 'screen-menu-btn missing from buildHtml');
    assert.ok(html.includes('openEmulatorMenu'), 'openEmulatorMenu missing from buildHtml');
    assert.ok(html.includes('isPlayerControllable'), 'isPlayerControllable missing from buildHtml');
    assert.ok(html.includes('playMenuSound'), 'playMenuSound missing from buildHtml');
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
