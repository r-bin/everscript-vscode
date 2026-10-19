// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Scripts tab's Animations and Alchemy views, and the animation
// player both use on the right: the frames the host renders (sprites'
// renderAnimation, injected), played at 60 ticks a second, wrapping to the
// tick the script loops from; the script lines the current frame ran are lit
// in the listing. State: _scr.record / formula / facing / anims / player.

var SCR_SCALE = 3;

function scrAnimKey(record) { return record + ':' + _scr.facing; }

function scrAskAnim(record) {
  if (record == null) return;
  var k = scrAnimKey(record);
  if (_scr.anims[k]) return;
  _scr.anims[k] = 'pending';
  scrPost({ command: 'scriptsAnim', key: k, record: record, facing: _scr.facing });
}

/** The record the right side plays: the picked one, or the formula's first. */
function scrPlayingRecord() {
  if (_scr.view === 'anim') return _scr.record;
  var f = _scr.index && _scr.index.formulas[_scr.formula];
  if (!f) return null;
  if (_scr.record != null && f.records.some(function (r) { return r.record === _scr.record; })) return _scr.record;
  return f.records.length ? f.records[0].record : null;
}

function scrListingHtml(a) {
  return '<table class="scr-rows scr-anim-rows"><tbody>' + a.script.map(function (l) {
    return '<tr data-scr-line="' + l.address + '" class="' + (l.known ? '' : 'scr-unk') + (l.endFrame ? ' scr-endf' : '') + '">' +
      '<td class="scr-a">$' + l.addrHex.toUpperCase() + '</td><td class="scr-b">' + scrEsc(l.bytesHex) + '</td>' +
      '<td class="scr-s">' + scrEsc(l.text) + (l.endFrame ? ' <span class="scr-dim">⏎</span>' : '') + '</td></tr>';
  }).join('') + '</tbody></table>';
}

