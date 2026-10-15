// Ownership: rooms converted from another game (the host's src/mana-to-evermore) —
// opening one from the rail, and the family labels they bring.
//
// A converted room is an ordinary ROM room to the rest of the tab: the host answers
// its requests from the room's own ROM image. What differs is only that its details
// are fetched when it is opened (a few hundred of them would bloat every page build),
// that its id is past the ROM rooms (roomVanillaIdNum accepts it for `imported`
// rooms), and that its families carry a label (`m12`) instead of being ROM ids.
//
// Owns: _importedRooms, _importedWaiting, _importedFamilies.

/** Details already received, by rail id (`som-80`). */
var _importedRooms = {};
/** The rail id whose details were asked for last; a late answer for another is dropped. */
var _importedWaiting = null;
/** Family id -> catalogue-shaped entry ({id, label, tiles, areas, names}) of converted rooms. */
var _importedFamilies = {};

/** Open a converted room's rail row. */
function importedOpen(li) {
  var id = li.dataset.import;
  if (_importedRooms[id]) { renderRoomDetail(_importedRooms[id]); return; }
  _importedWaiting = id;
  var panel = document.getElementById('room-detail');
  if (panel) panel.innerHTML = '<div class="rm-detail-placeholder"><span>Converting ' + escH(li.dataset.name || id) + '…</span></div>';
  if (typeof vs !== 'undefined' && vs) vs.postMessage({ command: 'requestImportedRoom', id: id, name: li.dataset.name || '' });
}

/** The host's answer to requestImportedRoom. */
function applyImportedRoom(msg) {
  if (!msg || msg.id !== _importedWaiting) return;
  _importedWaiting = null;
  var panel = document.getElementById('room-detail');
  if (msg.error || !msg.room) {
    if (panel) panel.innerHTML = '<div class="rs rs-error"><div class="rs-h">Cannot open this map</div><div class="rs-note">'
      + escH(msg.error || 'no data') + '</div></div>';
    return;
  }
  (msg.room.families || []).forEach(function (f) { _importedFamilies[f.id] = f; });
  _importedRooms[msg.id] = msg.room;
  renderRoomDetail(msg.room);
}

/** A converted family's entry, or null for a ROM family. */
function importedFamily(id) {
  return _importedFamilies[id] || null;
}

/** How a family is named on screen: its label when converted, else its ROM id. */
function familyName(id) {
  var f = _importedFamilies[id];
  return f && f.label ? f.label : String(id);
}
