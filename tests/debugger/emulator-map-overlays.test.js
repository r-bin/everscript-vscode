'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

console.log('Emulator Map Overlays (Objects, Animated Tiles, & Collision Lines) Tests:');

// 1. ASCII-only verification
test('panel.js and panel-webview.js are strictly ASCII-only', () => {
    const files = [
        path.join(__dirname, '..', '..', 'src', 'emulator', 'panel.js'),
        path.join(__dirname, '..', '..', 'src', 'emulator', 'panel-webview.js'),
    ];
    for (const f of files) {
        const content = fs.readFileSync(f, 'utf8');
        const nonAscii = /[^\x09\x0A\x0D\x20-\x7E]/.test(content);
        assert.strictEqual(nonAscii, false, `${path.basename(f)} contains non-ASCII characters`);
    }
});

// 2. HTML elements in buildHtml
test('buildHtml includes overlay chips and control checkboxes for objects, anim tiles, and collision', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    // Chips in #screen-overlay-bar
    assert.ok(html.includes('id="screen-object-toggle"'), 'screen-object-toggle missing');
    assert.ok(html.includes('OBJECTS ON'), 'OBJECTS ON text missing');
    assert.ok(html.includes('id="screen-anim-toggle"'), 'screen-anim-toggle missing');
    assert.ok(html.includes('ANIM TILES ON'), 'ANIM TILES ON text missing');
    assert.ok(html.includes('id="screen-collision-toggle"'), 'screen-collision-toggle missing');
    assert.ok(html.includes('COLLISION ON'), 'COLLISION ON text missing');

    // Checkboxes in #ss-controls
    assert.ok(html.includes('id="ss-object-toggle"'), 'ss-object-toggle checkbox missing');
    assert.ok(html.includes('id="ss-anim-toggle"'), 'ss-anim-toggle checkbox missing');
    assert.ok(html.includes('id="ss-collision-toggle"'), 'ss-collision-toggle checkbox missing');
    assert.ok(html.includes('id="ss-object-label"'), 'ss-object-label missing');
    assert.ok(html.includes('id="ss-anim-label"'), 'ss-anim-label missing');
    assert.ok(html.includes('id="ss-collision-label"'), 'ss-collision-label missing');

    // CSS
    assert.ok(html.includes('#ss-object-label'), 'CSS for #ss-object-label missing');
    assert.ok(html.includes('#ss-anim-label'), 'CSS for #ss-anim-label missing');
    assert.ok(html.includes('#ss-collision-label'), 'CSS for #ss-collision-label missing');
});

// 3. Client script rendering logic
test('panel-webview contains renderObjectsOverlay, renderAnimTilesOverlay, and renderCollisionOverlay functions', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(html.includes('function renderObjectsOverlay'), 'renderObjectsOverlay missing');
    assert.ok(html.includes('function renderAnimTilesOverlay'), 'renderAnimTilesOverlay missing');
    assert.ok(html.includes('function renderCollisionOverlay'), 'renderCollisionOverlay missing');
    assert.ok(html.includes('function setObjectsOverlay'), 'setObjectsOverlay missing');
    assert.ok(html.includes('function setAnimTilesOverlay'), 'setAnimTilesOverlay missing');
    assert.ok(html.includes('function setCollisionOverlay'), 'setCollisionOverlay missing');

    // Color and visual constants matching map editor
    assert.ok(html.includes('#29b6f6'), 'Sky blue object color #29b6f6 missing');
    assert.ok(html.includes('#bf55ec'), 'Purple animated tile color #bf55ec missing');
    assert.ok(html.includes('OBJ '), 'OBJ label missing');
});

// 4. Panel.js passes objects, animTiles, and collisionUri in roomMapRendered
test('panel.js computes and passes objects, animTiles, and collisionUri in roomMapRendered data', () => {
    const panelJsPath = path.join(__dirname, '..', '..', 'src', 'emulator', 'panel.js');
    const panelContent = fs.readFileSync(panelJsPath, 'utf8');

    assert.ok(panelContent.includes('roomObjects = []'), 'roomObjects extraction missing in panel.js');
    assert.ok(panelContent.includes('animTileClusters = []'), 'animTileClusters extraction missing in panel.js');
    assert.ok(panelContent.includes('maps.drawCollisionOverlay(img, staged, {'), 'drawCollisionOverlay missing in panel.js');
    assert.ok(panelContent.includes('collisionUri = maps.encodePngDataUri'), 'encodePngDataUri for collision missing in panel.js');
    assert.ok(panelContent.includes('collisionUri: collisionUri'), 'collisionUri field missing in data in panel.js');
    assert.ok(panelContent.includes('objects: roomObjects'), 'objects field missing in data in panel.js');
    assert.ok(panelContent.includes('animTiles: animTileClusters'), 'animTiles field missing in data in panel.js');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
