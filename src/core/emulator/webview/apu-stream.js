
    let apuStreamOn = false;
    let apuStreamFrame = 0;
    const APU_DRIVER_RANGES = [[108,8],[209,8],[283,8],[117,16],[234,1],[4163,48]];

    function apuViewBytes(m) {
      if (!m || typeof m._getApuView !== 'function') return null;
      const p = m._getApuView();
      return p ? HEAPU8.slice(p, p + 224) : null;
    }

    // Each voice's sample start, read from ARAM through DIR and SRCN.
    function apuVoiceStarts(view) {
      const ram = view[0] | view[1] << 8 | view[2] << 16 | view[3] * 16777216;
      const dir = view[32 + 0x5D] * 256;
      const out = [];
      for (let v = 0; v < 8; v++) {
        const at = ram + ((dir + view[32 + v * 16 + 4] * 4) & 0xFFFF);
        out.push(HEAPU8[at] | HEAPU8[at + 1] << 8);
      }
      return out;
    }

    // The driver's voice owners, effects and command queue (see APU_DRIVER_RANGES).
    function apuDriverBytes(view) {
      const ram = view[0] | view[1] << 8 | view[2] << 16 | view[3] * 16777216;
      const out = [];
      for (const r of APU_DRIVER_RANGES) for (let i = 0; i < r[1]; i++) out.push(HEAPU8[ram + r[0] + i]);
      return out;
    }

    function apuLoadedPackage(m) {
      // The music package the game loaded (Evermore: sound-source-view.js gameMusicPackage), -1 when unknown.
      try { return typeof gameMusicPackage === 'function' ? gameMusicPackage(m) : -1; } catch (e) { return -1; }
    }

    // Called once per displayed frame, after mainLoop().
    function apuStreamTick(m, paused) {
      // Who sent each sound effect: the game's (Evermore: sound-source-view.js), none without it.
      const hasSnd = typeof sndSync === 'function';
      if (hasSnd) sndSync(m, romLoaded && emuGameRom && (apuStreamOn || sndShow));
      const src = hasSnd ? sndTake(paused) : [];
      if (!apuStreamOn || !romLoaded) return;
      const view = apuViewBytes(m);
      if (!view) return;
      apuStreamFrame++;
      vscodeApi.postMessage({
        command: 'apuFrame',
        view: Array.from(view),
        pkg: apuLoadedPackage(m),
        starts: apuVoiceStarts(view),
        drv: apuDriverBytes(view),
        src: src,   // games/evermore/emulator/sound-source-view.js: who sent each effect this frame
        frame: apuStreamFrame,
        paused: !!paused
      });
    }

    // The emulator's pause button pauses the Music tab's own player too.
    function apuPauseChanged(paused) { vscodeApi.postMessage({ command: 'apuPaused', paused: !!paused }); }

    window.addEventListener('message', evt => {
      const d = evt.data;
      if (!d) return;
      if (d.command === 'apuStream') { apuStreamOn = !!d.on; return; }
      if (d.command !== 'apuSnapshot') return;
      const reply = { command: 'apuSnapshotReply', id: d.id };
      try {
        const m = getModule();
        const view = romLoaded ? apuViewBytes(m) : null;
        if (!view) {
          reply.error = romLoaded ? 'This emulator core cannot show the sound chip (rebuild the custom core)' : 'No game is running in the emulator';
        } else {
          const ram = view[0] | view[1] << 8 | view[2] << 16 | view[3] * 16777216;
          reply.view = Array.from(view);
          reply.ram = Array.from(HEAPU8.subarray(ram, ram + 65536));
          reply.pkg = apuLoadedPackage(m);
          reply.frame = apuStreamFrame;
        }
      } catch (e) {
        reply.error = String(e && e.message || e);
      }
      vscodeApi.postMessage(reply);
    });
  