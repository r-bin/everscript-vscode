// Ownership: the editor's chrome — the tool bar, the docked tile sidebar,
// the metatile composer, and the pointer gestures that drive them.
//
// State is map-editor.js; the map layer is map-editor-paint.js; the palette
// sheet itself is metatile-palette.js, which this file *moves* into the
// sidebar rather than rendering a second copy of.
//
// Owns: _editOrigin, _editComposed, _editCompose (the composer's inputs).

var _editOrigin = { x: 0, y: 0 };
var _editComposed = null;
var _editCompose = { layer1: null, layer2: null, collision: null, pick: 'layer1' };
var _editConstruct = -1;   // which saved construct the stamp tool places

var EDIT_TOOLS = [
  ['paint', 'paint', 'Click or drag to stamp the selected tile'],
  ['erase', 'erase', 'Rub decoration off: the canopy goes blank and the floor’s own collision comes back'],
  ['rect', 'rect', 'Drag a rectangle and fill it with the selected tile'],
  ['pick', 'pick', 'Click the map to select the tile under the cursor'],
  ['copy', 'copy', 'Drag to take a region, then click to stamp it elsewhere'],
  ['move', 'move', 'Drag to take a region, then click to move it; the source is backfilled with the selected tile'],
  ['stamp', 'stamp', 'Click to place the selected construct, with its triggers and objects'],
];

/**
 * The two questions a stroke can answer.
 *
 * Not a cosmetic filter — they write different things. See `editResolve`.
 */
var EDIT_PHASES = [
  ['room', 'room', 'Lay out the place itself: a stroke replaces the floor, the canopy and the collision'],
  ['deco', 'deco', 'Put things on it: a stroke keeps the floor that is already there and only adds what sits over it'],
];

/** The tool bar, shown in the map's own filter row. */
function buildEditButtonHtml() {
  return '<button class="rdf" id="rg-edit-btn" title="Edit the map: draw with the room’s metatiles">edit</button>';
}

function buildEditToolbarHtml() {
  var d = editDraft();
  var html = '<div class="rd-filters rg-edit-bar" id="rg-edit-bar">';
  EDIT_PHASES.forEach(function (ph) {
    html += '<button class="rdf rg-phase' + (d && d.phase === ph[0] ? ' on' : '') + '" data-edit-phase="'
      + ph[0] + '" title="' + escH(ph[2]) + '">' + ph[1] + '</button>';
  });
  html += '<span class="rs-mt-gap"></span>';
  EDIT_TOOLS.forEach(function (t) {
    // Erase only means something once there is a floor to erase back to.
    var off = t[0] === 'erase' && d && d.phase !== 'deco';
    html += '<button class="rdf' + (d && d.tool === t[0] ? ' on' : '') + '" data-edit-tool="' + t[0]
      + '" title="' + escH(off ? t[2] + ' — switch to deco first' : t[2]) + '">' + t[1] + '</button>';
  });
  html += '<span class="rs-mt-gap"></span>'
    + '<button class="rdf" data-edit-act="undo" title="Undo the last change">undo</button>'
    + '<button class="rdf" data-edit-act="redo" title="Redo">redo</button>'
    + '<button class="rdf" data-edit-act="clear" title="Discard every change in this draft">discard</button>'
    + '<span class="rs-mt-gap"></span>'
    + '<button class="rdf" data-edit-act="new-room" title="Start a blank room to try things in, borrowing this room’s graphics">new room</button>'
    + '<button class="rdf" data-edit-act="export" title="Copy the draft as JSON for the encoder">copy draft</button>'
    + '<span class="rg-edit-count" id="rg-edit-count"></span>';
  return html + '</div>';
}

/**
 * Dock the tile palette beside the map.
 *
 * The palette section is moved, not duplicated: one node, one set of
 * handlers, and whichever place it is in shows the same selection.
 */
