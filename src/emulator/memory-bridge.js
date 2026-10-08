'use strict';
// Ownership: host side of asking the emulator webview for live state. The
// core runs in the webview, so every request is a round trip:
//   host → { command: 'soeRequest', id, kind: 'read', addr, len } | { …, kind: 'status' }
//   page → { command: 'soeReply', id, bytes } | { …, status } | { …, error }
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
    return this._request({ kind: 'read', addr, len }).then(r => Uint8Array.from(r.bytes));
  }

  /** `{ romLoaded, paused }` from the page. */
  status() {
    return this._request({ kind: 'status' }).then(r => r.status);
  }

  /** True when the message was a reply (consumed). */
  handle(msg) {
    if (!msg || msg.command !== 'soeReply') return false;
    this._settle(msg.id, msg, msg.error);
    return true;
  }

  /** Fail everything still waiting (panel closed or reloaded). */
  reset(reason) {
    for (const id of [...this._pending.keys()]) this._settle(id, null, reason);
  }

  _request(payload) {
    return new Promise((resolve, reject) => {
      const id = this._nextId++;
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error('The emulator did not answer'));
      }, TIMEOUT_MS);
      this._pending.set(id, { resolve, reject, timer });
      if (!this._post({ command: 'soeRequest', id, ...payload })) this._settle(id, null, 'The emulator is not open');
    });
  }

  _settle(id, reply, error) {
    const p = this._pending.get(id);
    if (!p) return;
    this._pending.delete(id);
    clearTimeout(p.timer);
    if (error || !reply) p.reject(new Error(error || 'No reply'));
    else p.resolve(reply);
  }
}

module.exports = { MemoryBridge };
