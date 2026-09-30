// Ownership: the Info tab — four sections, top to bottom:
//   HEADER    the room header's 13 bytes, in words; the fields the map does
//             not decide are editable (`_edit.header`, one undo step each)
//   CAPACITY  the attested ceilings, as the design mock draws them
//   MAP       facts measured off the map as it is now — the same rows, in
//             another colour: these are readings, not budgets
//   CHECKS    what would stop the draft encoding
// Split out of map-editor-panels.js, which keeps the other tabs.

/** Info tab body. */
function infoTabHtml(p) {
  return infoHeaderHtml(p) + infoCapacityHtml(p) + infoFactsHtml(p) + infoChecksHtml(p);
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
  return infoBarRow(label, used, max, title, used > max ? ' over' : used >= max ? ' full' : '');
}

/** A measured share: the same row, its bar in the reading colour, never a warning. */
function infoShareRow(label, n, of, title) {
  return infoBarRow(label, n, of, title, ' measured');
}

function infoBarRow(label, used, max, title, state) {
  var pct = max ? used / max * 100 : 0;
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

/** The MAP section: what the grid holds right now, as shares of the drawn cells. */
function infoFactsHtml(p) {
  if (!p.widthTiles || !p.heightTiles) return '';
  var d = editDraft();
  var f = infoMeasure(p);
  var cut = Object.keys((d && d.cut) || {}).length
    + (d && !d.customKey && !d.blank && p.cuttable ? p.cuttable.length : 0);
  var used = f.levels.filter(Boolean).length;
  var html = '<div class="rg-info-sec rg-info-facts"><div class="rg-info-h">Map <span class="rg-info-hn">measured</span></div>'
    + (f.cells < f.area ? infoShareRow('Drawn', f.cells, f.area, 'Cells with a stamp; a custom map’s empty cells hold nothing yet') : '')
    + infoShareRow('Walkable', f.open, f.cells, 'Geometry 0 (fully open) or always-walkable (bit 13)')
    + infoShareRow('Partly solid', f.partial, f.cells, 'A slope or half-tile barrier (geometry 1..E)')
    + infoShareRow('Solid', f.solid, f.cells, 'Geometry F, not always-walkable')
    + infoShareRow('Canopy coverage', f.canopy, f.cells, 'Cells with front (BG1) art — drawn over the characters');
  f.levels.forEach(function (n, lv) {
    if (n && used > 1) html += infoShareRow('Level ' + lv, n, f.cells, 'Cells on elevation plane ' + lv + ' (collision bits 5..4)');
  });
  if (used === 1) html += infoCountRow('Levels', 'one', 'level ' + f.levels.map(Boolean).indexOf(true), 'Every drawn cell is on one elevation plane');
  html += infoShareRow('Cuttable', cut, f.cells, 'Cells the player can cut away')
    + (f.drift ? infoShareRow('Drift', f.drift, f.cells, 'Always-walkable with a push direction (bit 13, nibble 8..F)') : '')
    + (f.stairs ? infoShareRow('Stairs', f.stairs, f.cells, 'Bit 13 with nibble 0, 1 or 2') : '')
    + (f.gated ? infoShareRow('Gated', f.gated, f.cells, 'Entity gate 3, 5 or 7 — solid for some of the party') : '')
    + (f.interact ? infoShareRow('Interactive', f.interact, f.cells, 'Bit 15 — pressing B facing it runs the B-trigger') : '')
    + infoCountRow('Objects', (typeof editObjects === 'function' ? editObjects().length : 0), '',
      'Areas that change look when a script sets their state');
  return html + '</div>';
}

// ── HEADER ──────────────────────────────────────────────────────────────────

/*
 * Every value reads as words, locked or not; the controls only appear when
 * the map is unlocked. The names are the SNES registers' own meanings, and
 * the room layers are what this engine puts on them (rom-map-data): BG1 the
 * front/canopy, BG2 the ground, BG3 the HUD, BG4 unused in mode 1.
 */
var INFO_LAYERS = ['Front', 'Ground', 'HUD', 'BG4', 'Sprites', 'Backdrop'];
var INFO_LAYER_REGS = ['BG1', 'BG2', 'BG3', 'BG4', 'OBJ', 'backdrop'];

/**
 * Effect variants vanilla uses (byte 8), named by what the room does with it
 * and the rooms that do — a value no room uses is not offered.
 */
var INFO_EFFECTS = [
  { v: 0, name: 'None', rooms: '117 rooms' },
  { v: 1, name: 'Lantern mask', rooms: '0x4B Oglin cave — the front layer follows the player' },
  { v: 2, name: 'Layered canopy', rooms: '0x22, 0x31, 0x38, 0x41, 0x5B, 0x6A' },
  { v: 4, name: 'Arena', rooms: '0x1D Vigor’s arena' },
  { v: 5, name: 'Heat shimmer', rooms: '0x52 top of the volcano' },
];
var INFO_MATH_MODES = [[0x00, 'Add'], [0x40, 'Add ½'], [0x80, 'Subtract'], [0xc0, 'Subtract ½']];
var INFO_MATH_WHERE = ['everywhere', 'inside the window', 'outside the window', 'nowhere'];

/** The fields the map does not decide, in header order. */
var INFO_HEADER_FIELDS = [
  { key: 'displayTm', label: 'Main screen', reg: '$212C (TM) · byte 4', layers: 5,
    title: 'The layers the screen shows. Front is the canopy — room 0x4B turns it off' },
  { key: 'subscreenTs', label: 'Sub screen', reg: '$212D (TS) · byte 5', layers: 5,
    title: 'The layers drawn behind, for colour math to blend with' },
  { key: 'colorMath', label: 'Colour math', reg: '$2131 (CGADSUB) · byte 6',
    title: 'How the sub screen is blended into these main-screen layers' },
  { key: 'colorWindow', label: 'Blend source', reg: '$2130 (CGWSEL) · byte 7',
    title: 'What colour math blends with, and where on screen' },
  { key: 'effectVariant', label: 'Effect', reg: 'byte 8', title: 'The room effect the loader runs' },
  { key: 'param', label: 'Parameter', reg: 'bytes 9–10', hex: 4, title: 'A 16-bit value the loader stores at $0F84 — 0 in every vanilla room' },
];

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

function infoLayerList(v, n) {
  var on = INFO_LAYERS.slice(0, n).filter(function (_, bit) { return v & (1 << bit); });
  return on.length ? on.join(' · ') : 'nothing';
}

function infoEffect(v) {
  return INFO_EFFECTS.filter(function (e) { return e.v === v; })[0];
}

/** A field's value in words. */
function infoHeaderText(fd, v) {
  if (fd.layers) return infoLayerList(v, fd.layers);
  if (fd.key === 'colorMath') {
    if (!(v & 0x3f)) return 'off';
    var mode = INFO_MATH_MODES.filter(function (m) { return m[0] === (v & 0xc0); })[0][1];
    return mode + ' on ' + infoLayerList(v, 6);
  }
  if (fd.key === 'colorWindow') {
    return (v & 0x02 ? 'sub screen' : 'fixed colour') + ', ' + INFO_MATH_WHERE[(v >> 4) & 3]
      + ((v >> 6) & 3 ? ' · clips to black' : '');
  }
  if (fd.key === 'effectVariant') { var e = infoEffect(v); return e ? e.name : 'unknown ' + infoHex(v, 2); }
  return infoHex(v, fd.hex || 2);
}

/** A layer chip: one bit of the field. */
function infoLayerChip(key, v, bit) {
  return '<button class="rdf rg-hdr-bit' + (v & (1 << bit) ? ' on' : '') + '" data-header-bit="' + key + ':' + bit + '"'
    + ' title="' + INFO_LAYER_REGS[bit] + '">' + INFO_LAYERS[bit] + '</button>';
}

/** A select whose options are whole byte values, so a change is one set. */
function infoSelect(key, v, options) {
  return '<select class="rg-hdr-sel" data-header-field="' + key + '">' + options.map(function (o) {
    return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + escH(o[1]) + '</option>';
  }).join('') + '</select>';
}

/** The controls for a field, shown under it while the map is unlocked. */
function infoHeaderControls(fd, v) {
  var chips = function (n) {
    var out = '';
    for (var bit = 0; bit < n; bit++) out += infoLayerChip(fd.key, v, bit);
    return out;
  };
  if (fd.layers) return chips(fd.layers);
  if (fd.key === 'colorMath') {
    return infoSelect(fd.key, v, INFO_MATH_MODES.map(function (m) { return [(v & 0x3f) | m[0], m[1]]; })) + chips(6);
  }
  if (fd.key === 'colorWindow') {
    return infoSelect(fd.key, v, [[v | 0x02, 'Sub screen'], [v & ~0x02, 'Fixed colour']])
      + infoSelect(fd.key, v, INFO_MATH_WHERE.map(function (w, i) { return [(v & ~0x30) | (i << 4), w]; }));
  }
  if (fd.key === 'effectVariant') {
    var opts = INFO_EFFECTS.map(function (e) { return [e.v, e.name]; });
    if (!infoEffect(v)) opts.push([v, 'unknown ' + infoHex(v, 2)]);
    return infoSelect(fd.key, v, opts);
  }
  return '<input class="rg-hdr-in" data-header-field="' + fd.key + '" value="' + infoHex(v, fd.hex) + '" spellcheck="false">';
}

function infoHeaderHtml(p) {
  if (!p.header) return '';
  var d = editDraft();
  var h = infoHeader(p), own = (d && d.header) || {}, locked = editLocked();
  var html = '<div class="rg-info-sec rg-info-header"><div class="rg-info-h">Header'
    + (locked ? ' <span class="rg-info-hn">locked</span>' : '') + '</div>'
    + infoCountRow('Size', h.widthTiles + ' × ' + h.heightTiles, 'origin ' + h.originX + ', ' + h.originY,
      'Bytes 2–3: the size in metatiles. Bytes 0–1: the trigger origin, where trigger boxes count from. Both set by the map');
  INFO_HEADER_FIELDS.forEach(function (fd) {
    var v = Number(h[fd.key]) || 0;
    var edited = Object.prototype.hasOwnProperty.call(own, fd.key);
    var e = fd.key === 'effectVariant' ? infoEffect(v) : null;
    var base = Number((p.header || {})[fd.key]) || 0;
    var title = fd.title + (e ? ' — ' + e.rooms : '') + '\n' + fd.reg + ' = ' + infoHex(v, fd.hex || 2)
      + (edited ? '\nthe room’s own: ' + infoHeaderText(fd, base) : '');
    // Unlocked, the controls are the value: a lit chip, a select's choice. The words go to the tooltip.
    html += '<div class="rg-hdr-row' + (edited ? ' edited' : '') + '" title="' + escH(infoHeaderText(fd, v) + '\n' + title) + '">'
      + '<span class="rg-cap-l">' + escH(fd.label) + '</span>'
      + (locked ? '<span class="rg-hdr-v">' + escH(infoHeaderText(fd, v)) + '</span>'
        : '<span class="rg-hdr-ctl">' + infoHeaderControls(fd, v) + '</span>') + '</div>';
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

/** A layer chip: flip that bit of the field. */
function infoHeaderBit(spec) {
  var parts = String(spec).split(':');
  var cur = Number(infoHeader(_mtPalette)[parts[0]]) || 0;
  editHeaderSet(parts[0], cur ^ (1 << Number(parts[1])));
}

/** A select carries the whole byte; the parameter is typed as hex (`$1F`, `0x1F`, `1F`). */
function infoHeaderInput(el) {
  var key = el.dataset.headerField;
  var fd = INFO_HEADER_FIELDS.filter(function (f) { return f.key === key; })[0];
  var n = el.tagName === 'SELECT' ? Number(el.value)
    : parseInt(String(el.value).trim().replace(/^(\$|0x)/i, ''), 16);
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