function scrPlayerHtml(a, record) {
  if (!a || a === 'pending') return '<div class="scr-empty">Rendering…</div>';
  if (a.error) return '<div class="scr-empty scr-warn">' + scrEsc(a.error) + '</div>';
  if (!a.frames.length) return '<div class="scr-empty">This script shows no sprite' + (a.stoppedAtHex ? ' (stopped at $' + a.stoppedAtHex + ')' : '') + '.</div>';
  var w = a.width * SCR_SCALE, h = a.height * SCR_SCALE, shadow = '';
  if (a.shadow) {
    shadow = '<img id="scr-anim-shadow" class="scr-px" alt="" style="left:' + (a.originX - a.shadow.originX) * SCR_SCALE + 'px;top:' +
      (a.originY - a.shadow.originY) * SCR_SCALE + 'px;width:' + a.shadow.width * SCR_SCALE + 'px;height:' + a.shadow.height * SCR_SCALE + 'px">';
  }
  return '<div class="scr-side-h">Record <code>$' + scrHex(record, 4) + '</code> <span class="scr-dim">' + a.frames.length + ' frames · ' + a.totalTicks +
    ' ticks' + (a.complete ? (a.loopFrom ? ' · loops from tick ' + a.loopFrom : ' · loops') : ' · cut') + '</span></div>' +
    '<div class="scr-stage"><div class="scr-sprite" style="width:' + w + 'px;height:' + h + 'px">' + shadow +
    '<img id="scr-anim-img" class="scr-px" alt="" style="width:' + w + 'px;height:' + h + 'px"></div></div>' +
    '<div class="scr-ctl"><button class="scr-btn" data-scr-play>' + (_scr.player.playing ? '❚❚' : '▶') + '</button>' +
    '<button class="scr-btn" data-scr-step="-1" title="Previous frame">◀︎</button><button class="scr-btn" data-scr-step="1" title="Next frame">▶︎</button>' +
    '<span class="scr-dim" id="scr-anim-pos"></span></div>' +
    (a.paletteColors ? '<div class="scr-pal">' + a.paletteColors.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</div>' : '');
}

function scrRenderAnim(mid, side) {
  var rec = _scr.record;
  if (rec == null) { mid.innerHTML = '<div class="scr-empty">Pick an animation record on the left.</div>'; side.innerHTML = ''; scrStopPlayer(); return; }
  scrAskAnim(rec);
  var a = _scr.anims[scrAnimKey(rec)];
  var entry = _scr.index.animations.find(function (x) { return x.record === rec; }) || {};
  mid.innerHTML = '<div class="scr-h">' + scrEsc(entry.label || '') + ' <span class="scr-dim">record $' + scrHex(rec, 4) + ' · script ' + scrEsc(entry.scriptHex || '') + '</span></div>' +
    (a && a.script ? scrListingHtml(a) : '<div class="scr-note">Disassembling…</div>');
  side.innerHTML = scrPlayerHtml(a, rec);
  scrStartPlayer(a);
}

function scrBlockHtml(f) {
  var at = {};
  f.records.forEach(function (r) { at[r.at] = r; });
  var cells = [];
  for (var i = 0; i + 1 < f.bytes.length; i += 2) {
    var r = at[i], word = scrHex(f.bytes[i] | f.bytes[i + 1] << 8, 4);
    cells.push(r ? '<button class="scr-word scr-rec' + (r.record === scrPlayingRecord() ? ' scr-on' : '') + '" data-scr-rec="' + r.record + '" title="+' + scrHex(i) +
      ': animation record ' + r.recHex + (r.effect ? ' (signals effect_done)' : '') + '">' + word + '</button>'
      : '<span class="scr-word" title="+' + scrHex(i) + '">' + word + '</span>');
  }
  return '<div class="scr-words">' + cells.join('') + '</div>';
}

function scrRenderAlchemy(mid, side) {
  var f = _scr.index.formulas[_scr.formula];
  if (!f) { mid.innerHTML = '<div class="scr-empty">Pick a formula on the left.</div>'; side.innerHTML = ''; scrStopPlayer(); return; }
  var rec = scrPlayingRecord();
  if (rec != null) scrAskAnim(rec);
  var a = rec == null ? null : _scr.anims[scrAnimKey(rec)];
  var shared = _scr.index.formulas.filter(function (g) { return g.block === f.block && g.index !== f.index; }).map(function (g) { return g.name; });
  mid.innerHTML = '<div class="scr-h">' + scrEsc(f.name) + ' <span class="scr-dim">formula ' + f.index + ' · block <code>' + f.blockHex + '</code></span></div>' +
    '<div class="scr-sub">ALCHEMY_ANIM_MAP[' + f.index + '] = <code>$' + scrHex(f.offset) + '</code> → <code>$91:80A6</code> + ' + f.offset + ' → <code>' + f.blockHex + '</code>' +
    (shared.length ? ' · shared with ' + scrEsc(shared.join(', ')) : '') + '<br>The block\'s words (' + f.length + ' bytes); the lit ones are animation records — click to play.</div>' +
    scrBlockHtml(f) +
    (rec == null ? '<div class="scr-note">This block names no animation record.</div>'
      : '<div class="scr-sub" style="margin-top:12px">Record <code>$' + scrHex(rec, 4) + '</code></div>' + (a && a.script ? scrListingHtml(a) : '<div class="scr-note">Disassembling…</div>'));
  side.innerHTML = rec == null ? '<div class="scr-empty">Nothing to play.</div>' : scrPlayerHtml(a, rec);
  scrStartPlayer(a);
}

// ── Player ───────────────────────────────────────────────────────────────────
function scrStopPlayer() {
  if (_scr.player.raf) cancelAnimationFrame(_scr.player.raf);
  _scr.player.raf = 0;
}

function scrFrameAt(a, tick) {
  var t = 0;
  for (var i = 0; i < a.frames.length; i++) { t += a.frames[i].ticks; if (tick < t) return i; }
  return a.frames.length - 1;
}

function scrShowFrame(a) {
  var p = _scr.player, i = scrFrameAt(a, p.tick), f = a.frames[i];
  var img = document.getElementById('scr-anim-img');
  if (!img) return;
  if (p.frame !== i || img.getAttribute('src') !== f.png) {
    img.src = f.png;
    var sh = document.getElementById('scr-anim-shadow');
    if (sh) { if (f.shadow) { sh.src = f.shadow; sh.style.display = ''; } else sh.style.display = 'none'; }
    var lit = {};
    (f.lines || []).forEach(function (l) { lit[l] = 1; });
    document.querySelectorAll('[data-scr-line]').forEach(function (tr) { tr.classList.toggle('scr-lit', !!lit[tr.dataset.scrLine]); });
  }
  p.frame = i;
  var pos = document.getElementById('scr-anim-pos');
  if (pos) pos.textContent = 'frame ' + (i + 1) + '/' + a.frames.length + ' · tick ' + p.tick + '/' + a.totalTicks;
}

function scrStartPlayer(a) {
  scrStopPlayer();
  if (!a || !a.frames || !a.frames.length) return;
  var p = _scr.player, key = scrAnimKey(scrPlayingRecord());
  if (p.key !== key) { p.key = key; p.tick = 0; p.frame = -1; }
  p.frame = -1;
  scrShowFrame(a);
  if (typeof requestAnimationFrame !== 'function') return;
  p.last = 0;
  var step = function (now) {
    if (!document.getElementById('scr-anim-img')) { p.raf = 0; return; }
    if (p.playing) {
      if (!p.last) p.last = now;
      var ticks = Math.floor((now - p.last) / (1000 / 60));
      if (ticks > 0) {
        p.last += ticks * (1000 / 60);
        p.tick += ticks;
        if (p.tick >= a.totalTicks) p.tick = a.complete && a.loopFrom < a.totalTicks ? a.loopFrom + (p.tick - a.totalTicks) % Math.max(1, a.totalTicks - a.loopFrom) : 0;
        scrShowFrame(a);
      }
    } else p.last = 0;
    p.raf = requestAnimationFrame(step);
  };
  p.raf = requestAnimationFrame(step);
}

/** Steps one frame forward or back (pauses). */
function scrStepFrame(dir) {
  var a = _scr.anims[scrAnimKey(scrPlayingRecord())];
  if (!a || !a.frames || !a.frames.length) return;
  var p = _scr.player, i = (scrFrameAt(a, p.tick) + dir + a.frames.length) % a.frames.length, t = 0;
  for (var k = 0; k < i; k++) t += a.frames[k].ticks;
  p.playing = false; p.tick = t;
  var b = document.querySelector('[data-scr-play]');
  if (b) b.textContent = '▶';
  scrShowFrame(a);
}

function scrOnAnimMessage(msg) {
  _scr.anims[msg.key] = msg.error ? { error: msg.error } : (msg.anim || { error: 'Nothing to play for this facing.' });
  if ((_scr.view === 'anim' || _scr.view === 'alchemy') && msg.key === scrAnimKey(scrPlayingRecord())) scrRenderMain();
}
