// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

const { pageFile } = require('./page-file');

/**
 * games/evermore/emulator/menu-tabs.js
 *
 * Evermore's tabs 1-4 of the emulator's pause menu (OVERLAYS, OBJECTS, LOOT, CHEATS), handed in
 * through host.js webview() like the bottom bar. The menu (src/core/emulator/menu/menu-view.js) splices
 * the buttons and panels into its card and calls the hooks below (gameStartAllowed, gameMenuOpened,
 * gameMenuLoad, gameMenuRender, gameMenuStep, gameMenuActivate, gameMenuSync, ...) only behind
 * typeof guards, so a page without them (the SNES CDL Recorder) has no tabs 1-4.
 *
 * Invariant: Must remain strictly ASCII-only.
 */

function getMenuTabsCss() {
  return pageFile('menu-tabs.css');
}

function getMenuTabButtonsHtml() {
  return `
            <button id="menu-tab-btn-1" class="menu-tab-btn" data-needs="game" type="button" data-tab="1">OVERLAYS</button>
            <button id="menu-tab-btn-2" class="menu-tab-btn" data-needs="game" type="button" data-tab="2">OBJECTS</button>
            <button id="menu-tab-btn-3" class="menu-tab-btn" data-needs="game" type="button" data-tab="3">LOOT</button>
            <button id="menu-tab-btn-4" class="menu-tab-btn" data-needs="game" type="button" data-tab="4">CHEATS</button>
`;
}

function getMenuPanelsHtml() {
  return pageFile('menu-tabs.html');
}

function getMenuTabsClientScript() {
  return pageFile('menu-tabs');
}

module.exports = { getMenuTabsCss, getMenuTabButtonsHtml, getMenuPanelsHtml, getMenuTabsClientScript };
