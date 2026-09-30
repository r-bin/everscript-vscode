// Ownership: the Info tab — four sections, top to bottom:
//   CAPACITY  the attested ceilings, as the design mock draws them
//   MAP       facts measured off the map as it is now (a different colour:
//             these are readings, not budgets)
//   HEADER    the room header's 13 bytes; the fields the map does not decide
//             are editable (`_edit.header`, one undo step per change)
//   CHECKS    what would stop the draft encoding
// Split out of map-editor-panels.js, which keeps the other tabs.

/** Info tab body. */
function infoTabHtml(p) {
  return infoCapacityHtml(p) + infoFactsHtml(p) + infoHeaderHtml(p) + infoChecksHtml(p);
}

// ── CAPACITY ────────────────────────────────────────────────────────────────

/**
 * Only real ceilings get a bar: seven families (the loader clamps), 264
 * graphics (what a tilemap word can name) and the 32 KB WRAM window. The
 * mock's "Meta tiles /128" and "triggers /16" are its placeholders. The
 * trigger tables are 16-bit byte-length prefixed and `$8FAC84` walks them
 * with a 16-bit index; what is 8-bit is each box's coordinates — so a
 * trigger count has no ceiling to draw, only bytes spent.
 */
function infoCapacityHtml(p) {
  var d = editDraft();
  var b = p.budget || {};
  var fams = editFamilies().filter(function (f) { return f !== undefined; }).length;
  var graphics = b.graphics ? b.graphics.used + (d ? d.addedGraphics.length : 0) : null;
  var wram = b.wram ? b.wram.used + editNeededStamps(p).bytes : null;
  var step = editTriggerList('step').length, bt = editTriggerList('b').length;
  var trigTitle = 'A 16-bit byte-length table of 6-byte records, walked with a 16-bit index ($8FAC84) — '
    + 'no count ceiling. Each box’s coordinates are bytes: 0..255 cells from the header’s origin.';
  return '<div class="rg-info-sec"><div class="rg-info-h">Capacity</div>'
    + infoCapRow('Tile families', fams, 7, 'A palette slot per family; the loader clamps to seven')
    + (graphics == null ? '' : infoCapRow('Graphics', graphics, b.graphics.max,
      'Block 1 slots — what a tilemap word can name. Vanilla’s highest is ' + b.graphics.vanilla))
    + (wram == null ? '' : infoCapRow('WRAM', wram, b.wram.max,
      'The grid plus the stamp dictionary share one 32 KB window. Vanilla’s fullest room uses ' + b.wram.vanilla))
    + infoCountRow('Stamps', (b.stamps ? b.stamps.used : 0) + (d ? d.added.length : 0), 'no field limit',
      'Distinct {front, ground, collision} combinations — 8 bytes each, counted in WRAM above')
    + infoCountRow('Step-on triggers', step, step * 6 + ' bytes · 16-bit table', trigTitle)
    + infoCountRow('B-triggers', bt, bt * 6 + ' bytes · 16-bit table', trigTitle)
    + (b.attested != null ? '<div class="rg-info-foot" title="Graphics other rooms draw in this room’s families">'
      + b.attested + ' graphics attested in these families</div>' : '')
    + '</div>';
}

/** A ceiling: label, `used/max · pct%`, and a bar that warns when full and errs when over. */
function infoCapRow(label, used, max, title) {
  var pct = max ? used / max * 100 : 0;
  var state = used > max ? ' over' : used >= max ? ' full' : '';
  return '<div class="rg-cap" title="' + escH(title) + '"><div class="rg-cap-h"><span class="rg-cap-l">' + escH(label)
    + '</span><span class="rg-cap-v">' + used + '/' + max + ' · ' + Math.round(pct) + '%</span></div>'
    + '<div class="rg-cap-track"><i class="rg-cap-fill' + state + '" style="width:' + Math.min(100, pct).toFixed(1)
    + '%"></i></div></div>';
}

/** A value with no bar: a count with no attested ceiling, or a measured fact. */
function infoCountRow(label, value, note, title) {
  return '<div class="rg-cap" title="' + escH(title || '') + '"><div class="rg-cap-h"><span class="rg-cap-l">' + escH(label)
    + '</span><span class="rg-cap-v">' + escH(String(value))
    + (note ? ' <span class="rg-cap-n">' + escH(note) + '</span>' : '') + '</span></div></div>';
}

// ── MAP: measured, not budgeted ─────────────────────────────────────────────

/**
 * Walk the map once and count what its collision words and canopy say.
 * Per stamp, not per cell, for the words: the biggest room is 28000 cells of
 * a few hundred stamps. Empty cells of a custom map count for nothing.
 */
