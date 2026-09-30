// Ownership: the scripts behind the Trigger tab's rows, and its Enter tab.
//
// A trigger row (map-editor-trigger-panel.js) starts collapsed: its box, its
// size, and — when the decoder recognised what the script does — that, in a
// few words (the loot it hands over, the room it leads to, the NPCs it can
// place). Opened, it shows the script itself, compactly: one line per
// instruction, its summary only (the opcode where there is none). The full
// byte table that used to sit under the map is gone; the lines keep
// `data-script-addr`, so the emulator's current-instruction highlight
// (interactions.js setupByteScriptFocus) still lands on them.
//
// The Enter tab shows the room's enter script the same way. It cannot be
// drawn — it has no box — so choosing it leaves the pencil's trigger kind
// alone (`_triggerEnterView`, not `_editTriggerKind`).
//
// Where a script comes from: a room's own trigger is the ROM's, by its index
// in the room's table (room.content.triggers, the host's decode). A placed
// trigger — a copied map's, a moved one's — has only its script id, so it is
// looked up by id in the room, then across every vanilla room.
//
// Owns: _triggerOpen ("<map>:<kind>:<id>" → open), _triggerEnterView,
// _triggerScriptIds (the lazy script-id index), _lootOnly (the Trigger and
// Object tabs' "Loot only" quick filters).

var _triggerOpen = {}, _triggerEnterView = false, _triggerScriptIds = null;
var _lootOnly = { trigger: false, object: false };

/** A trigger whose script hands something over (a gourd, a chest, a sniff spot). */
function triggerHasLoot(t, kind) {
  var s = triggerScriptFor(t, kind);
  return !!(s && s.loot && s.loot.length);
}

/** The quick filter over a tab's list: `on` shows only the rows with loot; `n` of them. */
function lootFilterHtml(which, n) {
  var on = _lootOnly[which];
  return '<div class="rd-filters rg-list-filter"><button class="rdf' + (on ? ' on' : '') + '" data-list-loot="' + which + '"'
    + ' title="Show only what hands over loot — gourds, chests, sniff spots">Loot only · ' + n + '</button></div>';
}

function lootFilterToggle(which) {
  _lootOnly[which] = !_lootOnly[which];
  renderEditChrome();
}

function triggerRoomContent() {
  var room = typeof _editPanelRoom !== 'undefined' ? _editPanelRoom : null;
  return (room && room.content) || {};
}

/** Every decoded trigger script in the vanilla rooms, by script id. */
function triggerScriptIndex() {
  if (_triggerScriptIds) return _triggerScriptIds;
  _triggerScriptIds = {};
  var all = typeof VANILLA_ROOM_DETAILS !== 'undefined' && VANILLA_ROOM_DETAILS ? VANILLA_ROOM_DETAILS : {};
  Object.keys(all).forEach(function (k) {
    var tr = (all[k] && all[k].content && all[k].content.triggers) || {};
    (tr.stepOn || []).concat(tr.bTrigger || []).forEach(function (s) {
      if (s && typeof s.scriptId === 'number' && !_triggerScriptIds[s.scriptId]) _triggerScriptIds[s.scriptId] = s;
    });
  });
  return _triggerScriptIds;
}

/** The decoded script for a Trigger-tab entry (editTriggerList's shape), or null. */
function triggerScriptFor(t, kind) {
  var tr = triggerRoomContent().triggers || {};
  var own = tr[triggerDataKind(kind) === 'bTrigger' ? 'bTrigger' : 'stepOn'] || [];
  if (t.origin === 'base' && own[t.index] && (t.scriptId == null || own[t.index].scriptId === t.scriptId)) return own[t.index];
  if (typeof t.scriptId !== 'number') return null;
  var mine = own.concat(kind === 'b' ? tr.stepOn || [] : tr.bTrigger || []).filter(function (s) { return s && s.scriptId === t.scriptId; })[0];
  return mine || triggerScriptIndex()[t.scriptId] || null;
}

/**
 * What the script was recognised to do, in a few words — '' when nothing was.
 * A pickup reads as the Everscript that writes it (`_loot_chest(0x03, OIL);`,
 * script/everscript.ts lootToEverscript), which is copyable, not just a name.
 */
function triggerScriptWhat(s) {
  if (!s) return '';
  var bits = [];
  var code = (s.everscript || []).filter(Boolean);
  if (code.length) bits.push(code[0] + (code.length > 1 ? ' +' + (code.length - 1) : ''));
  else if (typeof lootLabel === 'function' && lootLabel(s)) bits.push(lootLabel(s));
  if (typeof exitLabel === 'function' && exitLabel(s)) bits.push(exitLabel(s));
  var sp = (s.spawns || []).length;
  if (sp) bits.push(sp + ' NPC' + (sp === 1 ? '' : 's'));
  return bits.join(' · ');
}

/**
 * A decoded summary (or an Everscript line), coloured: numbers and addresses,
 * quoted names, the keyword that leads an instruction, and the note that ends
 * a line (`(to 0x94e65d)`) dimmed. Escaped first; the patterns only ever wrap
 * text, never cut an entity.
 */
