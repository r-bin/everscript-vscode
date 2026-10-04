'use strict';

const assert = require('assert');
const { parseRoomTriggers, calculateTriggerBox, buildHtml } = require('../../src/emulator/panel-webview');

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

console.log('Emulator Trigger Overlay Tests:');

// 1. Parameter guards
test('parseRoomTriggers rejects invalid arguments and out of range map IDs', () => {
    assert.strictEqual(parseRoomTriggers(null, 0), null);
    assert.strictEqual(parseRoomTriggers(undefined, 0), null);
    assert.strictEqual(parseRoomTriggers(new Uint8Array(100), -1), null);
    assert.strictEqual(parseRoomTriggers(new Uint8Array(100), 0x95), null);
    assert.strictEqual(parseRoomTriggers(new Uint8Array(100), '0'), null);
});

// 2. Synthetic ROM buffer decoding
test('parseRoomTriggers correctly decodes step-on and B-triggers from unheadered ROM', () => {
    // 3MB unheadered ROM buffer (at least 0x200000 bytes)
    const rom = new Uint8Array(0x210000);
    const mapId = 0x15;
    const mapTableRom = 0x1ffde7;
    const ptrAddr = mapTableRom + mapId * 4;

    // SNES address for data blob: bank 0x9F, offset 0x8000 -> 0x9F8000
    // dataRom = ((0x9F & 0x3F) * 0x10000) + 0x8000 = 0x1F8000
    const dataSnes = 0x9f8000;
    rom[ptrAddr + 0] = dataSnes & 0xff;
    rom[ptrAddr + 1] = (dataSnes >> 8) & 0xff;
    rom[ptrAddr + 2] = (dataSnes >> 16) & 0xff;

    const dataRom = 0x1f8000;
    rom[dataRom + 0] = 0x1e; // offX = 30
    rom[dataRom + 1] = 0x04; // offY = 4

    // stepLen = 6 bytes (1 entry)
    rom[dataRom + 0x0d] = 0x06;
    rom[dataRom + 0x0e] = 0x00;
    const stepTableRom = dataRom + 0x0f;
    // Entry: y1=10, x1=36, y2=12, x2=38, scriptId=0x0094
    rom[stepTableRom + 0] = 10;
    rom[stepTableRom + 1] = 36;
    rom[stepTableRom + 2] = 12;
    rom[stepTableRom + 3] = 38;
    rom[stepTableRom + 4] = 0x94;
    rom[stepTableRom + 5] = 0x00;

    // bLen = 6 bytes (1 entry)
    const bLengthRom = stepTableRom + 6;
    rom[bLengthRom + 0] = 0x06;
    rom[bLengthRom + 1] = 0x00;
    const bTableRom = bLengthRom + 2;
    // Entry: y1=14, x1=40, y2=16, x2=42, scriptId=0x01A2
    rom[bTableRom + 0] = 14;
    rom[bTableRom + 1] = 40;
    rom[bTableRom + 2] = 16;
    rom[bTableRom + 3] = 42;
    rom[bTableRom + 4] = 0xa2;
    rom[bTableRom + 5] = 0x01;

    const res = parseRoomTriggers(rom, mapId);
    assert.ok(res, 'expected parsed result');
    assert.strictEqual(res.offX, 30);
    assert.strictEqual(res.offY, 4);
    assert.strictEqual(res.stepOn.length, 1);
    assert.strictEqual(res.stepOn[0].x1, 36);
    assert.strictEqual(res.stepOn[0].y1, 10);
    assert.strictEqual(res.stepOn[0].x2, 38);
    assert.strictEqual(res.stepOn[0].y2, 12);
    assert.strictEqual(res.stepOn[0].scriptId, 0x94);

    assert.strictEqual(res.bTrigger.length, 1);
    assert.strictEqual(res.bTrigger[0].x1, 40);
    assert.strictEqual(res.bTrigger[0].y1, 14);
    assert.strictEqual(res.bTrigger[0].x2, 42);
    assert.strictEqual(res.bTrigger[0].y2, 16);
    assert.strictEqual(res.bTrigger[0].scriptId, 0x1a2);
});

