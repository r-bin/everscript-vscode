// TODO port to TS (docs/todo/port-to-ts.md)

    // -- FPS meter ------------------------------------------------------------------
    let fpsFrames = 0;
    let fpsPolled = 0;
    let fpsActiveMs = 0;
    let fpsLastTs = null;      // null: not measuring (paused, hidden, just resumed)
    let fpsMeasuring = false;  // the frames of this tick belong to a measured interval
    // The pace the host logs once a minute of play (panel-messages.ts emuPace): emulated frames, screen
    // refreshes (every requestAnimationFrame) and the sound reserve, for reports like "4x looks like 10x
    // on my 144 Hz screen" that the frame-loop arithmetic alone cannot explain.
    const PACE_REPORT_MS = 60000;
    let paceMs = 0, paceFrames = 0, paceRefreshes = 0;

    // Once per frame-loop tick that may emulate, before the frames run.
    function fpsTick(ts, running) {
      if (!running || document.hidden) { fpsLastTs = null; fpsMeasuring = false; return; }
      fpsMeasuring = fpsLastTs !== null;
      if (fpsMeasuring) { fpsActiveMs += ts - fpsLastTs; paceMs += ts - fpsLastTs; }
      fpsLastTs = ts;
      if (fpsActiveMs >= 1000) fpsShow();
      if (paceMs >= PACE_REPORT_MS) paceReport();
    }

    // Every screen refresh (requestAnimationFrame), also those the frame loop skips.
    function fpsRefresh() {
      if (fpsLastTs !== null) paceRefreshes++;
    }

    function paceReport() {
      const s = paceMs / 1000;
      const fps = paceFrames / s;
      vscodeApi.postMessage({
        command: 'emuPace', fps: Math.round(fps), ratio: (fps / 60).toFixed(2), speed: speedMultiplier,
        hz: Math.round(paceRefreshes / s), soundMs: Math.round((audioRing.w - audioRing.r) * 1000 / AUDIO_FREQ),
      });
      paceMs = 0; paceFrames = 0; paceRefreshes = 0;
    }

    // After every _mainLoop() that emulated a frame.
    function fpsCountFrame(m) {
      const hasPoll = typeof m._takeInputPolled === 'function';
      const polled = hasPoll ? m._takeInputPolled() : 0;
      if (!fpsMeasuring) return;
      fpsFrames++;
      paceFrames++;
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
  