var SCRIPT_TOKEN = /("[^"]*")|(\([^()]*\))|(\$[0-9a-fA-F]+|0x[0-9a-fA-F]+|\b0d\d+\b|\b\d+\b)|(^[A-Z][A-Z_?]+(?: [A-Z][A-Z_?]+)?\b|\b_[a-z_]+(?=\())/g;

function scriptHighlight(text) {
  var out = '', last = 0, m;
  var src = String(text);
  // Its own regex per call: an aside recurses, and a shared lastIndex loops.
  var re = new RegExp(SCRIPT_TOKEN.source, 'g');
  while ((m = re.exec(src))) {
    out += escH(src.slice(last, m.index));
    if (m[2]) {
      // Only the note that ends a line is an aside (`(to 0x94e65d)`); a
      // condition in the middle (`if ($22ea & 0x01) else …`) is the instruction.
      var aside = !src.slice(m.index + m[0].length).trim();
      var inner = '(' + scriptHighlight(m[2].slice(1, -1)) + ')';
      out += aside ? '<span class="sx-aside">' + inner + '</span>' : inner;
    } else {
      out += '<span class="' + (m[1] ? 'sx-str' : m[3] ? 'sx-num' : 'sx-kw') + '">' + escH(m[0]) + '</span>';
    }
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  return out + escH(src.slice(last));
}

/** The script, one instruction per line: its summary, or its opcode when it has none. */
function triggerScriptLinesHtml(s) {
  var rows = (s && s.instructions) || [];
  if (!rows.length) return '<div class="rs-note">no decoded script</div>';
  var html = '<div class="rg-script">';
  rows.forEach(function (r) {
    var cls = 'rg-script-line' + (r.unsupported ? ' rs-err' : r.untraced ? ' rs-guess' : '') + (r.terminal ? ' rs-term' : '');
    var addr = typeof r.addressSnes === 'number' ? normScriptAddr(hexNum(r.addressSnes, 6)) : '';
    html += '<div class="' + cls + '" data-script-addr="' + addr + '" title="' + escH(hexNum(r.addressSnes, 6).replace('&ndash;', '')
      + '  ' + (r.opcodeHex || '') + (r.bytesHex ? '  ' + r.bytesHex : '')) + '">'
      + scriptHighlight(r.summary || ('op ' + (r.opcodeHex || '?'))) + '</div>';
  });
  if (s.terminated === false) html += '<div class="rs-note rs-err">stopped: ' + escH(s.stopReason || 'unknown') + '</div>';
  return html + '</div>';
}

/** Where a door leads, as links that open that room (rooms-rail.js handles `data-goto-map`). */
function triggerExitsHtml(s) {
  return ((s && s.transitions) || []).map(function (x) {
    return '<a href="#" class="rs-exit-to rg-script-exit" data-goto-map="' + hexNum(x.mapId, 2) + '">→ '
      + escH(x.mapName || ('map ' + hexNum(x.mapId, 2))) + '</a>';
  }).join('');
}

/** The body under an open row: script id and address, exits, then the lines. */
function triggerScriptBodyHtml(t, kind) {
  var s = triggerScriptFor(t, kind);
  var head = typeof t.scriptId === 'number' ? 'script ' + hexNum(t.scriptId, 4) : 'no script yet';
  if (s && typeof s.scriptAddressSnes === 'number') head += ' · ' + hexNum(s.scriptAddressSnes, 6);
  if (s && t.origin !== 'base') head += ' · found by its id';
  return '<div class="rg-trigger-body"><div class="rs-note">' + head + '</div>'
    + triggerExitsHtml(s) + (s ? triggerScriptLinesHtml(s) : '') + '</div>';
}

/** The caret's key: refs repeat across maps. */
function triggerOpenKey(ref) {
  var d = editDraft();
  return (d ? d.customKey || d.roomId : '') + ':' + ref.kind + ':' + ref.id;
}

function triggerIsOpen(ref) { return !!_triggerOpen[triggerOpenKey(ref)]; }

function triggerToggle(refStr) {
  var ref = triggerParseRef(refStr);
  if (!ref) return;
  var k = triggerOpenKey(ref);
  _triggerOpen[k] = !_triggerOpen[k];
  renderEditChrome();
}

/** The Enter tab: the room's enter script, which runs as the room loads. */
function triggerEnterHtml() {
  var s = (triggerRoomContent().triggers || {}).enter;
  if (!s) return '<div class="rs-note">This room has no enter script — or it is not a ROM room.</div>';
  var what = triggerScriptWhat(s);
  return '<div class="rs-note">Runs as the room loads. It has no box, so the pencil cannot draw one.</div>'
    + '<div class="rg-trigger-body rg-enter-body"><div class="rs-note">'
    + (typeof s.scriptAddressSnes === 'number' ? 'at ' + hexNum(s.scriptAddressSnes, 6) : '')
    + (what ? ' · ' + scriptHighlight(what) : '') + '</div>' + triggerExitsHtml(s) + triggerScriptLinesHtml(s) + '</div>';
}

/** Show the Enter tab, or back to a drawable kind. */
function triggerEnterPick(on) {
  _triggerEnterView = !!on;
  renderEditChrome();
}
