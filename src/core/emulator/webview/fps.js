
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
  