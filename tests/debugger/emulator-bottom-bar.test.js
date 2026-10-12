'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    getBottomBarCss,
    getBottomBarTabButtonsHtml,
    getBottomBarViewsHtml,
    getBottomBarClientScript,
} = require('../../src/emulator/bottom-bar-views');
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

console.log('Emulator Bottom Bar Pages Tests:');

// 1. ASCII-only verification
test('bottom-bar-views.js and modified panel files are strictly ASCII-only', () => {
    const files = [
        path.join(__dirname, '..', '..', 'src', 'emulator', 'bottom-bar-views.js'),
        path.join(__dirname, '..', '..', 'src', 'emulator', 'panel.js'),
        path.join(__dirname, '..', '..', 'src', 'emulator', 'panel-webview.js'),
    ];
    for (const f of files) {
        const content = fs.readFileSync(f, 'utf8');
        const nonAscii = /[^\x09\x0A\x0D\x20-\x7E]/.test(content);
        assert.strictEqual(nonAscii, false, `${path.basename(f)} contains non-ASCII characters`);
    }
});

// 2. Tab buttons HTML
test('getBottomBarTabButtonsHtml exposes entities, alchemy, and palettes tab buttons', () => {
    const html = getBottomBarTabButtonsHtml();
    assert.ok(html.includes('id="ss-tab-entities"'), 'ss-tab-entities missing');
    assert.ok(html.includes('id="ss-tab-alchemy"'), 'ss-tab-alchemy missing');
    assert.ok(html.includes('id="ss-tab-palettes"'), 'ss-tab-palettes missing');
    assert.ok(!html.includes('id="ss-tab-cheats"'), 'ss-tab-cheats should be removed (ported to pause menu)');
    assert.ok(html.includes('id="ss-ent-count"'), 'ss-ent-count badge missing');
    assert.ok(html.includes('id="ss-alc-count"'), 'ss-alc-count badge missing');
});

// 3. Tab views HTML
test('getBottomBarViewsHtml includes entities view with category filters and search', () => {
    const html = getBottomBarViewsHtml();
    assert.ok(html.includes('id="ss-view-entities"'), 'ss-view-entities view missing');
    assert.ok(html.includes('id="ent-filter-all"'), 'ent-filter-all missing');
    assert.ok(html.includes('id="ent-filter-party"'), 'ent-filter-party missing');
    assert.ok(html.includes('id="ent-filter-enemies"'), 'ent-filter-enemies missing');
    assert.ok(html.includes('id="ent-filter-npcs"'), 'ent-filter-npcs missing');
    assert.ok(html.includes('id="ent-search"'), 'ent-search input missing');
    assert.ok(html.includes('id="ent-table"'), 'ent-table element missing');
    assert.ok(html.includes('id="ent-tbody"'), 'ent-tbody element missing');
});

test('getBottomBarViewsHtml includes alchemy view with 3 pools of 8 slots', () => {
    const html = getBottomBarViewsHtml();
    assert.ok(html.includes('id="ss-view-alchemy"'), 'ss-view-alchemy view missing');
    assert.ok(html.includes('id="alc-sec-palc"'), 'projectile alchemy section missing');
    assert.ok(html.includes('id="alc-sec-aalc"'), 'animation alchemy section missing');
    assert.ok(html.includes('id="alc-sec-proj"'), 'projectiles section missing');
    assert.ok(html.includes('id="alc-palc-tbody"'), 'projectile alchemy tbody missing');
    assert.ok(html.includes('id="alc-aalc-tbody"'), 'animation alchemy tbody missing');
    assert.ok(html.includes('id="alc-proj-tbody"'), 'projectiles tbody missing');
});

test('getBottomBarViewsHtml includes palettes view with sprite and map grids', () => {
    const html = getBottomBarViewsHtml();
    assert.ok(html.includes('id="ss-view-palettes"'), 'ss-view-palettes view missing');
    assert.ok(html.includes('id="pal-sec-sprites"'), 'pal-sec-sprites missing');
    assert.ok(html.includes('id="pal-sec-maps"'), 'pal-sec-maps missing');
    assert.ok(html.includes('id="pal-sprite-grid"'), 'pal-sprite-grid missing');
    assert.ok(html.includes('id="pal-map-grid"'), 'pal-map-grid missing');
});

test('getBottomBarViewsHtml excludes cheats view (ported to pause menu)', () => {
    const html = getBottomBarViewsHtml();
    assert.ok(!html.includes('id="ss-view-cheats"'), 'ss-view-cheats should be removed');
});

// 4. Client-side script features
test('getBottomBarClientScript exports essential functions and spell definitions', () => {
    const script = getBottomBarClientScript();
    assert.ok(script.includes('const ALCHEMY_SPELL_MAP'), 'ALCHEMY_SPELL_MAP missing');
    assert.ok(script.includes('maintainCheats'), 'maintainCheats function missing');
    assert.ok(script.includes('disableAtlasCheat'), 'disableAtlasCheat function missing');
    assert.ok(script.includes('disableInvincibleCheat'), 'disableInvincibleCheat function missing');
    assert.ok(script.includes('disableNoclipCheat'), 'disableNoclipCheat function missing');
    assert.ok(script.includes('healParty'), 'healParty function missing');
    assert.ok(script.includes('updateEntitiesTab'), 'updateEntitiesTab function missing');
    assert.ok(script.includes('updateAlchemyTab'), 'updateAlchemyTab function missing');
    assert.ok(script.includes('updatePalettesTab'), 'updatePalettesTab function missing');
    assert.ok(script.includes('updateCheatsTab'), 'updateCheatsTab function missing');
    assert.ok(script.includes('refreshActiveBottomTab'), 'refreshActiveBottomTab function missing');
});

// 5. Integration into buildHtml()
test('buildHtml correctly embeds all bottom bar buttons, views, CSS and logic', () => {
    const mockWebview = { asWebviewUri: (uri) => uri };
    const html = buildHtml(mockWebview, 'core.js', 'core.wasm', 'core', '/path/to/core');

    // CSS
    assert.ok(html.includes('.pal-swatch'), 'pal-swatch CSS missing');
    assert.ok(html.includes('.ent-icon'), 'ent-icon CSS missing');
    assert.ok(html.includes('.alc-icon'), 'alc-icon CSS missing');
    assert.ok(html.includes('.cheat-card'), 'cheat-card CSS missing');

    // Tab buttons
    assert.ok(html.includes('id="ss-tab-entities"'), 'ss-tab-entities missing in buildHtml');
    assert.ok(html.includes('id="ss-tab-alchemy"'), 'ss-tab-alchemy missing in buildHtml');
    assert.ok(html.includes('id="ss-tab-palettes"'), 'ss-tab-palettes missing in buildHtml');
    assert.ok(!html.includes('id="ss-tab-cheats"'), 'ss-tab-cheats should not be in buildHtml');

    // Tab views
    assert.ok(html.includes('id="ss-view-entities"'), 'ss-view-entities missing in buildHtml');
    assert.ok(html.includes('id="ss-view-alchemy"'), 'ss-view-alchemy missing in buildHtml');
    assert.ok(html.includes('id="ss-view-palettes"'), 'ss-view-palettes missing in buildHtml');
    assert.ok(!html.includes('id="ss-view-cheats"'), 'ss-view-cheats should not be in buildHtml');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
