#!/usr/bin/env node
'use strict';

/**
 * debugger/adapter.js
 *
 * Minimal Debug Adapter Protocol (DAP) server for Everscript .evs files.
 * Communicates over stdin/stdout using the standard DAP framing:
 *
 *   Content-Length: N\r\n
 *   \r\n
 *   { JSON body }
 *
 * Works entirely without npm dependencies — implements just the subset of DAP
 * needed for the mock runtime (launch, breakpoints, step, stack, variables).
 *
 * Reference: https://microsoft.github.io/debug-adapter-protocol/specification
 */

const { MockRuntime } = require('./mock-runtime');

// ---------------------------------------------------------------------------
// DAP framing (stdin/stdout)
// ---------------------------------------------------------------------------

let _buf = Buffer.alloc(0);
let _seq = 1;

process.stdin.on('data', chunk => {
    _buf = Buffer.concat([_buf, chunk]);
    processBuffer();
});

function processBuffer() {
    while (true) {
        const header = _buf.indexOf('\r\n\r\n');
        if (header === -1) return;

        const headerStr = _buf.slice(0, header).toString('utf8');
        const lenMatch  = headerStr.match(/Content-Length:\s*(\d+)/i);
        if (!lenMatch) { _buf = _buf.slice(header + 4); continue; }

        const bodyLen = parseInt(lenMatch[1], 10);
        const start   = header + 4;
        if (_buf.length < start + bodyLen) return;

        const body = _buf.slice(start, start + bodyLen).toString('utf8');
        _buf = _buf.slice(start + bodyLen);

        try {
            handleMessage(JSON.parse(body));
        } catch (e) {
            // swallow parse errors
        }
    }
}

function send(msg) {
    const body = JSON.stringify(msg);
    const out  = `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
    process.stdout.write(out);
}

function response(req, body = {}, success = true) {
    send({
        seq:         _seq++,
        type:        'response',
        request_seq: req.seq,
        success,
        command:     req.command,
        body,
    });
}

function event(name, body = {}) {
    send({ seq: _seq++, type: 'event', event: name, body });
}

// ---------------------------------------------------------------------------
// Runtime wiring
// ---------------------------------------------------------------------------

const rt = new MockRuntime();

rt.on('stopOnEntry',     () => event('stopped', { reason: 'entry',      threadId: 1, allThreadsStopped: true }));
rt.on('stopOnStep',      () => event('stopped', { reason: 'step',       threadId: 1, allThreadsStopped: true }));
rt.on('stopOnBreakpoint',() => event('stopped', { reason: 'breakpoint', threadId: 1, allThreadsStopped: true }));
rt.on('end',             () => { event('output', { category: 'console', output: '[evs-dbg] Script finished.\n' }); event('terminated'); });
rt.on('output',          (msg, cat) => event('output', { category: cat || 'console', output: msg }));

// ---------------------------------------------------------------------------
// Request handlers
// ---------------------------------------------------------------------------

const handlers = {};

handlers.initialize = (req) => {
    response(req, {
        supportsConfigurationDoneRequest:  true,
        supportsStepInTargetsRequest:      false,
        supportsFunctionBreakpoints:       false,
        supportsConditionalBreakpoints:    false,
        supportsRestartRequest:            false,
        supportsSetVariable:               false,
        supportsEvaluateForHovers:         false,
    });
    event('initialized');
};

handlers.configurationDone = (req) => {
    response(req);
};

handlers.launch = (req) => {
    const args         = req.arguments || {};
    const program      = args.program;
    const entryFn      = args.entryFunction || 'trigger_enter';

    if (!program) {
        response(req, { error: { id: 1, format: 'launch requires "program" path' } }, false);
        return;
    }

    try {
        rt.load(program);
        event('output', { category: 'console', output: `[evs-dbg] Loaded ${program}\n` });
        response(req);
        rt.start(entryFn);
    } catch (e) {
        response(req, { error: { id: 2, format: String(e) } }, false);
    }
};

handlers.disconnect = (req) => {
    response(req);
    process.exit(0);
};

handlers.setBreakpoints = (req) => {
    const args   = req.arguments || {};
    const file   = (args.source || {}).path || '';
    const lines  = (args.breakpoints || []).map(b => b.line);

    rt.setBreakpoints(file, lines);

    const verified = lines.map(line => ({ verified: true, line }));
    response(req, { breakpoints: verified });
};

handlers.setExceptionBreakpoints = (req) => {
    response(req, { breakpoints: [] });
};

handlers.threads = (req) => {
    response(req, { threads: [{ id: 1, name: 'script' }] });
};

handlers.stackTrace = (req) => {
    const frames = rt.stackFrames();
    response(req, { stackFrames: frames, totalFrames: frames.length });
};

handlers.scopes = (req) => {
    const frameId = (req.arguments || {}).frameId || 0;
    response(req, { scopes: rt.scopes(frameId) });
};

handlers.variables = (req) => {
    const ref = (req.arguments || {}).variablesReference || 0;
    response(req, { variables: rt.variables(ref) });
};

handlers.continue = (req) => {
    response(req, { allThreadsContinued: true });
    rt.continue();
};

handlers.next = (req) => {
    response(req);
    rt.stepOver();
};

handlers.stepIn = (req) => {
    response(req);
    rt.stepIn();
};

handlers.stepOut = (req) => {
    response(req);
    rt.stepOut();
};

handlers.pause = (req) => {
    response(req);
    // in the mock there is nothing async to pause; just stop
    event('stopped', { reason: 'pause', threadId: 1, allThreadsStopped: true });
};

handlers.evaluate = (req) => {
    // minimal hover evaluation — return mock
    response(req, { result: '(mock)', variablesReference: 0 });
};

// ---------------------------------------------------------------------------
// Message dispatcher
// ---------------------------------------------------------------------------

function handleMessage(msg) {
    if (msg.type !== 'request') return;
    const handler = handlers[msg.command];
    if (handler) {
        handler(msg);
    } else {
        // default: acknowledge unknown requests
        response(msg, {});
    }
}
