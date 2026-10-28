// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Scripts tab's Everscript view — a room's scripts (enter,
// step-on, B-triggers) as decoded bytes or as the simulation's Everscript,
// grouped by kind or by the simulation's clusters, and the room picture with
// every trigger's box on the right. State lives in _scr (scripts-tab.js).
//
// The enter script is shown with its calls and started threads merged in
// (script-model/merged.ts), each merged body a fold. Its variants (who stands
// in the room per story state, simulation/variants.ts) are chips above it: the
// chosen one's characters stand on the picture, and the lines it does not run
// are greyed — `scr-off` when another variant runs them, `scr-dead` when none.
// `_scr.structured` off shows each instruction as printed (`raw`) without the
// braces: the bytes as they are, gotos and all. A called body is not indented
// (it sits where its call is); its rows are tinted (`scr-inside`) instead.
// A line's marks (script-vm print.ts) are squiggles.

var SCR_KIND = { enter: 'Enter', step: 'Step-on', b: 'B-trigger' };
var SCR_CLUSTER_ICON = { loot: '◆', transition: '⇥', dialog: '💬', cutscene: '🎬', script: '·' };

function scrRoomData() { return _scr.room == null ? null : _scr.rooms[_scr.room]; }

function scrSelectRoom(id) {
  _scr.room = id; _scr.script = 'enter';
  if (!_scr.rooms[id]) { _scr.rooms[id] = 'pending'; scrPost({ command: 'scriptsRoom', id: id }); }
  if (!_scr.variants[id]) { _scr.variants[id] = 'pending'; scrPost({ command: 'scriptsVariants', id: id }); }
  scrAskSim();
}

/** Asks the host for the simulation of the selected script (and the room's clusters) when a toggle needs it. */
function scrAskSim() {
  if (!(_scr.everscript || _scr.clusters) || _scr.room == null) return;
  var k = _scr.room + ':' + _scr.script;
  if (_scr.sims[k]) return;
  _scr.sims[k] = 'pending';
  scrPost({ command: 'scriptsSim', room: _scr.room, key: _scr.script });
}

function scrRoomClusters() {
  for (var k in _scr.sims) {
    var s = _scr.sims[k];
    if (k.indexOf(_scr.room + ':') === 0 && s && s.clusters) return s.clusters;
  }
  return null;
}

function scrScriptChip(s) {
  var name = s.kind === 'enter' ? 'Enter' : (s.kind === 'b' ? 'B' : 'S') + s.index;
  return '<button class="scr-chip' + (s.key === _scr.script ? ' scr-on' : '') + '" data-scr-script="' + scrEsc(s.key) + '" title="' +
    scrEsc(SCR_KIND[s.kind] + (s.index != null ? ' #' + s.index : '') + ' · ' + s.addrHex + ' · ' + s.label) + '">' + name + '</button>';
}

function scrScriptListHtml(room) {
  var byKey = {}, out = [];
  room.scripts.forEach(function (s) { byKey[s.key] = s; });
  var clusters = _scr.clusters ? scrRoomClusters() : null;
  if (_scr.clusters && !clusters) out.push('<div class="scr-note">Simulating the room…</div>');
  if (clusters && clusters.error) out.push('<div class="scr-note scr-warn">Clusters: ' + scrEsc(clusters.error) + '</div>');
  if (clusters && !clusters.error) {
    var used = {};
    out.push('<div class="scr-chips-row"><span class="scr-chips-h">Enter</span>' + scrScriptChip(byKey.enter) + '</div>');
    clusters.forEach(function (c) {
      out.push('<div class="scr-chips-row"><span class="scr-chips-h" title="' + scrEsc(c.kind) + '">' + (SCR_CLUSTER_ICON[c.kind] || '·') + ' ' + scrEsc(c.title) + '</span>' +
        c.keys.map(function (k) { used[k] = 1; return byKey[k] ? scrScriptChip(byKey[k]) : ''; }).join('') + '</div>');
    });
    var rest = room.scripts.filter(function (s) { return s.kind !== 'enter' && !used[s.key]; });
    if (rest.length) out.push('<div class="scr-chips-row"><span class="scr-chips-h">Not clustered</span>' + rest.map(scrScriptChip).join('') + '</div>');
    return out.join('');
  }
  ['enter', 'step', 'b'].forEach(function (kind) {
    var list = room.scripts.filter(function (s) { return s.kind === kind; });
    if (list.length) out.push('<div class="scr-chips-row"><span class="scr-chips-h">' + SCR_KIND[kind] + '</span>' + list.map(scrScriptChip).join('') + '</div>');
  });
  return out.join('');
}

