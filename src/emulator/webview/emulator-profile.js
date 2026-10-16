'use strict';

/**
 * emulator/webview/emulator-profile.js
 *
 * Loaded before the panel's inline script (panel-webview.js); its functions run
 * later, from that script and from messages.
 *
 * Profile and game:
 *   - The profile ('full' Everscript, 'recorder' SNES CDL Recorder) comes from the
 *     #emu-config JSON block; the body carries it as a class.
 *   - emuGateRom(bytes) runs at every boot: detectEvermore (rom-game.js) sets
 *     emuEvermore and the body class rom-other. Elements marked data-needs are
 *     hidden by emulator-profile.css; Evermore-only work in the inline script
 *     checks emuEvermore. A hidden bottom tab or pause-menu tab is left for the
 *     first one still shown. emuScriptHook (the script stack polling and trace behind
 *     TRACE / STACK and the .evs debugger) needs Evermore and the full profile.
 *
 * Settings (kept by the host in globalState, sent back as 'emuSettings'):
 *   the overlay toggles, master audio mute and the keybinds. Every change posts
 *   'saveEmuSettings' (debounced). Zoom, speed, panel size and tabs are not saved.
 *   Everything optional starts off.
 *
 * Keep focus (pause menu, EMULATION): Tab stays on the emulator screen.
 */

const EMU_LEGACY_KEYBINDS = 'everscript_emulator_keybinds_v1';
const EMU_SAVE_MS = 300;
let emuProfile = 'full';
let emuApplying = false;
let emuSaveTimer = null;

function emuReadConfig() {
  try {
    const el = document.getElementById('emu-config');
    const cfg = el ? JSON.parse(el.textContent || '{}') : {};
    emuProfile = cfg.profile === 'recorder' ? 'recorder' : 'full';
  } catch (_) {
    emuProfile = 'full';
  }
}

/** Whether an element's data-needs words all hold for this profile and ROM. */
function emuShown(el) {
  if (!el) return false;
  const needs = (el.getAttribute('data-needs') || '').split(/\s+/).filter(Boolean);
  return needs.every(n => (n === 'full' ? emuProfile === 'full'
    : n === 'recorder' ? emuProfile === 'recorder'
    : n === 'evermore' ? emuEvermore
    : true));
}

function emuMenuTabShown(index) {
  return emuShown(document.getElementById('menu-tab-btn-' + index));
}

/** The active bottom-bar tab is hidden: show the first one that is not. */
function emuEnsureVisibleTab() {
  const current = typeof currentBottomTab === 'string' ? document.getElementById('ss-tab-' + currentBottomTab) : null;
  if (current && emuShown(current)) return;
  const first = Array.from(document.querySelectorAll('#ss-tabs .ss-tab')).find(emuShown);
  if (first) first.click();
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
  emuEvermore = typeof detectEvermore === 'function' ? detectEvermore(bytes) : true;
  emuScriptHook = emuEvermore && emuProfile === 'full';
  document.body.classList.toggle('rom-other', !emuEvermore);
  if (!emuEvermore) {
    if (typeof lastSampledPreState !== 'undefined') lastSampledPreState = null;
    emuClearExtendedLayers();
  }
  emuEnsureVisibleTab();
  if (typeof menuActiveTab === 'number' && !emuMenuTabShown(menuActiveTab) && typeof selectMenuTab === 'function') selectMenuTab(0);
}

function emuCollectSettings() {
  return {
    version: 1,
    overlays: {
      extend: !!extendMapEnabled,
      triggers: !!triggersOverlayEnabled,
      objects: !!objectsOverlayEnabled,
      anim: !!animTilesOverlayEnabled,
      collision: !!collisionOverlayEnabled,
      fog: !!fogOfWarEnabled,
      sounds: !!sndShow,
      hpBar: !!thinHpBarEnabled,
      staminaBar: !!thinStaminaBarEnabled,
    },
    muted: !!emuMuted,
    keybinds: Object.assign({}, userKeyMap),
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
    const set = (fn, on) => { try { fn(!!on); } catch (_) { /* a layer not ready yet redraws on the next frame */ } };
    set(setExtendMap, o.extend);
    set(setTriggersOverlay, o.triggers);
    set(setObjectsOverlay, o.objects);
    set(setAnimTilesOverlay, o.anim);
    set(setCollisionOverlay, o.collision);
    set(setFogOfWar, o.fog);
    set(sndSetShow, o.sounds);
    set(setThinHpBar, o.hpBar);
    set(setThinStaminaBar, o.staminaBar);
    emuMuted = !!s.muted;
    let binds = s.keybinds && typeof s.keybinds === 'object' ? s.keybinds : null;
    if (!binds) { binds = emuLegacyKeybinds(); migrated = !!binds; }
    userKeyMap = Object.assign({}, DEFAULT_KEY_MAP, binds || {});
    rebuildKeyBitMap();
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
  emuEnsureVisibleTab();
});
