// Ownership: the timeline's hover: what is under the pointer (a note or an
// effect's box, in history or the read-ahead), its highlight, the tooltip, and
// pointing the emulator at the entity that sent the effect. Works paused too:
// the timeline keeps drawing.
//
// The tooltip can be entered: a hit is held for MU_TIP_HOLD_MS after the pointer
// leaves it, and frozen while the pointer is over the tooltip, so its links
// (soe:// pages of the character, animation, script) can be clicked. Who sent
// an effect is described by the host (resources/sound-source.js): names,
// pictures and links, cached in _music.srcInfo.
// State: _music.hoverPt, hoverKey, hoverHeld, tipPinned, srcInfo.

var MU_TIP_HOLD_MS = 450;

/** Note boundaries: the envelope jumps (key-on), or the sample changes. */
function muSameNote(a, b) { return a.on && b.on && a.inst === b.inst && a.start === b.start && !muIsNoteStart(a.envx, b.envx); }

/** What the pointer is on, by time: { kind: 'sfx'|'note', v, t0, t1, ... } or null. */
function muHitAt(g, pt) {
  var f = g.frames;
  if (!pt || f.length < 2) return null;
  var v = Math.max(0, Math.min(7, Math.floor(pt.y / g.laneH))), t = g.now + (pt.x - g.playX) / g.k;
  if (t < f[0].time || t > f[f.length - 1].time + MU_FRAME_MS) return null;
  var i = 1;
  while (i < f.length - 1 && f[i].time < t) i++;
  var V = f[i].voices[v];
  if (V.own === 'sfx') {
    var run = muSfxRuns(f, v).filter(function (r) { return r.first <= i && i <= r.last; })[0];
    if (run) return { kind: 'sfx', v: v, t0: f[Math.max(0, run.first - 1)].time, t1: f[run.last].time, sfx: run.sfx, src: run.src, ahead: !!f[run.first].ahead };
  }
  if (!V.on) return null;
  var a = i, b = i;
  while (a > 1 && muSameNote(f[a - 1].voices[v], f[a].voices[v])) a--;
  while (b < f.length - 1 && muSameNote(f[b].voices[v], f[b + 1].voices[v])) b++;
  return { kind: 'note', v: v, t0: f[a - 1].time, t1: f[b].time, V: V, ahead: !!f[i].ahead };
}

/** The hit to show: under the pointer, else the held one (the pointer is on its way into the tooltip). */
function muHoverHit(g) {
  var held = _music.hoverHeld;
  if (_music.tipPinned && held) return held.hit;
  // On its way into the tooltip the pointer may cross other notes: inside the corridor
  // from where it was to the tooltip, the held hit stays.
  if (held && performance.now() < held.until && muInCorridor(_music.hoverPt, held.pt)) return held.hit;
  var hit = muHitAt(g, _music.hoverPt);
  if (hit) { _music.hoverHeld = { hit: hit, until: performance.now() + MU_TIP_HOLD_MS, pt: _music.hoverPt }; return hit; }
  if (held && performance.now() < held.until) return held.hit;
  _music.hoverHeld = null;
  return null;
}

/** Is `pt` between `from` and the shown tooltip (the box spanning both, a little wider)? */
function muInCorridor(pt, from) {
  var tip = document.getElementById('mu-tl-tip');
  if (!pt || !from || !tip || tip.style.display !== 'block') return false;
  if (Math.abs(pt.x - from.x) < 3 && Math.abs(pt.y - from.y) < 3) return false;   // still on the hit itself: re-test it
  var x0 = Math.min(from.x, tip.offsetLeft) - 6, x1 = Math.max(from.x, tip.offsetLeft + 24) + 6;
  var y0 = Math.min(from.y, tip.offsetTop) - 6, y1 = Math.max(from.y, tip.offsetTop + 24) + 6;
  var toward = (pt.x - from.x) * (tip.offsetLeft - from.x) >= 0 && (pt.y - from.y) * (tip.offsetTop - from.y) >= 0;
  return toward && pt.x >= x0 && pt.x <= x1 && pt.y >= y0 && pt.y <= y1;
}

