'use strict';

/**
 * emulator/fps-meter.js
 *
 * Screen chip with two rates, both measured over running (not paused, not
 * hidden) wall time and refreshed once per second:
 *   FPS  - frames the core emulated (every _mainLoop() that ran); drops when
 *          the host cannot keep up;
 *   game - of those, frames in which the game read the joypad (the core's
 *          takeInputPolled, EVS_TAS builds only); drops when the game itself
 *          lags, i.e. spends more than one frame on a frame's work.
 * While paused nothing is counted and the chip keeps its last reading.
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getFpsCss() {
  return `
    #screen-fps { cursor: default; min-width: 74px; text-align: center; }
    #screen-fps.lag { color: #f0b040; border-color: #7a5a20; }
  `;
}

function getFpsChipHtml() {
  return `<span id="screen-fps" class="screen-chip" title="FPS: frames emulated per second. game: frames in which the game read the joypad (fewer = the game lags). Frozen while paused.">-- FPS</span>`;
}

function getFpsClientScript() {
  return `
    // -- FPS meter ------------------------------------------------------------------
    let fpsFrames = 0;
    let fpsPolled = 0;
    let fpsActiveMs = 0;
    let fpsLastTs = null;      // null: not measuring (paused, hidden, just resumed)
    let fpsMeasuring = false;  // the frames of this tick belong to a measured interval

    // Once per frame-loop tick that may emulate, before the frames run.
    function fpsTick(ts, running) {
      if (!running || document.hidden) { fpsLastTs = null; fpsMeasuring = false; return; }
      fpsMeasuring = fpsLastTs !== null;
      if (fpsMeasuring) fpsActiveMs += ts - fpsLastTs;
      fpsLastTs = ts;
      if (fpsActiveMs >= 1000) fpsShow();
    }

    // After every _mainLoop() that emulated a frame.
    function fpsCountFrame(m) {
      const hasPoll = typeof m._takeInputPolled === 'function';
      const polled = hasPoll ? m._takeInputPolled() : 0;
      if (!fpsMeasuring) return;
      fpsFrames++;
      fpsPolled += polled;
    }

    function fpsShow() {
      const el = document.getElementById('screen-fps');
      const m = getModule();
      if (el) {
        const fps = Math.round(fpsFrames * 1000 / fpsActiveMs);
        const game = Math.round(fpsPolled * 1000 / fpsActiveMs);
        const hasPoll = m && typeof m._takeInputPolled === 'function';
        el.textContent = fps + ' FPS' + (hasPoll ? ' | game ' + game : '');
        el.classList.toggle('lag', hasPoll && game < fps - 2);
      }
      fpsFrames = 0;
      fpsPolled = 0;
      fpsActiveMs = 0;
    }

    document.addEventListener('visibilitychange', () => { fpsLastTs = null; fpsMeasuring = false; });
  `;
}

module.exports = { getFpsCss, getFpsChipHtml, getFpsClientScript };
