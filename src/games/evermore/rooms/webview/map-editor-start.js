// Ownership: the Boy's start marker on a drafted map — where it goes when
// the map is made, how it is drawn, and the Special-tab pick that moves it.
//
// A level editor's "debug entrance": the one place a new map is entered
// from. So it is always on the map and exactly once — placed when the blank
// room arrives, moved (never added) by the `start` pick, clamped back inside
// on a resize, and immune to erase, because it is not a cell or a special
// (map-editor.js's `_edit.start`, moved only by editMoveStart).
//
// Only a drafted map has one. A ROM room is entered through its doors,
// which the map already draws as arrivals; a second, invented entrance
// there would be a control for something that does not exist.
//
// Not in the JSON draft (entrances are room metadata, not tile-grid state,
// map-editor-rules §6) — but Export ROM uses it: it is where the intro's
// `load_map` puts the Boy (map-editor-rom-export.js, rom-export.js).
//
// Selecting him: the Select tool (or the Special tab's Boy pick) — a click
// on him selects and highlights him, a drag moves him (one undo step, the
// gesture's own), and selecting anything else, leaving the tab, a tool
// change or Escape deselects him (editDeselectAll, map-editor-input.js).
//
// Owns: _startSprite, _startSel, _startDrag.

/** The special-catalog id of the pick that moves the marker. */
var START_SPECIAL_ID = 'start';

/**
 * The Boy facing south, from the host (room-draft.js's `boySprite`):
 * `{uri, w, h, ox, oy}` in pixels, or null to draw the glyph instead.
 */
var _startSprite = null;
/** The Boy is selected (highlighted); `_startDrag` is `{dx, dy}` while he is dragged. */
var _startSel = false;
var _startDrag = null;

/** His cell, or the one above it, where his sprite's head is. */
function startHit(cell) {
  var d = editDraft();
  return !!(d && d.start && cell.x === d.start.x && (cell.y === d.start.y || cell.y === d.start.y - 1));
}

/**
 * The Select tool on the Boy: down on him selects him, a drag moves him.
 * Returns true when the gesture was his.
 */
function startSelectGesture(cell, phase) {
  var d = editDraft();
  if (!d || !d.start) return false;
  if (phase === 'down') {
    if (!startHit(cell)) { _startSel = false; _startDrag = null; return false; }
    if (typeof editDeselectAll === 'function') editDeselectAll();
    _startSel = true;
    _startDrag = { dx: cell.x - d.start.x, dy: cell.y - d.start.y };
    editNote('the Boy is selected — drag him to move him');
    renderEditChrome();
    return true;
  }
  if (!_startDrag) return false;
  var x = Math.max(0, Math.min(_mtPalette.widthTiles - 1, cell.x - _startDrag.dx));
  var y = Math.max(0, Math.min(_mtPalette.heightTiles - 1, cell.y - _startDrag.dy));
  editMoveStart(x, y);
  if (phase === 'up') _startDrag = null;
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
  return true;
}

/** He is highlighted when selected, and while the Special tab's Boy pick is armed. */
function startHighlighted() {
  var d = editDraft();
  return _startSel || !!(d && d.currentSpecialId === START_SPECIAL_ID
    && typeof _editActiveTab !== 'undefined' && _editActiveTab === 'special');
}

/**
 * Put the marker on a freshly drafted or resized map.
 *
 * A new map gets it in the middle — somewhere, per the rule, and the least
 * arbitrary somewhere. A resize keeps it where it was, pulled back inside if
 * the edge moved past it: the marker cannot fall off the map.
 */
function editStartPlace(room, sprite) {
  var d = editDraft();
  if (!d || !room) return;
  if (sprite !== undefined) _startSprite = sprite || null;
  // A widget's canvas is not a room: nobody starts in it (map-editor-widget-edit.js).
  if (typeof widgetEditing === 'function' && widgetEditing() && d.customKey === _widgetEdit.key) { d.start = null; return; }
  var w = room.widthTiles;
  var h = room.heightTiles;
  if (!d.start) {
    d.start = { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    return;
  }
  d.start = { x: Math.min(d.start.x, w - 1), y: Math.min(d.start.y, h - 1) };
}

/**
 * Handle a paint gesture while the `start` pick is armed. Returns true when
 * it did — the gesture is then the marker's, and paints nothing.
 *
 * Down and move both move it, so the marker can be dragged as well as
 * clicked into place.
 */
function editStartGesture(cell, phase) {
  var d = editDraft();
  if (!d || d.currentSpecialId !== START_SPECIAL_ID) return false;
  if (!d.start) return true;
  if (phase === 'down' || phase === 'move') {
    if (editMoveStart(cell.x, cell.y)) renderEditChrome();
  }
  return true;
}

/**
 * The marker, in map units, for renderEditLayer.
 *
 * The sprite's origin is at its feet (svg-spawns.js places every character
 * that way), so the feet go a little above the bottom of the cell — where
 * the Boy stands when he occupies it — and the art overhangs the row above,
 * as a character does. The cell itself is outlined so the tile the marker
 * means is not a guess.
 */
function editStartSvg(origin) {
  var d = editDraft();
  if (!d || !d.start) return '';
  var pos = editCellPos(origin, d.start.x, d.start.y);
  var tip = 'Boy start (' + d.start.x + ',' + d.start.y + ') — where this map is entered from.'
    + '\nSelect him and drag to move him. He cannot be removed.';
  var html = '<g class="rg-start' + (startHighlighted() ? ' sel' : '') + '" pointer-events="none">'
    + '<rect class="rg-start-cell" x="' + pos.x + '" y="' + pos.y + '" width="' + EDIT_UNITS
    + '" height="' + EDIT_UNITS + '"/>';
  var s = _startSprite;
  if (s) {
    var unit = MAP_UNIT_PX;
    var fx = pos.x + EDIT_UNITS / 2;
    var fy = pos.y + EDIT_UNITS * 0.85;
    html += '<image class="rg-start-sprite" href="' + s.uri + '" x="' + (fx - s.ox / unit)
      + '" y="' + (fy - s.oy / unit) + '" width="' + (s.w / unit) + '" height="' + (s.h / unit)
      + '" style="image-rendering:pixelated" preserveAspectRatio="none"/>';
  } else {
    var fs = EDIT_UNITS * 0.8;
    html += '<text class="rg-start-glyph" x="' + (pos.x + EDIT_UNITS / 2) + '" y="'
      + (pos.y + EDIT_UNITS / 2 + fs * 0.35) + '" text-anchor="middle" font-size="' + fs + '">☺</text>';
  }
  return html + '<title>' + escH(tip) + '</title></g>';
}

/**
 * Take the donor room's scenery off a blank map.
 *
 * svg-builder drew the room the draft borrowed from — its NPCs (which is
 * how Strongheart stood in every "new map"), the doors into it, its
 * triggers and markers. None of that belongs to the new map; the donor
 * lends graphics and families, nothing else. Removed rather than hidden, so
 * no filter chip can bring it back.
 */
var DONOR_SCENERY = ['.svge-spawn', '.svge-arrival', '.svge-step', '.svge-btrig',
  '.svge-enemy', '.svge-entrance', '.svge-poi'];

function editClearDonorScenery() {
  var svg = document.getElementById('rg-svg');
  if (!svg) return;
  var gone = svg.querySelectorAll(DONOR_SCENERY.join(','));
  for (var i = 0; i < gone.length; i++) {
    if (gone[i].parentNode) gone[i].parentNode.removeChild(gone[i]);
  }
}
