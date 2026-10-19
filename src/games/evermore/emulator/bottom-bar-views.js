// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

const { pageFile } = require('./page-file');

/**
 * games/evermore/emulator/bottom-bar-views.js
 *
 * Evermore's part of the emulator page (handed in as host.js webview(), see src/core/emulator/AGENTS.md):
 * HTML, CSS, and client-side logic for the bottom bar pages:
 * 1. Entities & Enemies (Boy, Dog, Enemies, NPCs with sprite icons)
 * 2. Projectile Alchemy + Animation Alchemy + Projectiles (8 slots each with icons)
 * 3. Sprite Palettes + Map Palettes (16-color swatches with hex tooltips)
 * 4. Cheats (Atlas 999 glitch, Invincible flag, No Clip / Phasing flag)
 *
 * Invariant: Must remain strictly ASCII-only.
 */

function getBottomBarCss() {
  return pageFile('bottom-bar.css');
}

function getBottomBarTabButtonsHtml() {
  return `
        <button id="ss-tab-entities" class="ss-tab" data-needs="full game" type="button">ENTITIES (<span id="ss-ent-count">0</span>)</button>
        <button id="ss-tab-alchemy" class="ss-tab" data-needs="full game" type="button">ALCHEMY &amp; PROJECTILES (<span id="ss-alc-count">0</span>)</button>
        <button id="ss-tab-palettes" class="ss-tab" data-needs="full game" type="button">PALETTES</button>
  `;
}

function getBottomBarViewsHtml() {
  return pageFile('bottom-bar-views.html');
}

function getBottomBarClientScript() {
  return pageFile('bottom-bar');
}

module.exports = {
  getBottomBarCss,
  getBottomBarTabButtonsHtml,
  getBottomBarViewsHtml,
  getBottomBarClientScript,
};
