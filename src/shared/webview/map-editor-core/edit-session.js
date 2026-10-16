// Ownership: what an editor keeps per map while its page is open — the model being edited and its
// history — and the "not saved" notice. Game-neutral. Plain browser script: defines globals (and
// `module.exports` under Node, for the unit test).
//
// Nothing here is persisted: a session lives as long as the page, so switching to another map and
// back keeps the edits and closing the page drops them. Whether anything is ever written back is
// the adapter's business (docs/architecture/multi-game.md).

/** A store of sessions by key (a map id). `make(key)` builds a new session: `{ model, history }`. */
function editSessionStore(make) {
  var sessions = {};
  return {
    get: function (key) { return sessions[key] || (sessions[key] = make(key)); },
    has: function (key) { return !!sessions[key]; },
    /** The keys with something to undo, i.e. what would be lost on closing. */
    dirtyKeys: function () {
      return Object.keys(sessions).filter(function (k) { return sessions[k].history && sessions[k].history.dirty(); });
    },
    drop: function (key) { delete sessions[key]; },
  };
}

/** The notice shown while a map has changes that nothing writes anywhere. `what` names the map's source. */
function editNotSavedHtml(what) {
  return '<div class="ed-notsaved" role="status">Changes to this ' + what
    + ' are not saved — they last until this tab is closed.</div>';
}

if (typeof module !== 'undefined' && module.exports) module.exports = { editSessionStore: editSessionStore, editNotSavedHtml: editNotSavedHtml };