/** A `goto` target clicked: scroll to that row of the listing (in the same merged body first) and flash it. */
function scrGoto(label) {
  var tr = label.closest('tr'), table = tr && tr.closest('.scr-rows');
  if (!table) return;
  var all = table.querySelectorAll('tr[data-addr="' + label.getAttribute('data-goto') + '"]'), hit = null;
  for (var i = 0; i < all.length && !hit; i++) if (all[i].getAttribute('data-in') === tr.getAttribute('data-in')) hit = all[i];
  hit = hit || all[0];
  if (!hit) return;
  hit.scrollIntoView({ block: 'center' });
  hit.classList.remove('sx-flash');
  void hit.offsetWidth;
  hit.classList.add('sx-flash');
}

/** One script line, coloured (script-vm/highlight.ts, the Rooms tab's too); `marks` drawn as squiggles. */
function scrLine(text, marks) { return typeof highlightScript === 'function' ? highlightScript(text, marks || []) : scrEsc(text); }

function scrRowsHtml(s) {
  return '<table class="scr-rows"><tbody>' + s.rows.map(function (r) {
    return '<tr class="' + (r.u ? 'scr-unk' : '') + (r.t ? ' scr-term' : '') + '" data-in="-1" data-addr="' + r.a.slice(1) + '"><td class="scr-a">' + r.a + '</td>' +
      '<td class="scr-b" title="' + scrEsc(r.b) + '">' + scrEsc(r.b.length > 24 ? r.b.slice(0, 23) + '…' : r.b) + '</td>' +
      '<td class="scr-s" style="padding-left:' + (8 + r.d * 14) + 'px">' + scrLine(r.s, r.m) + '</td></tr>';
  }).join('') + '</tbody></table>';
}

function scrEverscriptHtml() {
  var sim = _scr.sims[_scr.room + ':' + _scr.script];
  if (!sim || sim === 'pending') return '<div class="scr-note">Simulating…</div>';
  var e = sim.everscript;
  if (!e || e.error) return '<div class="scr-note scr-warn">The simulation could not write this script: ' + scrEsc(e ? e.error : 'no result') + '</div>';
  return (e.structured ? '' : '<div class="scr-note">Not structured: the flow is written as raw <code>code(...)</code>.</div>') +
    '<pre class="scr-evs">' + scrEsc(e.text) + '</pre>';
}

function scrRenderRoom(mid, side) {
  var d = scrRoomData();
  if (_scr.room == null) { mid.innerHTML = '<div class="scr-empty">Pick a room on the left.</div>'; side.innerHTML = ''; return; }
  if (!d || d === 'pending') { mid.innerHTML = '<div class="scr-empty">Decoding the room\'s scripts…</div>'; side.innerHTML = ''; return; }
  if (d.room.error) { mid.innerHTML = '<div class="scr-empty scr-warn">' + scrEsc(d.room.error) + '</div>'; side.innerHTML = ''; return; }
  var s = d.room.scripts.find(function (x) { return x.key === _scr.script; }) || d.room.scripts[0];
  var facts = [];
  if (s.loot && s.loot.length) facts.push('gives <code>' + scrEsc(s.loot.join(' · ')) + '</code>');
  if (s.to && s.to.length) facts.push('→ ' + scrEsc(s.to.join(' · ')));
  mid.innerHTML = '<div class="scr-h">' + scrEsc(d.room.name) + ' <span class="scr-dim">room $' + d.room.idHex + '</span></div>' +
    '<div class="scr-chips">' + scrScriptListHtml(d.room) + '</div>' +
    '<div class="scr-sub"><b>' + SCR_KIND[s.kind] + (s.index != null ? ' #' + s.index : '') + '</b> <code>' + s.addrHex + '</code>' +
    (s.scriptId != null ? ' · script id <code>$' + scrHex(s.scriptId, 4) + '</code>' : '') +
    ' · ' + s.rows.length + ' instructions' + (s.stop !== 'terminated' ? ' · <span class="scr-warn">' + scrEsc(s.stop) + '</span>' : '') +
    (facts.length ? '<br>' + facts.join(' · ') : '') + '</div>' +
    (_scr.everscript ? scrEverscriptHtml() : s.kind === 'enter' && d.room.merged ? scrVariantsHtml() + scrMergedHtml(d.room.merged) : scrRowsHtml(s));
  scrRenderRoomSide(side, d, s);
}

