'use strict';

/**
 * emulator/script-debug-host.js
 *
 * Host half of the VS Code script debugger's emulator hook (webview half:
 * script-debug-view.js). One instance lives as long as the extension, not the
 * panel: a debug session can attach before the panel opens, and its
 * configuration rides along with every ROM load so breakpoints are armed
 * before the first frame.
 *
 * This object is the `bridge` of debugger/emulator-session.js:
 *   attach(listener) -> detach()    listener: { onStop, onContinued, onUnavailable, onRomLoad }
 *   configure({ breakpoints })      ROM offsets to stop at
 *   resume(step | null)             step: stop predicate (debugger/script-frames.js)
 *   pause()
 *   read(snesAddress, length) -> Promise<number[]>
 */

const READ_TIMEOUT_MS = 2000;

class ScriptDebugHost {
    /**
     * @param post (message) -> void  posts to the emulator webview (no-op when closed)
     * @param log  (text) -> void
     */
    constructor(post, log) {
        this.post = post;
        this.log = log || (() => {});
        this.listener = null;
        this.breakpoints = [];
        this.reads = new Map();
        this.nextReadId = 1;
    }

    // ---- bridge (debug session side) ----------------------------------------

    attach(listener) {
        this.listener = listener;
        this._configure();
        return () => {
            if (this.listener !== listener) return;
            this.listener = null;
            this.breakpoints = [];
            this._configure();
        };
    }

    configure({ breakpoints }) {
        this.breakpoints = (breakpoints || []).map(address => address >>> 0);
        this._configure();
    }

    resume(step) {
        this.post({ command: 'scriptDebugResume', step: step || null });
    }

    pause() {
        this.post({ command: 'scriptDebugPause' });
    }

    read(address, length) {
        return new Promise(resolve => {
            const id = this.nextReadId++;
            this.reads.set(id, resolve);
            this.post({ command: 'scriptDebugRead', id, address: address >>> 0, length });
            setTimeout(() => { if (this.reads.delete(id)) resolve([]); }, READ_TIMEOUT_MS);
        });
    }

    // ---- panel side -------------------------------------------------------------

    /** Configuration for the webview, sent now and with every ROM load. */
    config() {
        return { active: !!this.listener, breakpoints: this.breakpoints };
    }

    /** A ROM is about to boot: the session may re-resolve its breakpoints (a rebuild moves them). */
    beforeRomLoad() {
        if (this.listener && this.listener.onRomLoad) this.listener.onRomLoad();
        return this.config();
    }

    _configure() {
        this.post(Object.assign({ command: 'scriptDebugConfigure' }, this.config()));
    }

    /** Webview message; true when handled. */
    handle(msg) {
        switch (msg.command) {
            case 'scriptDebugStop':
                this.log(`Script debugger stop (${msg.reason}) @ ${msg.address != null ? msg.address.toString(16) : '-'}`);
                if (this.listener) this.listener.onStop(msg);
                return true;
            case 'scriptDebugContinued':
                if (this.listener) this.listener.onContinued();
                return true;
            case 'scriptDebugStatus':
                if (this.listener && msg.active && msg.running && !msg.api) {
                    this.listener.onUnavailable(
                        'This emulator core has no debugger API. Set everscript.snesCorePath to the custom core ' +
                        '(src/emulator/core/snes9x2005-wasm/snes9x_2005.js) and restart the emulator.');
                }
                return true;
            case 'scriptDebugReadResult': {
                const resolve = this.reads.get(msg.id);
                if (resolve) { this.reads.delete(msg.id); resolve(msg.bytes || []); }
                return true;
            }
            default:
                return false;
        }
    }

    /** The emulator panel closed: nothing left to debug. */
    panelClosed() {
        for (const resolve of this.reads.values()) resolve([]);
        this.reads.clear();
        if (this.listener) this.listener.onUnavailable('Emulator closed.');
    }
}

module.exports = { ScriptDebugHost };