// 3. Headered ROM support (512-byte SMC header)
test('parseRoomTriggers shifts addresses correctly for 512-byte headered ROMs', () => {
    const rom = new Uint8Array(0x210000 + 512);
    const mapId = 0x02;
    const headerOffset = 512;
    const mapTableRom = headerOffset + 0x1ffde7;
    const ptrAddr = mapTableRom + mapId * 4;

    const dataSnes = 0x9f9000;
    rom[ptrAddr + 0] = dataSnes & 0xff;
    rom[ptrAddr + 1] = (dataSnes >> 8) & 0xff;
    rom[ptrAddr + 2] = (dataSnes >> 16) & 0xff;

    const dataRom = headerOffset + 0x1f9000;
    rom[dataRom + 0] = 5; // offX
    rom[dataRom + 1] = 8; // offY
    rom[dataRom + 0x0d] = 0; // 0 step triggers
    rom[dataRom + 0x0e] = 0;
    rom[dataRom + 0x0f] = 0; // 0 b triggers
    rom[dataRom + 0x10] = 0;

    const res = parseRoomTriggers(rom, mapId);
    assert.ok(res);
    assert.strictEqual(res.offX, 5);
    assert.strictEqual(res.offY, 8);
    assert.strictEqual(res.stepOn.length, 0);
    assert.strictEqual(res.bTrigger.length, 0);
});

// 4. Trigger box coordinate transform
test('calculateTriggerBox computes 2x canvas coordinates with room offset and camera scroll', () => {
    const trigger = { x1: 36, y1: 10, x2: 38, y2: 12, scriptId: 0x94 };
    const trigOffX = 30;
    const trigOffY = 4;

    // At camera (0, 0):
    // posX = (36 - 30) * 16 = 96
    // posY = (10 - 4) * 16 = 96
    // boxW = (38 - 36) * 16 = 32
    // boxH = (12 - 10) * 16 = 32
    // 2x canvas: sx=192, sy=192, sw=64, sh=64
    const box1 = calculateTriggerBox(trigger, trigOffX, trigOffY, 0, 0);
    assert.strictEqual(box1.posX, 96);
    assert.strictEqual(box1.posY, 96);
    assert.strictEqual(box1.boxW, 32);
    assert.strictEqual(box1.boxH, 32);
    assert.strictEqual(box1.sx, 192);
    assert.strictEqual(box1.sy, 192);
    assert.strictEqual(box1.sw, 64);
    assert.strictEqual(box1.sh, 64);

    // With camera scrolled right 10 px, down 20 px:
    // sx = (96 - 10) * 2 = 172
    // sy = (96 - 20) * 2 = 152
    const box2 = calculateTriggerBox(trigger, trigOffX, trigOffY, 10, 20);
    assert.strictEqual(box2.sx, 172);
    assert.strictEqual(box2.sy, 152);
    assert.strictEqual(box2.sw, 64);
    assert.strictEqual(box2.sh, 64);
});

// 5. Template integration checks
test('buildHtml renders trigger overlay UI elements and event bindings', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(html.includes('id="screen-trigger-toggle"'), 'screen-trigger-toggle missing');
    assert.ok(html.includes('id="ss-overlay-toggle"'), 'ss-overlay-toggle missing');
    assert.ok(html.includes('triggersOverlayEnabled'), 'triggersOverlayEnabled missing');
    assert.ok(html.includes('renderTriggersOverlay'), 'renderTriggersOverlay missing');
    assert.ok(html.includes('#ff69b4'), 'pink step-on styling missing');
    assert.ok(html.includes('#ffcc00'), 'yellow b-trigger styling missing');
});

