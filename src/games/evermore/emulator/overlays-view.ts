/**
 * games/evermore/emulator/overlays-view.ts
 *
 * Evermore's screen layer of the emulator page, handed in through host.js webview(): the extended map
 * and its overlays (triggers, objects, animated tiles, collision, fog, HP / stamina bars), sprite
 * decoding for entities outside the screen, the inspector, the per-frame sample of the game's RAM
 * (samplePreLoopState), the overlay toggles and their screen chips. panel-webview.ts splices the two
 * scripts where they always ran (the order of the page's top-level code matters) and calls into them
 * only behind typeof guards (gameRomReset, gameOnRoomMap, renderExtendedMapAndOverlays, ...).
 *
 * The two scripts are real files in webview/ (overlays/, overlay-toggles.js); the trigger readers they
 * share with the host come from the EvsRom bundle (page-rom.ts).
 *
 * Invariant: Must remain strictly ASCII-only.
 */

import { pageFile } from './page-file';

function getScreenChipsHtml() {
  return `<button id="screen-extend-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Extended Map">MAP EXT OFF</button>
        <button id="screen-trigger-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Trigger Overlay (B &amp; Step-on)">TRIGGERS OFF</button>
        <button id="screen-object-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Objects Overlay">OBJECTS OFF</button>
        <button id="screen-anim-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Animated Tiles Overlay">ANIM TILES OFF</button>
        <button id="screen-collision-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Collision Lines Overlay">COLLISION OFF</button>
        <button id="screen-fog-toggle" class="screen-chip" data-needs="game" type="button" title="Toggle Fog of War outside emulator">FOG OFF</button>`;
}

function getOverlaysScript() {
  return pageFile('overlays');
}

function getOverlayTogglesScript() {
  return pageFile('overlay-toggles.js');
}

export { getScreenChipsHtml, getOverlaysScript, getOverlayTogglesScript };
