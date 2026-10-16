'use strict';

/**
 * emulator/webview/emulator-panels.js
 *
 * Where the emulator's panels are shown. Loaded after emulator-profile.js and before the
 * panel's inline script (panel-webview.js); its functions run later.
 *
 * Panels: CDL, TRACE, STACK, ENTITIES, ALCHEMY, PALETTES (the #ss-view-<name> elements).
 * Each has a pause-menu tab (menu/menu-view.js) that shows it in full, with a placement
 * row on top: hidden, left side bar, right side bar or bottom bar.
 *   - Side bars are drawn over the picture (#emu-side-left / #emu-side-right), as narrow as
 *     their content and at most a third of the screen, in a compact read-only form
 *     (emulator-panels.css). One panel per side: placing a second one hides the first.
 *     Both are hidden while the pause menu is open.
 *   - The bottom bar (#script-stack) has a tab for every panel placed there; with none
 *     placed there is no bottom bar.
 *   - The panel of the open menu tab is moved into that tab and back when the menu
 *     closes or turns to another tab. A panel is one element: it is moved, never copied,
 *     so its update code does not care where it is.
 * REPLAYS lives in the menu only (its tab, its status chip on the screen: tas-view.js).
 *
 * Defaults: CDL in the left side bar, everything else hidden. The placement is saved
 * with the page's other settings (emulator-profile.js, 'panels').
 * Panels that need Evermore (data-needs) are not shown for other ROMs; their placement
 * is kept.
 */

const EMU_PANELS = ['cdl', 'trace', 'stack', 'entities', 'alchemy', 'palettes'];
const EMU_PANEL_TITLES = { cdl: 'CDL', trace: 'TRACE', stack: 'STACK', entities: 'ENTITIES', alchemy: 'ALCHEMY', palettes: 'PALETTES' };
const EMU_PLACES = ['hidden', 'left', 'right', 'bottom'];
const EMU_PLACE_LABELS = { hidden: 'Hidden', left: 'Left side bar', right: 'Right side bar', bottom: 'Bottom bar' };
/** Pause-menu tab of each panel (menu/menu-view.js MENU_TAB_ORDER). */
const EMU_PANEL_MENU_TAB = { cdl: 8, trace: 9, stack: 10, entities: 11, alchemy: 12, palettes: 13 };
const EMU_REPLAYS_MENU_TAB = 7;

function emuDefaultPlaces() {
  const p = {};
  for (const n of EMU_PANELS) p[n] = 'hidden';
  p.cdl = 'left';
  return p;
}

let emuPanelPlace = emuDefaultPlaces();
let emuBottomTab = null;           // the panel shown in the bottom bar
let emuPanelsVisible = new Set();  // panels on screen after the last layout

function emuPanelOfMenuTab(tab) {
  return EMU_PANELS.find(n => EMU_PANEL_MENU_TAB[n] === tab) || null;
}

function emuMenuOpen() {
  return typeof isMenuOpen !== 'undefined' && !!isMenuOpen;
}

function emuRomUp() {
  try { return typeof romLoaded !== 'undefined' && !!romLoaded; } catch (_) { return false; }
}

/** Whether a panel can be seen right now (where it is placed, or in the open menu). */
function emuPanelVisible(name) {
  return emuPanelsVisible.has(name);
}

/** Put every panel where it belongs now. Idempotent; call after anything that changes it. */
function emuPanelsLayout() {
  const stack = document.getElementById('script-stack');
  const left = document.getElementById('emu-side-left');
  const right = document.getElementById('emu-side-right');
  if (!stack || !left || !right) return;
  const menuOpen = emuMenuOpen();
  const menuPanel = menuOpen && typeof menuActiveTab === 'number' ? emuPanelOfMenuTab(menuActiveTab) : null;
  const shown = n => emuShown(document.getElementById('ss-view-' + n));

  const bottom = EMU_PANELS.filter(n => emuPanelPlace[n] === 'bottom' && shown(n));
  if (!bottom.includes(emuBottomTab)) emuBottomTab = bottom[0] || null;

  const before = emuPanelsVisible;
  const visible = new Set();
  const sides = { left: null, right: null };
  for (const n of EMU_PANELS) {
    const view = document.getElementById('ss-view-' + n);
    if (!view) continue;
    const place = emuPanelPlace[n];
    let host = stack, active = false;
    if (n === menuPanel) {
      host = document.getElementById('emu-slot-' + n) || stack;
      active = true;
    } else if (place === 'left' || place === 'right') {
      host = place === 'left' ? left : right;
      active = true;
      if (shown(n)) sides[place] = n;
    } else if (place === 'bottom') {
      active = n === emuBottomTab;
    }
    if (view.parentElement !== host) host.appendChild(view);
    view.classList.toggle('active', active);
    const seen = shown(n) && (n === menuPanel || (place === 'bottom' && active && emuRomUp())
      || ((place === 'left' || place === 'right') && !menuOpen && emuRomUp()));
    if (seen) visible.add(n);
  }
  for (const side of ['left', 'right']) {
    const host = side === 'left' ? left : right;
    const n = sides[side];
    host.classList.toggle('shown', !!n && !menuOpen && emuRomUp());
    host.setAttribute('data-title', n ? EMU_PANEL_TITLES[n] : '');
  }

  for (const n of EMU_PANELS) {
    const btn = document.getElementById('ss-tab-' + n);
    if (!btn) continue;
    btn.style.display = emuPanelPlace[n] === 'bottom' ? '' : 'none';
    btn.classList.toggle('active', n === emuBottomTab);
  }
  const bar = !!bottom.length && emuRomUp();
  const wasBar = stack.classList.contains('visible');
  stack.classList.toggle('visible', bar);
  const resizer = document.getElementById('ss-resizer');
  if (resizer) resizer.style.display = bar ? '' : 'none';
  if (bar !== wasBar) window.dispatchEvent(new Event('resize'));

  for (const n of EMU_PANELS) emuSyncPlaceRow(n);
  emuPanelsVisible = visible;
  for (const n of visible) if (!before.has(n)) emuPanelShown(n);
}

