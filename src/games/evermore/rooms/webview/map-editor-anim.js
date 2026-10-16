// Ownership: animated stamps on the map canvas.
//
// A stamp whose words name an animated graphic (a torch, water, a flame) is
// drawn as all its frames stacked in one cell, each shown in its turn at
// vanilla's timing — the host renders the later frames with the stamp
// (rendering/stamp-animation.js; `anim` on the palette and on the composed
// preview). Every frame is a whole picture, so only one is visible at a time:
// a later frame laid over frame 0 would leave frame 0's flame showing
// through its transparent pixels.
//
// SMIL `<animate>`, begun at document time 0, not a CSS animation: redrawing
// the edit layer (every stroke does) would restart a CSS animation, and the
// torches would stutter and fall out of step with each other. On the
// document clock a redrawn cell carries on where it was.
//
// The frames are the host's; the timing is the stamp's animation group's
// (map-editor-animations.js), so editing ticks on the Animation tab shows at
// once. The initial countdown shifts its phase (`begin`).

/** `{row, delays}` of stamp `i` in `sheet.anim`, or null when it does not animate. */
function editStampAnimOf(sheet, i) {
  var a = sheet && sheet.anim;
  if (!a || !a.entries || !a.sheets) return null;
  if (!a._by) {
    a._by = {};
    a.entries.forEach(function (e, row) { a._by[e[0]] = { row: row, delays: e[1] }; });
  }
  return a._by[i] || null;
}

/**
 * The stamp as its frames, or `still` (its frame-0 swatch) when it does not
 * animate or a frame is missing.
 */
function editStampAnimSvg(sheet, i, still, cls, x, y, palette, index) {
  // The paste ghost is see-through by its own opacity, which the frames' would override.
  var hit = cls.indexOf('rg-paste-ghost') < 0 ? editStampAnimOf(sheet, i) : null;
  if (!hit) return still;
  var a = sheet.anim;
  var n = hit.delays.length;
  if (n < 2 || a.sheets.length < n - 1) return still;
  // The open timing, paused: the frame being drawn, still (map-editor-animations.js).
  var shown = palette && typeof editAnimShownFrame === 'function' ? editAnimShownFrame(palette, index) : -1;
  if (shown === 0) return still;
  if (shown > 0 && shown < n) {
    return editCropSvg(cls, x, y, a, a.sheets[shown - 1].imageUri, a.sheets[shown - 1].imageWidth,
      a.sheets[shown - 1].imageHeight, hit.row, '');
  }
  var timing = palette && typeof editAnimTimingOf === 'function' ? editAnimTimingOf(palette, index) : null;
  var delays = timing && timing.delays.length === n ? timing.delays : hit.delays;
  var times = [];
  var total = 0;
  delays.forEach(function (t) { times.push(total); total += Math.max(1, t); });
  // The countdown is a phase: begun that far *back* in the cycle, so no frame shows before its turn.
  var lag = timing ? timing.init % total : 0;
  var begin = lag ? (-(total - lag) / 60).toFixed(3) + 's' : '0s';
  var keyTimes = times.map(function (t) { return (t / total).toFixed(4); }).join(';');
  var dur = (total / 60).toFixed(3) + 's';
  var html = '';
  for (var k = 0; k < n; k++) {
    var values = times.map(function (_, j) { return j === k ? 1 : 0; }).join(';');
    var inner = '<animate attributeName="opacity" calcMode="discrete" begin="' + begin + '" dur="' + dur
      + '" repeatCount="indefinite" keyTimes="' + keyTimes + '" values="' + values + '"/>';
    html += k === 0
      ? editCropSvg(cls, x, y, sheet, sheet.imageUri, sheet.imageWidth, sheet.imageHeight, i, inner)
      : editCropSvg(cls + ' rg-anim-frame', x, y, a, a.sheets[k - 1].imageUri, a.sheets[k - 1].imageWidth,
        a.sheets[k - 1].imageHeight, hit.row, inner);
  }
  return html;
}
