// Ownership: host side of asking the emulator webview for live state. The
// core runs in the webview, so every request is a round trip:
//   host → { command: 'soeRequest', id, kind: 'read', addr, len } | { …, kind: 'status' }
//   page → { command: 'soeReply', id, bytes } | { …, status } | { …, error }
// The page side is webview/memory-bridge.js. Used by the soe://ram/ file system.

const TIMEOUT_MS = 2000;

/** A page reply: `bytes` for a read, `status` for a status request, `error` when it failed. */
interface BridgeReply { command: 'soeReply'; id: number; bytes?: number[]; status?: { romLoaded: boolean; paused: boolean }; error?: string }
interface Waiting { resolve: (r: BridgeReply) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }

class MemoryBridge {
  private _post: (msg: object) => boolean;
  private _pending = new Map<number, Waiting>();
  private _nextId: number;

  /** `post` returns false when there is no panel. */
  constructor(post: (msg: object) => boolean) {
    this._post = post;
    this._nextId = 1;
  }

  /** Bytes at a 24-bit bus address; rejects without a running game. */
  read(addr: number, len: number): Promise<Uint8Array> {
    return this._request({ kind: 'read', addr, len }).then(r => Uint8Array.from(r.bytes || []));
  }

  /** `{ romLoaded, paused }` from the page. */
  status(): Promise<BridgeReply['status']> {
    return this._request({ kind: 'status' }).then(r => r.status);
  }

  /** True when the message was a reply (consumed). */
  handle(msg: { command?: string; id?: number; error?: string } | null | undefined): boolean {
    if (!msg || msg.command !== 'soeReply') return false;
    this._settle(msg.id ?? -1, msg as BridgeReply, msg.error);
    return true;
  }

  /** Fail everything still waiting (panel closed or reloaded). */
  reset(reason: string): void {
    for (const id of [...this._pending.keys()]) this._settle(id, null, reason);
  }

  private _request(payload: object): Promise<BridgeReply> {
    return new Promise<BridgeReply>((resolve, reject) => {
      const id = this._nextId++;
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error('The emulator did not answer'));
      }, TIMEOUT_MS);
      this._pending.set(id, { resolve, reject, timer });
      if (!this._post({ command: 'soeRequest', id, ...payload })) this._settle(id, null, 'The emulator is not open');
    });
  }

  private _settle(id: number, reply: BridgeReply | null, error?: string): void {
    const p = this._pending.get(id);
    if (!p) return;
    this._pending.delete(id);
    clearTimeout(p.timer);
    if (error || !reply) p.reject(new Error(error || 'No reply'));
    else p.resolve(reply);
  }
}

export { MemoryBridge };