function editDock(on, room) {
  var outer = document.getElementById('rg-outer');
  var sec = document.getElementById('rs-mt');
  if (!outer || !sec) return;
  var dock = document.getElementById('rg-dock');
  if (on) {
    if (!dock) {
      var row = document.createElement('div');
      row.className = 'rg-edit-row';
      dock = document.createElement('div');
      dock.className = 'rg-dock';
      dock.id = 'rg-dock';
      // The panel column carries the metrics, the family slots, the tile
      // groups, the needed metatiles and the checks — everything that
      // answers "what will this cost" while the palette answers "what can
      // I place".
      var panels = document.createElement('div');
      panels.id = 'rg-panels';
      panels.className = 'rg-panels';
      outer.parentNode.insertBefore(row, outer);
      row.appendChild(outer);
      row.appendChild(dock);
      dock.appendChild(panels);
    }
    dock.appendChild(sec);
    sec.classList.add('rs-mt-docked');
    // Nothing can be painted without the dictionary, so fetch it now
    // rather than making the user find the load button.
    if (!_mtPalette && room) requestMetatilePalette(room, _mtLayer);
    renderEditPanels();
  } else if (dock) {
    var row2 = dock.parentNode;
    sec.classList.remove('rs-mt-docked');
    row2.parentNode.insertBefore(sec, row2.nextSibling);
    dock.parentNode.removeChild(dock);
  }
}

/**
 * The construct library: whole things, not tiles.
 *
 * A construct is a saved rectangle of the map with its stamps *and*
 * whatever triggers and objects sat inside it. That difference is the
 * point — in room 0x34 a gourd is an object at (5,5) 2x2 plus a B-trigger,
 * while the hide on the floor is metatiles and nothing else, so stamping
 * one has to carry more than stamping the other.
 */
function buildConstructsHtml() {
  var d = editDraft();
  if (!d) return '';
  var html = '<div class="rs-mt-compose"><div class="rs-note">'
    + 'Select a region with <b>copy</b> or <b>move</b>, then save it as a construct.'
    + '</div><div class="rd-filters">'
    + '<button class="rdf" data-edit-act="save-construct"'
    + ' title="Save the current selection, with any triggers and objects inside it">'
    + 'save selection</button></div>';
  if (!d.constructs.length) {
    return html + '<div class="rs-note">no constructs yet</div></div>';
  }
  html += '<div class="rg-constructs">';
  for (var i = 0; i < d.constructs.length; i++) {
    var c = d.constructs[i];
    var a = c.attachments || { bTrigger: [], stepOn: [], objects: [] };
    var extras = [];
    if (a.objects.length) extras.push(a.objects.length + ' object' + (a.objects.length === 1 ? '' : 's'));
    if (a.bTrigger.length) extras.push(a.bTrigger.length + ' B-trigger' + (a.bTrigger.length === 1 ? '' : 's'));
    if (a.stepOn.length) extras.push(a.stepOn.length + ' step-on');
    html += '<button class="rdf' + (_editConstruct === i ? ' on' : '') + '" data-construct="' + i + '"'
      + ' title="' + escH(c.w + 'x' + c.h + ', ' + c.cells.length + ' cells'
        + (extras.length ? '\n' + extras.join(', ') : '\nmetatiles only')) + '">'
      + escH(c.name) + ' <span class="rs-note">' + c.w + '×' + c.h
      + (extras.length ? ' +' + extras.length : '') + '</span></button>';
  }
  return html + '</div></div>';
}

/** What each composer source is, in words the sheet above uses. */
var COMPOSE_NAMES = {
  layer1: 'canopy — the part drawn over the character',
  layer2: 'terrain — the ground the character walks on',
  collision: 'collision — where the character may walk',
};

/**
 * The composer: two source words plus a collision word make a new stamp.
 *
 * The canopy and terrain words can come from a raw graphic (the **tiles**
 * view) or from an existing stamp. A collision word cannot — nothing in the
 * graphics says what is solid — so it is always taken from a stamp that
 * already behaves the way the new one should.
 */
