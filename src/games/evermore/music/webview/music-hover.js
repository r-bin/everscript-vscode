// Ownership: the timeline's hover: what is under the pointer (a note or an
// effect's box, in history or the read-ahead), its highlight, the tooltip, and
// pointing the emulator at the entity that sent the effect. Works paused too:
// the timeline keeps drawing.
//
// The tooltip is short: what, when, from whom. Each underlined item opens a
// card with its details when hovered (who with a picture, the animation with
// its GIF and the script lines around the sound command, the frame, the pitch,
// the variations, the engine code or script excerpt); every link opens the
// soe:// page. Both float above the whole page (position: fixed). The tooltip
// can be entered: a hit is held while the pointer moves to it and frozen while
// it is inside. Who sent an effect is described by the host
// (resources/sound-source.ts), cached in _music.srcInfo.
// State: _music.hoverPt, hoverClient, hoverKey, hoverHeld, tipPinned, srcInfo.

var MU_TIP_HOLD_MS = 450;
var MU_CARD_HIDE_MS = 220;

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

/** Is the client point `pt` between `from` and the tooltip (on its way in)? */
function muInCorridor(pt, from) {
  var tip = document.getElementById('mu-tl-tip');
  if (!pt || !from || !tip || tip.style.display !== 'block') return false;
  if (Math.abs(pt.x - from.x) < 3 && Math.abs(pt.y - from.y) < 3) return false;
  var r = tip.getBoundingClientRect();
  var tx = Math.max(r.left, Math.min(r.right, from.x)), ty = Math.max(r.top, Math.min(r.bottom, from.y));
  var x0 = Math.min(from.x, tx) - 8, x1 = Math.max(from.x, tx) + 8, y0 = Math.min(from.y, ty) - 8, y1 = Math.max(from.y, ty) + 8;
  return pt.x >= x0 && pt.x <= x1 && pt.y >= y0 && pt.y <= y1;
}

/** The hit to show: under the pointer, else the held one (the pointer is on its way into the tooltip). */
function muHoverHit(g) {
  var held = _music.hoverHeld;
  if (_music.tipPinned && held) return held.hit;
  if (held && performance.now() < held.until && muInCorridor(_music.hoverClient, held.client)) return held.hit;
  var hit = muHitAt(g, _music.hoverPt);
  if (hit) { _music.hoverHeld = { hit: hit, until: performance.now() + MU_TIP_HOLD_MS, client: _music.hoverClient }; return hit; }
  if (held && performance.now() < held.until) return held.hit;
  _music.hoverHeld = null;
  return null;
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
  return ((hit.t1 - hit.t0) / 1000).toFixed(2) + ' s · ' + (hit.ahead ? 'in ' + Math.max(0, (hit.t0 - g.now) / 1000).toFixed(1) + ' s (read ahead)' :
    ago <= 0 ? 'playing now' : (ago / 1000).toFixed(1) + ' s ago');
}

function muSrcKey(src) { return src ? src.time + ':' + src.sfx + ':' + (src.entity || src.script || src.caller || src.kind) : ''; }

/** "+3.2 semitones" from a $30 offset (1/20 semitone). */
function muPitchLabel(n) { return (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n / 20).toFixed(1) + ' semitones'; }

function muLink(uri, text) { return uri ? '<a href="#" data-mu-open="' + muEsc(uri) + '">' + muEsc(text) + '</a>' : muEsc(text); }

/** An item with a card: `html` shows inline, the card opens on hover. */
function muCardItem(cards, id, html, card) { cards[id] = card; return '<span class="mu-tip-more" data-mu-card="' + id + '">' + html + '</span>'; }

function muLines(lines) {
  return '<div class="mu-card-code">' + lines.map(function (l) {
    return '<div' + (l.mark ? ' class="mu-code-mark"' : '') + '><code>' + muEsc(l.addr) + '</code> ' + muEsc(l.text) + '</div>';
  }).join('') + '</div>';
}

