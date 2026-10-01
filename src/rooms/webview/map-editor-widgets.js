// Ownership: the user's own widgets — the library every map shares (on the
// host: `<globalStorage>/widgets.json`, rooms/data/widget-store.js) and the
// Widgets tab that lists them first.
//
// The tab is one scrolling list:
//   - My widgets: yours, each with ✎ to edit it on its own canvas
//     (map-editor-widget-edit.js), plus "+ New widget" and "+ From
//     selection" (the copy tool's region or a selected stamped object);
//   - Vanilla (map-editor-deco.js), only while the `vanilla` toggle is on:
//     532 objects cut automatically out of vanilla rooms. Generated, so hit
//     and miss — ☆ keeps a good one as your own.
//
// A widget is portable (map-editor-constructs.js): cells as `{graphic,
// family, flags}` per layer, `null` for "keep the floor", with the
// collision, triggers and objects that come with it. Clicking one arms the
// Widgets pencil; each stamp is one object on the map (map-editor-groups.js)
// on the level of the floor it lands on.
//
// Two views, a tab each: Library (the above) and Placed — the widgets
// stamped on this map, in draw order (map-editor-placed-list.js).
//
// Owns: _widgets (null until loaded), _widgetArt, _widgetsVanilla, _widgetsView.

var _widgets = null;
var _widgetsAsked = false;
/** id -> `{uri, x, y}` in a thumbnail sheet (map-editor-deco.js applyDecoPreviews). */
var _widgetArt = {};
/** Show the generated vanilla library too. Off by default; remembered in uiPrefs. */
var _widgetsVanilla = false;
/** Which half of the tab is showing: 'library' (what you can stamp) or 'placed' (what you stamped). */
var _widgetsView = 'library';

function requestWidgets() {
  if (_widgetsAsked || typeof vs === 'undefined' || !vs) return;
  _widgetsAsked = true;
  vs.postMessage({ command: 'requestWidgets' });
}

function applyWidgets(msg) {
  if (!msg) return;
  _widgets = msg.widgets || [];
  if (msg.saved) delete _widgetArt[msg.saved];
  if (msg.deleted && widgetEditing(msg.deleted)) { _widgetEdit.pending = null; widgetEditClose(); }
  if (typeof editActive === 'function' && editActive()) renderEditPanels();
}

function widgetFind(id) {
  for (var i = 0; i < (_widgets || []).length; i++) if (_widgets[i].id === id) return _widgets[i];
  return null;
}

function widgetNewId() {
  return 'w-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function widgetNextName() {
  var n = 1;
  (_widgets || []).forEach(function (w) {
    var k = /^Widget (\d+)$/.exec(w.name);
    if (k) n = Math.max(n, Number(k[1]) + 1);
  });
  return 'Widget ' + n;
}

/** Keep a widget: in the list now, on the host for good. */
function widgetStore(w) {
  if (!_widgets) _widgets = [];
  var at = -1;
  _widgets.forEach(function (x, i) { if (x.id === w.id) at = i; });
  if (at >= 0) _widgets[at] = w; else _widgets.push(w);
  delete _widgetArt[w.id];
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'saveWidget', widget: w });
}

/** A widget as the stamp machinery's construct. */
function widgetConstruct(w, varIdx) {
  var v = (w.variations && w.variations.length)
    ? (w.variations[varIdx != null ? varIdx : (w.activeVariation || 0)] || w.variations[0])
    : null;
  var frames = (v && v.frames) || [{ cells: w.cells || [], delay: 8 }];
  var baseCells = (frames[0] && frames[0].cells) || w.cells || [];
  var attach = Object.assign({}, w.attachments || { bTrigger: [], stepOn: [], objects: [] });
  if (frames.length > 1) {
    attach.objects = (attach.objects || []).slice();
    var objFrames = frames.slice(1).map(function (f) { return f.cells; });
    attach.objects.push({
      dx: 0, dy: 0, w: w.w, h: w.h,
      states: frames.length,
      cells: frames[0].cells,
      frames: objFrames,
      delays: frames.map(function (f) { return f.delay || 8; }),
    });
  }
  var varName = (v && v.name && v.name !== 'A') ? ' (' + v.name + ')' : '';
  return {
    name: w.name + varName,
    w: w.w, h: w.h,
    cells: baseCells,
    attachments: attach,
    widget: w.id,
    variation: v ? v.id : null,
    delays: frames.map(function (f) { return f.delay || 8; }),
  };
}

