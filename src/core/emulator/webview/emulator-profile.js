// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

/**
 * emulator/webview/emulator-profile.js
 *
 * Loaded before the panel's inline script (panel-webview.ts); its functions run
 * later, from that script and from messages.
 *
 * Profile and game:
 *   - The profile ('full' Everscript, 'recorder' SNES CDL Recorder) comes from the
 *     #emu-config JSON block; the body carries it as a class.
 *   - emuGateRom(bytes) runs at every boot: gameDetectRom (the game's rom-game.js; none = no) sets
 *     emuGameRom and the body class rom-other. Elements marked data-needs are
 *     hidden by emulator-profile.css; the game's work in the inline script
 *     checks emuGameRom. A hidden pause-menu tab is left for the first one still
 *     shown; hidden panels are left out of the side and bottom bars (emulator-panels.js). emuScriptHook (the script stack polling and trace behind
 *     TRACE / STACK and the .evs debugger) needs the game's ROM and the full profile.
 *
 * Settings (kept by the host in globalState, sent back as 'emuSettings'):
 *   the overlay toggles, master audio mute, the keybinds and where each panel is
 *   shown (emulator-panels.js). Every change posts 'saveEmuSettings' (debounced).
 *   Zoom, speed, panel size and tabs are not saved.
 *   Everything optional starts off.
 *
 * Keep focus (pause menu, EMULATION): Tab stays on the emulator screen.
 */

const EMU_LEGACY_KEYBINDS = 'everscript_emulator_keybinds_v1';
const EMU_SAVE_MS = 300;
let emuProfile = 'full';
let emuApplying = false;
let emuSaveTimer = null;

let gameFeaturesEnabled = true;

function emuReadConfig() {
  try {
    const el = document.getElementById('emu-config');
    const cfg = el ? JSON.parse(el.textContent || '{}') : {};
    emuProfile = cfg.profile === 'recorder' ? 'recorder' : 'full';
  } catch (_) {
    emuProfile = 'full';
  }
  gameFeaturesEnabled = emuProfile !== 'recorder';
  if (document.body) document.body.classList.toggle('no-game-features', !gameFeaturesEnabled);
}

function setGameFeaturesEnabled(on) {
  gameFeaturesEnabled = !!on;
  if (document.body) document.body.classList.toggle('no-game-features', !gameFeaturesEnabled);
  emuScriptHook = emuGameRom && gameFeaturesEnabled;
  if (emuScriptHook && typeof startWramPolling === 'function') {
    startWramPolling();
  } else if (!emuScriptHook && typeof stopWramPolling === 'function') {
    stopWramPolling();
  }
  if (!gameFeaturesEnabled) {
    if (typeof lastSampledPreState !== 'undefined') lastSampledPreState = null;
    emuClearExtendedLayers();
  }
  if (typeof emuPanelsLayout === 'function') emuPanelsLayout();
  if (typeof menuActiveTab === 'number' && !emuMenuTabShown(menuActiveTab) && typeof selectMenuTab === 'function') {
    selectMenuTab(0);
  }
  if (typeof syncMenuValuesFromRuntime === 'function') syncMenuValuesFromRuntime();
  emuSettingsChanged();
}

/** Whether an element's data-needs words all hold for this profile and ROM. */
function emuShown(el) {
  if (!el) return false;
  const needs = (el.getAttribute('data-needs') || '').split(/\s+/).filter(Boolean);
  const hasGame = needs.includes('game');
  if (hasGame && (!emuGameRom || !gameFeaturesEnabled)) return false;
  return needs.every(n => (n === 'full' ? (emuProfile === 'full' || (hasGame && gameFeaturesEnabled))
    : n === 'recorder' ? emuProfile === 'recorder'
    : n === 'game' ? (emuGameRom && gameFeaturesEnabled)
    : true));
}

function emuMenuTabShown(index) {
  return emuShown(document.getElementById('menu-tab-btn-' + index));
}

function emuClearExtendedLayers() {
  ['extended-map', 'extended-entities', 'extended-foreground', 'extended-overlay'].forEach(id => {
    const c = document.getElementById(id);
    const ctx = c && c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
  });
}

/** Called at every boot, before the core starts. */
function emuGateRom(bytes) {
  emuGameRom = typeof gameDetectRom === 'function' ? gameDetectRom(bytes) : false;   // the game's detector (Evermore: rom-game.js)
  emuScriptHook = emuGameRom && gameFeaturesEnabled;
  document.body.classList.toggle('rom-other', !emuGameRom);
  document.body.classList.toggle('no-game-features', !gameFeaturesEnabled);
  if (!emuGameRom || !gameFeaturesEnabled) {
    if (typeof lastSampledPreState !== 'undefined') lastSampledPreState = null;
    emuClearExtendedLayers();
  }
  if (typeof emuPanelsLayout === 'function') emuPanelsLayout();
  if (typeof menuActiveTab === 'number' && !emuMenuTabShown(menuActiveTab) && typeof selectMenuTab === 'function') selectMenuTab(0);
}

