'use strict';
// Ownership: host side of reading emulator memory on request. The core runs
// in the emulator webview, so a read is a round trip:
//   host → { command: 'soeReadMemory', id, addr, len }
//   page → { command: 'soeMemory', id, bytes } | { command: 'soeMemory', id, error }
// The page side is memory-bridge-view.js. Used by the soe://ram/ file system.

const TIMEOUT_MS = 2000;

class MemoryBridge {
  /** @param {(msg: object) => boolean} post  false when there is no panel */
  constructor(post) {
    this._post = post;
    this._pending = new Map();
    this._nextId = 1;
  }

  /** Bytes at a 24-bit bus address; rejects without a running game. */
  read(addr, len) {
    return new Promise((resolve, reject) => {
      const id = this._nextId++;
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error('The emulator did not answer'));
      }, TIMEOUT_MS);
      this._pending.set(id, { resolve, reject, timer });
      if (!this._post({ command: 'soeReadMemory', id, addr, len })) this._settle(id, null, 'The emulator is not open');
    });
  }

  /** True when the message was a reply (consumed). */
  handle(msg) {
    if (!msg || msg.command !== 'soeMemory') return false;
    this._settle(msg.id, msg.bytes, msg.error);
    return true;
  }

  /** Fail everything still waiting (panel closed or reloaded). */
  reset(reason) {
    for (const id of [...this._pending.keys()]) this._settle(id, null, reason);
  }

  _settle(id, bytes, error) {
    const p = this._pending.get(id);
    if (!p) return;
    this._pending.delete(id);
    clearTimeout(p.timer);
    if (error || !bytes) p.reject(new Error(error || 'No bytes returned'));
    else p.resolve(Uint8Array.from(bytes));
  }
}

module.exports = { MemoryBridge };