/** Arm a widget: the Widgets pencil stamps it. */
function widgetArm(id, varIdx) {
  var d = editDraft();
  var w = widgetFind(id);
  if (!d || !w) return;
  if (varIdx != null && varIdx >= 0) w.activeVariation = varIdx;
  d.constructs.push(widgetConstruct(w, varIdx));
  _editConstruct = d.constructs.length - 1;
  if (typeof _decoPick !== 'undefined') _decoPick = -1;
  d.tool = 'paint';
  var v = (w.variations && w.variations[w.activeVariation || 0]);
  var vName = (v && v.name && v.name !== 'A') ? ' (' + v.name + ')' : '';
  var frames = (v && v.frames) || [];
  var cells = (frames[0] && frames[0].cells) || w.cells || [];
  var animText = frames.length > 1 ? ' (' + frames.length + ' animation frames)' : '';
  var a = w.attachments || {};
  var extras = [];
  if ((a.bTrigger || []).length) extras.push((a.bTrigger.length === 1 ? 'a B-trigger' : a.bTrigger.length + ' B-triggers'));
  if ((a.stepOn || []).length) extras.push('step triggers');
  if ((a.objects || []).length) extras.push((a.objects.length === 1 ? 'an object' : a.objects.length + ' objects'));
  editNote('armed ' + w.name + vName + ' — ' + cells.length + ' cell' + (cells.length === 1 ? '' : 's')
    + animText + (extras.length ? ' with ' + extras.join(', ') : '') + '. Click the map to place it; it lands on the level of the floor there.');
  requestComposedPreview();
  renderEditChrome();
}

/** The tile families vanilla pairs with these graphics across the ROM. */
function widgetAttestedFamilies(cells) {
  var gMap = {};
  (cells || []).forEach(function (c) {
    if (c.canopy && c.canopy.graphic != null) gMap[c.canopy.graphic] = true;
    if (c.terrain && c.terrain.graphic != null) gMap[c.terrain.graphic] = true;
  });
  var keys = Object.keys(gMap).map(Number);
  if (!keys.length) return null;
  // Prehistoria gourds: smooth 3736..3741 or ribbed 3867..3871
  if (keys.some(function (g) { return (g >= 3736 && g <= 3741) || (g >= 3867 && g <= 3871); })) {
    return [166, 184, 35, 33, 58, 199, 83, 203, 7, 115];
  }
  // Antiqua urns / pots: 643..648
  if (keys.some(function (g) { return g >= 643 && g <= 648; })) {
    return [115, 35, 127, 139, 159, 188, 158];
  }
  // Gothica barrels / pots: 1895, 1897
  if (keys.some(function (g) { return g === 1895 || g === 1897; })) {
    return [60, 329];
  }
  // Omnitopia canisters: 17, 20
  if (keys.some(function (g) { return g === 17 || g === 20; })) {
    return [220, 0, 227, 231];
  }
  return null;
}

function widgetEnsureVariations(w) {
  if (!w || (w.variations && w.variations.length > 1)) return;
  var fams = widgetAttestedFamilies(w.cells);
  if (fams && fams.length > 1) {
    w.variations = fams.map(function (fam) {
      return {
        id: 'fam-' + fam,
        name: '#' + fam,
        frames: [{
          cells: (w.cells || []).map(function (c) {
            return {
              dx: c.dx, dy: c.dy,
              canopy: c.canopy ? { graphic: c.canopy.graphic, family: fam, flags: c.canopy.flags || 0 } : null,
              terrain: c.terrain ? { graphic: c.terrain.graphic, family: fam, flags: c.terrain.flags || 0 } : null,
              collision: c.collision,
            };
          }),
          delay: 8,
        }],
      };
    });
  }
}

