'use strict';

/**
 * debugger/emulator-session.js
 *
 * Debug Adapter Protocol session for .evs scripts running in the embedded
 * emulator. Transport-agnostic: handleMessage(request) in, send(message) out
 * (inline-adapter.js connects it to VS Code). No VS Code API, no emulator
 * internals: everything outside the protocol comes in through `deps`:
 *
 *   bridge     emulator script hook (emulator/script-debug-host.js):
 *              attach(listener) -> detach(); configure({ breakpoints });
 *              resume(step | null); pause(); read(address, length) -> Promise<bytes>;
 *              write(address, bytes) -> Promise;
 *              listener: { onStop(snapshot), onContinued(), onUnavailable(text), onRomLoad() }
 *   build      (config) -> Promise<boolean>   compile the .evs (launch)
 *   run        (config) -> Promise<void>      load the built ROM into the emulator (launch)
 *   findMap    (config) -> path | null        out/source_map.json
 *   lookupSymbol (name) -> "(Byte) <0x0ADA>" | null   fallback names (language index)
 *
 * Stops come from the interpreter hook, so they always land between two
 * script instructions. A statement can be several instructions and inlined
 * functions add levels (see source-map.js); one step therefore runs as many
 * instructions as it takes to reach another line.
 */

const path = require('path');
const { loadSourceMap, isStale } = require('./source-map');
const frames = require('./script-frames');
const memory = require('./memory-access');
const { inferTypes } = require('./value-types');

const NO_SCRIPT_THREAD = { id: 1000, name: 'no script running' };

class EmulatorDebugSession {
    constructor(deps) {
        this.deps = deps;
        this.send = () => {};
        this.seq = 1;
        this.map = null;
        this.config = {};
        this.requested = new Map();      // file -> [{ line }] as VS Code set them
        this.breakpointLines = new Set(); // 'file:line' of verified breakpoints
        this.snapshot = null;            // last stop
        this.level = 0;                  // inline level the stopped slot is shown at
        this.handles = [];               // frame / variable references of the current stop
        this.detach = null;
        this.memory = new memory.MemoryInspector(deps.bridge, () => this.map, deps.lookupSymbol);
    }

    // ---- protocol plumbing ------------------------------------------------

    handleMessage(msg) {
        if (msg.type !== 'request') return;
        const handler = this['_' + msg.command];
        Promise.resolve()
            .then(() => handler ? handler.call(this, msg.arguments || {}, msg) : {})
            .then(body => { if (body !== undefined) this._respond(msg, body); })
            .catch(err => this._respond(msg, { error: { id: 1, format: String(err && err.message || err) } }, false));
    }

    _respond(req, body, success = true) {
        const message = { seq: this.seq++, type: 'response', request_seq: req.seq, success, command: req.command, body };
        if (!success) message.message = body.error.format;
        this.send(message);
    }

    _event(event, body = {}) {
        this.send({ seq: this.seq++, type: 'event', event, body });
    }

    _output(text, category = 'console') {
        this._event('output', { category, output: text + '\n' });
    }

    // ---- lifecycle --------------------------------------------------------

    _initialize() {
        return {
            supportsConfigurationDoneRequest: true,
            supportsEvaluateForHovers: true,
            supportsSetVariable: true,
            supportsSetExpression: true,
            supportsReadMemoryRequest: true,
            supportsWriteMemoryRequest: true,
            supportsBreakpointLocationsRequest: true,
            supportsSteppingGranularity: false,
            supportsTerminateRequest: true,
        };
    }

    async _launch(args, req) {
        this.config = Object.assign({ build: true }, args);
        if (this.config.build) {
            this._output('[evs-dbg] Building ' + path.basename(this.config.program || '') + ' ...');
            if (!await this.deps.build(this.config)) throw new Error('Build failed, see Output > Everscript Build.');
        }
        if (this.config.noDebug) {
            // Run without debugging: build and run, nothing to attach.
            if (this.deps.run) await this.deps.run(this.config);
            this._respond(req, {});
            this._event('terminated');
            return undefined;
        }
        return this._start(req);
    }

    async _attach(args, req) {
        this.config = Object.assign({}, args, { build: false, run: false });
        return this._start(req);
    }

    _start(req) {
        this._loadMap(true);
        this.detach = this.deps.bridge.attach({
            onStop: snapshot => this._onStop(snapshot),
            onContinued: () => { this.snapshot = null; this._event('continued', { threadId: NO_SCRIPT_THREAD.id, allThreadsContinued: true }); },
            onUnavailable: text => { this._output('[evs-dbg] ' + text, 'stderr'); this._event('terminated'); },
            // A rebuilt ROM moves every address: re-resolve before it boots.
            onRomLoad: () => this._reloadIfStale(),
        });
        this._respond(req, {});
        this._event('initialized');
        return undefined;
    }

