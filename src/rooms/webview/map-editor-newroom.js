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
    + '<label>w <input type="number" id="rg-nr-w" min="2" max="128" value="' + CUSTOM_MAP_W + '"></label>'
    + '<label>h <input type="number" id="rg-nr-h" min="2" max="128" value="' + CUSTOM_MAP_H + '"></label>'
    + '<button class="rdf on" data-edit-act="new-room-go"'
    + ' title="A new custom map. This room lends its graphics and families; nothing of it is drawn.">create</button>'
    + '<button class="rdf" data-edit-act="new-room-cancel">cancel</button>'
    + (here ? '<span class="rs-note">showing a blank ' + here.widthTiles + '×' + here.heightTiles
      + ' room</span>' : '')
    + '</div>';
}

/** The format's own bounds: 2 is the smallest grid that encodes, 128 is past
 *  the widest vanilla room (`0x3c`, at 127). */
var NEW_ROOM_MIN = 2;
var NEW_ROOM_MAX = 128;

function clampRoomSide(n, fallback) {
  return Math.max(NEW_ROOM_MIN, Math.min(NEW_ROOM_MAX, Number(n) || fallback));
}

/** Ask the host to draw a blank grid, borrowing this room's graphics. */
function requestBlankRoom(w, h) {
  if (typeof vs === 'undefined' || !vs) return;
  vs.postMessage({
    command: 'requestBlankRoom', mapName: _mtRoomName,
    widthTiles: w, heightTiles: h, borrowFrom: _mtRoomId,
  });
}

/**
 * Read the form and make a custom map that size, drawing with the graphics
 * of the room on screen — a new entry under Custom rooms, never a draft
 * laid over the room it borrows from.
 */
function editNewRoomGo() {
  var wEl = document.getElementById('rg-nr-w');
  var hEl = document.getElementById('rg-nr-h');
  var w = clampRoomSide(wEl && wEl.value, CUSTOM_MAP_W);
  var h = clampRoomSide(hEl && hEl.value, CUSTOM_MAP_H);
  _newRoomOpen = false;
  customNew(w, h, typeof _mtRoomId === 'number' ? _mtRoomId : undefined);
}

// ---------------------------------------------------------------------------
// `> everscript new map` / `+ New Map`
// ---------------------------------------------------------------------------

/**
 * Make a new custom map, one SNES screen big, and open it.
 *
 * Since v0.63.0 this is a room of its own under Custom rooms
 * (map-editor-custom.js), not a draft over Strong Heart's Hut: "you can only
 * be in the vanilla room list if you are a vanilla room".
 */
