// TODO port to TS (docs/todo/port-to-ts.md)

    // -- TAS: recording, replay, input overlay ------------------------------------
    const TAS_BUTTONS = 'BYsSudlrAXLR0123';
    const TAS_FLUSH_FRAMES = 120;
    let tasAutoRecord = true;
    let tasRec = null;           // { frames, lines, live, cheats } while recording
    let tasPlay = null;          // { id, title, pads, count, pos } while replaying
    let tasPendingMovie = null;  // movie waiting for the reboot that starts it
    let tasSessionFrame = 0;     // frames since power-on
    let tasOverlayOn = false;
    let tasLastPad = 0;
    let tasItems = [];
    let tasNotice = '';
    const TAS_CHECK_EVERY = 60;     // WRAM checksum (S line)
    const TAS_SPACES_EVERY = 600;   // the other memory spaces (T line)
    const TAS_SPACES = [['vram', 0], ['cgram', 1], ['oam', 2], ['sram', 3], ['aram', 4]];
    let tasPendingW = null;      // { addr, next, bytes } write being coalesced
    let tasApplying = false;     // true while a replay applies a recorded write
    let tasDesync = null;        // { frame, expected, got } after the first mismatch
    let tasCrcTable = null;
    let tasVerifyEvery = 0;      // frames between replay checks while recording (0 = off)
    // Continuing a session (ROM picker): a snapshot (save state + screenshot) goes to the host now and
    // then while a session is played by hand (tas/resume.ts keeps it next to the recording).
    const TAS_SNAPSHOT_EVERY = 1800;   // frames (30 s) between snapshots while playing
    const TAS_SNAPSHOT_MIN = 600;      // earlier states do not reproduce the run (tools/cdl/replay-states.js)
    let tasLastSnapshotFrame = -1;
    let tasCatchingUp = false;         // a continue runs the recorded tail as fast as it can (frame loop idles)
    let tasMinSeconds = 10;            // REPLAYS setting: shorter sessions are deleted when they end (host)

    function tasPadText(w) {
      let s = '';
      for (let i = 0; i < 16; i++) s += (w >> (15 - i)) & 1 ? TAS_BUTTONS[i] : '.';
      return s;
    }

    function tasFmtTime(frames) {
      const s = frames / 60.0988;
      const m = Math.floor(s / 60);
      return m + ':' + (s - m * 60).toFixed(2).padStart(5, '0');
    }

    function tasSetStatus(text) {
      const el = document.getElementById('tas-status');
      if (el) el.textContent = text || '';
    }

    function tasRefreshBadge() {
      const badge = document.getElementById('tas-rec-badge');
      if (badge) {
        badge.classList.toggle('rec', !!tasRec && !tasPlay);
        badge.classList.toggle('play', !!tasPlay);
        badge.classList.toggle('desync', !!tasPlay && !!tasDesync);
        badge.style.display = romLoaded ? '' : 'none';
        badge.textContent = tasPlay && tasDesync ? 'DESYNC ' + tasDesync.frame
          : tasPlay ? 'PLAY ' + tasPlay.pos + ' / ' + tasPlay.count
          : tasRec ? 'REC ' + tasFmtTime(tasRec.frames)
          : romLoaded ? (tasAutoRecord ? 'rec waiting' : 'recording off') : 'no ROM';
      }
      if (typeof setPillState === 'function') setPillState('menu-val-inputs', tasOverlayOn);
      const chip = document.getElementById('screen-inputs-toggle');
      if (chip) { chip.classList.toggle('active', tasOverlayOn); chip.textContent = tasOverlayOn ? 'INPUTS ON' : 'INPUTS OFF'; }
    }

    // -- recording ------------------------------------------------------------------
    function tasFlush() {
      tasFlushWrite();
      if (!tasRec || !tasRec.lines.length) return;
      vscodeApi.postMessage({ command: 'tasRecFrames', text: tasRec.lines.join(String.fromCharCode(10)) + String.fromCharCode(10),
        frames: tasRec.unsent, live: tasRec.live, cheats: tasRec.cheats });
      tasRec.lines = [];
      tasRec.unsent = 0;
      tasRefreshBadge();
    }

    function tasRecordFrame(pad, fromMovie) {
      if (!tasRec) return;
      // A continue catching up replays frames that are in the file already.
      if (tasPlay && tasPlay.resume) return;
      tasFlushWrite();
      tasRec.lines.push('F|' + tasPadText(pad));
      tasRec.frames++;
      tasRec.unsent++;
      if (!fromMovie && pad) tasRec.live = true;
      if (typeof cheatsActive === 'function' && cheatsActive()) tasRec.cheats = true;
      if (tasRec.unsent >= TAS_FLUSH_FRAMES) tasFlush();
    }

    // An event line between two frame lines (see movie.ts).
    function tasRecordEvent(line) {
      if (!tasRec || (tasPlay && tasPlay.resume)) return;
      tasFlushWrite();
      tasRec.lines.push(line);
    }

    // -- memory writes, resets, checksums ---------------------------------------------
    function tasHex(n, w) {
      return n.toString(16).toUpperCase().padStart(w, '0');
    }

    function tasFlushWrite() {
      const w = tasPendingW;
      if (!w) return;
      tasPendingW = null;
      if (tasRec) tasRec.lines.push('W|' + tasHex(w.addr, 6) + '|' + w.bytes.map(b => tasHex(b, 2)).join(''));
    }

    // Every write the UI makes passes Module.writeMemory: wrap it once.
    function tasInstallWriteHook(m) {
      if (!m || m.tasWriteHooked || typeof m.writeMemory !== 'function') return;
      const raw = m.writeMemory;
      m.tasWriteHooked = true;
      m.tasWriteRaw = raw;
      m.writeMemory = function (addr, value) {
        if (tasRec && !tasApplying) tasNoteWrite(m, addr >>> 0, value & 255);
        return raw.apply(m, arguments);
      };
    }

    function tasNoteWrite(m, addr, value) {
      // Writing what is already there changes nothing (cheats rewrite every frame): not an event.
      if (addr >= 0x7E0000 && addr < 0x800000 && typeof m.readMemory === 'function' && m.readMemory(addr) === value) return;
      if (tasPendingW && tasPendingW.next === addr) {
        tasPendingW.bytes.push(value);
        tasPendingW.next++;
      } else {
        tasFlushWrite();
        tasPendingW = { addr: addr, next: addr + 1, bytes: [value] };
      }
    }

    // CRC-32 (IEEE), the same as movie.ts crc32 (a test keeps them equal).
    function tasCrcUpdate(crc, bytes) {
      if (!tasCrcTable) {
        tasCrcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          tasCrcTable[n] = c >>> 0;
        }
      }
      for (let i = 0; i < bytes.length; i++) crc = tasCrcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
      return crc >>> 0;
    }

    function tasWramCrc(m) {
      if (!m || typeof m.readMemoryRange !== 'function') return null;
      let crc = 0xFFFFFFFF;
      for (let off = 0; off < 0x20000; off += 4096) crc = tasCrcUpdate(crc, m.readMemoryRange(0x7E0000 + off, 4096));
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // CRC-32 of VRAM, CGRAM, OAM, SRAM and ARAM (core.readSpace); null on a core without it.
    function tasSpaceCrcs(m) {
      if (typeof m.readSpace !== 'function') return null;
      const out = {};
      for (const sp of TAS_SPACES) {
        const bytes = m.readSpace(sp[1]);
        out[sp[0]] = bytes ? (tasCrcUpdate(0xFFFFFFFF, bytes) ^ 0xFFFFFFFF) >>> 0 : 0;
      }
      return out;
    }

    function tasSpacesLine(crcs) {
      return 'T|' + TAS_SPACES.map(sp => sp[0] + '=' + tasHex(crcs[sp[0]] >>> 0, 8)).join('|');
    }

    // The console's reset button: RAM and the save are kept. Recorded, so a replay presses it too.
    function tasSoftReset() {
      const m = getModule();
      if (!m || !romLoaded) { tasSetStatus('load the ROM first'); return false; }
      if (typeof m._softReset !== 'function') { tasSetStatus('this core has no soft reset'); return false; }
      if (tasPlay) { tasSetStatus('take over first: a replay is running'); return false; }
      tasRecordEvent('R|soft');
      if (typeof persistSramIfNeeded === 'function') persistSramIfNeeded();
      m._softReset();
      tasSetStatus('soft reset');
      return true;
    }

    // Replay: apply the events recorded at the boundary before that frame runs.
    function tasPlayEvents(m, frame) {
      const list = tasPlay.events.get(frame);
      if (!list) return;
      for (const ev of list) {
        if (ev.kind === 'W') {
          tasApplying = true;
          try {
            if (typeof m.writeMemory === 'function') {
              for (let i = 0; i < ev.bytes.length; i++) m.writeMemory(ev.addr + i, ev.bytes[i]);
            }
          }
          finally { tasApplying = false; }
          tasRecordEvent('W|' + tasHex(ev.addr, 6) + '|' + ev.bytes.map(b => tasHex(b, 2)).join(''));
        } else if (ev.kind === 'R') {
          if (typeof m._softReset === 'function') m._softReset();
          tasRecordEvent('R|soft');
        } else if (ev.kind === 'K' || ev.kind === 'L') {
          tasPlayRewindEvent(m, ev);
        } else if (ev.kind === 'S') {
          const got = tasWramCrc(m);
          if (got !== null) {
            if (got !== ev.crc && !tasDesync) {
              tasDesync = { frame: frame, expected: tasHex(ev.crc, 8), got: tasHex(got, 8) };
              tasSetStatus('DESYNC at frame ' + frame + ' (expected ' + tasDesync.expected + ', got ' + tasDesync.got + ')');
              tasReportDesync();
            }
            tasRecordEvent('S|' + tasHex(got, 8));
          }
        } else if (ev.kind === 'T') {
          const got = tasSpaceCrcs(m);
          if (!got) continue;
          for (const sp of TAS_SPACES) {
            if (ev.crcs[sp[0]] !== undefined && ev.crcs[sp[0]] !== got[sp[0]] && !tasDesync) {
              tasDesync = { frame: frame, expected: sp[0] + ' ' + tasHex(ev.crcs[sp[0]], 8), got: tasHex(got[sp[0]], 8) };
              tasSetStatus('DESYNC at frame ' + frame + ' in ' + sp[0] + ' (expected ' + tasHex(ev.crcs[sp[0]], 8) + ', got ' + tasHex(got[sp[0]], 8) + ')');
              tasReportDesync();
            }
          }
          tasRecordEvent(tasSpacesLine(got));
        }
      }
    }

    // The host logs it and, for a fair replay, writes it into the recording for good.
    function tasReportDesync() {
      vscodeApi.postMessage({ command: 'tasDesync', id: tasPlay.id, fair: tasPlay.fair, frame: tasDesync.frame, expected: tasDesync.expected, got: tasDesync.got });
      tasRefreshBadge();
    }

    // -- snapshots and continuing a session ------------------------------------------------
    function tasB64(bytes) {
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    }

    function tasUnB64(text) {
      const bin = atob(text || '');
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }

    // The picture on screen at half the SNES's 256x224, as WebP (a few KB: the ROM picker lists many).
    function tasThumbnail() {
      const screen = document.getElementById('screen');
      if (!screen) return '';
      try {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 112;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(screen, 0, 0, screen.width, screen.height, 0, 0, 128, 112);
        return c.toDataURL('image/webp', 0.85);
      } catch (_) {
        return '';
      }
    }

    // A snapshot of the session being played by hand, at this frame boundary: everything recorded so
    // far is flushed first, so the host knows where in the file the state stands.
    function tasSnapshot() {
      const m = getModule();
      if (!tasRec || !tasRec.live || tasPlay || !romLoaded || !m) return;
      if (tasSessionFrame < TAS_SNAPSHOT_MIN || tasSessionFrame === tasLastSnapshotFrame) return;
      if (typeof m._saveState !== 'function' || typeof m._getStateSaveSize !== 'function') return;
      tasFlush();
      const size = m._getStateSaveSize();
      const ptr = m._saveState();
      if (!ptr) return;
      const state = HEAPU8.slice(ptr, ptr + size);
      if (typeof m._my_free === 'function') m._my_free(ptr);
      tasLastSnapshotFrame = tasSessionFrame;
      vscodeApi.postMessage({ command: 'tasSnapshot', frame: tasSessionFrame, state: tasB64(state), thumb: tasThumbnail() });
    }

    // The host's answer to the ROM picker's "continue": load the snapshot, append to that recording,
    // and catch up on the frames recorded after the snapshot before the keyboard takes over.
    function tasStartResume(msg) {
      const m = getModule();
      if (!romLoaded || !m || typeof m._loadState !== 'function') { tasSetStatus('cannot continue: this core has no save states'); return; }
      const state = tasUnB64(msg.state);
      if (state.length !== m._getStateSaveSize()) { tasSetStatus('cannot continue: the session was saved by another core build (started fresh)'); return; }
      tasEndRecording();   // the empty session of the boot that brought the ROM up
      const ptr = m._my_malloc(state.length);
      HEAPU8.set(state, ptr);
      const ok = m._loadState(ptr, state.length);
      m._my_free(ptr);
      if (!ok) { tasSetStatus('cannot continue: the core refused the saved state'); tasOnBoot(loadedRomName); return; }
      tasSessionFrame = msg.frame;
      tasLastSnapshotFrame = msg.frame;
      tasLastPad = 0;
      tasPendingW = null;
      tasDesync = null;
      tasRec = { frames: msg.count, unsent: 0, lines: [], live: true, cheats: false };
      tasRewindReset(msg.nextMarker);
      vscodeApi.postMessage({ command: 'tasRecContinue', id: msg.id });
      if (msg.count > msg.frame) {
        const pads = tasUnB64(msg.pads);
        const events = new Map();
        for (const ev of (msg.events || [])) {
          if (!events.has(ev.frame)) events.set(ev.frame, []);
          events.get(ev.frame).push(ev);
        }
        tasPlay = tasRewindPlayback({ id: msg.id, title: msg.title, resume: true, fair: false, base: msg.frame, pos: msg.frame, count: msg.count, events: events,
          pads: new Uint16Array(pads.buffer, 0, pads.length >> 1) }, events);
        tasSetStatus('continuing ' + msg.title + ': catching up ' + (msg.count - msg.frame) + ' frames');
        tasCatchingUp = true;
        setTimeout(tasCatchUpSlice, 0);
      } else {
        tasSetStatus('continuing ' + msg.title + ' at ' + tasFmtTime(msg.frame));
      }
      tasRefreshBadge();
      tasRenderList();
    }

    // The tail of a continue, without drawing or sound, in slices that leave the page responsive.
    function tasCatchUpSlice() {
      const m = getModule();
      const t0 = performance.now();
      while (m && tasPlay && tasPlay.resume && performance.now() - t0 < 40) {
        if (tasPlay.pos >= tasPlay.count) { tasPlayEvents(m, tasPlay.pos); tasStopPlayback(); break; }
        tasApplyInput(m, 0);
        m._mainLoop();
        audioDropFrame(m);
      }
      tasCatchingUp = !!(m && tasPlay && tasPlay.resume);
      if (tasCatchingUp) setTimeout(tasCatchUpSlice, 0);
    }

    function tasEndRecording() {
      if (!tasRec) return;
      tasFlush();
      tasRec = null;
      vscodeApi.postMessage({ command: 'tasRecEnd' });
    }

    // Called by bootRom() right after the core (re)started: frame 0 of a new session.
    function tasOnBoot(name) {
      tasEndRecording();
      tasCatchingUp = false;
      tasLastSnapshotFrame = -1;
      tasPlay = tasPendingMovie;
      tasPendingMovie = null;
      tasRewindReset(tasPlay ? tasPlay.nextMarker : 0);
      tasSessionFrame = 0;
      tasLastPad = 0;
      tasPendingW = null;
      tasDesync = null;
      tasInstallWriteHook(getModule());
      if (tasAutoRecord) {
        tasRec = { frames: 0, unsent: 0, lines: [], live: false, cheats: false };
        const startingSram = (typeof lastStartingSramB64 === 'string') ? lastStartingSramB64 : '';
        vscodeApi.postMessage({ command: 'tasRecStart', name: name || 'game', source: tasPlay ? tasPlay.title : '', sram: startingSram });
      }
      if (tasPlay) tasSetStatus('replaying ' + tasPlay.title);
      tasRefreshBadge();
      tasRenderList();
    }
