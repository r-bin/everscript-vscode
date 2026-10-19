/**
 * debugger/inline-adapter.ts
 *
 * Registers the 'everscript' debug type. The DAP session (emulator-session.ts)
 * runs inside the extension host so it can reach the emulator panel; this
 * file is the only part of the debugger that touches the VS Code API.
 *
 *   launch  build the .evs (unless "build": false), load the ROM into the
 *           emulator and debug it; Ctrl+F5 (noDebug) only builds and runs
 *   attach  debug whatever ROM the emulator is running (panel: "connect dbg")
 *
 * F5 in an .evs editor runs everscript.debugInEmulator, not the launch.json
 * selection: the everscript repo's launch.json debugs the Python compiler.
 *
 * While stopped, memory shows in the editor too: hovering MEMORY.X (or
 * <0x0ADA>, $7E0ADA, arg[0x02]) evaluates it, and inline values print every
 * memory name of the stopped function next to its line, and what each
 * if / else if / while condition evaluates to right now.
 */

import * as vscode from 'vscode';
import { EmulatorDebugSession } from './emulator-session';
import type { Deps, Config, DapRequest, Message } from './emulator-session';
import { findSourceMap } from './source-map';
import { NAME_PATTERN, MEMORY_PATTERN } from './memory-access';
import { conditionOf } from './conditions';

class InlineAdapter implements vscode.DebugAdapter {
    emitter = new vscode.EventEmitter<Message>();
    onDidSendMessage = this.emitter.event;
    session: EmulatorDebugSession;

    constructor(deps: Deps) {
        this.session = new EmulatorDebugSession(deps);
        this.session.send = (message: Message) => this.emitter.fire(message);
    }

    handleMessage(message: vscode.DebugProtocolMessage) {
        this.session.handleMessage(message as DapRequest);
    }

    dispose() {
        this.session.dispose();
        this.emitter.dispose();
    }
}

function activeEvsFile() {
    const editor = vscode.window.activeTextEditor;
    return editor && editor.document.languageId === 'everscript' ? editor.document.uri.fsPath : undefined;
}

const HOVER_PATTERNS = [
    MEMORY_PATTERN,
    NAME_PATTERN,
    /\$(?:7[EF])?[0-9a-fA-F]{4}\b/g,
    /\barg\[\s*(?:0x[0-9a-fA-F]+|\d+)\s*\]/g,
];

/** The memory expression under the cursor (debug hover). */
function expressionAt(document: vscode.TextDocument, position: vscode.Position) {
    const text = document.lineAt(position.line).text;
    for (const pattern of HOVER_PATTERNS) {
        for (const m of text.matchAll(new RegExp(pattern.source, 'g'))) {
            if (position.character < m.index! || position.character > m.index! + m[0].length) continue;
            const range = new vscode.Range(position.line, m.index!, position.line, m.index! + m[0].length);
            return new vscode.EvaluatableExpression(range, m[0]);
        }
    }
    return undefined;
}

/** Lines [start, end] of the fun / map block around a line (brace matched). */
function functionRange(document: vscode.TextDocument, line: number) {
    let start = line;
    while (start > 0 && line - start < 600 && !/^\s*(?:fun|map)\b/.test(document.lineAt(start).text)) start--;
    let depth = 0;
    let opened = false;
    for (let i = start; i < document.lineCount && i - start < 2000; i++) {
        const code = document.lineAt(i).text.replace(/\/\/.*$/, '');
        for (const ch of code) {
            if (ch === '{') { depth++; opened = true; }
            else if (ch === '}') depth--;
        }
        if (opened && depth <= 0) return { start, end: i };
    }
    return { start, end: Math.min(document.lineCount - 1, line) };
}

/**
 * Inline values for the stopped function: every memory name and literal, and
 * after each if / else if / while condition what it evaluates to with the
 * memory as it is now (later conditions are a prediction: memory can change
 * before execution gets there). In an if / else-if chain, the branches after
 * the taken one say so instead.
 */
