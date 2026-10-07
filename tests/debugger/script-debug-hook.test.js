'use strict';

// The VS Code script debugger's interpreter hook, end to end: the webview code
// as the webview gets it (extracted from the generated HTML), the custom core,
// and a ROM built by the everscript compiler together with its
// out/source_map.json. Skipped when that build is not around
// (EVERSCRIPT_REPO, default ../everscript).

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const vm     = require('vm');
const { buildHtml } = require('../../src/emulator/panel-webview');
const { loadSourceMap, romOffset } = require('../../src/debugger/source-map');
const frames = require('../../src/debugger/script-frames');

const REPO = process.env.EVERSCRIPT_REPO || path.join(__dirname, '..', '..', '..', 'everscript');
const ROM = path.join(REPO, 'out', 'Secret of Evermore (U) [!].smc');
const MAP = path.join(REPO, 'out', 'source_map.json');
const CORE_DIR = path.join(__dirname, '..', '..', 'src', 'emulator', 'core', 'snes9x2005-wasm');
const MAX_FRAMES = 2400;

if (!fs.existsSync(ROM) || !fs.existsSync(MAP) || !fs.existsSync(path.join(CORE_DIR, 'snes9x_2005.wasm'))) {
    console.log('Script debugger hook: skipped (needs ' + ROM + ', its source_map.json and the custom core)');
    process.exit(0);
}

function extract(src, from, endFunction) {
    const start = src.indexOf(from);
    assert.ok(start >= 0, from + ' not found in generated script');
    const fnStart = src.indexOf('function ' + endFunction + '(', start);
    let depth = 0;
    for (let i = src.indexOf('{', fnStart); i < src.length; i++) {
        if (src[i] === '{') depth++;
        if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
    }
    throw new Error('unbalanced braces');
}

const html = String(buildHtml({ cspSource: 'x', asWebviewUri: u => u }, 'core.js', 'core.wasm', 'core', 'core.js'));
const script = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
const hookSource = extract(script, '// -- VS Code script debugger', 'sdbgHandleMessage');
const bridgeSource = extract(script, 'function installDebuggerBridge(', 'installDebuggerBridge');

function bootCore() {
    return new Promise(resolve => {
        const file = path.join(CORE_DIR, 'snes9x_2005.js');
        global.require = require;
        global.__dirname = CORE_DIR;
        global.__filename = file;
        global.Module = {
            locateFile: f => path.join(CORE_DIR, f),
            onRuntimeInitialized() { resolve(global.Module); },
        };
        vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
    });
}

