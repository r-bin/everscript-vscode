// Ownership: the SNES bus side of the ROM tab — what a 24-bit address reaches
// (WRAM, I/O, SRAM, a ROM window, open bus) and the bank × offset canvas both
// the Bus and the Compare view draw. Stateless: reads _rom (rom-tab.js).
//
// Grid: 256 bank columns × 128 rows of $200 bytes. A ROM cell takes the colour
// of the file bytes it reaches (Content) or what the CDL saw there (CDL).

var ROM_BUS_ROWS = 128, ROM_BUS_STEP = 0x10000 / ROM_BUS_ROWS, ROM_BUS_CW = 4, ROM_BUS_CH = 4;
var ROM_BUS_KIND = { wram: '#c678dd', io: '#56b6c2', sram: '#e5c07b', open: '#16181c' };
var ROM_WRAM_CDL = ['#2b2f36', '#8f6aa0', '#c678dd', '#d16969'];   // untouched, read, written, executed

/** What bus address bank:a reaches. ROM: {k:'rom', file, fast, window}. */
function romBusAt(bank, a) {
  var m = _rom.model, map = m.mapping || { hirom: true, fast: true, sramBytes: 0 };
  var sys = (bank & 0x7F) < 0x40, fast = bank >= 0x80 && map.fast;
  if (bank === 0x7E || bank === 0x7F) return { k: 'wram', wram: ((bank - 0x7E) << 16) | a };
  if (sys && a < 0x2000) return { k: 'wram', wram: a, mirror: true };
  if (sys && ((a >= 0x2100 && a < 0x2200) || (a >= 0x4016 && a < 0x4018) || (a >= 0x4200 && a < 0x4380))) return { k: 'io' };
  var file = -1, win = '';
  if (map.hirom) {
    if (sys && map.sramBytes && (bank & 0x7F) >= 0x20 && a >= 0x6000 && a < 0x8000) return { k: 'sram', sram: (a - 0x6000) % map.sramBytes };
    if (sys && a < 0x8000) return { k: 'open' };
    file = ((bank & 0x3F) << 16) | a;
    win = sys ? 'upper half' : 'full bank';
  } else {
    var lo = bank & 0x7F;
    if (lo >= 0x70 && lo < 0x7E && a < 0x8000 && map.sramBytes) return { k: 'sram', sram: a % map.sramBytes };
    if (a < 0x8000 && (sys || lo >= 0x70)) return { k: 'open' };
    file = ((lo & 0x7F) << 15) | (a & 0x7FFF);
    win = a >= 0x8000 ? 'upper half' : 'lower mirror';
  }
  if (file >= m.size) return { k: 'open' };
  return { k: 'rom', file: file, fast: fast, window: win };
}

/** Every bus range (bank, 32 KB half) that shows file half `lo`. */
function romBusWindowsOf(lo) {
  var out = [];
  for (var b = 0; b < 256; b++) for (var u = 0; u < 2; u++) {
    var at = romBusAt(b, u ? 0x8000 : 0);
    if (at.k === 'rom' && at.file === lo) out.push({ bank: b, upper: !!u, fast: at.fast, window: at.window });
  }
  return out;
}

function romIoName(a) {
  if (a < 0x2140) return 'PPU registers';
  if (a < 0x2144) return 'APU I/O ports (SPC700)';
  if (a >= 0x2180 && a < 0x2184) return 'WRAM data port';
  if (a >= 0x4016 && a < 0x4018) return 'Joypad serial';
  if (a < 0x4300) return 'CPU registers (NMI, IRQ, math, joypads)';
  return 'DMA / HDMA channels';
}

function romBusExecuted(bank, upper) {
  var ex = _rom.bus && _rom.bus.executed;
  return ex ? (ex[bank * 2 + (upper ? 1 : 0)] || 0) : 0;
}

/** Category key of a file offset, from the half strips (128-byte cells). */
function romFileKey(file, cdl) {
  var h = _rom.model.halves[file >> 15];
  if (!h) return null;
  var runs = cdl ? h.cdlStrip : h.strip, cell = (file & 0x7FFF) >> 7;
  if (!runs) return null;
  for (var i = 0; i < runs.length; i++) { if (cell < runs[i][1]) return runs[i][0]; cell -= runs[i][1]; }
  return null;
}

function romWramKey(off) {
  var w = _rom.bus && _rom.bus.wram;
  if (!w) return 0;
  var cell = off >> 9;
  for (var i = 0; i < w.strip.length; i++) { if (cell < w.strip[i][1]) return w.strip[i][0]; cell -= w.strip[i][1]; }
  return 0;
}

function romBusColor(at) {
  var cdl = _rom.layer === 'cdl';
  if (at.k === 'rom') {
    var key = romFileKey(at.file + ROM_BUS_STEP / 2, cdl);
    return cdl ? ROM_CDL_COLORS[key || 0] : (ROM_COLORS[key] || '#555');
  }
  if (at.k === 'wram' && cdl) return ROM_WRAM_CDL[romWramKey(at.wram + ROM_BUS_STEP / 2)];
  return ROM_BUS_KIND[at.k];
}

/**
 * Draw the grid into `canvas`. `marks`: [{bank, upper}] bank halves to outline
 * (Compare), `sel`: {bank, a} the selected address (Bus).
 */
