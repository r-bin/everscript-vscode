// Ownership: clicks on the editor's *chrome* — the tool bar, the panels,
// the composer — routed to whatever they mean, plus the status line and
// the edit-mode toggle. The map's own pointer gestures are
// map-editor-gestures.js.
//
// Owns: _editPendingNote, _editPanelRoom.

/** A stamp was clicked in the palette or the composer preview. */
function editOnStampPicked(index) {
  var d = editDraft();
  if (!d || !d.on) return false;
  var slot = _editCompose.pick;
  if (slot && _editCompose.armed) {
    var w = editStampWords(_mtPalette, index);
    if (w) _editCompose[slot] = slot === 'collision' ? w.collision : w[slot];
    _editCompose.armed = false;
    renderComposer();
    return true;
  }
  d.brush = index;
  renderEditChrome();
  return false;
}

/**
 * A raw graphic the room already loaded was clicked.
 *
 * Two readings, and the armed composer wins because arming it is an
 * explicit request. Otherwise the click does the thing the inverted flow
 * promises: the tile becomes a stamp you can paint with straight away,
 * with the other two words left empty.
 *
 * The composer still refuses a graphic for the collision slot — a tilemap
 * word says which picture and which family, and nothing about what is
 * solid.
 */
function editOnTilePicked(word) {
  var d = editDraft();
  if (!d || !d.on || word == null) return false;

  if (_editCompose.armed) {
    if (_editCompose.pick === 'collision') {
      editNote('a graphic carries no collision — click a stamp for that');
      return false;
    }
    _editCompose[_editCompose.pick] = word;
    _editCompose.armed = false;
    renderComposer();
    return true;
  }

  var index = editBrushFromTile(_mtPalette, word, d.phase);
  if (index < 0) return false;
  _brushTile = null;   // the room's own sheet marks its selection with _mtSlot
  editArmBrush();
  editNote('brush: stamp #' + index + ' — '
    + (d.phase === 'deco' ? 'drawn over whatever it is painted on' : 'ground, nothing over it')
    + ', no collision yet. Paint on the map.');
  if (index >= _mtPalette.count) requestComposedPreview();
  renderEditChrome();
  return true;
}

/**
 * Say something in the editor's status slot.
 *
 * Held rather than written straight out, because almost every caller goes
 * on to `renderEditChrome`, which rewrites that slot with the cell/brush
 * summary — every explanation this ever produced was overwritten in the
 * same tick. The next render shows the note instead of the summary, once.
 */
var _editPendingNote = '';
function editNote(text) {
  _editPendingNote = text;
  var el = document.getElementById('rg-edit-count');
  if (el) el.textContent = text;
}

/** Redraw just the composer block, keeping the palette sheet untouched. */
function renderComposer() {
  var host = document.getElementById('rg-compose');
  if (!host) return;
  host.innerHTML = buildComposerHtml() + buildConstructsHtml();
  renderComposerPreview();
}

/**
 * Every data attribute a click on this panel can mean.
 *
 * Needed because `e.target` is the *deepest* node under the pointer, which
 * is often a `<span>` inside the button rather than the button. Clicking
 * the caret of a collapsible panel put the span in `e.target`, its dataset
 * was empty, and the panel silently refused to open — proven in a real
 * browser before this walk-up existed.
 */
var EDIT_CLICK_KEYS = ['editTool', 'editPhase', 'editAct', 'editPick', 'panel',
  'famSlot', 'famAdd', 'famPick', 'famPage', 'famTile', 'construct', 'tileSource',
  'deco', 'decoPage', 'decoFlag', 'mtIndex', 'mtSlot'];

/** The nearest ancestor (including `el`) that carries one of those keys. */
function editClickTarget(el, root) {
  for (var n = el; n && n !== root; n = n.parentNode) {
    if (!n.dataset) continue;
    for (var i = 0; i < EDIT_CLICK_KEYS.length; i++) {
      var v = n.dataset[EDIT_CLICK_KEYS[i]];
      if (v !== undefined && v !== '') return n;
    }
  }
  return el;
}

/** The room the delegated handler acts on; re-pointed on every render. */
var _editPanelRoom = null;

/**
 * The editor's own delegated click handler, for the bar and the composer.
 *
 * **Bound once per panel node.** `#room-detail` survives a room re-render —
 * only its `innerHTML` is replaced — so binding again stacks a second
 * handler on the same element and every click fires the handler twice. For
 * a toggle that is a no-op: `edit` turned edit mode on and straight back
 * off, `new room` opened and closed the form. That is exactly what "the
 * edit and new map button work every now and then" was — they worked after
 * an odd number of renders and were dead after an even one, proven in a
 * browser with two binds and four clicks.
 *
 * The room is held in a variable rather than the closure, because the
 * closure is created once and the room changes.
 */
