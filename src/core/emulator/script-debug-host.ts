/**
 * core/emulator/script-debug-host.ts
 *
 * Host half of the VS Code script debugger's emulator hook (webview half:
 * script-debug-view.ts). One instance lives as long as the extension, not the
 * panel: a debug session can attach before the panel opens, and its
 * configuration rides along with every ROM load so breakpoints are armed
 * before the first frame.
 *
 * This object is the `bridge` of debugger/emulator-session.ts:
 *   attach(listener) -> detach()    listener: { onStop, onContinued, onUnavailable, onRomLoad }
 *   configure({ breakpoints })      ROM offsets to stop at
 *   resume(step | null)             step: stop predicate (debugger/script-frames.ts)
 *   pause()
 *   read(snesAddress, length) -> Promise<number[]>
 *   write(snesAddress, bytes) -> Promise          (resolves once the webview wrote them)
 */

const READ_TIMEOUT_MS = 2000;

/** The debug session's side of the bridge. */
interface DebugListener {
    onStop(msg: DebugMessage): void;
    onContinued(): void;
    onUnavailable(why: string): void;
    onRomLoad?(): void;
}
/** A message from the webview's half (script-debug.js). */
interface DebugMessage {
    command: string; reason?: string; address?: number | null; id?: number; bytes?: number[];
    active?: boolean; running?: boolean; api?: boolean;
}

class ScriptDebugHost {
    private post: (message: object) => void;
    private log: (text: string) => void;
    private onStop: () => void;
    private listener: DebugListener | null = null;
    private breakpoints: number[] = [];
    private reads = new Map<number, (bytes: number[]) => void>();
    private nextReadId = 1;

    /**
     * `post` posts to the emulator webview (a no-op when it is closed); `onStop` runs after each stop
     * (the panel's "keep focus on break").
     */
    constructor(post: (message: object) => void, log?: (text: string) => void, onStop?: () => void) {
        this.post = post;
        this.log = log || (() => {});
        this.onStop = onStop || (() => {});
    }

    // ---- bridge (debug session side) ----------------------------------------

    attach(listener: DebugListener): () => void {
        this.listener = listener;
        this._configure();
        return () => {
            if (this.listener !== listener) return;
            this.listener = null;
            this.breakpoints = [];
            this._configure();
        };
    }

    configure({ breakpoints }: { breakpoints?: number[] | null }): void {
        this.breakpoints = (breakpoints || []).map(address => address >>> 0);
        this._configure();
    }

    resume(step?: unknown): void {
        this.post({ command: 'scriptDebugResume', step: step || null });
    }

    pause(): void {
        this.post({ command: 'scriptDebugPause' });
    }

    read(address: number, length: number): Promise<number[]> {
        return this._request({ command: 'scriptDebugRead', address: address >>> 0, length });
    }

    write(address: number, bytes: ArrayLike<number>): Promise<number[]> {
        return this._request({ command: 'scriptDebugWrite', address: address >>> 0, bytes: Array.from(bytes) });
    }

    /** Post a request; resolves with the webview's answer (bytes), [] when it does not answer. */
    private _request(message: object): Promise<number[]> {
        return new Promise<number[]>(resolve => {
            const id = this.nextReadId++;
            this.reads.set(id, resolve);
            this.post(Object.assign({ id }, message));
            setTimeout(() => { if (this.reads.delete(id)) resolve([]); }, READ_TIMEOUT_MS);
        });
    }

    // ---- panel side -------------------------------------------------------------

    /** Configuration for the webview, sent now and with every ROM load. */
    config(): { active: boolean; breakpoints: number[] } {
        return { active: !!this.listener, breakpoints: this.breakpoints };
    }

    /** A ROM is about to boot: the session may re-resolve its breakpoints (a rebuild moves them). */
    beforeRomLoad(): { active: boolean; breakpoints: number[] } {
        if (this.listener && this.listener.onRomLoad) this.listener.onRomLoad();
        return this.config();
    }

    private _configure(): void {
        this.post(Object.assign({ command: 'scriptDebugConfigure' }, this.config()));
    }

    /** Webview message; true when handled. */
    handle(msg: DebugMessage): boolean {
        switch (msg.command) {
            case 'scriptDebugStop':
                this.log(`Script debugger stop (${msg.reason}) @ ${msg.address != null ? msg.address.toString(16) : '-'}`);
                if (this.listener) this.listener.onStop(msg);
                this.onStop();
                return true;
            case 'scriptDebugContinued':
                if (this.listener) this.listener.onContinued();
                return true;
            case 'scriptDebugStatus':
                if (this.listener && msg.active && msg.running && !msg.api) {
                    this.listener.onUnavailable(
                        'This emulator core has no debugger API. Set everscript.snesCorePath to the custom core ' +
                        '(src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js) and restart the emulator.');
                }
                return true;
            case 'scriptDebugReadResult': {
                const resolve = msg.id === undefined ? undefined : this.reads.get(msg.id);
                if (resolve && msg.id !== undefined) { this.reads.delete(msg.id); resolve(msg.bytes || []); }
                return true;
            }
            default:
                return false;
        }
    }

    /** The emulator panel closed: nothing left to debug. */
    panelClosed(): void {
        for (const resolve of this.reads.values()) resolve([]);
        this.reads.clear();
        if (this.listener) this.listener.onUnavailable('Emulator closed.');
    }
}

export type { DebugListener, DebugMessage };
export { ScriptDebugHost };