function roomsNewMap() {
  customNew(CUSTOM_MAP_W, CUSTOM_MAP_H);
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
  // The viewBox is the room exactly. It used to keep svg-builder's 8-unit
  // floor, which draws grid lines past the edge of a small room — a 2x2
  // room came out looking like a 4x4 one with twelve empty cells.
  var viewW = unitsW;
  var viewH = unitsH;

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

  regridMap(unitsW, unitsH);

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
 * Redraw the grid for a room of this size.
 *
 * svg-builder bakes both grid paths from the room it rendered, so swapping
 * the picture underneath leaves the previous room's lines behind. That is
 * what "2x2 shows 4x4 tiles" was: the old room's grid, clipped to the new
 * viewBox. Same spacing as the builder — 1 unit is one 8px tile, 2 units
 * one 16px metatile.
 */
function regridMap(unitsW, unitsH) {
  var path = function (step) {
    var d = '';
    for (var x = 0; x <= unitsW; x += step) d += 'M' + x + ' 0V' + unitsH;
    for (var y = 0; y <= unitsH; y += step) d += 'M0 ' + y + 'H' + unitsW;
    return d;
  };
  var fine = document.querySelector('.rg-grid-fine');
  var coarse = document.querySelector('.rg-grid-coarse');
  if (fine) fine.setAttribute('d', path(1));
  if (coarse) coarse.setAttribute('d', path(2));
}

// ---------------------------------------------------------------------------
// Resizing the canvas
// ---------------------------------------------------------------------------

/** The drag in progress, or null. */
var _resizing = null;
/** Keep the cells that still fit when the next blank room arrives. */
var _resizeKeep = false;

function buildResizeHandleHtml() {
  return '<div class="rg-resize" id="rg-resize" title="Drag to resize the map"></div>'
    + '<div class="rg-resize-label" id="rg-resize-label"></div>';
}

/** Begin a resize. Returns false when there is nothing to resize. */
function resizeStart(e) {
  if (!_mtPalette) return false;
  _resizing = {
    x: e.clientX, y: e.clientY,
    w0: _mtPalette.widthTiles, h0: _mtPalette.heightTiles,
    w: _mtPalette.widthTiles, h: _mtPalette.heightTiles,
  };
  resizeLabel();
  return true;
}

/**
 * Track the drag, in tiles.
 *
 * The pointer moves in screen pixels and the map is drawn at whatever zoom
 * the panel gave it, so the conversion is the rendered box divided by the
 * tile count — not a constant, which would drift the moment the panel is a
 * different width.
 */
function resizeMove(e) {
  if (!_resizing) return;
  var svg = document.getElementById('rg-svg');
  if (!svg) return;
  var box = svg.getBoundingClientRect();
  var perX = box.width / _resizing.w0;
  var perY = box.height / _resizing.h0;
  _resizing.w = clampRoomSide(Math.round(_resizing.w0 + (e.clientX - _resizing.x) / perX), _resizing.w0);
  _resizing.h = clampRoomSide(Math.round(_resizing.h0 + (e.clientY - _resizing.y) / perY), _resizing.h0);
  resizeLabel();
}

/**
 * What the size costs, live.
 *
 * The grid and the dictionary share one 32768-byte window, and the grid term
 * is `w * h * 2`, so a resize is a budget decision. The fullest vanilla room
 * uses 32680 of it.
 */
function resizeLabel() {
  var el = document.getElementById('rg-resize-label');
  if (!el || !_resizing) return;
  var stamps = editStampCount(_mtPalette);
  var wram = _resizing.w * _resizing.h * 2 + stamps * 8;
  var max = (_mtPalette.budget && _mtPalette.budget.wram.max) || 32768;
  var lost = resizeLostCells(_resizing.w, _resizing.h);
  el.textContent = _resizing.w + '×' + _resizing.h + ' · ' + wram + '/' + max + ' bytes'
    + (lost ? ' · drops ' + lost + ' cell' + (lost === 1 ? '' : 's') : '');
  el.className = 'rg-resize-label' + (wram > max ? ' over' : '');
  el.style.display = 'block';
}

/** Cells the draft has drawn that would fall outside a `w`×`h` grid. */
function resizeLostCells(w, h) {
  var d = editDraft();
  if (!d) return 0;
  var n = 0;
  Object.keys(d.cells).forEach(function (k) {
    var p = k.split(',');
    if (Number(p[0]) >= w || Number(p[1]) >= h) n += 1;
  });
  return n;
}

/**
 * Commit the drag.
 *
 * Only a drafted map resizes. A ROM room's picture is the ROM's, and the
 * editor has no way to re-render a different grid of it — but the real
 * reason to refuse is `baseMetatile === w * h * 2`: the dictionary starts
 * straight after the grid, so a resize renumbers **every** metatile id in
 * the room. The draft survives that because it stores dictionary indices
 * and only becomes ids at export; a ROM room on screen would not.
 */
function resizeEnd() {
  var r = _resizing;
  _resizing = null;
  var el = document.getElementById('rg-resize-label');
  if (el) el.style.display = 'none';
  if (!r || (r.w === r.w0 && r.h === r.h0)) return;

  var d = editDraft();
  if (!d || !d.blank) {
    editNote('only a drafted map resizes — the dictionary starts right after the grid, '
      + 'so resizing a ROM room renumbers every metatile in it. Use “new room” first.');
    renderEditChrome();
    return;
  }
  _resizeKeep = true;
  editNote('resizing to ' + r.w + '×' + r.h + '…');
  requestBlankRoom(r.w, r.h);
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
  // A resize keeps what still fits — it is a change of canvas, not a new
  // drawing. Anything outside the new bounds is gone, which is why the drag
  // says how many cells that is before the mouse comes up.
  if (_resizeKeep) {
    Object.keys(d.cells).forEach(function (k) {
      var p = k.split(',');
      if (Number(p[0]) >= room.widthTiles || Number(p[1]) >= room.heightTiles) delete d.cells[k];
    });
    _resizeKeep = false;
  } else {
    d.cells = {};
    d.start = null; // a new drawing — editStartPlace re-centres the Boy below
  }
  d.undo = [];
  d.redo = [];
  _newRoomOpen = false;
  // Exactly one Boy start, on the map — placed now, or pulled back inside
  // by a resize (map-editor-start.js).
  editStartPlace(room, room.startSprite);

  if (_mtPalette) {
    // `null`, not `0`. The host filled this room with its own empty stamp
    // (maps/blank-room.ts's `emptyStamp`), which is **not** the donor's
    // dictionary entry 0 — and entry 0 is what a grid of zeroes would make
    // `editCellAt` answer. That mismatch was visible: painting a front-badged
    // tile onto a "blank" map composed it over the donor's entry-0 terrain,
    // so background art the user never drew appeared under it. A null cell
    // reads back as -1, which every consumer already handles as "nothing
    // here": editResolve lays the brush down as composed, erase finds nothing
    // to erase, and the pick tool has nothing to pick. Nothing exports the
    // grid (editExport only emits `_edit.cells`), so this stays client-side.
    var row = [];
    for (var x = 0; x < room.widthTiles; x++) row.push(null);
    var grid = [];
    for (var y = 0; y < room.heightTiles; y++) grid.push(row.slice());
    _mtPalette = Object.assign({}, _mtPalette, {
      grid: grid,
      widthTiles: room.widthTiles,
      heightTiles: room.heightTiles,
      baseMetatile: room.baseMetatile,
      budget: room.budget,
      // The donor's triggers and objects are its own, not the new map's —
      // left in, the Trigger tab listed Strongheart's Hut's.
      attachments: { bTrigger: [], stepOn: [], objects: [] },
    });
  }

  resizeMapTo(room);
  editClearDonorScenery();
  _editOrigin = { x: 0, y: 0 };
  customNoteBlank(room);
  if (typeof draftCollisionSoon === 'function') draftCollisionSoon();

  editNote('empty ' + room.widthTiles + '×' + room.heightTiles
    + ' room — nothing drawn; room 0x' + room.borrowedFrom.toString(16)
    + ' lends the graphics and families, not the picture'
    + (room.problems.length ? ' — ' + room.problems.length + ' problem(s)' : ''));
  renderEditChrome();
}
