'use strict';

/**
 * emulator/tas-view.js
 *
 * Input recording and replay, webview half (host half: tas/host.js):
 *  - every boot of a ROM starts an input recording; each emulated frame's pad
 *    word is buffered and sent to the host in batches (and on pause / ROM
 *    change / tab hide), so the SSD sees one small append per two seconds;
 *  - the REPLAYS tab of the pause menu lists this ROM's recordings (same SHA-256,
 *    pinned first) and scrolls; playing one closes the menu, then reboots
 *    the loaded ROM (with the custom core's EVS_TAS build a restart is a true
 *    power-on) and feeds the recorded pads frame by frame, optionally several
 *    frames per display frame; "take over" or the end hands control back to
 *    the keyboard while the new recording continues as a branch;
 *  - the input overlay draws the pad fed to the core this frame.
 *
 * Beyond the pad, a movie also records everything that changes the emulation
 * from outside (movie.js documents the lines): memory writes made through
 * Module.writeMemory (cheats, object states, menu toggles, injected scripts;
 * a hook installed once records them, WRAM writes that change nothing are
 * dropped), soft resets, and a WRAM checksum every TAS_CHECK_EVERY frames. A
 * replay applies the same events at the same frame boundaries and compares the
 * checksums, so a desync is reported at the first checkpoint that differs.
 * Opening the pause menu changes nothing by itself: no frame runs while it is
 * open, so only what is done in it (a flag toggle = a write, reset = an event) counts.
 *
 * tasApplyInput() is the only place the frame loop sets joypads.
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getTasCss() {
  return `
    #ss-view-tas .ss-subbar { flex-wrap: wrap; }
    #tas-status { color: #888; margin-left: auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #tas-rec-badge { position: absolute; top: 4px; left: 50%; transform: translateX(-50%); z-index: 45; cursor: pointer;
      font: inherit; font-size: 10px; padding: 1px 6px; border-radius: 3px; border: 1px solid #333; color: #777; background: rgba(16, 16, 16, 0.75); }
    #tas-rec-badge.rec { color: #ff6b6b; border-color: #7a2a2a; background: rgba(120, 30, 30, 0.25); }
    #tas-rec-badge.play.desync { color: #ff6b6b; border-color: #7a2a2a; background: rgba(120, 30, 30, 0.35); }
    #tas-rec-badge.play { color: #6f9; border-color: #2e7d32; background: rgba(26, 60, 26, 0.35); }
    #tas-speed { background: #1a1a1a; color: #ccc; border: 1px solid #333; font: inherit; font-size: 10px; }
    #tas-list { flex: 1; min-height: 0; overflow-y: auto; padding: 2px 0; }
    .tas-group { color: #777; font-size: 10px; padding: 6px 8px 2px; letter-spacing: 0.05em; }
    .tas-row { display: flex; align-items: center; gap: 6px; padding: 3px 8px; border-bottom: 1px solid #1a1a1a; }
    .tas-row:hover { background: #151515; }
    .tas-row.playing { background: rgba(26, 60, 26, 0.35); }
    .tas-pin { background: none; border: none; color: #555; cursor: pointer; font-size: 13px; width: 18px; padding: 0; }
    .tas-pin.on { color: #e8c33a; }
    .tas-pin:disabled { cursor: default; }
    .tas-main { flex: 1; min-width: 0; }
    .tas-name { color: #ddd; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tas-meta { color: #777; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tas-meta .bad { color: #e0a040; }
    .tas-meta .ok { color: #6a6; }
    .tas-meta .rec { color: #ff6b6b; }
    #tas-empty { color: #666; padding: 12px 8px; font-size: 11px; line-height: 1.5; }
    #tas-input-overlay {
      position: absolute; left: 8px; bottom: 8px; z-index: 19;
      width: 118px; height: 80px; pointer-events: none; display: none;
    }
  `;
}

// REC / PLAY / DESYNC on the screen; opens the pause menu on REPLAYS.
function getTasBadgeHtml() {
  return `<button id="tas-rec-badge" type="button" title="Replays (opens the pause menu)" style="display:none">no ROM</button>`;
}

function getTasChipHtml() {
  return `<button id="screen-inputs-toggle" class="screen-chip" type="button" title="Toggle the input overlay (the pad fed to the core each frame)">INPUTS OFF</button>`;
}

function getTasOverlayHtml() {
  return `<canvas id="tas-input-overlay" width="236" height="160"></canvas>`;
}

function getTasViewHtml() {
  return `
    <div id="ss-view-tas" class="ss-tab-view">
      <div class="ss-subbar">
        <button id="tas-takeover" class="ss-btn" type="button" title="Stop the replay here and play on with the keyboard (the recording keeps going)" disabled>take over</button>
        <label title="Frames emulated per display frame while replaying">speed
          <select id="tas-speed"><option value="1">1x</option><option value="2">2x</option><option value="4">4x</option><option value="8">8x</option><option value="16">16x</option></select>
        </label>
        <button id="tas-softreset" class="ss-btn" type="button" title="The console reset button (keeps RAM and the save); recorded in the movie">soft reset</button>
        <button id="tas-overlay-btn" class="ss-btn" type="button">input overlay</button>
        <button id="tas-reveal" class="ss-btn" type="button">open folder</button>
        <span id="tas-status"></span>
      </div>
      <div id="tas-list"><div id="tas-empty">Every session is recorded automatically from power-on. Load a ROM to start.</div></div>
    </div>
  `;
}

function getTasClientScript() {
  return `
    // -- TAS: recording, replay, input overlay ------------------------------------
    const TAS_BUTTONS = 'BYsSudlrAXLR0123';
    const TAS_FLUSH_FRAMES = 120;
    let tasAutoRecord = true;
    let tasRec = null;           // { frames, lines, live, cheats } while recording
    let tasPlay = null;          // { id, title, pads, count, pos } while replaying
    let tasPendingMovie = null;  // movie waiting for the reboot that starts it
    let tasSessionFrame = 0;     // frames since power-on
    let tasSpeed = 1;
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
      setControlEnabled('tas-takeover', !!tasPlay);
      const ob = document.getElementById('tas-overlay-btn');
      if (ob) ob.classList.toggle('active', tasOverlayOn);
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
      tasFlushWrite();
      tasRec.lines.push('F|' + tasPadText(pad));
      tasRec.frames++;
      tasRec.unsent++;
      if (!fromMovie && pad) tasRec.live = true;
      if (typeof cheatAtlasEnabled !== 'undefined' && (cheatAtlasEnabled || cheatInvincibleEnabled || cheatNoclipEnabled)) tasRec.cheats = true;
      if (tasRec.unsent >= TAS_FLUSH_FRAMES) tasFlush();
    }

    // An event line between two frame lines (see movie.js).
    function tasRecordEvent(line) {
      if (!tasRec) return;
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

    // CRC-32 (IEEE), the same as movie.js crc32 (a test keeps them equal).
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
          try { for (let i = 0; i < ev.bytes.length; i++) m.writeMemory(ev.addr + i, ev.bytes[i]); }
          finally { tasApplying = false; }
          tasRecordEvent('W|' + tasHex(ev.addr, 6) + '|' + ev.bytes.map(b => tasHex(b, 2)).join(''));
        } else if (ev.kind === 'R') {
          if (typeof m._softReset === 'function') m._softReset();
          tasRecordEvent('R|soft');
        } else if (ev.kind === 'S') {
          const got = tasWramCrc(m);
          if (got !== ev.crc && !tasDesync) {
            tasDesync = { frame: frame, expected: tasHex(ev.crc, 8), got: tasHex(got, 8) };
            tasSetStatus('DESYNC at frame ' + frame + ' (expected ' + tasDesync.expected + ', got ' + tasDesync.got + ')');
            vscodeApi.postMessage({ command: 'tasDesync', frame: frame, expected: tasDesync.expected, got: tasDesync.got });
            tasRefreshBadge();
          }
          tasRecordEvent('S|' + tasHex(got, 8));
        } else if (ev.kind === 'T') {
          const got = tasSpaceCrcs(m);
          if (!got) continue;
          for (const sp of TAS_SPACES) {
            if (ev.crcs[sp[0]] !== undefined && ev.crcs[sp[0]] !== got[sp[0]] && !tasDesync) {
              tasDesync = { frame: frame, expected: sp[0] + ' ' + tasHex(ev.crcs[sp[0]], 8), got: tasHex(got[sp[0]], 8) };
              tasSetStatus('DESYNC at frame ' + frame + ' in ' + sp[0] + ' (expected ' + tasHex(ev.crcs[sp[0]], 8) + ', got ' + tasHex(got[sp[0]], 8) + ')');
              vscodeApi.postMessage({ command: 'tasDesync', frame: frame, expected: tasDesync.expected, got: tasDesync.got });
              tasRefreshBadge();
            }
          }
          tasRecordEvent(tasSpacesLine(got));
        }
      }
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
      tasPlay = tasPendingMovie;
      tasPendingMovie = null;
      tasSessionFrame = 0;
      tasLastPad = 0;
      tasPendingW = null;
      tasDesync = null;
      tasInstallWriteHook(getModule());
      if (tasAutoRecord) {
        tasRec = { frames: 0, unsent: 0, lines: [], live: false, cheats: false };
        vscodeApi.postMessage({ command: 'tasRecStart', name: name || 'game', source: tasPlay ? tasPlay.title : '' });
      }
      if (tasPlay) tasSetStatus('replaying ' + tasPlay.title);
      tasRefreshBadge();
      tasRenderList();
    }

    // -- input -------------------------------------------------------------------------
    // Sets the joypad for the frame about to run and records it.
    function tasApplyInput(m, live) {
      let pad = live, fromMovie = false;
      if (tasPlay) {
        tasPlayEvents(m, tasPlay.pos);
        if (tasPlay.pos >= tasPlay.count) {
          tasStopPlayback('replay finished at frame ' + tasPlay.count + (tasDesync ? ' - DESYNCED at frame ' + tasDesync.frame : ' - keyboard has control'));
        } else {
          pad = tasPlay.pads[tasPlay.pos];
          fromMovie = true;
          tasPlay.pos++;
          if (tasPlay.pos % 60 === 0) tasRefreshBadge();
        }
      }
      if (!fromMovie && tasRec && tasSessionFrame > 0 && tasSessionFrame % TAS_CHECK_EVERY === 0) {
        tasRecordEvent('S|' + tasHex(tasWramCrc(m), 8));
        if (tasRec.live && tasVerifyEvery && tasSessionFrame % tasVerifyEvery === 0) {
          tasFlush();
          vscodeApi.postMessage({ command: 'tasVerify' });
        }
        if (tasSessionFrame % TAS_SPACES_EVERY === 0) {
          const crcs = tasSpaceCrcs(m);
          if (crcs) tasRecordEvent(tasSpacesLine(crcs));
        }
      }
      m._setJoypadInput(pad);
      tasLastPad = pad;
      tasSessionFrame++;
      tasRecordFrame(pad, fromMovie);
    }

    // Extra frames to emulate this display frame (fast-forward while replaying).
    function tasExtraFrames() {
      return tasPlay ? Math.min(tasSpeed - 1, tasPlay.count - tasPlay.pos) : 0;
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
      const movie = { id: msg.id, title: msg.title, count: msg.count, pos: 0, events: events,
        pads: new Uint16Array(bytes.buffer, 0, bytes.length >> 1) };
      if (!movie.count) { tasSetStatus('empty recording'); return; }
      const m = getModule();
      // takeInputPolled marks an EVS_TAS core: only there is a restart a power-on.
      if (m && typeof m._takeInputPolled !== 'function') tasNotice = 'this core restarts with a reset, not a power-on: may desync';
      else if (msg.romMatch === false) tasNotice = 'recorded on a different ROM: expect a desync';
      else if (msg.coreMatch === false) tasNotice = 'recorded on a different emulator core build: may desync';
      else tasNotice = (msg.warnings || [])[0] || '';
      tasPendingMovie = movie;
      bootRom(loadedRomData, loadedRomName);
      if (tasNotice) tasSetStatus('replaying ' + movie.title + ' - ' + tasNotice);
    }

    function tasStopPlayback(text) {
      if (!tasPlay) return;
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

    function tasSetOverlay(on, persist) {
      tasOverlayOn = !!on;
      tasRefreshBadge();
      tasDrawOverlay();
      if (persist) vscodeApi.postMessage({ command: 'tasPrefs', overlay: tasOverlayOn });
    }

    // -- list ----------------------------------------------------------------------------
    function tasEsc(s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    function tasRow(it) {
      const parts = [];
      if (it.recording) parts.push('<span class="rec">recording now</span>');
      if (it.frames != null) parts.push(it.frames + ' frames (' + tasFmtTime(it.frames) + ')');
      parts.push(new Date(it.meta && it.meta.started ? it.meta.started : it.mtime).toLocaleString());
      if (it.meta && it.meta.source) parts.push('from ' + tasEsc(it.meta.source));
      if (it.romMatch === false) parts.push('<span class="bad">other ROM</span>');
      if (it.coreMatch === false) parts.push('<span class="bad">other core</span>');
      const warn = (it.warnings || []).join('; ');
      const playing = tasPlay && tasPlay.id === it.id;
      return '<div class="tas-row' + (playing ? ' playing' : '') + '" data-id="' + tasEsc(it.id) + '"' + (it.recording ? ' data-recording="1"' : '') + (warn ? ' title="' + tasEsc(warn) + '"' : '') + '>'
        + '<button class="tas-pin' + (it.pinned ? ' on' : '') + '" data-act="pin" type="button" title="' + (it.pinned ? 'unpin' : 'pin') + '">' + (it.pinned ? '&#9733;' : '&#9734;') + '</button>'
        + '<div class="tas-main"><div class="tas-name">' + tasEsc(it.name) + '</div>'
        + '<div class="tas-meta">' + parts.join(' &middot; ') + (warn ? ' &middot; <span class="bad">' + tasEsc(warn) + '</span>' : '') + '</div></div>'
        + '<button class="ss-btn" data-act="play" type="button" title="' + (it.recording ? 'end this session and replay it from power-on' : 'replay from power-on') + '">' + (playing ? 'restart' : 'play') + '</button>'
        + '<button class="ss-btn" data-act="delete" type="button"' + (it.recording ? ' disabled' : '') + '>delete</button>'
        + '</div>';
    }

    // Only this ROM's recordings (the host compares the SHA-256 in each movie's header).
    function tasRenderList() {
      const list = document.getElementById('tas-list');
      if (!list) return;
      const mine = tasItems.filter(it => it.romMatch === true || it.recording);
      const others = tasItems.length - mine.length;
      const pinned = mine.filter(it => it.pinned), rest = mine.filter(it => !it.pinned);
      let html = '';
      if (pinned.length) html += '<div class="tas-group">PINNED</div>' + pinned.map(tasRow).join('');
      html += '<div class="tas-group">RECORDINGS</div>' + (rest.length ? rest.map(tasRow).join('') : '<div id="tas-empty">No recordings of this ROM yet: play and press some buttons.</div>');
      if (others) html += '<div class="tas-group">' + others + ' recording' + (others === 1 ? '' : 's') + ' of other ROMs not listed</div>';
      list.innerHTML = html;
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
        const btn = evt.target && evt.target.closest ? evt.target.closest('button[data-act]') : null;
        const row = btn ? btn.closest('.tas-row') : null;
        if (!btn || !row || btn.disabled) return;
        const id = row.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        if (act === 'play') {
          if (isMenuOpen) closeEmulatorMenu();
          // The session in progress: close its file first so the replay reads every frame.
          if (row.getAttribute('data-recording')) tasEndRecording();
          tasSetStatus('loading replay...');
          vscodeApi.postMessage({ command: 'tasLoad', id });
        }
        else if (act === 'pin') vscodeApi.postMessage({ command: 'tasPin', id, pinned: !btn.classList.contains('on') });
        else if (act === 'delete') vscodeApi.postMessage({ command: 'tasDelete', id });
      });
      document.getElementById('tas-takeover').addEventListener('click', () => tasStopPlayback());
      document.getElementById('tas-softreset').addEventListener('click', () => tasSoftReset());
      document.getElementById('tas-speed').addEventListener('change', evt => { tasSpeed = parseInt(evt.target.value, 10) || 1; });
      document.getElementById('tas-overlay-btn').addEventListener('click', () => tasSetOverlay(!tasOverlayOn, true));
      document.getElementById('tas-reveal').addEventListener('click', () => vscodeApi.postMessage({ command: 'tasReveal' }));
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
      document.addEventListener('visibilitychange', () => { if (document.hidden) tasFlush(); });
      tasRefreshBadge();
    }

    // Called by the frame loop whenever the emulator pauses or resumes.
    function tasOnPauseChanged(paused) {
      if (paused) tasFlush();
    }

    function handleTasMessage(data) {
      if (data.command === 'tasConfig') {
        initTasTab();
        tasAutoRecord = data.autoRecord !== false;
        tasVerifyEvery = Math.max(0, Math.floor((data.verifyEveryMinutes || 0) * 60 * 60.0988 / TAS_CHECK_EVERY)) * TAS_CHECK_EVERY;
        tasSetOverlay(!!data.overlay, false);
        tasRequestList();
      } else if (data.command === 'tasListResult') {
        tasItems = data.items || [];
        tasRenderList();
      } else if (data.command === 'tasMovie') {
        tasStartPlayback(data);
      } else if (data.command === 'tasStatus') {
        tasSetStatus(data.text);
      } else {
        return false;
      }
      return true;
    }
  `;
}

module.exports = { getTasCss, getTasBadgeHtml, getTasChipHtml, getTasOverlayHtml, getTasViewHtml, getTasClientScript };
