// Ownership: the Music tab's slower-changing parts, redrawn when the loaded
// package or ARAM changes: instruments + keyboard, sound effects, the ARAM map.
// Live markers on the ARAM map (the samples voices play) are redrawn per frame.

var MU_KEYS = 'AWSEDFTGYHUJK';       // computer keys for the 13 piano keys
var MU_BLACK = [1, 3, 6, 8, 10];

/** Instruments of the current source (cached per ARAM/package). */
function muInstrumentsNow(cur) {
  if (!cur || !cur.ram || !_music.model) return [];
  var key = cur.pkg + ':' + (cur.ram === _music.ram ? 'emu' + _music.ramPkg : 'spc');
  if (_music._instKey !== key) {
    _music._instKey = key;
    _music._inst = muInstruments(cur.ram, _music.model.packages[0], _music.model.packages[cur.pkg]);
  }
  return _music._inst;
}

function muRenderKeys() {
  var box = document.getElementById('mu-keys');
  if (!box || box.firstChild) return;
  var html = '';
  for (var k = 0; k <= 12; k++) {
    var black = MU_BLACK.indexOf(k % 12) >= 0;
    html += '<button class="mu-key' + (black ? ' mu-black' : '') + '" data-mu-key="' + k + '" title="' + (k ? '+' + k : 'own rate') + ' (' + MU_KEYS[k] + ')">' + MU_KEYS[k] + '</button>';
  }
  box.innerHTML = html;
}

function muRenderInstruments(cur, insts) {
  var box = document.getElementById('mu-inst'), sub = document.getElementById('mu-inst-sub');
  if (!box) return;
  if (!cur || !cur.ram) {
    box.innerHTML = '<div class="mu-empty">' + (muIsTrack() ? 'Press Play to load the track.' : 'Waiting for the emulator’s ARAM…') + '</div>';
    if (sub) sub.textContent = '';
    return;
  }
  var playing = {};
  muVoices(cur.view).forEach(function (v, i) { if (v.keyed && v.envx) playing[cur.starts[i]] = true; });
  var base = 0, song = 0;
  box.innerHTML = insts.map(function (x) {
    if (x.from === 'base') base++; else song++;
    return '<div class="mu-row' + (x.index === _music.selInst ? ' mu-sel' : '') + (playing[x.start] ? ' mu-playing' : '') + '" tabindex="0" data-mu-inst="' + x.index + '" title="Start ' + muHex(x.start, 4) + ', loop ' + muHex(x.loop, 4) + '. Click to play">' +
      '<i class="mu-dot" style="background:' + muInstColor(x.index) + '"></i><span>' + muHex(x.index, 2) + '</span>' +
      '<span>' + (x.bytes < 1024 ? x.bytes + ' B' : (x.bytes / 1024).toFixed(1) + ' KB') + '</span><span class="mu-tag">' + (x.from === 'base' ? 'base bank' : 'this song') + '</span></div>';
  }).join('');
  if (sub) sub.textContent = base + ' base · ' + song + ' from package ' + muHex(cur.pkg, 2);
}

function muSfxChip(s, enabled) {
  var label = s.name || 'sfx ' + muHex(s.id, 2);
  var how = s.scripts.length ? 'sound(' + s.scripts.map(function (x) { return '0x' + x.toString(16); }).join(' / ') + ')' : 'no sound() id reaches it';
  var need = s.package ? 'needs package ' + muHex(s.package, 2) + ' (' + muPackageName(s.package) + ')' : 'base bank: every room';
  return '<button class="mu-chip' + (s.package ? ' mu-pkg' : '') + '"' + (enabled ? '' : ' disabled') + ' data-mu-sfx="' + s.id + '" title="Driver effect ' + muHex(s.id, 2) + ' · ' + how + ' · ' + muEsc(need) + '">' +
    '<code>' + muHex(s.id, 2) + '</code>' + muEsc(label) + '</button>';
}

