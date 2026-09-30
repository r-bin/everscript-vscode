// Ownership: the Trigger tab's list UI — step/B trigger rows as the design
// mock draws them (grip, where in the room, the tiles covered, `#n · W×H
// tiles`, what the script does, remove), click-to-select; opened, the
// script (map-editor-trigger-scripts.js, which also owns the Enter tab). The Info tab's trigger counts are
// map-editor-panels.js's. Dragging a row is map-editor-trigger-order.js.
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
 * The row's two pictures, as the design mock draws them: where the trigger
 * sits in the room (the whole room, dimmed, its box lit in its kind's
 * colour), and the tiles it covers.
 *
 * Both are the map itself, not a copy: an SVG `<use>` of the room image
 * (`#rg-img`, svg-builder.js) and of the painted tiles (`#rg-edit-tiles`,
 * map-editor-paint.js) under a viewBox framing the room or the box. Only the
 * tiles: a `<use>` copy loses the page's CSS, so the edit layer's overlays
 * (trigger boxes, outlines) would draw as solid black. So a
 * custom map's painted tiles show — they live only in the edit layer — the
 * previews follow every stroke, and animated tiles play; a room-wide box
 * costs no more than a one-cell one.
 */
function triggerPreviewsHtml(t, kind) {
  var W = _mtPalette && _mtPalette.widthTiles;
  var H = _mtPalette && _mtPalette.heightTiles;
  if (!W || !H) return '';
  var o = _editOrigin;
  var map = '<use href="#rg-img"/><use href="#rg-edit-tiles"/>';
  var b = editCellPos(o, t.x1, t.y1);
  var bw = (t.x2 - t.x1 + 1) * EDIT_UNITS;
  var bh = (t.y2 - t.y1 + 1) * EDIT_UNITS;
  return '<svg class="rg-trigger-where" viewBox="' + o.x + ' ' + o.y + ' ' + (W * EDIT_UNITS) + ' ' + (H * EDIT_UNITS)
    + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g class="rg-trigger-where-map">' + map + '</g>'
    + '<rect class="rg-trigger-where-box rg-trigger-where-' + kind + '" x="' + b.x + '" y="' + b.y + '" width="' + bw
    + '" height="' + bh + '"/></svg>'
    + '<svg class="rg-trigger-tiles" viewBox="' + b.x + ' ' + b.y + ' ' + bw + ' ' + bh
    + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + map + '</svg>';
}

/** The room-source name for a base trigger, or a synthetic one for a placed trigger. */
function triggerRowName(t, kind) {
  if (t.origin === 'placed') return 'placed #' + t.uid;
  var room = _editPanelRoom;
  var names = room && room.content && room.content.triggerNames && room.content.triggerNames[triggerDataKind(kind)];
  return (names && names[t.index]) || ('room trigger ' + t.index);
}

/**
 * One trigger: a card with its row — grip, where, tiles, `#n · W×H tiles`,
 * what its script does, caret, remove — and, opened, its script
 * (map-editor-trigger-scripts.js). Rows start collapsed. Drag the row to
 * reorder (map-editor-trigger-order.js).
 */
