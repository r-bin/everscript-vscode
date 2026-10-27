// Tests for PPU tabs in Memory Radar: CGRAM, OAM, VRAM sub-panes.
'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const { buildCgramTabHtml, buildOamTabHtml, buildVramTabHtml } = require('../../dist/games/evermore/memory/render-ppu-tabs');
const { renderRadarHtml } = require('../../dist/games/evermore/memory/render-radar');

describe('PPU Memory Spaces Tabs (CGRAM, OAM, VRAM)', () => {
    it('buildCgramTabHtml renders 16 sub-palettes and 256 color swatches', () => {
        const html = buildCgramTabHtml();
        assert.ok(html.includes('data-mem="cgram"'), 'CGRAM pane container exists');
        assert.ok(html.includes('BG 0: System & HUD'), 'System palette BG 0 is present');
        assert.ok(html.includes('BG 1: Tile Family 0'), 'Tile family BG 1 is present');
        assert.ok(html.includes('OBJ 6: The Boy'), 'The Boy sprite palette is present');
        assert.ok(html.includes('OBJ 7: The Dog'), 'The Dog sprite palette is present');

        // Check swatch count: 16 palettes * 16 colors = 256 swatches
        const swatchMatches = html.match(/data-offset="\$[0-9A-F]{4}"/g);
        assert.strictEqual(swatchMatches ? swatchMatches.length : 0, 256, 'Exactly 256 color swatches rendered');

        // Check transparent swatches (index 0 of each palette = 16)
        const transMatches = html.match(/cgram-trans/g);
        assert.strictEqual(transMatches ? transMatches.length : 0, 16, 'Color index 0 of all 16 palettes marked transparent');

        // Check inspector fields
        assert.ok(html.includes('id="cgram-insp-swatch"'), 'Inspector swatch preview exists');
        assert.ok(html.includes('id="cgram-insp-bgr"'), 'BGR555 inspector field exists');
        assert.ok(html.includes('id="cgram-insp-hex"'), 'RGB888 inspector field exists');
    });

    it('buildOamTabHtml renders 128 sprite slots and interactive viewport', () => {
        const html = buildOamTabHtml();
        assert.ok(html.includes('data-mem="oam"'), 'OAM pane container exists');
        assert.ok(html.includes('id="oam-viewport"'), 'SNES screen viewport canvas exists');

        // Check table row count: exactly 128 slots
        const rowMatches = html.match(/<tr class="oam-tr/g);
        assert.strictEqual(rowMatches ? rowMatches.length : 0, 128, 'Exactly 128 hardware sprite rows rendered');

        // Check active hero sprites are mapped
        assert.ok(html.includes('Boy: Head/Hair'), 'Boy sprite chunk placed in OAM');
        assert.ok(html.includes('Dog: Body'), 'Dog sprite chunk placed in OAM');
        assert.ok(html.includes('data-slot="0"'), 'Slot 0 is assigned');
        assert.ok(html.includes('data-slot="127"'), 'Slot 127 is present');
    });

    it('buildVramTabHtml renders 64 KB memory map layout and CHR pattern viewer', () => {
        const html = buildVramTabHtml();
        assert.ok(html.includes('data-mem="vram"'), 'VRAM pane container exists');
        assert.ok(html.includes('id="vram-subview-chr"'), 'CHR pattern table viewer exists');
        assert.ok(html.includes('id="vram-subview-layout"'), 'Memory map layout exists');

        // Check memory map regions
        assert.ok(html.includes('BG1 Screen Base & Tilemap'), 'BG1 canopy tilemap region exists');
        assert.ok(html.includes('BG2 Screen Base & Tilemap'), 'BG2 terrain tilemap region exists');
        assert.ok(html.includes('BG1 & BG2 Character Data'), 'Terrain CHR character data region exists');
        assert.ok(html.includes('OBJ Character Data'), 'Sprite CHR character data region exists');
        assert.ok(html.includes('$0000 – $07FF'), 'VRAM base addresses documented');

        // Check CHR tiles rendered
        const tileMatches = html.match(/class="vram-tile-cell"/g);
        assert.strictEqual(tileMatches ? tileMatches.length : 0, 64, '64 sample pattern tiles rendered');

        // Check palette picker
        assert.ok(html.includes('id="vram-pal-select"'), 'Palette picker select dropdown exists');
    });

    it('renderRadarHtml includes all 6 memory sub-buttons in the Memory subbar', () => {
        const scope = { kind: 'global', name: 'test', startLine: 0, endLine: 10 };
        const refs = new Map();
        const pools = [];
        const argRefs = new Map();
        const mapByAddr = new Map();

        const html = renderRadarHtml(scope, refs, pools, argRefs, mapByAddr);
        assert.ok(html.includes('data-mem-view="bus"'), 'Bus sub-tab button exists');
        assert.ok(html.includes('data-mem-view="wram"'), 'WRAM sub-tab button exists');
        assert.ok(html.includes('data-mem-view="rom"'), 'ROM sub-tab button exists');
        assert.ok(html.includes('data-mem-view="vram"'), 'VRAM sub-tab button exists');
        assert.ok(html.includes('data-mem-view="oam"'), 'OAM sub-tab button exists');
        assert.ok(html.includes('data-mem-view="cgram"'), 'CGRAM sub-tab button exists');

        assert.ok(html.includes('data-mem="vram"'), 'VRAM sub-pane embedded in Memory tab');
        assert.ok(html.includes('data-mem="oam"'), 'OAM sub-pane embedded in Memory tab');
        assert.ok(html.includes('data-mem="cgram"'), 'CGRAM sub-pane embedded in Memory tab');
    });

    it('browser interaction: switches between CGRAM, OAM, and VRAM and interacts with swatches/sprites', async () => {
        let playwright;
        try { playwright = require('playwright'); } catch { return; }
        if (!playwright || !playwright.chromium) return;

        const browser = await playwright.chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));

        const stub = '<script>window.__posted=[];window.acquireVsCodeApi=function(){return{postMessage:function(m){window.__posted.push(m)},getState:function(){return null},setState:function(){}}};</script>';
        const html = renderRadarHtml({ kind: 'function', name: 'test', startLine: 0, endLine: 1 }, new Map(), [], new Map(), new Map(), [], 'radar', null);
        await page.setContent(html.replace('<head>', '<head>' + stub));

        // 1. CGRAM sub-view
        await page.click('[data-mem-view="cgram"]');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.cgram-pane')).display), 'flex');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.vram-pane')).display), 'none');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.oam-pane')).display), 'none');

        // Hover swatch
        await page.hover('.cgram-swatch[data-idx="1"]');
        assert.ok(await page.locator('.cgram-swatch[data-idx="1"].cgram-selected').count() === 1);
        const hexVal = await page.textContent('#cgram-insp-hex');
        assert.ok(hexVal.startsWith('#'), 'Inspector hex color updated');

        // Toggle filter
        await page.click('[data-cgram-filter="bg"]');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.cgram-section[data-sec="obj"]')).display), 'none');
        await page.click('[data-cgram-filter="all"]');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.cgram-section[data-sec="obj"]')).display), 'flex');

        // 2. OAM sub-view
        await page.click('[data-mem-view="oam"]');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.oam-pane')).display), 'flex');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.cgram-pane')).display), 'none');

        // Click sprite box on canvas
        await page.click('.oam-sprite-box[data-slot="0"]');
        assert.ok(await page.locator('.oam-tr[data-slot="0"].oam-sel').count() === 1, 'Table row selected on sprite click');

        // Zoom toggle
        await page.click('[data-oam-zoom="2"]');
        assert.ok(await page.locator('#oam-viewport.oam-zoom-2').count() === 1);

        // 3. VRAM sub-view
        await page.click('[data-mem-view="vram"]');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.vram-pane')).display), 'flex');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('.oam-pane')).display), 'none');

        // Toggle subviews
        await page.click('[data-vram-view="layout"]');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('vram-subview-layout')).display), 'flex');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('vram-subview-chr')).display), 'none');

        await page.click('[data-vram-view="chr"]');
        assert.strictEqual(await page.evaluate(() => getComputedStyle(document.getElementById('vram-subview-chr')).display), 'flex');

        // Click tile
        await page.click('.vram-tile-cell[data-tile="0"]');
        assert.ok(await page.locator('.vram-tile-cell[data-tile="0"].vram-sel').count() === 1);

        assert.deepStrictEqual(errors, [], 'No page JavaScript errors');
        await browser.close();
    });
});