(async () => {
    const map = loadSourceMap(MAP);
    const m = await bootCore();
    const posted = [];
    const webview = new Function('Module', 'HEAPU8', 'posted', `
        const vscodeApi = { postMessage: msg => posted.push(msg) };
        const SCRIPT_BASE = 0x28FC, SLOT_SIZE = 0x4F, SLOT_COUNT = 20, SCRIPT_REGION_SIZE = 0x4F * 20;
        const SCRIPT_STACK_BUS_ADDR = 0x7E28FC, SCRIPT_ARG_OFFSET = 0x0F, SCRIPT_ARG_BYTES = 0x20;
        let romLoaded = false;
        function readU16(w, o) { return (w[o] | (w[o + 1] << 8)) >>> 0; }
        function readU24(w, o) { return (w[o] | (w[o + 1] << 8) | (w[o + 2] << 16)) >>> 0; }
        function fmtHex(v, w) { return (v >>> 0).toString(16).toUpperCase().padStart(w, '0'); }
        function fmtBreakpointAddr(v) { return fmtHex(v, 6); }
        function setText() {}
        function reportHookStatus() {}
        function getModule() { return Module; }
        function isEmulatorPaused() { return !!Module.isEmulationPaused(); }
        function hasDebuggerApi(m) { return !!m && typeof m.getCPUState === 'function' && typeof m.readMemoryRange === 'function'
            && typeof m.pauseEmulation === 'function' && typeof m.resumeEmulation === 'function'; }
        ${bridgeSource}
        ${hookSource}
        return {
            boot(rom) {
                const ptr = Module._my_malloc(rom.length);
                HEAPU8.set(rom, ptr);
                Module._startWithRom(ptr, rom.length, 32040);
                Module._my_free(ptr);
                romLoaded = true;
                sdbgOnBoot();
            },
            message: sdbgHandleMessage,
            state: () => sdbg,
        };
    `)(m, global.HEAPU8, posted);

    function runUntilStop() {
        for (let i = 0; i < MAX_FRAMES; i++) {
            m._setJoypadInput(0);
            m._mainLoop();
            if (m.isEmulationPaused()) return posted.filter(p => p.command === 'scriptDebugStop').pop();
        }
        return null;
    }

    const firstStatement = fn => map.statements.find(st => st.address >= fn.address);
    const intro = map.functions.find(fn => fn.name === 'intro_skip');
    const enter = map.functions.find(fn => /^maps\[.*trigger_enter/.test(fn.name));
    assert.ok(intro && enter, 'the practice build has intro_skip and a room enter script');
    const introAt = firstStatement(intro).address;
    const enterAt = firstStatement(enter).address;
    webview.message({ command: 'scriptDebugConfigure', active: true, breakpoints: [introAt, enterAt] });
    webview.boot(fs.readFileSync(ROM));
    assert.ok(webview.state().armed, 'hook armed before the first frame');

    // 1. intro_skip's only line is a room change: it never reaches its next
    //    line, and the slot goes to other scripts - none of them ends the step.
    let stop = runUntilStop();
    assert.ok(stop && stop.reason === 'breakpoint' && romOffset(stop.address) === introAt, 'breakpoint in intro_skip');
    let running = stop.slots.find(slot => slot.ptr === stop.slot);
    webview.message({ command: 'scriptDebugResume', step: frames.stepPredicate(map, stop, running, frames.stopLevel(map, stop, null), 'over') });
    stop = runUntilStop();
    assert.ok(stop, 'the room enter breakpoint is reached');
    assert.strictEqual(stop.reason, 'breakpoint', 'no step stop in a script that reused the slot');
    assert.strictEqual(romOffset(stop.address), enterAt);
    console.log('  [PASS] step over a room change: no stop in the scripts that reuse the slot');

    // 2. A step over in the enter script stops on its next line.
    running = stop.slots.find(slot => slot.ptr === stop.slot);
    const before = map.chainAt(romOffset(stop.address));
    webview.message({ command: 'scriptDebugConfigure', active: true, breakpoints: [] });
    webview.message({ command: 'scriptDebugResume', step: frames.stepPredicate(map, stop, running, frames.stopLevel(map, stop, null), 'over') });
    const step = runUntilStop();
    assert.ok(step && step.reason === 'step', 'step finished');
    const after = map.chainAt(romOffset(step.address));
    assert.strictEqual(step.slot, stop.slot, 'same script');
    assert.strictEqual(map.functionAt(romOffset(step.address)), enter, 'same function');
    assert.notStrictEqual(after[0].line, before[0].line, 'another line');
    console.log('  [PASS] step over: ' + enter.name + ' line ' + before[0].line + ' -> ' + after[0].line);

    // 3. Step in until a called script (a new slot whose caller is this one)
    //    starts, then step out: back in the enter script.
    let at = step;
    let callee = null;
    for (let i = 0; i < 40 && !callee; i++) {
        const slot = at.slots.find(sl => sl.ptr === at.slot);
        webview.message({ command: 'scriptDebugResume', step: frames.stepPredicate(map, at, slot, frames.stopLevel(map, at, null), 'in') });
        at = runUntilStop();
        assert.ok(at && at.reason === 'step', 'step in finished');
        const now = at.slots.find(sl => sl.ptr === at.slot);
        if (at.slot !== stop.slot && now.parent === stop.slot) callee = now;
    }
    assert.ok(callee, 'stepped into a called script');
    const calleeName = map.functionAt(romOffset(at.address)).name;
    webview.message({ command: 'scriptDebugResume', step: frames.stepPredicate(map, at, callee, 0, 'out') });
    const out = runUntilStop();
    assert.ok(out && out.reason === 'step' && out.slot === stop.slot, 'step out lands in the caller');
    assert.strictEqual(map.functionAt(romOffset(out.address)), enter);
    console.log('  [PASS] step into ' + calleeName + ' (slot ' + callee.index + ') and out to line ' + map.chainAt(romOffset(out.address - 1))[0].line);

    // Continue without breakpoints: the hook disarms and the game runs on.
    webview.message({ command: 'scriptDebugResume', step: null });
    assert.ok(!webview.state().armed, 'hook disarmed when nothing is wanted');
    assert.strictEqual(runUntilStop(), null, 'no further stop');
    console.log('  [PASS] continue: ' + MAX_FRAMES + ' frames without a stop');
})().catch(err => {
    console.error('  [FAIL] ' + (err.stack || err.message));
    process.exit(1);
});
