// Ownership: collision in the editor — the shape a tile is suggested to
// have, drawn on its swatch, and the collision layer of a drafted map.
//
// Both follow the bottom bar's Collision toggle (the `c` feature flag,
// rom-overlay.js). The suggestion is the collision *shape* vanilla gives the
// graphic on that layer (maps/vanilla-suggest.ts suggestGeometry; the family
// sheet carries it per slot, room-draft.js). Painting a tile writes that
// shape into the stamp it makes (editUseFamilyTile), so the map then shows
// it — drawn by the host with the same renderer as a ROM room
// (buildDraftCollision), because a custom map has no ROM render to carry it.
//
// See docs/map-format/collision-suggestions.md.
//
// Owns: _draftCollTimer.

var _draftCollTimer = null;

/** Plane 0's contour colour and the wall tint, as maps/overlay-features.ts draws them. */
var COLL_LINE = 'rgb(0,170,255)';
var COLL_FILL = 'rgba(235,60,60,.18)';

/** Below this share of vanilla agreeing, a suggestion is shown as unsure. */
var COLL_SURE_PCT = 60;

/**
 * The solid part of each geometry code, as a polygon in a 16x16 cell —
 * the same regions as maps/collision.ts geometryMask. Open (0) and codes
 * with no solid pixels have none.
 */
var COLL_SHAPES = {
  0x0f: '0,0 16,0 16,16 0,16',
  0x02: '0,0 0,16 16,16', 0x06: '0,0 0,16 16,16',
  0x01: '16,0 16,16 0,16', 0x05: '16,0 16,16 0,16',
  0x0a: '0,0 16,0 0,16', 0x0e: '0,0 16,0 0,16',
  0x09: '0,0 16,0 16,16', 0x0d: '0,0 16,0 16,16',
  0x03: '0,8 16,8 16,16 0,16', 0x04: '0,8 16,8 16,16 0,16',
  0x0c: '0,0 16,0 16,8 0,8', 0x0b: '0,0 16,0 16,8 0,8',
  0x08: '8,0 16,0 16,16 8,16',
  0x07: '0,0 8,0 8,16 0,16',
};

function collisionOn() {
  return typeof _currentOverlay === 'string' && _currentOverlay.indexOf('c') >= 0;
}

/**
 * What a family-sheet slot suggests on the layer it would be painted on:
 * `{shape, pct}`, or null when vanilla never drew it there. Slot rows are
 * room-draft.js's `[.., groundShape, groundPct, frontShape, frontPct]`.
 */
function tileCollisionFor(slot, layer) {
  if (!slot || slot.length < 10) return null;
  var shape = layer === 'canopy' ? slot[8] : slot[6];
  var pct = layer === 'canopy' ? slot[9] : slot[7];
  return shape < 0 ? null : { shape: shape, pct: pct };
}

/** The layer a tile would be painted on — the same choice editUseFamilyTile makes. */
function tilePaintLayer(graphicId) {
  var prefer = (typeof _layerForce !== 'undefined' && _layerForce) || editLayerPreference(graphicId);
  return prefer === 'canopy' ? 'canopy' : 'terrain';
}

/** The swatch mark: the suggested shape, and how sure vanilla is. */
function tileCollisionMarkHtml(slot) {
  if (!collisionOn()) return '';
  var s = tileCollisionFor(slot, tilePaintLayer(slot[2]));
  if (!s) return '<svg class="rg-coll-mark" viewBox="0 0 16 16"><text x="8" y="11" class="rg-coll-q">?</text></svg>';
  var unsure = s.pct < COLL_SURE_PCT;
  var poly = COLL_SHAPES[s.shape];
  return '<svg class="rg-coll-mark' + (unsure ? ' unsure' : '') + '" viewBox="0 0 16 16">'
    + (poly ? '<polygon points="' + poly + '" fill="' + COLL_FILL + '" stroke="' + COLL_LINE
      + '" stroke-width="1"' + (unsure ? ' stroke-dasharray="2 1.5"' : '') + '/>' : '')
    + '<text x="15.5" y="15.2" class="rg-coll-pct">' + s.pct + '</text></svg>';
}

/** The swatch tooltip line for the same suggestion. */
function tileCollisionTitle(slot) {
  var s = tileCollisionFor(slot, tilePaintLayer(slot[2]));
  if (!s) return '\ncollision: vanilla never drew it on this layer — painted open';
  return '\ncollision: ' + collisionShapeName(s.shape) + ' — ' + s.pct + '% of vanilla agrees'
    + (s.pct < COLL_SURE_PCT ? ' (unsure: vanilla uses it both ways)' : '');
}

function collisionShapeName(shape) {
  if (shape === 0x0f) return 'solid';
  if (shape === 0x00) return 'open';
  if (COLL_SHAPES[shape]) {
    if ([0x03, 0x04, 0x0c, 0x0b, 0x08, 0x07].indexOf(shape) >= 0) return 'half (0x' + shape.toString(16) + ')';
    return 'diagonal (0x' + shape.toString(16) + ')';
  }
  return 'shape 0x' + shape.toString(16);
}

/** The collision word a painted tile starts with: the suggested shape on plane 0. */
function tileSuggestedCollision(slot, layer) {
  var s = tileCollisionFor(slot, layer);
  return s ? (s.shape & 0x0f) : EMPTY_COLLISION;
}

// ── the drafted map's collision layer ───────────────────────────────────────

/** Ask for the drafted map's collision a moment after the last change. */
function draftCollisionSoon() {
  if (_draftCollTimer) clearTimeout(_draftCollTimer);
  _draftCollTimer = setTimeout(function () { _draftCollTimer = null; draftCollisionRequest(); }, 150);
}

function draftCollisionRequest() {
  var d = editDraft();
  var layer = document.getElementById('rg-canopy-ov');
  if (!d || !d.blank) return; // a ROM room's collision is the host's own render
  if (!collisionOn()) { if (layer) layer.style.display = 'none'; return; }
  var draft = romExportPayload({});
  if (!draft || typeof vs === 'undefined' || !vs) return;
  vs.postMessage({ command: 'requestDraftCollision', key: d.customKey, draft: draft });
}

/** The host drew it (bootstrap.js routes `draftCollision` here). */
function applyDraftCollision(msg) {
  var d = editDraft();
  var layer = document.getElementById('rg-canopy-ov');
  if (!msg || msg.error || !d || !d.blank || msg.key !== d.customKey || !layer || !collisionOn()) return;
  layer.setAttribute('href', msg.imageUri);
  layer.setAttribute('x', 0);
  layer.setAttribute('y', 0);
  layer.setAttribute('width', msg.imageWidth / MAP_UNIT_PX);
  layer.setAttribute('height', msg.imageHeight / MAP_UNIT_PX);
  layer.style.display = '';
}

/** The bottom bar changed a feature flag (rom-overlay.js). */
function collisionFlagsChanged() {
  draftCollisionSoon();
  if (typeof renderEditPanels === 'function' && editActive()) renderEditPanels();
}
