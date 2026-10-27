// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the room's variants above the canvas — who stands in a ROM room
// per story state (default, the outro, Thraxx alive or Coleoptera…), and
// showing only that variant's spawns on the map.
//
// The host simulates the enter script (simulation/variants.ts, split on the
// room's enemies) and answers `requestRoomVariants` with `roomVariants`. The
// first answer for a room can take seconds, so the map draws every candidate
// spawn first, as it always did, and narrows once the answer is in.
//
// State: _roomVariants (answers by room id), _variantPick (chosen index per
// room id; -1 is "All", the superset). Spawn elements carry `data-at`, the
// placing instruction (svg-spawns.js), which is the variants' key too.
//
// Uses utils.js globals: escH. Uses `vs` (the webview API).

var _roomVariants = {};
var _variantPick = {};

/** Ask for a room's variants, or show the ones already here. Called after each render. */
function requestRoomVariants(room) {
  var bar = document.getElementById('rv-bar');
  if (!bar) return;
  var id = typeof roomVanillaIdNum === 'function' ? roomVanillaIdNum(room) : null;
  // A custom or converted room has no enter script of the ROM's to read.
  if (id == null || id > 0x7e || (room && room.custom)) { bar.hidden = true; return; }
  bar.dataset.room = String(id);
  bar.hidden = false;
  var have = _roomVariants[id];
  if (have) { renderVariantBar(id); return; }
  bar.innerHTML = '<span class="rv-label">Variants</span><span class="rv-note">reading the enter script…</span>';
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'requestRoomVariants', roomId: id });
}

/** The host's answer: `{roomId, variants, error?}`. */
function applyRoomVariants(data) {
  var id = Number(data.roomId);
  _roomVariants[id] = { variants: data.variants || [], error: data.error || null };
  // The first variant is the default (the host sorts it first): that is the room as it is met.
  if (_variantPick[id] == null) _variantPick[id] = _roomVariants[id].variants.length ? 0 : -1;
  var bar = document.getElementById('rv-bar');
  if (bar && bar.dataset.room === String(id)) renderVariantBar(id);
}

function renderVariantBar(id) {
  var bar = document.getElementById('rv-bar');
  var got = _roomVariants[id];
  if (!bar || !got) return;
  if (got.error) {
    bar.innerHTML = '<span class="rv-label">Variants</span><span class="rv-note" title="' + escH(got.error)
      + '">could not simulate this room</span>';
    applyVariantFilter(id);
    return;
  }
  var pick = _variantPick[id];
  var html = '<span class="rv-label" title="Who stands in this room, per story state: the enter script simulated, '
    + 'split where an enemy depends on a flag, and folded by who is placed.">Variants</span>'
    + '<button class="rdf rv-chip' + (pick === -1 ? ' on' : '') + '" data-variant="-1" title="'
    + escH('Every spawn any branch of the enter script can place') + '">All</button>';
  got.variants.forEach(function (v, i) {
    var tip = v.name + (v.cut ? '\n(the run hit its budget: who is placed is known, what follows may not be)' : '')
      + '\n\nWhen:\n' + v.when.map(function (w) { return '• ' + w; }).join('\n')
      + (v.also.length ? '\n\nSame characters as: ' + v.also.join('; ') : '')
      + '\n\n' + (v.spawns.length ? v.spawns.map(function (s) {
        return s.name + (s.count > 1 ? ' ×' + s.count : '') + (s.x != null ? ' (' + s.x + ',' + s.y + ')' : '')
          + (s.when ? ' — only if ' + s.when : '');
      }).join('\n') : 'Nobody is placed.');
    html += '<button class="rdf rv-chip' + (pick === i ? ' on' : '') + '" data-variant="' + i + '" title="'
      + escH(tip) + '">' + escH(v.name) + ' <span class="rv-count">' + v.spawns.length + '</span></button>';
  });
  bar.innerHTML = html;
  applyVariantFilter(id);
}

/** Hide the spawns the chosen variant does not place; dim the ones it places only under a condition. */
function applyVariantFilter(id) {
  var svg = document.getElementById('rg-svg');
  if (!svg) return;
  var got = _roomVariants[id];
  var pick = _variantPick[id];
  var v = got && pick != null && pick >= 0 ? got.variants[pick] : null;
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
    if (!t || t === document) return;
    var bar = document.getElementById('rv-bar');
    if (!bar || !bar.contains(t)) return;
    var id = Number(bar.dataset.room);
    _variantPick[id] = Number(t.dataset.variant);
    renderVariantBar(id);
  });
}