/** "pitch: lower with the Boy's stamina, or +6.4 / −9.6 semitones" (model sfx.pitch). */
function muPitchVariants(p) {
  var parts = [];
  if (p.stamina.length) parts.push('lower with the Boy’s stamina');
  if (p.offsets.length) parts.push(p.offsets.length + ' fixed shift' + (p.offsets.length > 1 ? 's' : ''));
  return 'pitch varies: ' + parts.join(', ');
}

function muVariantsCard(p) {
  var rows = (p.stamina.length ? '<tr><td>by stamina</td><td>' + muEsc(muShortList(p.stamina)) + '</td></tr>' : '') +
    p.offsets.map(function (o) { return '<tr><td>' + muPitchLabel(o.n) + '</td><td>' + muEsc(muShortList(o.by)) + '</td></tr>'; }).join('');
  return '<b>The same sound, higher or lower</b><div class="mu-card-k">The animation sends a pitch (driver command $30) just before it.</div>' +
    '<table class="mu-card-table">' + rows + '</table>';
}

function muShortList(list, n) { n = n || 3; return list.slice(0, n).join(', ') + (list.length > n ? ' +' + (list.length - n) : ''); }

function muPlayedByCard(s) {
  var by = {};
  (s.animations || []).forEach(function (a) { (by[a.who] = by[a.who] || []).push(a.what); });
  var whos = Object.keys(by);
  return '<b>Animations that play it</b><table class="mu-card-table">' + whos.slice(0, 14).map(function (w) {
    return '<tr><td>' + muEsc(w) + '</td><td>' + muEsc(muShortList(by[w].filter(Boolean), 4)) + '</td></tr>';
  }).join('') + '</table>' + (whos.length > 14 ? '<div class="mu-card-k">+' + (whos.length - 14) + ' more</div>' : '');
}

