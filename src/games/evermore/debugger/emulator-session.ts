/**
 * debugger/emulator-session.ts
 *
 * Debug Adapter Protocol session for .evs scripts running in the embedded
 * emulator. Transport-agnostic: handleMessage(request) in, send(message) out
 * (inline-adapter.js connects it to VS Code). No VS Code API, no emulator
 * internals: everything outside the protocol comes in through `deps`:
 *
 *   bridge     emulator script hook (emulator/script-debug-host.ts):
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
 * functions add levels (see source-map.ts); one step therefore runs as many
 * instructions as it takes to reach another line.
 */

import * as path from 'path';
import { loadSourceMap, isStale } from './source-map';
import * as frames from './script-frames';
import * as memory from './memory-access';
import { inferTypes } from './value-types';
import type { SourceMap } from './source-map';
import type { Slot, Snapshot } from './script-frames';

/** A DAP request or response, as far as this session reads it. */
interface DapRequest { type: string; seq: number; command: string; arguments?: any }
interface DapResponse { seq: number; type: 'response'; request_seq: number; success: boolean; command: string; body: any; message?: string }
type Message = DapResponse | { seq: number; type: 'event'; event: string; body: object };
type Breakpoint = { id: number; verified: boolean; line: number; message?: string; moved?: boolean };
/** What the session needs from the host (see the header). */
interface Deps {
    bridge: memory.Bridge & {
        attach(listener: Listener): () => void; configure(options: { breakpoints: number[] }): void;
        resume(step: object | null): void; pause(): void;
    };
    build(config: Config): Promise<boolean>;
    run?(config: Config): Promise<void>;
    findMap(config: Config): string | null;
    lookupSymbol?(name: string): string | null | undefined;
}
interface Listener { onStop(snapshot: Snapshot): void; onContinued(): void; onUnavailable(text: string): void; onRomLoad(): void }
interface Config { build?: boolean; run?: boolean; noDebug?: boolean; program?: string; [key: string]: unknown }
type Handle = { kind: 'frame'; slot: Slot; file: string | null; line: number } | { kind: 'memory'; file: string; line: number } | { kind: 'args'; slot: Slot } | { kind: 'slot'; slot: Slot };

/** The DAP commands the session answers, each by its `_<command>` method (never the helper methods). */
const COMMANDS = new Set(['initialize', 'launch', 'attach', 'configurationDone', 'disconnect', 'terminate', 'setBreakpoints', 'breakpointLocations',
    'continue', 'pause', 'next', 'stepIn', 'stepOut', 'threads', 'stackTrace', 'scopes', 'variables', 'evaluate', 'setExpression', 'setVariable',
    'readMemory', 'writeMemory']);

const NO_SCRIPT_THREAD = { id: 1000, name: 'no script running' };

class EmulatorDebugSession {
    send: (message: Message) => void = () => {};
    seq = 1;
    map: SourceMap | null = null;
    config: Config = {};
    requested = new Map<string, { line: number; id: number }[]>();   // file -> lines as VS Code set them
    breakpointLines = new Set<string>();   // 'file:line' of verified breakpoints
    snapshot: Snapshot | null = null;      // last stop
    level = 0;                             // inline level the stopped slot is shown at
    handles: Handle[] = [];                // frame / variable references of the current stop
    detach: (() => void) | null = null;
    lastStop: { slot: number | null; chain: ReturnType<SourceMap['chainAt']>; level: number } | null = null;
    ids?: Map<string, number>;
    memory: memory.MemoryInspector;

    constructor(readonly deps: Deps) {
        this.memory = new memory.MemoryInspector(deps.bridge, () => this.map, deps.lookupSymbol);
    }

    // ---- protocol plumbing ------------------------------------------------

    handleMessage(msg: DapRequest): void {
        if (msg.type !== 'request') return;
        const handler = COMMANDS.has(msg.command) ? (this as unknown as Record<string, (args: any, req: DapRequest) => unknown>)['_' + msg.command] : undefined;
        Promise.resolve()
            .then(() => handler ? handler.call(this, msg.arguments || {}, msg) : {})
            .then(body => { if (body !== undefined) this._respond(msg, body); })
            .catch(err => this._respond(msg, { error: { id: 1, format: String(err instanceof Error ? err.message : err) } }, false));
    }

