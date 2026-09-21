// Ownership: drafting a room that is not in the ROM.
//
// `window.prompt` does not exist in a VS Code webview — calling it is
// silently inert, which is exactly how the first version of this failed.
// So the size is asked for with an inline form instead.
//
// Owns: _newRoomOpen.
//
// See docs/map-format/building-a-room-from-a-picture.md §7.

var _newRoomOpen = false;

/** Toggle the form. Nothing is drafted until `create` is pressed. */
function editNewRoom() {
  _newRoomOpen = !_newRoomOpen;
  renderEditChrome();
}

/**
 * The form, shown above the map while it is open.
 *
 * The bounds are the format's: two tiles is the smallest grid that encodes,
 * and 128 is past the widest vanilla room (`0x3c` at 127).
 */
function buildNewRoomHtml() {
  if (!_newRoomOpen) return '';
  var d = editDraft();
  var here = d && d.blank;
  return '<div class="rg-newroom" id="rg-newroom">'
    + '<span class="rs-note">New room, in 16px tiles:</span>'
    + '<label>w <input type="number" id="rg-nr-w" min="2" max="128" value="16"></label>'
    + '<label>h <input type="number" id="rg-nr-h" min="2" max="128" value="12"></label>'
    + '<button class="rdf on" data-edit-act="new-room-go"'
    + ' title="Draft it, borrowing this room’s graphics and families">create</button>'
    + '<button class="rdf" data-edit-act="new-room-cancel">cancel</button>'
    + (here ? '<span class="rs-note">showing a blank ' + here.widthTiles + '×' + here.heightTiles
      + ' room</span>' : '')
    + '</div>';
}

/** Read the form and ask the host for the room. */
function editNewRoomGo() {
  if (typeof vs === 'undefined' || !vs) return;
  var wEl = document.getElementById('rg-nr-w');
  var hEl = document.getElementById('rg-nr-h');
  var w = Math.max(2, Math.min(128, Number(wEl && wEl.value) || 16));
  var h = Math.max(2, Math.min(128, Number(hEl && hEl.value) || 12));
  editNote('drafting a ' + w + '×' + h + ' room…');
  vs.postMessage({
    command: 'requestBlankRoom', mapName: _mtRoomName,
    widthTiles: w, heightTiles: h, borrowFrom: _mtRoomId,
  });
}

/** The SVG's coordinate system: one unit is one 8px tile, so a metatile is 2. */
var MAP_UNIT_PX = 8;
/** svg-builder clamps the viewBox to this, so a tiny room is not blown up. */
var MIN_VIEW_UNITS = 8;
/** The display width svg-builder uses; matching it keeps the zoom honest. */
var MAP_DISP_W = 520;
var MAP_DISP_H_MAX = 600;

/**
 * Point the map at a different room, at the right size.
 *
 * Everything inside `#rg-svg` is in **viewBox units of 8px**, not pixels —
 * the image included. Setting the image's width to its pixel width made a
 * 2x2 room eight times too big, which is what the "very weird grid" was:
 * a magnified corner of the floor with the 1-unit grid lines drawn across
 * it. The viewBox also has svg-builder's 8-unit floor, or a small room
 * would fill the panel at absurd magnification.
 */
function resizeMapTo(room) {
  var unitsW = room.widthTiles * 2;
  var unitsH = room.heightTiles * 2;
  var viewW = Math.max(unitsW, MIN_VIEW_UNITS);
  var viewH = Math.max(unitsH, MIN_VIEW_UNITS);

  var img = document.getElementById('rg-img');
  if (img) {
    img.setAttribute('href', room.imageUri);
    img.setAttribute('x', 0);
    img.setAttribute('y', 0);
    img.setAttribute('width', unitsW);
    img.setAttribute('height', unitsH);
  }
  // A blank room has no canopy or collision overlay yet; leaving the old
  // room's stretched across it would be scenery from somewhere else.
  ['rg-fg', 'rg-canopy-ov'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.setAttribute('href', '');
  });

  var svg = document.getElementById('rg-svg');
  var dispH = Math.min(MAP_DISP_H_MAX, Math.round(MAP_DISP_W * viewH / viewW));
  if (svg) {
    svg.setAttribute('viewBox', '0 0 ' + viewW + ' ' + viewH);
    svg.setAttribute('width', MAP_DISP_W);
    svg.setAttribute('height', dispH);
  }
  ['rg-wrap', 'rg-canvas'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.style.width = MAP_DISP_W + 'px'; el.style.height = dispH + 'px'; }
  });
}

/**
 * The host drew a blank room. Show it in place of the map.
 *
 * The draft keeps pointing at the room whose graphics were borrowed, so the
 * palette, the families and the budget all stay meaningful; only the
 * picture and the grid are the new room's. The palette's `grid` is replaced
 * too, or `editCellAt` would answer with the old room's cells and the whole
 * editor would be working against a map that is no longer on screen.
 */
function applyBlankRoom(msg) {
  if (!msg || msg.error) { editNote(msg && msg.error ? msg.error : 'could not draft a room'); return; }
  var d = editDraft();
  if (!d) return;
  var room = msg.room;
  d.blank = room;
  d.cells = {};
  d.undo = [];
  d.redo = [];
  _newRoomOpen = false;

  if (_mtPalette) {
    var row = [];
    for (var x = 0; x < room.widthTiles; x++) row.push(0);
    var grid = [];
    for (var y = 0; y < room.heightTiles; y++) grid.push(row.slice());
    _mtPalette = Object.assign({}, _mtPalette, {
      grid: grid,
      widthTiles: room.widthTiles,
      heightTiles: room.heightTiles,
      baseMetatile: room.baseMetatile,
      budget: room.budget,
    });
  }

  resizeMapTo(room);
  _editOrigin = { x: 0, y: 0 };

  editNote('blank ' + room.widthTiles + '×' + room.heightTiles
    + ' room, borrowing room 0x' + room.borrowedFrom.toString(16) + '’s graphics'
    + (room.problems.length ? ' — ' + room.problems.length + ' problem(s)' : ''));
  renderEditChrome();
}