function emuCollectSettings() {
  return {
    version: 1,
    overlays: {
      extend: typeof extendMapEnabled !== 'undefined' && !!extendMapEnabled,
      triggers: typeof triggersOverlayEnabled !== 'undefined' && !!triggersOverlayEnabled,
      objects: typeof objectsOverlayEnabled !== 'undefined' && !!objectsOverlayEnabled,
      anim: typeof animTilesOverlayEnabled !== 'undefined' && !!animTilesOverlayEnabled,
      collision: typeof collisionOverlayEnabled !== 'undefined' && !!collisionOverlayEnabled,
      fog: typeof fogOfWarEnabled !== 'undefined' && !!fogOfWarEnabled,
      sounds: typeof sndShow !== 'undefined' && !!sndShow,
      hpBar: typeof thinHpBarEnabled !== 'undefined' && !!thinHpBarEnabled,
      staminaBar: typeof thinStaminaBarEnabled !== 'undefined' && !!thinStaminaBarEnabled,
    },
    muted: !!emuMuted,
    panels: typeof emuCollectPanels === 'function' ? emuCollectPanels() : undefined,
    keybinds: Object.assign({}, userKeyMap),
    padBinds: Object.assign({}, userPadMap),
    startOpensMenu: typeof startOpensMenu !== 'undefined' ? !!startOpensMenu : undefined,
    gameFeatures: typeof gameFeaturesEnabled !== 'undefined' ? !!gameFeaturesEnabled : undefined,
  };
}

/** A setting changed by the user: save it (not while applying the saved ones). */
function emuSettingsChanged() {
  if (emuApplying || typeof vscodeApi === 'undefined' || !vscodeApi) return;
  if (emuSaveTimer) clearTimeout(emuSaveTimer);
  emuSaveTimer = setTimeout(() => {
    emuSaveTimer = null;
    vscodeApi.postMessage({ command: 'saveEmuSettings', settings: emuCollectSettings() });
  }, EMU_SAVE_MS);
}

function emuSetMuted(on) {
  emuMuted = !!on;
  emuSettingsChanged();
}

/** Keybinds saved by versions before v0.219.0 lived in the webview's localStorage. */
function emuLegacyKeybinds() {
  try {
    const raw = localStorage.getItem(EMU_LEGACY_KEYBINDS);
    if (!raw) return null;
    localStorage.removeItem(EMU_LEGACY_KEYBINDS);
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function emuApplySettings(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  const o = s.overlays || {};
  let migrated = false;
  emuApplying = true;
  try {
    // The overlays are the game's (games/evermore/emulator/overlays-view.ts): absent without it.
    const set = (fn, on) => { try { if (fn) fn(!!on); } catch (_) { /* a layer not ready yet redraws on the next frame */ } };
    set(typeof setExtendMap === 'function' ? setExtendMap : null, o.extend);
    set(typeof setTriggersOverlay === 'function' ? setTriggersOverlay : null, o.triggers);
    set(typeof setObjectsOverlay === 'function' ? setObjectsOverlay : null, o.objects);
    set(typeof setAnimTilesOverlay === 'function' ? setAnimTilesOverlay : null, o.anim);
    set(typeof setCollisionOverlay === 'function' ? setCollisionOverlay : null, o.collision);
    set(typeof setFogOfWar === 'function' ? setFogOfWar : null, o.fog);
    set(typeof sndSetShow === 'function' ? sndSetShow : null, o.sounds);
    set(typeof setThinHpBar === 'function' ? setThinHpBar : null, o.hpBar);
    set(typeof setThinStaminaBar === 'function' ? setThinStaminaBar : null, o.staminaBar);
    emuMuted = !!s.muted;
    if (typeof emuApplyPanels === 'function') emuApplyPanels(s.panels);
    let binds = s.keybinds && typeof s.keybinds === 'object' ? s.keybinds : null;
    if (!binds) { binds = emuLegacyKeybinds(); migrated = !!binds; }
    userKeyMap = Object.assign({}, DEFAULT_KEY_MAP, binds || {});
    userPadMap = Object.assign({}, DEFAULT_PAD_MAP, s.padBinds && typeof s.padBinds === 'object' ? s.padBinds : {});
    rebuildKeyBitMap();
    if (typeof setStartOpensMenu === 'function') {
      if (emuProfile === 'recorder') {
        setStartOpensMenu(false);
      } else if (typeof s.startOpensMenu === 'boolean') {
        setStartOpensMenu(s.startOpensMenu);
      }
    }
    if (typeof setGameFeaturesEnabled === 'function') {
      if (emuProfile === 'recorder') {
        setGameFeaturesEnabled(false);
      } else if (typeof s.gameFeatures === 'boolean') {
        setGameFeaturesEnabled(s.gameFeatures);
      } else {
        setGameFeaturesEnabled(true);
      }
    }
    if (typeof syncMenuValuesFromRuntime === 'function') syncMenuValuesFromRuntime();
  } finally {
    emuApplying = false;
  }
  if (migrated) emuSettingsChanged();
}

window.addEventListener('message', evt => {
  const d = evt.data;
  if (d && d.command === 'emuSettings') emuApplySettings(d.settings);
});

// Keep focus: Tab does not leave the screen (the pause menu uses Tab for its own tabs).
window.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || typeof keepFocusOnBreak === 'undefined' || !keepFocusOnBreak) return;
  if (typeof isMenuOpen !== 'undefined' && isMenuOpen) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  const screen = document.getElementById('screen');
  if (screen) screen.focus();
}, true);

emuReadConfig();
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('profile-' + emuProfile);
  document.body.classList.toggle('no-game-features', !gameFeaturesEnabled);
});