/** "from Boy (Gladiator Sword) · animation Bone Crusher · Attack Lvl 1", each with a card. */
function muSourceHtml(hit, cards) {
  var src = hit.src;
  if (!src) return '<div class="mu-tip-row"><span class="mu-tip-k">from</span> ' + (hit.ahead ? 'not sent yet' : '<i>unknown</i> <span class="mu-tip-k">(needs the emulator’s debugger core)</span>') + '</div>';
  if (src.kind === 'tab') return '<div class="mu-tip-row"><span class="mu-tip-k">from</span> a click in this tab</div>';
  var key = muSrcKey(src), info = _music.srcInfo[key];
  if (info === undefined) { _music.srcInfo[key] = null; muPost({ command: 'musicDescribe', key: key, src: src }); }
  if (!info) return '<div class="mu-tip-row"><span class="mu-tip-k">from</span> ' + muEsc(muSrcLabel(src)) + '</div>';
  var html = '';
  if (info.who) {
    var w = info.who, a = info.animation, f = info.frame;
    var whoCard = (w.image ? '<img class="mu-card-img" src="' + w.image + '" alt="">' : '') + '<b>' + muEsc(w.label) + '</b>' +
      (w.form ? '<div>' + muEsc(w.form) + '</div>' : '') + '<div class="mu-card-k">entity ' + muHex(w.entity || 0, 4) + ', marked in the emulator</div>' +
      (w.uri ? '<div>' + muLink(w.uri, 'Open ' + w.label) + '</div>' : '');
    html += '<div class="mu-tip-row mu-tip-src">' + (w.image ? '<img src="' + w.image + '" alt="">' : '') + '<div>' +
      '<div><span class="mu-tip-k">from</span> ' + muCardItem(cards, 'who', muEsc(w.label), whoCard) + (w.form ? ' <span class="mu-tip-k">with ' + muEsc(w.form) + '</span>' : '') + '</div>';
    if (a) {
      var animCard = (a.gifImage ? '<img class="mu-card-img" src="' + a.gifImage + '" alt="">' : '') + '<b>' + muEsc(a.label) + '</b> <code>' + a.record + '</code>' +
        (a.lines.length ? '<div class="mu-card-k">its script; the sound command is marked</div>' + muLines(a.lines) : '') +
        '<div>' + muLink(a.uri, 'Open the animation') + (a.gif ? ' · ' + muLink(a.gif, 'GIF') : '') + '</div>';
      html += '<div><span class="mu-tip-k">animation</span> ' + muCardItem(cards, 'anim', muEsc(a.label), animCard) + '</div>';
    }
    html += '</div>';
    if (f && f.image) html += muCardItem(cards, 'frame', '<img class="mu-tip-frame" src="' + f.image + '" alt="">', '<img class="mu-card-img mu-card-big" src="' + f.image + '" alt=""><div>' + muEsc(f.label) + '</div><div class="mu-card-k">the frame the sound plays on</div>');
    html += '</div>';
  } else if (info.script) {
    var sc = info.script;
    html += '<div class="mu-tip-row"><span class="mu-tip-k">from</span> ' + muCardItem(cards, 'script', muEsc(sc.label),
      '<b>' + muEsc(sc.label) + '</b>' + (sc.lines.length ? muLines(sc.lines) : '') + '<div>' + muLink(sc.uri, 'Open the script') + '</div>') + '</div>';
  } else if (info.engine) {
    var en = info.engine;
    html += '<div class="mu-tip-row"><span class="mu-tip-k">from</span> ' + muCardItem(cards, 'engine', 'engine code ' + muEsc(en.label),
      '<b>Engine code ' + muEsc(en.label) + '</b><div class="mu-card-k">the call that played it is marked · ' + muEsc(en.note) + '</div>' +
      muLines(en.lines) + '<div>' + muLink(en.uri, 'Open the listing') + '</div>') + '</div>';
  }
  var p = info.pitch;
  if (p || typeof src.pitch === 'number') {
    var label = typeof src.pitch === 'number' ? muPitchLabel(src.pitch) : p.label;
    html += '<div class="mu-tip-row"><span class="mu-tip-k">pitch</span> ' + (p && p.why ? muCardItem(cards, 'pitch', muEsc(label),
      '<b>Pitch ' + muEsc(label) + '</b><div>' + muEsc(p.why) + '</div>' + (p.uri ? '<div>' + muLink(p.uri, 'Open the Boy’s stamina') + '</div>' : '')) : muEsc(label)) + '</div>';
  }
  return html;
}

function muHoverHtml(g, hit, cards) {
  if (hit.kind === 'sfx') {
    var info = muSfxInfo(hit.sfx), s = _music.model && _music.model.sfx[hit.sfx];
    var chips = ['<span class="mu-tip-chip">' + (s && s.package ? 'package ' + muHex(s.package, 2) : 'base bank') + '</span>'];
    if (s && s.pitch) chips.push(muCardItem(cards, 'var', '<span class="mu-tip-chip">pitch varies</span>', muVariantsCard(s.pitch)));
    if (s && s.animations && s.animations.length) chips.push(muCardItem(cards, 'plays', '<span class="mu-tip-chip">' + 'played in ' + s.animations.length + ' animations</span>', muPlayedByCard(s)));
    return '<div class="mu-tip-title">' + MU_CAT_ICONS[info.cat] + ' <b>' + muEsc(info.name) + '</b> <code>' + muHex(hit.sfx, 2) + '</code> <span class="mu-tip-k">V' + hit.v + '</span></div>' +
      '<div class="mu-tip-k mu-tip-when"></div>' + muSourceHtml(hit, cards) + '<div class="mu-tip-chips">' + chips.join('') + '</div>';
  }
  var V = hit.V;
  return '<div class="mu-tip-title">♪ <b>Music track ' + V.track + '</b> <span class="mu-tip-k">V' + hit.v + '</span></div>' +
    '<div>' + (V.inst >= 0 ? 'sample ' + muHex(V.inst, 2) : 'sample at ' + muHex(V.start, 4)) + ' · ' + (V.st >= 0 ? '+' : '') + V.st.toFixed(1) + ' semitones</div>' +
    '<div class="mu-tip-k mu-tip-when"></div>';
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
  if (!hit) { tip.style.display = 'none'; _music.tipPinned = false; muHideCard(true); return; }
  var cards = {}, html = muHoverHtml(g, hit, cards);
  tip._cards = cards;
  if (tip._html !== html) { tip._html = html; tip.innerHTML = html; }
  var when = tip.querySelector('.mu-tip-when');   // changes every frame: text only, the cards stay
  if (when) when.textContent = muWhen(g, hit);
  tip.style.display = 'block';
  if (_music.tipPinned) return;   // keep it where it is while the pointer is inside
  var pt = (_music.hoverHeld && _music.hoverHeld.client) || _music.hoverClient || { x: 0, y: 0 };
  var w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.max(4, Math.min(innerWidth - w - 4, pt.x + 8)) + 'px';
  tip.style.top = Math.max(4, Math.min(innerHeight - h - 4, pt.y + 8)) + 'px';
}