/** ☆ on a vanilla card, once its cells arrived (map-editor-deco.js applyDecoCells). */
function widgetSaveFromDeco(entry, name) {
  var fams = widgetAttestedFamilies(entry.cells);
  var variations = [];
  if (fams && fams.length > 1) {
    variations = fams.map(function (fam) {
      return {
        id: 'fam-' + fam,
        name: '#' + fam,
        frames: [{
          cells: (entry.cells || []).map(function (c) {
            return {
              dx: c.dx, dy: c.dy,
              canopy: c.canopy ? { graphic: c.canopy.graphic, family: fam, flags: c.canopy.flags || 0 } : null,
              terrain: c.terrain ? { graphic: c.terrain.graphic, family: fam, flags: c.terrain.flags || 0 } : null,
              collision: c.collision,
            };
          }),
          delay: 8,
        }],
      };
    });
  }
  var w = {
    id: widgetNewId(), name: name, w: entry.w, h: entry.h, cells: entry.cells,
    variations: variations.length ? variations : undefined,
    attachments: {
      bTrigger: entry.trigger ? [entry.trigger] : [], stepOn: [],
      objects: [{ dx: 0, dy: 0, w: entry.w, h: entry.h, states: entry.states, cells: entry.stateCells || [] }],
    },
    source: { deco: entry.id, room: entry.room },
  };
  widgetStore(w);
  editNote('kept as your widget “' + name + '” — ✎ edits it');
  renderEditChrome();
}

/** "+ From selection": the selected stamped object, or the copy tool's region, as a new widget. */
function widgetSaveFromSelection() {
  var d = editDraft();
  if (!d) return;
  var g = typeof _groupSel !== 'undefined' && _groupSel != null ? editGroupFind(_groupSel) : null;
  var sel = g ? { x1: g.x, y1: g.y, x2: g.x + g.w - 1, y2: g.y + g.h - 1 } : _editSel;
  if (!sel) { editNote('select a region with the copy tool, or a stamped object, first'); renderEditChrome(); return; }
  var name = g ? g.name : widgetNextName();
  if (!_mtPalette) { editNote('metatiles still loading — try again in a moment'); renderEditChrome(); return; }
  // A stamped object keeps its own cells, not the floor it sits on.
  var c = g ? editGroupConstruct(_mtPalette, g) : editBuildConstruct(_mtPalette, sel, name);
  if (!c) { editNote('nothing painted there to keep'); renderEditChrome(); return; }
  if (!g) {
    var placed = widgetPlacedIn(d, sel);
    ['bTrigger', 'stepOn', 'objects'].forEach(function (k) { c.attachments[k] = (c.attachments[k] || []).concat(placed[k]); });
  }
  widgetStore({ id: widgetNewId(), name: name, w: c.w, h: c.h, cells: c.cells, attachments: c.attachments });
  editNote('kept ' + c.w + '×' + c.h + ' as your widget “' + name + '” — ✎ edits it');
  renderEditChrome();
  renderEditPanels();
}

function widgetHasSelection() {
  return (typeof _groupSel !== 'undefined' && _groupSel != null) || !!_editSel;
}

