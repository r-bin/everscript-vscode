// Ownership: "Export ROM" and "Play in emulator" — handing a custom map to
// the host as a fully resolved grid, and reporting what came back. Play is
// the same ROM, loaded into the embedded emulator instead of saved.
//
// The host (rooms/rendering/rom-export.js) builds the blob, puts it in
// Brian's Test Ground's slot, points the intro at it and re-decodes the
// result; this file only says what the map *is*. So it sends words, not
// dictionary indices: every cell's Layer 1, Layer 2 and collision word,
// exactly what the canvas drew — the draft's stamp where one was painted,
// the blank room's empty stamp everywhere else.
//
// Custom maps only. A ROM room's slot is its own; writing a vanilla room's
// draft into Brian's is a different feature with different questions.
//
// Owns: _romExportBusy.

var _romExportBusy = false;

/**
 * The draft as the host wants it, or null (with the reason in `why`) when
 * there is nothing exportable on screen.
 */
function romExportPayload(why) {
  var d = editDraft();
  if (!d || !d.blank) { why.text = 'Export ROM works on a custom map — make one with + New Map'; return null; }
  if (!_mtPalette) { why.text = 'the map is still loading'; return null; }
  var room = d.blank;
  var w = room.widthTiles;
  var h = room.heightTiles;
  var floor = room.floor;
  var cells = [];
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var k = editKey(x, y);
      var s = Object.prototype.hasOwnProperty.call(d.cells, k) ? editStampWords(_mtPalette, d.cells[k]) : null;
      var words = s || floor;
      cells.push(words.layer1, words.layer2, words.collision);
    }
  }
  return {
    borrowFrom: d.roomId,
    widthTiles: w,
    heightTiles: h,
    cells: cells,
    graphics: (d.addedGraphics || []).slice(),
    families: (d.families || []).slice(),
    start: d.start ? { x: d.start.x, y: d.start.y } : null,
    // Tiles the player can cut; `cells` above is what cutting reveals.
    cut: typeof editCutPayload === 'function' ? editCutPayload() : [],
    objects: (typeof editObjects === 'function' ? editObjects() : []).map(function (o) {
      var frames = typeof editObjectFrames === 'function' ? editObjectFrames(o) : [];
      return {
        x: o.x, y: o.y, w: o.w, h: o.h,
        states: frames.length + 1,
        frames: frames.map(function (f) {
          var delta = {};
          Object.keys(f || {}).forEach(function (k) {
            var s = editStampWords(_mtPalette, f[k]);
            if (s) delta[k] = { layer1: s.layer1, layer2: s.layer2, collision: s.collision };
          });
          return delta;
        }),
      };
    }),
  };
}

/** The `export-rom` action: ask the host for a ROM file. */
function editExportRom() { romExportSend('mapExportRom', 'building the ROM…'); }

/** The `play-rom` action: the same ROM, run in the embedded emulator. */
function editPlayRom() { romExportSend('mapPlayRom', 'building the ROM for the emulator…'); }

function romExportSend(command, busyNote) {
  if (_romExportBusy) return;
  var why = { text: '' };
  var draft = romExportPayload(why);
  if (!draft) { editNote(why.text); renderEditChrome(); return; }
  if (typeof vs === 'undefined' || !vs) return;
  var m = typeof customFind === 'function' ? customFind(_customActive) : null;
  _romExportBusy = true;
  editNote(busyNote);
  renderEditChrome();
  vs.postMessage({ command: command, name: m ? m.name : 'custom map', draft: draft });
}

/** The host's answer (bootstrap.js routes `mapExportRomDone` here). */
function applyRomExportDone(msg) {
  _romExportBusy = false;
  if (!msg) return;
  if (msg.error) editNote('export failed: ' + msg.error);
  else if (msg.cancelled) editNote('export cancelled');
  else if (msg.played) editNote('running ' + msg.played + ' in the emulator — the game starts in this map');
  else editNote('exported to ' + msg.path + ' — the game starts in this map');
  renderEditChrome();
}
