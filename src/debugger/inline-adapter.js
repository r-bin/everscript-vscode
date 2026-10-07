'use strict';

/**
 * debugger/inline-adapter.js
 *
 * Registers the 'everscript' debug type. The DAP session (emulator-session.js)
 * runs inside the extension host so it can reach the emulator panel; this
 * file is the only part of the debugger that touches the VS Code API.
 *
 *   launch  build the .evs (unless "build": false), load the ROM into the
 *           emulator and debug it; Ctrl+F5 (noDebug) only builds and runs
 *   attach  debug whatever ROM the emulator is running (panel: "connect dbg")
 */

const vscode = require('vscode');
const { EmulatorDebugSession } = require('./emulator-session');
const { findSourceMap } = require('./source-map');

class InlineAdapter {
    constructor(deps) {
        this.emitter = new vscode.EventEmitter();
        this.onDidSendMessage = this.emitter.event;
        this.session = new EmulatorDebugSession(deps);
        this.session.send = message => this.emitter.fire(message);
    }

    handleMessage(message) {
        this.session.handleMessage(message);
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

/**
 * @param context
 * @param emulator { bridge, runRom(romPath) }   from emulator/panel.js
 * @param repoPath () => string                  everscript.repoPath
 */
function registerDebugger(context, emulator, repoPath) {
    const deps = {
        bridge: emulator.bridge,
        async build(config) {
            const result = await vscode.commands.executeCommand('everscript.buildAndRun', { inputPath: config.program, run: false });
            config.rom = result && result.outputRom;
            return !!(result && result.ok);
        },
        async run(config) {
            if (config.rom) emulator.runRom(config.rom);
        },
        findMap(config) {
            return findSourceMap({ sourceMap: config.sourceMap, repoPath: repoPath(), program: config.program });
        },
    };

    context.subscriptions.push(
        vscode.debug.registerDebugAdapterDescriptorFactory('everscript', {
            createDebugAdapterDescriptor() {
                return new vscode.DebugAdapterInlineImplementation(new InlineAdapter(deps));
            },
        }),
        vscode.debug.registerDebugConfigurationProvider('everscript', {
            provideDebugConfigurations() {
                return [
                    { type: 'everscript', request: 'launch', name: 'Build and debug in emulator', program: '${file}' },
                    { type: 'everscript', request: 'attach', name: 'Attach to emulator', program: '${file}' },
                ];
            },
            resolveDebugConfiguration(folder, config) {
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
    );
}

module.exports = { registerDebugger };