    async _configurationDone() {
        this._applyBreakpoints();
        if (this.config.run !== false && this.deps.run) await this.deps.run(this.config);
        return {};
    }

    _disconnect() {
        this._end();
        return {};
    }

    _terminate() {
        this._end();
        this._event('terminated');
        return {};
    }

    dispose() {
        this._end();
    }

    _end() {
        if (!this.detach) return;
        this.deps.bridge.configure({ breakpoints: [] });
        this.deps.bridge.resume(null);
        this.detach();
        this.detach = null;
    }

    // ---- source map and breakpoints ----------------------------------------

    _loadMap(announce) {
        const mapPath = this.deps.findMap(this.config);
        if (!mapPath) {
            this.map = null;
            this._output('[evs-dbg] No out/source_map.json found: breakpoints stay unverified. Rebuild with a compiler that writes it.', 'stderr');
            return;
        }
        try {
            this.map = loadSourceMap(mapPath);
            this.map.types = inferTypes(this.map.files, this.map.symbols, this.map.constants);
            if (announce) this._output('[evs-dbg] Source map: ' + mapPath + ' (' + this.map.statements.length + ' statements)');
        } catch (err) {
            this.map = null;
            this._output('[evs-dbg] Could not read ' + mapPath + ': ' + err.message, 'stderr');
        }
    }

    _reloadIfStale() {
        if (!this.map || !isStale(this.map)) return;
        this._loadMap(false);
        this._output('[evs-dbg] Source map changed, breakpoints re-resolved.');
        for (const [file, lines] of this.requested) {
            for (const bp of this._resolve(file, lines)) this._event('breakpoint', { reason: 'changed', breakpoint: bp });
        }
        this._applyBreakpoints();
    }

    _setBreakpoints(args) {
        const file = path.normalize((args.source && args.source.path) || '');
        const lines = (args.breakpoints || []).map((bp, i) => ({ line: bp.line, id: this._breakpointId(file, i) }));
        this.requested.set(file, lines);
        const breakpoints = this._resolve(file, lines);
        this._applyBreakpoints();
        return { breakpoints };
    }

    _breakpointId(file, index) {
        if (!this.ids) this.ids = new Map();
        const key = file + '#' + index;
        if (!this.ids.has(key)) this.ids.set(key, this.ids.size + 1);
        return this.ids.get(key);
    }

    /** DAP breakpoints for a file's requested lines; a line without code moves to the next one in its function. */
    _resolve(file, lines) {
        return lines.map(({ line, id }) => {
            if (!this.map) return { id, verified: false, line, message: 'No source map (out/source_map.json)' };
            if (this.map.locationsAt(file, line).length) return { id, verified: true, line };
            const span = this.map.functionSpan(file, line);
            const next = span && this.map.linesWithCode(file).find(l => l > line && l <= span.end);
            if (next) return { id, verified: true, line: next, moved: true };
            return { id, verified: false, line, message: 'No script code on this line (not compiled, or not @install-ed nor called)' };
        });
    }

    _applyBreakpoints() {
        const addresses = new Set();
        this.breakpointLines = new Set();
        if (this.map) {
            for (const [file, lines] of this.requested) {
                for (const bp of this._resolve(file, lines)) {
                    if (!bp.verified) continue;
                    this.breakpointLines.add(file + ':' + bp.line);
                    for (const loc of this.map.locationsAt(file, bp.line)) addresses.add(loc.address);
                }
            }
        }
        if (this.detach) this.deps.bridge.configure({ breakpoints: [...addresses] });
    }

    _breakpointLocations(args) {
        const file = path.normalize((args.source && args.source.path) || '');
        const end = args.endLine || args.line;
        const lines = this.map ? this.map.linesWithCode(file).filter(l => l >= args.line && l <= end) : [];
        return { breakpoints: lines.map(line => ({ line })) };
    }

    // ---- stops --------------------------------------------------------------

    _onStop(snapshot) {
        this._reloadIfStale();
        this.snapshot = snapshot;
        this.handles = [];
        const previous = this.lastStop;
        this.level = frames.stopLevel(this.map, snapshot, this.breakpointLines, previous);
        this._rememberStop();
        const stopped = this._stoppedSlot();
        this._event('stopped', {
            reason: snapshot.reason === 'breakpoint' ? 'breakpoint' : snapshot.reason === 'step' ? 'step' : 'pause',
            threadId: stopped ? frames.threadId(stopped) : this._threadList()[0].id,
            allThreadsStopped: true,
        });
    }

    /** Where the stopped slot is shown (for the next stop's level). */
    _rememberStop() {
        const snap = this.snapshot;
        const chain = this.map && snap && snap.address != null ? this.map.chainAt(snap.address & 0x3FFFFF) : null;
        this.lastStop = chain ? { slot: snap.slot, chain, level: this.level } : null;
    }

    _stoppedSlot() {
        const snap = this.snapshot;
        return snap && snap.slot ? snap.slots.find(slot => slot.ptr === snap.slot) || null : null;
    }

