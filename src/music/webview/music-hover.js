// Ownership: the timeline's hover: what is under the pointer (a note or an
// effect's box, in history or the read-ahead), its highlight, the tooltip, and
// pointing the emulator at the entity that sent the effect. Works paused too:
// the timeline keeps drawing. State: _music.hoverPt, _music.hoverKey.

/** Note boundaries: the envelope jumps (key-on), or the sample changes. */
function muSameNote(a, b) { return a.on && b.on && a.inst === b.inst && a.start === b.start && !muIsNoteStart(a.envx, b.envx); }

/** What the pointer is on: { kind: 'sfx'|'note', v, first, last, ... } or null. */
function muHoverHit(g) {
  var pt = _music.hoverPt, f = g.frames;
  if (!pt || f.length < 2) return null;
  var v = Math.max(0, Math.min(7, Math.floor(pt.y / g.laneH))), t = g.now + (pt.x - g.playX) / g.k;
  var i = 1;
  while (i < f.length - 1 && f[i].time < t) i++;
  if (t < f[0].time || t > f[f.length - 1].time + MU_FRAME_MS) return null;
  var V = f[i].voices[v];
  if (V.own === 'sfx') {
    var run = muSfxRuns(f, v).filter(function (r) { return r.first <= i && i <= r.last; })[0];
    if (run) return { kind: 'sfx', v: v, first: run.first, last: run.last, sfx: run.sfx, src: run.src, ahead: !!f[run.first].ahead };
  }
  if (!V.on) return null;
  var a = i, b = i;
  while (a > 1 && muSameNote(f[a - 1].voices[v], f[a].voices[v])) a--;
  while (b < f.length - 1 && muSameNote(f[b].voices[v], f[b + 1].voices[v])) b++;
  return { kind: 'note', v: v, first: a, last: b, V: V, ahead: !!f[i].ahead };
}

/** A frame around the hovered note (boxes highlight themselves). */
function muDrawHoverMark(ctx, g, hit) {
  if (!hit || hit.kind !== 'note') return;
  var x1 = g.X(g.frames[hit.first - 1].time), x2 = g.X(g.frames[hit.last].time), y0 = hit.v * g.laneH;
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x1, y0 + 1, x2 - x1, g.laneH - 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x1 + 0.5, y0 + 1.5, Math.max(2, x2 - x1 - 1), g.laneH - 3);
  ctx.lineWidth = 1;
}

function muWhen(g, hit) {
  var f = g.frames, t0 = f[Math.max(0, hit.first - 1)].time, t1 = f[hit.last].time;
  var ago = g.now - t1;
  return ((t1 - t0) / 1000).toFixed(2) + ' s · ' + (hit.ahead ? 'starts in ' + Math.max(0, (t0 - g.now) / 1000).toFixed(1) + ' s (read ahead)' :
    ago <= 0 ? 'playing now' : 'ended ' + (ago / 1000).toFixed(1) + ' s ago');
}

function muHoverHtml(g, hit) {
  if (hit.kind === 'sfx') {
    var info = muSfxInfo(hit.sfx), s = _music.model && _music.model.sfx[hit.sfx];
    var by = hit.src ? muEsc(muSrcLabel(hit.src)) + (hit.src.kind === 'anim' && hit.src.entity ? ' · entity ' + muHex(hit.src.entity, 4) + ' (marked in the emulator)' : '') :
      hit.ahead ? 'not sent yet' : '<i>not recorded</i> (needs the emulator’s debugger core)';
    return '<b>' + MU_CAT_ICONS[info.cat] + ' ' + muEsc(info.name) + '</b> <code>' + muHex(hit.sfx, 2) + '</code> · V' + hit.v +
      '<div>' + muWhen(g, hit) + '</div>' +
      '<div><span class="mu-tip-k">Sent by</span> ' + by + '</div>' +
      (info.source ? '<div><span class="mu-tip-k">Animations that play it</span> ' + muEsc(muSfxSource(s, 6)) + '</div>' : '') +
      '<div><span class="mu-tip-k">Package</span> ' + (s && s.package ? muHex(s.package, 2) + ' (' + muEsc(muPackageName(s.package)) + ')' : 'base bank') + '</div>';
  }
  var V = hit.V;
  return '<b>♪ Music track ' + V.track + '</b> · V' + hit.v +
    '<div>' + (V.inst >= 0 ? 'sample ' + muHex(V.inst, 2) : 'sample at ' + muHex(V.start, 4)) + ' · ' + (V.st >= 0 ? '+' : '') + V.st.toFixed(1) + ' semitones</div>' +
    '<div>' + muWhen(g, hit) + '</div>';
}

/** The tooltip and the emulator's mark follow the hit; both change only when it does. */
function muUpdateHoverTip(hit, g) {
  var tip = document.getElementById('mu-tl-tip');
  if (!tip) return;
  var key = hit ? hit.kind + ':' + hit.v + ':' + (hit.kind === 'sfx' ? hit.sfx + ':' + (hit.src ? hit.src.time : '') : hit.V.inst + ':' + hit.V.start) + ':' + hit.ahead : '';
  if (key !== _music.hoverKey) {
    _music.hoverKey = key;
    var ent = hit && hit.kind === 'sfx' && hit.src && hit.src.entity || 0;
    if (ent !== (_music.pointed || 0)) {
      _music.pointed = ent;
      muPost({ command: 'musicPoint', entity: ent, label: ent ? '♪ ' + muSfxInfo(hit.sfx).name : '' });
    }
    document.querySelectorAll('.mu-sfx-item.mu-sfx-hot').forEach(function (b) { b.classList.remove('mu-sfx-hot'); });
    if (hit && hit.kind === 'sfx') {
      var row = document.querySelector('.mu-sfx-item[data-mu-sfx="' + hit.sfx + '"]');
      if (row) row.classList.add('mu-sfx-hot');
    }
  }
  if (!hit) { tip.style.display = 'none'; return; }
  var html = muHoverHtml(g, hit);
  if (tip._html !== html) { tip._html = html; tip.innerHTML = html; }
  tip.style.display = 'block';
  var pt = _music.hoverPt, w = tip.offsetWidth, h = tip.offsetHeight, W = tip.parentElement.clientWidth, H = tip.parentElement.clientHeight;
  tip.style.left = Math.max(4, Math.min(W - w - 4, pt.x + 14)) + 'px';
  tip.style.top = Math.max(4, Math.min(H - h - 4, pt.y + 14)) + 'px';
}

function muBindTimelineHover() {
  var box = document.getElementById('mu-tl-viewport');
  if (!box) return;
  box.addEventListener('mousemove', function (e) {
    var r = box.getBoundingClientRect();
    _music.hoverPt = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  box.addEventListener('mouseleave', function () { _music.hoverPt = null; });
}