function triggerRowHtml(t, kind, n) {
  var d = editDraft();
  var sel = d && triggerRefsEqual(d.selectedTriggerRef, t.ref);
  var refStr = t.ref.kind + ':' + t.ref.id;
  var w = t.x2 - t.x1 + 1, h = t.y2 - t.y1 + 1, locked = editLocked();
  var open = triggerIsOpen(t.ref), what = triggerScriptWhat(triggerScriptFor(t, kind));
  var title = triggerRowName(t, kind) + ' — cells ' + t.x1 + ',' + t.y1 + ' to ' + t.x2 + ',' + t.y2
    + (typeof t.scriptId === 'number' ? '\nscript 0x' + Number(t.scriptId).toString(16) : '\nno script yet')
    + (what ? '\n' + what : '')
    + (locked ? '' : '\nclick to select · drag to reorder, or onto the other tab to change its kind');
  // Locked: no grip, no remove — nothing here may change.
  return '<div class="rg-trigger-card' + (sel ? ' on' : '') + '">'
    + '<div class="rg-trigger-row' + (sel ? ' on' : '') + '"' + (locked ? '' : ' draggable="true"')
    + ' data-trigger-ref="' + escH(refStr) + '" title="' + escH(title) + '">'
    + (locked ? '' : '<span class="rg-trigger-grip" aria-hidden="true">⠿</span>')
    + triggerPreviewsHtml(t, kind)
    + '<span class="rg-trigger-label">#' + n + ' · ' + w + '×' + h + ' tiles'
    + (what ? '<span class="rg-trigger-what">' + scriptHighlight(what) + '</span>' : '') + '</span>'
    + '<span class="rg-object-caret" data-trigger-toggle="' + escH(refStr) + '" title="' + (open ? 'Hide' : 'Show')
    + ' its script">' + (open ? '▾' : '▸') + '</span>'
    + (locked ? '' : '<button class="rdf rg-trigger-remove" data-trigger-remove="' + escH(refStr) + '" title="Remove this trigger">×</button>')
    + '</div>' + (open ? triggerScriptBodyHtml(t, kind) : '') + '</div>';
}

function triggerSectionHtml(kind) {
  var list = editTriggerList(kind);
  var html = '<div class="rg-trigger-list" data-trigger-list="' + kind + '">';
  if (!list.length) html += '<div class="rs-note">none yet — drag a box on the map with the pencil</div>';
  list.forEach(function (t, i) { html += triggerRowHtml(t, kind, i); });
  return html + '</div>';
}

/** The kinds, in order: B-triggers first, the default; then the enter script, which has no box. */
var TRIGGER_SUBTABS = [
  ['b', 'B-triggers', 'Run when the Boy presses B facing them — a sign, a chest, a person'],
  ['step', 'Step-on', 'Step-on triggers: run when the Boy walks onto them — a door, a cutscene zone'],
  ['enter', 'Enter', 'Runs as the room loads — shown, not drawn'],
];

/**
 * Trigger tab body: a tab per kind at the top. B and step are what the
 * pencil draws (map-editor-drawable.js's `_editTriggerKind`) and the one
 * listed below — select, move, delete, copy/paste (map-editor-trigger-select.js,
 * map-editor-gestures.js). Enter only shows the enter script.
 */
function triggerTabPanelHtml() {
  var kind = typeof _editTriggerKind !== 'undefined' ? _editTriggerKind : 'b';
  var enter = typeof _triggerEnterView !== 'undefined' && _triggerEnterView;
  var html = '<div class="rg-subtabs" role="tablist">';
  TRIGGER_SUBTABS.forEach(function (t) {
    var on = t[0] === 'enter' ? enter : !enter && kind === t[0];
    var count = t[0] === 'enter' ? '' : ' <span class="rs-note">' + editTriggerList(t[0]).length + '</span>';
    html += '<button class="rg-subtab rg-trigger-kind rg-trigger-kind-' + t[0] + (on ? ' on' : '')
      + '" role="tab" aria-selected="' + on + '"'
      + (t[0] === 'enter' ? ' data-trigger-enter="1"' : ' data-trigger-kind="' + t[0] + '"') + ' title="' + escH(t[2]) + '">'
      + '<b>' + (t[0] === 'b' ? 'B' : t[0] === 'step' ? 'S' : 'E') + '</b> ' + escH(t[1]) + count + '</button>';
  });
  html += '</div>';
  if (enter) return html + triggerEnterHtml();
  return html
    + '<div class="rs-note">The pencil drags out a new one. Select tool: click one to select it, drag its '
    + 'own cells to move it, Delete to remove, Cmd/Ctrl+C/V to copy — or click a row; ▸ shows its script. '
    + 'Drag a row by ⠿ to reorder it, or onto the other tab to change its kind.</div>'
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

