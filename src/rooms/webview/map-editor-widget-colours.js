// Ownership: a widget's stored shape and its colourings. Stored: `cells`,
// each part with the channel it moves on (`anim`) or none. Colourings
// (`variations`) are derived from the art, never stored or painted: one per family vanilla draws any of its
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
      canopy: c.canopy ? Object.assign({}, c.canopy, { family: fam, flags: c.canopy.flags || 0 }) : null,
      terrain: c.terrain ? Object.assign({}, c.terrain, { family: fam, flags: c.terrain.flags || 0 }) : null,
      collision: c.collision,
      special: c.special,
    };
  });
}

/**
 * The cells a widget stamps. A library from before keeps frame 0 of its
 * first variation with art (a hand-made one before a generated colouring);
 * its other frames are gone — animation is the Animation tab's now.
 */
function widgetBaseCells(w) {
  var hasArt = function (f) { return f && (f.cells || []).length; };
  if ((w.cells || []).length) return w.cells;
  var fr = (w.frames || []).filter(hasArt)[0];
  if (fr) return fr.cells;
  var vars = (w.variations || []).filter(function (v) { return (v.frames || []).some(hasArt); });
  var own = vars.filter(function (v) { return !/^fam-\d+$/.test(v.id); })[0] || vars[0];
  return own ? own.frames.filter(hasArt)[0].cells : [];
}

/** A widget as it arrives from the host, in the stored shape: cells, no frames or variations. */
function widgetNormalize(w) {
  if (!w) return w;
  w.cells = widgetBaseCells(w);
  delete w.frames;
  delete w.animated;
  delete w.variations;
  delete w.activeVariation;
  return w;
}

/** Whether any of a widget's tiles moves (`anim` on a cell part). */
function widgetAnimated(w) {
  return (w.cells || []).some(function (c) { return (c.canopy && c.canopy.anim) || (c.terrain && c.terrain.anim); });
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
 * (`fam-<id>`), with every object state recoloured too — not only the tiles
 * it stamps. None when its art has one family, or the families are not
 * known yet.
 */
function widgetEnsureVariations(w) {
  if (!w || w.variations) return;
  var fams = widgetAttestedFamilies(w.cells);
  if (!fams || fams.length < 2) return;
  w.variations = fams.map(function (fam) {
    return { id: 'fam-' + fam, name: '#' + fam, cells: widgetCellsInFamily(w.cells, fam),
      attachments: widgetAttachmentsInFamily(w.attachments, fam) };
  });
}