    _threadList() {
        if (!this.snapshot) return [NO_SCRIPT_THREAD];
        const live = frames.liveThreads(this.snapshot);
        if (!live.length) return [NO_SCRIPT_THREAD];
        return live.map(slot => ({ id: frames.threadId(slot), name: frames.threadName(this.map, this.snapshot, slot) }));
    }

    _slotForThread(threadId) {
        if (!this.snapshot) return null;
        return frames.liveThreads(this.snapshot).find(slot => frames.threadId(slot) === threadId) || null;
    }

    _handle(value) {
        this.handles.push(value);
        return this.handles.length;
    }

    // ---- execution control -------------------------------------------------

    _continue() {
        this.deps.bridge.resume(null);
        return { allThreadsContinued: true };
    }

    _pause() {
        this.deps.bridge.pause();
        return {};
    }

    _next(args) { return this._step(args, 'over'); }
    _stepIn(args) { return this._step(args, 'in'); }
    _stepOut(args) { return this._step(args, 'out'); }

    _step(args, kind) {
        const slot = this._slotForThread(args.threadId) || this._stoppedSlot();
        if (!slot) {
            this.deps.bridge.resume(null);
            return {};
        }
        const level = slot === this._stoppedSlot() ? this.level : Infinity;
        if (kind === 'in') {
            const deeper = frames.inlineStepInLevel(this.map, this.snapshot, slot, level);
            if (deeper !== null) {
                // The inlined callee starts at this very address: nothing to run.
                this.level = deeper;
                this.handles = [];
                this._rememberStop();
                setImmediate(() => this._event('stopped', { reason: 'step', threadId: frames.threadId(slot), allThreadsStopped: true }));
                return {};
            }
        }
        this.deps.bridge.resume(frames.stepPredicate(this.map, this.snapshot, slot, level, kind));
        return {};
    }

    // ---- inspection ---------------------------------------------------------

    _threads() {
        return { threads: this._threadList() };
    }

    _stackTrace(args) {
        const slot = this._slotForThread(args.threadId);
        if (!slot) return { stackFrames: [], totalFrames: 0 };
        const level = slot === this._stoppedSlot() ? this.level : null;
        const list = frames.threadFrames(this.map, this.snapshot, slot, level);
        const stackFrames = list.map(frame => ({
            id: this._handle({ kind: 'frame', slot: frame.slot, file: frame.file, line: frame.line }),
            name: frame.name,
            source: frame.file ? { name: path.basename(frame.file), path: frame.file } : undefined,
            line: frame.line,
            column: 1,
            presentationHint: frame.file ? 'normal' : 'subtle',
            instructionPointerReference: '0x' + (frame.address >>> 0).toString(16).toUpperCase(),
        }));
        return { stackFrames, totalFrames: stackFrames.length };
    }

    _scopes(args) {
        const frame = this.handles[args.frameId - 1];
        if (!frame || frame.kind !== 'frame') return { scopes: [] };
        const scopes = [];
        if (frame.file) {
            scopes.push({ name: 'Memory', presentationHint: 'locals', expensive: false,
                variablesReference: this._handle({ kind: 'memory', file: frame.file, line: frame.line }) });
        }
        scopes.push(
            { name: 'Arguments', variablesReference: this._handle({ kind: 'args', slot: frame.slot }), expensive: false },
            { name: 'Script slot', variablesReference: this._handle({ kind: 'slot', slot: frame.slot }), expensive: false },
        );
        return { scopes };
    }

    async _variables(args) {
        const ref = this.handles[args.variablesReference - 1];
        if (!ref || !this.snapshot) return { variables: [] };
        if (ref.kind === 'memory') {
            const span = this.map && this.map.functionSpan(ref.file, ref.line);
            return { variables: await this.memory.variables(ref.file, span ? span.start : ref.line, span ? span.end : ref.line) };
        }
        const byPtr = new Map(this.snapshot.slots.map(slot => [slot.ptr, slot]));
        const list = ref.kind === 'args' ? frames.argVariables(ref.slot) : frames.slotVariables(ref.slot, byPtr);
        return { variables: list.map(v => Object.assign({ variablesReference: 0 }, v)) };
    }

    _evaluate(args) {
        const frame = args.frameId ? this.handles[args.frameId - 1] : null;
        return this.memory.evaluate(args.expression, (frame && frame.slot) || this._stoppedSlot(), args.context);
    }

    _setExpression(args) { return this.memory.set(args.expression, args.value); }  // watch editing
    _setVariable(args) { return this.memory.set(args.name, args.value); }          // Memory scope editing
    _readMemory(args) { return memory.readMemoryRequest(args, this.deps.bridge); }
    _writeMemory(args) { return memory.writeMemoryRequest(args, this.deps.bridge); }
}

module.exports = { EmulatorDebugSession };
