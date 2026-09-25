// Ownership: the Trigger tab's list UI — step/B trigger rows with a
// position+crop preview, click-to-select, and a remove button — plus the
// two trigger counts shown on the Info tab.
//
// The trigger model (which triggers exist, hit-testing, select/move/delete/
// copy-paste) is map-editor-trigger-select.js; this file only renders what
// that model reports, the same split as map-editor-special.js (model +
// bit math) vs. this tab's sibling panels in map-editor-panels.js.
//
// No confirmed per-room trigger-count ceiling exists to draw a "x/16" bar
// against — docs/map-format/rom-map.md's step/B tables are byte-length
// prefixed (`step_len`/`b_len`), not count-limited, and no maximum trigger
// count is attested anywhere in docs/map-format/. The design mock's own
// "x/16" is its placeholder state, not ROM evidence, so the count is shown
// with no denominator, the same honest shape `map-editor-panels.js` already
// uses for the "stamps" budget row ("no field limit").

/**
 * A small crop of the room's own rendered picture, showing where a trigger's
 * box sits — reusing the image `svg-builder.js` already loaded into `#rg-img`
 * (`_editPanelRoom.imageUri`/`.imageDims`) rather than a second image
 * pipeline, the same crop-by-background-position technique
 * `renderComposerPreview` (map-editor-ui.js) already uses for a stamp swatch.
 */
function triggerCropStyle(t) {
  var room = _editPanelRoom;
  var img = room && room.imageUri;
  if (!img || !_mtPalette || !_mtPalette.widthTiles || !_mtPalette.heightTiles) return '';
  var dims = room.imageDims || {};
  var iw = dims.width || _mtPalette.widthTiles * 16;
  var ih = dims.height || _mtPalette.heightTiles * 16;
  var cellW = iw / _mtPalette.widthTiles;
  var cellH = ih / _mtPalette.heightTiles;
  var boxW = Math.max(1, (t.x2 - t.x1 + 1) * cellW);
  var boxH = Math.max(1, (t.y2 - t.y1 + 1) * cellH);
  var previewH = 32;
  var zoom = previewH / boxH;
  var previewW = Math.max(20, Math.min(96, boxW * zoom));
  return 'width:' + previewW.toFixed(1) + 'px;height:' + previewH + 'px;'
    + 'background-image:url(' + img + ');'
    + 'background-size:' + (iw * zoom).toFixed(1) + 'px ' + (ih * zoom).toFixed(1) + 'px;'
    + 'background-position:-' + (t.x1 * cellW * zoom).toFixed(1) + 'px -' + (t.y1 * cellH * zoom).toFixed(1) + 'px;';
}

/** The room-source name for a base trigger, or a synthetic one for a placed trigger. */
function triggerRowName(t, kind) {
  if (t.origin === 'placed') return 'placed #' + t.uid;
  var room = _editPanelRoom;
  var names = room && room.content && room.content.triggerNames && room.content.triggerNames[triggerDataKind(kind)];
  return (names && names[t.index]) || ('#' + t.index);
}

function triggerRowHtml(t, kind) {
  var d = editDraft();
  var sel = d && triggerRefsEqual(d.selectedTriggerRef, t.ref);
  var refStr = t.ref.kind + ':' + t.ref.id;
  return '<div class="rg-trigger-row' + (sel ? ' on' : '') + '" data-trigger-ref="' + escH(refStr) + '">'
    + '<i class="rg-trigger-crop" style="' + triggerCropStyle(t) + '"></i>'
    + '<span class="rg-trigger-info"><code>' + escH(triggerRowName(t, kind)) + '</code>'
    + '<span class="rs-note">[' + t.x1 + ',' + t.y1 + ':' + t.x2 + ',' + t.y2 + ']'
    + (typeof t.scriptId === 'number' ? ' script 0x' + Number(t.scriptId).toString(16) : '') + '</span></span>'
    + '<button class="rdf rg-trigger-remove" data-trigger-remove="' + escH(refStr) + '" title="Remove this trigger">×</button>'
    + '</div>';
}

function triggerSectionHtml(kind) {
  var list = editTriggerList(kind);
  if (!list.length) return '<div class="rs-note">none yet — drag a box on the map with the pencil</div>';
  var html = '<div class="rg-trigger-list">';
  list.forEach(function (t) { html += triggerRowHtml(t, kind); });
  return html + '</div>';
}

/** The kinds, in order: B-triggers first, the default. */
var TRIGGER_SUBTABS = [
  ['b', 'B-triggers', 'Run when the Boy presses B facing them — a sign, a chest, a person'],
  ['step', 'Step-on triggers', 'Run when the Boy walks onto them — a door, a cutscene zone'],
];

/**
 * Trigger tab body: a tab per kind at the top. The open one is what the
 * pencil draws (map-editor-drawable.js's `_editTriggerKind`) and the one
 * listed below — select, move, delete, copy/paste (map-editor-trigger-select.js,
 * map-editor-gestures.js).
 */
function triggerTabPanelHtml() {
  var kind = typeof _editTriggerKind !== 'undefined' ? _editTriggerKind : 'b';
  var html = '<div class="rg-subtabs" role="tablist">';
  TRIGGER_SUBTABS.forEach(function (t) {
    html += '<button class="rg-subtab rg-trigger-kind rg-trigger-kind-' + t[0] + (kind === t[0] ? ' on' : '')
      + '" role="tab" aria-selected="' + (kind === t[0]) + '" data-trigger-kind="' + t[0] + '" title="' + escH(t[2]) + '">'
      + '<b>' + (t[0] === 'b' ? 'B' : 'S') + '</b> ' + escH(t[1])
      + ' <span class="rs-note">' + editTriggerList(t[0]).length + '</span></button>';
  });
  return html + '</div>'
    + '<div class="rs-note">The pencil drags out a new one. Select tool: click one to select it, drag its '
    + 'own cells to move it, Delete to remove, Cmd/Ctrl+C/V to copy — or click a row.</div>'
    + triggerSectionHtml(kind);
}

// The filter bar's Triggers chip used to live here (Phase 6's
// `buildTriggerFilterChipHtml`). Phase 7a moved it to
// map-editor-filterbar.js along with the whole bar's arrangement, because it
// grew sub-toggles this file has no business knowing about — the ROM trigger
// overlay (rom-overlay.js's `t` flag) and the two grid overlays. It carried
// no model of its own, unlike the Trigger tab's list below, so nothing was
// lost by the move: `hide-trigger`/`hide-step`/`hide-btrig` are the same
// shared.css keys they always were.

/**
 * The Info tab's two trigger counts — see file header for why there is no
 * ceiling to bar-chart against.
 */
function triggerCapacityHtml() {
  var step = editTriggerList('step').length;
  var b = editTriggerList('b').length;
  var title = 'No per-room trigger-count ceiling is attested — the ROM field is a byte length, not a count';
  return '<div class="rs-mt-detail rs-mt-budget">'
    + '<span class="rs-mt-f" title="' + escH(title) + '"><b>step triggers</b> ' + step
    + ' <span class="rs-note">no confirmed limit</span></span>'
    + '<span class="rs-mt-f" title="' + escH(title) + '"><b>B-triggers</b> ' + b
    + ' <span class="rs-note">no confirmed limit</span></span>'
    + '</div>';
}
