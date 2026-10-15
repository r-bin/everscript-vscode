// Ownership: pointer strokes over a grid of square cells — which cell a pointer is over, and the
// down / move / up of one stroke. Game-neutral: the adapter says what a cell is and what a stroke
// does. Plain browser script: defines globals (and `module.exports` under Node).
//
//   editGridBind(element, { cell: 16, scale: function () { return zoom; }, w: cols, h: rows,
//                           onDown(cx, cy, ev), onMove(cx, cy, ev), onUp(cx, cy, ev), onHover(cx, cy, ev) })
// Cells are in the element's own pixels divided by `cell * scale()`. A stroke keeps going when the
// pointer leaves the element (pointer capture) and reports cells clamped to the grid.

/** The cell under client point (x, y) of `rect`, clamped to a `w` x `h` grid; `size` is a cell in pixels. */
function editGridCell(rect, x, y, size, w, h) {
  var cx = Math.floor((x - rect.left) / size), cy = Math.floor((y - rect.top) / size);
  return { x: Math.max(0, Math.min(w - 1, cx)), y: Math.max(0, Math.min(h - 1, cy)) };
}

function editGridBind(el, o) {
  var down = false;
  function at(ev) {
    return editGridCell(el.getBoundingClientRect(), ev.clientX, ev.clientY, o.cell * o.scale(), o.w(), o.h());
  }
  el.addEventListener('pointerdown', function (ev) {
    if (ev.button !== 0) return;
    down = true;
    if (el.setPointerCapture) { try { el.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic events have no capture */ } }
    var c = at(ev);
    if (o.onDown) o.onDown(c.x, c.y, ev);
  });
  el.addEventListener('pointermove', function (ev) {
    var c = at(ev);
    if (down) { if (o.onMove) o.onMove(c.x, c.y, ev); }
    else if (o.onHover) o.onHover(c.x, c.y, ev);
  });
  function up(ev) {
    if (!down) return;
    down = false;
    var c = at(ev);
    if (o.onUp) o.onUp(c.x, c.y, ev);
  }
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { editGridCell: editGridCell, editGridBind: editGridBind };
