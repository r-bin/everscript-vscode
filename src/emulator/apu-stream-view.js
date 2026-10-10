'use strict';

/**
 * emulator/apu-stream-view.js
 *
 * Page side of the sound-chip stream for the radar's Music tab
 * (src/music/README.md). While the host has switched it on, every emulated
 * frame posts the core's getApuView (224 bytes: CPU registers, ports, timers,
 * the 128 DSP registers), the loaded package (WRAM $7E0E4B) and each voice's
 * sample: the start address in its directory entry (DSP DIR * 256 + SRCN * 4),
 * which the driver rewrites for every note. A snapshot request answers with
 * the view plus all 64 KB of ARAM.
 *
 *   host -> { command: 'apuStream', on }        page -> { command: 'apuFrame', view, pkg, starts, frame }
 *   host -> { command: 'apuSnapshot', id }      page -> { command: 'apuSnapshotReply', id, view, ram, pkg } | { ..., error }
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getApuStreamClientScript() {
  return `
    let apuStreamOn = false;
    let apuStreamFrame = 0;

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

    function apuLoadedPackage(m) {
      try { return typeof m.readMemory === 'function' ? m.readMemory(0x7E0E4B) : -1; } catch (e) { return -1; }
    }

    // Called once per displayed frame, after mainLoop().
    function apuStreamTick(m, paused) {
      if (!apuStreamOn || !romLoaded) return;
      const view = apuViewBytes(m);
      if (!view) return;
      apuStreamFrame++;
      vscodeApi.postMessage({
        command: 'apuFrame',
        view: Array.from(view),
        pkg: apuLoadedPackage(m),
        starts: apuVoiceStarts(view),
        frame: apuStreamFrame,
        paused: !!paused
      });
    }

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
        }
      } catch (e) {
        reply.error = String(e && e.message || e);
      }
      vscodeApi.postMessage(reply);
    });
  `;
}

module.exports = { getApuStreamClientScript };