function muRenderSfx(cur) {
  var box = document.getElementById('mu-sfx'), sub = document.getElementById('mu-sfx-sub');
  if (!box || !_music.model || _music.model.error) return;
  var pkg = cur ? cur.pkg : -1, sfx = _music.model.sfx;
  var room = sfx.filter(function (s) { return s.package && s.package === pkg; });
  var base = sfx.filter(function (s) { return !s.package; });
  var other = sfx.filter(function (s) { return s.package && s.package !== pkg; });
  var on = !!cur;
  box.innerHTML =
    (room.length ? '<div class="mu-sub">This package (' + muHex(pkg, 2) + ')</div><div class="mu-chips">' + room.map(function (s) { return muSfxChip(s, on); }).join('') + '</div>' : '') +
    '<div class="mu-sub">Base bank · every room</div><div class="mu-chips">' + base.map(function (s) { return muSfxChip(s, on); }).join('') + '</div>' +
    '<div class="mu-sub">Not loaded here · their package comes with other music</div><div class="mu-chips">' + other.map(function (s) { return muSfxChip(s, false); }).join('') + '</div>';
  if (sub) sub.textContent = cur ? (base.length + room.length) + ' playable' : '';
}

function muRenderAram(cur) {
  var bar = document.getElementById('mu-bar'), legend = document.getElementById('mu-legend'), sub = document.getElementById('mu-aram-sub');
  if (!bar || !_music.model || _music.model.error) return;
  if (!cur) { bar.innerHTML = ''; legend.innerHTML = ''; if (sub) sub.textContent = ''; return; }
  var own = muOwners(_music.model.driver, _music.model.packages[0], _music.model.packages[cur.pkg], muEcho(cur.view));
  var totals = {}, free = 0;
  bar.innerHTML = muRuns(own).map(function (r) {
    var o = r.owner >= 0 ? MU_OWNERS[r.owner] : null, n = r.end - r.start;
    if (o) totals[o.key] = (totals[o.key] || 0) + n; else free += n;
    return o ? '<i style="left:' + (r.start / 655.36) + '%;width:' + (n / 655.36) + '%;background:' + MU_OWNER_COLORS[o.key] + '" title="' + o.name + ' · ' + muHex(r.start, 4) + '–' + muHex(r.end - 1, 4) + ' · ' + n + ' bytes"></i>' : '';
  }).join('') + '<span id="mu-markers"></span>';
  legend.innerHTML = MU_OWNERS.map(function (o) {
    return totals[o.key] ? '<span><i class="mu-dot" style="background:' + MU_OWNER_COLORS[o.key] + '"></i> ' + o.name + ' <b>' + (totals[o.key] / 1024).toFixed(1) + ' KB</b></span>' : '';
  }).join('') + '<span><i class="mu-dot" style="background:var(--vscode-input-background,#3c3c3c);outline:1px solid var(--mu-line)"></i> Free <b>' + (free / 1024).toFixed(1) + ' KB</b></span>';
  if (sub) sub.textContent = (free / 1024).toFixed(1) + ' KB free · package ' + muHex(cur.pkg, 2) + ' loaded';
}

/** Per frame: one tick per sounding voice at the sample it plays. */
function muRenderMarkers(cur, insts) {
  var box = document.getElementById('mu-markers');
  if (!box) return;
  if (!cur) { box.innerHTML = ''; return; }
  box.innerHTML = muVoices(cur.view).map(function (v, i) {
    if (!v.keyed || !v.envx) return '';
    var inst = insts.filter(function (x) { return x.start === cur.starts[i]; })[0];
    return '<s style="left:' + (cur.starts[i] / 655.36) + '%;background:' + (inst ? muInstColor(inst.index) : '#fff') + '" title="V' + i + ' plays ' + muHex(cur.starts[i], 4) + '"></s>';
  }).join('');
}