/** A panel just became visible: fill it now instead of on the next tick. */
function emuPanelShown(name) {
  try {
    if (name === 'cdl') { if (typeof cdlOnTabShown === 'function') cdlOnTabShown(); }
    else if (typeof refreshActiveBottomTab === 'function') refreshActiveBottomTab();
  } catch (_) { /* the page is still booting */ }
}

function emuSyncPlaceRow(name) {
  const pill = document.getElementById('menu-val-place-' + name);
  if (pill) {
    const place = emuPanelPlace[name];
    pill.textContent = EMU_PLACE_LABELS[place];
    pill.classList.toggle('active', place !== 'hidden');
  }
}

/** Place a panel. A side holds one panel: the one there before is hidden. */
function emuSetPanelPlace(name, place) {
  if (!EMU_PANELS.includes(name) || !EMU_PLACES.includes(place)) return;
  if (place === 'left' || place === 'right') {
    for (const n of EMU_PANELS) if (n !== name && emuPanelPlace[n] === place) emuPanelPlace[n] = 'hidden';
  }
  emuPanelPlace[name] = place;
  if (place === 'bottom') emuBottomTab = name;
  emuPanelsLayout();
  if (typeof emuSettingsChanged === 'function') emuSettingsChanged();
}

/** The pause menu's placement stepper (clamped, no wrap-around). */
function emuPanelMenuStep(tab, delta) {
  const name = emuPanelOfMenuTab(tab);
  if (!name) return false;
  const i = EMU_PLACES.indexOf(emuPanelPlace[name]);
  const next = Math.max(0, Math.min(EMU_PLACES.length - 1, i + delta));
  if (next === i) return true;
  emuSetPanelPlace(name, EMU_PLACES[next]);
  if (typeof playMenuSound === 'function') playMenuSound('click_nav');
  return true;
}

/** Up / Down on a panel tab of the menu scrolls the panel. */
function emuPanelMenuScroll(tab, delta) {
  const name = tab === EMU_REPLAYS_MENU_TAB ? 'tas' : emuPanelOfMenuTab(tab);
  const slot = name && document.getElementById('emu-slot-' + name);
  if (!slot) return false;
  const all = [slot].concat(Array.from(slot.querySelectorAll('*')));
  const box = all.find(el => el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
  if (box) box.scrollTop += delta * 48;
  return true;
}

function emuSelectBottomTab(name) {
  if (emuPanelPlace[name] !== 'bottom') return;
  emuBottomTab = name;
  emuPanelsLayout();
}

function emuCollectPanels() {
  return Object.assign({}, emuPanelPlace);
}

/** Saved placement (or the defaults when nothing was saved). */
function emuApplyPanels(saved) {
  const p = emuDefaultPlaces();
  if (saved && typeof saved === 'object') {
    for (const n of EMU_PANELS) if (EMU_PLACES.includes(saved[n])) p[n] = saved[n];
    for (const side of ['left', 'right']) {
      const on = EMU_PANELS.filter(n => p[n] === side);
      for (const n of on.slice(1)) p[n] = 'hidden';
    }
  }
  emuPanelPlace = p;
  emuPanelsLayout();
}

document.addEventListener('DOMContentLoaded', () => {
  const tas = document.getElementById('ss-view-tas');
  const tasSlot = document.getElementById('emu-slot-tas');
  if (tas && tasSlot) { tasSlot.appendChild(tas); tas.classList.add('active'); }
  const tabs = document.getElementById('ss-tabs');
  if (tabs) tabs.addEventListener('click', evt => {
    const btn = evt.target && evt.target.closest ? evt.target.closest('.ss-tab') : null;
    if (btn && btn.id.startsWith('ss-tab-')) emuSelectBottomTab(btn.id.slice('ss-tab-'.length));
  });
  emuPanelsLayout();
});
