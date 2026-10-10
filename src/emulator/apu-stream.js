'use strict';
// Ownership: host side of the sound-chip stream (page side: apu-stream-view.js).
// Holds whether a listener wants frames, re-sends that wish when the page
// (re)loads, hands frames to the listener and answers snapshot requests.
// extension.js connects it to the radar's Music tab; no vscode dependency.

const TIMEOUT_MS = 3000;

class ApuStream {
  /** @param {(msg: object) => boolean} post  false when there is no page */
  constructor(post) {
    this._post = post;
    this._on = false;
    this._listener = null;
    this._onClose = null;
    this._pending = new Map();
    this._nextId = 1;
  }

  /** fn({ view: number[224], pkg, starts: number[8], drv: number[89], frame, paused }) for every emulated frame while on. */
  setListener(fn) { this._listener = fn; }

  setOnClose(fn) { this._onClose = fn; }

  setOn(on) {
    this._on = !!on;
    this._post({ command: 'apuStream', on: this._on });
  }

  /** The page is (re)loaded: it starts off, so repeat the wish. */
  pageReady() { if (this._on) this._post({ command: 'apuStream', on: true }); }

  /** { view, ram, pkg, frame } from the running game. */
  snapshot() {
    return new Promise((resolve, reject) => {
      const id = this._nextId++;
      const timer = setTimeout(() => { this._pending.delete(id); reject(new Error('The emulator did not answer')); }, TIMEOUT_MS);
      this._pending.set(id, { resolve, reject, timer });
      if (!this._post({ command: 'apuSnapshot', id })) this._settle(id, null, 'The emulator is not open');
    });
  }

  /** True when the message was ours (consumed). */
  handle(msg) {
    if (!msg) return false;
    if (msg.command === 'apuFrame') {
      if (this._listener) this._listener({ view: msg.view, pkg: msg.pkg, starts: msg.starts, drv: msg.drv, frame: msg.frame, paused: !!msg.paused });
      return true;
    }

    if (msg.command === 'apuSnapshotReply') { this._settle(msg.id, msg, msg.error); return true; }
    return false;
  }

  /** The page went away: fail what is waiting. */
  reset(reason) {
    for (const id of [...this._pending.keys()]) this._settle(id, null, reason);
    if (this._onClose) this._onClose();
  }

  _settle(id, reply, error) {
    const p = this._pending.get(id);
    if (!p) return;
    this._pending.delete(id);
    clearTimeout(p.timer);
    if (error || !reply) p.reject(new Error(error || 'No reply'));
    else p.resolve({ view: reply.view, ram: reply.ram, pkg: reply.pkg, frame: reply.frame });
  }
}

module.exports = { ApuStream };
