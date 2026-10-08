'use strict';

/**
 * emulator/memory-bridge-view.js
 *
 * Page side of memory-bridge.js: answers { command: 'soeReadMemory' } with the
 * bytes at a bus address. The debugger core reads any bus address through
 * readMemoryRange (4 KB per call); the vanilla core only has its save state,
 * so it serves WRAM from there (offset 0x10c14, verified on that core).
 *
 * Invariant: ASCII only, and no backslashes in the client script (it is
 * embedded in a template literal, see panel-webview.js).
 */

function getMemoryBridgeClientScript() {
  return `
    function soeReadBus(m, addr, len) {
      if (typeof m.readMemoryRange === 'function') {
        const out = new Uint8Array(len);
        for (let off = 0; off < len; off += 4096) {
          const n = Math.min(4096, len - off);
          out.set(m.readMemoryRange(addr + off, n).subarray(0, n), off);
        }
        return out;
      }
      if (addr >= 0x7E0000 && addr + len <= 0x800000 && typeof m._saveState === 'function') {
        const ptr = m._saveState();
        const at = ptr + 0x10c14 + (addr - 0x7E0000);
        const out = HEAPU8.slice(at, at + len);
        if (typeof m._my_free === 'function') m._my_free(ptr);
        return out;
      }
      throw new Error('This core cannot read that address');
    }

    window.addEventListener('message', evt => {
      const d = evt.data;
      if (!d || d.command !== 'soeReadMemory') return;
      const reply = { command: 'soeMemory', id: d.id };
      try {
        const m = getModule();
        if (!m || !romLoaded) reply.error = 'No game is running in the emulator';
        else reply.bytes = Array.from(soeReadBus(m, d.addr >>> 0, d.len >>> 0));
      } catch (e) {
        reply.error = String(e && e.message || e);
      }
      vscodeApi.postMessage(reply);
    });
  `;
}

module.exports = { getMemoryBridgeClientScript };