/** The chosen variant of the selected room, or null before the variants are in. */
function scrVariant() {
  var got = _scr.variants[_scr.room];
  return got && got !== 'pending' && !got.error ? got.variants[_scr.variantPick[_scr.room] || 0] || null : null;
}

function scrVariantsHtml() {
  var got = _scr.variants[_scr.room];
  if (!got || got === 'pending') return '<div class="scr-note">Simulating the variants…</div>';
  if (got.error) return '<div class="scr-note scr-warn">Variants: ' + scrEsc(got.error) + '</div>';
  var pick = _scr.variantPick[_scr.room] || 0;
  return '<div class="scr-chips-row"><span class="scr-chips-h">Variant</span>' + got.variants.map(function (v, i) {
    return '<button class="scr-chip' + (i === pick ? ' scr-on' : '') + '" data-scr-variant="' + i + '" title="' + scrEsc(v.name + '\n' + v.when.join('\n')) + '">'
      + (i + 1) + ' · ' + scrEsc(v.title || v.name) + '</button>';
  }).join('') + '</div>';
}

function scrFolded(b) {
  var mine = _scr.folds[_scr.room];
  return mine && mine[b.id] != null ? mine[b.id] : !!b.folded;
}

function scrToggleFold(id) {
  var d = scrRoomData(), m = d && d !== 'pending' && d.room.merged;
  if (!m || !m.blocks[id]) return;
  (_scr.folds[_scr.room] = _scr.folds[_scr.room] || {})[id] = !scrFolded(m.blocks[id]);
  scrRenderMain();
}

/** The enter script with its calls merged in: folds, and the lines the chosen variant does not run greyed. */
function scrMergedHtml(m) {
  var v = scrVariant(), got = _scr.variants[_scr.room], mine = null, any = {};
  if (v) {
    mine = {};
    v.reached.forEach(function (a) { mine[a] = 1; });
    got.variants.forEach(function (x) { x.reached.forEach(function (a) { any[a] = 1; }); });
  }
  var folded = {}, structured = _scr.structured !== false;
  m.blocks.forEach(function (b) { folded[b.id] = scrFolded(b) || (b.parent >= 0 && folded[b.parent]); });
  return '<table class="scr-rows"><tbody>' + m.lines.map(function (r) {
    if (r.in >= 0 && folded[r.in]) return '';
    if (r.brace && !structured) return '';
    var b = r.opens != null ? m.blocks[r.opens] : null, shut = b && scrFolded(b);
    var cls = (r.note ? 'scr-note-row' : r.untraced ? 'scr-unk' : '') + (r.terminal ? ' scr-term' : '') + (r.in >= 0 && m.blocks[r.in].kind === 'call' ? ' scr-inside' : '')
      + (mine && !r.note && !r.brace ? (mine[r.addressSnes] ? '' : any[r.addressSnes] ? ' scr-off' : ' scr-dead') : '');
    var bare = r.note || r.brace, text = !structured && r.raw ? r.raw : r.summary;
    var indent = structured ? (r.indent != null ? r.indent : r.depth) : (r.flat || 0);
    return '<tr class="' + cls + '" data-in="' + r.in + '"' + (bare ? '' : ' data-addr="' + scrHex(r.addressSnes, 6) + '"') + (structured && r.raw ? ' title="' + scrEsc(r.raw) + '"' : '')
      + '><td class="scr-a">' + (bare ? '' : '$' + scrHex(r.addressSnes, 6)) + '</td>'
      + '<td class="scr-s" style="padding-left:' + (8 + indent * 14) + 'px">'
      + (b ? '<button class="scr-fold" data-scr-fold="' + b.id + '" aria-expanded="' + !shut + '" title="' + (shut ? 'Show' : 'Hide') + ' the '
        + (b.kind === 'call' ? 'called script' : 'thread') + ' (' + b.size + ' lines)">' + (shut ? '▸' : '▾') + '</button>' : '')
      + (r.note ? scrEsc(r.summary) : scrLine(text, r.marks)) + (shut ? ' <span class="scr-dim">+' + b.size + '</span>' : '') + '</td></tr>';
  }).join('') + '</tbody></table>';
}