function infoMeasure(p) {
  var f = { area: p.widthTiles * p.heightTiles, cells: 0, open: 0, partial: 0, solid: 0, canopy: 0,
    drift: 0, stairs: 0, gated: 0, interact: 0, levels: [0, 0, 0, 0] };
  var blank = editBlankCanopy(p), memo = {};
  for (var y = 0; y < p.heightTiles; y++) {
    for (var x = 0; x < p.widthTiles; x++) {
      var i = editCellAt(p, x, y);
      if (i < 0) continue;
      var w = memo[i] !== undefined ? memo[i] : (memo[i] = editStampWords(p, i));
      if (!w) continue;
      var c = w.collision, geo = c & 0x0f, aw = !!(c & 0x2000);
      f.cells++;
      if (aw || geo === 0) f.open++; else if (geo === 0x0f) f.solid++; else f.partial++;
      if (w.layer1 !== blank) f.canopy++;
      if (aw && geo >= 8) f.drift++;
      if (typeof stairsOfCollision === 'function' && stairsOfCollision(c)) f.stairs++;
      if ((c & 0x0100) && [3, 5, 7].indexOf((c >> 8) & 0x0f) >= 0) f.gated++;
      if (c & 0x8000) f.interact++;
      f.levels[(c >> 4) & 3]++;
    }
  }
  return f;
}

function infoPct(n, of) { return of ? Math.round(n / of * 100) + '%' : '—'; }

/** The MAP section: what the grid holds right now, in its own colour. */
function infoFactsHtml(p) {
  if (!p.widthTiles || !p.heightTiles) return '';
  var d = editDraft();
  var f = infoMeasure(p);
  var levels = f.levels.map(function (n, lv) { return n ? lv + ': ' + infoPct(n, f.cells) : ''; })
    .filter(Boolean).join(' · ');
  var cut = Object.keys((d && d.cut) || {}).length
    + (d && !d.customKey && !d.blank && p.cuttable ? p.cuttable.length : 0);
  var row = function (label, n, title) { return infoCountRow(label, n + ' cells', infoPct(n, f.cells), title); };
  return '<div class="rg-info-sec rg-info-facts"><div class="rg-info-h">Map <span class="rg-info-hn">measured, not a budget</span></div>'
    + infoCountRow('Drawn', f.cells + ' of ' + f.area, infoPct(f.cells, f.area),
      'Cells with a stamp; a custom map’s empty cells hold nothing yet')
    + row('Walkable', f.open, 'Geometry 0 (fully open) or always-walkable (bit 13)')
    + row('Partly solid', f.partial, 'A slope or half-tile barrier (geometry 1..E)')
    + row('Solid', f.solid, 'Geometry F, not always-walkable')
    + (f.canopy ? row('Canopy coverage', f.canopy, 'Cells with front (BG1) art — drawn over the characters')
      : infoCountRow('Canopy coverage', 'none', 'no front art', 'No cell has front (BG1) art'))
    + infoCountRow('Levels', levels || '—', '', 'Share of drawn cells on each elevation plane (collision bits 5..4)')
    + infoCountRow('Cuttable', cut + ' cells', '', 'Cells the player can cut away')
    + (f.drift ? row('Drift', f.drift, 'Always-walkable with a push direction (bit 13, nibble 8..F)') : '')
    + (f.stairs ? row('Stairs', f.stairs, 'Bit 13 with nibble 0, 1 or 2') : '')
    + (f.gated ? row('Gated', f.gated, 'Entity gate 3, 5 or 7 — solid for some of the party') : '')
    + (f.interact ? row('Interactive', f.interact, 'Bit 15 — pressing B facing it runs the B-trigger') : '')
    + infoCountRow('Objects', (typeof editObjects === 'function' ? editObjects().length : 0), '',
      'Areas that change look when a script sets their state')
    + '</div>';
}

// ── HEADER ──────────────────────────────────────────────────────────────────

/** The fields the map does not decide, in header order, with their byte and register. */
var INFO_HEADER_FIELDS = [
  { key: 'displayTm', label: 'Main screen', reg: '$212C · byte 4', bits: true,
    title: 'Which layers the main screen shows. BG1 is the foreground (canopy) — room 0x4B turns it off' },
  { key: 'subscreenTs', label: 'Sub screen', reg: '$212D · byte 5', bits: true,
    title: 'Which layers the sub screen shows, for colour math' },
  { key: 'colorMath', label: 'Color math', reg: '$2131 · byte 6', hex: 2, title: 'CGADSUB: which layers add or subtract' },
  { key: 'colorWindow', label: 'Color window', reg: '$2130 · byte 7', hex: 2, title: 'CGWSEL: where colour math applies' },
  { key: 'effectVariant', label: 'Effect', reg: 'byte 8', hex: 2, title: 'Room effect variant — indexes the effect table at $908E74' },
  { key: 'param', label: 'Parameter', reg: 'bytes 9–10', hex: 4, title: 'A 16-bit value the loader stores at $0F84' },
];
var INFO_LAYER_BITS = ['BG1', 'BG2', 'BG3', 'BG4', 'OBJ'];

