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

function triggerSectionHtml(kind, label) {
  var list = editTriggerList(kind);
  var html = '<div class="rg-trigger-section"><div class="rg-panel-h">' + escH(label)
    + ' <span class="rs-note">' + list.length + '</span></div>';
  if (!list.length) return html + '<div class="rs-note">none yet</div></div>';
  html += '<div class="rg-trigger-list">';
  list.forEach(function (t) { html += triggerRowHtml(t, kind); });
  return html + '</div></div>';
}

/**
 * Trigger tab body: step and B sections, each a list of selectable,
 * removable rows. Click-select here or on the canvas share one selection
 * (`_edit.selectedTriggerRef`) and one Select-tool gesture set — see
 * map-editor-trigger-select.js and map-editor-gestures.js.
 */
function triggerTabPanelHtml() {
  return '<div class="rs-note">Select tool: click a trigger to select it, drag its own '
    + 'cells to move it, Delete to remove, Cmd/Ctrl+C/V to copy — or click a row below.</div>'
    + triggerSectionHtml('step', 'Step-on triggers') + triggerSectionHtml('b', 'B-triggers');
}

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
