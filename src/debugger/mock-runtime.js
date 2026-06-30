'use strict';

/**
 * mock-runtime.js
 *
 * Parses an .evs source file and simulates stepping through it line by line.
 * No actual bytecode execution — this is a source-level mock for the DAP
 * adapter to use before a live emulator connection is available.
 *
 * Execution model:
 *   - A "frame" is { name, file, line, stmtIndex }
 *   - callStack is an array of frames (bottom = entry, top = current)
 *   - "statements" are the non-blank, non-comment, non-brace lines inside a fun
 *   - stepping advances stmtIndex; stepIn enters a callee if one is detected
 */

const fs   = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// ---------------------------------------------------------------------------
// Source parser
// ---------------------------------------------------------------------------

/**
 * Parse all `fun NAME(...) { ... }` blocks from .evs source text.
 * Returns a Map<name, { name, file, startLine, endLine, stmts: [{line, text}] }>
 *
 * Also handles `map NAME(...) { ... }` blocks that contain inline `fun`s.
 */
function parseFunctions(sourceText, filePath) {
    const lines   = sourceText.split('\n');
    const funcs   = new Map();
    let   depth   = 0;
    let   current = null;  // { name, startLine, stmts, depth }

    const FUN_OPEN  = /^(?:@\w+\([^)]*\)\s*)*(?:fun|map)\s+(\w+)\s*\(/;
    const COMMENT   = /^\s*(\/\/|#)/;
    const BLANK     = /^\s*$/;
    const BRACE_O   = /{/g;
    const BRACE_C   = /}/g;

    for (let i = 0; i < lines.length; i++) {
        const raw  = lines[i];
        const trim = raw.trim();

        // count brace depth
        const opens  = (raw.match(BRACE_O) || []).length;
        const closes = (raw.match(BRACE_C) || []).length;

        // detect function opening
        const m = trim.match(FUN_OPEN);
        if (m && !current) {
            current = {
                name:      m[1],
                file:      filePath,
                startLine: i,          // 0-based
                stmts:     [],
                baseDepth: depth,
            };
            depth += opens - closes;
            continue;
        }

        depth += opens - closes;

        if (!current) continue;

        // detect function close (depth back to base)
        if (depth <= current.baseDepth) {
            current.endLine = i;
            funcs.set(current.name, {
                name:      current.name,
                file:      current.file,
                startLine: current.startLine,
                endLine:   current.endLine,
                stmts:     current.stmts,
            });
            current = null;
            continue;
        }

        // collect statement lines (skip blank / comment / pure brace lines)
        if (!BLANK.test(trim) && !COMMENT.test(trim) && !/^[{}]$/.test(trim)) {
            current.stmts.push({ line: i, text: trim });
        }
    }

    return funcs;
}

/**
 * Detect what function is called on a given statement line.
 * Returns the callee name if it's a simple NAME() call, else null.
 */
function detectCall(stmtText, funcMap) {
    // look for identifiers followed by (  that match a known function
    const CALL_RE = /\b([a-z_]\w*)\s*\(/gi;
    let m;
    while ((m = CALL_RE.exec(stmtText)) !== null) {
        const candidate = m[1];
        if (funcMap.has(candidate)) return candidate;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

class MockRuntime extends EventEmitter {
    constructor() {
        super();
        this._funcs      = new Map();   // name → { name, file, startLine, endLine, stmts }
        this._stack      = [];          // [{ name, file, line, stmtIndex }]
        this._breaks     = new Map();   // file → Set<line (0-based)>
        this._running    = false;
        this._sourceFile = null;
    }

    _loadFileFunctions(sourceFile) {
        const abs = path.resolve(sourceFile);
        const text = fs.readFileSync(abs, 'utf-8');
        this._funcs = parseFunctions(text, abs);
        this._sourceFile = abs;
        return this._funcs;
    }

    // -----------------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------------

    load(sourceFile) {
        this._loadFileFunctions(sourceFile);
        return this._funcs;
    }

    syncFromEmulator(file, line1, name, details) {
        const absFile = path.resolve(file);
        if (!this._sourceFile || this._sourceFile !== absFile || !this._funcs.size) {
            this._loadFileFunctions(absFile);
        }

        const line0 = Math.max(0, (line1 | 0) - 1);
        let fn = null;
        let stmtIndex = 0;

        if (name && this._funcs.has(name)) {
            fn = this._funcs.get(name);
        } else {
            for (const candidate of this._funcs.values()) {
                if (candidate.file === absFile && candidate.startLine <= line0 && candidate.endLine >= line0) {
                    fn = candidate;
                    break;
                }
            }
        }

        if (fn && fn.stmts.length) {
            let bestIndex = 0;
            let bestDistance = Infinity;
            for (let i = 0; i < fn.stmts.length; i++) {
                const distance = Math.abs(fn.stmts[i].line - line0);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = i;
                }
            }
            stmtIndex = bestIndex;
        } else {
            fn = {
                name: name || 'emulator_break',
                file: absFile,
                startLine: line0,
                endLine: line0,
                stmts: [{ line: line0, text: details || '(emulator break)' }],
            };
            stmtIndex = 0;
        }

        this._stack = [{ fn, stmtIndex }];
        this._running = false;
        this.emit('output', `[evs-dbg] Emulator sync -> ${path.basename(absFile)}:${line0 + 1}${details ? ' ' + details : ''}\n`, 'console');
    }

    /**
     * Start execution at the named entry function.
     * Fires 'stopOnEntry' after pushing the initial frame.
     */
    start(entryFunction) {
        const fn = this._funcs.get(entryFunction);
        if (!fn) {
            // list available functions to help the user
            const available = [...this._funcs.keys()].join(', ');
            this.emit('output', `[evs-dbg] Entry function '${entryFunction}' not found.\nAvailable: ${available}\n`, 'stderr');
            this.emit('end');
            return;
        }

        this._stack = [];
        this._pushFrame(fn, 0);
        this._running = false;
        this.emit('stopOnEntry');
    }

    // -----------------------------------------------------------------------
    // Breakpoints
    // -----------------------------------------------------------------------

    setBreakpoints(file, lines) {
        const absFile = path.resolve(file);
        const set = new Set(lines.map(l => l - 1));  // DAP lines are 1-based
        this._breaks.set(absFile, set);
    }

    clearBreakpoints(file) {
        this._breaks.delete(path.resolve(file));
    }

    _isBreakpoint(file, line0) {
        const s = this._breaks.get(path.resolve(file));
        return s ? s.has(line0) : false;
    }

    // -----------------------------------------------------------------------
    // Stepping
    // -----------------------------------------------------------------------

    /**
     * Step to the next statement in the current function.
     * If we were at the last statement, step out (pop frame).
     */
    stepOver() {
        if (!this._advance()) {
            this.emit('stopOnStep');
        }
    }

    /**
     * If the current statement contains a call to a known function, push that
     * function's frame.  Otherwise behave like stepOver.
     */
    stepIn() {
        const frame = this._top();
        if (!frame) { this.emit('end'); return; }

        const stmt = frame.fn.stmts[frame.stmtIndex];
        if (stmt) {
            const callee = detectCall(stmt.text, this._funcs);
            if (callee) {
                const calleeFn = this._funcs.get(callee);
                if (calleeFn && calleeFn.stmts.length > 0) {
                    this._pushFrame(calleeFn, 0);
                    this.emit('stopOnStep');
                    return;
                }
            }
        }
        this.stepOver();
    }

    /**
     * Pop the current frame (return from function), stop at the call site.
     */
    stepOut() {
        if (this._stack.length > 1) {
            this._stack.pop();
            this.emit('stopOnStep');
        } else {
            this.emit('end');
        }
    }

    /**
     * Run until the next breakpoint or end of script.
     */
    continue() {
        this._running = true;
        this._runLoop();
    }

    _runLoop() {
        // synchronous loop capped at 10000 steps to avoid infinite hangs
        for (let i = 0; i < 10000 && this._running; i++) {
            const frame = this._top();
            if (!frame) { this.emit('end'); return; }

            const stmt = frame.fn.stmts[frame.stmtIndex];
            if (stmt && this._isBreakpoint(frame.fn.file, stmt.line)) {
                this._running = false;
                this.emit('stopOnBreakpoint');
                return;
            }
            if (this._advance()) return;  // we stopped (step completed)
        }
        if (this._running) {
            this._running = false;
            this.emit('end');
        }
    }

    // -----------------------------------------------------------------------
    // DAP introspection
    // -----------------------------------------------------------------------

    /**
     * Returns the current call stack as DAP StackFrame objects.
     */
    stackFrames() {
        return this._stack.slice().reverse().map((f, i) => ({
            id:     i,
            name:   f.fn.name,
            source: { path: f.fn.file },
            line:   (f.fn.stmts[f.stmtIndex] ? f.fn.stmts[f.stmtIndex].line : f.fn.startLine) + 1,  // 1-based
            column: 1,
        }));
    }

    /**
     * Returns mock local variable scopes for the current frame.
     */
    scopes(frameId) {
        const idx   = this._stack.length - 1 - frameId;
        const frame = this._stack[idx];
        if (!frame) return [];
        return [
            { name: 'Locals', variablesReference: 1000 + frameId, expensive: false },
            { name: 'arg[]',  variablesReference: 2000 + frameId, expensive: false },
        ];
    }

    /**
     * Returns mock variables for a scope reference.
     */
    variables(ref) {
        // In Phase 2, these come from WRAM reads.
        // For the mock, return placeholder values based on the scope.
        const frameId = ref >= 2000 ? ref - 2000 : ref - 1000;
        const isArg   = ref >= 2000;

        const idx   = this._stack.length - 1 - frameId;
        const frame = this._stack[idx];
        if (!frame) return [];

        if (isArg) {
            return Array.from({ length: 4 }, (_, i) => ({
                name:               `arg[0x${(i * 2).toString(16).padStart(2, '0')}]`,
                value:              '0x0000  (mock)',
                variablesReference: 0,
            }));
        }

        // extract memory refs from this function's statements
        const seen  = new Set();
        const vars  = [];
        for (const stmt of frame.fn.stmts) {
            for (const m of stmt.text.matchAll(/<0x([0-9a-fA-F]+)>/g)) {
                const addr = m[1].toUpperCase();
                if (!seen.has(addr)) {
                    seen.add(addr);
                    vars.push({
                        name:               `<0x${addr}>`,
                        value:              '0x0000  (mock)',
                        variablesReference: 0,
                    });
                }
            }
        }
        return vars.length ? vars : [{ name: '(no locals)', value: '', variablesReference: 0 }];
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    _top() {
        return this._stack.length ? this._stack[this._stack.length - 1] : null;
    }

    _pushFrame(fn, stmtIndex) {
        this._stack.push({ fn, stmtIndex });
    }

    /**
     * Advance one statement.  Pops frame if at end.  Returns true if end was
     * reached (caller should NOT fire another stop event — we'll fire 'end').
     */
    _advance() {
        const frame = this._top();
        if (!frame) { this.emit('end'); return true; }

        frame.stmtIndex++;
        if (frame.stmtIndex >= frame.fn.stmts.length) {
            // function exhausted — pop and keep going (simulates return)
            this._stack.pop();
            if (this._stack.length === 0) {
                this.emit('end');
                return true;
            }
            // continue in caller (already advanced past the call site implicitly)
        }
        return false;
    }
}

module.exports = { MockRuntime, parseFunctions };