function buildComposerHtml() {
  var c = _editCompose;
  var ready = c.layer1 != null && c.layer2 != null;
  var slot = function (key, label) {
    var v = c[key];
    return '<button class="rdf' + (c.pick === key && c.armed ? ' on' : '') + '" data-edit-pick="' + key + '"'
      + ' title="' + escH('Arm this source, then click in the palette to set the '
        + COMPOSE_NAMES[key]) + '">'
      + label + ' ' + (v == null ? '—' : '$' + hex4(v)) + '</button>';
  };

  var hint;
  if (c.armed) {
    hint = c.pick === 'collision'
      ? 'Click a <b>stamp</b> above to copy its collision — graphics carry none.'
      : 'Click a tile in <b>tiles</b>, or a stamp in <b>stamps</b>, to set the '
        + escH(COMPOSE_NAMES[c.pick].split(' — ')[0]) + '.';
  } else if (!ready) {
    hint = 'A stamp needs a canopy word <i>and</i> a terrain word. Press <b>from brush</b> to start '
      + 'from the selected stamp, or arm a source and click a tile.';
  } else {
    hint = '<b>add stamp</b> appends it to the palette and makes it the brush.';
  }

  return '<div class="rs-mt-compose">'
    + '<div class="rs-note">Compose a stamp &mdash; ' + hint + '</div>'
    + '<div class="rd-filters">'
    + slot('layer1', 'canopy') + slot('layer2', 'terrain') + slot('collision', 'collision')
    + '<span class="rs-mt-gap"></span>'
    + '<button class="rdf" data-edit-act="compose-brush"'
    + ' title="Load all three words from the stamp currently selected">from brush</button>'
    + '<button class="rdf" data-edit-act="compose-swap"'
    + ' title="Use the collision of the first stamp that already draws this terrain word">'
    + 'collision = terrain</button>'
    // `.rdf` is dim by default and `.on` is full strength, so lighting the
    // button up is how "this will do something now" reads in this tab.
    + '<button class="rdf' + (ready ? ' on' : '') + '" data-edit-act="compose-add"'
    + ' title="' + escH(ready ? 'Add it to the palette and select it as the brush'
      : 'Set a canopy word and a terrain word first') + '">add stamp</button>'
    + '</div>'
    + '<div id="rg-compose-preview" class="rs-mt-preview"></div>'
    + '</div>';
}

/** Render the composed stamps the draft has added, and the pending preview. */
function renderComposerPreview() {
  var el = document.getElementById('rg-compose-preview');
  if (!el) return;
  var d = editDraft();
  if (!d || !d.added.length) { el.innerHTML = '<span class="rs-note">no composed stamps yet</span>'; return; }
  if (!_editComposed || !_editComposed.imageUri) { el.innerHTML = '<span class="rs-note">rendering…</span>'; return; }
  var base = _mtPalette ? _mtPalette.count : 0;
  var html = '<div class="rs-mt-grid">';
  for (var i = 0; i < _editComposed.count; i++) {
    var x = (i % _editComposed.columns) * _editComposed.cell;
    var y = Math.floor(i / _editComposed.columns) * _editComposed.cell;
    var a = d.added[i];
    html += '<i class="rs-mt-cell' + (d.brush === base + i ? ' sel' : '') + '" data-mt-index="' + (base + i) + '"'
      + ' title="' + escH('composed #' + i + '\ncanopy $' + hex4(a.layer1)
        + '\nterrain $' + hex4(a.layer2) + '\ncollision $' + hex4(a.collision)) + '"'
      + ' style="background-image:url(' + _editComposed.imageUri + ');background-position:-' + x + 'px -' + y + 'px"></i>';
  }
  el.innerHTML = html + '</div>';
}

/** Ask the host to draw the draft's composed stamps against this room. */
function requestComposedPreview() {
  var d = editDraft();
  if (!d || typeof vs === 'undefined' || !vs) return;
  if (!d.added.length) { _editComposed = null; renderComposerPreview(); return; }
  vs.postMessage({
    command: 'requestComposedPreview', roomId: d.roomId, mapName: _mtRoomName,
    layer: _mtLayer, drafts: d.added,
  });
}

function applyComposedPreview(msg) {
  var d = editDraft();
  if (!d || !msg || msg.error || msg.roomId !== d.roomId) { renderComposerPreview(); return; }
  _editComposed = msg.preview;
  renderComposerPreview();
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
}

/** Refresh the parts of the chrome that depend on the draft. */
function renderEditChrome() {
  var d = editDraft();
  var bar = document.getElementById('rg-edit-bar');
  if (bar) {
    bar.outerHTML = buildEditToolbarHtml();
  }
  var count = document.getElementById('rg-edit-count');
  if (count && d) {
    if (!_mtPalette) {
      // Nothing can be drawn before the dictionary arrives, and a dead
      // cursor with no explanation is the worst version of that.
      count.textContent = 'loading the tile palette…';
    } else {
      var n = Object.keys(d.cells).length;
      count.textContent = n + ' cell' + (n === 1 ? '' : 's') + ', ' + d.added.length + ' new stamp'
        + (d.added.length === 1 ? '' : 's')
        + (d.tool === 'erase' ? ' · rubbing out'
          : d.tool === 'stamp' ? (_editConstruct >= 0 ? ' · placing ' + d.constructs[_editConstruct].name
            : ' · save a construct first')
            : d.brush >= 0 ? ' · brush #' + d.brush : ' · pick a tile to draw with');
    }
  }
  renderEditLayer(_mtPalette, _editComposed, _editOrigin);
  renderEditPanels();
}
