// TODO port to TS (docs/todo/port-to-ts.md)

    // -- rewind ---------------------------------------------------------------------------
    // While the game is played by hand the page keeps a save state every TAS_REWIND_EVERY frames of the
    // current timeline (the last TAS_REWIND_KEEP, in memory) and marks each in the recording ("K|n").
    // Rewind (Backspace, pause menu EMULATION > Rewind) loads the newest one at least a second back - pressed again
    // right away, the one before - and records "L|n|<state>" (movie.ts). A replay does the rewind too:
    // the REPLAYS setting picks whether it loads the recorded state ("load") or the state it computed
    // itself at K|n ("calc", the default; it falls back to the recorded one when it has none).
    const TAS_REWIND_EVERY = 300;   // movie.ts REWIND_EVERY (5 s)
    const TAS_REWIND_KEEP = 24;     // 2 minutes back
    let tasRewindRing = [];         // { n, timeline, state }
    let tasTimeline = 0;            // frames played on the current timeline (goes back on a rewind)
    let tasNextMarker = 0;          // the next K|n number of this recording
    let tasRewindMode = 'calc';     // REPLAYS setting, from the host (tas/prefs.ts)

    function tasSaveStateBytes(m) {
      if (!m || typeof m._saveState !== 'function' || typeof m._getStateSaveSize !== 'function') return null;
      const size = m._getStateSaveSize();
      const ptr = m._saveState();
      if (!ptr) return null;
      const out = HEAPU8.slice(ptr, ptr + size);
      if (typeof m._my_free === 'function') m._my_free(ptr);
      return out;
    }

    function tasLoadStateBytes(m, bytes) {
      if (!m || !bytes || typeof m._loadState !== 'function' || bytes.length !== m._getStateSaveSize()) return false;
      const ptr = m._my_malloc(bytes.length);
      HEAPU8.set(bytes, ptr);
      const ok = m._loadState(ptr, bytes.length);
      m._my_free(ptr);
      return !!ok;
    }

    // A new session (boot) or a replay: the ring belongs to the old timeline.
    function tasRewindReset(nextMarker) {
      tasRewindRing = [];
      tasTimeline = 0;
      tasNextMarker = nextMarker || 0;
    }

    // At every frame boundary, before the frame runs (tasApplyInput).
    function tasRewindTick(m) {
      if (!tasPlay && tasTimeline > 0 && tasTimeline % TAS_REWIND_EVERY === 0) {
        const last = tasRewindRing[tasRewindRing.length - 1];
        if (!last || last.timeline !== tasTimeline) {
          const state = tasSaveStateBytes(m);
          if (state) {
            const n = tasNextMarker++;
            tasRewindRing.push({ n: n, timeline: tasTimeline, state: state });
            if (tasRewindRing.length > TAS_REWIND_KEEP) tasRewindRing.shift();
            tasRecordEvent('K|' + n);
          }
        }
      }
      tasTimeline++;
    }

    function tasRewind() {
      const m = getModule();
      if (!romLoaded || !m) return false;
      if (tasPlay) { tasSetStatus('take over first: a replay is running'); return false; }
      let at = -1;
      for (let i = tasRewindRing.length - 1; i >= 0; i--) {
        if (tasRewindRing[i].timeline <= tasTimeline - 60) { at = i; break; }
      }
      if (at < 0) { tasSetStatus('nothing to rewind to yet (a rewind point every 5 s of play, the last 2 min)'); return false; }
      const target = tasRewindRing[at];
      if (!tasLoadStateBytes(m, target.state)) { tasSetStatus('rewind failed: the core refused the state'); return false; }
      tasRewindRing = tasRewindRing.slice(0, at + 1);
      const back = tasTimeline - target.timeline;
      tasTimeline = target.timeline;
      if (tasRec) {
        tasRecordEvent('L|' + target.n + '|raw:' + tasB64(target.state));
        tasRec.live = true;
      }
      tasSetStatus('rewound ' + (back / 60.0988).toFixed(1) + ' s');
      if (typeof playMenuSound === 'function') playMenuSound('wheel_turn');
      return true;
    }

    // A replay meets a K or L line (tasPlayEvents). The replay is recorded again: same lines.
    function tasPlayRewindEvent(m, ev) {
      if (ev.kind === 'K') {
        if (tasRewindMode === 'calc' && tasPlay.wanted.has(ev.n)) {
          const own = tasSaveStateBytes(m);
          if (own) tasPlay.states.set(ev.n, own);
        }
        tasRecordEvent('K|' + ev.n);
        return;
      }
      const own = tasRewindMode === 'calc' ? tasPlay.states.get(ev.n) : null;
      const state = own || (ev.data ? tasUnB64(ev.data) : null);
      if (!state || !tasLoadStateBytes(m, state)) {
        tasSetStatus('replay: cannot rewind to state ' + ev.n + ' at frame ' + tasPlay.pos);
        return;
      }
      tasRecordEvent('L|' + ev.n + '|raw:' + tasB64(state));
    }

    // What a replay needs for its rewinds: the markers it must keep a state for (calc mode).
    function tasRewindPlayback(play, events) {
      play.states = new Map();
      play.wanted = new Set();
      for (const list of events.values()) for (const ev of list) if (ev.kind === 'L') play.wanted.add(ev.n);
      return play;
    }
