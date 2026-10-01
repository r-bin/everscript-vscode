// Ownership: drafting a room that is not in the ROM.
//
// A new custom map is made from the rail's `+ New Map` (roomsNewMap) at one
// SNES screen, and resized from the map's own corner grip.
//
// Owns: _resizing, _resizeKeep.
//
// See docs/map-format/building-a-room-from-a-picture.md §7.

/** The format's own bounds: 2 is the smallest grid that encodes, 128 is past
 *  the widest vanilla room (`0x3c`, at 127). */
var NEW_ROOM_MIN = 2;
var NEW_ROOM_MAX = 128;

function clampRoomSide(n, fallback) {
  var v = Number(n);
  return Math.max(editMinSide(), Math.min(NEW_ROOM_MAX, isFinite(v) && n !== '' && n != null ? v : fallback));
}

/** A widget's canvas is never encoded as a room, so it goes down to 1×1. */
function editMinSide() {
  return typeof widgetEditing === 'function' && widgetEditing() ? 1 : NEW_ROOM_MIN;
}

/** Ask the host to draw a blank grid, borrowing this room's graphics. */
function requestBlankRoom(w, h) {
  if (typeof vs === 'undefined' || !vs) return;
  vs.postMessage({
    command: 'requestBlankRoom', mapName: _mtRoomName,
    widthTiles: w, heightTiles: h, borrowFrom: _mtRoomId, minTiles: editMinSide(),
  });
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
  // The viewport fills the editor (rooms-layout.css): fit the new extent to it.
  if (typeof _zoomRefit === 'function' && _zoomRefit) _zoomRefit();
  editPlaceResizeGrip();
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
    + (lost ? ' · hides ' + lost + ' cell' + (lost === 1 ? '' : 's') + ' (kept)' : '');
  el.className = 'rg-resize-label' + (wram > max ? ' over' : '');
  el.style.display = 'block';
  // The new size itself, outlined over the map (map-editor-preview.js).
  if (typeof resizePreviewSync === 'function') resizePreviewSync();
}

/**
 * The grip on the map's own bottom-right corner, wherever the zoom put it:
 * in percent of the canvas, which is the viewBox at the current scale. Only a
 * drafted (custom) map resizes, and not while it is locked.
 */
function editPlaceResizeGrip() {
  var grip = document.getElementById('rg-resize');
  if (!grip) return;
  var d = editDraft();
  var svg = document.getElementById('rg-svg');
  var img = document.getElementById('rg-img');
  var vb = svg && svg.viewBox && svg.viewBox.baseVal;
  var ok = d && d.blank && !editLocked() && vb && vb.width && img;
  grip.style.display = ok ? '' : 'none';
  if (!ok) return;
  var right = Number(img.getAttribute('x')) + Number(img.getAttribute('width'));
  var bottom = Number(img.getAttribute('y')) + Number(img.getAttribute('height'));
  var at = { left: ((right - vb.x) / vb.width * 100) + '%', top: ((bottom - vb.y) / vb.height * 100) + '%' };
  // Anchored by its own corner (the grip) or its right edge beside the grip (the label).
  [[grip, 'translate(-100%,-100%)'], [document.getElementById('rg-resize-label'), 'translate(calc(-100% - 18px),-100%)']]
    .forEach(function (e) {
      if (!e[0]) return;
      e[0].style.left = at.left; e[0].style.top = at.top;
      e[0].style.right = 'auto'; e[0].style.bottom = 'auto'; e[0].style.transform = e[1];
    });
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
  if (typeof resizePreviewSync === 'function') resizePreviewSync();
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
  // A resize is a change of canvas, not a new drawing. Cells past a smaller
  // map's edge are kept in the draft — undrawn, and not encoded: the ROM
  // export reads the grid, the JSON export skips them — so making it bigger
  // again brings them back. The drag says how many it hides.
  if (_resizeKeep) {
    _resizeKeep = false;
  } else {
    d.cells = {};
    d.cut = {};
    d.start = null; // a new drawing — editStartPlace re-centres the Boy below
    d.undo = [];
    d.redo = [];
  }
  // A reopened or resized map keeps its history: it is kept for good
  // (docs/map-format/custom-map-files.md §3).
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
      // Still keyed by the donor's roomId, so without this mark opening the
      // donor as a vanilla room kept this palette — the custom map's grid,
      // size and families on a ROM room (mtPaletteFits).
      customBlank: true,
    });
  }

  resizeMapTo(room);
  editClearDonorScenery();
  _editOrigin = { x: 0, y: 0 };
  customNoteBlank(room);
  if (typeof draftCollisionSoon === 'function') draftCollisionSoon();
  // A reopened map's own stamps need their pictures: without this its cells
  // stayed blank until a tile pick happened to ask for the sheet.
  if (d.added.length) requestComposedPreview();

  editNote('empty ' + room.widthTiles + '×' + room.heightTiles
    + ' room — nothing drawn; room 0x' + room.borrowedFrom.toString(16)
    + ' lends the graphics and families, not the picture'
    + (room.problems.length ? ' — ' + room.problems.length + ' problem(s)' : ''));
  renderEditChrome();
}