function bindEditControls(panel, room) {
  _editPanelRoom = room;
  if (!panel || panel.dataset.editBound) return;
  panel.dataset.editBound = '1';

  // The family filter is the one text input in the editor. Delegated on
  // `input` so it survives the redraws it causes.
  panel.addEventListener('input', function (e) {
    if (!e.target) return;
    if (e.target.id === 'rg-fam-filter') {
      _famFilter = e.target.value;
      _famPage = 0;   // a new filter starts at the top of its own list
      renderEditPanels();
      return;
    }
    if (e.target.id === 'rg-deco-filter') {
      _decoFilter = e.target.value;
      _decoPage = 0;
      renderEditPanels();
    }
  });

  panel.addEventListener('click', function (e) {
    var t = editClickTarget(e.target, panel);
    if (!t || !t.dataset) return;

    if (t.id === 'rg-edit-btn') { editToggle(_editPanelRoom, t); return; }
    if (t.dataset.editTool) {
      var d = editDraft();
      if (d) { d.tool = t.dataset.editTool; _editSel = null; renderEditChrome(); }
      return;
    }
    if (t.dataset.editPhase) {
      var dp = editDraft();
      if (dp) {
        dp.phase = t.dataset.editPhase;
        // Erase has no meaning while laying the room out, so leaving deco
        // with it selected would arm a tool that does nothing.
        if (dp.phase !== 'deco' && dp.tool === 'erase') dp.tool = 'paint';
        renderEditChrome();
      }
      return;
    }
    if (t.dataset.panel) {
      _panelOpen[t.dataset.panel] = _panelOpen[t.dataset.panel] === false;
      renderEditPanels();
      return;
    }
    if (t.dataset.famSlot !== undefined && t.dataset.famSlot !== '') {
      var slot = Number(t.dataset.famSlot);
      _famOpen = _famOpen === slot ? -1 : slot;
      _famPicking = -1;
      if (_famOpen >= 0) ensureFamilySheet(editFamilies()[_famOpen]);
      renderEditPanels();
      return;
    }
    if (t.dataset.famAdd !== undefined && t.dataset.famAdd !== '') {
      // The same control frees a filled slot and fills an empty one: both
      // are "decide what goes here".
      _famPicking = _famPicking === Number(t.dataset.famAdd) ? -1 : Number(t.dataset.famAdd);
      _famOpen = -1;
      _famPage = 0;
      if (_famPicking >= 0) requestFamilyCatalogue();
      renderEditPanels();
      return;
    }
    if (t.dataset.famPage !== undefined && t.dataset.famPage !== '') {
      _famPage = Number(t.dataset.famPage);
      renderEditPanels();
      return;
    }
    if (t.dataset.famPick) {
      var pick = t.dataset.famPick;
      if (pick === 'clear') editClearFamily(_famPicking);
      else if (pick !== 'none') editSetFamily(_famPicking, Number(pick));
      _famPicking = -1;
      renderEditChrome();
      return;
    }
    if (t.dataset.tileSource) { _tileSource = t.dataset.tileSource; renderEditPanels(); return; }
    if (t.dataset.decoFlag) {
      _decoFlags[t.dataset.decoFlag] = !_decoFlags[t.dataset.decoFlag];
      _decoPage = 0;   // a narrower list starts at the top of its own pages
      renderEditPanels();
      return;
    }
    if (t.dataset.deco) { decoUse(Number(t.dataset.deco)); return; }
    if (t.dataset.decoPage !== undefined && t.dataset.decoPage !== '') {
      _decoPage = Number(t.dataset.decoPage);
      renderEditPanels();
      return;
    }
    if (t.dataset.famTile) {
      // A tile from a family strip: pulls in the family, the graphic, and
      // the metatile that can draw it, all at once.
      editUseFamilyTile(Number(t.dataset.famTile), Number(t.dataset.famOf));
      return;
    }
    if (t.dataset.construct) {
      _editConstruct = Number(t.dataset.construct);
      var dc = editDraft();
      if (dc) dc.tool = 'stamp';
      renderEditChrome();
      renderComposer();
      return;
    }
    if (t.dataset.editPick) {
      _editCompose.pick = t.dataset.editPick;
      _editCompose.armed = true;
      renderComposer();
      return;
    }
    if (t.dataset.editAct) { editAction(t.dataset.editAct); return; }
    // A composed stamp in the preview strip.
    if (t.dataset.mtIndex && t.parentNode && t.parentNode.parentNode
        && t.parentNode.parentNode.id === 'rg-compose-preview') {
      editOnStampPicked(Number(t.dataset.mtIndex));
      renderComposerPreview();
    }
  });
}

/** Turn edit mode on or off for the room on screen. */
function editToggle(room, btn) {
  var id = (typeof roomVanillaIdNum === 'function') ? roomVanillaIdNum(room) : null;
  if (id == null) return;
  var d = editDraft();
  if (!d || d.roomId !== id) d = editReset(id);
  d.on = !d.on;
  if (btn) btn.classList.toggle('on', d.on);
  var panel = document.getElementById('room-detail');
  if (panel) panel.classList.toggle('rg-editing', d.on);
  editDock(d.on, room);

  var bar = document.getElementById('rg-edit-bar');
  if (d.on && !bar) {
    var outer = document.getElementById('rg-outer');
    if (outer) outer.insertAdjacentHTML('afterbegin', buildEditToolbarHtml());
    // The composer lives in the panel column now; renderEditPanels builds
    // it, so there is nothing to inject here.
  } else if (!d.on && bar) {
    bar.parentNode.removeChild(bar);
  }
  renderEditChrome();
}