/** The characters on the picture: the chosen variant's (those it places on entry), every candidate before the variants are in. */
function scrSpritesSvg(d) {
  var v = scrVariant(), at = null;
  if (v) { at = {}; v.spawns.forEach(function (s) { if (!s.later) at[s.at] = 1; }); }
  return (d.room.sprites || []).filter(function (s) { return !at || at[s.at]; }).map(function (s) {
    return '<image class="scr-sprite" href="' + s.uri + '" x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '"><title>' + scrEsc(s.name) + '</title></image>';
  }).join('');
}

function scrRenderRoomSide(side, d, sel) {
  // The chosen variant's own picture when it sets object states.
  var got = _scr.variants[_scr.room], vp = got && got !== 'pending' && got.pictures ? got.pictures[_scr.variantPick[_scr.room] || 0] : null;
  var p = vp && !vp.error ? vp : d.picture;
  if (!p || p.error) { side.innerHTML = '<div class="scr-empty">' + scrEsc(p ? p.error : 'No picture') + '</div>'; return; }
  var boxes = d.room.scripts.filter(function (s) { return s.box; }).map(function (s) {
    var b = s.box;
    return '<rect class="scr-box scr-box-' + s.kind + (s.key === sel.key ? ' scr-on' : '') + '" data-scr-script="' + s.key + '" x="' + b.x + '" y="' + b.y +
      '" width="' + b.w + '" height="' + b.h + '"><title>' + scrEsc(SCR_KIND[s.kind] + ' #' + s.index + ' · ' + s.label) + '</title></rect>';
  }).join('');
  side.innerHTML = '<div class="scr-side-h">Map <span class="scr-dim">' + p.width + '×' + p.height + ' · <i class="scr-key scr-box-step"></i> step-on <i class="scr-key scr-box-b"></i> B-trigger</span></div>' +
    '<div class="scr-map"><img src="' + p.uri + '" width="' + p.width + '" height="' + p.height + '" alt="">' +
    '<svg viewBox="0 0 ' + p.width + ' ' + p.height + '" preserveAspectRatio="none">' + scrSpritesSvg(d) + boxes + '</svg></div>';
}

function scrOnRoomMessage(msg) {
  if (msg.command === 'scriptsRoom') {
    _scr.rooms[msg.id] = msg.error ? { room: { error: msg.error } } : { room: msg.room, picture: msg.picture };
  } else if (msg.command === 'scriptsVariants') {
    _scr.variants[msg.id] = { variants: msg.variants || [], pictures: msg.pictures || [], error: msg.error || null };
  } else if (msg.command === 'scriptsSim') {
    _scr.sims[msg.room + ':' + msg.key] = msg.error ? { everscript: { error: msg.error }, clusters: { error: msg.error } }
      : { everscript: msg.everscript, clusters: msg.clusters };
  }
  if (_scr.view === 'room') scrRenderMain();
}
