import { pageFile } from './page-file';

/**
 * emulator/apu-stream-view.ts
 *
 * Page side of the sound-chip stream for the radar's Music tab
 * (src/games/evermore/music/README.md). While the host has switched it on, every emulated
 * frame posts the core's getApuView (224 bytes: CPU registers, ports, timers,
 * the 128 DSP registers), the loaded package (WRAM $7E0E4B) and each voice's
 * sample: the start address in its directory entry (DSP DIR * 256 + SRCN * 4),
 * which the driver rewrites for every note, and `drv`: the sound driver's own
 * bookkeeping, read from ARAM (APU_DRIVER_RANGES; the Music tab decodes it in
 * music-view.js): who owns each voice, which effect, and the command queue.
 * A snapshot request answers with the view plus all 64 KB of ARAM and the
 * frame it was taken after.
 *
 *   host -> { command: 'apuStream', on }        page -> { command: 'apuFrame', view, pkg, starts, drv, src, frame }
 *                                               page -> { command: 'apuPaused', paused }   (on every pause / resume)
 *   host -> { command: 'apuSnapshot', id }      page -> { command: 'apuSnapshotReply', id, view, ram, pkg, frame } | { ..., error }
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.ts).
 */

// [ARAM address, length] read into `drv`, in this order (89 bytes).
const APU_DRIVER_RANGES = [[0x6C, 8], [0xD1, 8], [0x11B, 8], [0x75, 16], [0xEA, 1], [0x1043, 48]];

function getApuStreamClientScript() {
  return pageFile('apu-stream.js');
}

export { getApuStreamClientScript, APU_DRIVER_RANGES };
