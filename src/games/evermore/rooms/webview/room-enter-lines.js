// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Enter tab's listing of a ROM room's enter script with what it
// calls and starts merged in (script-model/merged.ts), each merged body a fold,
// and the lines the chosen variant does not run greyed out like dead code.
//
// The host answers `requestRoomVariants` with `roomEnterScript` at once (the
// merged listing) and `roomVariants` later (each variant's `reached`: every
// instruction it can run). Until the variants are in, nothing is greyed.
//
// A line is `rg-script-off` when only another variant runs it, `rg-script-dead`
// when no variant does. A fold starts as the host says (`folded`: a shared
// helper named by a short operand); clicking its caret flips it.
//
// State: _enterMerged (room id → merged script or null), _enterFold (room id →
// {block id: folded}). Reads room-variants.js's _roomVariants, _variantPick,
// _variantRoom. Uses utils.js globals: escH; map-editor-trigger-scripts.js:
// scriptHighlight, normScriptAddr, hexNum; script-vm/highlight.ts (page bundle): highlightScript.

var _enterMerged = {};
var _enterFold = {};

/** The host's merged listing: `{roomId, merged, error?}`. */
function applyRoomEnterScript(data) {
  _enterMerged[Number(data.roomId)] = data.merged || null;
  if (typeof _triggerEnterView !== 'undefined' && _triggerEnterView && typeof renderEditPanels === 'function') renderEditPanels();
}

function enterFolded(id, b) {
  var mine = _enterFold[id];
  return mine && mine[b.id] != null ? mine[b.id] : !!b.folded;
}

/** Which addresses the chosen variant runs, and which any variant runs; null before the variants are in. */
function enterReach(id) {
  var got = typeof _roomVariants !== 'undefined' ? _roomVariants[id] : null;
  if (!got || got.error || !got.variants.length) return null;
  var v = got.variants[_variantPick[id] || 0];
  if (!v || !v.reached) return null;
  var mine = {}, any = {};
  v.reached.forEach(function (a) { mine[a] = true; });
  got.variants.forEach(function (x) { (x.reached || []).forEach(function (a) { any[a] = true; }); });
  return { mine: mine, any: any, title: v.title || v.name, index: _variantPick[id] || 0 };
}

/** The merged listing for ROM room `id`, or '' when the host has not sent one. */
function enterMergedHtml(id) {
  var m = id != null ? _enterMerged[id] : null;
  if (!m || !m.lines.length) return '';
  var reach = enterReach(id);
  var folded = {};
  m.blocks.forEach(function (b) { folded[b.id] = enterFolded(id, b) || (b.parent >= 0 && folded[b.parent]); });
  var html = '<div class="rs-note">' + (reach
    ? 'Lines for variant ' + (reach.index + 1) + ' · ' + escH(reach.title) + ': greyed lines run only in another variant, faded ones in none.'
    : 'Calls and the threads it starts merged in. Choose a variant on the map’s right edge to grey what it does not run.')
    + '</div><div class="rg-script rg-script-merged">';
  m.lines.forEach(function (r) {
    if (r.in >= 0 && folded[r.in]) return;
    var cls = 'rg-script-line' + (r.note ? ' rg-script-note' : r.untraced ? ' rs-guess' : '') + (r.terminal ? ' rs-term' : '');
    if (reach && !r.note) cls += reach.mine[r.addressSnes] ? '' : reach.any[r.addressSnes] ? ' rg-script-off' : ' rg-script-dead';
    var caret = '';
    if (r.opens != null) {
      var b = m.blocks[r.opens], shut = enterFolded(id, b);
      caret = '<button class="rg-script-fold" data-enter-fold="' + b.id + '" aria-expanded="' + !shut + '" title="'
        + (shut ? 'Show' : 'Hide') + ' the ' + (b.kind === 'call' ? 'called script' : 'thread') + ' (' + b.size + ' lines)">'
        + (shut ? '▸' : '▾') + '</button>';
    }
    var addr = r.note ? '' : normScriptAddr(hexNum(r.addressSnes, 6));
    html += '<div class="' + cls + '" data-in="' + r.in + '" style="margin-left:' + ((r.indent != null ? r.indent : r.depth) * 14) + 'px"' + (addr ? ' data-script-addr="' + addr + '"' : '')
      + ' title="' + escH(r.note ? '' : hexNum(r.addressSnes, 6).replace('&ndash;', '') + '  ' + r.opcodeHex + '  ' + r.bytesHex) + '">'
      + caret + (r.note ? escH(r.summary) : typeof highlightScript === 'function' ? highlightScript(r.summary) : scriptHighlight(r.summary))
      + (r.opens != null && enterFolded(id, m.blocks[r.opens]) ? ' <span class="rs-note">+' + m.blocks[r.opens].size + '</span>' : '')
      + '</div>';
  });
  return html + '</div>';
}

/**
 * A goto target clicked (highlightScript's `data-goto`): scroll to that line in the same
 * listing — in the same merged body when the line is in one — and flash it.
 */
function scriptGoto(label) {
  var line = label.closest ? label.closest('.rg-script-line') : null, list = line && line.closest('.rg-script');
  if (!list) return false;
  var want = label.getAttribute('data-goto'), inBlock = line.getAttribute('data-in');
  var all = list.querySelectorAll('.rg-script-line[data-script-addr="' + want + '"]'), hit = null;
  for (var i = 0; i < all.length && !hit; i++) if (all[i].getAttribute('data-in') === inBlock) hit = all[i];
  hit = hit || all[0];
  if (!hit) return false;
  hit.scrollIntoView({ block: 'center' });
  hit.classList.remove('sx-flash');
  void hit.offsetWidth;
  hit.classList.add('sx-flash');
  return true;
}

// Capture phase: the dock's own delegated handlers stop clicks before they bubble to the document.
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', function (e) {
    var g = e.target && e.target.closest ? e.target.closest('[data-goto]') : null;
    if (g && scriptGoto(g)) { e.stopPropagation(); return; }
    var t = e.target;
    while (t && t !== document && !(t.dataset && t.dataset.enterFold != null)) t = t.parentNode;
    if (!t || t === document) return;
    var id = typeof _variantRoom !== 'undefined' ? _variantRoom : null;
    var m = id != null ? _enterMerged[id] : null;
    var b = m && m.blocks[Number(t.dataset.enterFold)];
    if (!b) return;
    e.stopPropagation();
    (_enterFold[id] = _enterFold[id] || {})[b.id] = !enterFolded(id, b);
    if (typeof renderEditPanels === 'function') renderEditPanels();
  }, true);
}