async function inlineValues(document: vscode.TextDocument, context: vscode.InlineValueContext, session: EmulatorDebugSession | null, isMemory: (name: string) => boolean) {
    const { start, end } = functionRange(document, context.stoppedLocation.end.line);
    const values: vscode.InlineValue[] = [];
    const takenAtIndent = new Map<number, boolean>(); // indentation of an if chain -> a branch already taken
    for (let line = start; line <= end; line++) {
        const text = document.lineAt(line).text;
        const comment = text.indexOf('//');
        const code = comment >= 0 ? text.slice(0, comment) : text;
        const seen = new Set();
        for (const pattern of [NAME_PATTERN, MEMORY_PATTERN]) {
            for (const m of code.matchAll(new RegExp(pattern.source, 'g'))) {
                if (seen.has(m[0]) || (pattern === NAME_PATTERN && !isMemory(m[0]))) continue;
                seen.add(m[0]);
                const range = new vscode.Range(line, m.index!, line, m.index! + m[0].length);
                values.push(new vscode.InlineValueEvaluatableExpression(range, m[0]));
            }
        }
        const condition = session && conditionOf(code);
        if (!condition) continue;
        const indent = code.search(/\S/);
        const chained = condition.kind === 'else if';
        if (!chained) takenAtIndent.delete(indent);
        let hint: string;
        if (chained && takenAtIndent.get(indent)) {
            hint = '⇒ skipped (an earlier branch runs)';
        } else {
            let result = await session.memory.evaluateCondition(condition.text, session._stoppedSlot());
            if (result !== undefined && condition.negated) result = !result;
            if (result === undefined) continue;
            hint = result ? '⇒ true' : '⇒ false';
            if (condition.kind !== 'while' && result) takenAtIndent.set(indent, true);
        }
        values.push(new vscode.InlineValueText(new vscode.Range(line, condition.end, line, condition.end), hint));
    }
    return values;
}

/** What the emulator panel hands the debugger. */
interface Emulator { bridge: Deps['bridge']; runRom(romPath: string): void }

/**
 * @param context
 * @param emulator { bridge, runRom(romPath) }   from emulator/panel.js
 * @param repoPath () => string                  everscript.repoPath
 * @param lookupSymbol (name) -> "(Byte) <0x0ADA>" | null   fallback memory names
 */
function registerDebugger(context: vscode.ExtensionContext, emulator: Emulator, repoPath: () => string, lookupSymbol?: (name: string) => string | null | undefined) {
    const sessions = new Set<EmulatorDebugSession>();
    // A name is memory when the running session's source map (or the language index) says so.
    const isMemory = (name: string) => [...sessions].some(session => session.memory.locate(name))
        || (!!lookupSymbol && /</.test(lookupSymbol(name) || ''));
    const deps: Deps = {
        bridge: emulator.bridge,
        lookupSymbol,
        async build(config: Config) {
            const result = await vscode.commands.executeCommand('everscript.buildAndRun', { inputPath: config.program, run: false });
            const built = result as { ok?: boolean; outputRom?: string } | undefined;
            config.rom = built && built.outputRom;
            return !!(built && built.ok);
        },
        async run(config: Config) {
            if (config.rom) emulator.runRom(config.rom as string);
        },
        findMap(config: Config) {
            return findSourceMap({ sourceMap: config.sourceMap as string | undefined, repoPath: repoPath(), program: config.program });
        },
    };

    context.subscriptions.push(
        vscode.debug.registerDebugAdapterDescriptorFactory('everscript', {
            createDebugAdapterDescriptor() {
                const adapter = new InlineAdapter(deps);
                sessions.add(adapter.session);
                const dispose = adapter.dispose.bind(adapter);
                adapter.dispose = () => { sessions.delete(adapter.session); dispose(); };
                return new vscode.DebugAdapterInlineImplementation(adapter);
            },
        }),
        vscode.languages.registerEvaluatableExpressionProvider('everscript', {
            provideEvaluatableExpression: expressionAt,
        }),
        vscode.languages.registerInlineValuesProvider('everscript', {
            provideInlineValues: (document, viewPort, context) =>
                inlineValues(document, context, [...sessions].find(session => session.snapshot) || null, isMemory),
        }),
        vscode.debug.registerDebugConfigurationProvider('everscript', {
            provideDebugConfigurations() {
                return [
                    { type: 'everscript', request: 'launch', name: 'Build and debug in emulator', program: '${file}' },
                    { type: 'everscript', request: 'attach', name: 'Attach to emulator', program: '${file}' },
                ];
            },
            resolveDebugConfiguration(_folder: unknown, config: vscode.DebugConfiguration) {
                // F5 without launch.json: build and debug the active .evs file
                if (!config.type && !config.request && !config.name) {
                    const program = activeEvsFile();
                    if (!program) return undefined;
                    Object.assign(config, { type: 'everscript', request: 'launch', name: 'Build and debug in emulator', program });
                }
                if (!config.program || config.program === '${file}') config.program = activeEvsFile() || config.program;
                return config;
            },
        }),
        vscode.commands.registerCommand('everscript.attachDebugger', () => vscode.debug.startDebugging(undefined, {
            type: 'everscript', request: 'attach', name: 'Attach to emulator', program: activeEvsFile(),
        })),
        // F5 in an .evs editor, regardless of the launch.json selection (e.g. a debugpy entry for the compiler).
        vscode.commands.registerCommand('everscript.debugInEmulator', () => {
            const program = activeEvsFile();
            if (!program) return vscode.window.showWarningMessage('Everscript: no .evs file is active.');
            return vscode.debug.startDebugging(undefined, { type: 'everscript', request: 'launch', name: 'Build and debug in emulator', program });
        }),
    );
}

export { registerDebugger };