/** A click the Widgets tab owns (map-editor-input.js). */
function widgetClick(t) {
  if (t.dataset.widgetArmVar !== undefined) {
    widgetArm(t.dataset.widget, Number(t.dataset.widgetArmVar));
    return true;
  }
  if (t.dataset.widgetEdit) { widgetEditOpen(t.dataset.widgetEdit); return true; }
  if (t.dataset.widget) { widgetArm(t.dataset.widget); return true; }
  var act = t.dataset.widgetAct;
  if (act === 'library' || act === 'placed') { _widgetsView = act; renderEditPanels(); return true; }
  if (act === 'vanilla') {
    _widgetsVanilla = !_widgetsVanilla;
    if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'saveUiPref', key: 'widgetsVanilla', value: _widgetsVanilla });
    renderEditPanels();
    return true;
  }
  if (act === 'new') { widgetEditNew(2, 2); return true; }
  if (act === 'selection') { widgetSaveFromSelection(); return true; }
  if (act === 'done') { widgetEditClose(); return true; }
  if (act === 'delete' && _widgetEdit && typeof vs !== 'undefined' && vs) {
    vs.postMessage({ command: 'deleteWidget', id: _widgetEdit.widget, name: _widgetEdit.name });
    return true;
  }
  if (t.dataset.widgetVar !== undefined) {
    if (typeof widgetSelectVar === 'function') widgetSelectVar(Number(t.dataset.widgetVar));
    return true;
  }
  var varAct = t.dataset.widgetVarAct;
  if (varAct === 'add') { if (typeof widgetAddVar === 'function') widgetAddVar(); return true; }
  if (varAct === 'dup') { if (typeof widgetDuplicateVar === 'function') widgetDuplicateVar(); return true; }
  if (varAct === 'del') { if (typeof widgetRemoveVar === 'function') widgetRemoveVar(_widgetVarIdx); return true; }
  if (varAct === 'recolor') { if (typeof widgetSwapFamily === 'function') widgetSwapFamily(); return true; }
  var seek = t.dataset.widgetSeek;
  if (seek === 'play') { if (typeof widgetTogglePlay === 'function') widgetTogglePlay(); return true; }
  if (seek === 'prev') { if (typeof widgetSelectFrame === 'function') widgetSelectFrame(_widgetFrameIdx - 1); return true; }
  if (seek === 'next') { if (typeof widgetSelectFrame === 'function') widgetSelectFrame(_widgetFrameIdx + 1); return true; }
  if (seek === 'add') { if (typeof widgetAddFrame === 'function') widgetAddFrame(false); return true; }
  if (seek === 'clone') { if (typeof widgetAddFrame === 'function') widgetAddFrame(true); return true; }
  if (seek === 'del') { if (typeof widgetRemoveFrame === 'function') widgetRemoveFrame(_widgetFrameIdx); return true; }
  return false;
}

/** Thumbnails for the user's widgets and their variations that have none yet. */
function ensureWidgetPreviews() {
  if (typeof vs === 'undefined' || !vs || !_widgets) return;
  var want = [];
  _widgets.forEach(function (w) {
    if (typeof widgetEnsureVariations === 'function') widgetEnsureVariations(w);
    if (!_widgetArt[w.id] && !_decoAsked['w:' + w.id]) {
      _decoAsked['w:' + w.id] = true;
      want.push({ id: w.id, w: w.w, h: w.h, cells: w.cells });
    }
    (w.variations || []).forEach(function (v) {
      var vKey = w.id + ':' + v.id;
      if (!_widgetArt[vKey] && !_decoAsked['w:' + vKey]) {
        _decoAsked['w:' + vKey] = true;
        var vCells = (v.frames && v.frames[0] && v.frames[0].cells) || w.cells || [];
        want.push({ id: vKey, w: w.w, h: w.h, cells: vCells });
      }
    });
  });
  if (!want.length) return;
  vs.postMessage({ command: 'requestDeco', widgets: want.slice(0, 48) });
}

