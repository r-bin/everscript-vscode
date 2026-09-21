// Ownership: drafting a room that is not in the ROM.
//
// Split out of map-editor-input.js to keep both files inside the 400-line
// limit; this is the whole "new room" round trip — ask the host, take the
// picture it draws, and point the map at it.
//
// See docs/map-format/building-a-room-from-a-picture.md §7.

/**
 * Start a blank room to try things in.
 *
 * It borrows the current room's graphics list and families, because a room
 * with its own one-entry Block 1 renders black — the chr in a tilemap word
 * resolves to a slot that is not there. Rule 7.1.
 */
function editNewRoom() {
  if (typeof vs === 'undefined' || !vs) return;
  var w = Number(prompt('New room width, in 16px tiles', '16'));
  if (!w) return;
  var h = Number(prompt('New room height, in 16px tiles', '12'));
  if (!h) return;
  editNote('drafting a ' + w + '×' + h + ' room…');
  vs.postMessage({
    command: 'requestBlankRoom', mapName: _mtRoomName,
    widthTiles: w, heightTiles: h, borrowFrom: _mtRoomId,
  });
}

/**
 * The host drew a blank room. Show it in place of the map.
 *
 * The draft keeps pointing at the room whose graphics were borrowed, so the
 * palette, the families and the budget all stay meaningful; only the
 * picture and the grid are the new room's.
 */
function applyBlankRoom(msg) {
  if (!msg || msg.error) { editNote(msg && msg.error ? msg.error : 'could not draft a room'); return; }
  var d = editDraft();
  if (!d) return;
  d.blank = msg.room;
  d.cells = {};
  d.undo = [];
  d.redo = [];
  var img = document.getElementById('rg-img');
  var svg = document.getElementById('rg-svg');
  if (img) {
    img.setAttribute('href', msg.room.imageUri);
    img.setAttribute('width', msg.room.imageWidth);
    img.setAttribute('height', msg.room.imageHeight);
  }
  if (svg) svg.setAttribute('viewBox', '0 0 ' + (msg.room.widthTiles * 2) + ' ' + (msg.room.heightTiles * 2));
  editNote('blank ' + msg.room.widthTiles + '×' + msg.room.heightTiles
    + ' room, borrowing room 0x' + msg.room.borrowedFrom.toString(16) + '’s graphics'
    + (msg.room.problems.length ? ' — ' + msg.room.problems.length + ' problem(s)' : ''));
  renderEditChrome();
}
