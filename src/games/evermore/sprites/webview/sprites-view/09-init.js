// TODO port to TS (docs/todo/port-to-ts.md)
// Ownership: the Characters tab's start — last of the parts, so every table the others declare is set.

  // ── Init on page load ───────────────────────────────────────────────────────
  try {
    renderList();
    var initChars = getCharacters();
    if (initChars && initChars.length > 0) {
      selectCharacter(initChars[0].id);
    }
  } catch (err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[Sprites] Init error:', err);
    }
  }
