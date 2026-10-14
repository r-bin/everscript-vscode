// Ownership: the Scripts tab's Everscript view — a room's scripts (enter,
// step-on, B-triggers) as decoded bytes or as the simulation's Everscript,
// grouped by kind or by the simulation's clusters, and the room picture with
// every trigger's box on the right. State lives in _scr (scripts-tab.js).

var SCR_KIND = { enter: 'Enter', step: 'Step-on', b: 'B-trigger' };
var SCR_CLUSTER_ICON = { loot: '◆', transition: '⇥', dialog: '💬', cutscene: '🎬', script: '·' };

function scrRoomData() { return _scr.room == null ? null : _scr.rooms[_scr.room]; }

function scrSelectRoom(id) {
  _scr.room = id; _scr.script = 'enter';
  if (!_scr.rooms[id]) { _scr.rooms[id] = 'pending'; scrPost({ command: 'scriptsRoom', id: id }); }
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

function scrRowsHtml(s) {
  return '<table class="scr-rows"><tbody>' + s.rows.map(function (r) {
    return '<tr class="' + (r.u ? 'scr-unk' : '') + (r.t ? ' scr-term' : '') + '"><td class="scr-a">' + r.a + '</td>' +
      '<td class="scr-b" title="' + scrEsc(r.b) + '">' + scrEsc(r.b.length > 24 ? r.b.slice(0, 23) + '…' : r.b) + '</td>' +
      '<td class="scr-s" style="padding-left:' + (8 + r.d * 14) + 'px">' + scrEsc(r.s) + '</td></tr>';
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
    (_scr.everscript ? scrEverscriptHtml() : scrRowsHtml(s));
  scrRenderRoomSide(side, d, s);
}

function scrRenderRoomSide(side, d, sel) {
  var p = d.picture;
  if (!p || p.error) { side.innerHTML = '<div class="scr-empty">' + scrEsc(p ? p.error : 'No picture') + '</div>'; return; }
  var boxes = d.room.scripts.filter(function (s) { return s.box; }).map(function (s) {
    var b = s.box;
    return '<rect class="scr-box scr-box-' + s.kind + (s.key === sel.key ? ' scr-on' : '') + '" data-scr-script="' + s.key + '" x="' + b.x + '" y="' + b.y +
      '" width="' + b.w + '" height="' + b.h + '"><title>' + scrEsc(SCR_KIND[s.kind] + ' #' + s.index + ' · ' + s.label) + '</title></rect>';
  }).join('');
  side.innerHTML = '<div class="scr-side-h">Map <span class="scr-dim">' + p.width + '×' + p.height + ' · <i class="scr-key scr-box-step"></i> step-on <i class="scr-key scr-box-b"></i> B-trigger</span></div>' +
    '<div class="scr-map"><img src="' + p.uri + '" width="' + p.width + '" height="' + p.height + '" alt="">' +
    '<svg viewBox="0 0 ' + p.width + ' ' + p.height + '" preserveAspectRatio="none">' + boxes + '</svg></div>';
}

function scrOnRoomMessage(msg) {
  if (msg.command === 'scriptsRoom') {
    _scr.rooms[msg.id] = msg.error ? { room: { error: msg.error } } : { room: msg.room, picture: msg.picture };
  } else if (msg.command === 'scriptsSim') {
    _scr.sims[msg.room + ':' + msg.key] = msg.error ? { everscript: { error: msg.error }, clusters: { error: msg.error } }
      : { everscript: msg.everscript, clusters: msg.clusters };
  }
  if (_scr.view === 'room') scrRenderMain();
}
