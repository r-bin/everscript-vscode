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
function editOnTilePicked(word, graphicId) {
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

  // Same precedence as editUseFamilyTile, so the two pick paths cannot
  // disagree about the same graphic. Through v0.59.0 this passed no `prefer`
  // at all, which made a raw pick land as ground *unconditionally* — it
  // ignored the Tile tab's `front` segment outright, and ignored the layer
  // vanilla actually draws the graphic on. Neither signal needed fetching:
  // `_famLayerHint` is already populated for the room's own graphics by
  // applyMetatilePalette (metatile-palette.js), off the host's `vanilla[]`
  // rows — the same canopy/terrain counts a family sheet carries.
  var prefer = _layerForce || editLayerPreference(graphicId);
  var index = editBrushFromTile(_mtPalette, word, prefer);
  if (index < 0) return false;
  _brushTile = null;   // the room's own sheet marks its selection with _mtSlot
  editArmBrush();
  editNote('brush: stamp #' + index + ' — '
    + (prefer === 'canopy' ? 'drawn over what it is painted on' : 'ground, nothing over it')
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
var EDIT_CLICK_KEYS = ['editTool', 'editAct', 'editPick', 'panel',
  'famTile', 'construct', 'chip', 'chipDrop', 'chipAdopt',
  'brushFlip', 'tileFilter', 'tileShape', 'tileFrames', 'strandedFix', 'strandedDrop', 'nbSide', 'nbCentre', 'nbUse',
  'layerForce', 'deco', 'decoSave', 'widget', 'widgetEdit', 'widgetAct',
  'objectSel', 'objectToggle', 'objectFrame', 'objectAddFrame', 'objectRemove', 'objectRemoveFrame',
  'objectConfirmRemoveFrame', 'objectCancelRemoveFrame', 'objectMoveFrame', 'objectMoveObj',
  'decoFlag', 'mtIndex', 'mtSlot', 'editActiveTab',
  'editSpecial', 'editSpecialMenu', 'editTriggerMenu', 'editMoreMenu',
  'editToolMenu', 'triggerRef', 'triggerRemove', 'triggerKind', 'editLevel', 'editCollisionMenu', 'collisionMode'];

/**
 * Every dropdown in the editor's chrome that opens a popup of sub-toggles,
 * keyed by the dataset name its own caret carries.
 *
 * One list drives both the open/close toggle and the close-on-outside-click
 * sweep below, so a new dropdown is one entry here plus one key in
 * EDIT_CLICK_KEYS — never a second mechanism. The first three are the filter
 * bar's (map-editor-filterbar.js, map-editor-special.js); the last is the
 * tool pill's `⋯` overflow (map-editor-toolbar.js), which shares the
 * mechanism even though it opens downward instead of up.
 */
var EDIT_FILTER_MENUS = [
  { key: 'editSpecialMenu', id: 'rg-special-dropdown' },
  { key: 'editTriggerMenu', id: 'rg-trigger-dropdown' },
  { key: 'editMoreMenu', id: 'rg-more-dropdown' },
  { key: 'editToolMenu', id: 'rg-tool-dropdown' },
  { key: 'editCollisionMenu', id: 'rg-collision-dropdown' },
];

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

  // The Widgets search is the one text input left in the editor — the Tile
  // tab's family filter went with the add-a-family disclosure (§8a.2).
  // Delegated on `input` so it survives the redraws it causes.
  panel.addEventListener('input', function (e) {
    if (!e.target) return;
    if (e.target.id === 'rg-widget-name') { widgetEditRename(e.target.value); return; }
    if (e.target.id === 'rg-deco-filter') {
      _decoFilter = e.target.value;
      renderEditPanels();
    }
  });

  // Scroll-to-cycle on the neighbour card's sides (map-editor-neighbours.js).
  // Not passive: it has to preventDefault, or the dock scrolls as well.
  // Stop propagation from the dock so the same wheel event is not handled
  // twice when the dock is inside #room-detail.
  panel.addEventListener('wheel', function (e) {
    if (panel.id === 'rg-dock') e.stopPropagation();
    neighbourWheel(e);
  }, { passive: false });

  panel.addEventListener('click', function (e) {
    // The dock contains its own tab panels; when it is nested inside
    // #room-detail the room-detail copy of this listener would otherwise
    // see the same click and toggle state twice.
    if (panel.id === 'rg-dock') e.stopPropagation();
    var t = editClickTarget(e.target, panel);
    if (!t || !t.dataset) return;

    // Every dropdown (Special, Triggers, Objects, more, the pill's ⋯) closes
    // on any click that lands outside it — including a click that goes on to
    // do something else, like painting a cell, which is why this runs before
    // the dispatch below rather than being its own listener. The same list
    // then answers "was this click a caret?", so a new dropdown never needs
    // an `if` block of its own.
    var hitMenu = null;
    EDIT_FILTER_MENUS.forEach(function (m) {
      if (t.dataset[m.key]) hitMenu = m;
      var menu = document.getElementById(m.id);
      if (menu && !menu.hidden && !menu.contains(e.target) && !t.dataset[m.key]) {
        menu.hidden = true;
      }
    });
    if (hitMenu) {
      var open = document.getElementById(hitMenu.id);
      if (open) open.hidden = !open.hidden;
      return;
    }

    if (t.id === 'rg-edit-btn') { editToggle(_editPanelRoom, t); return; }
    if (t.dataset.editSpecial) {
      var ds = editDraft();
      if (ds) {
        // A radio pick, but click-again clears it — the Special tab has no
        // separate "none" chip, and painting nothing is a real intent too.
        ds.currentSpecialId = ds.currentSpecialId === t.dataset.editSpecial ? null : t.dataset.editSpecial;
        editNote(ds.currentSpecialId ? 'special: ' + ds.currentSpecialId + ' armed' : 'special cleared');
        renderEditChrome();
      }
      return;
    }
    if (t.dataset.editTool) {
      var d = editDraft();
      if (d) {
        var fromTool = d.tool;
        d.tool = t.dataset.editTool;
        _editSel = null;
        // A tool change lets go of what is selected (the mock's own rule,
        // docs/map-editor-redesign-plan.md Phase 4) — the Select tool's
        // selection survives picking Select again.
        if (d.tool !== fromTool) editDeselectAll();
        renderEditChrome();
      }
      return;
    }
    if (t.dataset.triggerKind) { triggerKindPick(t.dataset.triggerKind); return; }
    if (t.dataset.editLevel) { editLevelPick(t.dataset.editLevel); return; }
    if (t.dataset.collisionMode) { collisionModeSet(t.dataset.collisionMode); return; }
    if (t.dataset.triggerRef) { triggerSelect(triggerParseRef(t.dataset.triggerRef)); return; }
    if (t.dataset.triggerRemove) {
      triggerSelect(triggerParseRef(t.dataset.triggerRemove));
      triggerDeleteSelected();
      return;
    }
    if (t.dataset.panel) { panelToggle(t.dataset.panel); return; }
    if (t.dataset.editActiveTab) {
      // Leaving a tab drops what was selected on it; the Boy pick is the
      // Special tab's, so it is let go too.
      if (t.dataset.editActiveTab !== _editActiveTab) {
        editDeselectAll();
        var dt = editDraft();
        if (dt && dt.currentSpecialId === START_SPECIAL_ID) dt.currentSpecialId = null;
      }
      _editActiveTab = t.dataset.editActiveTab;
      // The pencil draws the tab's pick, so its badge changes with the tab.
      renderEditChrome();
      return;
    }
    if (t.dataset.chip) { chipToggle(t.dataset.chip); return; }
    if (t.dataset.chipDrop !== undefined && t.dataset.chipDrop !== '') {
      chipDrop(t.dataset.chipDrop);
      return;
    }
    if (t.dataset.chipAdopt) { chipAdopt(t.dataset.chipAdopt); return; }
    if (t.dataset.brushFlip) { brushFlipToggle(t.dataset.brushFlip); return; }
    if (t.dataset.tileFilter) { tileFilterToggle(t.dataset.tileFilter); return; }
    if (t.dataset.tileShape) { tileShapePick(t.dataset.tileShape); return; }
    if (t.dataset.tileFrames) { tileFramesPick(t.dataset.tileFrames); return; }
    if (t.dataset.nbSide) { nbSideClick(t.dataset.nbSide); return; }
    if (t.dataset.nbCentre) { brushLayerToggle(); return; }
    if (t.dataset.nbUse) { nbUse(t.dataset.nbUse); return; }
    if (t.dataset.strandedFix) { strandedFix(t.dataset.strandedFix); return; }
    if (t.dataset.strandedDrop) { strandedDrop(t.dataset.strandedDrop); return; }
    if (t.dataset.layerForce) {
      _layerForce = t.dataset.layerForce === 'auto' ? null : t.dataset.layerForce;
      renderEditPanels();
      return;
    }
    if (t.dataset.decoFlag) {
      _decoFlags[t.dataset.decoFlag] = !_decoFlags[t.dataset.decoFlag];
      renderEditPanels();
      return;
    }
    if (t.dataset.decoSave) { decoSaveAsMine(Number(t.dataset.decoSave)); return; }
    if (t.dataset.deco) { decoUse(Number(t.dataset.deco)); return; }
    // The user's own widgets: arm, edit, and the tab's actions (map-editor-widgets.js).
    if ((t.dataset.widget || t.dataset.widgetEdit || t.dataset.widgetAct) && widgetClick(t)) return;
    if ((t.dataset.objectSel || t.dataset.objectRemove || t.dataset.objectToggle
        || t.dataset.objectFrame || t.dataset.objectAddFrame || t.dataset.objectRemoveFrame
        || t.dataset.objectConfirmRemoveFrame || t.dataset.objectCancelRemoveFrame
        || t.dataset.objectMoveFrame || t.dataset.objectMoveObj) && objectClick(t)) return;
    if (t.dataset.famTile) {
      // A tile from a family strip: pulls in the family, the graphic, and
      // the metatile that can draw it, all at once. The redraw keeps this
      // tile's group where it is on screen, even if adopting the family
      // moves it up the list (map-editor-panels.js's panelScrollAnchor).
      _tileAnchorFam = Number(t.dataset.famOf);
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

  var chrome = document.getElementById('rg-edit-chrome');
  if (d.on && !chrome) {
    // Inside the canvas card, not above it: the pill is positioned against
    // the card's own top edge (map-editor-canvas.css), so it has to be a
    // descendant of the node that establishes that containing block.
    // #rg-outer is the fallback for a room with no canvas at all.
    var host = document.getElementById('rg-canvas-card') || document.getElementById('rg-outer');
    if (host) host.insertAdjacentHTML('afterbegin', buildEditToolbarHtml());
    // The composer lives in the panel column now; renderEditPanels builds
    // it, so there is nothing to inject here.
  } else if (!d.on && chrome) {
    chrome.parentNode.removeChild(chrome);
  }
  renderEditChrome();
}

