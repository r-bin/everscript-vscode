// Ownership: the Header sub-tab's palette sets — a room whose family list runs
// past seven entries, and previewing the map in another set.
//
// `$90D020` loads seven families starting at the script variable MAP_PALETTE
// (`$7E2437`, 0 when the room loads); a script writing it switches set at run
// time (Thraxx's room goes from orange to white at 7). 22 vanilla rooms store
// 8–14 entries. A short set only replaces the slots it reaches: the rest keep
// the colours the room loaded with. docs/map-format/room-reference.md §5.
//
// Picking a set is a **view**, not an edit: nothing is written, nothing goes on
// the undo history. The host renders it through the same overrides the header
// fields use (map-editor-info.js infoRenderHeader → header-overrides.js).
// The colours and script values come with the palette (rendering/family-sets.js).
//
// Owns: _familySetView ({roomId, start} | null).

var _familySetView = null;

/** The set being previewed for room `id`: its MAP_PALETTE value, 0 for the one it loads with. */
function familySetStart(id) {
  return _familySetView && _familySetView.roomId === id ? _familySetView.start : 0;
}

/** The palette's sets, when the room has any to switch between. */
function familySetsOf(p) {
  return p && !p.customBlank && p.familySets && p.tileFamilies && p.tileFamilies.length > 7 ? p.familySets : null;
}

/** Which family entry each of the seven slots shows with MAP_PALETTE = `start`; `kept` where the set does not reach. */
function familySetSlots(n, start) {
  var count = Math.min(7, n - start), out = [];
  for (var i = 0; i < 7 && i < n; i++) out.push(i < count ? { entry: start + i, kept: false } : { entry: i, kept: true });
  return out;
}

/** The draft's preview families, with the previewed set over them (map-editor-families.js editPreviewFamilies). */
function familySetPreview(families) {
  var p = typeof _mtPalette !== 'undefined' ? _mtPalette : null;
  var start = p ? familySetStart(p.roomId) : 0;
  if (!start || !familySetsOf(p)) return families;
  var out = families.slice();
  familySetSlots(p.tileFamilies.length, start).forEach(function (s, i) {
    if (!s.kept) out[i] = p.tileFamilies[s.entry];
  });
  return out;
}

function familySetStripStyle(colors) {
  var c = colors && colors.length ? colors : ['#000'];
  return 'background:linear-gradient(to right,' + c.join(',') + ')';
}

/** One set as a row: its value, the seven slots' colours, and why it is offered. */
function familySetRowHtml(p, sets, start, why) {
  var on = familySetStart(p.roomId) === start;
  var strips = familySetSlots(p.tileFamilies.length, start).map(function (s, i) {
    return '<i class="rg-fset-strip' + (s.kept ? ' kept' : '') + '" style="' + familySetStripStyle(sets.colors[s.entry])
      + '" title="' + escH('slot ' + (i + 1) + ': family ' + p.tileFamilies[s.entry]
      + (s.kept ? ' — this set does not reach it, so it keeps the colours the room loaded with' : '')) + '"></i>';
  }).join('');
  return '<button class="rg-fset' + (on ? ' on' : '') + '" data-family-set="' + start + '" aria-pressed="' + on + '"'
    + ' title="' + escH('MAP_PALETTE = ' + start + ' — ' + why + '. Click to see the map in it; nothing is written') + '">'
    + '<span class="rg-fset-n">= ' + start + '</span><span class="rg-fset-strips">' + strips + '</span>'
    + '<span class="rg-fset-why">' + escH(why) + '</span></button>';
}

/** The Header sub-tab's palette-set section. */
function familySetsHtml(p) {
  if (!p || !p.tileFamilies || p.customBlank) return '';
  var head = '<div class="rg-info-sec rg-info-fsets"><div class="rg-info-h">Palette sets</div>';
  var sets = familySetsOf(p);
  if (!sets) {
    return head + '<div class="rs-note">One set: this room’s ' + p.tileFamilies.length
      + ' families are all it ever shows. 22 vanilla rooms carry more, for a script to switch to.</div></div>';
  }
  var n = p.tileFamilies.length;
  if (_familySetView && _familySetView.roomId !== p.roomId) _familySetView = null;
  var known = [0].concat((sets.scriptValues || []).filter(function (v) { return v > 0 && v < n; }));
  var html = head + '<div class="rs-note">This room stores ' + n + ' families; the game shows seven at a time, starting at '
    + 'MAP_PALETTE (<code>$7E2437</code>). Click a set to see the map in it.</div>';
  known.forEach(function (v) {
    html += familySetRowHtml(p, sets, v, v === 0 ? 'loads with' : 'a script here sets it');
  });
  var other = [];
  for (var v = 1; v < n; v++) if (known.indexOf(v) < 0) other.push(v);
  if (other.length) {
    html += '<div class="rg-fset-more">other values:' + other.map(function (o) {
      var on = familySetStart(p.roomId) === o;
      return '<button class="rdf rdf-xs' + (on ? ' on' : '') + '" data-family-set="' + o + '" title="'
        + escH('MAP_PALETTE = ' + o + ' — no script in this room sets it (one elsewhere may)') + '">' + o + '</button>';
    }).join('') + '</div>';
  }
  return html + '</div>';
}

/** Show the map in set `start` (0: the one it loads with). Redraws through the header overrides. */
function familySetPick(start) {
  var p = typeof _mtPalette !== 'undefined' ? _mtPalette : null;
  if (!familySetsOf(p) || !(start >= 0 && start < p.tileFamilies.length)) return;
  _familySetView = start ? { roomId: p.roomId, start: start } : null;
  editNote(start ? 'previewing palette set MAP_PALETTE = ' + start + ' — nothing is written' : 'the palette set the room loads with');
  if (typeof infoApplyHeader === 'function') infoApplyHeader();
  renderEditChrome();
}