/** A frame around the hovered note (boxes highlight themselves). */
function muDrawHoverMark(ctx, g, hit) {
  if (!hit || hit.kind !== 'note') return;
  var x1 = g.X(hit.t0), x2 = g.X(hit.t1), y0 = hit.v * g.laneH;
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x1, y0 + 1, x2 - x1, g.laneH - 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x1 + 0.5, y0 + 1.5, Math.max(2, x2 - x1 - 1), g.laneH - 3);
  ctx.lineWidth = 1;
}

function muWhen(g, hit) {
  var ago = g.now - hit.t1;
  return ((hit.t1 - hit.t0) / 1000).toFixed(2) + ' s · ' + (hit.ahead ? 'starts in ' + Math.max(0, (hit.t0 - g.now) / 1000).toFixed(1) + ' s (read ahead)' :
    ago <= 0 ? 'playing now' : 'ended ' + (ago / 1000).toFixed(1) + ' s ago');
}

function muSrcKey(src) { return src ? src.time + ':' + src.sfx + ':' + (src.entity || src.script || src.caller || src.kind) : ''; }

/** "+3.2 semitones" from a $30 offset (1/20 semitone). */
function muPitchLabel(n) { return (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n / 20).toFixed(1) + ' semitones'; }

function muLink(uri, text) { return uri ? '<a href="#" data-mu-open="' + muEsc(uri) + '">' + muEsc(text) + '</a>' : muEsc(text); }

/** Who sent it: from the host's description when it is here, else what the hook recorded. */
function muSourceHtml(hit) {
  var src = hit.src;
  if (!src) return '<div><span class="mu-tip-k">Sent by</span> ' + (hit.ahead ? 'not sent yet' : '<i>not recorded</i> (needs the emulator’s debugger core)') + '</div>';
  if (src.kind === 'tab') return '<div><span class="mu-tip-k">Sent by</span> clicked in this tab</div>';
  var key = muSrcKey(src), info = _music.srcInfo[key];
  if (info === undefined) { _music.srcInfo[key] = null; muPost({ command: 'musicDescribe', key: key, src: src }); }
  var html = '';
  if (info && info.who) {
    var w = info.who, a = info.animation, f = info.frame;
    html += '<div class="mu-tip-src">' + (w.image ? '<img src="' + w.image + '" alt="">' : '') + '<div>' +
      '<div><span class="mu-tip-k">Sent by</span> ' + muLink(w.uri, w.label) + ' <code>' + muHex(w.entity || 0, 4) + '</code></div>' +
      (a ? '<div><span class="mu-tip-k">Animation</span> ' + muLink(a.uri, a.label) + ' <code>' + a.record + '</code>' + (a.gif ? ' · ' + muLink(a.gif, 'GIF') : '') + '</div>' : '') +
      (f ? '<div class="mu-tip-k">' + muEsc(f.label) + '</div>' : '') + '</div>' +
      (f && f.image ? '<img class="mu-tip-frame" src="' + f.image + '" alt="" title="' + muEsc(f.label) + '">' : '') + '</div>';
  } else if (info && info.script) {
    html += '<div><span class="mu-tip-k">Sent by</span> ' + muLink(info.script.uri, info.script.label) + '</div>';
  } else if (info && info.engine) {
    html += '<div><span class="mu-tip-k">Sent by</span> engine code <code>' + muEsc(info.engine.label) + '</code></div>';
  } else {
    html += '<div><span class="mu-tip-k">Sent by</span> ' + muEsc(muSrcLabel(src)) + '</div>';
  }
  var p = info && info.pitch;
  if (p || typeof src.pitch === 'number') {
    var label = typeof src.pitch === 'number' ? muPitchLabel(src.pitch) : p.label;
    html += '<div class="mu-tip-pitch"><span class="mu-tip-k">Pitch</span> ' + muEsc(label) + (p && p.why ? ' · ' + muLink(p.uri, p.why) : '') + '</div>';
  }
  return html;
}

