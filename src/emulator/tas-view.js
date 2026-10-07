'use strict';

/**
 * emulator/tas-view.js
 *
 * The emulator's TAS support, webview half (host half: tas/host.js):
 *  - every boot of a ROM starts an input recording; each emulated frame's pad
 *    words are buffered and sent to the host in batches (and on pause / ROM
 *    change / tab hide), so the SSD sees one small append per two seconds;
 *  - the REPLAYS tab lists pinned movies (the bundled any% TAS first) and
 *    recordings; playing one reboots the loaded ROM (the core's restart is a
 *    true power-on) and feeds the movie's pads frame by frame, optionally
 *    several frames per display frame; "take over" or the movie's end hands
 *    control back to the keyboard while the recording continues as a branch;
 *  - the input overlay draws the pads fed to the core this frame.
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
    #tas-rec-badge { font-size: 10px; padding: 1px 6px; border-radius: 3px; border: 1px solid #333; color: #777; }
    #tas-rec-badge.rec { color: #ff6b6b; border-color: #7a2a2a; background: rgba(120, 30, 30, 0.25); }
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
      width: 236px; height: 80px; pointer-events: none; display: none;
    }
  `;
}

function getTasTabButtonHtml() {
  return `<button id="ss-tab-tas" class="ss-tab" type="button">REPLAYS (<span id="ss-tas-count">-</span>)</button>`;
}

function getTasChipHtml() {
  return `<button id="screen-inputs-toggle" class="screen-chip" type="button" title="Toggle the input overlay (pads fed to the core each frame)">INPUTS OFF</button>`;
}

function getTasOverlayHtml() {
  return `<canvas id="tas-input-overlay" width="472" height="160"></canvas>`;
}

function getTasViewHtml() {
  return `
    <div id="ss-view-tas" class="ss-tab-view">
      <div class="ss-subbar">
        <span id="tas-rec-badge">no ROM</span>
        <button id="tas-takeover" class="ss-btn" type="button" title="Stop the replay here and play on with the keyboard (the recording keeps going)" disabled>take over</button>
        <label title="Frames emulated per display frame while replaying">speed
          <select id="tas-speed"><option value="1">1x</option><option value="2">2x</option><option value="4">4x</option><option value="8">8x</option><option value="16">16x</option></select>
        </label>
        <button id="tas-overlay-btn" class="ss-btn" type="button">input overlay</button>
        <button id="tas-import" class="ss-btn" type="button" title="Copy .lsmv / .evsmv movies into the recordings folder and pin them">import...</button>
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
    let tasYCable = false;       // this session feeds all four pads (setJoypadInputs)
    let tasSessionFrame = 0;     // frames since power-on
    let tasSpeed = 1;
    let tasOverlayOn = false;
    let tasLastPads = [0, 0, 0, 0];
    let tasItems = [];
    let tasNotice = '';

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
        badge.textContent = tasPlay ? 'PLAY ' + tasPlay.pos + ' / ' + tasPlay.count
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
      if (!tasRec || !tasRec.lines.length) return;
      vscodeApi.postMessage({ command: 'tasRecFrames', text: tasRec.lines.join(String.fromCharCode(10)) + String.fromCharCode(10),
        frames: tasRec.lines.length, live: tasRec.live, cheats: tasRec.cheats });
      tasRec.lines = [];
      tasRefreshBadge();
    }

    function tasRecordFrame(p1, p1b, p2, p2b, fromMovie) {
      if (!tasRec) return;
      tasRec.lines.push((p1b | p2 | p2b)
        ? 'F|' + tasPadText(p1) + '|' + tasPadText(p1b) + '|' + tasPadText(p2) + '|' + tasPadText(p2b)
        : 'F|' + tasPadText(p1));
      tasRec.frames++;
      if (!fromMovie && p1) tasRec.live = true;
      if (typeof cheatAtlasEnabled !== 'undefined' && (cheatAtlasEnabled || cheatInvincibleEnabled || cheatNoclipEnabled)) tasRec.cheats = true;
      if (tasRec.lines.length >= TAS_FLUSH_FRAMES) tasFlush();
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
      tasYCable = !!(tasPlay && tasPlay.ycable);
      tasSessionFrame = 0;
      tasLastPads = [0, 0, 0, 0];
      if (tasAutoRecord) {
        tasRec = { frames: 0, lines: [], live: false, cheats: false };
        vscodeApi.postMessage({ command: 'tasRecStart', name: name || 'game', source: tasPlay ? tasPlay.title : '', ycable: tasYCable });
      }
      if (tasPlay) tasSetStatus('replaying ' + tasPlay.title);
      tasRefreshBadge();
      tasRenderList();
    }

    // -- input -------------------------------------------------------------------------
    // Sets the joypads for the frame about to run and records them.
    function tasApplyInput(m, live) {
      let p1 = live, p1b = 0, p2 = 0, p2b = 0, fromMovie = false;
      if (tasPlay) {
        const o = tasPlay.pos * 4, pads = tasPlay.pads;
        p1 = pads[o]; p1b = pads[o + 1]; p2 = pads[o + 2]; p2b = pads[o + 3];
        fromMovie = true;
        if (++tasPlay.pos >= tasPlay.count) tasStopPlayback('replay finished at frame ' + tasPlay.count + ' - keyboard has control');
        else if (tasPlay.pos % 60 === 0) tasRefreshBadge();
      }
      if (tasYCable && typeof m._setJoypadInputs === 'function') m._setJoypadInputs(p1, p1b, p2, p2b);
      else m._setJoypadInput(p1);
      tasLastPads = [p1, p1b, p2, p2b];
      tasSessionFrame++;
      tasRecordFrame(p1, p1b, p2, p2b, fromMovie);
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
      const movie = { id: msg.id, title: msg.title, count: msg.count, pos: 0, ycable: !!msg.ycable,
        pads: new Uint16Array(bytes.buffer, 0, bytes.length >> 1) };
      if (!movie.count) { tasSetStatus('empty replay'); return; }
      const m = getModule();
      if (movie.ycable && m && typeof m._setJoypadInputs !== 'function') tasNotice = 'this core reads pad 1 only: 4-pad movie will desync';
      else if (msg.romMatch === false) tasNotice = 'recorded on a different ROM: expect a desync';
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
      for (let b = 0; b < 4; b++) { ctx.beginPath(); ctx.arc(x + (44 + b * 7) * s, y + 46 * s, 2 * s, 0, Math.PI * 2); fill(on(3 - b), '#c080ff'); }
    }

    function tasDrawOverlay() {
      const c = document.getElementById('tas-input-overlay');
      if (!c) return;
      c.style.display = tasOverlayOn && romLoaded ? 'block' : 'none';
      if (!tasOverlayOn || !romLoaded) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      tasDrawPad(ctx, 4, 40, 2, tasLastPads[0]);
      if (tasYCable) {
        for (let k = 1; k < 4; k++) tasDrawPad(ctx, 240 + ((k - 1) % 2) * 116, 44 + Math.floor((k - 1) / 2) * 60, 1, tasLastPads[k]);
      }
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
      if (!it.builtin) parts.push(new Date(it.meta && it.meta.started ? it.meta.started : it.mtime).toLocaleString());
      if (it.meta && it.meta.authors) parts.push('by ' + tasEsc(it.meta.authors));
      if (it.meta && it.meta.source) parts.push('from ' + tasEsc(it.meta.source));
      if (it.romMatch === true) parts.push('<span class="ok">ROM ok</span>');
      if (it.romMatch === false) parts.push('<span class="bad">other ROM</span>');
      const warn = (it.warnings || []).join('; ');
      const playing = tasPlay && tasPlay.id === it.id;
      return '<div class="tas-row' + (playing ? ' playing' : '') + '" data-id="' + tasEsc(it.id) + '"' + (it.recording ? ' data-recording="1"' : '') + (warn ? ' title="' + tasEsc(warn) + '"' : '') + '>'
        + '<button class="tas-pin' + (it.pinned ? ' on' : '') + '" data-act="pin" type="button" title="' + (it.builtin ? 'bundled with the extension' : it.pinned ? 'unpin' : 'pin') + '"' + (it.builtin ? ' disabled' : '') + '>' + (it.pinned ? '&#9733;' : '&#9734;') + '</button>'
        + '<div class="tas-main"><div class="tas-name">' + tasEsc(it.name) + '</div>'
        + '<div class="tas-meta">' + parts.join(' &middot; ') + (warn ? ' &middot; <span class="bad">' + tasEsc(warn) + '</span>' : '') + '</div></div>'
        + '<button class="ss-btn" data-act="play" type="button" title="' + (it.recording ? 'end this session and replay it from power-on' : 'replay from power-on') + '">' + (playing ? 'restart' : 'play') + '</button>'
        + (it.builtin ? '' : '<button class="ss-btn" data-act="delete" type="button"' + (it.recording ? ' disabled' : '') + '>delete</button>')
        + '</div>';
    }

    function tasRenderList() {
      const list = document.getElementById('tas-list');
      if (!list || !tasItems.length) return;
      const pinned = tasItems.filter(it => it.pinned), rest = tasItems.filter(it => !it.pinned);
      let html = '';
      if (pinned.length) html += '<div class="tas-group">PINNED</div>' + pinned.map(tasRow).join('');
      html += '<div class="tas-group">RECORDINGS</div>' + (rest.length ? rest.map(tasRow).join('') : '<div id="tas-empty">No recordings yet: play and press some buttons.</div>');
      list.innerHTML = html;
      const count = document.getElementById('ss-tas-count');
      if (count) count.textContent = String(tasItems.length);
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
          // The session in progress: close its file first so the replay reads every frame.
          if (row.getAttribute('data-recording')) tasEndRecording();
          tasSetStatus('loading replay...');
          vscodeApi.postMessage({ command: 'tasLoad', id });
        }
        else if (act === 'pin') vscodeApi.postMessage({ command: 'tasPin', id, pinned: !btn.classList.contains('on') });
        else if (act === 'delete') vscodeApi.postMessage({ command: 'tasDelete', id });
      });
      document.getElementById('tas-takeover').addEventListener('click', () => tasStopPlayback());
      document.getElementById('tas-speed').addEventListener('change', evt => { tasSpeed = parseInt(evt.target.value, 10) || 1; });
      document.getElementById('tas-overlay-btn').addEventListener('click', () => tasSetOverlay(!tasOverlayOn, true));
      document.getElementById('tas-import').addEventListener('click', () => vscodeApi.postMessage({ command: 'tasImport' }));
      document.getElementById('tas-reveal').addEventListener('click', () => vscodeApi.postMessage({ command: 'tasReveal' }));
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

module.exports = { getTasCss, getTasTabButtonHtml, getTasChipHtml, getTasOverlayHtml, getTasViewHtml, getTasClientScript };
