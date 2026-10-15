// Ownership: drawing a Secret of Mana map into an SVG — the picture URL, the collision and special-cell
// overlays and the tile animation. Pixels are SVG units (16 per cell); the zoom is the shell's
// (zoom-pan.js sets the SVG's width/height), so nothing is scaled by CSS (VS Code's default
// `img { max-width: 100% }` is what squashed maps before).
// Uses mapAnimPlay from src/shared/webview/map-view/tile-animation.js.

var SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  var e = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
  return e;
}

/** The picture for the visible layers: both, BG1 (layer A) or BG2 (layer B). */
function mapPictureUrl(somBase, hex, layers) {
  var ext = layers.a && layers.b ? 'png' : layers.a ? 'a.png' : 'b.png';
  return somBase + 'maps/' + hex + '.' + ext;
}

var TRIANGLES = {
  4: [[0, 0], [0, 16], [16, 16]],      // bottom-left half solid
  5: [[0, 0], [16, 0], [16, 16]],      // top-right
  6: [[0, 0], [16, 0], [0, 16]],       // top-left
  7: [[16, 0], [16, 16], [0, 16]],     // bottom-right
};

/** Collision overlay from som://rom/maps/<id>.collision.json. */
function drawCollision(svg, c) {
  var paths = { wall: '', l1: '', l0: '', diag: '' };
  for (var i = 0; i < c.w * c.h; i++) {
    var x = (i % c.w) * 16, y = Math.floor(i / c.w) * 16;
    var f = c.floor.charCodeAt(i) - 48, d = c.diagonal.charCodeAt(i) - 48;
    var cell = 'M' + x + ' ' + y + 'h16v16h-16z';
    if (d) {
      var t = TRIANGLES[d];
      paths.diag += 'M' + (x + t[0][0]) + ' ' + (y + t[0][1]) + 'L' + (x + t[1][0]) + ' ' + (y + t[1][1])
        + 'L' + (x + t[2][0]) + ' ' + (y + t[2][1]) + 'z';
    } else if (f === 3) paths.wall += cell;
    if (f === 1) paths.l1 += cell;
    else if (f === 0 && !d) paths.l0 += cell;
  }
  var g = svgEl('g', { 'class': 'mm-collision', 'pointer-events': 'none' });
  Object.keys(paths).forEach(function (k) {
    if (paths[k]) g.appendChild(svgEl('path', { d: paths[k], 'class': 'mc-' + k }));
  });
  (c.switches || []).forEach(function (p) {
    g.appendChild(svgEl('rect', { x: p[0] * 16 + 2, y: p[1] * 16 + 2, width: 12, height: 12, 'class': 'mc-switch' }));
  });
  svg.appendChild(g);
  return g;
}

/** Special cells (collision byte 1 bit 7): outlined, labelled with that byte. */
function drawSpecials(svg, c) {
  var g = svgEl('g', { 'class': 'mm-specials', 'pointer-events': 'none' });
  (c.specials || []).forEach(function (s) {
    g.appendChild(svgEl('rect', { x: s.x * 16 + 0.5, y: s.y * 16 + 0.5, width: 15, height: 15, 'class': 'ms-cell' }));
    var t = svgEl('text', { x: s.x * 16 + 8, y: s.y * 16 + 10.5, 'class': 'ms-label' });
    t.textContent = s.kind.toString(16).toUpperCase();
    g.appendChild(t);
  });
  svg.appendChild(g);
  return g;
}

/** Start the animation from som://rom/maps/<id>.anim.json; returns the player or null. */
function playAnimation(svg, a) {
  if (!a || !a.kinds || !a.kinds.length) return null;
  var groups = a.kinds.map(function (k) {
    var delays = k.starts.map(function (s, i) {
      var next = i + 1 < k.starts.length ? k.starts[i + 1] : a.length;
      return (next - s) * 1000 / 60;
    });
    return {
      frames: k.frames.map(function (i) { return a.images[i]; }),
      delays: delays,
      at: k.cells.map(function (p) { return { x: p[0] * 16, y: p[1] * 16, w: 16, h: 16 }; }),
    };
  });
  return mapAnimPlay(svg, groups, { after: svg.querySelector('.mm-picture'), randomPhase: false });
}
