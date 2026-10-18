'use strict';

/**
 * games/evermore/emulator/overlays-view.js
 *
 * Evermore's screen layer of the emulator page, handed in through host.js webview(): the extended map
 * and its overlays (triggers, objects, animated tiles, collision, fog, HP / stamina bars), sprite
 * decoding for entities outside the screen, the inspector, the per-frame sample of the game's RAM
 * (samplePreLoopState), the overlay toggles and their screen chips. panel-webview.js splices the two
 * scripts where they always ran (the order of the page's top-level code matters) and calls into them
 * only behind typeof guards (gameRomReset, gameOnRoomMap, renderExtendedMapAndOverlays, ...).
 *
 * The two scripts are real files in webview/ (overlays.js, overlay-toggles.js); the three trigger helpers
 * the page shares with the host are spliced in where overlays.js marks them.
 *
 * Invariant: Must remain strictly ASCII-only.
 */

const { pageFile } = require('./page-file');
const { parseRoomTriggers, calculateTriggerBox, resolveScriptIdToSnes } = require('../../../../dist/games/evermore/emulator/room-triggers');

function getScreenChipsHtml() {
  return `<button id="screen-extend-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Extended Map">MAP EXT OFF</button>
        <button id="screen-trigger-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Trigger Overlay (B &amp; Step-on)">TRIGGERS OFF</button>
        <button id="screen-object-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Objects Overlay">OBJECTS OFF</button>
        <button id="screen-anim-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Animated Tiles Overlay">ANIM TILES OFF</button>
        <button id="screen-collision-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Collision Lines Overlay">COLLISION OFF</button>
        <button id="screen-fog-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Fog of War outside emulator">FOG OFF</button>`;
}

const helper = { parseRoomTriggers, calculateTriggerBox, resolveScriptIdToSnes };

function getOverlaysScript() {
  return pageFile('overlays', Object.fromEntries(Object.entries(helper).map(([name, fn]) => [name, fn.toString()])));
}

function getOverlayTogglesScript() {
  return pageFile('overlay-toggles.js');
}

module.exports = { getScreenChipsHtml, getOverlaysScript, getOverlayTogglesScript };