function widgetCardHtml(w) {
  var a = w.attachments || {};
  var armed = _editConstruct >= 0 && editDraft() && editDraft().constructs[_editConstruct]
    && editDraft().constructs[_editConstruct].widget === w.id;
  var trig = (a.bTrigger || []).length + (a.stepOn || []).length;
  var objs = (a.objects || []).length;
  if (typeof widgetEnsureVariations === 'function') widgetEnsureVariations(w);
  var vars = w.variations || [];
  var hasVars = vars.length > 1;
  var curV = vars[w.activeVariation || 0] || vars[0];
  var frames = (curV && curV.frames) || [];
  var isAnim = frames.length > 1;

  var animBadge = isAnim ? ' · ▶ ' + frames.length + 'f' : '';
  var varBadge = hasVars ? ' · ' + vars.length + 'v' : '';
  var activeArt = (curV && _widgetArt[w.id + ':' + curV.id]) || _widgetArt[w.id];

  return '<button class="rg-deco rg-widget-card' + (armed ? ' on rg-armed' : '') + (trig ? ' rg-deco-live' : '')
    + '" data-widget="' + escH(w.id) + '" title="' + escH(w.name + ' — ' + w.w + '×' + w.h + ', ' + w.cells.length
      + ' cells' + (hasVars ? '\n' + vars.length + ' variations' : '') + (isAnim ? '\n' + frames.length + ' animation frames' : '')
      + (trig ? '\n' + trig + ' trigger' + (trig === 1 ? '' : 's') : '') + (objs ? '\n' + objs + ' object' + (objs === 1 ? '' : 's') : '')
      + '\nclick to arm the pencil · ✎ to edit') + '">'
    + '<i class="rg-deco-art" data-widget-art="' + escH(w.id) + '" style="' + (typeof decoArtStyle === 'function' ? decoArtStyle(activeArt) : '') + '"></i>'
    + '<span class="rg-deco-keep" role="button" data-widget-edit="' + escH(w.id) + '" title="Edit this widget">✎</span>'
    + '<span class="rg-deco-tag">' + escH(w.name) + '</span>'
    + '<span class="rg-deco-warn">' + w.w + '×' + w.h + varBadge + animBadge + (trig ? ' · ⚡' : '') + (objs ? ' · ◆' : '') + '</span>'
    + '</button>';
}

/** The Widgets tab: Library | Placed. */
function widgetsTabHtml() {
  var d = editDraft();
  var placed = ((d && d.groups) || []).length;
  var tabs = [['library', 'Library', (_widgets || []).length, 'The widgets you can stamp'],
    ['placed', 'Placed', placed, 'The widgets stamped on this map, in draw order']];
  var html = '<div class="rg-subtabs" role="tablist">' + tabs.map(function (t) {
    var on = _widgetsView === t[0];
    return '<button class="rg-subtab' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '" data-widget-act="' + t[0]
      + '" title="' + escH(t[3]) + '">' + t[1] + ' <span class="rs-note">' + t[2] + '</span></button>';
  }).join('') + '</div>';
  return html + (_widgetsView === 'placed' ? placedListHtml() : widgetsLibraryHtml());
}

/** The Library view: your widgets, and the generated vanilla ones while that is on. */
function widgetsLibraryHtml() {
  requestWidgets();
  ensureWidgetPreviews();
  var list = _widgets || [];
  var html = '<div class="rg-widget-top">'
    + '<button class="rdf' + (_widgetsVanilla ? ' on' : '') + '" data-widget-act="vanilla" aria-pressed="' + _widgetsVanilla
    + '" title="Also list the 532 widgets generated from vanilla rooms — cut out automatically, so whether one '
    + 'is any good is luck">vanilla</button>'
    + '<span class="rs-note">' + (_widgetsVanilla ? 'yours and the generated vanilla ones' : 'yours only') + '</span></div>'
    + '<div class="rg-widget-group"><div class="rg-widget-h">My widgets <span class="rs-note">— ' + list.length + '</span></div>'
    + '<div class="rg-deco-grid">'
    + '<button class="rg-deco rg-widget-add" data-widget-act="new" title="A new, empty widget on its own 2×2 canvas">'
    + '<span class="rg-widget-plus">+</span><span class="rg-deco-tag">New widget</span></button>'
    + '<button class="rg-deco rg-widget-add" data-widget-act="selection"' + (widgetHasSelection() ? '' : ' disabled')
    + ' title="Keep the copy tool\'s region, or the selected stamped object, as a widget — with its triggers and objects">'
    + '<span class="rg-widget-plus">⬚</span><span class="rg-deco-tag">From selection</span></button>'
    + list.map(widgetCardHtml).join('') + '</div>'
    + (list.length ? '' : '<div class="rs-note">none yet — make one, keep a selection, or turn on vanilla and ☆ one.</div>')
    + '</div>';
  if (_widgetsVanilla) html += '<div class="rg-widget-h rg-widget-h-vanilla">Vanilla <span class="rs-note">— generated</span></div>'
    + decoLibraryHtml();
  return html;
}