/** The card of a tooltip item, beside it. */
function muShowCard(item) {
  var tip = document.getElementById('mu-tl-tip'), card = document.getElementById('mu-tl-card');
  if (!tip || !card || !tip._cards) return;
  var html = tip._cards[item.dataset.muCard];
  if (!html) return;
  clearTimeout(_music.cardTimer);
  if (card._for !== item.dataset.muCard || card.innerHTML !== html) { card.innerHTML = html; card._for = item.dataset.muCard; }
  card.style.display = 'block';
  var r = item.getBoundingClientRect(), tr = tip.getBoundingClientRect(), w = card.offsetWidth, h = card.offsetHeight;
  var left = tr.right + 6 + w <= innerWidth ? tr.right + 6 : Math.max(4, tr.left - w - 6);
  card.style.left = left + 'px';
  card.style.top = Math.max(4, Math.min(innerHeight - h - 4, r.top - 8)) + 'px';
}

function muHideCard(now) {
  var card = document.getElementById('mu-tl-card');
  if (!card) return;
  clearTimeout(_music.cardTimer);
  if (now) { card.style.display = 'none'; return; }
  _music.cardTimer = setTimeout(function () { card.style.display = 'none'; }, MU_CARD_HIDE_MS);
}

function muBindTimelineHover() {
  var box = document.getElementById('mu-tl-viewport'), tip = document.getElementById('mu-tl-tip'), card = document.getElementById('mu-tl-card');
  if (!box || !tip || !card) return;
  box.addEventListener('mousemove', function (e) {
    var r = box.getBoundingClientRect();
    _music.hoverPt = { x: e.clientX - r.left, y: e.clientY - r.top };
    _music.hoverClient = { x: e.clientX, y: e.clientY };
  });
  box.addEventListener('mouseleave', function (e) {
    if (tip.contains(e.relatedTarget) || card.contains(e.relatedTarget)) return;
    _music.hoverPt = null;
  });
  var enter = function () { if (_music.hoverHeld) _music.tipPinned = true; clearTimeout(_music.cardTimer); };
  var leave = function (e) {
    if (tip.contains(e.relatedTarget) || card.contains(e.relatedTarget)) return;
    _music.tipPinned = false; _music.hoverPt = null;
    if (_music.hoverHeld) _music.hoverHeld.until = 0;
    muHideCard();
  };
  [tip, card].forEach(function (el) {
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    el.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-mu-open]') : null;
      if (!a) return;
      e.preventDefault();
      muPost({ command: 'musicOpen', uri: a.dataset.muOpen });
    });
  });
  tip.addEventListener('mouseover', function (e) {
    var item = e.target.closest ? e.target.closest('[data-mu-card]') : null;
    if (item) muShowCard(item); else if (!card.contains(e.target)) muHideCard();
  });
}