// 6. Extended map and full screen overlay checks
test('buildHtml includes extended map background and full-viewport overlay canvases', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(html.includes('id="extended-map"'), 'extended-map canvas missing');
    assert.ok(html.includes('id="extended-overlay"'), 'extended-overlay canvas missing');
    assert.ok(html.includes('id="screen-extend-toggle"'), 'screen-extend-toggle missing');
    assert.ok(html.includes('id="ss-extend-toggle"'), 'ss-extend-toggle missing');
    assert.ok(html.includes('extendMapEnabled'), 'extendMapEnabled missing');
    assert.ok(html.includes('setExtendMap'), 'setExtendMap missing');
    assert.ok(html.includes('requestRoomMap'), 'requestRoomMap postMessage missing');
    assert.ok(html.includes('roomMapRendered'), 'roomMapRendered message listener missing');
});

// 7. Focus border removal
test('buildHtml removes yellow/default focus outline and box-shadow on screen canvas', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(html.includes('#screen:focus, #screen:focus-visible'), 'focus selector missing');
    assert.ok(html.includes('outline: none;'), 'outline: none missing');
    assert.ok(html.includes('box-shadow: none;'), 'box-shadow: none missing');
});

// 8. Trigger label constant positioning (no screen-edge clamping)
test('trigger overlay positions labels constantly relative to trigger box without edge clamping', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(!html.includes('Math.max(0, box.sx)'), 'Math.max clamping on box.sx should be removed');
    assert.ok(!html.includes('Math.max(0, box.sy)'), 'Math.max clamping on box.sy should be removed');
    assert.ok(html.includes('const labelX = tx + 2;'), 'labelX should be positioned relative to tx');
    assert.ok(html.includes('const labelY = ty + 10;'), 'labelY should be positioned relative to ty');
});

// 9. Extended entities canvas and sprite rendering
test('buildHtml includes extended-entities canvas and sprite rendering routines', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(html.includes('id="extended-entities"'), 'extended-entities canvas missing');
    assert.ok(html.includes('renderExtendedEntities'), 'renderExtendedEntities routine missing');
    assert.ok(html.includes('getDecodedSprite'), 'getDecodedSprite routine missing');
    assert.ok(html.includes('readSpriteInfo'), 'readSpriteInfo routine missing');
    assert.ok(html.includes('composeSprite'), 'composeSprite routine missing');
    assert.ok(html.includes('characterPalette'), 'characterPalette routine missing');
});

// 10. Zoom and pan controls
test('buildHtml includes zoom and pan controls and event handlers', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(html.includes('id="screen-zoom-chip"'), 'screen-zoom-chip missing');
    assert.ok(html.includes('id="screen-zout"'), 'screen-zout missing');
    assert.ok(html.includes('id="screen-zin"'), 'screen-zin missing');
    assert.ok(html.includes('id="screen-zfit"'), 'screen-zfit missing');
    assert.ok(html.includes('id="screen-zlevel"'), 'screen-zlevel missing');
    assert.ok(html.includes('zoomAt'), 'zoomAt function missing');
    assert.ok(html.includes('updateScreenLayout'), 'updateScreenLayout function missing');
    assert.ok(html.includes("wrap.addEventListener('wheel'"), 'wheel listener on wrap missing');
});

// 11. Pre-sampled camera timing to prevent walking desync
test('buildHtml samples camera and entity state before _mainLoop to prevent walking 1px lag', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(html.includes('samplePreLoopState'), 'samplePreLoopState missing');
    const mainLoopIdx = html.indexOf('Module._mainLoop()');
    const sampleIdx = html.indexOf('samplePreLoopState()');
    assert.ok(sampleIdx > 0 && sampleIdx < mainLoopIdx, 'samplePreLoopState must be called before Module._mainLoop');
});

// 12. Extended foreground priority canvas, dog entity address, and projectile check
test('buildHtml includes extended-foreground canvas, correct dog address, and projectile check', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    assert.ok(html.includes('id="extended-foreground"'), 'extended-foreground canvas missing');
    assert.ok(html.includes('#extended-foreground {'), 'extended-foreground CSS rule missing');
    assert.ok(html.includes('0x4F37'), 'dog entity address 0x4F37 missing');
    assert.ok(html.includes('pbuf[rel + 0x10]'), 'projectile active check at +0x10 missing');
    assert.ok(html.includes('animGroups'), 'animGroups handling missing');
    assert.ok(html.includes('foregroundImg'), 'foregroundImg handling missing');
});

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