/** The header as this draft would write it: the room's, with the draft's own fields over it. */
function infoHeader(p) {
  var d = editDraft();
  var h = Object.assign({}, p.header || {});
  // A custom map writes origin 0,0 and its own size (maps/custom-room.ts).
  if (d && (d.customKey || d.blank)) { h.originX = 0; h.originY = 0; }
  h.widthTiles = p.widthTiles; h.heightTiles = p.heightTiles;
  return Object.assign(h, (d && d.header) || {});
}

function infoHex(v, n) { return '$' + ('0000' + (v >>> 0).toString(16).toUpperCase()).slice(-n); }

function infoHeaderHtml(p) {
  if (!p.header) return '';
  var d = editDraft();
  var h = infoHeader(p), own = (d && d.header) || {}, locked = editLocked();
  var html = '<div class="rg-info-sec rg-info-header"><div class="rg-info-h">Header'
    + (locked ? ' <span class="rg-info-hn">unlock the map to change it</span>' : '') + '</div>'
    + infoCountRow('Origin', h.originX + ', ' + h.originY, 'bytes 0–1',
      'Where trigger boxes count from, in metatiles — set by the map, not here')
    + infoCountRow('Size', h.widthTiles + '×' + h.heightTiles, 'bytes 2–3', 'The map’s size in metatiles — set by the map');
  INFO_HEADER_FIELDS.forEach(function (fd) {
    var v = Number(h[fd.key]) || 0;
    var edited = Object.prototype.hasOwnProperty.call(own, fd.key);
    var ctl;
    if (fd.bits) {
      ctl = INFO_LAYER_BITS.map(function (name, bit) {
        return '<button class="rdf rg-hdr-bit' + (v & (1 << bit) ? ' on' : '') + '" data-header-bit="' + fd.key + ':' + bit + '"'
          + (locked ? ' disabled' : '') + '>' + name + '</button>';
      }).join('');
    } else {
      ctl = '<input class="rg-hdr-in" data-header-field="' + fd.key + '" value="' + infoHex(v, fd.hex) + '"'
        + ' spellcheck="false"' + (locked ? ' disabled' : '') + '>';
    }
    html += '<div class="rg-hdr-row' + (edited ? ' edited' : '') + '" title="' + escH(fd.title
      + (edited ? '\nthe room’s own: ' + infoHex(Number((p.header || {})[fd.key]) || 0, fd.hex || 2) : '')) + '">'
      + '<span class="rg-cap-l">' + escH(fd.label) + ' <span class="rg-hdr-reg">' + escH(fd.reg) + '</span></span>'
      + '<span class="rg-hdr-ctl">' + ctl + '</span></div>';
  });
  return html + '</div>';
}

/**
 * Set one header field. One undo step; a value equal to the room's own
 * drops the override, so an untouched header stays `null`.
 */
function editHeaderSet(key, value) {
  var d = editDraft();
  if (!d || !_mtPalette) return;
  if (editLocked()) { editNote('this map is locked — unlock it to change its header'); renderEditChrome(); return; }
  var base = Number((_mtPalette.header || {})[key]) || 0;
  editBegin();
  var h = Object.assign({}, d.header || {});
  if (value === base) delete h[key]; else h[key] = value;
  d.header = Object.keys(h).length ? h : null;
  editEnd();
  editNote('header: ' + key + ' = ' + infoHex(value, key === 'param' ? 4 : 2));
  renderEditChrome();
}

/** A layer chip: flip that bit of TM or TS. */
function infoHeaderBit(spec) {
  var parts = String(spec).split(':');
  var cur = Number(infoHeader(_mtPalette)[parts[0]]) || 0;
  editHeaderSet(parts[0], cur ^ (1 << Number(parts[1])));
}

/** A typed value: `$1F`, `0x1F`, `1F` read as hex; clamped to the field's bytes. */
function infoHeaderInput(el) {
  var key = el.dataset.headerField;
  var fd = INFO_HEADER_FIELDS.filter(function (f) { return f.key === key; })[0];
  var n = parseInt(String(el.value).trim().replace(/^(\$|0x)/i, ''), 16);
  if (!fd || !isFinite(n) || n < 0) { renderEditChrome(); return; }
  editHeaderSet(key, n & (fd.hex === 4 ? 0xffff : 0xff));
}

// ── CHECKS ──────────────────────────────────────────────────────────────────

function infoChecksHtml(p) {
  var errs = editErrors(p);
  var html = '<div class="rg-info-sec"><div class="rg-info-h">Checks</div>';
  if (!errs.length) html += infoCheckRow('ok', 'Nothing blocking — this draft would encode');
  errs.forEach(function (e) { html += infoCheckRow(e[0] === 'hard' ? 'error' : 'warning', e[1]); });
  return html + '</div>';
}

function infoCheckRow(status, text) {
  return '<div class="rg-check"><i class="rg-check-dot rg-check-' + status + '"></i><span>' + escH(text) + '</span></div>';
}
