// Ownership: a widget's stored shape and its colourings. Stored: `cells`
// (frame 0), `frames`, `animated`. Colourings (`variations`) are derived from
// the art, never stored or painted: one per family vanilla draws any of its
// graphics in, read off what the host sends with the library
// (`graphicFamilies`, rooms/custom-host.js). Split out of
// map-editor-widgets.js.
//
// Owns: _widgetFamilies.

/** graphic -> [[family, uses], ...] vanilla attests, sent with the library. */
var _widgetFamilies = {};

/**
 * The colourings vanilla attests for these cells: every family any of their
 * graphics is drawn in, most-placed (summed over the graphics) first. A
 * union, not an intersection — the urn's top half in #127 is a colouring
 * worth having. Read off what the host sends with the library
 * (`_widgetFamilies`, custom-host.js), never a hand-kept list: one of those
 * offered three urn colours no room ever used. null until it is known.
 */
function widgetAttestedFamilies(cells) {
  var uses = {}, order = [], known = false;
  (cells || []).forEach(function (c) {
    [c.canopy, c.terrain].forEach(function (part) {
      var fams = part && _widgetFamilies[part.graphic];
      if (!fams) return;
      known = true;
      fams.forEach(function (fu) {
        if (!(fu[0] in uses)) { uses[fu[0]] = 0; order.push(fu[0]); }
        uses[fu[0]] += fu[1];
      });
    });
  });
  if (!known) return null;
  return order.sort(function (x, y) { return uses[y] - uses[x]; });
}

/** The cells of `cells` recoloured into `fam`. */
function widgetCellsInFamily(cells, fam) {
  return (cells || []).map(function (c) {
    return {
      dx: c.dx, dy: c.dy,
      canopy: c.canopy ? { graphic: c.canopy.graphic, family: fam, flags: c.canopy.flags || 0 } : null,
      terrain: c.terrain ? { graphic: c.terrain.graphic, family: fam, flags: c.terrain.flags || 0 } : null,
      collision: c.collision,
    };
  });
}

/** A variation with no cell in any frame: an unpainted "+ Var" from before they went. */
function widgetVarEmpty(v) {
  return !(v.frames || []).some(function (f) { return (f.cells || []).length; });
}

/**
 * The widget's own frames — what its canvas edits. A library saved while
 * variations were hand-made keeps the first one with art (a hand-made one
 * before a generated colouring); their other variations were colourings or
 * empty, and colourings are derived now.
 */
function widgetBaseFrames(w) {
  if (Array.isArray(w.frames) && w.frames.length) return w.frames;
  var vars = (w.variations || []).filter(function (v) { return !widgetVarEmpty(v); });
  var own = vars.filter(function (v) { return !/^fam-\d+$/.test(v.id); })[0] || vars[0];
  if (own && own.frames && own.frames.length) return own.frames;
  return [{ cells: w.cells || [], delay: 8 }];
}

/** A widget as it arrives from the host, in the stored shape (`frames`, `animated`, no `variations`). */
function widgetNormalize(w) {
  if (!w) return w;
  var frames = widgetBaseFrames(w);
  w.frames = frames;
  w.cells = frames[0].cells || [];
  if (w.animated == null) w.animated = frames.length > 1;
  delete w.variations;
  delete w.activeVariation;
  return w;
}

/** A widget's triggers and objects with every object state recoloured into `fam`. */
function widgetAttachmentsInFamily(a, fam) {
  if (!a) return a;
  return Object.assign({}, a, { objects: (a.objects || []).map(function (o) {
    return Object.assign({}, o, {
      cells: widgetCellsInFamily(o.cells, fam),
      frames: o.frames ? o.frames.map(function (f) { return widgetCellsInFamily(f, fam); }) : o.frames,
    });
  }) });
}

/**
 * A widget's colourings, derived: one per family vanilla draws its art in
 * (`fam-<id>`), with every animation frame and every object state recoloured
 * — not only the tiles it stamps. None when its art has one family, or the
 * families are not known yet.
 */
function widgetEnsureVariations(w) {
  if (!w || w.variations) return;
  var base = widgetBaseFrames(w);
  var fams = widgetAttestedFamilies(base[0].cells || w.cells);
  if (!fams || fams.length < 2) return;
  w.variations = fams.map(function (fam) {
    return { id: 'fam-' + fam, name: '#' + fam,
      frames: base.map(function (f) { return { cells: widgetCellsInFamily(f.cells, fam), delay: f.delay != null ? f.delay : 8 }; }),
      attachments: widgetAttachmentsInFamily(w.attachments, fam) };
  });
}
