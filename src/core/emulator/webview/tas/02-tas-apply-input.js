// TODO port to TS (docs/todo/port-to-ts.md)

    // -- input -------------------------------------------------------------------------
    // Sets the joypad for the frame about to run and records it.
    function tasApplyInput(m, live) {
      let pad = live, fromMovie = false;
      if (!tasPlay && tasRec && tasRec.live && tasSessionFrame > 0 && tasSessionFrame % TAS_SNAPSHOT_EVERY === 0) tasSnapshot();
      if (tasPlay) {
        tasPlayEvents(m, tasPlay.pos);
        if (tasPlay.pos >= tasPlay.count) {
          if (!tasDesync && tasPlay.fair) vscodeApi.postMessage({ command: 'tasReplayed', id: tasPlay.id, frames: tasPlay.count });
          tasStopPlayback('replay finished at frame ' + tasPlay.count + (tasDesync ? ' - DESYNCED at frame ' + tasDesync.frame : ' - keyboard has control'));
        } else {
          pad = tasPlay.pads[tasPlay.pos - (tasPlay.base || 0)];
          fromMovie = true;
          tasPlay.pos++;
          if (tasPlay.pos % 60 === 0) tasRefreshBadge();
        }
      }
      if (!fromMovie && tasRec && tasSessionFrame > 0 && tasSessionFrame % TAS_CHECK_EVERY === 0) {
        const crc = tasWramCrc(m);
        if (crc !== null) tasRecordEvent('S|' + tasHex(crc, 8));
        if (tasRec.live && tasVerifyEvery && tasSessionFrame % tasVerifyEvery === 0) {
          tasFlush();
          vscodeApi.postMessage({ command: 'tasVerify' });
        }
        if (tasSessionFrame % TAS_SPACES_EVERY === 0) {
          const crcs = tasSpaceCrcs(m);
          if (crcs) tasRecordEvent(tasSpacesLine(crcs));
        }
      }
      tasRewindTick(m);
      m._setJoypadInput(pad);
      tasLastPad = pad;
      tasSessionFrame++;
      tasRecordFrame(pad, fromMovie);
    }

    function tasReplaying() { return !!tasPlay; }

    // -- replay --------------------------------------------------------------------------
    function tasStartPlayback(msg) {
      if (!romLoaded || !loadedRomData) { tasSetStatus('load the ROM first'); return; }
      const bin = atob(msg.pads || '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const events = new Map();
      for (const ev of (msg.events || [])) {
        if (!events.has(ev.frame)) events.set(ev.frame, []);
        events.get(ev.frame).push(ev);
      }
      const movie = tasRewindPlayback({ id: msg.id, title: msg.title, count: msg.count, pos: 0, events: events, nextMarker: msg.nextMarker || 0,
        pads: new Uint16Array(bytes.buffer, 0, bytes.length >> 1) }, events);
      if (!movie.count) { tasSetStatus('empty recording'); return; }
      const m = getModule();
      // takeInputPolled marks an EVS_TAS core: only there is a restart a power-on.
      if (m && typeof m._takeInputPolled !== 'function') tasNotice = 'this core restarts with a reset, not a power-on: may desync';
      else if (msg.romMatch === false) tasNotice = 'recorded on a different ROM: expect a desync';
      else if (msg.coreMatch === false) tasNotice = 'recorded on a different emulator core build: may desync';
      else tasNotice = (msg.warnings || [])[0] || '';
      // Only a replay that should sync says anything about the recording.
      movie.fair = !(m && typeof m._takeInputPolled !== 'function') && msg.romMatch !== false && msg.coreMatch !== false;
      tasPendingMovie = movie;
      bootRom(loadedRomData, loadedRomName, msg.sram || null);
      if (tasNotice) tasSetStatus('replaying ' + movie.title + ' - ' + tasNotice);
    }

    function tasStopPlayback(text) {
      if (!tasPlay) return;
      // A continue cannot be taken over before it caught up: the file holds those frames already.
      if (tasPlay.resume && tasPlay.pos < tasPlay.count) { tasSetStatus('still catching up with the session...'); return; }
      if (tasPlay.resume) {
        text = 'continued ' + tasPlay.title + ' at ' + tasFmtTime(tasPlay.count) + (tasDesync ? ' - DESYNCED at frame ' + tasDesync.frame : ' - keyboard has control');
      }
      tasPlay = null;
      tasSetStatus(text || 'took over - keyboard has control, still recording');
      tasRefreshBadge();
      tasRenderList();
    }

    // -- overlay ----------------------------------------------------------------------
    function tasDrawPad(ctx, x, y, s, w) {
      const on = bit => (w >> bit) & 1;
      const rr = (rx, ry, rw, rh, r) => { ctx.beginPath(); ctx.roundRect(x + rx * s, y + ry * s, rw * s, rh * s, r * s); };
      const fill = (lit, color) => { ctx.fillStyle = lit ? color : 'rgba(60,60,60,0.9)'; ctx.fill(); };
      ctx.lineWidth = s;
      rr(0, 0, 112, 56, 16); ctx.fillStyle = 'rgba(16,16,16,0.72)'; ctx.fill(); ctx.strokeStyle = 'rgba(120,120,120,0.6)'; ctx.stroke();
      rr(6, -4, 26, 7, 3); fill(on(5), '#f0f0f0');           // L
      rr(80, -4, 26, 7, 3); fill(on(4), '#f0f0f0');          // R
      rr(19, 13, 8, 10, 1); fill(on(11), '#f0f0f0');         // up
      rr(19, 33, 8, 10, 1); fill(on(10), '#f0f0f0');         // down
      rr(9, 23, 10, 10, 1); fill(on(9), '#f0f0f0');          // left
      rr(27, 23, 10, 10, 1); fill(on(8), '#f0f0f0');         // right
      rr(19, 23, 8, 10, 0); fill(false, '');
      rr(42, 30, 11, 5, 2.5); fill(on(13), '#f0f0f0');       // select
      rr(57, 30, 11, 5, 2.5); fill(on(12), '#f0f0f0');       // start
      const face = (cx, cy, bit, color) => { ctx.beginPath(); ctx.arc(x + cx * s, y + cy * s, 6 * s, 0, Math.PI * 2); fill(on(bit), color); };
      face(90, 15, 6, '#4d8ef0');    // X
      face(78, 28, 14, '#43c060');   // Y
      face(102, 28, 7, '#f0504a');   // A
      face(90, 41, 15, '#f0d040');   // B
    }

    function tasDrawOverlay() {
      const c = document.getElementById('tas-input-overlay');
      if (!c) return;
      c.style.display = tasOverlayOn && romLoaded ? 'block' : 'none';
      if (!tasOverlayOn || !romLoaded) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      tasDrawPad(ctx, 4, 40, 2, tasLastPad);
      const label = tasPlay ? 'PLAY ' + tasPlay.pos + '/' + tasPlay.count : (tasRec ? 'REC ' : '') + 'F ' + tasSessionFrame;
      ctx.font = 'bold 18px monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, ctx.measureText(label).width + 12, 26);
      ctx.fillStyle = tasPlay ? '#6f9' : tasRec ? '#ff6b6b' : '#ccc';
      ctx.fillText(label, 6, 4);
    }

    function tasOverlayIsOn() { return tasOverlayOn; }

    function tasSetOverlay(on, persist) {
      tasOverlayOn = !!on;
      tasRefreshBadge();
      tasDrawOverlay();
      if (persist) vscodeApi.postMessage({ command: 'tasPrefs', overlay: tasOverlayOn });
    }

    // -- list (rows and keys: webview/replays-list.js) ---------------------------------
    function tasRenderList() {
      const list = document.getElementById('tas-list');
      if (!list || typeof replaysListHtml !== 'function') return;
      list.innerHTML = replaysListHtml(tasItems, tasPlay ? tasPlay.id : null, tasMinSeconds, tasRewindMode);
      if (typeof isMenuOpen !== 'undefined' && isMenuOpen && menuActiveTab === 7) updateMenuRowSelection(false);
    }

    // The pause menu's keys on the REPLAYS tab (menu-view.ts).
    function tasMenuStep(rowIdx, delta) {
      if (replaysRowKind(rowIdx) === 'rewinds') { tasSetRewindMode(tasRewindMode === 'calc' ? 'load' : 'calc'); return; }
      const next = replaysMinSecondsStep(rowIdx, tasMinSeconds, delta);
      if (next !== null) { tasSetMinSeconds(next); return; }
      if (replaysStep(rowIdx, delta)) { playMenuSound('click_nav'); tasRenderList(); }
    }

    function tasSetRewindMode(mode) {
      tasRewindMode = mode;
      vscodeApi.postMessage({ command: 'tasPrefs', rewinds: mode });
      playMenuSound('click_toggle');
      tasRenderList();
    }

    function tasSetMinSeconds(seconds) {
      if (seconds === tasMinSeconds) return;
      tasMinSeconds = seconds;
      vscodeApi.postMessage({ command: 'tasPrefs', minSeconds: seconds });
      playMenuSound('click_toggle');
      tasRenderList();
    }

    function tasMenuCancel() {
      if (!replaysCancel()) return false;
      playMenuSound('wheel_turn');
      tasRenderList();
      return true;
    }

    function tasMenuActivate(rowIdx, actOverride) {
      const r = replaysActivate(rowIdx, actOverride);
      if (!r) return;
      if (r.ask) { playMenuSound('click_nav'); tasRenderList(); return; }
      playMenuSound('click_confirm');
      if (r.act === 'takeover') tasStopPlayback();
      else if (r.act === 'reveal') vscodeApi.postMessage({ command: 'tasReveal' });
      else if (r.act === 'minlen') tasSetMinSeconds(replaysMinSecondsNext(tasMinSeconds, 1, true));
      else if (r.act === 'rewinds') tasSetRewindMode(tasRewindMode === 'calc' ? 'load' : 'calc');
      else if (r.act === 'pin') vscodeApi.postMessage({ command: 'tasPin', id: r.id, pinned: r.on });
      else if (r.act === 'delete') { tasRenderList(); vscodeApi.postMessage({ command: 'tasDelete', id: r.id, confirmed: true }); }
      else if (r.act === 'play') {
        if (isMenuOpen) closeEmulatorMenu();
        // The session in progress: close its file first so the replay reads every frame.
        if (r.recording) tasEndRecording();
        tasSetStatus('loading replay...');
        vscodeApi.postMessage({ command: 'tasLoad', id: r.id });
      }
    }

    function tasRequestList() {
      tasFlush();
      vscodeApi.postMessage({ command: 'tasList' });
    }

    function initTasTab() {
      const list = document.getElementById('tas-list');
      if (!list || list.getAttribute('data-bound')) return;
      list.setAttribute('data-bound', '1');
      list.addEventListener('click', evt => {
        const idx = replaysRowIndex(evt.target);
        if (idx < 0 || !isMenuOpen) return;
        const btn = evt.target.closest('button[data-act]');
        if (btn && btn.disabled) return;
        if (menuSelectedRow !== idx) { replaysCancel(); menuSelectedRow = idx; updateMenuRowSelection(); }
        const stepper = evt.target.closest('.menu-stepper-btn[data-step]');
        if (stepper) { tasMenuStep(idx, parseInt(stepper.getAttribute('data-step'), 10)); return; }
        if (btn) tasMenuActivate(idx, btn.getAttribute('data-act'));
        else if (list.querySelectorAll('.menu-row')[idx].getAttribute('data-kind') !== 'replay') tasMenuActivate(idx);
      });
      document.getElementById('tas-rec-badge').addEventListener('click', evt => {
        evt.stopPropagation();
        if (isMenuOpen) selectMenuTab(7);
        else { menuActiveTab = 7; openEmulatorMenu(); }
      });
      const chip = document.getElementById('screen-inputs-toggle');
      if (chip) chip.addEventListener('click', evt => {
        evt.stopPropagation();
        tasSetOverlay(!tasOverlayOn, true);
        const screenCanvas = document.getElementById('screen');
        if (screenCanvas) screenCanvas.focus();
      });
      document.addEventListener('visibilitychange', () => { if (document.hidden) { tasSnapshot(); tasFlush(); } });
      // Closing the tab gives the page no last word: snapshot on the way out it does see (the click on
      // the tab's X blurs the page first; Cmd/Ctrl+W is a key the page sees; pagehide when it is torn down).
      window.addEventListener('blur', () => { tasSnapshot(); tasFlush(); });
      window.addEventListener('pagehide', () => { tasSnapshot(); tasFlush(); });
      document.addEventListener('keydown', evt => {
        if ((evt.metaKey || evt.ctrlKey) && (evt.key === 'w' || evt.key === 'W')) { tasSnapshot(); tasFlush(); }
      }, true);
      tasRefreshBadge();
    }

    // Called by the frame loop whenever the emulator pauses or resumes.
    function tasOnPauseChanged(paused) {
      if (paused) { tasSnapshot(); tasFlush(); }
    }

    function handleTasMessage(data) {
      if (data.command === 'tasConfig') {
        initTasTab();
        tasAutoRecord = data.autoRecord !== false;
        tasVerifyEvery = Math.max(0, Math.floor((data.verifyEveryMinutes || 0) * 60 * 60.0988 / TAS_CHECK_EVERY)) * TAS_CHECK_EVERY;
        tasSetOverlay(!!data.overlay, false);
        if (typeof data.minSeconds === 'number') tasMinSeconds = data.minSeconds;
        if (data.rewinds === 'calc' || data.rewinds === 'load') tasRewindMode = data.rewinds;
        tasRequestList();
      } else if (data.command === 'tasListResult') {
        tasItems = data.items || [];
        tasRenderList();
      } else if (data.command === 'tasMovie') {
        tasStartPlayback(data);
      } else if (data.command === 'tasResume') {
        tasStartResume(data);
      } else if (data.command === 'tasStatus') {
        tasSetStatus(data.text);
      } else {
        return false;
      }
      return true;
    }
  