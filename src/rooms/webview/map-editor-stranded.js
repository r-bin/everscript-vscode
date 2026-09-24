// Ownership: the invalid-family banner at the top of the Tile tab, and its
// two actions.
//
// Freeing a palette slot does not recolour anything: the words already
// written still name slot N, and slot N is now empty. Those cells are
// **stranded** — the draft would still encode, it just would not look like
// what is on screen, which is worse than not encoding. Before Phase 8a this
// only surfaced as one line in the Info tab's checks panel, three clicks away
// from the panel that caused it.
//
// The model (which cells, and which family each one wants) is
// map-editor-families.js's editStrandedGroups; this file is the banner and
// the two buttons.
//
// Owns: nothing. Both actions go through existing owners — editSetFamily for
// the restore, editApply for the removal, so it shares the one undo stack.

/**
 * One banner per stranded family.
 *
 * "Add family back" is only ever offered when it would actually work, and it
 * always does: a cell is stranded *because* the slot it names is empty, so
 * putting the family back in **that** slot is both possible and sufficient.
 * (Adopting into the first free slot instead — editAdoptFamilyFor — would
 * load the art and leave the cells just as stranded, naming a slot that is
 * still empty.) The one case with no restore is a slot whose previous
 * occupant was never recorded, and then the banner says so rather than
 * offering a button that cannot fix it.
 */
function strandedBannersHtml() {
  var groups = typeof editStrandedGroups === 'function' ? editStrandedGroups() : [];
  var html = '';
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    var n = g.cells.length;
    var cells = n + ' placed cell' + (n === 1 ? '' : 's');
    html += '<div class="rg-banner"><div class="rg-banner-t">'
      + (g.family === undefined
        ? escH(cells + ' name palette slot ' + (g.slot + 1) + ', which is empty — and what used '
          + 'to be in it is not recorded, so there is nothing to put back.')
        : escH(cells + ' are drawn in family ' + g.family + ', which is not in this room’s '
          + 'palette any more.'))
      + '</div><div class="rg-banner-a">'
      + (g.family === undefined ? ''
        : '<button class="rg-banner-b" data-stranded-fix="' + g.slot + '"'
          + ' title="' + escH('Put family ' + g.family + ' back in palette slot ' + (g.slot + 1)
            + ' — the slot these cells name, so they draw again.') + '">Add family back</button>')
      + '<button class="rg-banner-b muted" data-stranded-drop="' + g.slot + '"'
      + ' title="' + escH('Clear those ' + cells + ' back to the room’s own tiles. One undo step.')
      + '">Remove tiles</button>'
      + '</div></div>';
  }
  return html;
}

/** Put the family back in the very slot its cells name. */
function strandedFix(slot) {
  var groups = editStrandedGroups();
  var g = null;
  for (var i = 0; i < groups.length; i++) if (groups[i].slot === Number(slot)) g = groups[i];
  if (!g || g.family === undefined) return;
  editSetFamily(g.slot, g.family);
  editNote('family ' + g.family + ' back in slot ' + (g.slot + 1)
    + ' — ' + g.cells.length + ' cell' + (g.cells.length === 1 ? '' : 's') + ' valid again');
  renderEditChrome();
}

/**
 * Clear the stranded cells, as one undoable step.
 *
 * `index: null` removes the draft's own write, so the cell goes back to the
 * room's own tile underneath rather than to a hole — see editApply.
 */
function strandedDrop(slot) {
  var groups = editStrandedGroups();
  var g = null;
  for (var i = 0; i < groups.length; i++) if (groups[i].slot === Number(slot)) g = groups[i];
  if (!g) return;
  var writes = g.cells.map(function (key) {
    var p = key.split(',');
    return { x: Number(p[0]), y: Number(p[1]), index: null };
  });
  var n = editApply(writes);
  editNote(n + ' cell' + (n === 1 ? '' : 's') + ' cleared back to the room’s own tiles — undo puts them back');
  renderEditChrome();
}
