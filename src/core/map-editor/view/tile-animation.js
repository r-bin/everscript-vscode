// Ownership: playing tile animations over an SVG map — shared by the Evermore Rooms
// tab (src/rooms/webview/animation.js) and the Secret of Mana Maps panel.
// Plain browser script: defines globals, loaded as a file or concatenated.
//
// A group is one animation: its frames (image URLs), how long each shows (ms), and
// every rectangle it is drawn at (SVG units). A group drawn at several places is
// one <image> in <defs> plus a <use> per place, so a frame change is one attribute
// write however many cells share it.
//
// One rAF loop per player rather than a timer per group: a map can have hundreds
// of groups, and that many intervals makes panning stutter. rAF also pauses with
// the tab, so nothing queues up while nobody looks.

var _mapAnimSeq = 0;

/**
 * Start playing `groups` over `svg`. The layer goes right after `opts.after`
 * (the map image) so interactive overlays stay on top, else at the end.
 * `opts.randomPhase`: start each group at a random point of its cycle (Evermore's
 * channels have their own phase); off keeps every group in step.
 * Returns a handle with stop(). Without rAF (test harness) the first frame shows.
 */
function mapAnimPlay(svg, groups, opts) {
  opts = opts || {};
  var ns = 'http://www.w3.org/2000/svg';
  var layer = document.createElementNS(ns, 'g');
  if (opts.id) layer.setAttribute('id', opts.id);
  layer.setAttribute('pointer-events', 'none');
  var defs = document.createElementNS(ns, 'defs');
  layer.appendChild(defs);
  var live = [];
  var prefix = 'mva' + (++_mapAnimSeq) + '-';
  (groups || []).forEach(function (g, gi) {
    if (!g.frames || !g.frames.length || !g.at || !g.at.length) return;
    var el;
    if (g.at.length === 1) {
      el = mapAnimImage(ns, g.at[0], g.frames[0], opts.imageClass);
      layer.appendChild(el);
    } else {
      el = mapAnimImage(ns, { x: 0, y: 0, w: g.at[0].w, h: g.at[0].h }, g.frames[0], opts.imageClass);
      el.setAttribute('id', prefix + gi);
      defs.appendChild(el);
      g.at.forEach(function (r) {
        var use = document.createElementNS(ns, 'use');
        use.setAttribute('href', '#' + prefix + gi);
        use.setAttribute('x', r.x);
        use.setAttribute('y', r.y);
        layer.appendChild(use);
      });
    }
    var first = g.delays[0] || 120;
    live.push({ el: el, frames: g.frames, delays: g.delays, i: 0, due: opts.randomPhase ? first * Math.random() : first });
  });
  var after = opts.after;
  if (after && after.parentNode === svg && after.nextSibling) svg.insertBefore(layer, after.nextSibling);
  else svg.appendChild(layer);

  var raf = 0, last = 0;
  function tick(now) {
    raf = 0;
    var dt = last ? Math.min(now - last, 250) : 0;
    last = now;
    for (var k = 0; k < live.length; k++) {
      var a = live[k];
      a.due -= dt;
      if (a.due > 0) continue;
      a.i = (a.i + 1) % a.frames.length;
      a.el.setAttribute('href', a.frames[a.i]);
      // Add rather than assign, so a slow frame does not drift the whole cycle.
      a.due += (a.delays[a.i] || 120);
      if (a.due < 0) a.due = a.delays[a.i] || 120;
    }
    raf = requestAnimationFrame(tick);
  }
  if (live.length && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(tick);
  return {
    layer: layer,
    stop: function () {
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      raf = 0;
      live = [];
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    },
  };
}

function mapAnimImage(ns, r, href, cls) {
  var img = document.createElementNS(ns, 'image');
  if (cls) img.setAttribute('class', cls);
  img.setAttribute('x', r.x);
  img.setAttribute('y', r.y);
  img.setAttribute('width', r.w);
  img.setAttribute('height', r.h);
  img.setAttribute('preserveAspectRatio', 'none');
  img.setAttribute('href', href);
  return img;
}
