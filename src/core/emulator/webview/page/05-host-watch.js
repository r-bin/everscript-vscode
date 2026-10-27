// TODO port to TS (docs/todo/port-to-ts.md)

    // -- Host watch and save alerts ---------------------------------------------------
    // The page keeps running when VS Code's extension host stops (a hang, a restart): it draws and
    // records, but nothing reaches the disk, and a restarted host never takes this page back. The
    // Windows tester's 5 h session (v0.353.5) saved its first hour only: the host restarted, the
    // page played on for 4 h and nobody said so. The host says hostAlive every few seconds
    // (panel.ts); when the page has heard nothing for HOST_LOST_MS while a ROM runs, it pauses the
    // game and says why. Any message from the host ends that (a long save, not a restart) and the
    // game goes on if the watch paused it.
    // emuAlert(key, text): a line over the screen until emuAlertClear(key); the host sends
    // { command: 'emuAlert', key, text } (empty text clears), e.g. when a save fails.
    const HOST_LOST_MS = 20000;
    let hostLastHeard = Date.now();
    let hostLost = false;
    let hostPausedGame = false;
    const emuAlerts = new Map();

    function emuAlertRender() {
      let el = document.getElementById('emu-alert');
      if (!el) {
        if (!emuAlerts.size) return;
        el = document.createElement('div');
        el.id = 'emu-alert';
        el.setAttribute('role', 'alert');
        (document.getElementById('screen-wrap') || document.body).appendChild(el);
      }
      el.hidden = !emuAlerts.size;
      el.textContent = [...emuAlerts.values()].join('\n');
    }

    function emuAlert(key, text) {
      emuAlerts.set(key, text);
      emuAlertRender();
    }

    function emuAlertClear(key) {
      if (emuAlerts.delete(key)) emuAlertRender();
    }

    function hostWatchTick() {
      if (hostLost || !romLoaded || Date.now() - hostLastHeard < HOST_LOST_MS) return;
      hostLost = true;
      const m = getModule();
      if (m && typeof m.pauseEmulation === 'function' && !isEmulatorPaused()) {
        m.pauseEmulation();
        hostPausedGame = true;
      }
      emuAlert('host', 'VS Code has not answered this page for ' + (HOST_LOST_MS / 1000) + ' s: nothing is being saved'
        + ' (replay, CDL), so the game is paused. If this does not clear by itself, the extension host restarted:'
        + ' close this tab and open the emulator again; Continue in the ROM picker resumes the recording.');
      // What the host has not written yet goes where the next page finds it (06-cdl-rescue.js).
      cdlRescuePark();
      // Reaches a host that was only busy, for the log.
      if (vscodeApi) vscodeApi.postMessage({ command: 'hostLost', silentMs: Date.now() - hostLastHeard });
    }
    setInterval(hostWatchTick, 2000);

    window.addEventListener('message', evt => {
      hostLastHeard = Date.now();
      if (hostLost) {
        hostLost = false;
        emuAlertClear('host');
        const m = getModule();
        if (hostPausedGame && m && typeof m.resumeEmulation === 'function' && isEmulatorPaused()) m.resumeEmulation();
        hostPausedGame = false;
      }
      const d = evt.data;
      if (d && d.command === 'emuAlert') {
        if (d.text) emuAlert(d.key, d.text);
        else emuAlertClear(d.key);
      }
    });