    _respond(req: DapRequest, body: any, success = true): void {
        const message: DapResponse = { seq: this.seq++, type: 'response', request_seq: req.seq, success, command: req.command, body };
        if (!success) message.message = body.error.format;
        this.send(message);
    }

    _event(event: string, body: object = {}): void {
        this.send({ seq: this.seq++, type: 'event', event, body });
    }

    _output(text: string, category = 'console'): void {
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

    async _launch(args: Config, req: DapRequest) {
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

    async _attach(args: Config, req: DapRequest) {
        this.config = Object.assign({}, args, { build: false, run: false });
        return this._start(req);
    }

    _start(req: DapRequest): undefined {
        this._loadMap(true);
        this.detach = this.deps.bridge.attach({
            onStop: (snapshot: Snapshot) => this._onStop(snapshot),
            onContinued: () => { this.snapshot = null; this._event('continued', { threadId: NO_SCRIPT_THREAD.id, allThreadsContinued: true }); },
            onUnavailable: (text: string) => { this._output('[evs-dbg] ' + text, 'stderr'); this._event('terminated'); },
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

    _loadMap(announce: boolean): void {
        const mapPath = this.deps.findMap(this.config);
        if (!mapPath) {
            this.map = null;
            this._output('[evs-dbg] No out/source_map.json found: breakpoints stay unverified. Rebuild with a compiler that writes it.', 'stderr');
            return;
        }
        try {
            const map = loadSourceMap(mapPath);
            this.map = map;
            map.types = inferTypes(map.files, map.symbols, map.constants);
            if (announce) this._output('[evs-dbg] Source map: ' + mapPath + ' (' + map.statements.length + ' statements)');
        } catch (err) {
            this.map = null;
            this._output('[evs-dbg] Could not read ' + mapPath + ': ' + (err instanceof Error ? err.message : err), 'stderr');
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

    _setBreakpoints(args: { source?: { path?: string }; breakpoints?: { line: number }[] }) {
        const file = path.normalize((args.source && args.source.path) || '');
        const lines = (args.breakpoints || []).map((bp, i) => ({ line: bp.line, id: this._breakpointId(file, i) }));
        this.requested.set(file, lines);
        const breakpoints = this._resolve(file, lines);
        this._applyBreakpoints();
        return { breakpoints };
    }

    _breakpointId(file: string, index: number): number {
        if (!this.ids) this.ids = new Map();
        const key = file + '#' + index;
        if (!this.ids.has(key)) this.ids.set(key, this.ids.size + 1);
        return this.ids.get(key)!;
    }

    /** DAP breakpoints for a file's requested lines; a line without code moves to the next one in its function. */
    _resolve(file: string, lines: { line: number; id: number }[]): Breakpoint[] {
        return lines.map(({ line, id }): Breakpoint => {
            if (!this.map) return { id, verified: false, line, message: 'No source map (out/source_map.json)' };
            if (this.map.locationsAt(file, line).length) return { id, verified: true, line };
            const span = this.map.functionSpan(file, line);
            const next = span && this.map.linesWithCode(file).find(l => l > line && l <= span.end);
            if (next) return { id, verified: true, line: next, moved: true };
            return { id, verified: false, line, message: 'No script code on this line (not compiled, or not @install-ed nor called)' };
        });
    }

    _applyBreakpoints() {
        const addresses = new Set<number>();
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

    _breakpointLocations(args: { source?: { path?: string }; line: number; endLine?: number }) {
        const file = path.normalize((args.source && args.source.path) || '');
        const end = args.endLine || args.line;
        const lines = this.map ? this.map.linesWithCode(file).filter(l => l >= args.line && l <= end) : [];
        return { breakpoints: lines.map(line => ({ line })) };
    }

    // ---- stops --------------------------------------------------------------

    _onStop(snapshot: Snapshot): void {
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
    _rememberStop(): void {
        const snap = this.snapshot;
        const chain = this.map && snap && snap.address != null ? this.map.chainAt(snap.address & 0x3FFFFF) : null;
        this.lastStop = chain ? { slot: snap!.slot, chain, level: this.level } : null;
    }

    _stoppedSlot(): Slot | null {
        const snap = this.snapshot;
        return snap && snap.slot ? snap.slots.find(slot => slot.ptr === snap.slot) || null : null;
    }

    _threadList(): { id: number; name: string }[] {
        if (!this.snapshot) return [NO_SCRIPT_THREAD];
        const live = frames.liveThreads(this.snapshot);
        if (!live.length) return [NO_SCRIPT_THREAD];
        return live.map(slot => ({ id: frames.threadId(slot), name: frames.threadName(this.map, this.snapshot!, slot) }));
    }

    _slotForThread(threadId: number): Slot | null {
        if (!this.snapshot) return null;
        return frames.liveThreads(this.snapshot).find(slot => frames.threadId(slot) === threadId) || null;
    }

    _handle(value: Handle): number {
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

    _next(args: { threadId: number }) { return this._step(args, 'over'); }
    _stepIn(args: { threadId: number }) { return this._step(args, 'in'); }
    _stepOut(args: { threadId: number }) { return this._step(args, 'out'); }

    _step(args: { threadId: number }, kind: 'over' | 'in' | 'out') {
        const slot = this._slotForThread(args.threadId) || this._stoppedSlot();
        if (!slot) {
            this.deps.bridge.resume(null);
            return {};
        }
        const level = slot === this._stoppedSlot() ? this.level : Infinity;
        if (kind === 'in') {
            const deeper = frames.inlineStepInLevel(this.map, this.snapshot!, slot, level);
            if (deeper !== null) {
                // The inlined callee starts at this very address: nothing to run.
                this.level = deeper;
                this.handles = [];
                this._rememberStop();
                setImmediate(() => this._event('stopped', { reason: 'step', threadId: frames.threadId(slot), allThreadsStopped: true }));
                return {};
            }
        }
        this.deps.bridge.resume(frames.stepPredicate(this.map, this.snapshot!, slot, level, kind));
        return {};
    }

    // ---- inspection ---------------------------------------------------------

    _threads() {
        return { threads: this._threadList() };
    }

    _stackTrace(args: { threadId: number }) {
        const slot = this._slotForThread(args.threadId);
        if (!slot) return { stackFrames: [], totalFrames: 0 };
        const level = slot === this._stoppedSlot() ? this.level : null;
        const list = frames.threadFrames(this.map, this.snapshot!, slot, level);
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

    _scopes(args: { frameId: number }) {
        const frame = this.handles[args.frameId - 1];
        if (!frame || frame.kind !== 'frame') return { scopes: [] };
        const scopes: object[] = [];
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

    async _variables(args: { variablesReference: number }) {
        const ref = this.handles[args.variablesReference - 1];
        if (!ref || !this.snapshot) return { variables: [] };
        if (ref.kind === 'memory') {
            const span = this.map && this.map.functionSpan(ref.file, ref.line);
            return { variables: await this.memory.variables(ref.file, span ? span.start : ref.line, span ? span.end : ref.line) };
        }
        const byPtr = new Map(this.snapshot.slots.map((slot): [number, Slot] => [slot.ptr, slot]));
        const list = ref.kind === 'args' ? frames.argVariables(ref.slot) : frames.slotVariables(ref.slot, byPtr);
        return { variables: list.map(v => Object.assign({ variablesReference: 0 }, v)) };
    }

    _evaluate(args: { frameId?: number; expression: string; context?: string }) {
        const frame = args.frameId ? this.handles[args.frameId - 1] : null;
        return this.memory.evaluate(args.expression, (frame && 'slot' in frame ? frame.slot : null) || this._stoppedSlot(), args.context);
    }

    _setExpression(args: { expression: string; value: string }) { return this.memory.set(args.expression, args.value); }  // watch editing
    _setVariable(args: { name: string; value: string }) { return this.memory.set(args.name, args.value); }          // Memory scope editing
    _readMemory(args: Parameters<typeof memory.readMemoryRequest>[0]) { return memory.readMemoryRequest(args, this.deps.bridge); }
    _writeMemory(args: Parameters<typeof memory.writeMemoryRequest>[0]) { return memory.writeMemoryRequest(args, this.deps.bridge); }
}

export { EmulatorDebugSession };
