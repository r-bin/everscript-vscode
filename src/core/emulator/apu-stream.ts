// Ownership: host side of the sound-chip stream (page side: webview/apu-stream.js).
// Holds whether a listener wants frames, re-sends that wish when the page
// (re)loads, hands frames to the listener and answers snapshot requests.
// extension.js connects it to the radar's Music tab; no vscode dependency.

const TIMEOUT_MS = 3000;

/** One emulated frame of the sound chip: its visible state, the music package, voice starts, driver state, sources. */
/** Fields are passed on as the page sent them (the Music page checks what is missing). */
interface ApuFrame { view?: number[]; pkg?: number; starts?: number[]; drv?: number[]; src: unknown[]; frame?: number; paused: boolean }
interface ApuSnapshot { view?: number[]; ram?: number[]; pkg?: number; frame?: number }
/** A message from the page; only the apu* commands are ours. */
interface ApuMessage {
  command?: string; id?: number; error?: string; paused?: boolean;
  view?: number[]; ram?: number[]; pkg?: number; starts?: number[]; drv?: number[]; src?: unknown[]; frame?: number;
}
interface Waiting { resolve: (s: ApuSnapshot) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }

class ApuStream {
  private _post: (msg: object) => boolean;
  private _on = false;
  private _listener: ((f: ApuFrame) => void) | null = null;
  private _onClose: (() => void) | null = null;
  private _onPause: ((paused: boolean) => void) | null = null;
  private _names: (() => unknown) | null = null;
  private _pending = new Map<number, Waiting>();
  private _nextId = 1;

  /** `post` returns false when there is no page. */
  constructor(post: (msg: object) => boolean) {
    this._post = post;
  }

  /** `fn` gets every emulated frame while on (view: 224 bytes, starts: 8, drv: 89). */
  setListener(fn: ((f: ApuFrame) => void) | null): void { this._listener = fn; }

  setOnClose(fn: (() => void) | null): void { this._onClose = fn; }

  /** fn(paused) when the emulator is paused or resumed. */
  setOnPause(fn: ((paused: boolean) => void) | null): void { this._onPause = fn; }

  /** fn() -> sound-effect names by driver id; sent to every (re)loaded page for the screen's marks. */
  setNames(fn: (() => unknown) | null): void { this._names = fn; this._sendNames(); }

  private _sendNames(): void {
    let names: unknown = null;
    try { names = this._names ? this._names() : null; } catch { names = null; }
    if (names) this._post({ command: 'apuSfxNames', names });
  }

  /** Marks an entity on the emulator screen (0 = none), e.g. the one a sound came from. */
  point(entity: number, label?: string): void { this._post({ command: 'apuPoint', entity: entity | 0, label: String(label || '') }); }

  setOn(on: boolean): void {
    this._on = !!on;
    this._post({ command: 'apuStream', on: this._on });
  }

  /** The page is (re)loaded: it starts off, so repeat the wish. */
  pageReady(): void {
    if (this._on) this._post({ command: 'apuStream', on: true });
    this._sendNames();
  }

  /** { view, ram, pkg, frame } from the running game. */
  snapshot(): Promise<ApuSnapshot> {
    return new Promise<ApuSnapshot>((resolve, reject) => {
      const id = this._nextId++;
      const timer = setTimeout(() => { this._pending.delete(id); reject(new Error('The emulator did not answer')); }, TIMEOUT_MS);
      this._pending.set(id, { resolve, reject, timer });
      if (!this._post({ command: 'apuSnapshot', id })) this._settle(id, null, 'The emulator is not open');
    });
  }

  /** True when the message was ours (consumed). */
  handle(msg: ApuMessage | null | undefined): boolean {
    if (!msg) return false;
    if (msg.command === 'apuFrame') {
      if (this._listener) this._listener({ view: msg.view, pkg: msg.pkg, starts: msg.starts, drv: msg.drv, src: msg.src || [], frame: msg.frame, paused: !!msg.paused });
      return true;
    }

    if (msg.command === 'apuSnapshotReply') { this._settle(msg.id ?? -1, msg, msg.error); return true; }
    if (msg.command === 'apuPaused') { if (this._onPause) this._onPause(!!msg.paused); return true; }
    return false;
  }

  /** The page went away: fail what is waiting. */
  reset(reason: string): void {
    for (const id of [...this._pending.keys()]) this._settle(id, null, reason);
    if (this._onClose) this._onClose();
  }

  private _settle(id: number, reply: ApuMessage | null, error?: string): void {
    const p = this._pending.get(id);
    if (!p) return;
    this._pending.delete(id);
    clearTimeout(p.timer);
    if (error || !reply) p.reject(new Error(error || 'No reply'));
    else p.resolve({ view: reply.view, ram: reply.ram, pkg: reply.pkg, frame: reply.frame });
  }
}

export type { ApuFrame, ApuSnapshot };
export { ApuStream };
