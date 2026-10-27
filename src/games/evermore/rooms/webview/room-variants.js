// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the room's variants — who stands in a ROM room per story state
// (default, the outro, Thraxx alive or Coleoptera…), picked on the bar at the
// map's right edge, and showing only that variant's spawns on the map.
//
// The host simulates the enter script (simulation/variants.ts, split on the
// room's enemies) and answers `requestRoomVariants` with `roomVariants`. The
// first answer for a room can take seconds, so the map draws every candidate
// spawn first, as it always did, and narrows once the answer is in.
//
// The bar is the shell's side bar (shellSideBarHtml), the one the Secret of
// Mana and Terranigma editors pick their variants with: 1..n, no "All". It
// rides in the tool pill's wrapper (map-editor-toolbar.js), which is rewritten
// whole, so the markup is built from state here every time. The chosen
// variant's name is in the header (`#rv-name`).
//
// State: _roomVariants (answers by room id), _variantPick (chosen index per
// room id), _variantRoom (the room on screen, or
// null when it has no variants to read). Spawn elements carry `data-at`, the
// placing instruction (svg-spawns.js), which is the variants' key too.
//
// Uses utils.js globals: escH; frame.js: shellSideBarHtml. Uses `vs` (the webview API).

var _roomVariants = {};
var _variantPick = {};
var _variantRoom = null;

var VARIANT_COLOR = 'var(--rg-accent)';

/** Ask for a room's variants, or show the ones already here. Called after each render. */
function requestRoomVariants(room) {
  var id = typeof roomVanillaIdNum === 'function' ? roomVanillaIdNum(room) : null;
  // A custom or converted room has no enter script of the ROM's to read.
  _variantRoom = id == null || id > 0x7e || (room && room.custom) ? null : id;
  renderVariantBar();
  if (_variantRoom == null || _roomVariants[id]) return;
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'requestRoomVariants', roomId: id });
}

/** The host's answer: `{roomId, variants, error?}`. */
function applyRoomVariants(data) {
  var id = Number(data.roomId);
  _roomVariants[id] = { variants: data.variants || [], error: data.error || null };
  // The first variant is the default (the host sorts it first): that is the room as it is met.
  if (_variantPick[id] == null) _variantPick[id] = 0;
  if (_variantRoom === id) renderVariantBar();
}

/** One variant's tooltip: its name, when it happens, who it places. */
function variantTip(v) {
  return v.name + (v.cut ? '\n(the run hit its budget: who is placed is known, what follows may not be)' : '')
    + '\n\nWhen:\n' + v.when.map(function (w) { return '• ' + w; }).join('\n')
    + (v.also.length ? '\n\nSame characters as: ' + v.also.join('; ') : '')
    + '\n\n' + (v.spawns.length ? v.spawns.map(function (s) {
      return s.name + (s.count > 1 ? ' ×' + s.count : '') + (s.x != null ? ' (' + s.x + ',' + s.y + ')' : '')
        + (s.when ? (s.later ? ' — later, once ' : ' — only if ') + s.when : '');
    }).join('\n') : 'Nobody is placed.');
}

/** The bar's markup for the room on screen ('' when it has none). The tool pill's wrapper includes it. */
function buildVariantBarHtml() {
  var id = _variantRoom;
  if (id == null) return '';
  var got = _roomVariants[id];
  var items;
  if (!got) {
    items = [{ text: '…', color: VARIANT_COLOR, disabled: true, tip: 'Reading the enter script…' }];
  } else if (got.error) {
    items = [{ text: '!', color: VARIANT_COLOR, disabled: true, tip: 'Could not simulate this room:\n' + got.error }];
  } else if (!got.variants.length) {
    return '';
  } else {
    var pick = _variantPick[id];
    items = [];
    got.variants.forEach(function (v, i) {
      items.push({ text: String(i + 1), attr: { variant: i }, on: pick === i, color: VARIANT_COLOR, tip: variantTip(v) });
    });
  }
  return shellSideBarHtml({ id: 'rv-bar', cls: 'rg-variant-bar rv-bar', label: 'Variant',
    aria: 'Who stands in this room, per story state', items: items });
}

/** Redraw the bar and the header's name in place, and filter the map to the chosen variant. */
function renderVariantBar() {
  var html = buildVariantBarHtml();
  var bar = document.getElementById('rv-bar');
  if (bar) {
    if (html) bar.outerHTML = html; else if (bar.parentNode) bar.parentNode.removeChild(bar);
  } else if (html) {
    var chrome = document.getElementById('rg-edit-chrome');
    if (chrome) chrome.insertAdjacentHTML('beforeend', html);
  }
  var id = _variantRoom;
  var got = id != null ? _roomVariants[id] : null;
  var name = document.getElementById('rv-name');
  if (name) {
    var v = got && !got.error ? got.variants[_variantPick[id]] : null;
    name.textContent = v ? (_variantPick[id] + 1) + ' · ' + v.name : '';
    name.title = v ? v.name : '';
  }
  applyVariantFilter(id);
}

/** Hide the spawns the chosen variant does not place; dim the ones it places only under a condition. */
function applyVariantFilter(id) {
  var svg = document.getElementById('rg-svg');
  if (!svg) return;
  var got = id != null ? _roomVariants[id] : null;
  var pick = _variantPick[id];
  var v = got && pick != null ? got.variants[pick] : null;
  var placed = null, maybe = null;
  if (v) {
    placed = {}; maybe = {};
    v.spawns.forEach(function (s) { placed[s.at] = true; if (s.when) maybe[s.at] = true; });
  }
  var els = svg.querySelectorAll('.svge-spawn[data-at]');
  for (var i = 0; i < els.length; i++) {
    var at = parseInt(els[i].getAttribute('data-at'), 16);
    els[i].classList.toggle('svge-variant-out', !!placed && !placed[at]);
    els[i].classList.toggle('svge-variant-maybe', !!maybe && !!maybe[at]);
  }
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document && !(t.dataset && t.dataset.variant != null)) t = t.parentNode;
    if (!t || t === document || t.disabled) return;
    var bar = document.getElementById('rv-bar');
    if (!bar || !bar.contains(t) || _variantRoom == null) return;
    _variantPick[_variantRoom] = Number(t.dataset.variant);
    renderVariantBar();
  });
}