function muHoverHtml(g, hit) {
  if (hit.kind === 'sfx') {
    var info = muSfxInfo(hit.sfx), s = _music.model && _music.model.sfx[hit.sfx];
    return '<b>' + MU_CAT_ICONS[info.cat] + ' ' + muEsc(info.name) + '</b> <code>' + muHex(hit.sfx, 2) + '</code> · V' + hit.v +
      '<div>' + muWhen(g, hit) + '</div>' + muSourceHtml(hit) +
      (info.source ? '<div><span class="mu-tip-k">Animations that play it</span> ' + muEsc(muSfxSource(s, 6)) + '</div>' : '') +
      (s && s.pitch ? '<div><span class="mu-tip-k">Varies</span> ' + muEsc(muPitchVariants(s.pitch)) + '</div>' : '') +
      '<div><span class="mu-tip-k">Package</span> ' + (s && s.package ? muHex(s.package, 2) + ' (' + muEsc(muPackageName(s.package)) + ')' : 'base bank') + '</div>';
  }
  var V = hit.V;
  return '<b>♪ Music track ' + V.track + '</b> · V' + hit.v +
    '<div>' + (V.inst >= 0 ? 'sample ' + muHex(V.inst, 2) : 'sample at ' + muHex(V.start, 4)) + ' · ' + (V.st >= 0 ? '+' : '') + V.st.toFixed(1) + ' semitones</div>' +
    '<div>' + muWhen(g, hit) + '</div>';
}

/** "pitch by stamina, or +6.4 / −9.6 semitones": an effect's variations (model sfx.pitch). */
function muPitchVariants(p) {
  var parts = [];
  if (p.stamina) parts.push('lower with the Boy’s stamina');
  if (p.offsets.length) parts.push(p.offsets.map(function (n) { return muPitchLabel(n).replace(' semitones', ''); }).join(' / ') + ' semitones');
  return 'pitch: ' + parts.join(', or ');
}

/** The tooltip and the emulator's mark follow the hit; both change only when it does. */
function muUpdateHoverTip(hit, g) {
  var tip = document.getElementById('mu-tl-tip');
  if (!tip) return;
  var key = hit ? hit.kind + ':' + hit.v + ':' + hit.t0 + ':' + (hit.kind === 'sfx' ? hit.sfx : hit.V.inst) : '';
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
  if (!hit) { tip.style.display = 'none'; _music.tipPinned = false; return; }
  var html = muHoverHtml(g, hit);
  if (tip._html !== html) { tip._html = html; tip.innerHTML = html; }
  tip.style.display = 'block';
  if (_music.tipPinned) return;   // keep it where it is while the pointer is inside
  var pt = (_music.hoverHeld && _music.hoverHeld.pt) || _music.hoverPt || { x: 0, y: 0 };
  var w = tip.offsetWidth, h = tip.offsetHeight, W = tip.parentElement.clientWidth, H = tip.parentElement.clientHeight;
  tip.style.left = Math.max(4, Math.min(W - w - 4, pt.x + 6)) + 'px';
  tip.style.top = Math.max(4, Math.min(H - h - 4, pt.y + 6)) + 'px';
}

function muBindTimelineHover() {
  var box = document.getElementById('mu-tl-viewport'), tip = document.getElementById('mu-tl-tip');
  if (!box || !tip) return;
  box.addEventListener('mousemove', function (e) {
    if (tip.contains(e.target)) return;
    var r = box.getBoundingClientRect();
    _music.hoverPt = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  box.addEventListener('mouseleave', function () { _music.hoverPt = null; _music.tipPinned = false; });
  tip.addEventListener('mouseenter', function () { if (_music.hoverHeld) _music.tipPinned = true; });
  tip.addEventListener('mouseleave', function () { _music.tipPinned = false; if (_music.hoverHeld) _music.hoverHeld.until = 0; });
  tip.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-mu-open]') : null;
    if (!a) return;
    e.preventDefault();
    muPost({ command: 'musicOpen', uri: a.dataset.muOpen });
  });
}