function romBusDraw(canvas, marks, sel) {
  if (!canvas || !canvas.getContext || !_rom.model) return;
  canvas.width = 256 * ROM_BUS_CW; canvas.height = ROM_BUS_ROWS * ROM_BUS_CH;
  var g = canvas.getContext('2d');
  g.fillStyle = '#16181c'; g.fillRect(0, 0, canvas.width, canvas.height);
  for (var b = 0; b < 256; b++) for (var r = 0; r < ROM_BUS_ROWS; r++) {
    var at = romBusAt(b, r * ROM_BUS_STEP);
    g.globalAlpha = at.k === 'rom' && !at.fast ? 0.4 : 1;
    g.fillStyle = romBusColor(at);
    g.fillRect(b * ROM_BUS_CW, r * ROM_BUS_CH, ROM_BUS_CW, ROM_BUS_CH);
  }
  g.globalAlpha = 1;
  (marks || []).forEach(function (m) {
    g.strokeStyle = '#ffffff'; g.lineWidth = 2;
    g.strokeRect(m.bank * ROM_BUS_CW + 1, (m.upper ? ROM_BUS_ROWS / 2 : 0) * ROM_BUS_CH + 1, ROM_BUS_CW - 2 + 0.01, ROM_BUS_ROWS / 2 * ROM_BUS_CH - 2);
  });
  if (sel) {
    var x = sel.bank * ROM_BUS_CW, y = Math.floor(sel.a / ROM_BUS_STEP) * ROM_BUS_CH;
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1;
    g.strokeRect(x + 0.5, 0.5, ROM_BUS_CW - 1, canvas.height - 1);
    g.strokeStyle = '#ffffff'; g.lineWidth = 2;
    g.strokeRect(x - 3, y - 3, ROM_BUS_CW + 6, ROM_BUS_CH + 6);
  }
}

/** The bus address under a pointer event on a grid canvas. */
function romBusFromEvent(canvas, e) {
  var r = canvas.getBoundingClientRect();
  var bank = Math.max(0, Math.min(255, Math.floor((e.clientX - r.left) / r.width * 256)));
  var row = Math.max(0, Math.min(ROM_BUS_ROWS - 1, Math.floor((e.clientY - r.top) / r.height * ROM_BUS_ROWS)));
  return { bank: bank, a: row * ROM_BUS_STEP };
}

/** Bank axis, zone captions and the "code executed here" ticks above a grid. */
function romBusFrameHtml(id) {
  var lo = (_rom.model.mapping || {}).hirom === false;
  var zones = [[0, '$00–$3F slow', 'system area + ROM ' + (lo ? '' : 'upper halves') + ', SlowROM'], [25, '$40–$7D slow', 'ROM ' + (lo ? '' : 'full banks') + ', SlowROM; $7E–$7F WRAM'],
    [50, '$80–$BF fast', 'system area + ROM ' + (lo ? '' : 'upper halves') + ', FastROM'], [75, '$C0–$FF fast', 'ROM ' + (lo ? '' : 'full banks') + ', FastROM']];
  var ticks = '';
  for (var b = 0; b < 256; b++) if (romBusExecuted(b, false) || romBusExecuted(b, true)) ticks += '<span class="rom-ex" style="left:' + (b / 2.56) + '%"></span>';
  var yax = [0, 0x2000, 0x4000, 0x6000, 0x8000, 0xC000].map(function (a) { return '<span style="top:' + (a / 655.36) + '%">$' + romHex(a, 4) + '</span>'; }).join('');
  var xax = [0, 0x40, 0x80, 0xC0].map(function (b) { return '<span style="left:' + (b / 2.56) + '%">$' + romHex(b, 2) + '</span>'; }).join('');
  return '<div class="rom-bus-frame"><div class="rom-zones">' + zones.map(function (z) { return '<span style="left:' + z[0] + '%" title="' + z[2] + '">' + z[1] + '</span>'; }).join('') + '</div>' +
    '<div class="rom-exrow" title="Banks the CDL saw code execute in">' + ticks + '</div>' +
    '<div class="rom-bus-grid"><div class="rom-yax">' + yax + '</div><canvas class="rom-bus-canvas" id="' + id + '" data-rom-canvas="' + id + '"></canvas></div>' +
    '<div class="rom-xax">' + xax + '</div></div>';
}

function romBusLegendHtml() {
  var k = [[ROM_BUS_KIND.wram, 'WRAM'], [ROM_BUS_KIND.io, 'I/O registers'], [ROM_BUS_KIND.sram, 'SRAM (save)'], [ROM_BUS_KIND.open, 'open bus']];
  var rest = _rom.layer === 'cdl' ? ROM_CDL_LABELS.map(function (l) { return [l[0], 'ROM: ' + l[1]]; }) : ROM_LABELS.map(function (l) { return [ROM_COLORS[l[0]], l[1]]; });
  return k.concat(rest).map(function (l) { return '<span class="rom-chip"><span class="rom-dot" style="background:' + l[0] + '"></span>' + l[1] + '</span>'; }).join('') +
    '<span class="rom-chip rom-dim">dim = slow window · <span style="color:#d16969">▮</span> code executed in that bank (CDL)</span>';
}
